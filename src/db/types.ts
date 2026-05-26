export type MuscleGroup =
  | 'chest' | 'back' | 'legs' | 'shoulders'
  | 'arms' | 'core' | 'cardio' | 'full_body';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine'
  | 'bodyweight' | 'cable' | 'resistance_band' | 'kettlebell' | 'other';

export type MeasurementType = 'reps' | 'time' | 'distance';

export type DayType = 'workout' | 'rest';

export type GroupType = 'single' | 'superset' | 'triset' | 'circuit';

// ============================================
// 1. Exercises
// ============================================
export interface Exercise {
  id: string;                       // uuid
  name: string;                     // "Bench Press"
  name_vi?: string;                 // "Đẩy ngực" (tuỳ chọn)
  muscle_group: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
  measurement_type: MeasurementType;
  is_bodyweight: boolean;           // dùng trọng lượng cơ thể không
  description: string;              // mô tả kỹ thuật
  video_url?: string;               // link YouTube tham khảo
  is_custom: boolean;               // user tự tạo hay seed
  created_at: string;               // ISO timestamp
}

// ============================================
// 2. Training Cycles
// ============================================
export interface TrainingCycle {
  id: string;
  name: string;                     // "Push/Pull/Legs"
  description?: string;
  is_active: boolean;               // chỉ 1 cycle active tại 1 thời điểm
  start_date: string;               // ISO date (YYYY-MM-DD)
  created_at: string;
}

// ============================================
// 3. Cycle Days
// ============================================
export interface CycleDay {
  id: string;
  cycle_id: string;
  day_order: number;                // thứ tự ngày trong vòng (1, 2, 3...)
  day_type: DayType;
  name: string;                     // "Push Day", "Nghỉ"
}

// ============================================
// 4. Cycle Day Exercises (target)
// ============================================
export interface CycleDayExercise {
  id: string;
  cycle_day_id: string;
  exercise_id: string;
  order: number;                    // thứ tự bài trong ngày
  target_sets: number;
  target_reps?: number;             // cho reps-based
  target_weight?: number;           // tạ mục tiêu (kg) — cho weighted
  target_added_weight?: number;     // tạ thêm mục tiêu (kg) — cho bodyweight
  target_time_seconds?: number;     // cho time-based
  notes?: string;
  group_id?: string;
  group_type?: GroupType;
}

// ============================================
// 5. Sessions
// ============================================
export interface Session {
  id: string;
  date: string;                     // ISO date
  cycle_day_id?: string;            // link tới ngày trong vòng, null nếu tự do
  started_at: string;               // ISO timestamp
  ended_at?: string;
  total_duration_seconds?: number;  // tính khi kết thúc
  notes?: string;
}

// ============================================
// 6. Session Exercises
// ============================================
export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order: number;
  completed: boolean;
  group_id?: string;
  group_type?: GroupType;
}

// ============================================
// 7. Sets
// ============================================
export interface SetEntry {
  id: string;
  session_exercise_id: string;
  set_number: number;
  actual_reps?: number;
  actual_weight?: number;           // kg, cho weighted
  actual_added_weight?: number;     // kg thêm, cho bodyweight
  actual_time_seconds?: number;     // cho time-based
  bodyweight_at_time?: number;      // SNAPSHOT cân nặng tại thời điểm tập
  rest_duration_seconds?: number;
  completed: boolean;
  completed_at: string;             // ISO timestamp
  round_number?: number;
}

// ============================================
// 8. Body Metrics
// ============================================
export interface BodyMetric {
  id: string;
  date: string;                     // ISO date
  weight_kg: number;
  body_fat_percent?: number;
  notes?: string;
}

// ============================================
// 9. Activity Logs
// ============================================
export interface ActivityLog {
  id: string;
  date: string;                     // ISO date
  activity_type: string;            // "Đi bộ", "Chạy", "Yoga", ...
  duration_minutes: number;
  notes?: string;
  created_at: string;
}

// ============================================
// 10. Settings (single row)
// ============================================
export interface AppSettings {
  id: 'singleton';                  // chỉ 1 record
  theme: 'light' | 'dark' | 'system';
  default_rest_seconds: number;     // mặc định 90
  default_workout_timer_mode: 'stopwatch' | 'countdown';
  default_rest_timer_mode: 'stopwatch' | 'countdown';
  default_bodyweight_kg?: number;   // fallback nếu chưa có BodyMetric
  haptic_enabled: boolean;
  last_backup_at?: string;
  last_sync_at?: string;
}
