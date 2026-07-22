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
    return StorageEngine.getStored<PendingOfflineItem[]>(OFFLINE_QUEUE_KEY, []);
  }

  static enqueue(collectionName: string, docId: string, data: any, action: 'set' | 'delete' = 'set') {
    const queue = this.getQueue();
    const existingIdx = queue.findIndex(q => q.docId === docId && q.collectionName === collectionName);
    const newItem: PendingOfflineItem = {
      id: `off-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      collectionName,
      docId,
      data,
      timestamp: new Date().toISOString(),
      action
    };

    if (existingIdx !== -1) {
      queue[existingIdx] = newItem;
    } else {
      queue.push(newItem);
    }

    StorageEngine.setStored(OFFLINE_QUEUE_KEY, queue);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('custody_offline_queue_changed', { detail: { count: queue.length } }));
    }
  }

  static async flushQueue(): Promise<{ synced: number; failed: number }> {
    const queue = this.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, failed: queue.length };
    }

    let synced = 0;
    let failed = 0;
    const remainingQueue: PendingOfflineItem[] = [];

    for (const item of queue) {
      try {
        if (item.action === 'set') {
          await dbSetDoc(item.collectionName, item.docId, item.data);
        }
        synced++;
      } catch (err) {
        console.warn(`[OfflineQueue] Failed to sync doc ${item.docId}:`, err);
        failed++;
        remainingQueue.push(item);
      }
    }

    StorageEngine.setStored(OFFLINE_QUEUE_KEY, remainingQueue);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('custody_offline_queue_changed', { detail: { count: remainingQueue.length } }));
    }
    return { synced, failed };
  }

  static getPendingCount(): number {
    return this.getQueue().length;
  }
}

// Automatically sync whenever online event fires
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Online event detected. Flushing offline queue...');
    OfflineQueueEngine.flushQueue();
  });
}

export async function syncWriteWithOfflineFallback(
  collectionName: string,
  docId: string,
  data: any,
  timeoutMs: number = 4000
): Promise<{ success: boolean; syncedToFirestore: boolean; queuedOffline: boolean }> {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;

  if (!isOnline) {
    OfflineQueueEngine.enqueue(collectionName, docId, data, 'set');
    return { success: true, syncedToFirestore: false, queuedOffline: true };
  }

  try {
    const writePromise = dbSetDoc(collectionName, docId, data);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore write timeout')), timeoutMs)
    );

    await Promise.race([writePromise, timeoutPromise]);
    return { success: true, syncedToFirestore: true, queuedOffline: false };
  } catch (err) {
    console.warn(`[WriteSync] Firestore write failed or timed out for ${collectionName}/${docId}. Enqueuing offline:`, err);
    OfflineQueueEngine.enqueue(collectionName, docId, data, 'set');
    return { success: true, syncedToFirestore: false, queuedOffline: true };
  }
}
