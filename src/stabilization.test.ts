import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1. Mock firebase dependencies BEFORE any imports to prevent side effects
vi.mock('firebase/app', () => ({
  initializeApp: () => ({}),
}));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
}));
vi.mock('firebase/storage', () => ({
  getStorage: () => ({}),
}));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  getFirestore: () => ({}),
  doc: () => ({}),
  collection: () => ({}),
  setDoc: () => Promise.resolve(),
  deleteDoc: () => Promise.resolve(),
  onSnapshot: () => (() => {}),
  writeBatch: () => ({}),
  getDocs: () => Promise.resolve({ empty: true, docs: [] }),
  getDoc: () => Promise.resolve({ exists: () => false }),
  query: () => ({}),
  limit: () => ({}),
  where: () => ({}),
  startAfter: () => ({}),
  orderBy: () => ({}),
  runTransaction: () => Promise.resolve(true),
}));

// Mock window and dispatchEvent
if (typeof window === 'undefined') {
  (global as any).window = {
    dispatchEvent: () => {},
    addEventListener: () => {},
  };
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// 2. Import modules to be tested
import { ValidationEngine } from './db/validation';
import { TransactionsCreateModule } from './db/transactions.create';
import { TransactionsUpdateModule } from './db/transactions.update';
import { TransactionsReconciliationModule } from './db/transactions.reconciliation';
import { UsersModule } from './db/users';
import { hashPassword, legacyHashPassword } from './lib/hash';
import { StorageEngine } from './db/storage';
import { DEFAULT_USERS } from './db/defaults';

describe('CustodyFlow Stabilization Unit Tests (Phases 0 & 1)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    StorageEngine.clearCache();
  });

  describe('0.1 & 0.2: Transaction Category, Validation, and Safe Return Signatures', () => {
    it('should fallback to cat-6 if category_id is missing during creation', () => {
      // Mock active user
      const mockUser = DEFAULT_USERS[0]; // SystemAdmin
      StorageEngine.setStored('active_user', mockUser);
      StorageEngine.setStored('categories', [{ id: 'cat-6', name_ar: 'عام', name_en: 'General' }]);
      StorageEngine.setStored('stations', [{ id: 'stn-1', company_id: 'comp-1', custody_amount: 10000 }]);
      StorageEngine.setStored('companies', [{ id: 'comp-1', name_ar: 'الشركة', name_en: 'Company' }]);

      const txPayload = {
        amount: 250,
        description: 'Mock transaction without category',
        station_id: 'stn-1',
        company_id: 'comp-1',
        date: new Date().toISOString()
      };

      const result = TransactionsCreateModule.addTransaction(txPayload as any);
      expect(result.success).toBe(true);
      expect(result.data?.category_id).toBe('cat-6');
    });

    it('should return { success: false, errors: [...] } instead of throwing when validation fails', () => {
      const invalidTx = {
        amount: -50, // Invalid negative amount
        description: '', // Missing description
      };

      const result = TransactionsCreateModule.addTransaction(invalidTx as any);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should block modifying a Settled transaction and return error instead of throwing', () => {
      const settledTx = {
        id: 'tx-settled-1',
        amount: 1000,
        description: 'Already settled',
        status: 'Settled',
        category_id: 'cat-6',
        station_id: 'stn-1',
        company_id: 'comp-1',
        date: new Date().toISOString()
      };

      StorageEngine.setStored('transactions', [settledTx]);

      const result = TransactionsUpdateModule.updateTransaction('tx-settled-1', { amount: 1200 });
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Cannot modify, update, or void a Settled transaction');
    });
  });

  describe('0.3: Unified Cash Available Formula', () => {
    it('should correctly calculate remaining liquid cash: custodyValue - underSettlementTotal - pendingTotal', () => {
      // Mock Stations & Companies
      const mockStation = { id: 'stn-test-1', company_id: 'comp-1', custody_amount: 50000 };
      const mockCompany = { id: 'comp-1', name_ar: 'الشركة', name_en: 'Company' };
      StorageEngine.setStored('stations', [mockStation]);
      StorageEngine.setStored('companies', [mockCompany]);
      StorageEngine.setStored('selected_company_id', 'comp-1');

      // Mock transactions:
      // custodyValue = 50,000
      // Pending = 3,000
      // Under Settlement = 7,000
      // Settled = 10,000
      // Formula: cashAvailable = 50000 - 7000 - 3000 = 40000
      const mockTransactions = [
        { id: 'tx-1', amount: 3000, status: 'Pending', station_id: 'stn-test-1', company_id: 'comp-1' },
        { id: 'tx-2', amount: 7000, status: 'Under Settlement', station_id: 'stn-test-1', company_id: 'comp-1' },
        { id: 'tx-3', amount: 10000, status: 'Settled', station_id: 'stn-test-1', company_id: 'comp-1' },
      ];
      StorageEngine.setStored('transactions', mockTransactions);

      const recon = TransactionsReconciliationModule.getReconciliation('stn-test-1');
      expect(recon.cashAvailable).toBe(40000);
      expect(recon.pendingTotal).toBe(3000);
      expect(recon.underSettlementTotal).toBe(7000);
      expect(recon.settledTotal).toBe(10000);
    });
  });

  describe('1.1: Platform Owner Verification', () => {
    it('should verify correct platform owner email and block incorrect typo variants', () => {
      // Correct email should be owner
      expect(UsersModule.isPlatformOwner('alaaabusalah96@gmail.com')).toBe(true);
      expect(UsersModule.isPlatformOwner('alaaabusalah96@gmail.com ')).toBe(true); // check trimming
      expect(UsersModule.isPlatformOwner('ALAAABUSALAH96@GMAIL.COM')).toBe(true); // check casing

      // Typo variant should be rejected
      expect(UsersModule.isPlatformOwner('alaabusalah96@gmail.com')).toBe(false);
      expect(UsersModule.isPlatformOwner('other_user@gmail.com')).toBe(false);
      expect(UsersModule.isPlatformOwner(undefined)).toBe(false);
    });
  });

  describe('1.3: Salt and Pepper Password Hashing', () => {
    it('should generate secure SHA-256 salted-and-peppered passwords deterministically', () => {
      const pass = 'SuperSecret123!';
      const email = 'user@example.com';

      const hashed1 = hashPassword(pass, email);
      const hashed2 = hashPassword(pass, email);
      expect(hashed1).toBe(hashed2);
      expect(hashed1).toHaveLength(64); // SHA-256 hex is 64 chars

      // Changing the salt should result in a completely different hash
      const hashedDifferentSalt = hashPassword(pass, 'another@example.com');
      expect(hashed1).not.toBe(hashedDifferentSalt);

      // Checking backward compatibility support with legacy salted hash
      const legacyHashed = legacyHashPassword(pass, email);
      expect(hashed1).not.toBe(legacyHashed); // pepper makes them completely different
    });
  });
});
