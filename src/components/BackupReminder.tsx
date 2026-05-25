import { useState, useEffect } from 'react';
import { db } from '../db';
import { downloadExport } from '../features/settings/api';
import { AlertTriangle, Download, X } from 'lucide-react';

export default function BackupReminder() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const checkBackupStatus = async () => {
      // Check session storage first (respect dismissal in the current tab session)
      if (sessionStorage.getItem('dismissed_backup_reminder') === 'true') {
        return;
      }

      const settings = await db.settings.get('singleton');
      if (!settings) return;

      const lastBackup = settings.last_backup_at;
      if (!lastBackup) {
        // Never backed up
        setShowBanner(true);
        return;
      }

      const lastBackupDate = new Date(lastBackup);
      const diffMs = Date.now() - lastBackupDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays >= 30) {
        setShowBanner(true);
      }
    };

    checkBackupStatus();
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('dismissed_backup_reminder', 'true');
    setShowBanner(false);
  };

  const handleExport = async () => {
    try {
      await downloadExport();
      setShowBanner(false);
    } catch (err) {
      console.error('Failed to export backup:', err);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-fade-in mb-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-550 shrink-0" />
        <span className="text-amber-800 dark:text-amber-300 leading-normal">
          Đã hơn 30 ngày bạn chưa sao lưu dữ liệu tập luyện. Hãy xuất file backup JSON ngay!
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleExport}
          className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Sao lưu</span>
        </button>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg"
          title="Bỏ qua"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
