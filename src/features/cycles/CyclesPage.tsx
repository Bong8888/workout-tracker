import { Repeat } from 'lucide-react';

export default function CyclesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
      <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full mb-4 animate-spin-slow">
        <Repeat className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Lịch tập</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm">
        Trang thiết lập và quản lý các vòng tập (cycles) linh hoạt của bạn.
      </p>
    </div>
  );
}
