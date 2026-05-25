import { BarChart3 } from 'lucide-react';

export default function StatsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
      <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full mb-4">
        <BarChart3 className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Thống kê</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm">
        Xem biểu đồ tiến độ tạ, volume tập luyện, và lịch sử cân nặng cơ thể.
      </p>
    </div>
  );
}
