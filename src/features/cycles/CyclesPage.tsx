import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat, Plus, Star, PlayCircle } from 'lucide-react';
import { useCycles, useCycleDays, activateCycle } from './api';
import { getTodayDayOrder } from '../../utils/cycleDate';
import type { TrainingCycle } from '../../db/types';

export default function CyclesPage() {
  const navigate = useNavigate();
  const cycles = useCycles();

  const [activeModalTarget, setActiveModalTarget] = useState<TrainingCycle | null>(null);
  const [error, setError] = useState('');

  const handleActivateClick = (cycle: TrainingCycle, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent navigating to detail page
    setActiveModalTarget(cycle);
  };

  const handleActivateConfirm = async (resetDate: boolean) => {
    if (!activeModalTarget) return;

    try {
      await activateCycle(activeModalTarget.id, resetDate);
      setActiveModalTarget(null);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi kích hoạt vòng tập.');
      setActiveModalTarget(null);
    }
  };

  return (
    <div className="p-4 flex flex-col min-h-screen">
      {/* Activate Options Modal */}
      {activeModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-up border border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-850 dark:text-white text-base mb-2">Kích hoạt vòng tập</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-5 leading-relaxed">
              Bạn có muốn đặt lại ngày bắt đầu của vòng tập **{activeModalTarget.name}** thành **ngày hôm nay** không?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleActivateConfirm(true)}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 rounded-xl shadow text-xs transition-colors"
              >
                Đặt ngày bắt đầu là Hôm nay
              </button>
              <button
                onClick={() => handleActivateConfirm(false)}
                className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-750 dark:text-slate-200 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                Giữ ngày bắt đầu cũ ({activeModalTarget.start_date})
              </button>
              <button
                onClick={() => setActiveModalTarget(null)}
                className="w-full border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 py-2 rounded-xl text-xs transition-colors mt-2"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5 mt-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Repeat className="w-6 h-6 text-primary-500" />
          <span>Lịch tập</span>
        </h1>
        <button
          onClick={() => navigate('/cycles/new')}
          className="bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl shadow-md flex items-center gap-1.5 transition-all duration-200 active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm vòng tập</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Cycles List */}
      {cycles && cycles.length > 0 ? (
        <div className="space-y-3">
          {cycles.map((cycle) => (
            <CycleCard 
              key={cycle.id} 
              cycle={cycle} 
              onActivateClick={(e) => handleActivateClick(cycle, e)}
              onClick={() => navigate(`/cycles/${cycle.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
          <Repeat className="w-12 h-12 text-slate-350 dark:text-slate-700 mb-2 stroke-1" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Chưa có vòng tập</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
            Hãy tạo vòng tập (cycle) đầu tiên để bắt đầu hành trình ghi chép tiến trình luyện tập của bạn.
          </p>
          <button
            onClick={() => navigate('/cycles/new')}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-colors text-xs"
          >
            Tạo vòng tập đầu tiên
          </button>
        </div>
      )}
    </div>
  );
}

// Subcomponent to query days count and today's day order reactively
function CycleCard({ 
  cycle, 
  onActivateClick, 
  onClick 
}: { 
  cycle: TrainingCycle; 
  onActivateClick: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const days = useCycleDays(cycle.id);
  
  // Calculate today dayOrder
  let todayDayText = '';
  if (cycle.is_active && days.length > 0) {
    const dayOrder = getTodayDayOrder(cycle.start_date, days.length);
    if (dayOrder === -1) {
      todayDayText = 'Chu kỳ chưa bắt đầu (ngày bắt đầu ở tương lai)';
    } else {
      const todayDayObj = days.find(d => d.day_order === dayOrder);
      if (todayDayObj) {
        todayDayText = `Hôm nay: Ngày ${dayOrder} — ${todayDayObj.name} (${
          todayDayObj.day_type === 'workout' ? 'Tập' : 'Nghỉ'
        })`;
      }
    }
  }

  return (
    <div
      onClick={onClick}
      className={`
        p-4 bg-white dark:bg-slate-900 border rounded-2xl cursor-pointer shadow-sm hover:shadow transition-all duration-200
        ${cycle.is_active 
          ? 'border-emerald-450 dark:border-emerald-500/50 bg-emerald-50/10 dark:bg-emerald-950/5' 
          : 'border-slate-150 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }
      `}
    >
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">
            {cycle.name}
          </h3>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Độ dài: {days.length} ngày • Bắt đầu: {cycle.start_date}
          </span>
        </div>

        {cycle.is_active ? (
          <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/30 flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
            <span>Active</span>
          </span>
        ) : (
          <button
            onClick={onActivateClick}
            className="text-[10px] font-bold bg-primary-50 hover:bg-primary-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-primary-650 dark:text-slate-350 px-2.5 py-1 rounded-lg border border-primary-100 dark:border-slate-700 transition-colors"
          >
            Kích hoạt
          </button>
        )}
      </div>

      {cycle.is_active && todayDayText && (
        <div className="flex items-center gap-1.5 border-t dark:border-slate-800/80 pt-2 text-xs font-semibold text-slate-600 dark:text-slate-350">
          <PlayCircle className="w-4 h-4 text-emerald-500" />
          <span>{todayDayText}</span>
        </div>
      )}
    </div>
  );
}
