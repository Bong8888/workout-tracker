# 01 — System Architecture

> **Phụ thuộc:** Đọc `00_README.md` trước.
> **Mục tiêu:** AI khởi tạo project, cấu hình PWA, thiết lập môi trường offline-first.

---

## 1. Tech Stack

| Lớp | Công nghệ | Lý do |
|---|---|---|
| Build tool | **Vite** | Nhanh, hỗ trợ PWA plugin tốt |
| Framework | **React 18** + **TypeScript** | Ecosystem mạnh, type safety |
| Styling | **Tailwind CSS** | Utility-first, mobile-first dễ |
| Database | **Dexie.js** (wrapper IndexedDB) | API gọn, hỗ trợ TypeScript, query phức tạp |
| Charts | **Recharts** | React-native, dễ dùng cho line/bar |
| Routing | **React Router** v6 | Standard cho SPA |
| Date | **date-fns** | Tree-shakable, không bloated như moment |
| Icons | **Lucide React** | Đẹp, gọn |
| PWA | **vite-plugin-pwa** (Workbox) | Tự generate service worker |

**KHÔNG dùng** (overkill cho MVP cá nhân):
- Redux / Zustand → dùng Context API
- Backend / API → offline-first, IndexedDB only
- Authentication → 1 user duy nhất
- Server-side rendering

---

## 2. Setup Commands

```bash
# Khởi tạo project
npm create vite@latest workout-tracker -- --template react-ts
cd workout-tracker

# Dependencies chính
npm install dexie dexie-react-hooks
npm install react-router-dom
npm install date-fns
npm install recharts
npm install lucide-react

# PWA
npm install -D vite-plugin-pwa workbox-window

# Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 3. PWA Configuration

### 3.1. `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Workout Tracker',
        short_name: 'Workout',
        description: 'Personal workout tracking PWA',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Cache mọi static asset
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Offline first cho navigation
        navigateFallback: '/index.html'
      }
    })
  ]
})
```

### 3.2. Service Worker Strategy

- **App shell**: cache toàn bộ JS/CSS/HTML khi install (precache)
- **Data**: KHÔNG cache qua SW, vì data ở IndexedDB rồi (đã offline native)
- **Update flow**: auto-update, hiển thị toast "Có bản mới, refresh để cập nhật"

### 3.3. Manifest icons

User cần tự tạo các icon `pwa-192x192.png`, `pwa-512x512.png` đặt vào `public/`. Có thể dùng [maskable.app](https://maskable.app/) hoặc generator online.

---

## 4. Offline-First Strategy

**Nguyên tắc:**
1. Mọi CRUD đều ghi thẳng vào IndexedDB
2. UI re-render ngay khi data thay đổi (dùng `useLiveQuery` của Dexie)
3. KHÔNG có loading state cho data local (instant)
4. KHÔNG có "saving..." indicator (write IndexedDB là sync về mặt UX)

**Network usage trong app:**
- Lần đầu mở app: tải seed data exercises (nếu không bundle inline)
- Update PWA: tải bản mới qua service worker
- KHÔNG có gì khác

**Trường hợp bundle seed inline** (khuyên dùng):
- Đưa exercises.json vào `src/data/exercises.json`
- Import tĩnh khi init DB lần đầu
- Không cần network call

---

## 5. Project Structure

```
workout-tracker/
├── public/
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   └── apple-touch-icon.png
├── src/
│   ├── main.tsx                  # Entry, mount App, register SW
│   ├── App.tsx                   # Router + layout shell
│   ├── index.css                 # Tailwind directives
│   ├── db/
│   │   ├── index.ts              # Dexie instance + schema
│   │   ├── seed.ts               # Seed data loader
│   │   └── types.ts              # TypeScript types cho entities
│   ├── features/
│   │   ├── today/                # Tab "Hôm nay"
│   │   ├── cycles/               # Tab "Lịch tập"
│   │   ├── exercises/            # Tab "Thư viện"
│   │   ├── stats/                # Tab "Thống kê"
│   │   ├── me/                   # Tab "Tôi"
│   │   ├── session/              # Workout session engine (modal/page)
│   │   └── activities/           # Activity log
│   ├── components/
│   │   ├── ui/                   # Button, Modal, Input, ...
│   │   ├── BottomNav.tsx
│   │   └── ConfirmDialog.tsx
│   ├── hooks/
│   │   ├── useTimer.ts
│   │   ├── useWakeLock.ts
│   │   └── useHaptic.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── volume.ts             # Tính volume, 1RM
│   │   └── validators.ts
│   └── data/
│       └── exercises.json        # Seed data
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 6. Tailwind Config

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',  // toggle dark mode bằng class
  theme: {
    extend: {
      colors: {
        // Đặt theme color tuỳ ý, vd:
        primary: { 500: '#3b82f6', 600: '#2563eb' }
      }
    }
  },
  plugins: []
}
```

Trong `index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Mobile safe area */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## 7. Deployment

**Khuyên dùng:**
- **Vercel** (free tier): kết nối GitHub repo → auto deploy
- **Cloudflare Pages**: tương tự, có CDN tốt

**Setup tối thiểu:**
1. Push code lên GitHub
2. Vercel: New Project → Import repo → deploy
3. Mặc định build command: `npm run build`, output: `dist/`

**Cài lên điện thoại:**
- iOS: mở Safari → vào URL → bấm Share → "Add to Home Screen"
- Android: mở Chrome → vào URL → bấm menu → "Install app"

---

## 8. Acceptance Criteria (cho AI)

Sau khi xong Phase 1 - Foundation, app phải:

- [ ] Chạy `npm run dev` không lỗi
- [ ] Mở localhost thấy app shell + 5 tab bottom nav
- [ ] `npm run build` thành công, tạo `dist/` có service worker
- [ ] Lighthouse audit PWA score ≥ 90
- [ ] Tắt mạng + reload → app vẫn load được (offline mode)
- [ ] Manifest hợp lệ (test bằng Chrome DevTools → Application → Manifest)
- [ ] Dark mode toggle hoạt động

---

*Tiếp theo: `02_Database_Schema.md`*
