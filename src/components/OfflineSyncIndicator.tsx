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

  if (isOnline) {
    return null;
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="w-full bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-700 dark:text-red-300 flex items-center justify-between transition-all"
    >
      <div className="flex items-center gap-2">
        <WifiOff size={15} className="text-red-600 dark:text-red-400 animate-pulse shrink-0" />
        <span className="font-medium">
          {isRtl
            ? 'لا يوجد اتصال بالإنترنت. عمليات الحفظ والتعديل متوقفة مؤقتاً لحين إعادة الاتصال.'
            : 'No internet connection. Saves and modifications are disabled until reconnected.'}
        </span>
      </div>
    </div>
  );
};
