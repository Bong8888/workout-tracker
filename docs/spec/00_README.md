# 00 — README & Overview

> **File này LUÔN được đưa cho AI trước.** Định hướng tổng thể, navigation, user journeys, cross-cutting rules.

---

## 1. Mục tiêu ứng dụng

PWA cá nhân để:
- Quản lý thư viện bài tập theo nhóm cơ
- Tạo "vòng tập" linh hoạt (không cố định 7 ngày)
- Ghi buổi tập với timer, set, rep, tạ
- Ghi hoạt động thể chất ngoài lịch
- Theo dõi cân nặng + biểu đồ tiến bộ
- **1 người dùng cá nhân**, không auth, offline-first

---

## 2. Cách dùng bộ file spec này

Bộ spec gồm 8 file. Khi prompt AI, **luôn kèm file `00_README.md` này** + file module đang code.

| File | Khi nào dùng |
|---|---|
| `00_README.md` | LUÔN kèm theo mọi prompt |
| `01_System_Architecture.md` | Khi setup project ban đầu |
| `02_Database_Schema.md` | LUÔN kèm với mọi prompt code logic |
| `03_Exercise_Library_Module.md` | Khi build module library |
| `04_Training_Cycle_Logic.md` | Khi build module vòng tập |
| `05_Workout_Session_Engine.md` | Khi build session mode |
| `06_Metrics_Analytics.md` | Khi build thống kê + body metric + activity log |
| `07_Settings_Utility.md` | Khi build settings + export/import |

**Quy tắc:** Mỗi prompt KHÔNG nên dài quá 3 file ghép lại. Nếu cần code nhiều module, chia nhiều prompt.

---

## 3. Thứ tự code đề xuất (Phase MVP)

### Phase 1 — Foundation
- [ ] Setup project + PWA config + Service Worker (file 01)
- [ ] IndexedDB schema với Dexie (file 02)
- [ ] Navigation skeleton (5 tab — xem mục 5 bên dưới)

### Phase 2 — Static modules
- [ ] Exercise Library: seed data + CRUD (file 03)
- [ ] Body Metrics CRUD (file 06)
- [ ] Activity Log CRUD (file 06)
- [ ] Settings page (file 07)

### Phase 3 — Core logic
- [ ] Training Cycle: tạo / sửa / xoá vòng tập (file 04)
- [ ] Logic tính "hôm nay là ngày nào trong vòng" (file 04)

### Phase 4 — Session Engine (phần khó nhất)
- [ ] UI session mode (file 05)
- [ ] 2 timer (đếm lên / đếm ngược) (file 05)
- [ ] Logic bodyweight snapshot (file 05)
- [ ] Wake lock + haptic feedback (file 05)

### Phase 5 — Analytics
- [ ] Charts với Recharts (file 06)
- [ ] 1RM Epley formula + Volume calc (file 06)

### Phase 6 — Polish
- [ ] Dark mode (file 07)
- [ ] Export / Import JSON (file 07)
- [ ] Popup confirm trước khi lưu (cross-cutting)

---

## 4. User Journeys chính

### Journey 1 — Setup lần đầu
Mở app → seed data tự load → vào "Tôi" nhập cân nặng → vào "Lịch tập" tạo vòng tập đầu tiên → set active.

### Journey 2 — Tập 1 buổi theo lịch
Tab "Hôm nay" → app hiện gợi ý "Push Day" → bấm "Xem chi tiết" → review bài + target → bấm "Bắt đầu" → timer tổng chạy → vào bài 1 → nhập set 1 (tạ + rep) → "Hoàn thành set" → timer nghỉ chạy → lặp tới hết set → "Hoàn thành bài" → bài tiếp theo → xong hết → "Kết thúc buổi tập" → summary → lưu.

### Journey 3 — Ghi hoạt động sáng (vd hít đất + nhảy dây)
**Option A:** Quick log Activity → loại "Bodyweight tại nhà", thời gian 30 phút, ghi chú.
**Option B:** Tạo session ad-hoc → chọn bài từ library → ghi set chi tiết.

### Journey 4 — Buổi tối tập tạ (sau khi sáng đã có activity)
Tab "Hôm nay" → thấy activity sáng + gợi ý buổi tối → bắt đầu session theo Journey 2.

### Journey 5 — Xem tiến bộ
Tab "Thống kê" → chọn bài → biểu đồ tạ theo thời gian. Hoặc chọn vòng tập đã hoàn thành → volume theo nhóm cơ.

---

## 5. Navigation Structure

**Bottom nav 5 tab:**

| Tab | Tên | Nội dung |
|---|---|---|
| 1 | **Hôm nay** | Gợi ý buổi tập hôm nay, quick log activity, today summary |
| 2 | **Lịch tập** | Quản lý vòng tập + bài tập trong từng ngày của vòng |
| 3 | **Thư viện** | Quản lý exercise library |
| 4 | **Thống kê** | Biểu đồ tạ, volume, cân nặng, thời gian tập |
| 5 | **Tôi** | Cân nặng, settings, export/import, info |

**Mobile-first**: layout tối ưu cho điện thoại (375-414px width). Desktop responsive.

---

## 6. Cross-cutting rules (LUÔN áp dụng)

1. **Offline-first**: KHÔNG gọi API cho data chính. Tất cả CRUD chạy trên IndexedDB.
2. **Đơn vị**: kg, giây, phút, mét. KHÔNG hỗ trợ imperial/lbs trong MVP.
3. **ID**: dùng `crypto.randomUUID()` cho mọi entity.
4. **Timestamp**: lưu ISO 8601 string, dùng `date-fns` hoặc `dayjs`.
5. **Input số**: luôn `inputmode="decimal"`, validate số dương.
6. **Bodyweight snapshot**: khi lưu set bodyweight, PHẢI snapshot bodyweight tại thời điểm đó (không reference) để biểu đồ lịch sử không bị thay đổi khi user cập nhật cân mới.
7. **Popup confirm**: trước khi LƯU vòng tập / xoá entity → hiển thị popup review.
8. **Không tracking, không analytics, không API external** (trừ seed data lần đầu).
9. **Dark mode**: hỗ trợ ngay từ đầu, mặc định theo system preference.
10. **Backup**: hiện banner nhắc export JSON mỗi 30 ngày.

---

## 7. Quy ước code

- **Ngôn ngữ**: TypeScript
- **Framework**: React 18 + Vite
- **State**: React Context + `useReducer` cho global state, `useState` local. KHÔNG Redux.
- **Folder structure**: feature-based, không phải type-based
  ```
  src/
    features/
      exercises/
      cycles/
      sessions/
      metrics/
      activities/
      settings/
    components/        (shared UI)
    db/                (Dexie setup)
    utils/             (date, math, validators)
    hooks/             (shared hooks)
    pages/             (route components)
  ```
- **Naming**:
  - Components: PascalCase
  - Hooks: `useXxx`
  - Functions: camelCase
  - Files: kebab-case hoặc PascalCase cho component
- **Styling**: Tailwind CSS, không CSS riêng trừ khi bắt buộc

---

## 8. Câu lệnh prompt mẫu cho Gemini/Antigravity

**Khi setup ban đầu:**
> Đây là spec đầy đủ cho app workout tracker. File `00_README.md` là overview, `01_System_Architecture.md` là tech stack. Hãy khởi tạo project React + Vite + Tailwind + Dexie + PWA config theo spec. Sau khi xong base, dừng lại và đợi tôi tiếp tục.

**Khi code 1 module:**
> Context: file `00_README.md` (đã đính kèm). Module cần code: theo file `0X_xxx.md` (đính kèm). Hãy implement đầy đủ module này, theo đúng data schema trong `02_Database_Schema.md` (đính kèm).

**Khi gặp bug:**
> Đây là cross-cutting rule trong `00_README.md` (đính kèm). Code hiện tại đang vi phạm rule số X. Hãy sửa.

---

*Đọc xong file này, sang `01_System_Architecture.md` để bắt đầu setup.*
