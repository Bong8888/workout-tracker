import { Dumbbell, Trash2, Database } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';

export default function TodayPage() {
  // Fetch all body metrics ordered by date descending
  const bodyMetrics = useLiveQuery(() => 
    db.bodyMetrics.orderBy('date').reverse().toArray()
  );

  const handleTestDB = async () => {
    // Generate a random weight between 50 and 100 kg with 1 decimal place
    const randomWeight = Math.round((50 + Math.random() * 50) * 10) / 10;
    
    // Generate today's date formatted as YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    const newMetric = {
      id: crypto.randomUUID(),
      date: todayStr,
      weight_kg: randomWeight,
      notes: `Test weight added at ${new Date().toLocaleTimeString()}`
    };

    await db.bodyMetrics.add(newMetric);
  };

  const handleDeleteMetric = async (id: string) => {
    await db.bodyMetrics.delete(id);
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-[80vh]">
      <div className="flex flex-col items-center justify-center text-center mt-8 mb-6 animate-fade-in">
        <div className="p-4 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full mb-4 animate-bounce">
          <Dumbbell className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Hôm nay</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
          Trang theo dõi buổi tập của bạn hôm nay và nhật ký hoạt động thể chất.
        </p>
      </div>

      {/* Database Verification Tool Card */}
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
          <Database className="w-5 h-5 text-indigo-500" />
          <span>Kiểm thử Cơ sở dữ liệu (Phase 2)</span>
        </div>

        <button
          onClick={handleTestDB}
          className="w-full bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 mb-4 flex items-center justify-center gap-2"
        >
          <span>Thêm Body Metric Ngẫu Nhiên</span>
        </button>

        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
          Danh sách Body Metrics ({bodyMetrics?.length ?? 0}):
        </h3>

        {bodyMetrics && bodyMetrics.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {bodyMetrics.map((metric) => (
              <div 
                key={metric.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-850"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {metric.weight_kg} kg
                  </span>
                  <span className="text-xs text-slate-400">
                    {metric.date} — {metric.notes?.split(' at ')[1]}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteMetric(metric.id)}
                  className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Xóa bản ghi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            Chưa có dữ liệu. Bấm nút phía trên để thêm test data.
          </p>
        )}
      </div>
    </div>
  );
}
