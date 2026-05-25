import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Exercise } from '../../db/types';

/**
 * Retrieves all exercises matching the provided filters, sorted alphabetically.
 */
export async function getAllExercises(filters?: {
  muscle_group?: string;
  equipment?: string;
  search?: string;
}): Promise<Exercise[]> {
  let exercises = await db.exercises.toArray();

  if (filters) {
    const { muscle_group, equipment, search } = filters;
    
    if (muscle_group && muscle_group !== 'all') {
      exercises = exercises.filter(ex => ex.muscle_group === muscle_group);
    }
    
    if (equipment && equipment !== 'all') {
      exercises = exercises.filter(ex => ex.equipment === equipment);
    }
    
    if (search) {
      const searchLower = search.toLowerCase().trim();
      exercises = exercises.filter(ex => 
        ex.name.toLowerCase().includes(searchLower) ||
        (ex.name_vi && ex.name_vi.toLowerCase().includes(searchLower))
      );
    }
  }

  return exercises.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Retrieves a single exercise by ID.
 */
export async function getExerciseById(id: string): Promise<Exercise | undefined> {
  return db.exercises.get(id);
}

/**
 * Creates a new custom exercise.
 */
export async function createExercise(data: Omit<Exercise, 'id' | 'created_at' | 'is_custom'>): Promise<string> {
  const id = crypto.randomUUID();
  const newExercise: Exercise = {
    ...data,
    id,
    is_custom: true,
    created_at: new Date().toISOString()
  };
  await db.exercises.add(newExercise);
  return id;
}

/**
 * Updates an exercise.
 */
export async function updateExercise(id: string, data: Partial<Exercise>): Promise<void> {
  await db.exercises.update(id, data);
}

/**
 * Deletes a custom exercise. Rejects if it is a system-seeded exercise.
 */
export async function deleteExercise(id: string): Promise<{ success: boolean; reason?: string }> {
  const exercise = await db.exercises.get(id);
  if (!exercise) {
    return { success: false, reason: 'Không tìm thấy bài tập.' };
  }
  if (!exercise.is_custom) {
    return { success: false, reason: 'Không thể xóa bài tập hệ thống.' };
  }
  await db.exercises.delete(id);
  return { success: true };
}

/**
 * Checks how many times an exercise is used in cycles and sessions.
 */
export async function getExerciseUsage(id: string): Promise<{
  inCycles: number;
  inSessions: number;
}> {
  const inCycles = await db.cycleDayExercises.where('exercise_id').equals(id).count();
  const inSessions = await db.sessionExercises.where('exercise_id').equals(id).count();
  return { inCycles, inSessions };
}

/**
 * React hook for live querying exercises with filters.
 */
export function useExercises(filters?: {
  muscle_group?: string;
  equipment?: string;
  search?: string;
}): Exercise[] {
  return useLiveQuery(
    () => getAllExercises(filters),
    [filters?.muscle_group, filters?.equipment, filters?.search],
    []
  );
}

/**
 * React hook for live querying a single exercise.
 */
export function useExercise(id: string): Exercise | undefined {
  return useLiveQuery(
    () => getExerciseById(id),
    [id]
  );
}
