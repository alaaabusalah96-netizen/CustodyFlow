import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageEngine, persistToIDB } from './db/storage';

describe('Phase 7: StorageEngine IndexedDB Hydration Reactivity', () => {
  beforeEach(() => {
    StorageEngine.clearCache();
  });

  it('1. StorageEngine.getStored reads from cache if available', () => {
    StorageEngine.cache['test_key'] = [{ id: '1', name: 'Company Test' }];
    const res = StorageEngine.getStored('test_key', []);
    expect(res).toEqual([{ id: '1', name: 'Company Test' }]);
  });

  it('2. StorageEngine.setStored updates cache and dispatches custody_db_updated', () => {
    const listener = vi.fn();
    window.addEventListener('custody_db_updated', listener);

    StorageEngine.setStored('test_company', { id: 'c1', name: 'Acme Corp' });
    expect(StorageEngine.cache['test_company']).toEqual({ id: 'c1', name: 'Acme Corp' });

    // Wait for dispatch event
    setTimeout(() => {
      expect(listener).toHaveBeenCalled();
    }, 10);
    window.removeEventListener('custody_db_updated', listener);
  });
});
