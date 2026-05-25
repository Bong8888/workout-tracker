import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, BookOpen, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  startSession, 
  useActiveSessionLive, 
  useSessionLive, 
  useSessionExercisesLive, 
  addSessionExercise
} from './api';
import { useExercises } from '../exercises/api';
import { db } from '../../db';
import type { SessionExercise, Exercise } from '../../db/types';
import { useWakeLock } from '../../hooks/useWakeLock';
import ExerciseSessionDetail from './ExerciseSessionDetail';

export default function SessionPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const cycleDayId = searchParams.get('cycleDayId') || undefined;

  // Dexie React hooks
  const activeSession = useActiveSessionLive();
  const session = useSessionLive(id || activeSession?.id || '');
  const sessionExercises = useSessionExercisesLive(session?.id || '');

  // Screen Wake Lock
  useWakeLock(!!session);

  // States
  const [isInitializing, setIsInitializing] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSessionEx, setActiveSessionEx] = useState<(SessionExercise & { exercise: Exercise }) | null>(null);
  
  // Exercise Picker Modal
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  
  const exercises = useExercises({
    search: searchQuery,
    muscle_group: selectedMuscle,
  });

  // Init session logic
  useEffect(() => {
    const init = async () => {
      // If we are at /session/new, trigger startSession
      if (!id && !activeSession) {
        try {
          const newId = await startSession(cycleDayId);
          navigate(`/session/${newId}`, { replace: true });
        } catch (err) {
          console.error('Failed to start session:', err);
        }
      }
      setIsInitializing(false);
    };
    init();
  }, [id, activeSession, cycleDayId, navigate]);

  // Master Timer - background drift-free stopwatch
  useEffect(() => {
    if (!session) return;

    const startedTime = new Date(session.started_at).getTime();

    const updateTimer = () => {
      const diffMs = Date.now() - startedTime;
      setElapsedSeconds(Math.max(0, Math.floor(diffMs / 1000)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500); // 500ms intervals to keep clock ticking smoothly

    return () => clearInterval(interval);
  }, [session]);

  // Format HH:MM:SS or MM:SS
  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Add exercise to session
  const handleAddExerciseToSession = async (exercise: Exercise) => {
    if (!session) return;
    try {
      await addSessionExercise(session.id, exercise.id);
      setShowAddExerciseModal(false);
      setSearchQuery('');
    } catch (err) {
      console.error(err);
    }
  };

  // End workout button handler
  const handleEndWorkout = () => {
    if (!session) return;

    // Check if any exercises are not completed
    const hasUncompleted = sessionExercises.some(se => !se.completed);
    if (hasUncompleted) {
      if (window.confirm('Buổi tập vẫn còn các bài chưa ghi nhận hoàn thành. Bạn có chắc chắn muốn kết thúc buổi tập này không?')) {
        navigate(`/session/${session.id}/summary`);
      }
    } else {
      navigate(`/session/${session.id}/summary`);
    }
  };

  if (isInitializing || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // If detailed logging is open for an exercise, render the full-screen view
  if (activeSessionEx) {
    // Find targets inside cycleDayExercises if linked
    return (
      <ExerciseSessionDetailWrapper 
        sessionExercise={activeSessionEx}
        cycleDayId={session.cycle_day_id}
        onClose={() => setActiveSessionEx(null)}
      />
    );
  }

  return (
    <div className="p-4 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {/* Exercise Picker Modal */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 w-full max-w-sm shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col h-[75vh]">
            <div className="flex items-center justify-between border-b pb-2.5 mb-3">
              <h3 className="font-bold text-slate-850 dark:text-white text-base">Thêm bài tập tự do</h3>
              <button 
                onClick={() => setShowAddExerciseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                Đóng
              </button>
            </div>

            {/* Modal search inputs */}
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bài tập..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs dark:text-white"
              />
              <select
                value={selectedMuscle}
                onChange={(e) => setSelectedMuscle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs dark:text-slate-200"
              >
                <option value="all">Tất cả nhóm cơ</option>
                <option value="chest">Ngực</option>
                <option value="back">Lưng</option>
                <option value="legs">Chân</option>
                <option value="shoulders">Vai</option>
                <option value="arms">Tay</option>
                <option value="core">Bụng</option>
                <option value="cardio">Tim mạch</option>
                <option value="full_body">Toàn thân</option>
              </select>
            </div>

            {/* Exercises List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
              {exercises && exercises.length > 0 ? (
                exercises.map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => handleAddExerciseToSession(ex)}
                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs">{ex.name}</h4>
                      <span className="text-[10px] text-slate-400">{ex.muscle_group} • {ex.equipment}</span>
                    </div>
                    <span className="text-primary-600 font-bold text-sm">+</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-center text-slate-400 py-8">Không tìm thấy bài tập.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timer Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary-650 to-indigo-650 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden mb-6 mt-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-full animate-pulse">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/75">Thời gian buổi tập</span>
            <h1 className="font-mono font-black text-2xl tracking-tight mt-0.5">
              {formatDuration(elapsedSeconds)}
            </h1>
          </div>
        </div>

        <button
          onClick={handleEndWorkout}
          className="bg-red-550 hover:bg-red-650 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all active:scale-95 text-xs flex items-center gap-1.5"
        >
          <span>Kết thúc</span>
        </button>
      </div>

      {/* Exercises List Title */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="font-bold text-slate-750 dark:text-slate-200 text-sm">
          Bài tập buổi hôm nay
        </h3>
        <button
          onClick={() => setShowAddExerciseModal(true)}
          className="text-primary-650 dark:text-primary-400 text-xs font-bold flex items-center gap-1 hover:underline"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm bài tập</span>
        </button>
      </div>

      {/* Workout Exercises Checklist */}
      <div className="space-y-2.5 flex-1">
        {sessionExercises && sessionExercises.length > 0 ? (
          sessionExercises.map((se, idx) => (
            <ExerciseRow 
              key={se.id} 
              se={se} 
              index={idx}
              onClick={() => setActiveSessionEx(se)} 
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-3xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <BookOpen className="w-12 h-12 text-slate-350 dark:text-slate-750 stroke-1 mb-2" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Chưa có bài tập nào</h4>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1 mb-3">
              Buổi tập tự do chưa được gán lịch. Hãy thêm bài tập ngoài lịch để bắt đầu.
            </p>
            <button
              onClick={() => setShowAddExerciseModal(true)}
              className="bg-primary-600 hover:bg-primary-750 text-white font-bold py-2 px-5 rounded-xl shadow text-xs"
            >
              Thêm bài tập ngay
            </button>
          </div>
        )}
      </div>

      {/* Quick Pause or Cancel CTA in page */}
      <div className="mt-8 border-t dark:border-slate-800 pt-4 flex justify-between items-center">
        <button
          onClick={() => {
            if (window.confirm('Cảnh báo: Bạn muốn XÓA buổi tập này và hủy mọi set đã ghi? Thao tác không thể hoàn tác.')) {
              db.transaction('rw', [db.sessions, db.sessionExercises, db.sets], async () => {
                const sessionExs = await db.sessionExercises.where('session_id').equals(session.id).toArray();
                const sessionExIds = sessionExs.map(se => se.id);
                await db.sets.where('session_exercise_id').anyOf(sessionExIds).delete();
                await db.sessionExercises.where('session_id').equals(session.id).delete();
                await db.sessions.delete(session.id);
                navigate('/');
              });
            }
          }}
          className="text-xs font-semibold text-red-500 hover:underline flex items-center gap-1.5 mx-auto"
        >
          <Trash2Icon className="w-4 h-4" />
          <span>Hủy bỏ buổi tập</span>
        </button>
      </div>
    </div>
  );
}

// Exercise row subcomponent
function ExerciseRow({ 
  se, 
  index, 
  onClick 
}: { 
  se: SessionExercise & { exercise: Exercise }; 
  index: number; 
  onClick: () => void; 
}) {
  const sets = useLiveQuery(() => db.sets.where('session_exercise_id').equals(se.id).toArray(), [se.id], []);
  
  return (
    <div
      onClick={onClick}
      className={`
        p-4 bg-white dark:bg-slate-900 border rounded-2xl cursor-pointer shadow-sm hover:shadow transition-all duration-200 flex items-center justify-between
        ${se.completed 
          ? 'border-emerald-250 dark:border-emerald-900/30 bg-emerald-50/5 dark:bg-emerald-950/5' 
          : 'border-slate-150 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'
        }
      `}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center ${
          se.completed 
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
        }`}>
          {index + 1}
        </div>

        <div className="min-w-0">
          <h4 className={`font-bold text-xs truncate ${
            se.completed ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-150'
          }`}>
            {se.exercise.name}
          </h4>
          <span className="text-[10px] text-slate-400 block truncate">
            {sets ? `${sets.length} sets completed` : '0 sets logged'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {se.completed ? (
          <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-250 dark:border-emerald-900/30 flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3 fill-emerald-500 text-white" />
            <span>Xong</span>
          </span>
        ) : (
          <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/30 flex items-center">
            <span>Tập</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}

// Wrapper to query targeted guidelines inside cycle days
function ExerciseSessionDetailWrapper({
  sessionExercise,
  cycleDayId,
  onClose
}: {
  sessionExercise: SessionExercise & { exercise: Exercise };
  cycleDayId?: string;
  onClose: () => void;
}) {
  const [targets, setTargets] = useState<{
    target_sets: number;
    target_reps?: number;
    target_weight?: number;
    target_added_weight?: number;
    target_time_seconds?: number;
  }>({ target_sets: 3 });

  useEffect(() => {
    if (cycleDayId) {
      db.cycleDayExercises
        .where('cycle_day_id')
        .equals(cycleDayId)
        .filter(cde => cde.exercise_id === sessionExercise.exercise_id)
        .first()
        .then(cde => {
          if (cde) {
            setTargets({
              target_sets: cde.target_sets,
              target_reps: cde.target_reps,
              target_weight: cde.target_weight,
              target_added_weight: cde.target_added_weight,
              target_time_seconds: cde.target_time_seconds,
            });
          }
        });
    }
  }, [cycleDayId, sessionExercise]);

  return (
    <ExerciseSessionDetail 
      sessionExercise={sessionExercise}
      onClose={onClose}
      targetSetsCount={targets.target_sets}
      targetReps={targets.target_reps}
      targetWeight={targets.target_weight}
      targetAddedWeight={targets.target_added_weight}
      targetTimeSeconds={targets.target_time_seconds}
    />
  );
}

function Trash2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
