import { Dumbbell } from 'lucide-react';

export default function TodayPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
      <div className="p-4 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full mb-4 animate-bounce">
        <Dumbbell className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Hôm nay</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm">
        Trang theo dõi buổi tập của bạn hôm nay và nhật ký hoạt động thể chất.
      </p>
    </div>
  );
}
