import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { TrainingCycle, CycleDay, CycleDayExercise, Exercise } from '../../db/types';
import { deleteCycle as deleteCycleHelper } from '../../db/helpers';
import { getTodayDayOrder } from '../../utils/cycleDate';

// ============================================
// TRAINING CYCLES CRUD
// ============================================

export async function getAllCycles(): Promise<TrainingCycle[]> {
  return db.trainingCycles.toArray();
}

export async function getCycleById(id: string): Promise<TrainingCycle | undefined> {
  return db.trainingCycles.get(id);
}

export async function getActiveCycle(): Promise<TrainingCycle | undefined> {
  return db.trainingCycles.filter(c => c.is_active).first();
}

/**
 * Creates a cycle with nested days and targeted exercises.
 */
export async function createCycle(data: {
  name: string;
  description?: string;
  start_date: string;
  days: Array<{
    day_type: 'workout' | 'rest';
    name: string;
    exercises?: Array<{
      exercise_id: string;
      target_sets: number;
      target_reps?: number;
      target_weight?: number;
      target_added_weight?: number;
      target_time_seconds?: number;
      notes?: string;
    }>;
  }>;
}): Promise<string> {
  const cycleId = crypto.randomUUID();

  // If this is the first cycle, activate it automatically
  const count = await db.trainingCycles.count();
  const is_active = count === 0;

  await db.transaction('rw', [db.trainingCycles, db.cycleDays, db.cycleDayExercises], async () => {
    // 1. Create cycle
    await db.trainingCycles.add({
      id: cycleId,
      name: data.name,
      description: data.description,
      is_active,
      start_date: data.start_date,
      created_at: new Date().toISOString(),
    });

    // 2. Create days and day exercises
    for (let i = 0; i < data.days.length; i++) {
      const dayData = data.days[i];
      const dayId = crypto.randomUUID();

      await db.cycleDays.add({
        id: dayId,
        cycle_id: cycleId,
        day_order: i + 1,
        day_type: dayData.day_type,
        name: dayData.name,
      });

      if (dayData.day_type === 'workout' && dayData.exercises) {
        for (let j = 0; j < dayData.exercises.length; j++) {
          const exData = dayData.exercises[j];
          await db.cycleDayExercises.add({
            id: crypto.randomUUID(),
            cycle_day_id: dayId,
            exercise_id: exData.exercise_id,
            order: j + 1,
            target_sets: exData.target_sets,
            target_reps: exData.target_reps,
            target_weight: exData.target_weight,
            target_added_weight: exData.target_added_weight,
            target_time_seconds: exData.target_time_seconds,
            notes: exData.notes,
          });
        }
      }
    }
  });

  return cycleId;
}

/**
 * Updates a cycle metadata.
 */
export async function updateCycleMetadata(id: string, data: Partial<TrainingCycle>): Promise<void> {
  await db.trainingCycles.update(id, data);
}

/**
 * Updates a cycle and overwrites nested days/exercises.
 */
export async function updateCycle(
  id: string,
  data: {
    name: string;
    description?: string;
    start_date: string;
    days: Array<{
      day_type: 'workout' | 'rest';
      name: string;
      exercises?: Array<{
        exercise_id: string;
        target_sets: number;
        target_reps?: number;
        target_weight?: number;
        target_added_weight?: number;
        target_time_seconds?: number;
        notes?: string;
      }>;
    }>;
  }
): Promise<void> {
  await db.transaction('rw', [db.trainingCycles, db.cycleDays, db.cycleDayExercises], async () => {
    // 1. Update cycle metadata
    await db.trainingCycles.update(id, {
      name: data.name,
      description: data.description,
      start_date: data.start_date,
    });

    // 2. Clean up existing days & exercises
    const existingDays = await db.cycleDays.where('cycle_id').equals(id).toArray();
    const existingDayIds = existingDays.map(d => d.id);
    if (existingDayIds.length > 0) {
      await db.cycleDayExercises.where('cycle_day_id').anyOf(existingDayIds).delete();
    }
    await db.cycleDays.where('cycle_id').equals(id).delete();

    // 3. Re-create days and day exercises
    for (let i = 0; i < data.days.length; i++) {
      const dayData = data.days[i];
      const dayId = crypto.randomUUID();

      await db.cycleDays.add({
        id: dayId,
        cycle_id: id,
        day_order: i + 1,
        day_type: dayData.day_type,
        name: dayData.name,
      });

      if (dayData.day_type === 'workout' && dayData.exercises) {
        for (let j = 0; j < dayData.exercises.length; j++) {
          const exData = dayData.exercises[j];
          await db.cycleDayExercises.add({
            id: crypto.randomUUID(),
            cycle_day_id: dayId,
            exercise_id: exData.exercise_id,
            order: j + 1,
            target_sets: exData.target_sets,
            target_reps: exData.target_reps,
            target_weight: exData.target_weight,
            target_added_weight: exData.target_added_weight,
            target_time_seconds: exData.target_time_seconds,
            notes: exData.notes,
          });
        }
      }
    }
  });
}

/**
 * Deletes a cycle cascading days and exercises.
 */
export async function deleteCycle(id: string): Promise<void> {
  await deleteCycleHelper(id);
}

/**
 * Activates a cycle and deactivates others.
 */
export async function activateCycle(id: string, resetStartDate?: boolean): Promise<void> {
  await db.transaction('rw', [db.trainingCycles], async () => {
    // Deactivate all cycles
    await db.trainingCycles.toCollection().modify({ is_active: false });

    // Activate the chosen cycle
    const updateData: Partial<TrainingCycle> = { is_active: true };
    if (resetStartDate) {
      updateData.start_date = new Date().toISOString().slice(0, 10);
    }
    await db.trainingCycles.update(id, updateData);
  });
}

// ============================================
// CYCLE DAYS AND EXERCISES API
// ============================================

export async function getCycleDays(cycleId: string): Promise<CycleDay[]> {
  return db.cycleDays.where('cycle_id').equals(cycleId).sortBy('day_order');
}

export async function getCycleDayExercises(dayId: string): Promise<Array<CycleDayExercise & { exercise: Exercise }>> {
  const cdExercises = await db.cycleDayExercises.where('cycle_day_id').equals(dayId).sortBy('order');
  
  const exercises = (await Promise.all(
    cdExercises.map(async cde => {
      const exercise = await db.exercises.get(cde.exercise_id);
      if (!exercise) return null;
      return {
        ...cde,
        exercise
      };
    })
  )).filter((e): e is (CycleDayExercise & { exercise: Exercise }) => e !== null);

  return exercises;
}

export async function reorderCycleDays(_cycleId: string, dayIds: string[]): Promise<void> {
  await db.transaction('rw', [db.cycleDays], async () => {
    for (let i = 0; i < dayIds.length; i++) {
      await db.cycleDays.update(dayIds[i], { day_order: i + 1 });
    }
  });
}

// ============================================
// CALCULATIONS & ACTIVE GETTERS
// ============================================

export async function getTodayCycleDay(): Promise<{
  cycle: TrainingCycle;
  day: CycleDay;
  exercises: Array<CycleDayExercise & { exercise: Exercise }>;
} | null> {
  const cycle = await db.trainingCycles.filter(c => c.is_active).first();
  if (!cycle) return null;

  const days = await db.cycleDays.where('cycle_id').equals(cycle.id).sortBy('day_order');
  if (days.length === 0) return null;

  const dayOrder = getTodayDayOrder(cycle.start_date, days.length);
  if (dayOrder === -1) return null;

  const day = days.find(d => d.day_order === dayOrder);
  if (!day) return null;

  const exercises = await getCycleDayExercises(day.id);
  return { cycle, day, exercises };
}

// ============================================
// REACT HOOKS
// ============================================

export function useCycles(): TrainingCycle[] {
  return useLiveQuery(() => db.trainingCycles.toArray(), [], []);
}

export function useCycle(id: string): TrainingCycle | undefined {
  return useLiveQuery(() => db.trainingCycles.get(id), [id]);
}

export function useActiveCycle(): TrainingCycle | undefined {
  return useLiveQuery(() => db.trainingCycles.filter(c => c.is_active).first(), [], undefined);
}

export function useTodayCycleDay() {
  return useLiveQuery(() => getTodayCycleDay(), []);
}

export function useCycleDays(cycleId: string): CycleDay[] {
  return useLiveQuery(() => getCycleDays(cycleId), [cycleId], []);
}

export function useCycleDayExercises(dayId: string): Array<CycleDayExercise & { exercise: Exercise }> {
  return useLiveQuery(() => getCycleDayExercises(dayId), [dayId], []);
}
