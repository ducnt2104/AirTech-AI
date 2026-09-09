import { WifiOff, AlertTriangle, CheckCircle, RefreshCw, Info } from 'lucide-react';
import { useDegradedMode } from '@/startup/StartupWatchdog';

export function DegradedModeIndicator() {
  const { mode, reason, disabledFeatures, canRetry } = useDegradedMode();

  if (mode === 'full') return null;

  const isOffline = mode === 'offline';
  const Icon = isOffline ? WifiOff : AlertTriangle;
  const bgColor = isOffline ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30';
  const borderColor = isOffline ? 'border-red-300 dark:border-red-700' : 'border-amber-300 dark:border-amber-700';
  const textColor = isOffline ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200';
  const iconColor = isOffline ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400';

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} ${borderColor} ${textColor} border rounded-xl p-4 max-w-md shadow-xl animate-slide-in`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {isOffline ? 'Chế độ Offline' : 'Chế độ Hạn chế'}
            </span>
            {canRetry && (
              <button
                onClick={() => window.location.reload()}
                className="flex-shrink-0 px-2 py-1 text-xs bg-white/50 dark:bg-gray-800/50 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors"
                title="Thử khởi động lại"
              >
                <RefreshCw className="w-3 h-3 inline" />
              </button>
            )}
          </div>
          <p className="text-xs mt-1 opacity-90">{reason}</p>
          {disabledFeatures.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
                Tính năng bị tắt ({disabledFeatures.length})
              </summary>
              <ul className="text-xs mt-1 space-y-0.5 pl-4 list-disc">
                {disabledFeatures.map(f => (
                  <li key={f} className="opacity-80">{f}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export function StartupPerformanceBadge() {
  const { mode } = useDegradedMode();
  
  if (mode === 'full') {
    return (
      <div className="fixed bottom-4 right-4 z-40 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 rounded-lg px-3 py-2 text-xs font-mono shadow-lg animate-fade-in">
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>Khởi động hoàn tất</span>
        </div>
      </div>
    );
  }
  
  return null;
}