import { db } from './index';
import type { SetEntry, Exercise } from './types';

/**
 * Calculates the total load for a set depending on whether the exercise is bodyweight or weighted.
 */
export function calcTotalLoad(set: SetEntry, exercise: Exercise): number {
  if (exercise.is_bodyweight) {
    return (set.bodyweight_at_time ?? 0) + (set.actual_added_weight ?? 0);
  }
  return set.actual_weight ?? 0;
}

/**
 * Creates a SetEntry with bodyweight snapshot from settings or the latest body metric.
 */
export async function createBodyweightSet(data: Partial<SetEntry> & { session_exercise_id: string; set_number: number }) {
  // Lấy bodyweight gần nhất
  const latestMetric = await db.bodyMetrics
    .orderBy('date')
    .reverse()
    .first();

  const settings = await db.settings.get('singleton');

  const bodyweight = latestMetric?.weight_kg
    ?? settings?.default_bodyweight_kg
    ?? 70; // fallback cuối cùng

  return db.sets.add({
    completed: false,
    ...data,
    id: data.id ?? crypto.randomUUID(),
    bodyweight_at_time: bodyweight,  // SNAPSHOT — không đổi sau này
    completed_at: data.completed_at ?? new Date().toISOString(),
  } as SetEntry);
}

/**
 * Deletes a training cycle and cascades deletion to cycleDays and cycleDayExercises.
 */
export async function deleteCycle(cycleId: string) {
  await db.transaction('rw', [db.trainingCycles, db.cycleDays, db.cycleDayExercises], async () => {
    const days = await db.cycleDays.where('cycle_id').equals(cycleId).toArray();
    const dayIds = days.map(d => d.id);

    if (dayIds.length > 0) {
      await db.cycleDayExercises.where('cycle_day_id').anyOf(dayIds).delete();
    }
    await db.cycleDays.where('cycle_id').equals(cycleId).delete();
    await db.trainingCycles.delete(cycleId);
  });
}

/**
 * Deletes a session and cascades deletion to sessionExercises and sets.
 */
export async function deleteSession(sessionId: string) {
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets], async () => {
    const sessionExs = await db.sessionExercises.where('session_id').equals(sessionId).toArray();
    const sessionExIds = sessionExs.map(se => se.id);

    if (sessionExIds.length > 0) {
      await db.sets.where('session_exercise_id').anyOf(sessionExIds).delete();
    }
    await db.sessionExercises.where('session_id').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}
