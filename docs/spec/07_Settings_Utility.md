# 07 — Settings & Utility

> **Phụ thuộc:** `00_README.md`, `02_Database_Schema.md`
> **Mục tiêu:** Build trang Settings + tính năng utility (export/import, dark mode, reset).
> **Tab:** "Tôi" (tab 5)

---

## 1. Cấu trúc tab "Tôi"

```
┌─────────────────────────────┐
│  Tôi                         │
├─────────────────────────────┤
│  📏 Cân nặng                 │  ← từ file 06
│   Hiện tại: 70kg            │
│   [+ Cập nhật]               │
├─────────────────────────────┤
│  ⚙ Cài đặt                   │
│   ► Giao diện                │
│   ► Timer mặc định           │
│   ► Cân nặng mặc định        │
│   ► Haptic feedback          │
├─────────────────────────────┤
│  💾 Dữ liệu                  │
│   [Xuất dữ liệu (JSON)]     │
│   [Nhập dữ liệu]            │
│   [Reset thư viện bài tập]  │
│   [Xoá tất cả dữ liệu]      │
├─────────────────────────────┤
│  ℹ Thông tin                 │
│   Phiên bản: 1.0.0          │
│   Tổng bài tập: 832         │
│   Tổng session: 45          │
└─────────────────────────────┘
```

---

## 2. Settings — Tính năng

### 2.1. Giao diện (Theme)

- Options: `light` / `dark` / `system`
- Default: `system`
- Lưu vào `settings.theme`
- Implement bằng class trên `<html>`:

```typescript
function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

// Listen system change
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  const settings = await db.settings.get('singleton');
  if (settings?.theme === 'system') {
    document.documentElement.classList.toggle('dark', e.matches);
  }
});
```

### 2.2. Timer mặc định

- **Chế độ timer lúc tập** (cho bài time-based):
  - Đếm lên (stopwatch)
  - Đếm ngược (countdown)
- **Chế độ timer nghỉ:**
  - Đếm lên
  - Đếm ngược
- **Thời gian nghỉ mặc định:** input số giây (default 90)

### 2.3. Cân nặng mặc định

- Input số kg (default 70)
- Dùng làm fallback khi chưa có BodyMetric nào
- KHÔNG ghi đè bodyweight thực tế

### 2.4. Haptic feedback

- Toggle on/off
- Default: on (nếu thiết bị hỗ trợ)
- Check support: `'vibrate' in navigator`

### 2.5. Settings CRUD

```typescript
// src/features/settings/api.ts

export async function getSettings(): Promise<AppSettings> {
  let settings = await db.settings.get('singleton');
  if (!settings) {
    settings = {
      id: 'singleton',
      theme: 'system',
      default_rest_seconds: 90,
      default_workout_timer_mode: 'stopwatch',
      default_rest_timer_mode: 'countdown',
      haptic_enabled: true,
    };
    await db.settings.add(settings);
  }
  return settings;
}

export async function updateSettings(data: Partial<AppSettings>): Promise<void> {
  await db.settings.update('singleton', data);
}
```

---

## 3. Export / Import JSON

### 3.1. Export

**Mục đích:** Backup toàn bộ dữ liệu để chuyển sang máy mới hoặc phòng mất.

**Format:**
```json
{
  "version": 1,
  "exported_at": "2026-05-25T10:00:00.000Z",
  "data": {
    "exercises": [...],
    "trainingCycles": [...],
    "cycleDays": [...],
    "cycleDayExercises": [...],
    "sessions": [...],
    "sessionExercises": [...],
    "sets": [...],
    "bodyMetrics": [...],
    "activityLogs": [...],
    "settings": {...}
  }
}
```

**Implementation:**

```typescript
// src/features/settings/export.ts
import { db } from '../../db';

export async function exportAllData(): Promise<Blob> {
  const data = {
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      exercises: await db.exercises.toArray(),
      trainingCycles: await db.trainingCycles.toArray(),
      cycleDays: await db.cycleDays.toArray(),
      cycleDayExercises: await db.cycleDayExercises.toArray(),
      sessions: await db.sessions.toArray(),
      sessionExercises: await db.sessionExercises.toArray(),
      sets: await db.sets.toArray(),
      bodyMetrics: await db.bodyMetrics.toArray(),
      activityLogs: await db.activityLogs.toArray(),
      settings: await db.settings.toArray(),
    },
  };

  const json = JSON.stringify(data, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export async function downloadExport() {
  const blob = await exportAllData();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `workout-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Update last_backup_at
  await db.settings.update('singleton', {
    last_backup_at: new Date().toISOString(),
  });
}
```

### 3.2. Import

**Implementation:**

```typescript
// src/features/settings/import.ts

export async function importData(file: File, options: {
  mode: 'replace' | 'merge';
}): Promise<{ success: boolean; counts: Record<string, number> }> {
  const text = await file.text();
  let parsed: any;

  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('File JSON không hợp lệ');
  }

  if (parsed.version !== 1) {
    throw new Error('Phiên bản backup không tương thích');
  }

  const data = parsed.data;
  const counts: Record<string, number> = {};

  await db.transaction('rw', db.tables, async () => {
    if (options.mode === 'replace') {
      // Clear all
      for (const table of db.tables) {
        await table.clear();
      }
    }

    // Import từng bảng
    const tableNames = [
      'exercises', 'trainingCycles', 'cycleDays', 'cycleDayExercises',
      'sessions', 'sessionExercises', 'sets', 'bodyMetrics', 'activityLogs',
      'settings'
    ];

    for (const tableName of tableNames) {
      const records = data[tableName] || [];
      if (records.length > 0) {
        await (db as any)[tableName].bulkPut(records);
        counts[tableName] = records.length;
      }
    }
  });

  return { success: true, counts };
}
```

### 3.3. UI

**Export:**
- Button "Xuất dữ liệu (JSON)" → trigger download
- Hiện toast "Đã tải file workout-backup-YYYY-MM-DD.json"

**Import:**
- Button "Nhập dữ liệu" → mở file picker (`<input type="file" accept=".json">`)
- Hiện modal: "Bạn muốn thay thế hay gộp data?"
  - **Replace**: Xoá tất cả, thay bằng file
  - **Merge**: Giữ data hiện tại, gộp thêm (theo ID, ghi đè nếu trùng)
- Confirm 2 lần (đặc biệt là replace)
- Hiện kết quả: "Đã import N exercises, M sessions, ..."

### 3.4. Backup reminder

- Mỗi lần mở app, check `settings.last_backup_at`
- Nếu > 30 ngày → hiện banner "💾 Đã 30 ngày chưa backup, xuất dữ liệu ngay?"
- Có thể dismiss tạm (nhớ trong session)

---

## 4. Reset & Xoá

### 4.1. Reset thư viện bài tập

- Button "Reset thư viện về mặc định"
- Confirm: "Sẽ xoá tất cả bài tập custom + reset bài seed về gốc. Vòng tập và session KHÔNG bị ảnh hưởng. Tiếp tục?"
- Logic: `db.exercises.clear()` → load lại seed

### 4.2. Xoá tất cả dữ liệu

- Button "Xoá toàn bộ dữ liệu" (màu đỏ)
- Confirm 2 lần:
  - Lần 1: "Sẽ xoá TẤT CẢ dữ liệu: bài tập, vòng tập, session, cân nặng, activity. Không khôi phục được. Tiếp tục?"
  - Lần 2: gõ chữ "XOA TAT CA" để confirm
- Logic:
  ```typescript
  for (const table of db.tables) {
    await table.clear();
  }
  // Sau đó seed lại exercises + default settings
  await seedIfEmpty();
  ```

---

## 5. Thông tin app

Hiển thị:
- Phiên bản (lấy từ `package.json` qua Vite import)
- Số bài tập trong library
- Tổng số session đã tập
- Tổng thời gian tập (giờ)
- Tổng volume đã nâng (kg)
- Link "Source code" (nếu có)
- Link "Báo lỗi" (vd github issue)

```typescript
async function getAppStats() {
  return {
    version: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
    totalExercises: await db.exercises.count(),
    totalSessions: await db.sessions.count(),
    totalDurationHours: await (async () => {
      const sessions = await db.sessions.toArray();
      const total = sessions.reduce((sum, s) => sum + (s.total_duration_seconds ?? 0), 0);
      return Math.round(total / 3600);
    })(),
    totalVolumeKg: await calcLifetimeVolume(),
  };
}
```

---

## 6. PWA Install Prompt

Khi user truy cập lần đầu trên Chrome/Edge, hiện banner gợi ý cài app:

```typescript
// src/components/InstallPrompt.tsx
useEffect(() => {
  const handler = (e: any) => {
    e.preventDefault();
    setDeferredPrompt(e);
    setShowPrompt(true);
  };

  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []);

async function install() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') setShowPrompt(false);
}
```

iOS Safari: không có `beforeinstallprompt`, hiện hướng dẫn manual: "Bấm nút Chia sẻ → Thêm vào màn hình chính".

---

## 7. Acceptance Criteria

- [ ] Toggle theme (light/dark/system) hoạt động, persist sau reload
- [ ] Cài đặt timer mặc định + thời gian nghỉ persist
- [ ] Toggle haptic on/off persist
- [ ] Export JSON tải về file đúng format
- [ ] Import JSON với 2 mode (replace/merge) hoạt động
- [ ] Backup reminder hiển thị đúng (test bằng cách đặt `last_backup_at` cũ)
- [ ] Reset library: xoá custom + reload seed
- [ ] Xoá tất cả: 2 layer confirm, xoá xong app vẫn chạy được
- [ ] Stats hiển thị đúng số
- [ ] Install prompt hoạt động trên Chrome desktop + Android

---

*Đây là file cuối cùng. Sau khi xong hết, kiểm tra checklist phase trong `00_README.md` để đảm bảo MVP hoàn chỉnh.*
