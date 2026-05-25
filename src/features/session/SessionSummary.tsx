import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Award, Clock, Dumbbell, FileText, CheckCircle2, Save } from 'lucide-react';
import { db } from '../../db';
import { useSessionLive, useSessionExercisesLive, endSession, checkPR } from './api';
import type { SetEntry } from '../../db/types';

export default function SessionSummary() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Dexie React hooks
  const session = useSessionLive(id || '');
  const sessionExercises = useSessionExercisesLive(id || '');

  // States
  const [notes, setNotes] = useState('');
  const [totalVolume, setTotalVolume] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [prList, setPrList] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toastShow, setToastShow] = useState(false);

  // Freeze the session duration at the moment they enter the summary screen
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (session) {
      if (session.ended_at && session.total_duration_seconds) {
        setDuration(session.total_duration_seconds);
        setNotes(session.notes || '');
      } else {
        const start = new Date(session.started_at).getTime();
        setDuration(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      }
    }
  }, [session]);

  // Calculate volume, completed exercises, and PRs
  useEffect(() => {
    if (sessionExercises && sessionExercises.length > 0) {
      // Completed exercises
      setCompletedCount(sessionExercises.filter(se => se.completed).length);

      // Volume & PR calculations
      const calculateStats = async () => {
        let vol = 0;
        const prs: string[] = [];

        for (const se of sessionExercises) {
          const sets = await db.sets.where('session_exercise_id').equals(se.id).toArray();
          
          let maxLoad = 0;
          let prSet: SetEntry | null = null;

          for (const s of sets) {
            if (s.completed) {
              // Calculate volume
              const reps = s.actual_reps ?? 0;
              let load = 0;
              if (se.exercise.is_bodyweight) {
                load = (s.bodyweight_at_time ?? 70) + (s.actual_added_weight ?? 0);
              } else {
                load = s.actual_weight ?? 0;
              }
              vol += load * reps;

              // Check for PR
              const isPr = await checkPR(se.exercise.id, s);
              if (isPr) {
                if (load > maxLoad) {
                  maxLoad = load;
                  prSet = s;
                }
              }
            }
          }

          if (prSet) {
            if (se.exercise.measurement_type === 'time') {
              prs.push(`${se.exercise.name}: Kỷ lục ${prSet.actual_time_seconds}s`);
            } else if (se.exercise.is_bodyweight) {
              prs.push(`${se.exercise.name}: Kỷ lục +${prSet.actual_added_weight}kg`);
            } else {
              prs.push(`${se.exercise.name}: Kỷ lục ${prSet.actual_weight}kg`);
            }
          }
        }

        setTotalVolume(vol);
        setPrList(prs);
      };

      calculateStats();
    }
  }, [sessionExercises]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Save workout
  const handleSaveWorkout = async () => {
    setIsSaving(true);
    try {
      // endSession updates ended_at & duration inside database
      await endSession(session.id, notes);
      setToastShow(true);
      setTimeout(() => {
        setToastShow(false);
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  // Format MM:SS or HH:MM:SS
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

  return (
    <div className="p-4 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 animate-fade-in">
      {/* Toast Notification */}
      {toastShow && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-medium">
          <CheckCircle2 className="w-5 h-5" />
          <span>Lưu buổi tập thành công!</span>
        </div>
      )}

      {/* Header Summary */}
      <div className="text-center max-w-sm mx-auto space-y-3 mt-4 mb-6">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full inline-block shadow-inner">
          <Award className="w-12 h-12 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black text-slate-850 dark:text-white leading-none">
          Buổi tập hoàn thành!
        </h1>
        <p className="text-slate-400 text-xs font-semibold">
          Tuyệt vời! Bạn đã hoàn thành xuất sắc ngày tập luyện.
        </p>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Duration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-550 dark:text-indigo-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Thời gian</span>
            <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Exercises count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-550 dark:text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Bài đã tập</span>
            <span className="font-black text-slate-800 dark:text-slate-200 text-sm">
              {completedCount} / {sessionExercises.length}
            </span>
          </div>
        </div>

        {/* Total Volume */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center gap-3 col-span-2">
          <div className="p-2 bg-primary-50 dark:bg-primary-950/50 text-primary-550 dark:text-primary-400 rounded-lg">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Tổng Volume buổi tập</span>
            <span className="font-black text-slate-800 dark:text-slate-200 text-sm">
              {totalVolume.toLocaleString()} kg
            </span>
          </div>
        </div>
      </div>

      {/* New PRs Section */}
      {prList.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl shadow-inner mb-5">
          <h4 className="font-extrabold text-xs text-amber-650 dark:text-amber-400 mb-2 flex items-center gap-1.5">
            <Award className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>Kỷ lục cá nhân mới (Personal Records):</span>
          </h4>
          <ul className="text-xs text-slate-650 dark:text-slate-350 space-y-1 pl-4 list-disc font-semibold">
            {prList.map((pr, idx) => (
              <li key={idx} className="leading-relaxed">
                {pr}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes Textarea */}
      <div className="space-y-1.5 mb-6">
        <label className="text-xs font-bold text-slate-750 dark:text-slate-200 px-1 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-slate-450" />
          <span>Ghi chú cho buổi tập:</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cảm giác của bạn hôm nay thế nào? (Vd: Khỏe, cơ bắp căng cứng tốt, mệt ở bài cuối...)"
          rows={3}
          className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs dark:text-white"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveWorkout}
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-primary-650 to-indigo-650 hover:from-primary-750 hover:to-indigo-750 text-white font-black py-3.5 rounded-2xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        <span>Lưu buổi tập</span>
      </button>
    </div>
  );
}
