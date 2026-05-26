import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Dumbbell, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
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

  const [roundInputs, setRoundInputs] = useState<{
    [seId: string]: {
      reps: string;
      weight: string;
      addedWeight: string;
      time: string;
    };
  }>({});

  // active state
  const [currentRound, setCurrentRound] = useState(1);
  const [targetRoundsCount, setTargetRoundsCount] = useState(3);

  // Workout timer mode state
  const [workoutTimerMode, setWorkoutTimerMode] = useState<'stopwatch' | 'countdown'>('stopwatch');

  // Rest Timer overlay state
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [defaultRestSecs, setDefaultRestSecs] = useState(90);

  // Warning states
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [newPRToast, setNewPRToast] = useState<string | null>(null);

  // Time-based set timer hook
  const setTimer = useTimer({
    mode: workoutTimerMode,
    initialSeconds: 60,
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

  // Reset inputs on round change to trigger re-load of suggestions
  useEffect(() => {
    setRoundInputs({});
  }, [currentRound]);

  // Load suggestions for each exercise in the current round
  useEffect(() => {
    if (!sets) return;

    const loadSuggestions = async () => {
      const newInputs = { ...roundInputs };
      let changed = false;

      for (const se of sessionExercises) {
        if (newInputs[se.id]) continue;

        changed = true;
        const activeEx = se.exercise;
        const activeExTargets = exercisesTargets[activeEx.id];
        const activeExSets = sets.filter(s => s.session_exercise_id === se.id);
        const prevRoundSet = activeExSets.find(s => s.round_number === currentRound - 1) 
          || activeExSets[activeExSets.length - 1];

        let reps = '10';
        let weight = '20';
        let addedWeight = '0';
        let time = '60';

        if (prevRoundSet) {
          if (prevRoundSet.actual_reps !== undefined) reps = prevRoundSet.actual_reps.toString();
          if (prevRoundSet.actual_weight !== undefined) weight = prevRoundSet.actual_weight.toString();
          if (prevRoundSet.actual_added_weight !== undefined) addedWeight = prevRoundSet.actual_added_weight.toString();
          if (prevRoundSet.actual_time_seconds !== undefined) time = prevRoundSet.actual_time_seconds.toString();
        } else {
          const lastSet = await getLastSetForExercise(activeEx.id);
          if (lastSet) {
            if (lastSet.actual_reps !== undefined) reps = lastSet.actual_reps.toString();
            if (lastSet.actual_weight !== undefined) weight = lastSet.actual_weight.toString();
            if (lastSet.actual_added_weight !== undefined) addedWeight = lastSet.actual_added_weight.toString();
            if (lastSet.actual_time_seconds !== undefined) time = lastSet.actual_time_seconds.toString();
          } else if (activeExTargets) {
            if (activeExTargets.target_reps !== undefined) reps = activeExTargets.target_reps.toString();
            if (activeExTargets.target_weight !== undefined) weight = activeExTargets.target_weight.toString();
            if (activeExTargets.target_added_weight !== undefined) addedWeight = activeExTargets.target_added_weight.toString();
            if (activeExTargets.target_time_seconds !== undefined) time = activeExTargets.target_time_seconds.toString();
          }
        }

        newInputs[se.id] = { reps, weight, addedWeight, time };
      }

      if (changed) {
        setRoundInputs(newInputs);
      }
    };

    loadSuggestions();
  }, [sessionExercises, currentRound, exercisesTargets, sets]);

  // Automatically determine what round we are on based on completed sets in current session
  useEffect(() => {
    if (sets && sets.length > 0) {
      const maxLoggedRound = Math.max(...sets.map(s => s.round_number || 0));
      if (maxLoggedRound > 0) {
        const setsInMaxRound = sets.filter(s => s.round_number === maxLoggedRound);
        if (setsInMaxRound.length >= sessionExercises.length) {
          setCurrentRound(maxLoggedRound + 1);
        } else {
          setCurrentRound(maxLoggedRound);
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

  const handleAddSetForExercise = async (se: SessionExercise & { exercise: Exercise }) => {
    const inputs = roundInputs[se.id];
    if (!inputs) return;

    const activeEx = se.exercise;
    
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

    const activeExSets = sets.filter(s => s.session_exercise_id === se.id);
    const nextSetNumber = activeExSets.length + 1;
    const actualReps = activeEx.measurement_type === 'reps' ? (parseInt(inputs.reps) || 10) : undefined;
    const actualWeight = (!activeEx.is_bodyweight && activeEx.measurement_type === 'reps') ? (parseFloat(inputs.weight) || 0) : undefined;
    const actualAddedWeight = (activeEx.is_bodyweight && activeEx.measurement_type === 'reps') ? (parseFloat(inputs.addedWeight) || 0) : undefined;

    let actualTimeSeconds: number | undefined;
    if (activeEx.measurement_type === 'time') {
      const parsedTime = parseInt(inputs.time);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        actualTimeSeconds = parsedTime;
      } else if (setTimer.seconds > 0) {
        if (workoutTimerMode === 'stopwatch') {
          actualTimeSeconds = setTimer.seconds;
        } else {
          const activeExTargets = exercisesTargets[activeEx.id];
          const target = activeExTargets?.target_time_seconds ?? 60;
          actualTimeSeconds = Math.max(1, target - setTimer.seconds);
        }
      } else {
        const activeExTargets = exercisesTargets[activeEx.id];
        actualTimeSeconds = activeExTargets?.target_time_seconds ?? 60;
      }
    }

    const data = {
      session_exercise_id: se.id,
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
        session_exercise_id: se.id,
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

      // Check if all exercises in the current round are completed
      const updatedSets = [...sets, newSetObj];
      const allDone = sessionExercises.every(ex => 
        updatedSets.some(s => s.session_exercise_id === ex.id && s.round_number === currentRound)
      );

      if (allDone) {
        setShowRestTimer(true);
      }
    } catch (err) {
      console.error(err);
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
                {sets.filter(s => s.round_number === currentRound).length}/{sessionExercises.length} bài
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
              type="button"
              onClick={() => setTargetRoundsCount(prev => prev + 1)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors"
            >
              + Round
            </button>
          </div>

          {/* Round exercises layout */}
          <div className="space-y-2 mt-2">
            {sessionExercises.map((se, idx) => {
              const setLogged = sets.find(s => s.session_exercise_id === se.id && s.round_number === currentRound);
              const inputs = roundInputs[se.id];

              return (
                <div 
                  key={se.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    setLogged
                      ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-150 dark:border-slate-800/80 opacity-70'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                        setLogged 
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                          : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-650'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className="min-w-0">
                        <h4 className={`text-xs font-bold truncate ${setLogged ? 'text-slate-400 line-through' : 'text-slate-850 dark:text-slate-150'}`}>
                          {se.exercise.name}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-semibold block">
                          Mục tiêu: {exercisesTargets[se.exercise_id]?.target_sets} sets ×{' '}
                          {se.exercise.measurement_type === 'reps'
                            ? `${exercisesTargets[se.exercise_id]?.target_reps ?? 10} reps`
                            : `${exercisesTargets[se.exercise_id]?.target_time_seconds ?? 60}s`
                          }
                          {se.exercise.measurement_type === 'reps' && (
                            se.exercise.is_bodyweight
                              ? ` @ Bodyweight`
                              : ` @ ${exercisesTargets[se.exercise_id]?.target_weight ?? 20}kg`
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[9px] font-extrabold">
                      {setLogged ? (
                        <div className="flex items-center gap-1">
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Bạn có muốn xóa set này không?')) {
                                deleteSet(setLogged.id);
                              }
                            }}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-150 dark:border-indigo-900/30">
                          Chưa ghi
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inline inputs for active round exercise if not logged */}
                  {!setLogged && inputs && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 items-end">
                      {se.exercise.measurement_type === 'reps' ? (
                        <>
                          <div>
                            <label className="block text-[9px] text-slate-450 font-bold mb-0.5">Reps</label>
                            <input
                              type="number"
                              value={inputs.reps}
                              onChange={(e) => {
                                const newInputs = { ...roundInputs };
                                newInputs[se.id] = { ...inputs, reps: e.target.value };
                                setRoundInputs(newInputs);
                              }}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-center font-bold text-xs dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-450 font-bold mb-0.5">
                              {se.exercise.is_bodyweight ? 'Tạ thêm (+kg)' : 'Tạ (kg)'}
                            </label>
                            <input
                              type="number"
                              value={se.exercise.is_bodyweight ? inputs.addedWeight : inputs.weight}
                              onChange={(e) => {
                                const newInputs = { ...roundInputs };
                                if (se.exercise.is_bodyweight) {
                                  newInputs[se.id] = { ...inputs, addedWeight: e.target.value };
                                } else {
                                  newInputs[se.id] = { ...inputs, weight: e.target.value };
                                }
                                setRoundInputs(newInputs);
                              }}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-center font-bold text-xs dark:text-white"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="block text-[9px] text-slate-455 font-bold">Thời gian (giây)</label>
                            <div className="flex gap-1 items-center">
                              <span className="font-mono text-[10px] font-black text-indigo-650 dark:text-indigo-400">
                                {Math.floor(setTimer.seconds / 60).toString().padStart(2, '0')}:{(setTimer.seconds % 60).toString().padStart(2, '0')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (setTimer.state === 'running') {
                                    setTimer.pause();
                                    const newInputs = { ...roundInputs };
                                    newInputs[se.id] = { ...inputs, time: setTimer.seconds.toString() };
                                    setRoundInputs(newInputs);
                                  } else {
                                    const targets = exercisesTargets[se.exercise_id];
                                    setTimer.reset(targets?.target_time_seconds || 60);
                                    setTimer.start();
                                  }
                                }}
                                className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded text-[9px] font-bold"
                              >
                                {setTimer.state === 'running' ? 'Pause' : 'Start'}
                              </button>
                            </div>
                          </div>
                          <input
                            type="number"
                            value={inputs.time}
                            onChange={(e) => {
                              const newInputs = { ...roundInputs };
                              newInputs[se.id] = { ...inputs, time: e.target.value };
                              setRoundInputs(newInputs);
                            }}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-center font-bold text-xs dark:text-white"
                          />
                        </div>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSetForExercise(se);
                        }}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ghi set</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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
