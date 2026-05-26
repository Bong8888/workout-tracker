import { db } from '../../db';
import type { AppSettings } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';

// ============================================
// APP SETTINGS CRUD
// ============================================

export async function getSettings(): Promise<AppSettings> {
  let settings = await db.settings.get('singleton');
  if (!settings) {
    settings = {
      id: 'singleton',
      theme: 'system',
      default_rest_seconds: 90,
      default_workout_timer_mode: 'stopwatch',
      default_rest_timer_mode: 'countdown',
      default_bodyweight_kg: 70,
      haptic_enabled: true,
    };
    await db.settings.add(settings);
  }
  return settings;
}

export async function updateSettings(data: Partial<AppSettings>): Promise<void> {
  await db.settings.update('singleton', data);
}

export function useSettingsLive() {
  return useLiveQuery(() => getSettings(), [], undefined);
}

// ============================================
// DATA EXPORT / IMPORT
// ============================================

export async function exportAllData(): Promise<Blob> {
  const data = {
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      exercises: await db.exercises.toArray(),
      trainingCycles: await db.trainingCycles.toArray(),
      cycleDays: await db.cycleDays.toArray(),
      cycleDayExercises: await db.cycleDayExercises.toArray(),
      sessions: await db.sessions.toArray(),
      sessionExercises: await db.sessionExercises.toArray(),
      sets: await db.sets.toArray(),
      bodyMetrics: await db.bodyMetrics.toArray(),
      activityLogs: await db.activityLogs.toArray(),
      settings: await db.settings.toArray(),
    },
  };

  const json = JSON.stringify(data, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export async function downloadExport(): Promise<void> {
  const blob = await exportAllData();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `workout-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Update last backup timestamp
  await db.settings.update('singleton', {
    last_backup_at: new Date().toISOString(),
  });
}

export async function importData(
  file: File,
  options: { mode: 'replace' | 'merge' }
): Promise<{ success: boolean; counts: Record<string, number> }> {
  const text = await file.text();
  let parsed: any;

  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('File JSON không hợp lệ.');
  }

  if (parsed.version !== 1) {
    throw new Error('Phiên bản backup không tương thích.');
  }

  const data = parsed.data;
  const counts: Record<string, number> = {};

  await db.transaction('rw', db.tables, async () => {
    if (options.mode === 'replace') {
      // Clear all existing data in tables
      for (const table of db.tables) {
        await table.clear();
      }
    }

    // List of table names to restore
    const tableNames = [
      'exercises',
      'trainingCycles',
      'cycleDays',
      'cycleDayExercises',
      'sessions',
      'sessionExercises',
      'sets',
      'bodyMetrics',
      'activityLogs',
      'settings',
    ];

    for (const tableName of tableNames) {
      const records = data[tableName] || [];
      if (records.length > 0) {
        await (db as any)[tableName].bulkPut(records);
        counts[tableName] = records.length;
      } else {
        counts[tableName] = 0;
      }
    }
  });

  return { success: true, counts };
}

// ============================================
// APP STATISTICS
// ============================================

export interface AppStats {
  version: string;
  totalExercises: number;
  totalSessions: number;
  totalDurationHours: number;
  totalVolumeKg: number;
}

async function getLifetimeVolume(): Promise<number> {
  const completedSets = await db.sets.filter(s => s.completed).toArray();
  const seIds = Array.from(new Set(completedSets.map(s => s.session_exercise_id)));
  if (seIds.length === 0) return 0;

  const sessionExs = await db.sessionExercises.where('id').anyOf(seIds).toArray();
  const seMap = new Map(sessionExs.map(se => [se.id, se.exercise_id]));

  const exIds = Array.from(new Set(sessionExs.map(se => se.exercise_id)));
  const exercises = await db.exercises.where('id').anyOf(exIds).toArray();
  const exMap = new Map(exercises.map(ex => [ex.id, ex]));

  let totalVol = 0;
  for (const s of completedSets) {
    const exId = seMap.get(s.session_exercise_id);
    if (!exId) continue;
    const ex = exMap.get(exId);
    if (!ex) continue;

    const reps = s.actual_reps ?? 0;
    let load = 0;
    if (ex.is_bodyweight) {
      load = (s.bodyweight_at_time ?? 70) + (s.actual_added_weight ?? 0);
    } else {
      load = s.actual_weight ?? 0;
    }
    totalVol += load * reps;
  }
  return totalVol;
}

export async function getAppStats(): Promise<AppStats> {
  const totalExercises = await db.exercises.count();
  const totalSessions = await db.sessions.filter(s => !!s.ended_at).count();
  
  const completedSessions = await db.sessions.filter(s => !!s.ended_at).toArray();
  const totalDurationSeconds = completedSessions.reduce(
    (sum, s) => sum + (s.total_duration_seconds ?? 0),
    0
  );
  const totalDurationHours = Math.round(totalDurationSeconds / 3600);
  const totalVolumeKg = await getLifetimeVolume();

  return {
    version: '1.0.0', // Standard client app version
    totalExercises,
    totalSessions,
    totalDurationHours,
    totalVolumeKg,
  };
}

export async function syncDataToSheets(): Promise<Response> {
  const SHEET_URL = 'https://script.google.com/macros/s/AKfycbR2aP_GWBoP4q0cuszgO8VSK_QtXKvyLjU7JSfcHD4Zl8qowY3HPgUaU-5VT2tay_0/exec';

  const sessions = await db.sessions.toArray();
  const allSets = await db.sets.toArray();
  const bodyMetrics = await db.bodyMetrics.toArray();
  const activities = await db.activityLogs.toArray();
  const cycles = await db.trainingCycles.toArray();

  // Enrich sets with exercise name and session date
  const enrichedSets = [];
  for (const set of allSets) {
    const sessionEx = await db.sessionExercises.get(set.session_exercise_id);
    if (!sessionEx) continue;
    const exercise = await db.exercises.get(sessionEx.exercise_id);
    const session = await db.sessions.get(sessionEx.session_id);
    enrichedSets.push({
      id: set.id,
      exercise_name: exercise?.name || 'Unknown',
      set_number: set.set_number,
      actual_reps: set.actual_reps || '',
      actual_weight: set.actual_weight || '',
      actual_added_weight: set.actual_added_weight || '',
      actual_time_seconds: set.actual_time_seconds || '',
      bodyweight_at_time: set.bodyweight_at_time || '',
      rest_duration_seconds: set.rest_duration_seconds || '',
      session_date: session?.date || '',
    });
  }

  const payload = {
    sessions: sessions.map(s => ({
      id: s.id,
      date: s.date,
      started_at: s.started_at,
      ended_at: s.ended_at || '',
      total_duration_minutes: s.total_duration_seconds ? Math.round(s.total_duration_seconds / 60) : '',
      notes: s.notes || '',
      cycle_day_id: s.cycle_day_id || '',
    })),
    sets: enrichedSets,
    bodyMetrics: bodyMetrics.map(m => ({
      id: m.id,
      date: m.date,
      weight_kg: m.weight_kg,
      body_fat_percent: m.body_fat_percent || '',
      notes: m.notes || '',
    })),
    activities: activities.map(a => ({
      id: a.id,
      date: a.date,
      activity_type: a.activity_type,
      duration_minutes: a.duration_minutes,
      notes: a.notes || '',
    })),
    cycles: cycles.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      start_date: c.start_date,
      is_active: c.is_active,
    })),
  };

  const response = await fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });

  return response;
}
