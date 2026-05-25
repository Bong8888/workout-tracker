# 04 — Training Cycle Logic

> **Phụ thuộc:** `00_README.md`, `02_Database_Schema.md`, hiểu module `03_Exercise_Library_Module.md`
> **Mục tiêu:** Build module "vòng tập" linh hoạt + logic tính "hôm nay là ngày nào trong vòng".
> **Tab:** "Lịch tập" (tab 2)

---

## 1. Khái niệm "Vòng tập"

**Vòng tập** = một chu kỳ lặp lại của các ngày tập + nghỉ.

**Đặc điểm:**
- Độ dài tuỳ ý (3 ngày, 7 ngày, 10 ngày...)
- Mỗi ngày là `workout` (tập) hoặc `rest` (nghỉ)
- Mỗi ngày tập gồm 1 danh sách bài tập + target (set × rep × tạ)
- Khi hết vòng → tự động lặp lại từ ngày 1
- **Tại 1 thời điểm chỉ có 1 vòng đang active**
- User có thể có nhiều vòng đã tạo, switch active giữa chúng

**Ví dụ vòng tập:**

| Vòng "PPL" (6 ngày) | Vòng "Bro split" (7 ngày) |
|---|---|
| Day 1: Push | Day 1: Ngực |
| Day 2: Pull | Day 2: Lưng |
| Day 3: Legs | Day 3: Chân |
| Day 4: Push | Day 4: Vai |
| Day 5: Pull | Day 5: Tay |
| Day 6: Legs | Day 6: Cardio + Bụng |
| (lặp lại từ Day 1) | Day 7: Nghỉ |

---

## 2. Logic tính "Hôm nay là ngày nào trong vòng"

**Input:**
- `start_date`: ngày bắt đầu của vòng (ISO date)
- `cycle_length`: số ngày trong vòng (count `cycleDays` của cycle)
- `today`: ngày hôm nay

**Công thức:**
```typescript
import { differenceInDays, parseISO } from 'date-fns';

export function getTodayDayOrder(
  startDate: string,
  cycleLength: number,
  today: Date = new Date()
): number {
  const start = parseISO(startDate);
  const daysDiff = differenceInDays(today, start);

  if (daysDiff < 0) return -1; // vòng chưa bắt đầu

  // day_order là 1-indexed
  const dayOrder = (daysDiff % cycleLength) + 1;
  return dayOrder;
}
```

**Ví dụ:**
- Vòng 6 ngày, bắt đầu 01/01/2026
- Hôm nay 03/01/2026 → daysDiff = 2 → day_order = 3 (Day 3)
- Hôm nay 07/01/2026 → daysDiff = 6 → day_order = 1 (Day 1 — vòng mới)
- Hôm nay 15/01/2026 → daysDiff = 14 → day_order = 3 (Day 3)

**Function lấy ngày hôm nay đầy đủ:**

```typescript
export async function getTodayCycleDay(): Promise<{
  cycle: TrainingCycle;
  day: CycleDay;
  exercises: (CycleDayExercise & { exercise: Exercise })[];
} | null> {
  const cycle = await db.trainingCycles
    .filter(c => c.is_active === true)
    .first();

  if (!cycle) return null;

  const days = await db.cycleDays
    .where('cycle_id').equals(cycle.id)
    .sortBy('day_order');

  if (days.length === 0) return null;

  const dayOrder = getTodayDayOrder(cycle.start_date, days.length);
  if (dayOrder === -1) return null;

  const day = days.find(d => d.day_order === dayOrder);
  if (!day) return null;

  const cdExercises = await db.cycleDayExercises
    .where('cycle_day_id').equals(day.id)
    .sortBy('order');

  const exercises = await Promise.all(
    cdExercises.map(async cde => ({
      ...cde,
      exercise: (await db.exercises.get(cde.exercise_id))!
    }))
  );

  return { cycle, day, exercises };
}
```

---

## 3. UI / UX

### 3.1. Trang danh sách vòng `/cycles`

```
┌─────────────────────────────┐
│  Lịch tập           [+ Thêm]│
├─────────────────────────────┤
│  ★ PPL 6 ngày    [Active]   │
│    Bắt đầu: 01/01/2026      │
│    Hôm nay: Day 3 (Legs)    │
├─────────────────────────────┤
│  ○ Bro split 7 ngày         │
│    Tạo: 15/12/2025          │
│    [Kích hoạt]              │
├─────────────────────────────┤
│  ○ Cardio focus 4 ngày      │
│    [Kích hoạt]              │
└─────────────────────────────┘
```

### 3.2. Trang chi tiết vòng `/cycles/:id`

```
┌─────────────────────────────┐
│  ← PPL 6 ngày       [Sửa][⋮]│
├─────────────────────────────┤
│  Trạng thái: ★ Đang active  │
│  Bắt đầu: 01/01/2026        │
│  Độ dài: 6 ngày             │
├─────────────────────────────┤
│  Day 1 — Push               │
│    • Bench Press 3×8 @60kg  │
│    • Shoulder Press 3×10    │
│    • Tricep Pushdown 3×12   │
├─────────────────────────────┤
│  Day 2 — Pull               │
│    • Pull-up 4×8            │
│    • Barbell Row 3×10 @50kg │
│    ...                      │
├─────────────────────────────┤
│  Day 3 — Legs               │
│    ...                      │
├─────────────────────────────┤
│  Day 4 — Rest               │
└─────────────────────────────┘
```

### 3.3. Form tạo / sửa vòng

**Step 1: Thông tin chung**
- Tên vòng (required)
- Mô tả (optional)
- Ngày bắt đầu (default hôm nay)

**Step 2: Thêm các ngày**
- Bấm "+ Thêm ngày" → chọn type (workout / rest)
- Mỗi day có:
  - Tên (vd "Push Day", "Nghỉ chủ động")
  - Nếu workout: button "Thêm bài tập"
- Kéo thả để sắp xếp lại thứ tự (drag-and-drop)
- Có thể xoá ngày (confirm trước)

**Step 3: Thêm bài cho ngày tập**
- Bấm "+ Thêm bài" → mở modal chọn từ Library
- Sau khi chọn, form set target:
  - Số set (default 3)
  - Số rep mục tiêu
  - Tạ mục tiêu (kg) — hoặc "Tạ thêm" nếu là bodyweight
  - Thời gian mục tiêu (giây) — nếu là time-based
  - Ghi chú

**Bước cuối: Popup Confirm**
- Hiển thị review toàn bộ vòng
- Bấm "Lưu" → save vào DB
- Bấm "Sửa lại" → quay lại form

### 3.4. Active cycle logic

- Chỉ 1 vòng active tại 1 thời điểm
- Bấm "Kích hoạt" vòng X → set `is_active = false` cho tất cả vòng khác, `is_active = true` cho X
- Khi kích hoạt, hỏi user: "Đặt ngày bắt đầu là hôm nay?" → option giữ start_date cũ hoặc reset

---

## 4. Functions cần implement

```typescript
// src/features/cycles/api.ts

// Vòng tập
export async function getAllCycles(): Promise<TrainingCycle[]>;
export async function getCycleById(id: string): Promise<TrainingCycle | undefined>;
export async function getActiveCycle(): Promise<TrainingCycle | undefined>;
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
}): Promise<string>;
export async function updateCycle(id: string, data: Partial<TrainingCycle>): Promise<void>;
export async function deleteCycle(id: string): Promise<void>;  // cascade
export async function activateCycle(id: string, resetStartDate?: boolean): Promise<void>;

// Ngày + bài trong vòng
export async function getCycleDays(cycleId: string): Promise<CycleDay[]>;
export async function getCycleDayExercises(dayId: string): Promise<Array<CycleDayExercise & { exercise: Exercise }>>;
export async function addExerciseToCycleDay(dayId: string, data: Omit<CycleDayExercise, 'id' | 'cycle_day_id'>): Promise<string>;
export async function reorderCycleDays(cycleId: string, dayIds: string[]): Promise<void>;

// Tính toán
export function getTodayDayOrder(startDate: string, cycleLength: number): number;
export async function getTodayCycleDay(): Promise<{ cycle, day, exercises } | null>;
```

---

## 5. Edge cases

| Case | Xử lý |
|---|---|
| Chưa có vòng nào | Tab "Hôm nay" hiện CTA "Tạo vòng tập đầu tiên" |
| Có vòng nhưng chưa active | Tab "Hôm nay" hiện danh sách vòng có sẵn, "Kích hoạt 1 vòng" |
| Vòng có 0 ngày | Không cho lưu, validate trước |
| Vòng có ngày workout nhưng 0 bài tập | Cho phép, hiển thị warning |
| Start_date trong tương lai | Tab "Hôm nay" hiện "Vòng sẽ bắt đầu vào ngày X" |
| Đổi start_date sau khi đã có session | Cảnh báo: "Sẽ ảnh hưởng đến gợi ý hôm nay, không xoá session cũ" |
| Xoá vòng đang active | Confirm 2 lần, sau khi xoá → không có vòng active |
| Sửa cycle_day khi đang có session đang chạy của day đó | Khoá sửa hoặc cảnh báo |

---

## 6. Tab "Hôm nay" — gợi ý buổi tập

Logic hiển thị tab "Hôm nay":

```typescript
async function getTodayDisplay() {
  const todayInfo = await getTodayCycleDay();

  if (!todayInfo) {
    return { type: 'no_cycle' };
  }

  if (todayInfo.day.day_type === 'rest') {
    return {
      type: 'rest_day',
      cycle: todayInfo.cycle,
      day: todayInfo.day,
    };
  }

  // Check đã có session cho hôm nay chưa
  const today = new Date().toISOString().slice(0, 10);
  const existingSession = await db.sessions
    .where('date').equals(today)
    .filter(s => s.cycle_day_id === todayInfo.day.id)
    .first();

  return {
    type: 'workout_day',
    cycle: todayInfo.cycle,
    day: todayInfo.day,
    exercises: todayInfo.exercises,
    existingSession,  // nếu đã bắt đầu hoặc xong
  };
}
```

**UI states:**

1. **No cycle** → CTA "Tạo vòng tập đầu tiên"
2. **Rest day** → "Hôm nay là ngày nghỉ! 🛌" + nút "Log activity ngoài lịch"
3. **Workout day, chưa tập** → list bài + nút "Bắt đầu tập"
4. **Workout day, đang tập** → nút "Tiếp tục buổi tập"
5. **Workout day, đã xong** → summary + "Xem chi tiết" / "Tập thêm buổi nữa"

---

## 7. Acceptance Criteria

- [ ] Tạo được vòng tập với nhiều ngày, mix workout + rest
- [ ] Thêm bài vào ngày workout với target đầy đủ
- [ ] Popup confirm trước khi lưu vòng
- [ ] Sửa vòng, sửa target, xoá bài / ngày
- [ ] Kích hoạt vòng → vòng khác tự deactive
- [ ] Xoá vòng cascade các cycle_days và cycle_day_exercises
- [ ] `getTodayDayOrder` tính đúng cho mọi case (vd day 1, day cuối, qua nhiều chu kỳ)
- [ ] Tab "Hôm nay" hiển thị đúng theo 5 UI states
- [ ] Drag-and-drop sắp xếp lại ngày + bài trong ngày

---

*Tiếp theo: `05_Workout_Session_Engine.md`*
