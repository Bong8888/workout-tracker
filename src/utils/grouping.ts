export interface ExerciseGroup<T> {
  id: string; // group_id, or unique ID for single exercises
  type: 'single' | 'superset' | 'triset' | 'circuit';
  exercises: T[];
}

/**
 * Groups a flat array of exercises by their contiguous group_id.
 * Single exercises (without group_id) are represented as separate 'single' groups.
 */
export function groupExercises<T extends { group_id?: string; group_type?: string; id: string }>(
  items: T[]
): ExerciseGroup<T>[] {
  const result: ExerciseGroup<T>[] = [];
  let currentGroup: ExerciseGroup<T> | null = null;

  for (const item of items) {
    if (item.group_id) {
      // If we are currently building a group with the same group_id, append to it
      if (currentGroup && currentGroup.id === item.group_id) {
        currentGroup.exercises.push(item);
      } else {
        // Start a new group
        currentGroup = {
          id: item.group_id,
          type: (item.group_type as any) || 'superset',
          exercises: [item]
        };
        result.push(currentGroup);
      }
    } else {
      // Reset current group, treat this as a single exercise
      currentGroup = null;
      result.push({
        id: `single-${item.id}`,
        type: 'single',
        exercises: [item]
      });
    }
  }

  return result;
}
