import { User } from 'lucide-react';

export default function MePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
      <div className="p-4 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full mb-4">
        <User className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Tôi</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm">
        Quản lý hồ sơ cân nặng cơ thể, cấu hình ứng dụng, và xuất/nhập dữ liệu dự phòng.
      </p>
    </div>
  );
}
