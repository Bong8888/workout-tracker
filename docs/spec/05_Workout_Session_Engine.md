# 05 — Workout Session Engine

> **Phụ thuộc:** `00_README.md`, `02_Database_Schema.md`, `04_Training_Cycle_Logic.md`
> **Mục tiêu:** Build module session mode — phần khó nhất của app.
> **Không có tab riêng**, mở từ tab "Hôm nay" → bấm "Bắt đầu tập".

---

## 1. Khái niệm

**Session** = 1 buổi tập thực tế, có timer chạy, có set/rep thực tế.

**Lifecycle:**
```
[Idle] → [Active] → [Ended]
   ↑          ↓
   └── (resume cùng ngày)
```

**Rule:**
- 1 ngày có thể có nhiều session (vd: sáng cardio, tối tạ)
- Mỗi session link tới 1 `cycle_day_id` (hoặc null nếu tự do)
- Khi user thoát app giữa session → resume được (lưu trạng thái vào DB realtime)

---

## 2. Hai loại Timer

### 2.1. Timer tổng session (Master timer)
- Loại: **Stopwatch (đếm lên)**
- Bắt đầu: lúc bấm "Bắt đầu tập" (= `session.started_at`)
- Kết thúc: lúc bấm "Kết thúc buổi tập" (= `session.ended_at`)
- Hiển thị: **luôn hiện ở header** trong suốt session
- Format: `MM:SS` hoặc `HH:MM:SS` nếu > 1 giờ

### 2.2. Timer set/rest (Phụ timer)
- Loại: **2 chế độ tuỳ user chọn**:
  - **Stopwatch**: đếm lên, dùng cho lúc tập (đo thời gian thực hiện 1 set / 1 bài time-based)
  - **Countdown**: đếm ngược từ giá trị đặt (vd 90s nghỉ)
- Trạng thái:
  - `idle`: chưa bắt đầu
  - `running`: đang chạy
  - `paused`: tạm dừng
  - `finished`: hoàn thành (countdown chạm 0)
- Hiển thị: **modal/sheet nổi lên** khi bấm timer
- Kết thúc countdown: kêu beep + rung haptic + thông báo

### 2.3. Default settings (từ Settings)
- `default_workout_timer_mode`: stopwatch (cho timer lúc tập)
- `default_rest_timer_mode`: countdown (cho timer nghỉ)
- `default_rest_seconds`: 90 (cho countdown nghỉ)
- User có thể đổi chế độ ngay trong session

### 2.4. useTimer hook

```typescript
// src/hooks/useTimer.ts
import { useState, useEffect, useRef } from 'react';

export type TimerMode = 'stopwatch' | 'countdown';
export type TimerState = 'idle' | 'running' | 'paused' | 'finished';

interface UseTimerOptions {
  mode: TimerMode;
  initialSeconds?: number;     // dùng cho countdown
  onFinish?: () => void;       // callback khi countdown chạm 0
}

export function useTimer({ mode, initialSeconds = 0, onFinish }: UseTimerOptions) {
  const [seconds, setSeconds] = useState(mode === 'countdown' ? initialSeconds : 0);
  const [state, setState] = useState<TimerState>('idle');
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setSeconds(prev => {
        if (mode === 'stopwatch') return prev + 1;

        // countdown
        if (prev <= 1) {
          setState('finished');
          onFinish?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state, mode, onFinish]);

  return {
    seconds,
    state,
    start: () => setState('running'),
    pause: () => setState('paused'),
    resume: () => setState('running'),
    reset: (newSeconds?: number) => {
      setSeconds(newSeconds ?? (mode === 'countdown' ? initialSeconds : 0));
      setState('idle');
    },
  };
}
```

---

## 3. Wake Lock & Haptic

### 3.1. Wake Lock — giữ màn hình sáng

```typescript
// src/hooks/useWakeLock.ts
import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    let cancelled = false;

    (async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release();
          return;
        }
        wakeLockRef.current = lock;
      } catch (err) {
        console.warn('WakeLock failed:', err);
      }
    })();

    // Re-acquire khi tab visible trở lại
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && enabled && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [enabled]);
}
```

**Sử dụng:** `useWakeLock(sessionActive)` trong component session.

### 3.2. Haptic feedback

```typescript
// src/hooks/useHaptic.ts
export function vibrate(pattern: number | number[]) {
  if (!('vibrate' in navigator)) return;
  navigator.vibrate(pattern);
}

// Preset patterns
export const HAPTIC = {
  tap: () => vibrate(10),
  success: () => vibrate([50, 50, 50]),
  countdown_finish: () => vibrate([100, 50, 100, 50, 200]),
};
```

**Gọi khi:**
- Countdown rest timer chạm 0 → `HAPTIC.countdown_finish()`
- Hoàn thành 1 set → `HAPTIC.tap()`
- Hoàn thành 1 bài → `HAPTIC.success()`

---

## 4. UI Flow

### 4.1. Màn hình "Bắt đầu" (preview)

Trước khi bấm "Bắt đầu tập":
```
┌─────────────────────────────┐
│  Day 3 — Legs               │
├─────────────────────────────┤
│  📋 Hôm nay:                │
│   1. Squat 3×8 @80kg        │
│   2. Lunges 3×12 @20kg      │
│   3. Calf Raise 4×15        │
│   4. Plank 3×60s            │
├─────────────────────────────┤
│   [▶ Bắt đầu tập]           │
└─────────────────────────────┘
```

### 4.2. Màn hình Active Session

```
┌─────────────────────────────┐
│  ⏱ 00:23:45    [Kết thúc]   │  ← Master timer (luôn hiện)
├─────────────────────────────┤
│  Day 3 — Legs               │
├─────────────────────────────┤
│  ✓ 1. Squat                 │  ← bài đã xong (tick)
│     3/3 set hoàn thành      │
├─────────────────────────────┤
│  ▶ 2. Lunges       [Tiếp]   │  ← bài đang tập (highlight)
│     1/3 set                 │
├─────────────────────────────┤
│  ○ 3. Calf Raise            │
│     Chưa bắt đầu            │
├─────────────────────────────┤
│  ○ 4. Plank                 │
│     Chưa bắt đầu            │
└─────────────────────────────┘
```

### 4.3. Màn hình tập 1 bài (Exercise Detail in Session)

```
┌─────────────────────────────┐
│  ← Lunges        ⏱ 00:23:45 │
├─────────────────────────────┤
│  🎯 Mục tiêu: 3×12 @20kg     │
├─────────────────────────────┤
│  Set 1: ✓ 12 reps @20kg     │
│  Set 2: ✓ 12 reps @20kg     │
│  Set 3: [12 ][20]  [✓ Xong] │  ← đang nhập
├─────────────────────────────┤
│       ⏱ Rest: 01:30          │  ← timer nghỉ (chỉ hiện sau set)
│       [⏸] [Bỏ qua] [+30s]   │
├─────────────────────────────┤
│  [✓ Hoàn thành bài]         │  ← chỉ active khi đủ set hoặc user OK
└─────────────────────────────┘
```

**Behavior:**
- Mỗi set là 1 row với 2 ô input (reps + weight) hoặc 1 ô (thời gian)
- Set trước: hiển thị giá trị đã nhập, có thể bấm để sửa
- Set đang tập: ô input + nút "✓ Xong"
- Bấm "✓ Xong" → lưu set, hiện timer nghỉ countdown
- Timer nghỉ hết → tự ẩn (hoặc beep + rung)
- Set kế tiếp pre-fill bằng giá trị set trước (auto-suggest)

### 4.4. Bài bodyweight

```
┌─────────────────────────────┐
│  ← Pull-up        ⏱ 00:35:12 │
├─────────────────────────────┤
│  🎯 Mục tiêu: 4×8 (BW+5kg)  │
│  📏 Cân nặng: 70kg          │
├─────────────────────────────┤
│  Set 1: [8 reps][+5 kg] [✓] │
│        Total load: 75kg     │
├─────────────────────────────┤
│  ...                         │
└─────────────────────────────┘
```

Khi bài có `is_bodyweight = true`:
- Ô input là "Tạ thêm" (mặc định 0) thay vì "Tạ"
- Hiển thị bodyweight đang dùng (lấy từ BodyMetrics gần nhất)
- Total load = bodyweight + tạ thêm
- Khi lưu set → snapshot `bodyweight_at_time`

### 4.5. Bài time-based

```
┌─────────────────────────────┐
│  ← Plank          ⏱ 00:45:00 │
├─────────────────────────────┤
│  🎯 Mục tiêu: 3×60s          │
├─────────────────────────────┤
│  Set 1: ✓ 65s                │
│  Set 2: [⏱ 00:00]  [Start]  │
│        Mode: ⏱ Đếm lên ▼    │
├─────────────────────────────┤
│  ...                         │
└─────────────────────────────┘
```

Khi bài có `measurement_type = 'time'`:
- Mỗi set là 1 timer riêng (stopwatch hoặc countdown)
- Bấm "Start" → timer chạy
- Bấm "✓ Xong" → lưu `actual_time_seconds`

### 4.6. Kết thúc session

```
┌─────────────────────────────┐
│   🎉 Buổi tập hoàn thành!   │
├─────────────────────────────┤
│  ⏱ Thời gian: 00:45:30      │
│  💪 Bài đã tập: 4/4         │
│  📊 Tổng volume: 2400 kg    │
│  🏆 PR mới: Squat 85kg      │
├─────────────────────────────┤
│  Ghi chú buổi tập:           │
│  [_________________]        │
├─────────────────────────────┤
│       [💾 Lưu buổi tập]      │
└─────────────────────────────┘
```

---

## 5. Functions cần implement

```typescript
// src/features/session/api.ts

// Lifecycle
export async function startSession(cycleDayId?: string): Promise<string>; // returns session_id
export async function endSession(sessionId: string, notes?: string): Promise<void>;
export async function getActiveSession(): Promise<Session | undefined>; // session chưa ended_at

// Set logging
export async function addSetToExercise(data: {
  session_exercise_id: string;
  set_number: number;
  actual_reps?: number;
  actual_weight?: number;
  actual_added_weight?: number;
  actual_time_seconds?: number;
  rest_duration_seconds?: number;
  is_bodyweight: boolean;  // để biết có cần snapshot bodyweight
}): Promise<string>;

export async function updateSet(id: string, data: Partial<SetEntry>): Promise<void>;
export async function deleteSet(id: string): Promise<void>;

// Exercise within session
export async function markExerciseCompleted(sessionExerciseId: string): Promise<void>;

// Auto-suggest tạ từ session trước
export async function getLastSetForExercise(exerciseId: string): Promise<SetEntry | undefined>;

// Bodyweight
export async function getCurrentBodyweight(): Promise<number>;

// PR detection
export async function checkPR(exerciseId: string, set: SetEntry): Promise<boolean>;
```

---

## 6. Logic quan trọng

### 6.1. Tạo session từ cycle_day

```typescript
async function startSession(cycleDayId?: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  await db.transaction('rw', [db.sessions, db.sessionExercises], async () => {
    await db.sessions.add({
      id: sessionId,
      date: today,
      cycle_day_id: cycleDayId,
      started_at: now,
    });

    // Nếu có cycle_day, copy bài tập từ cycle_day_exercises vào session_exercises
    if (cycleDayId) {
      const cdExercises = await db.cycleDayExercises
        .where('cycle_day_id').equals(cycleDayId)
        .sortBy('order');

      for (const cde of cdExercises) {
        await db.sessionExercises.add({
          id: crypto.randomUUID(),
          session_id: sessionId,
          exercise_id: cde.exercise_id,
          order: cde.order,
          completed: false,
        });
      }
    }
  });

  return sessionId;
}
```

### 6.2. End session

```typescript
async function endSession(sessionId: string, notes?: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  const startedAt = new Date(session.started_at);
  const endedAt = new Date();
  const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

  await db.sessions.update(sessionId, {
    ended_at: endedAt.toISOString(),
    total_duration_seconds: duration,
    notes,
  });
}
```

### 6.3. Auto-suggest tạ (load từ set trước)

```typescript
async function getLastSetForExercise(exerciseId: string): Promise<SetEntry | undefined> {
  const sessionExs = await db.sessionExercises
    .where('exercise_id').equals(exerciseId)
    .toArray();

  const sessionExIds = sessionExs.map(se => se.id);

  const lastSet = await db.sets
    .where('session_exercise_id').anyOf(sessionExIds)
    .reverse()
    .sortBy('completed_at')
    .then(arr => arr[0]);

  return lastSet;
}
```

Khi user mở bài để tập, pre-fill input bằng giá trị này.

---

## 7. Edge cases

| Case | Xử lý |
|---|---|
| User thoát app giữa session | Session vẫn lưu trong DB với `ended_at` null. Mở lại app → modal "Tiếp tục buổi tập đang dở?" |
| Tắt máy / hết pin giữa set | Set chưa kịp lưu → mất. Khuyên user bấm "✓ Xong" ngay sau mỗi set. |
| User muốn skip bài | Cho phép — đánh dấu bài skipped (có thể thêm field `skipped: true`) |
| User muốn thêm bài ngoài lịch trong session | Cho phép — nút "+ Thêm bài" trong session, mở library picker |
| User muốn sửa set đã nhập | Tap vào set → mở edit modal |
| Số set thực tế > số set target | Cho phép, nút "+ Thêm set" |
| Số set thực tế < số set target | Cảnh báo khi "Hoàn thành bài": "Còn N set chưa làm, vẫn xác nhận?" |
| Bodyweight chưa từng nhập | Lấy từ settings.default_bodyweight_kg, nếu không có → hỏi user nhập |

---

## 8. Acceptance Criteria

- [ ] Bấm "Bắt đầu tập" → session được tạo, master timer chạy
- [ ] Master timer chạy đúng, không bị lệch khi tab background (dùng Date diff thay setInterval pure)
- [ ] Rest timer countdown chạy đúng, kêu + rung khi hết
- [ ] Lưu set thành công, hiện ở list set
- [ ] Pre-fill set sau bằng set trước
- [ ] Bài bodyweight: form đúng (2 ô tạ thêm + reps), snapshot bodyweight
- [ ] Bài time-based: timer trong từng set
- [ ] Đóng app → mở lại → resume session
- [ ] Wake lock hoạt động (test trên điện thoại thật)
- [ ] Haptic kêu khi countdown hết
- [ ] Kết thúc session: tính total_duration đúng, hiện summary

---

*Tiếp theo: `06_Metrics_Analytics.md`*
