import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Dumbbell, Clock, AlertTriangle, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import type { SessionExercise, Exercise, SetEntry } from '../../db/types';
import { 
  addSetToExercise, 
  deleteSet, 
  getLastSetForExercise, 
  getCurrentBodyweight, 
  checkPR
} from './api';
import { db } from '../../db';
import { HAPTIC } from '../../hooks/useHaptic';
import RestTimer from './RestTimer';
import { useTimer } from '../../hooks/useTimer';
import { useLiveQuery } from 'dexie-react-hooks';

interface GroupSessionDetailProps {
  sessionExercises: Array<SessionExercise & { exercise: Exercise }>;
  cycleDayId?: string;
  onClose: () => void;
}

export default function GroupSessionDetail({
  sessionExercises,
  cycleDayId,
  onClose
}: GroupSessionDetailProps) {
  // Query all sets for the exercises in this group
  const sessionExerciseIds = sessionExercises.map(se => se.id);
  const sets = useLiveQuery(
    () => db.sets.where('session_exercise_id').anyOf(sessionExerciseIds).toArray(),
    [sessionExerciseIds],
    []
  );

  // States
  const [exercisesTargets, setExercisesTargets] = useState<{
    [exId: string]: {
      target_sets: number;
      target_reps?: number;
      target_weight?: number;
      target_added_weight?: number;
      target_time_seconds?: number;
    };
  }>({});

  const [bodyweight, setBodyweight] = useState(70);
  const [showBodyweightModal, setShowBodyweightModal] = useState(false);
  const [bodyweightInput, setBodyweightInput] = useState('70');

  // Input states for active exercise logging
  const [repsInput, setRepsInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [addedWeightInput, setAddedWeightInput] = useState('');
  const [timeInput, setTimeInput] = useState('');

  // active state
  const [currentRound, setCurrentRound] = useState(1);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [targetRoundsCount, setTargetRoundsCount] = useState(3);

  // Workout timer mode state
  const [workoutTimerMode, setWorkoutTimerMode] = useState<'stopwatch' | 'countdown'>('stopwatch');

  // Rest Timer overlay state
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [defaultRestSecs, setDefaultRestSecs] = useState(90);

  // Warning states
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [newPRToast, setNewPRToast] = useState<string | null>(null);

  const activeSE = sessionExercises[activeExerciseIndex];
  const activeEx = activeSE?.exercise;
  const activeExTargets = activeEx ? exercisesTargets[activeEx.id] : undefined;

  // Time-based set timer hook
  const setTimer = useTimer({
    mode: workoutTimerMode,
    initialSeconds: activeExTargets?.target_time_seconds || 60,
  });

  // Load targets & settings
  useEffect(() => {
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

    if (cycleDayId) {
      db.cycleDayExercises
        .where('cycle_day_id')
        .equals(cycleDayId)
        .filter(cde => sessionExercises.some(se => se.exercise_id === cde.exercise_id))
        .toArray()
        .then(cdes => {
          const targetsMap: typeof exercisesTargets = {};
          let maxSets = 3;
          cdes.forEach(cde => {
            targetsMap[cde.exercise_id] = {
              target_sets: cde.target_sets,
              target_reps: cde.target_reps,
              target_weight: cde.target_weight,
              target_added_weight: cde.target_added_weight,
              target_time_seconds: cde.target_time_seconds,
            };
            if (cde.target_sets > maxSets) {
              maxSets = cde.target_sets;
            }
          });
          setExercisesTargets(targetsMap);
          setTargetRoundsCount(maxSets);
        });
    } else {
      // Default fallback for free exercises
      const targetsMap: typeof exercisesTargets = {};
      sessionExercises.forEach(se => {
        targetsMap[se.exercise_id] = {
          target_sets: 3,
        };
      });
      setExercisesTargets(targetsMap);
      setTargetRoundsCount(3);
    }
  }, [cycleDayId, sessionExercises]);

  // Handle active exercise input suggestions
  useEffect(() => {
    if (!activeSE || !activeEx) return;

    // Check if there is already a logged set for this exercise in the current round
    const activeExSets = sets.filter(s => s.session_exercise_id === activeSE.id);
    const currentRoundSet = activeExSets.find(s => s.round_number === currentRound);
    const prevRoundSet = activeExSets.find(s => s.round_number === currentRound - 1) 
      || activeExSets[activeExSets.length - 1]; // fallback to last logged set in session

    if (currentRoundSet) {
      // If we are editing/viewing a set already logged in this round
      if (activeEx.measurement_type === 'reps') {
        setRepsInput((currentRoundSet.actual_reps ?? 10).toString());
        if (activeEx.is_bodyweight) {
          setAddedWeightInput((currentRoundSet.actual_added_weight ?? 0).toString());
        } else {
          setWeightInput((currentRoundSet.actual_weight ?? 20).toString());
        }
      } else {
        setTimeInput((currentRoundSet.actual_time_seconds ?? 60).toString());
      }
    } else if (prevRoundSet) {
      // Suggest from the last logged/previous round set
      if (activeEx.measurement_type === 'reps') {
        setRepsInput((prevRoundSet.actual_reps ?? 10).toString());
        if (activeEx.is_bodyweight) {
          setAddedWeightInput((prevRoundSet.actual_added_weight ?? 0).toString());
        } else {
          setWeightInput((prevRoundSet.actual_weight ?? 20).toString());
        }
      } else {
        setTimeInput((prevRoundSet.actual_time_seconds ?? 60).toString());
      }
    } else {
      // Suggest from previous workout session
      getLastSetForExercise(activeEx.id).then(lastSet => {
        if (lastSet) {
          if (activeEx.measurement_type === 'reps') {
            setRepsInput((lastSet.actual_reps ?? 10).toString());
            if (activeEx.is_bodyweight) {
              setAddedWeightInput((lastSet.actual_added_weight ?? 0).toString());
            } else {
              setWeightInput((lastSet.actual_weight ?? 20).toString());
            }
          } else {
            setTimeInput((lastSet.actual_time_seconds ?? 60).toString());
          }
        } else {
          // Suggest from target guidelines
          const tReps = activeExTargets?.target_reps ?? 10;
          const tWeight = activeExTargets?.target_weight ?? 20;
          const tAddedWeight = activeExTargets?.target_added_weight ?? 0;
          const tTime = activeExTargets?.target_time_seconds ?? 60;

          if (activeEx.measurement_type === 'reps') {
            setRepsInput(tReps.toString());
            if (activeEx.is_bodyweight) {
              setAddedWeightInput(tAddedWeight.toString());
            } else {
              setWeightInput(tWeight.toString());
            }
          } else {
            setTimeInput(tTime.toString());
          }
        }
      });
    }

    // Reset set timer for time-based exercise
    if (activeEx.measurement_type === 'time') {
      setTimer.reset(activeExTargets?.target_time_seconds || 60);
    }
  }, [activeExerciseIndex, currentRound, activeSE, activeEx, activeExTargets, sets]);

  // Adjust active exercise round when sets are logged
  // Automatically determine what round we are on based on completed sets in current session
  useEffect(() => {
    if (sets && sets.length > 0) {
      // Find the highest round number logged so far
      const maxLoggedRound = Math.max(...sets.map(s => s.round_number || 0));
      if (maxLoggedRound > 0) {
        // If all exercises in maxLoggedRound have been logged, set currentRound to maxLoggedRound + 1
        const setsInMaxRound = sets.filter(s => s.round_number === maxLoggedRound);
        if (setsInMaxRound.length >= sessionExercises.length) {
          setCurrentRound(maxLoggedRound + 1);
          setActiveExerciseIndex(0);
        } else {
          // We are still in maxLoggedRound, find the first exercise in this round that doesn't have a set
          setCurrentRound(maxLoggedRound);
          const firstUnloggedIdx = sessionExercises.findIndex(se => 
            !sets.some(s => s.session_exercise_id === se.id && s.round_number === maxLoggedRound)
          );
          if (firstUnloggedIdx !== -1) {
            setActiveExerciseIndex(firstUnloggedIdx);
          }
        }
      }
    }
  }, [sets, sessionExercises.length]);

  const handleSaveBodyweight = async () => {
    const val = parseFloat(bodyweightInput);
    if (isNaN(val) || val <= 0) return;

    await db.bodyMetrics.add({
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      weight_kg: val,
      notes: 'Ghi nhận tự động từ buổi tập nhóm',
    });

    setBodyweight(val);
    setShowBodyweightModal(false);
  };

  const handleAddSet = async () => {
    if (!activeSE || !activeEx) return;

    // Bodyweight check
    if (activeEx.is_bodyweight) {
      const latestMetric = await db.bodyMetrics.orderBy('date').reverse().first();
      const settings = await db.settings.get('singleton');
      const hasBw = !!latestMetric || (settings && !!settings.default_bodyweight_kg);
      
      if (!hasBw && bodyweight === 70) {
        setShowBodyweightModal(true);
        return;
      }
    }

    const activeExSets = sets.filter(s => s.session_exercise_id === activeSE.id);
    const nextSetNumber = activeExSets.length + 1;
    const actualReps = activeEx.measurement_type === 'reps' ? (parseInt(repsInput) || 10) : undefined;
    const actualWeight = (!activeEx.is_bodyweight && activeEx.measurement_type === 'reps') ? (parseFloat(weightInput) || 0) : undefined;
    const actualAddedWeight = (activeEx.is_bodyweight && activeEx.measurement_type === 'reps') ? (parseFloat(addedWeightInput) || 0) : undefined;

    let actualTimeSeconds: number | undefined;
    if (activeEx.measurement_type === 'time') {
      const parsedTime = parseInt(timeInput);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        actualTimeSeconds = parsedTime;
      } else if (setTimer.seconds > 0) {
        if (workoutTimerMode === 'stopwatch') {
          actualTimeSeconds = setTimer.seconds;
        } else {
          const target = activeExTargets?.target_time_seconds ?? 60;
          actualTimeSeconds = Math.max(1, target - setTimer.seconds);
        }
      } else {
        actualTimeSeconds = activeExTargets?.target_time_seconds ?? 60;
      }
    }

    const data = {
      session_exercise_id: activeSE.id,
      set_number: nextSetNumber,
      actual_reps: actualReps,
      actual_weight: actualWeight,
      actual_added_weight: actualAddedWeight,
      actual_time_seconds: actualTimeSeconds,
      is_bodyweight: activeEx.is_bodyweight,
      rest_duration_seconds: defaultRestSecs,
      round_number: currentRound
    };

    try {
      const setId = await addSetToExercise(data);
      HAPTIC.tap();

      // Check PR
      const newSetObj: SetEntry = {
        id: setId,
        session_exercise_id: activeSE.id,
        set_number: nextSetNumber,
        actual_reps: actualReps,
        actual_weight: actualWeight,
        actual_added_weight: actualAddedWeight,
        actual_time_seconds: actualTimeSeconds,
        bodyweight_at_time: activeEx.is_bodyweight ? bodyweight : undefined,
        completed: true,
        completed_at: new Date().toISOString(),
        round_number: currentRound
      };

      const isPR = await checkPR(activeEx.id, newSetObj);
      if (isPR) {
        setNewPRToast(`Kỷ lục mới cho bài ${activeEx.name}! 🎉`);
        setTimeout(() => setNewPRToast(null), 3000);
      }

      // Check if it is the last exercise in the round
      if (activeExerciseIndex === sessionExercises.length - 1) {
        // Round completed! Open rest timer
        setShowRestTimer(true);
        // Transition to next round (handled by the sets live-query effect, but we can also pre-emptively advance if wanted.
        // Actually, the useEffect on sets will automatically adjust currentRound and activeExerciseIndex when db updates!)
      } else {
        // Move to next exercise in the round
        setActiveExerciseIndex(activeExerciseIndex + 1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSkipExercise = () => {
    const confirmSkip = window.confirm(`Bạn có chắc chắn muốn bỏ qua bài tập "${activeEx.name}" trong Round ${currentRound} không?`);
    if (!confirmSkip) return;

    if (activeExerciseIndex === sessionExercises.length - 1) {
      // Last exercise of round, rest timer triggers and moves to next round
      setShowRestTimer(true);
      setCurrentRound(currentRound + 1);
      setActiveExerciseIndex(0);
    } else {
      setActiveExerciseIndex(activeExerciseIndex + 1);
    }
  };

  const handleCompleteGroup = async () => {
    // Check if targets are completed for all exercises
    let allCompleted = true;
    for (const se of sessionExercises) {
      const exerciseSetsCount = sets.filter(s => s.session_exercise_id === se.id).length;
      const targetSets = exercisesTargets[se.exercise_id]?.target_sets ?? 3;
      if (exerciseSetsCount < targetSets) {
        allCompleted = false;
        break;
      }
    }

    if (!allCompleted && !showWarningModal) {
      setShowWarningModal(true);
      return;
    }

    try {
      await db.transaction('rw', [db.sessionExercises], async () => {
        for (const se of sessionExercises) {
          await db.sessionExercises.update(se.id, { completed: true });
        }
      });
      HAPTIC.success();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  // Group sets by round for display
  const maxRoundsLogged = sets.length > 0 ? Math.max(...sets.map(s => s.round_number || 1)) : 0;
  const totalRoundsToDisplay = Math.max(targetRoundsCount, maxRoundsLogged);
  const roundsArray = Array.from({ length: totalRoundsToDisplay }, (_, i) => i + 1);

  // Group type name
  const groupType = sessionExercises[0]?.group_type || 'superset';
  const groupLabel = groupType === 'superset' ? 'Superset' : groupType === 'triset' ? 'Tri-set' : 'Circuit/Giant Set';

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
              Bài tập bodyweight cần chỉ số cân nặng của bạn để ghi nhận Total Load.
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

      {/* Warning Incomplete Round Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl border dark:border-slate-700">
            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-3">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
              <span className="text-base font-bold">Chưa hoàn thành mục tiêu</span>
            </div>
            <p className="text-slate-600 dark:text-slate-350 text-xs mb-6 leading-relaxed">
              Bạn vẫn chưa hoàn thành đủ số set mục tiêu cho tất cả các bài tập trong nhóm. Bạn có chắc chắn muốn bỏ qua và hoàn thành nhóm bài tập này không?
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
                  db.transaction('rw', [db.sessionExercises], async () => {
                    for (const se of sessionExercises) {
                      await db.sessionExercises.update(se.id, { completed: true });
                    }
                  }).then(() => {
                    HAPTIC.success();
                    onClose();
                  });
                }}
                className="flex-1 py-2 px-4 rounded-xl bg-amber-550 hover:bg-amber-600 text-white font-bold shadow-md text-xs"
              >
                Xác nhận hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Viewport */}
      <div className="flex items-center gap-2 p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-slate-850 dark:text-white truncate">
            {groupLabel} ({sessionExercises.length} bài)
          </h1>
          <p className="text-[10px] text-slate-400 truncate">
            {sessionExercises.map(se => se.exercise.name).join(' → ')}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Round Progress Tracker & Round Selector */}
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-slate-900 dark:to-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase tracking-wider font-bold">Round hiện tại</span>
              <span className="font-extrabold text-indigo-700 dark:text-indigo-400 text-sm">
                Round {currentRound} / {targetRoundsCount}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] block uppercase tracking-wider font-bold">Trạng thái vòng</span>
              <span className="font-semibold text-slate-750 dark:text-slate-200 text-xs">
                {activeExerciseIndex + 1}/{sessionExercises.length} bài
              </span>
            </div>
          </div>

          {/* Quick Round Navigation dots */}
          <div className="flex items-center gap-1.5 mt-1">
            {roundsArray.map(rNum => {
              const isCurrent = rNum === currentRound;
              const completedCountInRound = sets.filter(s => s.round_number === rNum).length;
              const isDone = completedCountInRound === sessionExercises.length;
              return (
                <button
                  key={rNum}
                  onClick={() => {
                    setCurrentRound(rNum);
                    // Find first unlogged exercise in that round, or default to 0
                    const unloggedIdx = sessionExercises.findIndex(se => 
                      !sets.some(s => s.session_exercise_id === se.id && s.round_number === rNum)
                    );
                    setActiveExerciseIndex(unloggedIdx === -1 ? 0 : unloggedIdx);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    isCurrent 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                      : isDone
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-250 dark:border-emerald-900/35'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Round {rNum}
                </button>
              );
            })}
            <button
              onClick={() => setTargetRoundsCount(prev => prev + 1)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
            >
              + Vòng
            </button>
          </div>

          {/* Round exercises layout */}
          <div className="space-y-1.5 mt-2">
            {sessionExercises.map((se, idx) => {
              const isCurrentEx = idx === activeExerciseIndex;
              const setLogged = sets.find(s => s.session_exercise_id === se.id && s.round_number === currentRound);

              return (
                <div 
                  key={se.id}
                  onClick={() => setActiveExerciseIndex(idx)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isCurrentEx
                      ? 'bg-white dark:bg-slate-850 border-indigo-400 dark:border-indigo-600 shadow-sm scale-[1.01]'
                      : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-150 dark:border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                      setLogged 
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                        : isCurrentEx
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${setLogged ? 'text-slate-400 line-through' : 'text-slate-850 dark:text-slate-150'}`}>
                        {se.exercise.name}
                      </h4>
                      {isCurrentEx && (
                        <span className="text-[9px] text-slate-400 font-semibold block">
                          Mục tiêu: {exercisesTargets[se.exercise_id]?.target_sets} sets ×{' '}
                          {se.exercise.measurement_type === 'reps'
                            ? `${exercisesTargets[se.exercise_id]?.target_reps ?? 10} reps`
                            : `${exercisesTargets[se.exercise_id]?.target_time_seconds ?? 60}s`
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] font-extrabold">
                    {setLogged ? (
                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/30 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 fill-emerald-500 text-white" />
                        <span>
                          {se.exercise.measurement_type === 'reps'
                            ? `${setLogged.actual_reps}r`
                            : `${setLogged.actual_time_seconds}s`
                          }
                          {se.exercise.measurement_type === 'reps' && (
                            se.exercise.is_bodyweight
                              ? ` @ +${setLogged.actual_added_weight}kg`
                              : ` @ ${setLogged.actual_weight}kg`
                          )}
                        </span>
                      </span>
                    ) : isCurrentEx ? (
                      <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-150 dark:border-indigo-900/30 flex items-center animate-pulse">
                        <span>Đang tập</span>
                        <ChevronRight className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold px-2 py-0.5">
                        Chờ
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Exercise Input Form Box */}
        {activeSE && activeEx && (
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
              <h4 className="font-black text-xs text-slate-850 dark:text-white flex items-center gap-1.5">
                <Dumbbell className="w-4 h-4 text-primary-500" />
                <span>Ghi nhận: {activeEx.name} (Round {currentRound})</span>
              </h4>
              <button
                onClick={handleSkipExercise}
                className="text-[10px] text-slate-400 hover:text-red-500 font-bold border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Bỏ qua
              </button>
            </div>

            {/* Time-Based Set Stopwatch */}
            {activeEx.measurement_type === 'time' && (
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-850 flex flex-col items-center justify-center space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4.5 h-4.5 text-primary-500" />
                  <span className="font-mono font-black text-xl text-slate-800 dark:text-slate-200">
                    {Math.floor(setTimer.seconds / 60).toString().padStart(2, '0')}:{(setTimer.seconds % 60).toString().padStart(2, '0')}
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

            {/* Input fields */}
            <div className="grid grid-cols-2 gap-3">
              {activeEx.measurement_type === 'reps' ? (
                <>
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

                  {activeEx.is_bodyweight ? (
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

            <button
              onClick={handleAddSet}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-750 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi nhận Set bài {activeExerciseIndex + 1} trong Round {currentRound}</span>
            </button>
          </div>
        )}

        {/* History of logged rounds list */}
        <div className="space-y-3.5 mt-2">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-xs px-1">
            Lịch sử các round đã ghi
          </h3>

          {roundsArray.map(rNum => {
            const roundSets = sets.filter(s => s.round_number === rNum);
            if (roundSets.length === 0) return null;

            return (
              <div 
                key={rNum}
                className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3 rounded-2xl shadow-sm space-y-2.5"
              >
                <div className="flex justify-between items-center border-b pb-1.5 dark:border-slate-800">
                  <span className="text-xs font-black text-slate-800 dark:text-white">
                    Round {rNum}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {roundSets.length}/{sessionExercises.length} bài đã tập
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {sessionExercises.map((se, idx) => {
                    const setObj = roundSets.find(s => s.session_exercise_id === se.id);
                    return (
                      <div key={se.id} className="flex items-center justify-between pl-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          <span className="font-semibold text-slate-650 dark:text-slate-350 truncate">
                            {se.exercise.name}:
                          </span>
                          {setObj ? (
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {se.exercise.measurement_type === 'reps'
                                ? `${setObj.actual_reps} reps`
                                : `${setObj.actual_time_seconds}s`
                              }
                              {se.exercise.measurement_type === 'reps' && (
                                se.exercise.is_bodyweight
                                  ? ` @ +${setObj.actual_added_weight}kg`
                                  : ` @ ${setObj.actual_weight}kg`
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-350 dark:text-slate-600 italic">Chưa ghi nhận</span>
                          )}
                        </div>

                        {setObj && (
                          <button
                            onClick={() => {
                              if (window.confirm('Bạn có muốn xóa set này không?')) {
                                deleteSet(setObj.id);
                              }
                            }}
                            className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-350 hover:text-red-500 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {sets.length === 0 && (
            <p className="text-center py-6 text-slate-400 italic text-[11px] border border-dashed rounded-2xl">
              Chưa ghi nhận round nào.
            </p>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 dark:bg-slate-900/95 border-t dark:border-slate-800 shadow-lg">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl text-xs"
          >
            Quay lại danh sách
          </button>
          
          <button
            onClick={handleCompleteGroup}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-650 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Hoàn thành nhóm bài</span>
          </button>
        </div>
      </div>
    </div>
  );
}
