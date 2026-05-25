import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Dumbbell, Clock, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import type { SessionExercise, Exercise, SetEntry } from '../../db/types';
import { 
  addSetToExercise, 
  deleteSet, 
  markExerciseCompleted, 
  getLastSetForExercise, 
  getCurrentBodyweight, 
  useSetsForExerciseLive,
  checkPR
} from './api';
import { db } from '../../db';
import { HAPTIC } from '../../hooks/useHaptic';
import RestTimer from './RestTimer';
import { useTimer } from '../../hooks/useTimer';

interface ExerciseSessionDetailProps {
  sessionExercise: SessionExercise & { exercise: Exercise };
  onClose: () => void;
  targetSetsCount?: number;
  targetReps?: number;
  targetWeight?: number;
  targetAddedWeight?: number;
  targetTimeSeconds?: number;
}

export default function ExerciseSessionDetail({
  sessionExercise,
  onClose,
  targetSetsCount = 3,
  targetReps,
  targetWeight,
  targetAddedWeight,
  targetTimeSeconds
}: ExerciseSessionDetailProps) {
  const { exercise } = sessionExercise;
  const sets = useSetsForExerciseLive(sessionExercise.id);

  // States
  const [bodyweight, setBodyweight] = useState(70);
  const [showBodyweightModal, setShowBodyweightModal] = useState(false);
  const [bodyweightInput, setBodyweightInput] = useState('70');
  const [suggestedSet, setSuggestedSet] = useState<Partial<SetEntry> | null>(null);

  // Input states for the active logging set
  const [repsInput, setRepsInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [addedWeightInput, setAddedWeightInput] = useState('');
  const [timeInput, setTimeInput] = useState('');

  // Workout timer mode state
  const [workoutTimerMode, setWorkoutTimerMode] = useState<'stopwatch' | 'countdown'>('stopwatch');

  // Rest Timer overlay state
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [defaultRestSecs, setDefaultRestSecs] = useState(90);

  // Warning state
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [newPRToast, setNewPRToast] = useState<string | null>(null);

  // Time-based set timer hook
  const setTimer = useTimer({
    mode: workoutTimerMode,
    initialSeconds: targetTimeSeconds || 60,
  });

  // Load configuration & defaults
  useEffect(() => {
    // Fetch bodyweight & rest time settings
    getCurrentBodyweight().then(bw => {
      setBodyweight(bw);
      setBodyweightInput(bw.toString());
    });

    db.settings.get('singleton').then(settings => {
      if (settings) {
        setDefaultRestSecs(settings.default_rest_seconds || 90);
        if (settings.default_workout_timer_mode) {
          setWorkoutTimerMode(settings.default_workout_timer_mode);
        }
      }
    });

    // Fetch suggestion from previous workouts
    getLastSetForExercise(exercise.id).then(lastSet => {
      if (lastSet) {
        setSuggestedSet(lastSet);
        // Pre-fill inputs with suggested values
        if (exercise.measurement_type === 'reps') {
          setRepsInput((lastSet.actual_reps ?? 10).toString());
          if (exercise.is_bodyweight) {
            setAddedWeightInput((lastSet.actual_added_weight ?? 0).toString());
          } else {
            setWeightInput((lastSet.actual_weight ?? 20).toString());
          }
        } else {
          setTimeInput((lastSet.actual_time_seconds ?? 60).toString());
        }
      } else {
        // Fallback pre-fills using targets
        if (exercise.measurement_type === 'reps') {
          setRepsInput((targetReps ?? 10).toString());
          if (exercise.is_bodyweight) {
            setAddedWeightInput((targetAddedWeight ?? 0).toString());
          } else {
            setWeightInput((targetWeight ?? 20).toString());
          }
        } else {
          setTimeInput((targetTimeSeconds ?? 60).toString());
        }
      }
    });
  }, [exercise, targetReps, targetWeight, targetAddedWeight, targetTimeSeconds]);

  // Pre-fill next set inputs based on last logged set in this session
  useEffect(() => {
    if (sets && sets.length > 0) {
      const lastLogged = sets[sets.length - 1];
      if (exercise.measurement_type === 'reps') {
        setRepsInput((lastLogged.actual_reps ?? 10).toString());
        if (exercise.is_bodyweight) {
          setAddedWeightInput((lastLogged.actual_added_weight ?? 0).toString());
        } else {
          setWeightInput((lastLogged.actual_weight ?? 20).toString());
        }
      } else {
        setTimeInput((lastLogged.actual_time_seconds ?? 60).toString());
      }
    }
  }, [sets, exercise]);

  // Handle bodyweight submit
  const handleSaveBodyweight = async () => {
    const val = parseFloat(bodyweightInput);
    if (isNaN(val) || val <= 0) return;

    await db.bodyMetrics.add({
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      weight_kg: val,
      notes: 'Ghi nhận tự động từ buổi tập',
    });

    setBodyweight(val);
    setShowBodyweightModal(false);
  };

  // Log a set
  const handleAddSet = async () => {
    // Perform bodyweight checks
    if (exercise.is_bodyweight) {
      const latestMetric = await db.bodyMetrics.orderBy('date').reverse().first();
      const settings = await db.settings.get('singleton');
      const hasBw = !!latestMetric || (settings && !!settings.default_bodyweight_kg);
      
      if (!hasBw && bodyweight === 70) {
        setShowBodyweightModal(true);
        return;
      }
    }

    const nextSetNumber = (sets?.length ?? 0) + 1;
    const actualReps = exercise.measurement_type === 'reps' ? (parseInt(repsInput) || 10) : undefined;
    const actualWeight = (!exercise.is_bodyweight && exercise.measurement_type === 'reps') ? (parseFloat(weightInput) || 0) : undefined;
    const actualAddedWeight = (exercise.is_bodyweight && exercise.measurement_type === 'reps') ? (parseFloat(addedWeightInput) || 0) : undefined;

    let actualTimeSeconds: number | undefined;
    if (exercise.measurement_type === 'time') {
      const parsedTime = parseInt(timeInput);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        actualTimeSeconds = parsedTime;
      } else if (setTimer.seconds > 0) {
        if (workoutTimerMode === 'stopwatch') {
          actualTimeSeconds = setTimer.seconds;
        } else {
          const target = targetTimeSeconds ?? 60;
          actualTimeSeconds = Math.max(1, target - setTimer.seconds);
        }
      } else {
        actualTimeSeconds = targetTimeSeconds ?? 60;
      }
    }

    const data = {
      session_exercise_id: sessionExercise.id,
      set_number: nextSetNumber,
      actual_reps: actualReps,
      actual_weight: actualWeight,
      actual_added_weight: actualAddedWeight,
      actual_time_seconds: actualTimeSeconds,
      is_bodyweight: exercise.is_bodyweight,
      rest_duration_seconds: defaultRestSecs
    };

    try {
      const setId = await addSetToExercise(data);
      HAPTIC.tap();

      // Check for PR
      const newSetObj: SetEntry = {
        id: setId,
        session_exercise_id: sessionExercise.id,
        set_number: nextSetNumber,
        actual_reps: actualReps,
        actual_weight: actualWeight,
        actual_added_weight: actualAddedWeight,
        actual_time_seconds: actualTimeSeconds,
        bodyweight_at_time: exercise.is_bodyweight ? bodyweight : undefined,
        completed: true,
        completed_at: new Date().toISOString()
      };

      const isPR = await checkPR(exercise.id, newSetObj);
      if (isPR) {
        setNewPRToast('Kỷ lục cá nhân mới! 🎉');
        setTimeout(() => setNewPRToast(null), 3000);
      }

      // Reset local time timer if time-based
      if (exercise.measurement_type === 'time') {
        setTimer.reset();
      }

      // Open Rest Timer
      setShowRestTimer(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Complete exercise
  const handleCompleteExercise = async () => {
    const loggedCount = sets?.length ?? 0;
    if (loggedCount < targetSetsCount && !showWarningModal) {
      setShowWarningModal(true);
      return;
    }

    try {
      await markExerciseCompleted(sessionExercise.id, true);
      HAPTIC.success();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  // Format MM:SS for stopwatch
  const formatStopwatch = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Rest Timer Overlay */}
      {showRestTimer && (
        <RestTimer 
          duration={defaultRestSecs} 
          onClose={() => setShowRestTimer(false)} 
        />
      )}

      {/* PR Toast */}
      {newPRToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold py-2.5 px-5 rounded-2xl shadow-lg border border-yellow-300 flex items-center gap-2 animate-bounce text-xs">
          <Sparkles className="w-4 h-4 fill-white" />
          <span>{newPRToast}</span>
        </div>
      )}

      {/* Bodyweight Prompt Modal */}
      {showBodyweightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl border dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white text-base mb-2 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary-500" />
              <span>Nhập cân nặng của bạn</span>
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
              Bài tập bodyweight cần chỉ số cân nặng của bạn để snapshot tổng tải trọng thực tế (Total Load).
            </p>
            <div className="mb-4">
              <input
                type="number"
                value={bodyweightInput}
                onChange={(e) => setBodyweightInput(e.target.value)}
                placeholder="Ví dụ: 70"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white text-center font-bold text-lg"
              />
              <span className="block text-[10px] text-center text-slate-450 mt-1">Đơn vị: Kilograms (kg)</span>
            </div>
            <button
              onClick={handleSaveBodyweight}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs transition-colors"
            >
              Lưu & Tiếp tục
            </button>
          </div>
        </div>
      )}

      {/* Warning Incomplete Sets Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl border dark:border-slate-700">
            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-3">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
              <span className="text-base font-bold">Chưa đạt mục tiêu</span>
            </div>
            <p className="text-slate-600 dark:text-slate-350 text-xs mb-6 leading-relaxed">
              Bạn mới hoàn thành **{sets?.length ?? 0}** trên tổng số **{targetSetsCount}** set mục tiêu. Bạn có chắc chắn muốn bỏ qua các set còn lại và hoàn thành bài tập này không?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarningModal(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
              >
                Tập tiếp
              </button>
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  markExerciseCompleted(sessionExercise.id, true).then(() => {
                    HAPTIC.success();
                    onClose();
                  });
                }}
                className="flex-1 py-2 px-4 rounded-xl bg-amber-550 hover:bg-amber-600 text-white font-bold shadow-md text-xs"
              >
                Xác nhận xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Viewport */}
      <div className="flex items-center gap-2 p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="p-2 text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-slate-850 dark:text-white truncate">
            {exercise.name}
          </h1>
          <p className="text-[10px] text-slate-400 truncate">
            {exercise.name_vi ? `${exercise.name_vi} • ` : ''}Target: {targetSetsCount} set ×{' '}
            {exercise.measurement_type === 'reps' 
              ? `${targetReps ?? 10} reps` 
              : `${targetTimeSeconds ?? 60}s`
            }
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Target Indicator Card */}
        <div className="bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-slate-900 dark:to-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider font-bold">Mục tiêu hôm nay</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
              {targetSetsCount} sets ×{' '}
              {exercise.measurement_type === 'reps' 
                ? `${targetReps ?? 10} reps` 
                : `${targetTimeSeconds ?? 60}s`
              }
              {exercise.measurement_type === 'reps' && (
                exercise.is_bodyweight
                  ? ` @ +${targetAddedWeight ?? 0}kg`
                  : ` @ ${targetWeight ?? 20}kg`
              )}
            </span>
          </div>

          <div className="text-right">
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider font-bold">Đã tập</span>
            <span className="font-black text-primary-600 dark:text-primary-400 text-base">
              {sets?.length ?? 0} / {targetSetsCount} sets
            </span>
          </div>
        </div>

        {/* Logged Sets List */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-xs px-1">
            Nhật ký sets đã làm
          </h3>

          {sets && sets.length > 0 ? (
            <div className="space-y-1.5">
              {sets.map((set, idx) => (
                <div 
                  key={set.id}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-slate-350 dark:text-slate-650 w-5">
                      #{idx + 1}
                    </span>
                    <span className="font-extrabold text-slate-750 dark:text-slate-200">
                      {exercise.measurement_type === 'reps'
                        ? `${set.actual_reps} reps`
                        : `${set.actual_time_seconds} giây`
                      }
                      {exercise.measurement_type === 'reps' && (
                        exercise.is_bodyweight
                          ? ` @ +${set.actual_added_weight ?? 0}kg (TL: ${(set.bodyweight_at_time ?? 70) + (set.actual_added_weight ?? 0)}kg)`
                          : ` @ ${set.actual_weight ?? 0}kg`
                      )}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm('Bạn có muốn xóa set này không?')) {
                        deleteSet(set.id);
                      }
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-slate-400 italic text-[11px] border border-dashed rounded-2xl">
              Chưa ghi nhận set nào.
            </p>
          )}
        </div>

        {/* Active Set Entry Logging Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
            <h4 className="font-black text-xs text-slate-850 dark:text-white flex items-center gap-1.5">
              <Dumbbell className="w-4 h-4 text-primary-500" />
              <span>Ghi nhận Set #{(sets?.length ?? 0) + 1}</span>
            </h4>
            {suggestedSet && (
              <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Gợi ý tạ cũ: {exercise.measurement_type === 'reps' 
                  ? exercise.is_bodyweight 
                    ? `+${suggestedSet.actual_added_weight}kg` 
                    : `${suggestedSet.actual_weight}kg`
                  : `${suggestedSet.actual_time_seconds}s`}
              </span>
            )}
          </div>

          {/* Time-Based Set Stopwatch */}
          {exercise.measurement_type === 'time' && (
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-850 flex flex-col items-center justify-center space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-primary-500" />
                <span className="font-mono font-black text-xl text-slate-800 dark:text-slate-200">
                  {formatStopwatch(setTimer.seconds)}
                </span>
              </div>
              <div className="flex gap-2">
                {setTimer.state === 'running' ? (
                  <button
                    onClick={() => {
                      setTimer.pause();
                      setTimeInput(setTimer.seconds.toString());
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg shadow-sm"
                  >
                    Tạm dừng
                  </button>
                ) : (
                  <button
                    onClick={setTimer.start}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg shadow-sm"
                  >
                    {setTimer.state === 'paused' ? 'Tiếp tục' : 'Bắt đầu bấm giờ'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setTimer.reset();
                    setTimeInput('');
                  }}
                  className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-350 text-[10px] font-bold rounded-lg"
                >
                  Đặt lại
                </button>
              </div>
            </div>
          )}

          {/* Input Grid */}
          <div className="grid grid-cols-2 gap-3">
            {exercise.measurement_type === 'reps' ? (
              <>
                {/* Reps Input */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">Reps</label>
                  <input
                    type="number"
                    value={repsInput}
                    onChange={(e) => setRepsInput(e.target.value)}
                    min={1}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-xl text-center font-black dark:text-white"
                  />
                </div>

                {/* Weight Input */}
                {exercise.is_bodyweight ? (
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Tạ thêm (+kg)</label>
                    <input
                      type="number"
                      value={addedWeightInput}
                      onChange={(e) => setAddedWeightInput(e.target.value)}
                      min={0}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-xl text-center font-black dark:text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Tạ (kg)</label>
                    <input
                      type="number"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      min={0}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-xl text-center font-black dark:text-white"
                    />
                  </div>
                )}
              </>
            ) : (
              /* Time Input */
              <div className="col-span-2">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">Thời gian (giây)</label>
                <input
                  type="number"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  min={1}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-xl text-center font-black dark:text-white text-base"
                  placeholder="Nhập thủ công hoặc sử dụng bấm giờ ở trên"
                />
              </div>
            )}
          </div>

          {/* Log button */}
          <button
            onClick={handleAddSet}
            className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-750 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Hoàn thành Set #{(sets?.length ?? 0) + 1}</span>
          </button>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 dark:bg-slate-900/95 border-t dark:border-slate-800 shadow-lg">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl text-xs"
          >
            Quay lại danh sách
          </button>
          
          <button
            onClick={handleCompleteExercise}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-650 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Hoàn thành bài</span>
          </button>
        </div>
      </div>
    </div>
  );
}
