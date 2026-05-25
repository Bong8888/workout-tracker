import { NavLink, useLocation } from 'react-router-dom';
import { Dumbbell, Repeat, BookOpen, BarChart3, User } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();

  // Hide bottom navigation on form/wizard/session routes to give them full-screen focus
  const hideOnRoutes = [
    /^\/cycles\/new\/?$/,
    /^\/cycles\/[^/]+\/edit\/?$/,
    /^\/exercises\/new\/?$/,
    /^\/exercises\/[^/]+\/edit\/?$/,
    /^\/session/
  ];

  const shouldHide = hideOnRoutes.some(regex => regex.test(location.pathname));
  if (shouldHide) return null;

  const navItems = [
    { to: '/', label: 'Hôm nay', icon: Dumbbell },
    { to: '/cycles', label: 'Lịch tập', icon: Repeat },
    { to: '/exercises', label: 'Thư viện', icon: BookOpen },
    { to: '/stats', label: 'Thống kê', icon: BarChart3 },
    { to: '/me', label: 'Tôi', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-all duration-200
              ${isActive 
                ? 'text-primary-600 dark:text-primary-500 scale-105 font-semibold' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }
            `}
          >
            <Icon className="w-5 h-5 mb-1 transition-transform duration-200" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

