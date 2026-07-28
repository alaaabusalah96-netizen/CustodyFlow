import { StorageEngine } from './storage';
import { dbSetDoc } from '../firebase';

export interface PendingOfflineItem {
  id: string;
  collectionName: string;
  docId: string;
  data: any;
  timestamp: string;
  action: 'set' | 'delete';
}

const OFFLINE_QUEUE_KEY = 'offline_transactions_queue';

export class OfflineQueueEngine {
  static getQueue(): PendingOfflineItem[] {
    // Write queueing disabled by policy; ensure localStorage queue is cleared
    if (typeof window !== 'undefined') {
      StorageEngine.setStored(OFFLINE_QUEUE_KEY, []);
    }
    return [];
  }

  static enqueue(collectionName: string, docId: string, data: any, action: 'set' | 'delete' = 'set') {
    console.warn(`[OfflineQueue] Enqueue blocked. All writes strictly require an active internet connection (${collectionName}/${docId}).`);
  }

  static async flushQueue(): Promise<{ synced: number; failed: number }> {
    return { synced: 0, failed: 0 };
  }

  static getPendingCount(): number {
    return 0;
  }
}

export async function syncWriteWithOfflineFallback(
  collectionName: string,
  docId: string,
  data: any,
  timeoutMs: number = 5000
): Promise<{ success: boolean; syncedToFirestore: boolean; queuedOffline: boolean; error?: string }> {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;

  if (!isOnline) {
    const errorMsg = 'يلزم وجود اتصال بالإنترنت للحفظ. يرجى إعادة الاتصال والمحاولة مرة أخرى. / Internet connection required to save. Please reconnect and try again.';
    console.warn(`[WriteSync] Write blocked for ${collectionName}/${docId}: Device is offline.`);
    return {
      success: false,
      syncedToFirestore: false,
      queuedOffline: false,
      error: errorMsg
    };
  }

  try {
    const writePromise = dbSetDoc(collectionName, docId, data);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore write timeout')), timeoutMs)
    );

    await Promise.race([writePromise, timeoutPromise]);
    return { success: true, syncedToFirestore: true, queuedOffline: false };
  } catch (err: any) {
    const errorMsg = `فشل الحفظ في قاعدة البيانات: ${err?.message || 'تعذر الاتصال بالسيرفر'}. يرجى التأكد من الإنترنت والمحاولة مجدداً.`;
    console.warn(`[WriteSync] Firestore write failed for ${collectionName}/${docId}:`, err);
    return {
      success: false,
      syncedToFirestore: false,
      queuedOffline: false,
      error: errorMsg
    };
  }
}

