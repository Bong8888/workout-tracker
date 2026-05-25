import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Play, Info, AlertTriangle, Calendar } from 'lucide-react';
import { useExercise, deleteExercise, getExerciseUsage } from './api';

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Ngực (Chest)',
  back: 'Lưng (Back)',
  legs: 'Chân (Legs)',
  shoulders: 'Vai (Shoulders)',
  arms: 'Tay (Arms)',
  core: 'Cơ bụng/Lõi (Core)',
  cardio: 'Tim mạch (Cardio)',
  full_body: 'Toàn thân (Full Body)',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Tạ đòn (Barbell)',
  dumbbell: 'Tạ đơn (Dumbbell)',
  machine: 'Máy tập (Machine)',
  bodyweight: 'Trọng lượng cơ thể (Bodyweight)',
  cable: 'Dây cáp (Cable)',
  resistance_band: 'Dây kháng lực (Band)',
  kettlebell: 'Tạ bình vôi (Kettlebell)',
  other: 'Khác (Other)',
};

const MEASUREMENT_LABELS: Record<string, string> = {
  reps: 'Đếm số Reps',
  time: 'Theo thời gian (giây)',
  distance: 'Theo khoảng cách (m)',
};

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const exercise = useExercise(id || '');

  const [usage, setUsage] = useState<{ inCycles: number; inSessions: number }>({ inCycles: 0, inSessions: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (id) {
      getExerciseUsage(id).then(setUsage);
    }
  }, [id]);

  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Info className="w-12 h-12 text-slate-400 mb-2" />
        <p className="text-slate-500 dark:text-slate-400">Không tìm thấy thông tin bài tập.</p>
        <button
          onClick={() => navigate('/exercises')}
          className="mt-4 text-primary-600 dark:text-primary-400 font-semibold hover:underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!id) return;
    
    const res = await deleteExercise(id);
    if (res.success) {
      setShowDeleteConfirm(false);
      navigate('/exercises');
    } else {
      setErrorMessage(res.reason || 'Đã xảy ra lỗi khi xóa.');
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="p-4">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-up border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 font-semibold mb-3">
              <AlertTriangle className="w-6 h-6" />
              <span className="text-lg">Xác nhận xóa</span>
            </div>
            
            {usage.inCycles > 0 || usage.inSessions > 0 ? (
              <p className="text-slate-600 dark:text-slate-350 text-sm mb-6 leading-relaxed">
                Bài tập này đang được sử dụng trong{' '}
                <span className="font-semibold text-slate-800 dark:text-white">
                  {usage.inCycles} vòng tập
                </span>{' '}
                và{' '}
                <span className="font-semibold text-slate-800 dark:text-white">
                  {usage.inSessions} buổi tập
                </span>
                . Nếu xóa, dữ liệu lịch sử liên quan sẽ bị ảnh hưởng. Bạn vẫn muốn xóa chứ?
              </p>
            ) : (
              <p className="text-slate-600 dark:text-slate-350 text-sm mb-6">
                Bạn có chắc chắn muốn xóa bài tập custom này ra khỏi thư viện không? Hành động này không thể hoàn tác.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium shadow-md transition-colors"
              >
                Xóa bài tập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/exercises')}
            className="p-2 text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full border border-slate-200/50 dark:border-slate-700">
            {exercise.is_custom ? 'Custom' : 'Hệ thống'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/exercises/${exercise.id}/edit`)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-sm font-semibold"
            title="Chỉnh sửa bài tập"
          >
            <Edit2 className="w-4.5 h-4.5" />
            <span className="hidden sm:inline">Sửa</span>
          </button>
          
          {exercise.is_custom && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-slate-650 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-1 text-sm font-semibold"
              title="Xóa bài tập"
            >
              <Trash2 className="w-4.5 h-4.5" />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Main Details */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">
            {exercise.name}
          </h1>
          {exercise.name_vi && (
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {exercise.name_vi}
            </p>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 border-y border-slate-100 dark:border-slate-800 py-4 text-sm">
          <div>
            <span className="text-slate-400 text-xs block mb-0.5">Nhóm cơ chính</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {MUSCLE_LABELS[exercise.muscle_group] || exercise.muscle_group}
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-xs block mb-0.5">Thiết bị</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {EQUIPMENT_LABELS[exercise.equipment] || exercise.equipment}
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-xs block mb-0.5">Kiểu đo lường</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {MEASUREMENT_LABELS[exercise.measurement_type] || exercise.measurement_type}
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-xs block mb-0.5">Bodyweight</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {exercise.is_bodyweight ? 'Có' : 'Không'}
            </span>
          </div>
        </div>

        {/* Secondary Muscles */}
        {exercise.secondary_muscles && exercise.secondary_muscles.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Nhóm cơ phụ tác động
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {exercise.secondary_muscles.map((muscle) => (
                <span
                  key={muscle}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-150 dark:border-slate-750"
                >
                  {MUSCLE_LABELS[muscle]?.split(' (')[0] || muscle}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Hướng dẫn kỹ thuật
          </h3>
          <p className="text-slate-650 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
            {exercise.description || 'Chưa có mô tả kỹ thuật chi tiết cho bài tập này.'}
          </p>
        </div>

        {/* Video URL */}
        {exercise.video_url && (
          <div className="pt-2">
            <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Video minh họa
            </h3>
            <a
              href={exercise.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 text-sm"
            >
              <Play className="w-5 h-5" />
              <span>Mở trên YouTube ↗</span>
            </a>
          </div>
        )}
      </div>

      {/* History Placeholder (Phase 5) */}
      <div className="mt-6 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
        <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
          Lịch sử tập luyện
        </h4>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
          Biểu đồ volume, tạ lớn nhất (1RM) và lịch sử tập bài này sẽ tự động xuất hiện ở Phase 5.
        </p>
      </div>
    </div>
  );
}
