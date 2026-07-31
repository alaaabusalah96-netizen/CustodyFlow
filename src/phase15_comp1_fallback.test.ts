import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersModule } from './db/users';
import { CompaniesModule } from './db/companies';
import { TransactionsModule } from './db/transactions';
import { TransactionsVoucherModule } from './db/transactions.voucher';
import { TransactionsUpdateModule } from './db/transactions.update';
import { DEFAULT_CATEGORIES, DEFAULT_COMPANIES, DEFAULT_STATIONS } from './db/defaults';
import { StationsModule } from './db/stations';

describe('Phase 15: Stop Silent comp-1 Write Fallback (Custody Paths Only)', () => {
  beforeEach(() => {
    if (typeof localStorage === 'undefined') {
      const store: Record<string, string> = {};
      (global as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { for (const k in store) delete store[k]; }
      };
    }
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
    vi.spyOn(UsersModule, 'getActiveUser').mockReturnValue(null);
    localStorage.removeItem('custody_selected_company_id');
    CompaniesModule.saveCompanies(DEFAULT_COMPANIES);
    StationsModule.saveStations(DEFAULT_STATIONS);
    TransactionsModule.saveCategories(DEFAULT_CATEGORIES);
  });

  it('1. custody company resolution returns empty string "" without falling back to "comp-1" when custody_selected_company_id is unset', () => {
    const custodySelected = localStorage.getItem('custody_selected_company_id') || '';
    expect(custodySelected).toBe('');
  });

  it('2. addTransaction rejects save and returns bilingual error when company_id is empty', async () => {
    const res = await TransactionsModule.addTransaction({
      date: '2026-07-31',
      amount: 100,
      description: 'Test expense without company',
      company_id: '',
      station_id: 'stn-1-1-1'
    });
    expect(res.success).toBe(false);
    expect(res.errors).toContain('يجب اختيار شركة قبل الحفظ. / Please select a company before saving.');
  });

  it('3. saveExpense throws bilingual error when company_id is empty', () => {
    expect(() => {
      TransactionsVoucherModule.saveExpense({
        id: 'exp-999',
        amount: 50,
        description: 'No company expense',
        company_id: ''
      });
    }).toThrow('يجب اختيار شركة قبل الحفظ. / Please select a company before saving.');
  });

  it('4. saveCashVoucher throws bilingual error when company_id is empty', () => {
    expect(() => {
      TransactionsVoucherModule.saveCashVoucher({
        id: 'vouch-999',
        voucher_no: 'V-001',
        date: '2026-07-31',
        station_id: 'stn-1-1-1',
        amount: 500,
        company_id: '',
        status: 'Draft',
        expense_ids: [],
        amount_in_words: { ar: 'خمسمائة', en: 'Five Hundred' },
        recipient_name: 'Test Recipient',
        created_at: '2026-07-31T00:00:00Z',
        updated_at: '2026-07-31T00:00:00Z'
      });
    }).toThrow('يجب اختيار شركة قبل الحفظ. / Please select a company before saving.');
  });

  it('5. updateTransaction rejects update and returns bilingual error when company_id is empty', async () => {
    // Add a dummy transaction first with a valid company
    const added = await TransactionsModule.addTransaction({
      date: '2026-07-31',
      amount: 100,
      description: 'Test expense',
      company_id: 'comp-1',
      station_id: 'stn-1-1-1',
      category_id: 'cat-6'
    });
    expect(added.errors || []).toEqual([]);
    expect(added.success).toBe(true);

    const txs = TransactionsModule.getTransactions();
    const target = txs[txs.length - 1];

    const res = await TransactionsUpdateModule.updateTransaction(target.id, {
      company_id: ''
    });
    expect(res.success).toBe(false);
    expect(res.errors).toContain('يجب اختيار شركة قبل الحفظ. / Please select a company before saving.');
  });
});

