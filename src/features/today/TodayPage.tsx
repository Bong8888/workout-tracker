import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Calendar, Coffee, Play, PlusCircle, Sparkles, Activity, CheckCircle2, Heart, Clock, Trash2, X } from 'lucide-react';
import { useTodayCycleDay } from '../cycles/api';
import { useActiveSessionLive } from '../session/api';
import { useTodayActivitiesLive, createActivity, deleteActivity } from '../activities/api';

export default function TodayPage() {
  const navigate = useNavigate();
  const todayInfo = useTodayCycleDay();
  const activeSession = useActiveSessionLive();

  // Current Date string formatted YYYY-MM-DD local time
  const todayStr = new Date().toLocaleDateString('sv-SE'); // returns YYYY-MM-DD
  const activities = useTodayActivitiesLive(todayStr);

  // Modal States
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState('Đi bộ');
  const [customActivityType, setCustomActivityType] = useState('');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const PRESETS = [
    'Đi bộ',
    'Chạy bộ',
    'Đạp xe',
    'Bơi',
    'Yoga',
    'Stretching',
    'Bodyweight tại nhà',
    'Cardio',
    'Thể thao',
    'Khác'
  ];

  const handleOpenModal = () => {
    setActivityType('Đi bộ');
    setCustomActivityType('');
    setDuration('30');
    setNotes('');
    setError('');
    setShowActivityModal(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = activityType === 'Khác' ? customActivityType.trim() : activityType;
    const durVal = parseInt(duration);

    if (!finalType) {
      setError('Vui lòng nhập tên hoạt động.');
      return;
    }

    if (isNaN(durVal) || durVal <= 0) {
      setError('Thời gian hoạt động phải lớn hơn 0 phút.');
      return;
    }

    try {
      await createActivity({
        date: todayStr,
        activity_type: finalType,
        duration_minutes: durVal,
        notes: notes.trim() || undefined,
      });

      setShowActivityModal(false);
      setToast('Đã lưu hoạt động tự do thành công!');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi lưu hoạt động.');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hoạt động này?')) {
      await deleteActivity(id);
    }
  };

  // 1. STATE A: No Active Cycle
  if (!todayInfo) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-medium text-xs">
            <CheckCircle2 className="w-5 h-5" />
            <span>{toast}</span>
          </div>
        )}

        {/* Modal */}
        {showActivityModal && (
          <ActivityModal 
            presets={PRESETS}
            activityType={activityType}
            setActivityType={setActivityType}
            customActivityType={customActivityType}
            setCustomActivityType={setCustomActivityType}
            duration={duration}
            setDuration={setDuration}
            notes={notes}
            setNotes={setNotes}
            error={error}
            onClose={() => setShowActivityModal(false)}
            onSave={handleSaveActivity}
          />
        )}

        <div className="flex flex-col items-center justify-center p-6 text-center pt-10">
          <div className="p-4 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full mb-4 shadow-sm">
            {activeSession ? (
              <Play className="w-12 h-12 text-emerald-500 fill-emerald-500/20" />
            ) : (
              <Calendar className="w-12 h-12" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            {activeSession ? 'Buổi tập đang diễn ra' : 'Chưa có lịch tập kích hoạt'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6 text-sm">
            {activeSession
              ? 'Bạn đang có một buổi tập tự do chưa hoàn thành. Hãy tiếp tục tập luyện để ghi chép kết quả.'
              : 'Để bắt đầu ghi chép các buổi tập, hãy tạo lịch tập (vòng tập) mới hoặc kích hoạt lịch tập hiện có của bạn.'}
          </p>
          <div className="flex flex-col w-full gap-2 px-6">
            {activeSession ? (
              <button
                onClick={() => navigate(`/session/${activeSession.id}`)}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-98 text-sm"
              >
                Tiếp tục buổi tập
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Free Activities Logs Section */}
        <ActivitiesSection 
          activities={activities}
          onAddClick={handleOpenModal}
          onDeleteClick={handleDeleteActivity}
        />
      </div>
    );
  }

  const { cycle, day, exercises } = todayInfo;

  // 2. STATE B: Rest Day
  if (day.day_type === 'rest') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-medium text-xs">
            <CheckCircle2 className="w-5 h-5" />
            <span>{toast}</span>
          </div>
        )}

        {/* Modal */}
        {showActivityModal && (
          <ActivityModal 
            presets={PRESETS}
            activityType={activityType}
            setActivityType={setActivityType}
            customActivityType={customActivityType}
            setCustomActivityType={setCustomActivityType}
            duration={duration}
            setDuration={setDuration}
            notes={notes}
            setNotes={setNotes}
            error={error}
            onClose={() => setShowActivityModal(false)}
            onSave={handleSaveActivity}
          />
        )}

        <div className="p-4 flex flex-col justify-center pt-8">
          <div className="text-center max-w-sm mx-auto space-y-4">
            <div className="p-4 bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 rounded-full inline-block shadow-inner">
              {activeSession ? (
                <Play className="w-12 h-12 text-emerald-500 fill-emerald-500/20" />
              ) : (
                <Coffee className="w-12 h-12" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {activeSession ? 'Buổi tập đang diễn ra!' : 'Hôm nay là Ngày Nghỉ!'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              {activeSession
                ? `Bạn đang tập luyện buổi tập tự do trong ngày nghỉ.`
                : `Hôm nay là ${day.name} trong vòng tập **${cycle.name}**. Hãy nghỉ ngơi đầy đủ để phục hồi cơ bắp!`}
            </p>
            
            {activeSession ? (
              <button
                onClick={() => navigate(`/session/${activeSession.id}`)}
                className="w-full bg-gradient-to-r from-emerald-650 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-98 text-sm"
              >
                Tiếp tục buổi tập
              </button>
            ) : (
              <>
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

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate('/session/new')}
                    className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Bắt đầu buổi tập tự do</span>
                  </button>
                  <button
                    onClick={handleOpenModal}
                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Activity className="w-4 h-4 text-teal-500" />
                    <span>Ghi nhận hoạt động nghỉ ngơi</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Free Activities Logs Section */}
        <ActivitiesSection 
          activities={activities}
          onAddClick={handleOpenModal}
          onDeleteClick={handleDeleteActivity}
        />
      </div>
    );
  }

  // 3. STATE C: Workout Day (not started or active)
  return (
    <div className="p-4 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-medium text-xs">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Modal */}
      {showActivityModal && (
        <ActivityModal 
          presets={PRESETS}
          activityType={activityType}
          setActivityType={setActivityType}
          customActivityType={customActivityType}
          setCustomActivityType={setCustomActivityType}
          duration={duration}
          setDuration={setDuration}
          notes={notes}
          setNotes={setNotes}
          error={error}
          onClose={() => setShowActivityModal(false)}
          onSave={handleSaveActivity}
        />
      )}

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
      <div className="space-y-3">
        <h3 className="font-bold text-slate-750 dark:text-slate-200 text-sm px-1 flex items-center gap-1.5">
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
              className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-3 cursor-pointer hover:border-primary-400 transition-colors animate-fade-in"
            >
              <span className="text-xs font-black text-slate-350 dark:text-slate-650 w-5 text-center">
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

      {/* Free Activities Logs Section */}
      <ActivitiesSection 
        activities={activities}
        onAddClick={handleOpenModal}
        onDeleteClick={handleDeleteActivity}
      />

      {/* Floating Action CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-40 p-4 bg-gradient-to-t from-white dark:from-slate-900 to-transparent">
        <div className="max-w-md mx-auto">
          {activeSession ? (
            <button
              onClick={() => navigate(`/session/${activeSession.id}`)}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 text-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Tiếp tục buổi tập</span>
            </button>
          ) : (
            <button
              onClick={() => navigate(`/session/new?cycleDayId=${day.id}`)}
              className="w-full bg-gradient-to-r from-primary-600 to-indigo-650 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 text-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Bắt đầu tập luyện</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Today's Activities Section
function ActivitiesSection({
  activities,
  onAddClick,
  onDeleteClick
}: {
  activities: any[];
  onAddClick: () => void;
  onDeleteClick: (id: string) => void;
}) {
  return (
    <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 mb-2">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-slate-750 dark:text-slate-150 text-sm flex items-center gap-1.5">
          <Activity className="w-4.5 h-4.5 text-teal-500" />
          <span>Hoạt động tự do hôm nay</span>
        </h3>
        <button
          onClick={onAddClick}
          className="text-primary-650 dark:text-primary-400 text-xs font-bold flex items-center gap-1 hover:underline"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Thêm hoạt động</span>
        </button>
      </div>

      {activities && activities.length > 0 ? (
        <div className="space-y-2">
          {activities.map((act) => (
            <div 
              key={act.id}
              className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl flex items-center justify-between text-xs font-semibold animate-fade-in"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 rounded-lg">
                  <Heart className="w-4 h-4 fill-teal-500/25" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-850 dark:text-slate-200">{act.activity_type}</h4>
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{act.duration_minutes} phút {act.notes ? `• ${act.notes}` : ''}</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDeleteClick(act.id)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic text-center py-4 border border-dashed rounded-2xl dark:border-slate-800">
          Chưa ghi nhận hoạt động tự do nào hôm nay.
        </p>
      )}
    </div>
  );
}

// Subcomponent: Activity Modal Dialog
function ActivityModal({
  presets,
  activityType,
  setActivityType,
  customActivityType,
  setCustomActivityType,
  duration,
  setDuration,
  notes,
  setNotes,
  error,
  onClose,
  onSave
}: {
  presets: string[];
  activityType: string;
  setActivityType: (val: string) => void;
  customActivityType: string;
  setCustomActivityType: (val: string) => void;
  duration: string;
  setDuration: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  error: string;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-xl border dark:border-slate-700 animate-scale-up">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="font-bold text-slate-850 dark:text-white text-base flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-teal-500" />
            <span>Thêm hoạt động tự do</span>
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-650 p-1"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={onSave} className="space-y-3.5 text-xs font-semibold text-slate-700 dark:text-slate-350">
          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Loại hoạt động</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white"
            >
              {presets.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {activityType === 'Khác' && (
            <div className="animate-fade-in">
              <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Nhập hoạt động tùy chỉnh</label>
              <input
                type="text"
                value={customActivityType}
                onChange={(e) => setCustomActivityType(e.target.value)}
                placeholder="vd: Nhảy dây, Boxing..."
                className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Thời gian thực hiện (phút)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={1}
              className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white font-bold text-center text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Ghi chú chi tiết</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="vd: Tập 3 hiệp 30 hít đất..."
              className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors mt-3"
          >
            Lưu hoạt động
          </button>
        </form>
      </div>
    </div>
  );
}
