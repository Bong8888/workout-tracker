import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Dumbbell, Sparkles } from 'lucide-react';
import { useExercises } from './api';

const MUSCLE_GROUPS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả nhóm cơ' },
  { value: 'chest', label: 'Ngực (Chest)' },
  { value: 'back', label: 'Lưng (Back)' },
  { value: 'legs', label: 'Chân (Legs)' },
  { value: 'shoulders', label: 'Vai (Shoulders)' },
  { value: 'arms', label: 'Tay (Arms)' },
  { value: 'core', label: 'Cơ bụng/Lõi (Core)' },
  { value: 'cardio', label: 'Tim mạch (Cardio)' },
  { value: 'full_body', label: 'Toàn thân (Full Body)' },
];

const EQUIPMENTS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả thiết bị' },
  { value: 'barbell', label: 'Tạ đòn (Barbell)' },
  { value: 'dumbbell', label: 'Tạ đơn (Dumbbell)' },
  { value: 'machine', label: 'Máy tập (Machine)' },
  { value: 'bodyweight', label: 'Trọng lượng cơ thể (Bodyweight)' },
  { value: 'cable', label: 'Dây cáp (Cable)' },
  { value: 'resistance_band', label: 'Dây kháng lực (Band)' },
  { value: 'kettlebell', label: 'Tạ bình vôi (Kettlebell)' },
  { value: 'other', label: 'Khác (Other)' },
];

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Ngực',
  back: 'Lưng',
  legs: 'Chân',
  shoulders: 'Vai',
  arms: 'Tay',
  core: 'Bụng/Lõi',
  cardio: 'Cardio',
  full_body: 'Toàn thân',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Tạ đòn',
  dumbbell: 'Tạ đơn',
  machine: 'Máy',
  bodyweight: 'Bodyweight',
  cable: 'Cáp',
  resistance_band: 'Dây chun',
  kettlebell: 'Tạ bình',
  other: 'Khác',
};

export default function ExercisesPage() {
  const navigate = useNavigate();

  // Search input and debounce states
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Dropdown filter states
  const [muscleGroup, setMuscleGroup] = useState<string>('all');
  const [equipment, setEquipment] = useState<string>('all');

  // Debouncing search input (200ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query exercises reactively
  const exercises = useExercises({
    muscle_group: muscleGroup,
    equipment: equipment,
    search: debouncedSearch,
  });

  // Infinite Scroll / Lazy Load logic to prevent rendering lag (>800 items)
  const [visibleCount, setVisibleCount] = useState(50);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(50);
  }, [muscleGroup, equipment, debouncedSearch]);

  // Observer to load more items
  useEffect(() => {
    if (!observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && exercises && visibleCount < exercises.length) {
          setVisibleCount((prev) => prev + 50);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [exercises, visibleCount]);

  const visibleExercises = exercises ? exercises.slice(0, visibleCount) : [];

  return (
    <div className="p-4 flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Dumbbell className="w-6 h-6 text-primary-500" />
          <span>Thư viện</span>
        </h1>
        <button
          onClick={() => navigate('/exercises/new')}
          className="bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl shadow-md flex items-center gap-1.5 transition-all duration-200 active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm</span>
        </button>
      </div>

      {/* Filters & Search Control Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 mb-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm kiếm bài tập..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:text-white"
          />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-medium dark:text-slate-200 cursor-pointer"
          >
            {MUSCLE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>

          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-medium dark:text-slate-200 cursor-pointer"
          >
            {EQUIPMENTS.map((eq) => (
              <option key={eq.value} value={eq.value}>
                {eq.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List Count */}
      <div className="text-xs text-slate-400 font-semibold px-1 mb-2 flex justify-between">
        <span>Đang hiển thị {visibleExercises.length} / {exercises?.length ?? 0} bài tập</span>
      </div>

      {/* Exercises List */}
      {exercises && exercises.length > 0 ? (
        <div className="space-y-2 flex-1">
          {visibleExercises.map((ex) => (
            <div
              key={ex.id}
              onClick={() => navigate(`/exercises/${ex.id}`)}
              className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-all duration-200 shadow-sm hover:shadow"
            >
              <div className="flex flex-col pr-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight group-hover:text-primary-600">
                  {ex.name}
                </h3>
                {ex.name_vi && (
                  <span className="text-xs text-slate-450 dark:text-slate-400 mt-0.5">
                    {ex.name_vi}
                  </span>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-bold bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-md border border-primary-100/55 dark:border-primary-900/30">
                    {MUSCLE_LABELS[ex.muscle_group] || ex.muscle_group}
                  </span>
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 px-2 py-0.5 rounded-md border border-slate-150 dark:border-slate-750">
                    {EQUIPMENT_LABELS[ex.equipment] || ex.equipment}
                  </span>
                  {ex.is_custom && (
                    <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-100/55 dark:border-indigo-900/30 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Custom</span>
                    </span>
                  )}
                </div>
              </div>
              <span className="text-slate-300 dark:text-slate-650 text-lg font-medium pr-1">
                &rarr;
              </span>
            </div>
          ))}

          {/* Trigger point for Infinite Scroll loading */}
          <div ref={observerRef} className="h-10 flex items-center justify-center text-xs text-slate-400">
            {exercises && visibleCount < exercises.length ? 'Đang tải thêm...' : 'Đã hiển thị hết danh sách'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
          <Dumbbell className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2 stroke-1" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Không tìm thấy bài tập nào khớp với bộ lọc tìm kiếm.
          </p>
        </div>
      )}
    </div>
  );
}
