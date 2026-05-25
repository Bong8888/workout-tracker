import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { createExercise, getExerciseById, updateExercise } from './api';
import type { MuscleGroup, Equipment, MeasurementType } from '../../db/types';

const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: 'chest', label: 'Ngực (Chest)' },
  { value: 'back', label: 'Lưng (Back)' },
  { value: 'legs', label: 'Chân (Legs)' },
  { value: 'shoulders', label: 'Vai (Shoulders)' },
  { value: 'arms', label: 'Tay (Arms)' },
  { value: 'core', label: 'Cơ bụng/Lõi (Core)' },
  { value: 'cardio', label: 'Tim mạch (Cardio)' },
  { value: 'full_body', label: 'Toàn thân (Full Body)' },
];

const EQUIPMENTS: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Tạ đòn (Barbell)' },
  { value: 'dumbbell', label: 'Tạ đơn (Dumbbell)' },
  { value: 'machine', label: 'Máy tập (Machine)' },
  { value: 'bodyweight', label: 'Trọng lượng cơ thể (Bodyweight)' },
  { value: 'cable', label: 'Dây cáp (Cable)' },
  { value: 'resistance_band', label: 'Dây kháng lực (Band)' },
  { value: 'kettlebell', label: 'Tạ bình vôi (Kettlebell)' },
  { value: 'other', label: 'Khác (Other)' },
];

const MEASUREMENT_TYPES: { value: MeasurementType; label: string }[] = [
  { value: 'reps', label: 'Đếm số Reps (Reps-based)' },
  { value: 'time', label: 'Thời gian tập (Time-based)' },
  { value: 'distance', label: 'Khoảng cách (Distance)' },
];

export default function ExerciseForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [name, setName] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [measurementType, setMeasurementType] = useState<MeasurementType>('reps');
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [isLoading, setIsLoading] = useState(isEditMode);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  useEffect(() => {
    if (isEditMode && id) {
      getExerciseById(id).then((ex) => {
        if (ex) {
          setName(ex.name);
          setNameVi(ex.name_vi || '');
          setMuscleGroup(ex.muscle_group);
          setSecondaryMuscles(ex.secondary_muscles);
          setEquipment(ex.equipment);
          setMeasurementType(ex.measurement_type);
          setIsBodyweight(ex.is_bodyweight);
          setDescription(ex.description || '');
          setVideoUrl(ex.video_url || '');
        } else {
          setError('Không tìm thấy bài tập để chỉnh sửa.');
        }
        setIsLoading(false);
      }).catch(() => {
        setError('Đã xảy ra lỗi khi tải dữ liệu bài tập.');
        setIsLoading(false);
      });
    }
  }, [id, isEditMode]);

  // Adjust bodyweight toggle when equipment changes to bodyweight
  useEffect(() => {
    if (equipment === 'bodyweight') {
      setIsBodyweight(true);
    }
  }, [equipment]);

  const validateForm = () => {
    if (!name.trim()) {
      setError('Tên bài tập bắt buộc phải điền.');
      return false;
    }

    if (videoUrl.trim()) {
      const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.*$/;
      if (!ytRegex.test(videoUrl.trim())) {
        setError('Video URL phải là đường dẫn YouTube hợp lệ.');
        return false;
      }
    }

    setError('');
    return true;
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirm(true);
    }
  };

  const handleSave = async () => {
    setShowConfirm(false);
    
    const exerciseData = {
      name: name.trim(),
      name_vi: nameVi.trim() || undefined,
      muscle_group: muscleGroup,
      secondary_muscles: secondaryMuscles,
      equipment,
      measurement_type: measurementType,
      is_bodyweight: isBodyweight,
      description: description.trim(),
      video_url: videoUrl.trim() || undefined,
    };

    try {
      if (isEditMode && id) {
        await updateExercise(id, exerciseData);
        showToastMessage('Đã cập nhật bài tập thành công!');
      } else {
        const newId = await createExercise(exerciseData);
        showToastMessage('Đã tạo bài tập mới thành công!');
        setTimeout(() => navigate(`/exercises/${newId}`), 1500);
        return;
      }
      setTimeout(() => navigate(isEditMode ? `/exercises/${id}` : '/exercises'), 1500);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi lưu bài tập.');
    }
  };

  const showToastMessage = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  };

  const handleToggleSecondaryMuscle = (muscle: MuscleGroup) => {
    if (muscle === muscleGroup) return; // cannot be primary and secondary at the same time
    setSecondaryMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-medium">
          <CheckCircle className="w-5 h-5" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-up border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 font-semibold mb-3">
              <AlertTriangle className="w-6 h-6" />
              <span className="text-lg">Xác nhận lưu</span>
            </div>
            <p className="text-slate-600 dark:text-slate-350 text-sm mb-6">
              Bạn có chắc chắn muốn lưu thông tin bài tập này không?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-md transition-colors"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          {isEditMode ? 'Chỉnh sửa bài tập' : 'Thêm bài tập mới'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleOpenConfirm} className="space-y-5 pb-10">
        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            Tên bài tập (Tiếng Anh) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Bench Press"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            required
          />
        </div>

        {/* Name VI */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            Tên bài tập (Tiếng Việt)
          </label>
          <input
            type="text"
            value={nameVi}
            onChange={(e) => setNameVi(e.target.value)}
            placeholder="Ví dụ: Đẩy ngực trên ghế ngang"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
          />
        </div>

        {/* Primary Muscle Group */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            Nhóm cơ chính <span className="text-red-500">*</span>
          </label>
          <select
            value={muscleGroup}
            onChange={(e) => {
              const val = e.target.value as MuscleGroup;
              setMuscleGroup(val);
              // Ensure primary is removed from secondary
              setSecondaryMuscles((prev) => prev.filter((m) => m !== val));
            }}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
          >
            {MUSCLE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        {/* Secondary Muscles (Multi-select pills) */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            Nhóm cơ phụ liên quan
          </label>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((g) => {
              const isSelected = secondaryMuscles.includes(g.value);
              const isPrimary = g.value === muscleGroup;
              return (
                <button
                  key={g.value}
                  type="button"
                  disabled={isPrimary}
                  onClick={() => handleToggleSecondaryMuscle(g.value)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                    ${isPrimary 
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }
                  `}
                >
                  {g.label.split(' (')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipment */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            Thiết bị sử dụng <span className="text-red-500">*</span>
          </label>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
          >
            {EQUIPMENTS.map((eq) => (
              <option key={eq.value} value={eq.value}>
                {eq.label}
              </option>
            ))}
          </select>
        </div>

        {/* Measurement Type */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            Kiểu đo lường tiến độ <span className="text-red-500">*</span>
          </label>
          <select
            value={measurementType}
            onChange={(e) => setMeasurementType(e.target.value as MeasurementType)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
          >
            {MEASUREMENT_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bodyweight Checkbox */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800">
          <input
            type="checkbox"
            id="isBodyweight"
            checked={isBodyweight}
            disabled={equipment === 'bodyweight'}
            onChange={(e) => setIsBodyweight(e.target.checked)}
            className="w-5 h-5 accent-primary-500 text-white rounded focus:ring-primary-500"
          />
          <label 
            htmlFor="isBodyweight"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
          >
            Là bài tập Bodyweight (Trọng lượng cơ thể)
          </label>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            Mô tả kỹ thuật tập luyện
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả các bước thực hiện bài tập, cách hít thở..."
            rows={4}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
          />
        </div>

        {/* Video URL */}
        <div>
          <label className="block text-sm font-semibold text-slate-750 dark:text-slate-300 mb-1.5">
            YouTube Video URL
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Ví dụ: https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
          />
        </div>

        {/* Action Button */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all duration-200 active:scale-98 flex items-center justify-center gap-2 mt-4"
        >
          <Save className="w-5 h-5" />
          <span>{isEditMode ? 'Lưu thay đổi' : 'Thêm vào thư viện'}</span>
        </button>
      </form>
    </div>
  );
}
