import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Check, AlertTriangle, Calendar, Star, PlayCircle } from 'lucide-react';
import { useCycle, useCycleDays, useCycleDayExercises, activateCycle, deleteCycle } from './api';
import type { CycleDay } from '../../db/types';
import { groupExercises } from '../../utils/grouping';

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cycle = useCycle(id || '');
  const days = useCycleDays(id || '');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(0); // 0: hidden, 1: first confirm, 2: second confirm (for active)
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [error, setError] = useState('');

  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-slate-400 mb-2" />
        <p className="text-slate-500 dark:text-slate-400">Không tìm thấy thông tin vòng tập.</p>
        <button
          onClick={() => navigate('/cycles')}
          className="mt-4 text-primary-600 dark:text-primary-400 font-semibold hover:underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (cycle.is_active && showDeleteConfirm === 1) {
      // If it is active and it's the first confirm, shift to second confirm
      setShowDeleteConfirm(2);
      return;
    }

    try {
      await deleteCycle(cycle.id);
      setShowDeleteConfirm(0);
      navigate('/cycles');
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi xóa vòng tập.');
      setShowDeleteConfirm(0);
    }
  };

  const handleActivate = async (resetDate: boolean) => {
    try {
      await activateCycle(cycle.id, resetDate);
      setShowActivateModal(false);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi kích hoạt vòng tập.');
      setShowActivateModal(false);
    }
  };

  return (
    <div className="p-4">
      {/* Activate Options Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-up border border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-850 dark:text-white text-base mb-2">Kích hoạt vòng tập</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-5 leading-relaxed">
              Bạn có muốn đặt lại ngày bắt đầu chu kỳ tập luyện này thành **ngày hôm nay** không? Điều này sẽ giúp tính toán gợi ý hôm nay chính xác nhất.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleActivate(true)}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 rounded-xl shadow text-xs transition-colors"
              >
                Đặt ngày bắt đầu là Hôm nay
              </button>
              <button
                onClick={() => handleActivate(false)}
                className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-750 dark:text-slate-200 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                Giữ ngày bắt đầu cũ ({cycle.start_date})
              </button>
              <button
                onClick={() => setShowActivateModal(false)}
                className="w-full border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 py-2 rounded-xl text-xs transition-colors mt-2"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-up border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-red-500 font-semibold mb-3">
              <AlertTriangle className="w-6 h-6" />
              <span className="text-lg">Xác nhận xóa</span>
            </div>

            {showDeleteConfirm === 1 ? (
              <div className="space-y-3">
                <p className="text-slate-600 dark:text-slate-350 text-sm">
                  Bạn có chắc chắn muốn xóa vòng tập **{cycle.name}** không?
                </p>
                {cycle.is_active && (
                  <p className="text-xs text-amber-500 font-bold bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/30 p-2.5 rounded-xl">
                    Cảnh báo: Đây là vòng tập đang HOẠT ĐỘNG (Active).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/20 border border-red-250 dark:border-red-900/30 p-3 rounded-xl leading-relaxed">
                CẢNH BÁO LẦN 2: Bạn đang thực hiện xóa vòng tập đang Active. Điều này sẽ làm mất lịch trình hôm nay. Xác nhận xóa lần cuối?
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(0)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 px-4 rounded-xl bg-red-650 hover:bg-red-700 text-white font-medium shadow-md transition-colors text-sm"
              >
                {showDeleteConfirm === 2 ? 'Tôi chắc chắn, xóa!' : 'Xóa lịch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/cycles')}
            className="p-2 text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border ${
            cycle.is_active
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-750'
          }`}>
            {cycle.is_active ? <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" /> : null}
            <span>{cycle.is_active ? 'Đang Active' : 'Chờ kích hoạt'}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/cycles/${cycle.id}/edit`)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-sm font-semibold"
          >
            <Edit2 className="w-4.5 h-4.5" />
            <span className="hidden sm:inline">Sửa</span>
          </button>
          
          <button
            onClick={() => setShowDeleteConfirm(1)}
            className="p-2 text-slate-650 hover:text-red-650 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-1 text-sm font-semibold"
          >
            <Trash2 className="w-4.5 h-4.5" />
            <span className="hidden sm:inline">Xóa</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Cycle Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">
            {cycle.name}
          </h1>
          {cycle.description && (
            <p className="text-slate-500 dark:text-slate-450 text-sm mt-1">
              {cycle.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-450" />
            <div>
              <span className="text-slate-400 block text-[10px]">Ngày bắt đầu</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{cycle.start_date}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-slate-450" />
            <div>
              <span className="text-slate-400 block text-[10px]">Thời lượng vòng</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{days.length} ngày</span>
            </div>
          </div>
        </div>

        {!cycle.is_active && (
          <button
            onClick={() => setShowActivateModal(true)}
            className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5"
          >
            <Check className="w-4.5 h-4.5" />
            <span>Kích hoạt vòng tập này</span>
          </button>
        )}
      </div>

      {/* Days Schedule list */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm px-1">
          Lịch trình chi tiết ({days.length} ngày)
        </h3>

        {days.map((day, idx) => (
          <DayExerciseList key={day.id} day={day} idx={idx} />
        ))}
      </div>
    </div>
  );
}

// Subcomponent to query and render exercises for a day reactively
function DayExerciseList({ day, idx }: { day: CycleDay; idx: number }) {
  const exercises = useCycleDayExercises(day.id);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-bold text-xs text-slate-800 dark:text-white">
          Day {idx + 1} — {day.name}
        </h4>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
          day.day_type === 'workout'
            ? 'bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 border-primary-100 dark:border-primary-900/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-750'
        }`}>
          {day.day_type === 'workout' ? 'Workout' : 'Rest'}
        </span>
      </div>

      {day.day_type === 'workout' && (
        <div className="space-y-3 pl-1 border-l border-slate-200 dark:border-slate-800 text-xs">
          {exercises.length === 0 ? (
            <p className="text-slate-400 italic text-[11px] pl-2">Chưa chọn bài tập cho ngày này.</p>
          ) : (
            groupExercises(exercises).map((group, gIdx) => {
              if (group.type === 'single') {
                const e = group.exercises[0];
                return (
                  <div key={e.id} className="text-slate-650 dark:text-slate-350 pl-2">
                    <span className="font-bold text-slate-500 mr-1">{gIdx + 1}.</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 mr-2">{e.exercise.name}</span>
                    <span className="text-slate-400">
                      ({e.target_sets} sets ×{' '}
                      {e.exercise.measurement_type === 'reps' ? `${e.target_reps} reps` : `${e.target_time_seconds}s`}
                      {e.exercise.is_bodyweight 
                        ? e.target_added_weight ? ` @ +${e.target_added_weight}kg` : ' @ Bodyweight'
                        : ` @ ${e.target_weight}kg`
                      })
                    </span>
                    {e.notes && <span className="block text-[10px] text-slate-450 italic mt-0.5 pl-4">Ghi chú: {e.notes}</span>}
                  </div>
                );
              } else {
                const groupLabel = group.type === 'superset' ? 'Superset' : group.type === 'triset' ? 'Tri-set' : 'Circuit';
                return (
                  <div key={group.id} className="border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/10 dark:bg-indigo-950/5 p-3 rounded-xl ml-2 space-y-1.5">
                    <div className="flex items-center justify-between border-b dark:border-indigo-950 pb-1">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-750 dark:text-indigo-400">
                        {groupLabel} ({group.exercises.length} bài)
                      </span>
                    </div>
                    <div className="space-y-2 pl-2 border-l border-indigo-200 dark:border-indigo-850">
                      {group.exercises.map((e, eIdx) => (
                        <div key={e.id} className="text-slate-650 dark:text-slate-350">
                          <span className="font-bold text-indigo-500 mr-1 text-[10px]">{String.fromCharCode(65 + eIdx)}.</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 mr-2">{e.exercise.name}</span>
                          <span className="text-slate-400">
                            ({e.target_sets} sets ×{' '}
                            {e.exercise.measurement_type === 'reps' ? `${e.target_reps} reps` : `${e.target_time_seconds}s`}
                            {e.exercise.is_bodyweight 
                              ? e.target_added_weight ? ` @ +${e.target_added_weight}kg` : ' @ Bodyweight'
                              : ` @ ${e.target_weight}kg`
                            })
                          </span>
                          {e.notes && <span className="block text-[10px] text-slate-450 italic mt-0.5 pl-4">Ghi chú: {e.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      )}
    </div>
  );
}
