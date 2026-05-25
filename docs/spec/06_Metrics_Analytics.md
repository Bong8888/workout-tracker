# 06 — Metrics, Activity & Analytics

> **Phụ thuộc:** `00_README.md`, `02_Database_Schema.md`, `05_Workout_Session_Engine.md`
> **Mục tiêu:** Build các module Body Metrics (cân nặng), Activity Log (hoạt động ngoài lịch), và Statistics (biểu đồ thống kê).
> **Tab:** "Thống kê" (tab 4) + 1 phần trong tab "Tôi" (tab 5) + Quick action trong tab "Hôm nay" (tab 1)

---

## Phần A — Body Metrics (Cân nặng)

### A.1. Vị trí
- Trong tab **"Tôi"** (tab 5)
- Section "Cân nặng" với:
  - Giá trị mới nhất + ngày
  - Mini chart 30 ngày gần nhất
  - Nút "+ Cập nhật cân nặng"
  - Link "Xem chi tiết →" tới biểu đồ full

### A.2. Form nhập

```
┌─────────────────────────────┐
│  ← Cập nhật cân nặng        │
├─────────────────────────────┤
│  Ngày: [hôm nay ▼]          │
│  Cân nặng (kg): [_____]     │
│  % mỡ (optional): [_____]   │
│  Ghi chú: [_____________]   │
├─────────────────────────────┤
│       [💾 Lưu]               │
└─────────────────────────────┘
```

- Tần suất khuyến nghị: 2-3 tuần / lần (không bắt buộc)
- 1 ngày có thể nhập nhiều lần (nhưng warning: "Đã có 1 record hôm nay, ghi đè?")
- Validate: weight > 20 và < 300 (số hợp lý)

### A.3. Functions

```typescript
// src/features/metrics/api.ts

export async function getAllBodyMetrics(): Promise<BodyMetric[]>; // sort by date desc
export async function getLatestBodyMetric(): Promise<BodyMetric | undefined>;
export async function createBodyMetric(data: Omit<BodyMetric, 'id'>): Promise<string>;
export async function updateBodyMetric(id: string, data: Partial<BodyMetric>): Promise<void>;
export async function deleteBodyMetric(id: string): Promise<void>;

// Trả về bodyweight gần nhất tính từ 1 ngày
export async function getBodyweightAtDate(date: string): Promise<number | undefined>;
```

---

## Phần B — Activity Log (Hoạt động ngoài lịch)

### B.1. Vị trí
- Trong tab **"Hôm nay"** (tab 1) — quick log section
- Có 1 trang riêng `/activities` để xem tất cả

### B.2. Use case chính

> Ví dụ buổi sáng tôi vận động tại nhà (hít đất, kéo xà, chống đẩy, nhảy dây) → muốn ghi chú lại. Buổi tối đến phòng gym tập tạ theo lịch (Session).

→ Activity Log dùng cho **hoạt động không cần track set/rep chi tiết**.
→ Nếu muốn track chi tiết → dùng Session (tạo session ad-hoc).

### B.3. Template

```
┌─────────────────────────────┐
│  ← Ghi hoạt động             │
├─────────────────────────────┤
│  Ngày: [hôm nay ▼]          │
│  Loại hoạt động:             │
│   [Đi bộ ▼] hoặc tự nhập     │
│  Thời gian: [____] phút     │
│  Ghi chú:                    │
│  [________________________] │
│  [________________________] │
├─────────────────────────────┤
│       [💾 Lưu]               │
└─────────────────────────────┘
```

**Loại hoạt động (preset):**
- Đi bộ
- Chạy bộ
- Đạp xe
- Bơi
- Yoga
- Stretching
- Bodyweight tại nhà
- Cardio
- Thể thao (đá bóng, cầu lông...)
- Khác (tự nhập)

**Ghi chú example:** "30 hít đất, 10 kéo xà, 5 phút nhảy dây"

### B.4. Functions

```typescript
// src/features/activities/api.ts

export async function getAllActivities(filters?: { from?: string; to?: string }): Promise<ActivityLog[]>;
export async function getActivitiesByDate(date: string): Promise<ActivityLog[]>;
export async function createActivity(data: Omit<ActivityLog, 'id' | 'created_at'>): Promise<string>;
export async function updateActivity(id: string, data: Partial<ActivityLog>): Promise<void>;
export async function deleteActivity(id: string): Promise<void>;
```

### B.5. Hiển thị trong tab "Hôm nay"

```
┌─────────────────────────────┐
│  Hôm nay, 25/05/2026         │
├─────────────────────────────┤
│  📅 Day 3 — Legs (active)   │
│   [▶ Bắt đầu tập]            │
├─────────────────────────────┤
│  📝 Hoạt động hôm nay        │
│  🚶 Đi bộ, 30 phút          │
│  💪 Bodyweight, 25 phút      │
│   "30 hít đất, 5 phút nhảy" │
│   [+ Thêm hoạt động]         │
├─────────────────────────────┤
│  📊 Buổi tập trước:          │
│   Day 2 (Pull), 23/05        │
│   45:30, Volume: 3200kg     │
└─────────────────────────────┘
```

---

## Phần C — Statistics (Biểu đồ thống kê)

### C.1. Tab "Thống kê"

3 sub-tab hoặc 3 section riêng:

1. **Theo bài tập** — tạ / 1RM theo thời gian từng bài
2. **Theo vòng tập** — volume theo vòng + nhóm cơ
3. **Cơ thể & Hoạt động** — cân nặng, tổng thời gian tập, activity

### C.2. Chart 1 — Tạ tối đa theo thời gian từng bài

**Input:**
- Dropdown chọn bài tập
- Date range (mặc định 6 tháng gần nhất)

**Output:** Line chart
- Trục X: ngày
- Trục Y: tạ (kg)
- 2 line:
  - **Max weight per session** (tạ nặng nhất set trong session đó)
  - **1RM ước tính** (Epley formula, dotted line)

**Công thức 1RM (Epley):**
```typescript
export function calcEpley1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps > 12) return weight; // không tin cậy nếu rep quá cao
  return weight * (1 + reps / 30);
}
```

**Cho bài bodyweight: dùng total load (bodyweight + added):**
```typescript
export function calcSetLoad(set: SetEntry, exercise: Exercise): number {
  if (exercise.is_bodyweight) {
    return (set.bodyweight_at_time ?? 0) + (set.actual_added_weight ?? 0);
  }
  return set.actual_weight ?? 0;
}

export function calcSet1RM(set: SetEntry, exercise: Exercise): number {
  const load = calcSetLoad(set, exercise);
  const reps = set.actual_reps ?? 1;
  return calcEpley1RM(load, reps);
}
```

**Data preparation:**
```typescript
async function getExerciseProgressData(exerciseId: string) {
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) return [];

  const sessionExs = await db.sessionExercises
    .where('exercise_id').equals(exerciseId)
    .toArray();

  const result: Array<{ date: string; max_weight: number; max_1rm: number }> = [];

  for (const se of sessionExs) {
    const session = await db.sessions.get(se.session_id);
    if (!session) continue;

    const sets = await db.sets
      .where('session_exercise_id').equals(se.id)
      .filter(s => s.completed)
      .toArray();

    if (sets.length === 0) continue;

    const maxLoad = Math.max(...sets.map(s => calcSetLoad(s, exercise)));
    const max1RM = Math.max(...sets.map(s => calcSet1RM(s, exercise)));

    result.push({
      date: session.date,
      max_weight: maxLoad,
      max_1rm: max1RM,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
```

### C.3. Chart 2 — Volume theo vòng tập theo nhóm cơ

**Input:**
- Auto-detect: lấy các vòng tập đã hoàn thành ít nhất 1 lần
- User có thể chọn vòng cụ thể

**Output:** Stacked bar chart
- Trục X: chu kỳ vòng (Cycle 1, Cycle 2, ...)
- Trục Y: volume (kg)
- Mỗi bar stack theo nhóm cơ (chest, back, legs, ...)

**"Cycle 1, 2, 3" nghĩa là gì?**
- Vòng 6 ngày, bắt đầu 01/01
- Cycle 1 = 01/01 - 06/01
- Cycle 2 = 07/01 - 12/01
- ...

**Volume = Σ (load × reps) cho tất cả set trong khoảng đó:**
```typescript
export function calcSetVolume(set: SetEntry, exercise: Exercise): number {
  const load = calcSetLoad(set, exercise);
  const reps = set.actual_reps ?? 0;
  return load * reps;
}
```

**Data preparation:**
```typescript
async function getCycleVolumeByMuscleGroup(cycleId: string) {
  const cycle = await db.trainingCycles.get(cycleId);
  if (!cycle) return [];

  const days = await db.cycleDays.where('cycle_id').equals(cycleId).toArray();
  const cycleLength = days.length;

  const sessions = await db.sessions
    .filter(s => days.some(d => d.id === s.cycle_day_id))
    .toArray();

  // Group sessions vào từng cycle iteration
  const startDate = new Date(cycle.start_date);
  const iterations: Map<number, Session[]> = new Map();

  for (const session of sessions) {
    const sessionDate = new Date(session.date);
    const daysDiff = Math.floor((sessionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) continue;

    const iterationIndex = Math.floor(daysDiff / cycleLength) + 1;
    if (!iterations.has(iterationIndex)) iterations.set(iterationIndex, []);
    iterations.get(iterationIndex)!.push(session);
  }

  // Tính volume từng iteration theo muscle group
  const result = [];
  for (const [iterIdx, iterSessions] of iterations.entries()) {
    const volumeByMuscle: Record<string, number> = {};

    for (const session of iterSessions) {
      const sessionExs = await db.sessionExercises.where('session_id').equals(session.id).toArray();
      for (const se of sessionExs) {
        const exercise = await db.exercises.get(se.exercise_id);
        if (!exercise) continue;

        const sets = await db.sets.where('session_exercise_id').equals(se.id).toArray();
        const totalVol = sets.reduce((sum, s) => sum + calcSetVolume(s, exercise), 0);

        volumeByMuscle[exercise.muscle_group] = (volumeByMuscle[exercise.muscle_group] ?? 0) + totalVol;
      }
    }

    result.push({ iteration: `Cycle ${iterIdx}`, ...volumeByMuscle });
  }

  return result;
}
```

### C.4. Chart 3 — Cân nặng theo thời gian

**Input:** không cần (auto)

**Output:** Line chart
- Trục X: ngày
- Trục Y: cân nặng (kg)
- Optional: line phụ % mỡ

```typescript
async function getWeightChartData() {
  return db.bodyMetrics.orderBy('date').toArray();
}
```

### C.5. Chart 4 — Tổng thời gian tập theo tuần / tháng

**Output:** Bar chart
- Trục X: tuần (W1, W2, ...) hoặc tháng
- Trục Y: tổng phút tập

```typescript
async function getTimeByWeek(weeksBack: number = 12) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - weeksBack * 7);

  const sessions = await db.sessions
    .where('date').above(from.toISOString().slice(0, 10))
    .toArray();

  const byWeek: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.total_duration_seconds) continue;
    const week = getWeekKey(s.date); // format: "2026-W21"
    byWeek[week] = (byWeek[week] ?? 0) + Math.floor(s.total_duration_seconds / 60);
  }

  return Object.entries(byWeek).map(([week, minutes]) => ({ week, minutes }));
}
```

### C.6. Recharts setup

```typescript
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

// Example
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="max_weight" stroke="#3b82f6" name="Tạ max" />
    <Line type="monotone" dataKey="max_1rm" stroke="#ef4444" name="1RM ước tính" strokeDasharray="5 5" />
  </LineChart>
</ResponsiveContainer>
```

**Tip:** Dùng `useLiveQuery` để re-render khi data thay đổi.

---

## D — Edge cases

| Case | Xử lý |
|---|---|
| Không có data | Hiển thị empty state: "Chưa có dữ liệu, tập 1 buổi để xem biểu đồ" |
| Bài chưa từng được tập | Chart trống |
| 1 ngày có nhiều session | Chart lấy max của cả ngày, hoặc plot từng session riêng |
| Set có rep > 12 | 1RM không tin cậy, hiển thị notice |
| Bài bodyweight: chưa có bodyweight | Bỏ qua hoặc dùng default từ settings |
| Cycle chưa có session nào hoàn thành | Volume chart trống, hiển thị message |

---

## E — Acceptance Criteria

- [ ] CRUD body metrics
- [ ] CRUD activity logs
- [ ] Tab "Hôm nay" hiển thị activity của hôm nay
- [ ] Chart tạ theo bài: chọn bài → hiện line chart 2 lines (max + 1RM)
- [ ] Chart volume theo cycle: stacked bar theo nhóm cơ
- [ ] Chart cân nặng line
- [ ] Chart thời gian tập theo tuần
- [ ] Recharts responsive trên mobile
- [ ] Empty states cho mỗi chart
- [ ] 1RM tính đúng theo Epley
- [ ] Volume tính đúng cho cả bodyweight + weighted

---

*Tiếp theo: `07_Settings_Utility.md`*
