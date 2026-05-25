# 03 — Exercise Library Module

> **Phụ thuộc:** `00_README.md`, `02_Database_Schema.md`
> **Mục tiêu:** Build module quản lý thư viện bài tập + seed data ban đầu.
> **Tab:** "Thư viện" (tab 3)

---

## 1. Tính năng

| Tính năng | Mô tả |
|---|---|
| Seed data | Tải sẵn ~100-500 bài tập phổ biến khi mở app lần đầu |
| Danh sách | Liệt kê tất cả bài, filter theo nhóm cơ + thiết bị, search theo tên |
| Chi tiết | Xem mô tả, video, các bài liên quan |
| Thêm custom | User tự thêm bài mới |
| Sửa | Sửa bài (cả seed lẫn custom) — sửa seed sẽ lưu override |
| Xoá | Chỉ xoá được bài custom. Bài seed: cho phép "ẩn" thay vì xoá |
| Sort | Theo tên A-Z, nhóm cơ, mới thêm |

---

## 2. Seed Data

### 2.1. Nguồn

**Khuyên dùng: Free Exercise DB**
- Repo: `github.com/yuhonas/free-exercise-db`
- License: public domain (Unlicense)
- ~800 bài tập, có ảnh
- Format JSON sẵn

**Cách lấy:**
```bash
# Tải file JSON về src/data/
curl -o src/data/exercises-raw.json \
  https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
```

### 2.2. Transform schema

File gốc có format khác schema của app. Cần script transform 1 lần khi build:

```typescript
// scripts/transform-exercises.ts
import rawData from '../src/data/exercises-raw.json';
import fs from 'fs';

const MUSCLE_MAP: Record<string, string> = {
  'chest': 'chest',
  'back': 'back',
  'lats': 'back',
  'middle back': 'back',
  'lower back': 'back',
  'quadriceps': 'legs',
  'hamstrings': 'legs',
  'glutes': 'legs',
  'calves': 'legs',
  'shoulders': 'shoulders',
  'traps': 'shoulders',
  'biceps': 'arms',
  'triceps': 'arms',
  'forearms': 'arms',
  'abdominals': 'core',
  'abductors': 'legs',
  'adductors': 'legs',
  'neck': 'shoulders',
};

const EQUIPMENT_MAP: Record<string, string> = {
  'barbell': 'barbell',
  'dumbbell': 'dumbbell',
  'machine': 'machine',
  'cable': 'cable',
  'body only': 'bodyweight',
  'kettlebells': 'kettlebell',
  'bands': 'resistance_band',
  'medicine ball': 'other',
  'exercise ball': 'other',
  'e-z curl bar': 'barbell',
  'foam roll': 'other',
  'other': 'other',
};

const BODYWEIGHT_EQUIPMENT = ['body only'];

const transformed = rawData.map((ex: any) => ({
  id: crypto.randomUUID(),
  name: ex.name,
  muscle_group: MUSCLE_MAP[ex.primaryMuscles?.[0]] || 'full_body',
  secondary_muscles: (ex.secondaryMuscles || [])
    .map((m: string) => MUSCLE_MAP[m])
    .filter(Boolean),
  equipment: EQUIPMENT_MAP[ex.equipment] || 'other',
  measurement_type: 'reps',  // default, có thể fine-tune sau
  is_bodyweight: BODYWEIGHT_EQUIPMENT.includes(ex.equipment),
  description: (ex.instructions || []).join('\n\n'),
  video_url: undefined,
  is_custom: false,
  created_at: new Date().toISOString(),
}));

fs.writeFileSync(
  'src/data/exercises.json',
  JSON.stringify(transformed, null, 2)
);

console.log(`✓ Transformed ${transformed.length} exercises`);
```

### 2.3. Load vào DB lần đầu

```typescript
// src/db/seed.ts
import { db } from './index';
import exercisesData from '../data/exercises.json';

export async function seedIfEmpty() {
  const count = await db.exercises.count();
  if (count > 0) return; // đã có data

  await db.exercises.bulkAdd(exercisesData);

  // Seed settings nếu chưa có
  const settings = await db.settings.get('singleton');
  if (!settings) {
    await db.settings.add({
      id: 'singleton',
      theme: 'system',
      default_rest_seconds: 90,
      default_workout_timer_mode: 'stopwatch',
      default_rest_timer_mode: 'countdown',
      haptic_enabled: true,
    });
  }
}
```

Gọi `seedIfEmpty()` 1 lần trong `main.tsx` hoặc trong `App.tsx`:

```typescript
useEffect(() => {
  seedIfEmpty();
}, []);
```

### 2.4. Lưu ý bản quyền

- Free Exercise DB là public domain → OK
- KHÔNG copy mô tả từ blog/website khác
- Mô tả từ Free Exercise DB là tiếng Anh → có thể giữ nguyên hoặc dịch sau
- Trường `video_url`: KHÔNG tự ý gán YouTube link, để user tự paste

---

## 3. UI / UX

### 3.1. Trang danh sách `/exercises`

**Layout:**
```
┌─────────────────────────────┐
│  Thư viện           [+ Thêm]│
├─────────────────────────────┤
│  [🔍 Tìm kiếm...........]   │
│  [Tất cả ▼] [Tất cả ▼]      │  ← filter nhóm cơ + thiết bị
├─────────────────────────────┤
│  📋 Bench Press         >   │
│     Ngực • Tạ đòn           │
├─────────────────────────────┤
│  📋 Squat               >   │
│     Chân • Tạ đòn           │
├─────────────────────────────┤
│  ...                        │
└─────────────────────────────┘
```

**Behavior:**
- Search realtime (debounce 200ms)
- Filter combo: bấm vào pill nhóm cơ + thiết bị
- Bấm vào 1 item → mở chi tiết
- Pull-to-refresh: không cần (offline data)
- Virtualized list nếu > 100 items (dùng `react-window`)

### 3.2. Trang chi tiết `/exercises/:id`

**Layout:**
```
┌─────────────────────────────┐
│  ← Bench Press     [Sửa] [⋮]│
├─────────────────────────────┤
│  Nhóm cơ: Ngực              │
│  Phụ: Vai, Tay              │
│  Thiết bị: Tạ đòn           │
│  Kiểu đo: Reps              │
│  Bodyweight: Không          │
├─────────────────────────────┤
│  📝 Mô tả                    │
│  Nằm trên ghế, hai tay nắm  │
│  tạ rộng hơn vai...         │
├─────────────────────────────┤
│  🎥 Video tham khảo         │
│  [Mở YouTube ↗]             │
├─────────────────────────────┤
│  📊 Lịch sử                  │
│  PR: 80kg × 5 reps          │
│  Lần tập gần nhất: 3 ngày   │
│  [Xem biểu đồ →]            │
└─────────────────────────────┘
```

### 3.3. Form thêm/sửa

**Fields:**
- Tên (required)
- Nhóm cơ chính (required, select)
- Nhóm cơ phụ (multi-select, optional)
- Thiết bị (required, select)
- Kiểu đo (required, select: reps / time / distance)
- Là bodyweight? (checkbox)
- Mô tả (textarea, optional)
- Video URL (optional, validate là YouTube URL)

**Submit:**
- Validate tên không trùng
- Hiện popup confirm trước khi lưu (theo cross-cutting rule)
- Toast "Đã lưu" khi thành công

### 3.4. Xoá

- Bài custom: confirm dialog → xoá
- Bài seed: hiện modal "Bài này là bài hệ thống, bạn muốn ẩn không?" → set field `hidden: true` (cần bổ sung field này vào schema nếu muốn dùng)
- Nếu bài đang được dùng trong cycle / session → cảnh báo trước

---

## 4. Functions cần implement

```typescript
// src/features/exercises/api.ts

export async function getAllExercises(filters?: {
  muscle_group?: string;
  equipment?: string;
  search?: string;
}): Promise<Exercise[]>;

export async function getExerciseById(id: string): Promise<Exercise | undefined>;

export async function createExercise(data: Omit<Exercise, 'id' | 'created_at' | 'is_custom'>): Promise<string>;

export async function updateExercise(id: string, data: Partial<Exercise>): Promise<void>;

export async function deleteExercise(id: string): Promise<{ success: boolean; reason?: string }>;

export async function getExerciseUsage(id: string): Promise<{
  inCycles: number;
  inSessions: number;
}>;

// Hook
export function useExercises(filters?: {...}): Exercise[];  // dùng useLiveQuery
export function useExercise(id: string): Exercise | undefined;
```

---

## 5. Edge cases

| Case | Xử lý |
|---|---|
| Search "ben" → hiển thị "Bench Press" | Lowercase + contains match trên `name` |
| Xoá bài đang dùng trong cycle | Cảnh báo, không cho xoá; hoặc cảnh báo "Sẽ xoá khỏi N vòng tập" |
| Thêm bài trùng tên | Cho phép (vì có thể có biến thể), nhưng cảnh báo |
| Sửa bài seed | Cho phép, đánh dấu `is_modified: true` (nếu muốn tracking) |
| Reset library về mặc định | Settings: nút "Reset library" → xoá tất cả + load lại seed |

---

## 6. Acceptance Criteria

- [ ] App mở lần đầu: seed exercises load vào DB
- [ ] Tab "Thư viện" hiện list bài
- [ ] Search hoạt động (debounce)
- [ ] Filter theo nhóm cơ + thiết bị
- [ ] Chi tiết bài tập hiển thị đủ field
- [ ] Thêm bài custom thành công
- [ ] Sửa bài thành công
- [ ] Xoá bài custom thành công
- [ ] Popup confirm trước khi lưu
- [ ] Mở app lần 2 không seed lại (count > 0)

---

*Tiếp theo: `04_Training_Cycle_Logic.md`*
