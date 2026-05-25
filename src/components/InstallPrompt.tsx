import { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // If permanently dismissed, do not show
    if (localStorage.getItem('dismissed_install_prompt') === 'true') {
      return;
    }

    // Check if the app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone;
    if (isStandalone) return;

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    // Detect Safari browser on iOS specifically
    const safari = /safari/.test(userAgent) && !/crios|fxios|opios|ucbrowser|google/.test(userAgent);
    
    if (ios && safari) {
      setIsIOS(true);
      setShowPrompt(true);
      return;
    }

    // Listen for beforeinstallprompt for Chromium based browsers
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('dismissed_install_prompt', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="bg-primary-50 dark:bg-primary-950/20 border border-primary-150 dark:border-primary-900/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-fade-in mb-4">
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-primary-650 shrink-0" />
        <span className="text-primary-800 dark:text-primary-350 leading-normal">
          {isIOS 
            ? 'Để trải nghiệm tốt nhất, hãy nhấn nút Chia sẻ (Share) 📤 trên Safari và chọn "Thêm vào MH chính" (Add to Home Screen).'
            : 'Cài đặt ứng dụng Workout Tracker về màn hình chính của bạn để sử dụng offline thuận tiện!'
          }
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="bg-primary-650 hover:bg-primary-750 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Cài đặt</span>
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg"
          title="Bỏ qua vĩnh viễn"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
