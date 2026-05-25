import { useState, useEffect } from 'react';
import { BarChart3, Award, Scale, Clock, AlertCircle, Dumbbell } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { calcSetLoad, calcEpley1RM } from '../../utils/volume';
import type { Exercise, SetEntry } from '../../db/types';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';

export default function StatsPage() {
  // Live queries
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const sessions = useLiveQuery(() => db.sessions.filter(s => !!s.ended_at).toArray(), [], []);
  const sessionExercises = useLiveQuery(() => db.sessionExercises.toArray(), [], []);
  const sets = useLiveQuery(() => db.sets.filter(s => s.completed).toArray(), [], []);
  const bodyMetrics = useLiveQuery(() => db.bodyMetrics.orderBy('date').toArray(), [], []);

  // Dropdown selector state for Chart 1
  const [selectedExerciseId, setSelectedExerciseId] = useState('');

  // Filter exercises that actually have logged sets
  const loggedExercises = exercises && sessionExercises && sets
    ? exercises.filter(ex => {
        const seIds = sessionExercises.filter(se => se.exercise_id === ex.id).map(se => se.id);
        return sets.some(s => seIds.includes(s.session_exercise_id));
      })
    : [];

  // Set default exercise in dropdown once loaded
  useEffect(() => {
    if (loggedExercises.length > 0 && !selectedExerciseId) {
      setSelectedExerciseId(loggedExercises[0].id);
    }
  }, [loggedExercises, selectedExerciseId]);

  // ============================================
  // CHART 1: MAX WEIGHT & 1RM OVER TIME
  // ============================================
  const chart1Data = (() => {
    if (!selectedExerciseId || !sessions || !sessionExercises || !sets || !exercises) return [];

    const exercise = exercises.find(ex => ex.id === selectedExerciseId);
    if (!exercise) return [];

    // Find all session exercises for this exercise
    const relevantSEs = sessionExercises.filter(se => se.exercise_id === selectedExerciseId);
    const seMap = new Map(relevantSEs.map(se => [se.id, se.session_id]));

    // Find all sets for these session exercises
    const relevantSets = sets.filter(s => seMap.has(s.session_exercise_id));

    // Group sets by session
    const sessionSetsMap = new Map<string, SetEntry[]>();
    for (const set of relevantSets) {
      const sessionId = seMap.get(set.session_exercise_id);
      if (sessionId) {
        if (!sessionSetsMap.has(sessionId)) {
          sessionSetsMap.set(sessionId, []);
        }
        sessionSetsMap.get(sessionId)!.push(set);
      }
    }

    // Map sessions to max load and estimated 1RM
    const dataPoints = sessions
      .map(sess => {
        const sessionSets = sessionSetsMap.get(sess.id);
        if (!sessionSets || sessionSets.length === 0) return null;

        // Calculate max load and max 1RM in this session
        let maxLoad = 0;
        let max1RM = 0;

        for (const s of sessionSets) {
          const load = calcSetLoad(s, exercise);
          if (load > maxLoad) {
            maxLoad = load;
          }

          // Calculate Epley 1RM if reps <= 12
          const reps = s.actual_reps ?? 0;
          if (reps > 0) {
            const oneRepMax = reps <= 12 ? calcEpley1RM(load, reps) : load;
            if (oneRepMax > max1RM) {
              max1RM = oneRepMax;
            }
          }
        }

        return {
          date: sess.date,
          rawDate: new Date(sess.date),
          'Max Weight': Math.round(maxLoad * 10) / 10,
          'Est. 1RM (Epley)': Math.round(max1RM * 10) / 10,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime()); // chronological

    return dataPoints;
  })();

  // ============================================
  // CHART 2: VOLUME BY CYCLE ITERATION BY MUSCLE GROUP
  // ============================================
  const chart2Data = (() => {
    if (!sessions || !sessionExercises || !sets || !exercises) return [];

    // Map session_exercise_id to exercise
    const seToExMap = new Map<string, Exercise>();
    for (const se of sessionExercises) {
      const ex = exercises.find(e => e.id === se.exercise_id);
      if (ex) seToExMap.set(se.id, ex);
    }

    // Sort completed sessions chronologically
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // We can group sessions by "Vòng tập" iterations
    // Since cycle length is dynamic, we can group every 6 sessions as one iteration or group by weeks.
    // Let's group by 6 completed sessions to represent an iteration, or group by week.
    // Grouping by calendar week is extremely robust and provides a clear breakdown.
    const iterationVolumeMap = new Map<string, { [key: string]: number }>();

    sortedSessions.forEach((sess, idx) => {
      // Create iteration label: Iteration 1 (Sessions 1-6), Iteration 2 (Sessions 7-12)...
      const iterationIndex = Math.floor(idx / 6) + 1;
      const label = `Vòng ${iterationIndex}`;

      if (!iterationVolumeMap.has(label)) {
        iterationVolumeMap.set(label, {
          chest: 0,
          back: 0,
          legs: 0,
          shoulders: 0,
          arms: 0,
          core: 0,
          cardio: 0,
          full_body: 0,
        });
      }

      const volumeData = iterationVolumeMap.get(label)!;

      // Find all session exercises for this session
      const sessExs = sessionExercises.filter(se => se.session_id === sess.id);
      const sessExIds = sessExs.map(se => se.id);

      // Find sets for these session exercises
      const sessSets = sets.filter(s => sessExIds.includes(s.session_exercise_id));

      for (const s of sessSets) {
        const ex = seToExMap.get(s.session_exercise_id);
        if (ex) {
          const reps = s.actual_reps ?? 0;
          const load = calcSetLoad(s, ex);
          const vol = load * reps;
          const muscle = ex.muscle_group;
          
          volumeData[muscle] = (volumeData[muscle] || 0) + vol;
        }
      }
    });

    return Array.from(iterationVolumeMap.entries()).map(([label, volume]) => ({
      name: label,
      'Ngực': Math.round(volume.chest),
      'Lưng': Math.round(volume.back),
      'Đùi/Chân': Math.round(volume.legs),
      'Vai': Math.round(volume.shoulders),
      'Tay': Math.round(volume.arms),
      'Bụng': Math.round(volume.core),
      'Cardio': Math.round(volume.cardio),
      'Toàn thân': Math.round(volume.full_body),
    }));
  })();

  // ============================================
  // CHART 3: BODYWEIGHT OVER TIME
  // ============================================
  const chart3Data = (() => {
    if (!bodyMetrics) return [];
    return bodyMetrics.map(m => ({
      date: m.date,
      'Cân nặng (kg)': m.weight_kg,
      'Mỡ cơ thể (%)': m.body_fat_percent || null,
    }));
  })();

  // ============================================
  // CHART 4: TOTAL WORKOUT DURATION BY WEEK
  // ============================================
  const chart4Data = (() => {
    if (!sessions) return [];

    // Helper to get week number (YYYY-Www)
    const getWeekLabel = (dateStr: string) => {
      const date = new Date(dateStr);
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${date.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    };

    const weeklyDurationMap = new Map<string, number>();

    sessions.forEach(sess => {
      const weekLabel = getWeekLabel(sess.date);
      const durationMins = (sess.total_duration_seconds ?? 0) / 60;
      weeklyDurationMap.set(
        weekLabel,
        (weeklyDurationMap.get(weekLabel) || 0) + durationMins
      );
    });

    return Array.from(weeklyDurationMap.entries())
      .map(([week, mins]) => ({
        week,
        'Thời gian (phút)': Math.round(mins),
      }))
      .sort((a, b) => a.week.localeCompare(b.week)); // chronological
  })();

  return (
    <div className="p-4 space-y-6 flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 mt-2">
        <BarChart3 className="w-6 h-6 text-primary-500" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Thống kê</h1>
      </div>

      {/* CHART 1: MAX WEIGHT & 1RM */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm flex items-center gap-1.5">
              <Award className="w-4.5 h-4.5 text-amber-500" />
              <span>Sức mạnh tối đa (Max Weight & 1RM)</span>
            </h3>
            <span className="text-[10px] text-slate-400 block mt-0.5">Tiến trình tạ và sức mạnh 1RM ước tính</span>
          </div>

          {loggedExercises.length > 0 && (
            <select
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="px-2.5 py-1.5 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none text-xs font-semibold text-slate-750 dark:text-slate-350"
            >
              {loggedExercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          )}
        </div>

        {chart1Data.length > 0 ? (
          <div className="w-full h-60 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart1Data} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" unit="kg" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Legend />
                <Line type="monotone" dataKey="Max Weight" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Est. 1RM (Epley)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartMessage />
        )}
      </div>

      {/* CHART 2: VOLUME BY ITERATION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm flex items-center gap-1.5">
            <Dumbbell className="w-4.5 h-4.5 text-primary-500" />
            <span>Khối lượng theo vòng tập (Volume)</span>
          </h3>
          <span className="text-[10px] text-slate-400 block mt-0.5">Tổng khối lượng (sets x reps x tạ) xếp chồng theo nhóm cơ</span>
        </div>

        {chart2Data.length > 0 ? (
          <div className="w-full h-60 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart2Data} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" unit="kg" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Legend />
                <Bar dataKey="Ngực" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Lưng" stackId="a" fill="#10b981" />
                <Bar dataKey="Đùi/Chân" stackId="a" fill="#ef4444" />
                <Bar dataKey="Vai" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Tay" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="Bụng" stackId="a" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartMessage />
        )}
      </div>

      {/* CHART 3: WEIGHT HISTORY */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm flex items-center gap-1.5">
            <Scale className="w-4.5 h-4.5 text-purple-500" />
            <span>Biến động Cân nặng & % Mỡ</span>
          </h3>
          <span className="text-[10px] text-slate-400 block mt-0.5">Biểu đồ chỉ số cân nặng cơ thể theo thời gian</span>
        </div>

        {chart3Data.length > 0 ? (
          <div className="w-full h-60 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart3Data} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Legend />
                <Line type="monotone" dataKey="Cân nặng (kg)" stroke="#8b5cf6" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Mỡ cơ thể (%)" stroke="#ec4899" strokeWidth={1.5} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartMessage />
        )}
      </div>

      {/* CHART 4: WEEKLY DURATION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm flex items-center gap-1.5">
            <Clock className="w-4.5 h-4.5 text-indigo-500" />
            <span>Tổng thời gian tập luyện hàng tuần</span>
          </h3>
          <span className="text-[10px] text-slate-400 block mt-0.5">Thời gian tập (phút) tích lũy theo từng tuần lịch</span>
        </div>

        {chart4Data.length > 0 ? (
          <div className="w-full h-60 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart4Data} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="week" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" unit="m" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Legend />
                <Bar dataKey="Thời gian (phút)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartMessage />
        )}
      </div>
    </div>
  );
}

function EmptyChartMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed dark:border-slate-850">
      <AlertCircle className="w-8 h-8 text-slate-400 mb-1.5 stroke-1 animate-pulse" />
      <p className="text-xs text-slate-400 italic">Chưa có dữ liệu, hãy tập ít nhất 1 buổi để xem biểu đồ.</p>
    </div>
  );
}
