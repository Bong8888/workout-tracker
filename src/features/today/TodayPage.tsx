import { useNavigate } from 'react-router-dom';
import { Dumbbell, Calendar, Coffee, Play, PlusCircle, Sparkles, Activity, CheckCircle2 } from 'lucide-react';
import { useTodayCycleDay } from '../cycles/api';

export default function TodayPage() {
  const navigate = useNavigate();
  const todayInfo = useTodayCycleDay();

  // 1. STATE A: No Active Cycle
  if (!todayInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] p-6 text-center animate-fade-in">
        <div className="p-4 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full mb-4 shadow-sm">
          <Calendar className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Chưa có lịch tập kích hoạt</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6 text-sm">
          Để bắt đầu ghi chép các buổi tập, hãy tạo lịch tập (vòng tập) mới hoặc kích hoạt lịch tập hiện có của bạn.
        </p>
        <div className="flex flex-col w-full gap-2 px-6">
          <button
            onClick={() => navigate('/cycles/new')}
            className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-98 text-sm"
          >
            Tạo vòng tập đầu tiên
          </button>
          <button
            onClick={() => navigate('/cycles')}
            className="w-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 font-bold py-2.5 rounded-xl text-xs transition-colors"
          >
            Xem danh sách lịch tập
          </button>
        </div>
      </div>
    );
  }

  const { cycle, day, exercises } = todayInfo;

  // 2. STATE B: Rest Day
  if (day.day_type === 'rest') {
    return (
      <div className="p-4 flex flex-col min-h-[75vh] animate-fade-in justify-center">
        <div className="text-center max-w-sm mx-auto space-y-4">
          <div className="p-4 bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 rounded-full inline-block shadow-inner">
            <Coffee className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Hôm nay là Ngày Nghỉ!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Hôm nay là <span className="font-semibold text-slate-700 dark:text-slate-300">{day.name}</span> trong vòng tập **{cycle.name}**. Hãy nghỉ ngơi đầy đủ để phục hồi cơ bắp!
          </p>
          
          <div className="border border-dashed border-slate-200 dark:border-slate-800 p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-sm text-left">
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-500" />
              <span>Gợi ý cho bạn:</span>
            </h4>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-4 leading-relaxed">
              <li>Đi bộ nhẹ nhàng hoặc giãn cơ tích cực</li>
              <li>Uống đủ nước và ngủ đủ giấc</li>
              <li>Nạp đủ protein phục hồi cơ bắp</li>
            </ul>
          </div>

          <button
            onClick={() => alert('Chức năng ghi chép hoạt động tự do ngoài lịch tập sẽ được tích hợp ở Phase 6.')}
            className="w-full max-w-xs mx-auto bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ghi nhận hoạt động tự do</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. STATE C: Workout Day (not started)
  return (
    <div className="p-4 flex flex-col min-h-screen animate-fade-in">
      {/* Today Suggestion Card */}
      <div className="bg-gradient-to-r from-primary-650 to-indigo-650 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden mb-6 mt-2">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <Dumbbell className="w-32 h-32" />
        </div>
        
        <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
          Gợi ý hôm nay
        </span>

        <h1 className="text-2xl font-black mt-3 leading-tight">
          {day.name}
        </h1>
        
        <p className="text-white/80 text-xs mt-1.5 font-medium">
          Vòng tập: {cycle.name} (Ngày {day.day_order} / {cycle.name.includes('PPL') ? '6' : 'chờ'})
        </p>

        <div className="border-t border-white/20 mt-4 pt-3 flex justify-between items-center text-xs font-semibold">
          <span>{exercises.length} Bài tập mục tiêu</span>
          <span className="text-yellow-300 flex items-center gap-0.5">
            <Sparkles className="w-3.5 h-3.5 fill-yellow-300" />
            <span>Sẵn sàng</span>
          </span>
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-3 flex-1 pb-24">
        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm px-1 flex items-center gap-1.5">
          <CheckCircle2 className="w-4.5 h-4.5 text-primary-500" />
          <span>Danh sách bài tập hôm nay:</span>
        </h3>

        {exercises.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-400 italic mb-2">Không có bài tập nào được thiết lập cho ngày này.</p>
            <button
              onClick={() => navigate(`/cycles/${cycle.id}/edit`)}
              className="text-xs text-primary-500 font-bold hover:underline"
            >
              Chỉnh sửa cấu hình ngày tập
            </button>
          </div>
        ) : (
          exercises.map((e, idx) => (
            <div
              key={e.id}
              onClick={() => navigate(`/exercises/${e.exercise_id}`)}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-3 cursor-pointer hover:border-primary-400 transition-colors"
            >
              <span className="text-xs font-black text-slate-300 dark:text-slate-700 w-5 text-center">
                {idx + 1}
              </span>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-150 truncate">
                  {e.exercise.name}
                </h4>
                {e.exercise.name_vi && (
                  <span className="text-[10px] text-slate-400 truncate block">
                    {e.exercise.name_vi}
                  </span>
                )}
                
                {/* Targets text */}
                <span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold mt-1.5 block">
                  Target: {e.target_sets} sets ×{' '}
                  {e.exercise.measurement_type === 'reps' ? `${e.target_reps} reps` : `${e.target_time_seconds}s`}
                  {e.exercise.is_bodyweight 
                    ? e.target_added_weight ? ` @ +${e.target_added_weight}kg` : ' @ Bodyweight'
                    : ` @ ${e.target_weight}kg`
                  }
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-40 p-4 bg-gradient-to-t from-white dark:from-slate-900 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => alert('Giao diện bắt đầu tập luyện chi tiết (Timer, Wake Lock, Sets entry) sẽ được tích hợp đầy đủ ở Phase 5.')}
            className="w-full bg-gradient-to-r from-primary-600 to-indigo-650 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 text-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Bắt đầu tập luyện</span>
          </button>
        </div>
      </div>
    </div>
  );
}
