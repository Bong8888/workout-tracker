import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import BottomNav from './components/BottomNav';
import TodayPage from './features/today/TodayPage';
import CyclesPage from './features/cycles/CyclesPage';
import CycleDetailPage from './features/cycles/CycleDetailPage';
import CycleForm from './features/cycles/CycleForm';
import ExercisesPage from './features/exercises/ExercisesPage';
import ExerciseDetailPage from './features/exercises/ExerciseDetailPage';
import ExerciseForm from './features/exercises/ExerciseForm';
import StatsPage from './features/stats/StatsPage';
import MePage from './features/me/MePage';
import SessionPage from './features/session/SessionPage';
import SessionSummary from './features/session/SessionSummary';
import { seedIfEmpty } from './db/seed';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

function App() {
  const settings = useLiveQuery(() => db.settings.get('singleton'));

  useEffect(() => {
    // Seed default database settings if empty
    seedIfEmpty().catch(console.error);
  }, []);

  useEffect(() => {
    if (!settings) return;

    const applyTheme = (theme: 'light' | 'dark' | 'system') => {
      const root = document.documentElement;
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    };

    applyTheme(settings.theme);

    // Sync system changes if using 'system' theme
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings]);

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
        {/* Main viewport - Mobile-first layout container */}
        <main className="flex-1 w-full max-w-md mx-auto bg-white dark:bg-slate-900 border-x border-slate-200 dark:border-slate-800 shadow-sm pb-20">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/cycles" element={<CyclesPage />} />
            <Route path="/cycles/new" element={<CycleForm />} />
            <Route path="/cycles/:id" element={<CycleDetailPage />} />
            <Route path="/cycles/:id/edit" element={<CycleForm />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/exercises/new" element={<ExerciseForm />} />
            <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
            <Route path="/exercises/:id/edit" element={<ExerciseForm />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/session/new" element={<SessionPage />} />
            <Route path="/session/:id" element={<SessionPage />} />
            <Route path="/session/:id/summary" element={<SessionSummary />} />
          </Routes>
        </main>
        
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
