import type { SetEntry, Exercise } from '../db/types';

/**
 * Calculates Epley 1RM: weight * (1 + reps / 30).
 * Reliable primarily for reps <= 12. If reps > 12, it returns the raw weight.
 */
export function calcEpley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps > 12) return weight; // Not reliable for high reps
  return weight * (1 + reps / 30);
}

/**
 * Calculates the total load of a set.
 * For bodyweight exercises, it is (bodyweight_at_time + actual_added_weight).
 * For weighted exercises, it is actual_weight.
 */
export function calcSetLoad(set: SetEntry, exercise: Exercise): number {
  if (exercise.is_bodyweight) {
    const bw = set.bodyweight_at_time ?? 70;
    const added = set.actual_added_weight ?? 0;
    return bw + added;
  }
  return set.actual_weight ?? 0;
}

/**
 * Calculates the 1RM of a set.
 */
export function calcSet1RM(set: SetEntry, exercise: Exercise): number {
  const load = calcSetLoad(set, exercise);
  const reps = set.actual_reps ?? 0;
  return calcEpley1RM(load, reps);
}

/**
 * Calculates total volume of a set (Load * reps).
 */
export function calcSetVolume(set: SetEntry, exercise: Exercise): number {
  const load = calcSetLoad(set, exercise);
  const reps = set.actual_reps ?? 0;
  return load * reps;
}
