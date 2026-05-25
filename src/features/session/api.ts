import { db } from '../../db';
import type { Session, SessionExercise, SetEntry, Exercise } from '../../db/types';
import { deleteSession as deleteSessionHelper } from '../../db/helpers';
import { useLiveQuery } from 'dexie-react-hooks';

// ============================================
// SESSION LIFECYCLE
// ============================================

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter(s => !s.ended_at).first();
}

export async function getSessionById(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function startSession(cycleDayId?: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // If there's already an active session, return its ID instead of starting a new one
  const active = await getActiveSession();
  if (active) return active.id;

  await db.transaction('rw', [db.sessions, db.sessionExercises, db.cycleDays, db.cycleDayExercises], async () => {
    await db.sessions.add({
      id: sessionId,
      date: today,
      cycle_day_id: cycleDayId,
      started_at: now,
    });

    if (cycleDayId) {
      const cdExercises = await db.cycleDayExercises
        .where('cycle_day_id')
        .equals(cycleDayId)
        .sortBy('order');

      for (const cde of cdExercises) {
        await db.sessionExercises.add({
          id: crypto.randomUUID(),
          session_id: sessionId,
          exercise_id: cde.exercise_id,
          order: cde.order,
          completed: false,
        });
      }
    }
  });

  return sessionId;
}

export async function endSession(sessionId: string, notes?: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Không tìm thấy buổi tập.');

  const startedAt = new Date(session.started_at);
  const endedAt = new Date();
  const duration = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));

  await db.sessions.update(sessionId, {
    ended_at: endedAt.toISOString(),
    total_duration_seconds: duration,
    notes: notes?.trim() || undefined,
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteSessionHelper(sessionId);
}

// ============================================
// EXERCISES IN SESSION
// ============================================

export async function getSessionExercises(sessionId: string): Promise<Array<SessionExercise & { exercise: Exercise }>> {
  const sExercises = await db.sessionExercises.where('session_id').equals(sessionId).sortBy('order');
  
  const exercises = (await Promise.all(
    sExercises.map(async se => {
      const exercise = await db.exercises.get(se.exercise_id);
      if (!exercise) return null;
      return {
        ...se,
        exercise
      };
    })
  )).filter((e): e is (SessionExercise & { exercise: Exercise }) => e !== null);

  return exercises;
}

export async function addSessionExercise(sessionId: string, exerciseId: string): Promise<string> {
  const id = crypto.randomUUID();
  
  await db.transaction('rw', [db.sessionExercises], async () => {
    const count = await db.sessionExercises.where('session_id').equals(sessionId).count();
    await db.sessionExercises.add({
      id,
      session_id: sessionId,
      exercise_id: exerciseId,
      order: count + 1,
      completed: false,
    });
  });

  return id;
}

export async function markExerciseCompleted(sessionExerciseId: string, completed = true): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { completed });
}

// ============================================
// SET LOGGING
// ============================================

export async function getSetsForExercise(sessionExerciseId: string): Promise<SetEntry[]> {
  return db.sets.where('session_exercise_id').equals(sessionExerciseId).sortBy('set_number');
}

export async function addSetToExercise(data: {
  session_exercise_id: string;
  set_number: number;
  actual_reps?: number;
  actual_weight?: number;
  actual_added_weight?: number;
  actual_time_seconds?: number;
  rest_duration_seconds?: number;
  is_bodyweight: boolean;
}): Promise<string> {
  const id = crypto.randomUUID();
  let bodyweight: number | undefined;

  if (data.is_bodyweight) {
    bodyweight = await getCurrentBodyweight();
  }

  await db.sets.add({
    id,
    session_exercise_id: data.session_exercise_id,
    set_number: data.set_number,
    actual_reps: data.actual_reps,
    actual_weight: data.actual_weight,
    actual_added_weight: data.actual_added_weight,
    actual_time_seconds: data.actual_time_seconds,
    bodyweight_at_time: bodyweight,
    rest_duration_seconds: data.rest_duration_seconds,
    completed: true,
    completed_at: new Date().toISOString(),
  });

  return id;
}

export async function updateSet(id: string, data: Partial<SetEntry>): Promise<void> {
  await db.sets.update(id, data);
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id);
}

// ============================================
// UTILITIES & CALCS
// ============================================

export async function getCurrentBodyweight(): Promise<number> {
  const latestMetric = await db.bodyMetrics.orderBy('date').reverse().first();
  if (latestMetric) return latestMetric.weight_kg;

  const settings = await db.settings.get('singleton');
  if (settings && settings.default_bodyweight_kg) {
    return settings.default_bodyweight_kg;
  }
  return 70; // Fallback
}

export async function getLastSetForExercise(exerciseId: string): Promise<SetEntry | undefined> {
  // Find all session exercises for this exercise
  const sessionExs = await db.sessionExercises.where('exercise_id').equals(exerciseId).toArray();
  const sessionExIds = sessionExs.map(se => se.id);
  if (sessionExIds.length === 0) return undefined;

  // Query sets belonging to these exercises, sorted by completed_at desc
  const lastSet = await db.sets
    .where('session_exercise_id')
    .anyOf(sessionExIds)
    .reverse()
    .sortBy('completed_at')
    .then(arr => arr[0]);

  return lastSet;
}

export async function checkPR(exerciseId: string, set: SetEntry): Promise<boolean> {
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) return false;

  const sessionExs = await db.sessionExercises.where('exercise_id').equals(exerciseId).toArray();
  const sessionExIds = sessionExs.map(se => se.id);
  if (sessionExIds.length === 0) return true;

  const pastSets = await db.sets
    .where('session_exercise_id')
    .anyOf(sessionExIds)
    .filter(s => s.id !== set.id && s.completed)
    .toArray();

  if (pastSets.length === 0) return true;

  if (exercise.measurement_type === 'time') {
    const maxTime = Math.max(...pastSets.map(s => s.actual_time_seconds ?? 0));
    return (set.actual_time_seconds ?? 0) > maxTime;
  } else if (exercise.is_bodyweight) {
    const maxAdded = Math.max(...pastSets.map(s => s.actual_added_weight ?? 0));
    return (set.actual_added_weight ?? 0) > maxAdded;
  } else {
    const maxWeight = Math.max(...pastSets.map(s => s.actual_weight ?? 0));
    return (set.actual_weight ?? 0) > maxWeight;
  }
}

// ============================================
// REACT HOOKS
// ============================================

export function useActiveSessionLive() {
  return useLiveQuery(() => getActiveSession(), []);
}

export function useSessionLive(id: string) {
  return useLiveQuery(() => getSessionById(id), [id]);
}

export function useSessionExercisesLive(sessionId: string) {
  return useLiveQuery(() => getSessionExercises(sessionId), [sessionId], []);
}

export function useSetsForExerciseLive(sessionExerciseId: string) {
  return useLiveQuery(() => getSetsForExercise(sessionExerciseId), [sessionExerciseId], []);
}
