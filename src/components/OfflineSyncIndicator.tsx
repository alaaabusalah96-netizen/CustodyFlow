import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { OfflineQueueEngine } from '../db/offlineQueue';

interface OfflineSyncIndicatorProps {
  language: 'ar' | 'en';
}

export const OfflineSyncIndicator: React.FC<OfflineSyncIndicatorProps> = ({ language }) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const isRtl = language === 'ar';

  useEffect(() => {
    const updateStatus = () => {
      if (typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
      }
      setPendingCount(OfflineQueueEngine.getPendingCount());
    };

    updateStatus();

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      await OfflineQueueEngine.flushQueue();
      setPendingCount(OfflineQueueEngine.getPendingCount());
      setIsSyncing(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingCount(OfflineQueueEngine.getPendingCount());
    };

    const handleQueueChange = () => {
      setPendingCount(OfflineQueueEngine.getPendingCount());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('custody_offline_queue_changed', handleQueueChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('custody_offline_queue_changed', handleQueueChange);
    };
  }, []);

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between transition-all"
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <WifiOff size={15} className="text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
        ) : (
          <RefreshCw size={15} className={`text-amber-600 dark:text-amber-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
        )}
        <span className="font-medium">
          {!isOnline
            ? (isRtl ? 'شغال Offline، هيتزامن أول ما النت يرجع' : 'Working Offline, will sync when connection returns')
            : isSyncing
            ? (isRtl ? 'جاري مزامنة المعاملات المسجلة أوفلاين مع البيانات...' : 'Syncing offline recorded transactions...')
            : (isRtl ? `توجد ${pendingCount} معاملة مسجلة أوفلاين بانتظار المزامنة` : `There are ${pendingCount} offline transactions pending sync`)}
        </span>
      </div>

      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          onClick={async () => {
            setIsSyncing(true);
            await OfflineQueueEngine.flushQueue();
            setPendingCount(OfflineQueueEngine.getPendingCount());
            setIsSyncing(false);
          }}
          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-sm"
        >
          {isRtl ? 'مزامنة الآن' : 'Sync Now'}
        </button>
      )}
    </div>
  );
};
