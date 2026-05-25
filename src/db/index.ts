// src/db/index.ts
import Dexie, { type Table } from 'dexie';
import type {
  Exercise, TrainingCycle, CycleDay, CycleDayExercise,
  Session, SessionExercise, SetEntry,
  BodyMetric, ActivityLog, AppSettings
} from './types';

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  trainingCycles!: Table<TrainingCycle, string>;
  cycleDays!: Table<CycleDay, string>;
  cycleDayExercises!: Table<CycleDayExercise, string>;
  sessions!: Table<Session, string>;
  sessionExercises!: Table<SessionExercise, string>;
  sets!: Table<SetEntry, string>;
  bodyMetrics!: Table<BodyMetric, string>;
  activityLogs!: Table<ActivityLog, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('WorkoutDB');

    this.version(1).stores({
      // Format: 'primaryKey, index1, index2, [compoundIndex+...]'
      exercises: 'id, muscle_group, equipment, is_custom, name',
      trainingCycles: 'id, is_active, created_at',
      cycleDays: 'id, cycle_id, day_order, [cycle_id+day_order]',
      cycleDayExercises: 'id, cycle_day_id, exercise_id, order',
      sessions: 'id, date, cycle_day_id, started_at',
      sessionExercises: 'id, session_id, exercise_id, order',
      sets: 'id, session_exercise_id, set_number, completed_at',
      bodyMetrics: 'id, date',
      activityLogs: 'id, date, activity_type',
      settings: 'id'
    });

    this.version(2).stores({
      cycleDayExercises: 'id, cycle_day_id, exercise_id, order, group_id',
      sessionExercises: 'id, session_id, exercise_id, order, group_id'
    });
  }
}

export const db = new WorkoutDB();
