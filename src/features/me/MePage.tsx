import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Plus, ChevronRight, Scale, Activity, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { useBodyMetricsLive, createBodyMetric, deleteBodyMetric } from '../metrics/api';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { db } from '../../db';

export default function MePage() {
  const navigate = useNavigate();
  const bodyMetrics = useBodyMetricsLive();

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [overwriteWarning, setOverwriteWarning] = useState(false);
  const [toast, setToast] = useState('');

  // Find latest weight metric
  const latestMetric = bodyMetrics && bodyMetrics.length > 0 ? bodyMetrics[0] : null;

  // Process data for sparkline (chronological, last 10 entries to keep it clean)
  const sparklineData = bodyMetrics && bodyMetrics.length > 0
    ? [...bodyMetrics].slice(0, 10).reverse().map(m => ({ weight: m.weight_kg }))
    : [];

  const handleOpenModal = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setWeight(latestMetric ? latestMetric.weight_kg.toString() : '70');
    setBodyFat(latestMetric?.body_fat_percent ? latestMetric.body_fat_percent.toString() : '');
    setNotes('');
    setError('');
    setOverwriteWarning(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const wVal = parseFloat(weight);
    const fatVal = bodyFat ? parseFloat(bodyFat) : undefined;

    if (isNaN(wVal) || wVal < 20 || wVal > 300) {
      setError('Cân nặng phải nằm trong khoảng từ 20kg đến 300kg.');
      return;
    }

    if (fatVal !== undefined && (isNaN(fatVal) || fatVal < 1 || fatVal > 60)) {
      setError('% mỡ cơ thể phải nằm trong khoảng từ 1% đến 60%.');
      return;
    }

    // Check if record already exists for the selected date
    const existing = await db.bodyMetrics.where('date').equals(date).first();
    if (existing && !overwriteWarning) {
      setOverwriteWarning(true);
      return;
    }

    try {
      await createBodyMetric({
        date,
        weight_kg: wVal,
        body_fat_percent: fatVal,
        notes: notes.trim() || undefined,
      });

      setShowModal(false);
      setToast('Đã lưu chỉ số cân nặng thành công!');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi lưu chỉ số.');
    }
  };

  return (
    <div className="p-4 space-y-5 flex flex-col min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-medium text-xs">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Weight Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-xl border dark:border-slate-700 animate-scale-up">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="font-bold text-slate-850 dark:text-white text-base flex items-center gap-1.5">
                <Scale className="w-5 h-5 text-purple-500" />
                <span>Cập nhật cân nặng</span>
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-650 text-xs font-semibold p-1"
              >
                Đóng
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            {overwriteWarning ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/30 rounded-xl text-xs text-amber-650 dark:text-amber-400 font-medium flex gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Đã có dữ liệu cân nặng cho ngày **{date}**. Bạn có đồng ý ghi đè/cập nhật dữ liệu cũ này không?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOverwriteWarning(false)}
                    className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={(e) => handleSave(e)}
                    className="flex-1 py-2 bg-purple-650 hover:bg-purple-750 text-white font-bold rounded-xl text-xs"
                  >
                    Ghi đè
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Ngày cập nhật</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 mb-1">Cân nặng (kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="vd: 70"
                      className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 mb-1">% Mỡ cơ thể</label>
                    <input
                      type="number"
                      step="0.1"
                      value={bodyFat}
                      onChange={(e) => setBodyFat(e.target.value)}
                      placeholder="vd: 15"
                      className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="vd: Đo lúc sáng sớm ngủ dậy"
                    className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-650 hover:bg-purple-750 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors mt-3"
                >
                  Lưu cân nặng
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Header Profile Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center gap-4 mt-2">
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white leading-none">Hội viên của Antigravity</h2>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1.5">Mã số: #{(latestMetric?.id || 'tracker').slice(0, 8)}</span>
        </div>
      </div>

      {/* Weight Widget Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm flex items-center gap-1.5">
              <Scale className="w-4.5 h-4.5 text-purple-500" />
              <span>Chỉ số Cân nặng</span>
            </h3>
            <span className="text-[10px] text-slate-400 block mt-0.5">Cập nhật gần nhất</span>
          </div>

          <button
            onClick={handleOpenModal}
            className="bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-750 dark:text-purple-400 font-extrabold py-1.5 px-3 rounded-lg border border-purple-100 dark:border-purple-900/30 text-[10px] flex items-center gap-1 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cập nhật</span>
          </button>
        </div>

        {/* Big Weight Stat Display */}
        {latestMetric ? (
          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <span className="text-3xl font-black text-slate-850 dark:text-white tracking-tight">
                {latestMetric.weight_kg}
                <span className="text-sm font-bold text-slate-400 ml-1">kg</span>
              </span>
              <span className="block text-[10px] text-slate-400 mt-1 font-semibold">
                Ngày: {latestMetric.date} {latestMetric.body_fat_percent ? `• Mỡ: ${latestMetric.body_fat_percent}%` : ''}
              </span>
            </div>

            {/* Sparkline Mini Weight Chart */}
            {sparklineData.length > 1 && (
              <div className="w-28 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#8b5cf6" 
                      strokeWidth={2} 
                      dot={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-4 text-center">Chưa cập nhật chỉ số cân nặng.</p>
        )}

        <div className="border-t dark:border-slate-800/80 pt-3 flex justify-between items-center">
          <button 
            onClick={() => navigate('/stats')}
            className="text-xs font-bold text-slate-500 hover:text-purple-500 flex items-center gap-1 transition-colors"
          >
            <span>Xem biểu đồ chi tiết</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History Weight Log List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 flex-1 overflow-y-auto">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm border-b pb-2 dark:border-slate-800 flex items-center gap-1.5">
          <Activity className="w-4.5 h-4.5 text-purple-500" />
          <span>Lịch sử cân nặng</span>
        </h3>

        {bodyMetrics && bodyMetrics.length > 0 ? (
          <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
            {bodyMetrics.map((m) => (
              <div 
                key={m.id}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold"
              >
                <div>
                  <span className="font-black text-slate-800 dark:text-white">{m.weight_kg} kg</span>
                  {m.body_fat_percent ? (
                    <span className="text-[10px] text-slate-400 ml-2">Mỡ: {m.body_fat_percent}%</span>
                  ) : null}
                  <span className="block text-[9px] text-slate-400 font-medium mt-0.5">{m.date} {m.notes ? `• ${m.notes}` : ''}</span>
                </div>

                <button
                  onClick={() => {
                    if (window.confirm(`Xác nhận xóa chỉ số cân nặng ngày ${m.date}?`)) {
                      deleteBodyMetric(m.id);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-6 text-center">Chưa có bản ghi nào.</p>
        )}
      </div>
    </div>
  );
}
