import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Plus, ChevronRight, Scale, Activity, CheckCircle2, AlertTriangle, Trash2,
  Settings, Database, Info, Download, Upload, RefreshCw, AlertCircle,
  Sun, Moon, Monitor, CloudUpload
} from 'lucide-react';
import { useBodyMetricsLive, createBodyMetric, deleteBodyMetric } from '../metrics/api';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { db } from '../../db';
import {
  useSettingsLive,
  updateSettings,
  downloadExport,
  importData,
  getAppStats,
  syncDataToSheets,
  type AppStats
} from '../settings/api';
import { seedIfEmpty } from '../../db/seed';

export default function MePage() {
  const navigate = useNavigate();
  const bodyMetrics = useBodyMetricsLive();
  const settings = useSettingsLive();

  // App Stats state
  const [stats, setStats] = useState<AppStats | null>(null);

  // Hidden file input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [overwriteWarning, setOverwriteWarning] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isSyncing, setIsSyncing] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importReplaceStep, setImportReplaceStep] = useState(0); // 0 = normal, 1 = warning 1, 2 = warning 2
  const [importError, setImportError] = useState('');

  // Reset/Clear state
  const [showResetLibraryModal, setShowResetLibraryModal] = useState(false);
  const [showWipeAllModal1, setShowWipeAllModal1] = useState(false);
  const [showWipeAllModal2, setShowWipeAllModal2] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  // Find latest weight metric
  const latestMetric = bodyMetrics && bodyMetrics.length > 0 ? bodyMetrics[0] : null;

  // Process data for sparkline (chronological, last 10 entries to keep it clean)
  const sparklineData = bodyMetrics && bodyMetrics.length > 0
    ? [...bodyMetrics].slice(0, 10).reverse().map(m => ({ weight: m.weight_kg }))
    : [];

  // Query stats on mount, or when bodyMetrics/settings update
  useEffect(() => {
    getAppStats().then(setStats);
  }, [bodyMetrics, settings]);

  const handleOpenModal = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setWeight(latestMetric ? latestMetric.weight_kg.toString() : (settings?.default_bodyweight_kg?.toString() || '70'));
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

  // ============================================
  // SETTINGS HANDLERS
  // ============================================

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    await updateSettings({ theme });
  };

  const handleTimerChange = async (field: 'default_workout_timer_mode' | 'default_rest_timer_mode', value: 'stopwatch' | 'countdown') => {
    await updateSettings({ [field]: value });
  };

  const handleRestSecondsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 10 && val <= 600) {
      await updateSettings({ default_rest_seconds: val });
    }
  };

  const handleDefaultBodyweightChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 20 && val <= 300) {
      await updateSettings({ default_bodyweight_kg: val });
    }
  };

  const handleHapticToggle = async () => {
    if (settings) {
      await updateSettings({ haptic_enabled: !settings.haptic_enabled });
    }
  };

  // ============================================
  // EXPORT / IMPORT HANDLERS
  // ============================================

  const handleExportData = async () => {
    try {
      await downloadExport();
      setToastType('success');
      setToast('Tải xuống file sao lưu JSON thành công!');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      console.error(err);
      alert('Đã xảy ra lỗi khi tải file sao lưu.');
    }
  };

  const handleSyncSheets = async () => {
    setIsSyncing(true);
    try {
      await syncDataToSheets();
      await updateSettings({ last_sync_at: new Date().toISOString() });
      setToastType('success');
      setToast('Đã gửi dữ liệu lên Google Sheets. Mở Sheet để kiểm tra.');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToast('Đồng bộ thất bại. Vui lòng kiểm tra lại kết nối!');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFileTrigger = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportError('');
      setImportReplaceStep(0);
      setShowImportModal(true);
    }
    e.target.value = ''; // Reset input selection
  };

  const handleExecuteImport = async (mode: 'replace' | 'merge') => {
    if (!importFile) return;

    if (mode === 'replace' && importReplaceStep === 0) {
      setImportReplaceStep(1);
      return;
    }

    try {
      const res = await importData(importFile, { mode });
      if (res.success) {
        setShowImportModal(false);
        setImportFile(null);
        setImportReplaceStep(0);

        const summary = `Đã nhập: ${res.counts.exercises || 0} bài tập, ${res.counts.sessions || 0} buổi tập, ${res.counts.bodyMetrics || 0} cân nặng.`;
        setToast(`Ghi nhận dữ liệu thành công! ${summary}`);
        setTimeout(() => setToast(''), 4000);
      }
    } catch (err: any) {
      setImportError(err.message || 'Đã xảy ra lỗi khi giải nén dữ liệu.');
      setImportReplaceStep(0);
    }
  };

  const handleResetLibrary = async () => {
    try {
      await db.exercises.clear();
      await seedIfEmpty();
      setShowResetLibraryModal(false);
      setToast('Khôi phục bài tập mặc định thành công!');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      console.error(err);
      alert('Đã xảy ra lỗi khi reset thư viện bài tập.');
    }
  };

  const handleExecuteWipe = async () => {
    if (wipeConfirmText !== 'XOA TAT CA') return;
    try {
      for (const table of db.tables) {
        await table.clear();
      }
      await seedIfEmpty();
      setShowWipeAllModal2(false);
      setWipeConfirmText('');
      setToast('Đã xóa toàn bộ dữ liệu ứng dụng!');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Đã xảy ra lỗi khi xóa dữ liệu.');
    }
  };

  const isHapticSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return (
    <div className="p-4 space-y-6 flex flex-col min-h-screen pb-24 bg-slate-50 dark:bg-slate-950">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in font-semibold text-xs text-center max-w-xs ${
          toastType === 'error' ? 'bg-red-655' : 'bg-emerald-600'
        }`}>
          {toastType === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}
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

      {/* JSON Import Modal */}
      {showImportModal && importFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-xl border dark:border-slate-700 animate-scale-up space-y-4">
            <h3 className="font-bold text-slate-850 dark:text-white text-base flex items-center gap-1.5 border-b pb-2">
              <Upload className="w-5 h-5 text-purple-500" />
              <span>Nhập dữ liệu tập luyện</span>
            </h3>

            {importError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 rounded-xl text-[11px] font-semibold leading-relaxed">
                {importError}
              </div>
            )}

            {importReplaceStep === 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Đang chọn file: <strong className="text-slate-750 dark:text-white">{importFile.name}</strong>. Vui lòng chọn chế độ nhập dữ liệu:
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleExecuteImport('merge')}
                    className="w-full bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-750 dark:text-purple-400 font-extrabold py-2.5 rounded-xl border border-purple-100 dark:border-purple-900/30 text-xs flex items-center justify-center gap-1 transition-all"
                  >
                    <span>Gộp dữ liệu (Giữ dữ liệu hiện có)</span>
                  </button>
                  <button
                    onClick={() => handleExecuteImport('replace')}
                    className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-750 dark:text-red-400 font-extrabold py-2.5 rounded-xl border border-red-100 dark:border-red-900/30 text-xs flex items-center justify-center gap-1 transition-all"
                  >
                    <span>Thay thế toàn bộ (Xóa dữ liệu cũ)</span>
                  </button>
                </div>
              </div>
            ) : importReplaceStep === 1 ? (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-650 dark:text-red-400 font-semibold flex gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse text-red-500" />
                  <span>Cảnh báo: Lựa chọn "Thay thế" sẽ xóa sạch toàn bộ lịch trình vòng tập, lịch sử tập luyện và chỉ số cân nặng hiện có của bạn. Bạn vẫn muốn tiếp tục?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportReplaceStep(0)}
                    className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={() => setImportReplaceStep(2)}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs"
                  >
                    Tiếp tục
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-650 dark:text-red-400 font-bold flex gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-550" />
                  <span>XÁC NHẬN CUỐI CÙNG: Dữ liệu hiện có của bạn sẽ bị ghi đè hoàn toàn bằng dữ liệu mới và KHÔNG THỂ KHÔI PHỤC. Vẫn tiến hành thay thế?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportReplaceStep(0)}
                    className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={() => handleExecuteImport('replace')}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs"
                  >
                    Tôi đồng ý, Ghi đè!
                  </button>
                </div>
              </div>
            )}

            {importReplaceStep === 0 && (
              <div className="flex gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportError('');
                  }}
                  className="w-full py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350"
                >
                  Hủy bỏ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Library Modal */}
      {showResetLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-xl border dark:border-slate-700 animate-scale-up space-y-4">
            <h3 className="font-bold text-slate-850 dark:text-white text-base flex items-center gap-1.5 border-b pb-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              <span>Reset thư viện bài tập</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Thao tác này sẽ **xóa toàn bộ bài tập tùy chỉnh (custom)** do bạn tự tạo và reset các bài tập gốc về ban đầu. Lịch trình vòng tập và lịch sử buổi tập của bạn sẽ **không bị ảnh hưởng**. Bạn có muốn tiếp tục?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetLibraryModal(false)}
                className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350"
              >
                Hủy
              </button>
              <button
                onClick={handleResetLibrary}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs"
              >
                Xác nhận Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wipe All Modal 1 */}
      {showWipeAllModal1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-xl border dark:border-slate-700 animate-scale-up space-y-4">
            <h3 className="font-bold text-red-655 dark:text-red-400 text-base flex items-center gap-1.5 border-b pb-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>Xóa toàn bộ dữ liệu</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <strong className="text-red-500">CẢNH BÁO NGUY HIỂM:</strong> Hành động này sẽ **XÓA SẠCH** mọi thông tin trong ứng dụng, bao gồm: bài tập, lịch trình vòng tập, lịch sử tập luyện, nhật ký hoạt động tự do và lịch sử cân nặng. Hành động này **không thể khôi phục**. Bạn vẫn muốn tiếp tục?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWipeAllModal1(false)}
                className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setShowWipeAllModal1(false);
                  setShowWipeAllModal2(true);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs"
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wipe All Modal 2 */}
      {showWipeAllModal2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-xl border dark:border-slate-700 animate-scale-up space-y-4">
            <h3 className="font-bold text-red-655 dark:text-red-400 text-base flex items-center gap-1.5 border-b pb-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>Xác nhận xóa vĩnh viễn</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Vui lòng nhập chính xác cụm từ <strong className="text-red-500 dark:text-red-400">XOA TAT CA</strong> vào ô dưới đây để xác nhận xóa toàn bộ dữ liệu:
            </p>
            <div>
              <input
                type="text"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder="XOA TAT CA"
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white font-extrabold text-center tracking-widest text-sm rounded-xl focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowWipeAllModal2(false);
                  setWipeConfirmText('');
                }}
                className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteWipe}
                disabled={wipeConfirmText !== 'XOA TAT CA'}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for database restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Header Profile Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center gap-4 mt-2">
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full animate-pulse">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white leading-none">Tuấn Super</h2>
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

      {/* Settings section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm border-b pb-2 dark:border-slate-800 flex items-center gap-1.5">
          <Settings className="w-4.5 h-4.5 text-purple-500" />
          <span>Cài đặt ứng dụng</span>
        </h3>

        {settings ? (
          <div className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-350">
            {/* Theme switcher */}
            <div>
              <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">Giao diện (Theme)</label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] ${settings.theme === 'light'
                      ? 'bg-white dark:bg-slate-800 text-purple-650 dark:text-purple-400 shadow-sm scale-[1.02]'
                      : 'text-slate-500 dark:text-slate-400'
                    }`}
                >
                  <Sun className="w-4.5 h-4.5" />
                  <span>Sáng</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] ${settings.theme === 'dark'
                      ? 'bg-white dark:bg-slate-800 text-purple-650 dark:text-purple-400 shadow-sm scale-[1.02]'
                      : 'text-slate-500 dark:text-slate-400'
                    }`}
                >
                  <Moon className="w-4.5 h-4.5" />
                  <span>Tối</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] ${settings.theme === 'system'
                      ? 'bg-white dark:bg-slate-800 text-purple-650 dark:text-purple-400 shadow-sm scale-[1.02]'
                      : 'text-slate-500 dark:text-slate-400'
                    }`}
                >
                  <Monitor className="w-4.5 h-4.5" />
                  <span>Hệ thống</span>
                </button>
              </div>
            </div>

            {/* Timers configuration */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Bấm giờ lúc tập</label>
                <select
                  value={settings.default_workout_timer_mode}
                  onChange={(e) => handleTimerChange('default_workout_timer_mode', e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white"
                >
                  <option value="stopwatch">Đếm lên</option>
                  <option value="countdown">Đếm ngược</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Bấm giờ nghỉ ngơi</label>
                <select
                  value={settings.default_rest_timer_mode}
                  onChange={(e) => handleTimerChange('default_rest_timer_mode', e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white"
                >
                  <option value="countdown">Đếm ngược</option>
                  <option value="stopwatch">Đếm lên</option>
                </select>
              </div>
            </div>

            {/* Defaults Rest & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Thời gian nghỉ (giây)</label>
                <input
                  type="number"
                  defaultValue={settings.default_rest_seconds}
                  onChange={handleRestSecondsChange}
                  min={10}
                  max={600}
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Cân nặng mặc định (kg)</label>
                <input
                  type="number"
                  defaultValue={settings.default_bodyweight_kg || 70}
                  onChange={handleDefaultBodyweightChange}
                  min={20}
                  max={300}
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none dark:text-white font-bold"
                />
              </div>
            </div>

            {/* Haptic Toggle */}
            <div className="flex items-center justify-between pt-1 border-t dark:border-slate-800/80">
              <div>
                <span className="font-bold block">Rung phản hồi (Haptics)</span>
                <span className="text-[10px] text-slate-400 font-medium">Rung nhẹ khi click nút, hết giờ nghỉ</span>
              </div>
              <button
                type="button"
                onClick={handleHapticToggle}
                disabled={!isHapticSupported}
                className={`w-12 h-6.5 rounded-full p-1 transition-all duration-200 focus:outline-none ${settings.haptic_enabled && isHapticSupported
                    ? 'bg-purple-650 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
              >
                <div
                  className={`w-4.5 h-4.5 rounded-full bg-white transition-all shadow-sm ${settings.haptic_enabled && isHapticSupported ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>
            {!isHapticSupported && (
              <p className="text-[9px] text-amber-600 dark:text-amber-500 font-medium leading-none">
                * Thiết bị hoặc trình duyệt này không hỗ trợ chế độ rung phản hồi.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-4">Đang tải cài đặt...</p>
        )}
      </div>

      {/* Data section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm border-b pb-2 dark:border-slate-800 flex items-center gap-1.5">
          <Database className="w-4.5 h-4.5 text-purple-500" />
          <span>Quản lý Dữ liệu</span>
        </h3>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <button
            onClick={handleSyncSheets}
            disabled={isSyncing}
            className="p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-750 dark:text-emerald-400 font-extrabold rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col items-center justify-center gap-1 transition-all text-center col-span-2 disabled:opacity-50"
          >
            {isSyncing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CloudUpload className="w-5 h-5" />
            )}
            <span className="font-extrabold">{isSyncing ? 'Đang đồng bộ...' : 'Sync to Google Sheets'}</span>
            {settings?.last_sync_at && (
              <span className="text-[9px] font-normal text-emerald-650 dark:text-emerald-500/80">
                Đồng bộ lần cuối: {new Date(settings.last_sync_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} {new Date(settings.last_sync_at).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}
              </span>
            )}
          </button>

          <button
            onClick={handleExportData}
            className="p-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 text-purple-750 dark:text-purple-400 font-extrabold rounded-2xl border border-purple-100 dark:border-purple-900/30 flex flex-col items-center justify-center gap-1.5 transition-all text-center"
          >
            <Download className="w-5 h-5" />
            <span>Xuất dữ liệu (JSON)</span>
          </button>

          <button
            onClick={handleImportFileTrigger}
            className="p-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-400 font-extrabold rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col items-center justify-center gap-1.5 transition-all text-center"
          >
            <Upload className="w-5 h-5" />
            <span>Nhập dữ liệu backup</span>
          </button>

          <button
            onClick={() => setShowResetLibraryModal(true)}
            className="p-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-extrabold rounded-2xl border border-amber-100 dark:border-amber-900/30 flex flex-col items-center justify-center gap-1.5 transition-all text-center col-span-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Reset thư viện bài tập</span>
          </button>

          <button
            onClick={() => setShowWipeAllModal1(true)}
            className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-750 dark:text-red-400 font-extrabold rounded-2xl border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center gap-1.5 transition-all text-center col-span-2"
          >
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>Xóa toàn bộ dữ liệu</span>
          </button>
        </div>
      </div>

      {/* App Stats Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm border-b pb-2 dark:border-slate-800 flex items-center gap-1.5">
          <Info className="w-4.5 h-4.5 text-purple-500" />
          <span>Thông tin ứng dụng</span>
        </h3>

        {stats ? (
          <div className="space-y-3.5 text-xs font-semibold text-slate-700 dark:text-slate-350">
            <div className="flex justify-between items-center">
              <span className="text-slate-450">Phiên bản</span>
              <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{stats.version}</span>
            </div>
            <div className="flex justify-between items-center border-t dark:border-slate-850 pt-2.5">
              <span className="text-slate-450">Tổng số bài tập</span>
              <span className="font-bold text-slate-800 dark:text-white">{stats.totalExercises} bài</span>
            </div>
            <div className="flex justify-between items-center border-t dark:border-slate-850 pt-2.5">
              <span className="text-slate-450">Tổng số buổi tập</span>
              <span className="font-bold text-slate-800 dark:text-white">{stats.totalSessions} buổi</span>
            </div>
            <div className="flex justify-between items-center border-t dark:border-slate-850 pt-2.5">
              <span className="text-slate-450">Thời gian tập luyện</span>
              <span className="font-bold text-slate-800 dark:text-white">{stats.totalDurationHours} giờ</span>
            </div>
            <div className="flex justify-between items-center border-t dark:border-slate-850 pt-2.5">
              <span className="text-slate-450">Lifetime Volume nâng</span>
              <span className="font-bold text-purple-650 dark:text-purple-400">{stats.totalVolumeKg.toLocaleString()} kg</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-4">Đang tải thông số...</p>
        )}
      </div>

      {/* History Weight Log List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 flex-1 overflow-y-auto min-h-[30vh]">
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
