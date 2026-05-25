import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Trash2, ArrowUp, ArrowDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { createCycle, getCycleById, getCycleDays, getCycleDayExercises, updateCycle } from './api';
import { useExercises } from '../exercises/api';
import type { Exercise } from '../../db/types';

interface FormExercise {
  exercise_id: string;
  exercise_name: string;
  is_bodyweight: boolean;
  measurement_type: string;
  target_sets: number;
  target_reps?: number;
  target_weight?: number;
  target_added_weight?: number;
  target_time_seconds?: number;
  notes?: string;
}

interface FormDay {
  id: string; // Temporary ID for list keys
  day_type: 'workout' | 'rest';
  name: string;
  exercises: FormExercise[];
}

export default function CycleForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // Form Steps
  const [step, setStep] = useState(1);

  // Step 1: General Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  // Step 2: Cycle Days
  const [days, setDays] = useState<FormDay[]>([
    { id: crypto.randomUUID(), day_type: 'workout', name: 'Day 1: Push', exercises: [] },
    { id: crypto.randomUUID(), day_type: 'workout', name: 'Day 2: Pull', exercises: [] },
    { id: crypto.randomUUID(), day_type: 'workout', name: 'Day 3: Legs', exercises: [] },
    { id: crypto.randomUUID(), day_type: 'rest', name: 'Day 4: Nghỉ', exercises: [] },
  ]);

  // Exercise Select Modal
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [activeDayIndexForModal, setActiveDayIndexForModal] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');

  // Exercise database for modal
  const exercises = useExercises({
    search: searchQuery,
    muscle_group: selectedMuscle,
  });

  // State controls
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Load cycle in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      getCycleById(id).then(async (c) => {
        if (c) {
          setName(c.name);
          setDescription(c.description || '');
          setStartDate(c.start_date);

          const daysData = await getCycleDays(id);
          const formDays: FormDay[] = [];
          for (const d of daysData) {
            const exs = await getCycleDayExercises(d.id);
            formDays.push({
              id: d.id,
              day_type: d.day_type,
              name: d.name,
              exercises: exs.map((e) => ({
                exercise_id: e.exercise_id,
                exercise_name: e.exercise.name,
                is_bodyweight: e.exercise.is_bodyweight,
                measurement_type: e.exercise.measurement_type,
                target_sets: e.target_sets,
                target_reps: e.target_reps,
                target_weight: e.target_weight,
                target_added_weight: e.target_added_weight,
                target_time_seconds: e.target_time_seconds,
                notes: e.notes,
              })),
            });
          }
          setDays(formDays);
        } else {
          setError('Không tìm thấy vòng tập để chỉnh sửa.');
        }
        setIsLoading(false);
      }).catch(() => {
        setError('Đã xảy ra lỗi khi tải dữ liệu vòng tập.');
        setIsLoading(false);
      });
    }
  }, [id, isEditMode]);

  // Validate Step 1
  const validateStep1 = () => {
    if (!name.trim()) {
      setError('Vui lòng điền tên vòng tập.');
      return false;
    }
    if (!startDate) {
      setError('Vui lòng chọn ngày bắt đầu.');
      return false;
    }
    setError('');
    return true;
  };

  // Validate Step 2
  const validateStep2 = () => {
    if (days.length === 0) {
      setError('Lịch tập phải chứa ít nhất 1 ngày.');
      return false;
    }
    for (let i = 0; i < days.length; i++) {
      if (!days[i].name.trim()) {
        setError(`Vui lòng đặt tên cho ngày thứ ${i + 1}.`);
        return false;
      }
    }
    setError('');
    return true;
  };

  // Day List controls (swap and delete)
  const moveDay = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= days.length) return;

    const newDays = [...days];
    const temp = newDays[index];
    newDays[index] = newDays[targetIndex];
    newDays[targetIndex] = temp;
    setDays(newDays);
  };

  const handleAddDay = () => {
    const nextOrder = days.length + 1;
    setDays([
      ...days,
      {
        id: crypto.randomUUID(),
        day_type: 'workout',
        name: `Day ${nextOrder}: Workout Day`,
        exercises: [],
      },
    ]);
  };

  const handleDeleteDay = (index: number) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa ngày này ra khỏi lịch tập không?')) {
      setDays(days.filter((_, i) => i !== index));
    }
  };

  // Exercise Modal controls
  const handleOpenExerciseModal = (dayIndex: number) => {
    setActiveDayIndexForModal(dayIndex);
    setShowExerciseModal(true);
    setSearchQuery('');
    setSelectedMuscle('all');
  };

  const handleSelectExercise = (exercise: Exercise) => {
    if (activeDayIndexForModal === null) return;

    const targetDay = days[activeDayIndexForModal];
    
    // Check if exercise already added
    const alreadyExists = targetDay.exercises.some((e) => e.exercise_id === exercise.id);
    if (alreadyExists) {
      alert('Bài tập này đã có trong ngày tập.');
      return;
    }

    const newFormEx: FormExercise = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      is_bodyweight: exercise.is_bodyweight,
      measurement_type: exercise.measurement_type,
      target_sets: 3,
      target_reps: exercise.measurement_type === 'reps' ? 10 : undefined,
      target_weight: (!exercise.is_bodyweight && exercise.measurement_type === 'reps') ? 20 : undefined,
      target_added_weight: (exercise.is_bodyweight && exercise.measurement_type === 'reps') ? 0 : undefined,
      target_time_seconds: exercise.measurement_type === 'time' ? 60 : undefined,
    };

    const newDays = [...days];
    newDays[activeDayIndexForModal].exercises.push(newFormEx);
    setDays(newDays);

    setShowExerciseModal(false);
    setActiveDayIndexForModal(null);
  };

  const handleDeleteExercise = (dayIndex: number, exIndex: number) => {
    const newDays = [...days];
    newDays[dayIndex].exercises.splice(exIndex, 1);
    setDays(newDays);
  };

  const handleUpdateExerciseTarget = (
    dayIndex: number,
    exIndex: number,
    field: keyof FormExercise,
    value: any
  ) => {
    const newDays = [...days];
    newDays[dayIndex].exercises[exIndex] = {
      ...newDays[dayIndex].exercises[exIndex],
      [field]: value,
    };
    setDays(newDays);
  };

  // Exercise Ordering controls
  const moveExercise = (dayIndex: number, exIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? exIndex - 1 : exIndex + 1;
    const day = days[dayIndex];
    if (targetIndex < 0 || targetIndex >= day.exercises.length) return;

    const newDays = [...days];
    const temp = newDays[dayIndex].exercises[exIndex];
    newDays[dayIndex].exercises[exIndex] = newDays[dayIndex].exercises[targetIndex];
    newDays[dayIndex].exercises[targetIndex] = temp;
    setDays(newDays);
  };

  // Submit flow
  const handleSaveCycle = async () => {
    setShowConfirmModal(false);

    // Filter properties to match creation API schema
    const cycleData = {
      name: name.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      days: days.map((d) => ({
        day_type: d.day_type,
        name: d.name.trim(),
        exercises: d.day_type === 'workout'
          ? d.exercises.map((e) => ({
              exercise_id: e.exercise_id,
              target_sets: Number(e.target_sets) || 3,
              target_reps: e.target_reps !== undefined ? Number(e.target_reps) : undefined,
              target_weight: e.target_weight !== undefined ? Number(e.target_weight) : undefined,
              target_added_weight: e.target_added_weight !== undefined ? Number(e.target_added_weight) : undefined,
              target_time_seconds: e.target_time_seconds !== undefined ? Number(e.target_time_seconds) : undefined,
              notes: e.notes?.trim() || undefined,
            }))
          : [],
      })),
    };

    try {
      if (isEditMode && id) {
        await updateCycle(id, cycleData);
        setToast({ show: true, message: 'Đã cập nhật vòng tập thành công!' });
        setTimeout(() => navigate('/cycles'), 1500);
      } else {
        await createCycle(cycleData);
        setToast({ show: true, message: 'Đã tạo vòng tập mới thành công!' });
        setTimeout(() => navigate('/cycles'), 1500);
      }
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi lưu vòng tập.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col min-h-screen">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-medium">
          <CheckCircle className="w-5 h-5" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-up border border-slate-100 dark:border-slate-700 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400 font-semibold mb-3 border-b pb-2">
              <CheckCircle className="w-6 h-6 text-indigo-500" />
              <span className="text-lg">Xác nhận lịch tập</span>
            </div>
            
            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-bold text-slate-800 dark:text-white text-sm">{name}</span>
                <span className="block text-[10px] text-slate-400">Bắt đầu từ: {startDate}</span>
              </div>

              <div className="border-t pt-2 space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-200">Tổng quát lịch trình ({days.length} ngày):</span>
                {days.map((d, idx) => (
                  <div key={d.id} className="pl-2 border-l-2 border-slate-200 dark:border-slate-700 py-0.5">
                    <span className="font-semibold text-slate-800 dark:text-white">Day {idx + 1} — {d.name}</span>
                    <span className="text-[10px] bg-slate-150 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ml-1.5 px-1.5 py-0.5 rounded-md">
                      {d.day_type === 'workout' ? 'Workout' : 'Nghỉ'}
                    </span>
                    {d.day_type === 'workout' && (
                      <div className="text-[10px] text-slate-400 mt-0.5 pl-2">
                        {d.exercises.length === 0 
                          ? '• Chưa chọn bài tập (Cảnh báo)' 
                          : d.exercises.map(e => `• ${e.exercise_name} (${e.target_sets} sets)`).join(', ')
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6 border-t pt-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-sm"
              >
                Sửa lại
              </button>
              <button
                onClick={handleSaveCycle}
                className="flex-1 py-2 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-md transition-colors text-sm"
              >
                Lưu lịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Picker Modal */}
      {showExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 w-full max-w-sm shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col h-[75vh]">
            <div className="flex items-center justify-between border-b pb-2.5 mb-3">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Chọn bài tập</h3>
              <button 
                onClick={() => setShowExerciseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                Đóng
              </button>
            </div>

            {/* Modal search bar */}
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bài tập..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs dark:text-white"
              />
              <select
                value={selectedMuscle}
                onChange={(e) => setSelectedMuscle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs dark:text-slate-200"
              >
                <option value="all">Tất cả nhóm cơ</option>
                <option value="chest">Ngực</option>
                <option value="back">Lưng</option>
                <option value="legs">Chân</option>
                <option value="shoulders">Vai</option>
                <option value="arms">Tay</option>
                <option value="core">Bụng</option>
                <option value="cardio">Tim mạch</option>
                <option value="full_body">Toàn thân</option>
              </select>
            </div>

            {/* Exercises List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
              {exercises && exercises.length > 0 ? (
                exercises.map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => handleSelectExercise(ex)}
                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs">{ex.name}</h4>
                      <span className="text-[10px] text-slate-400">{ex.muscle_group} • {ex.equipment}</span>
                    </div>
                    <span className="text-primary-600 font-bold text-sm">+</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-center text-slate-400 py-8">Không tìm thấy bài tập phù hợp.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            {isEditMode ? 'Chỉnh sửa vòng tập' : 'Tạo vòng tập mới'}
          </h1>
        </div>
        <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
          Bước {step} / 4
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Step Contents */}
      <div className="flex-1 pb-20">
        {/* STEP 1: General Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350 mb-1">
                Tên vòng tập <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Push/Pull/Legs 6 ngày, Bro Split..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350 mb-1">
                Mô tả lịch tập
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mục tiêu của vòng tập (tăng cơ, giảm mỡ, sức bền...)"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350 mb-1">
                Ngày bắt đầu chu kỳ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white text-sm"
                required
              />
            </div>
          </div>
        )}

        {/* STEP 2: Configure Cycle Days */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400">
                Thứ tự các ngày trong vòng ({days.length} ngày):
              </h3>
              <button
                type="button"
                onClick={handleAddDay}
                className="text-primary-600 dark:text-primary-400 font-bold text-xs hover:underline flex items-center gap-1"
              >
                + Thêm ngày
              </button>
            </div>

            <div className="space-y-2">
              {days.map((day, idx) => (
                <div
                  key={day.id}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex items-center gap-3"
                >
                  {/* Order shift controls */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveDay(idx, 'up')}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-20 rounded-md"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === days.length - 1}
                      onClick={() => moveDay(idx, 'down')}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-20 rounded-md"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Inputs */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={day.name}
                      onChange={(e) => {
                        const newDays = [...days];
                        newDays[idx].name = e.target.value;
                        setDays(newDays);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs font-semibold dark:text-white"
                      placeholder="Tên ngày (vd: Day 1: Push)"
                    />
                    
                    {/* Day Type Toggle */}
                    <div className="flex gap-4 text-xs font-medium text-slate-600 dark:text-slate-350 px-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`day_type_${day.id}`}
                          checked={day.day_type === 'workout'}
                          onChange={() => {
                            const newDays = [...days];
                            newDays[idx].day_type = 'workout';
                            setDays(newDays);
                          }}
                          className="accent-primary-500"
                        />
                        <span>Tập (Workout)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`day_type_${day.id}`}
                          checked={day.day_type === 'rest'}
                          onChange={() => {
                            const newDays = [...days];
                            newDays[idx].day_type = 'rest';
                            newDays[idx].exercises = []; // Rest days have no exercises
                            setDays(newDays);
                          }}
                          className="accent-primary-500"
                        />
                        <span>Nghỉ (Rest)</span>
                      </label>
                    </div>
                  </div>

                  {/* Delete Day */}
                  <button
                    type="button"
                    onClick={() => handleDeleteDay(idx)}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Setup Targets */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
              Thiết lập mục tiêu bài tập cho các ngày tập:
            </h3>

            {days.filter(d => d.day_type === 'workout').length === 0 ? (
              <p className="text-xs text-center text-slate-400 py-10 border border-dashed rounded-xl">
                Không có ngày tập nào được tạo. Hãy quay lại bước 2 để thêm ngày tập (workout).
              </p>
            ) : (
              days.map((day, dIdx) => {
                if (day.day_type !== 'workout') return null;
                return (
                  <div key={day.id} className="border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center border-b pb-2 dark:border-slate-800">
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                        {day.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleOpenExerciseModal(dIdx)}
                        className="text-primary-600 dark:text-primary-400 font-bold text-xs flex items-center gap-1"
                      >
                        + Thêm bài tập
                      </button>
                    </div>

                    {/* Exercises List in Day */}
                    {day.exercises.length === 0 ? (
                      <p className="text-xs text-center text-slate-400 py-6 border border-dashed rounded-xl dark:border-slate-800">
                        Chưa có bài tập. Vui lòng thêm bài tập.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {day.exercises.map((ex, exIdx) => (
                          <div 
                            key={ex.exercise_id} 
                            className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3 rounded-xl shadow-sm space-y-3"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-slate-800 dark:text-white">
                                {exIdx + 1}. {ex.exercise_name}
                              </span>
                              
                              <div className="flex items-center gap-1.5">
                                {/* Order arrows */}
                                <button
                                  type="button"
                                  disabled={exIdx === 0}
                                  onClick={() => moveExercise(dIdx, exIdx, 'up')}
                                  className="p-1 text-slate-350 disabled:opacity-20"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={exIdx === day.exercises.length - 1}
                                  onClick={() => moveExercise(dIdx, exIdx, 'down')}
                                  className="p-1 text-slate-350 disabled:opacity-20"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExercise(dIdx, exIdx)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ml-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Targets Grid */}
                            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-650 dark:text-slate-300">
                              {/* Sets count */}
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Sets</label>
                                <input
                                  type="number"
                                  value={ex.target_sets}
                                  onChange={(e) => handleUpdateExerciseTarget(dIdx, exIdx, 'target_sets', Number(e.target.value))}
                                  min={1}
                                  className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg text-center font-bold"
                                />
                              </div>

                              {/* Measurement Type: reps vs time */}
                              {ex.measurement_type === 'reps' ? (
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">Reps</label>
                                  <input
                                    type="number"
                                    value={ex.target_reps || ''}
                                    onChange={(e) => handleUpdateExerciseTarget(dIdx, exIdx, 'target_reps', Number(e.target.value))}
                                    min={1}
                                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg text-center font-bold"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">Giây</label>
                                  <input
                                    type="number"
                                    value={ex.target_time_seconds || ''}
                                    onChange={(e) => handleUpdateExerciseTarget(dIdx, exIdx, 'target_time_seconds', Number(e.target.value))}
                                    min={1}
                                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg text-center font-bold"
                                  />
                                </div>
                              )}

                              {/* Weight: regular vs bodyweight */}
                              {ex.is_bodyweight ? (
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">Tạ thêm (+kg)</label>
                                  <input
                                    type="number"
                                    value={ex.target_added_weight ?? ''}
                                    onChange={(e) => handleUpdateExerciseTarget(dIdx, exIdx, 'target_added_weight', Number(e.target.value))}
                                    min={0}
                                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg text-center font-bold"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">Tạ (kg)</label>
                                  <input
                                    type="number"
                                    value={ex.target_weight ?? ''}
                                    onChange={(e) => handleUpdateExerciseTarget(dIdx, exIdx, 'target_weight', Number(e.target.value))}
                                    min={0}
                                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg text-center font-bold"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Note input */}
                            <div>
                              <input
                                type="text"
                                value={ex.notes || ''}
                                onChange={(e) => handleUpdateExerciseTarget(dIdx, exIdx, 'notes', e.target.value)}
                                placeholder="Ghi chú bài tập (vd: Tập chậm, siết cơ...)"
                                className="w-full px-2 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-[10px] dark:text-slate-300"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* STEP 4: Review Summary */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl shadow-inner space-y-3">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm border-b pb-1.5 dark:border-slate-800">
                Thông tin vòng tập
              </h3>
              <div className="space-y-1.5 text-xs">
                <p><span className="text-slate-400">Tên:</span> <span className="font-bold text-slate-800 dark:text-white">{name}</span></p>
                <p><span className="text-slate-400">Bắt đầu:</span> <span className="font-bold text-slate-800 dark:text-white">{startDate}</span></p>
                {description && <p><span className="text-slate-400 font-semibold block mb-0.5">Mô tả:</span> <span className="text-slate-650 dark:text-slate-350 whitespace-pre-line block bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850 leading-relaxed">{description}</span></p>}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                Chi tiết ngày tập ({days.length} ngày)
              </h3>
              {days.map((day, idx) => (
                <div key={day.id} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Day {idx + 1} — {day.name}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      day.day_type === 'workout' 
                        ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border-primary-100 dark:border-primary-900/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-750'
                    }`}>
                      {day.day_type === 'workout' ? 'Tập' : 'Nghỉ'}
                    </span>
                  </div>
                  
                  {day.day_type === 'workout' && (
                    <div className="space-y-1 pl-2 border-l border-slate-200 dark:border-slate-750 text-xs">
                      {day.exercises.length === 0 ? (
                        <p className="text-amber-500 flex items-center gap-1 font-medium text-[10px]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Chưa có bài tập cho ngày này</span>
                        </p>
                      ) : (
                        day.exercises.map((e, eIdx) => (
                          <div key={e.exercise_id} className="text-slate-600 dark:text-slate-350">
                            {eIdx + 1}. {e.exercise_name} (
                            {e.target_sets} sets ×{' '}
                            {e.measurement_type === 'reps' ? `${e.target_reps} reps` : `${e.target_time_seconds}s`}
                            {e.is_bodyweight 
                              ? e.target_added_weight ? ` @ +${e.target_added_weight}kg` : ' @ Bodyweight'
                              : ` @ ${e.target_weight}kg`
                            })
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 p-3 shadow-md pb-safe">
        <div className="max-w-md mx-auto flex gap-3">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/cycles')}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <span>Hủy</span>
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1 && validateStep1()) setStep(2);
                else if (step === 2 && validateStep2()) setStep(3);
                else if (step === 3) setStep(4);
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <span>Tiếp tục</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                // Check if any workout day has 0 exercises
                const hasEmptyWorkoutDay = days.some(d => d.day_type === 'workout' && d.exercises.length === 0);
                if (hasEmptyWorkoutDay) {
                  if (window.confirm('Có ngày tập chưa chọn bài tập nào. Bạn vẫn muốn lưu chứ?')) {
                    setShowConfirmModal(true);
                  }
                } else {
                  setShowConfirmModal(true);
                }
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 text-sm"
            >
              <Save className="w-4 h-4" />
              <span>Lưu lịch tập</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
