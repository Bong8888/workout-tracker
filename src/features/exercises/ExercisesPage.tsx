import { BookOpen } from 'lucide-react';

export default function ExercisesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
      <div className="p-4 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full mb-4">
        <BookOpen className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Thư viện</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm">
        Trang tra cứu, thêm mới và quản lý thư viện các bài tập theo nhóm cơ.
      </p>
    </div>
  );
}
