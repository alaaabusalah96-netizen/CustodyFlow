export class StorageEngine {
  public static cache: Record<string, any> = {};

  static clearCache(): void {
    StorageEngine.cache = {};
  }

  static initializeCacheListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('custody_db_updated', () => {
        StorageEngine.cache = {};
      });
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('custody_')) {
          StorageEngine.cache = {};
        }
      });
    }
  }

  static getStored<T>(key: string, defaultValue: T): T {
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }
    try {
      const data = localStorage.getItem(`custody_${key}`);
      const parsed = data ? JSON.parse(data) : defaultValue;
      this.cache[key] = parsed;
      return parsed;
    } catch {
      return defaultValue;
    }
  }

  static setStored<T>(key: string, value: T): void {
    this.cache[key] = value;
    try {
      localStorage.setItem(`custody_${key}`, JSON.stringify(value));
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new Event('custody_db_updated'));
        }, 0);
      }
    } catch (err: any) {
      console.error(`Failed to write custody_${key} to localStorage:`, err);
      const isQuotaError =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014 ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

      if (isQuotaError) {
        console.warn('⚠️ التخزين المحلي ممتلئ / Local storage quota exceeded.');
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert('⚠️ التخزين المحلي ممتلئ! يرجى تفريغ مساحة في المتصفح أو مسح البيانات القديمة.');
        }
      }
    }
  }
}
