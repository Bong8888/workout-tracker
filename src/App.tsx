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
import { seedIfEmpty } from './db/seed';

function App() {
  useEffect(() => {
    // Seed default database settings if empty
    seedIfEmpty().catch(console.error);

    // Initialize dark mode based on system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Only set from system settings if the user hasn't explicitly set it
      // (For now, we just sync with system preference)
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
          </Routes>
        </main>
        
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
