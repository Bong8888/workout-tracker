# 02 — Database Schema

> **Phụ thuộc:** Đọc `00_README.md` trước.
> **Mục tiêu:** AI tạo file `db/index.ts` (Dexie instance) + `db/types.ts` (TypeScript types).
> **File này LUÔN kèm theo khi prompt code logic bất kỳ.**

---

## 1. Tổng quan các bảng

| Bảng | Mô tả | Quan hệ |
|---|---|---|
| `exercises` | Thư viện bài tập (cố định + custom) | — |
| `trainingCycles` | Vòng tập | 1-N `cycleDays` |
| `cycleDays` | Ngày trong vòng tập (tập / nghỉ) | 1-N `cycleDayExercises` |
| `cycleDayExercises` | Bài tập trong ngày của vòng + target | N-1 `exercises` |
| `sessions` | Buổi tập thực tế | N-1 `cycleDays`, 1-N `sessionExercises` |
| `sessionExercises` | Bài tập trong session | N-1 `exercises`, 1-N `sets` |
| `sets` | Từng set trong session | — |
| `bodyMetrics` | Cân nặng theo thời gian | — |
| `activityLogs` | Hoạt động tự do | — |
| `settings` | Cài đặt user (single row) | — |

---

## 2. TypeScript Types

```typescript
// src/db/types.ts

export type MuscleGroup =
  | 'chest' | 'back' | 'legs' | 'shoulders'
  | 'arms' | 'core' | 'cardio' | 'full_body';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine'
  | 'bodyweight' | 'cable' | 'resistance_band' | 'kettlebell' | 'other';

export type MeasurementType = 'reps' | 'time' | 'distance';

export type DayType = 'workout' | 'rest';

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
}
```

---

## 3. Dexie Schema

```typescript
// src/db/index.ts
import Dexie, { Table } from 'dexie';
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
  }
}

export const db = new WorkoutDB();
```

---

## 4. Relationship Diagram

```
exercises (1) ─────────────────── (N) cycleDayExercises
                                          │
                                          │ belongs to
                                          ▼
trainingCycles (1) ── (N) cycleDays ── has many ── cycleDayExercises

trainingCycles (1) ── (N) cycleDays ── (1) ── (N) sessions
                                              │
                                              │
                                              ▼
                                          sessionExercises ── (1) ── (N) sets
                                              ▲
                                              │ ref
                                              │
                                          exercises

(standalone)
  bodyMetrics
  activityLogs
  settings
```

---

## 5. Quan trọng — Bodyweight Snapshot

Khi tạo `SetEntry` cho bài tập có `exercise.is_bodyweight === true`:

```typescript
async function createBodyweightSet(data: Partial<SetEntry>) {
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
    ...data,
    id: crypto.randomUUID(),
    bodyweight_at_time: bodyweight,  // SNAPSHOT — không đổi sau này
    completed_at: new Date().toISOString(),
  });
}
```

**Total load cho bài bodyweight:**
```typescript
function calcTotalLoad(set: SetEntry, exercise: Exercise): number {
  if (exercise.is_bodyweight) {
    return (set.bodyweight_at_time ?? 0) + (set.actual_added_weight ?? 0);
  }
  return set.actual_weight ?? 0;
}
```

---

## 6. Quy tắc tạo entity

Mọi entity (trừ `settings` là singleton) đều:

```typescript
const newEntity = {
  id: crypto.randomUUID(),
  created_at: new Date().toISOString(),  // nếu có field này
  // ...
};
```

---

## 7. Quy tắc xoá

**Cascade xoá thủ công** (Dexie không có FK cascade tự động):

```typescript
async function deleteCycle(cycleId: string) {
  await db.transaction('rw', [db.trainingCycles, db.cycleDays, db.cycleDayExercises], async () => {
    const days = await db.cycleDays.where('cycle_id').equals(cycleId).toArray();
    const dayIds = days.map(d => d.id);

    await db.cycleDayExercises.where('cycle_day_id').anyOf(dayIds).delete();
    await db.cycleDays.where('cycle_id').equals(cycleId).delete();
    await db.trainingCycles.delete(cycleId);
  });
}

async function deleteSession(sessionId: string) {
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets], async () => {
    const sessionExs = await db.sessionExercises.where('session_id').equals(sessionId).toArray();
    const sessionExIds = sessionExs.map(se => se.id);

    await db.sets.where('session_exercise_id').anyOf(sessionExIds).delete();
    await db.sessionExercises.where('session_id').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}
```

**Lưu ý:** KHÔNG xoá `exercise` nếu đang được tham chiếu bởi `cycleDayExercises` hoặc `sessionExercises` — cảnh báo user trước.

---

## 8. Migrations

Khi đổi schema sau này:

```typescript
this.version(2).stores({
  // schema mới
}).upgrade(tx => {
  // migration logic
});
```

Mỗi version mới phải giữ lại tất cả version cũ trong code.

---

## 9. Acceptance Criteria

- [ ] File `db/types.ts` định nghĩa đầy đủ 10 interfaces
- [ ] File `db/index.ts` khai báo Dexie class với 10 tables
- [ ] Schema indexes đầy đủ cho các query thường dùng
- [ ] Cascade delete được implement cho cycle + session
- [ ] Bodyweight snapshot logic được implement đúng
- [ ] Mở Chrome DevTools → Application → IndexedDB → thấy WorkoutDB với 10 stores

---

*Tiếp theo: chọn module để build (`03`, `04`, `05`, `06`, hoặc `07`)*
