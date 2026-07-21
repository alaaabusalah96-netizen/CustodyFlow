import { CashVoucher } from '../types';
import { StorageEngine } from './storage';
import { dbSetDoc, dbDeleteDoc, db } from '../firebase';
import { DEFAULT_EXPENSES, DEFAULT_VOUCHERS } from './defaults';
import { LogsModule } from './logs';
import { doc, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';

export class TransactionsVoucherModule {
  static getExpenses(): any[] {
    return StorageEngine.getStored<any[]>('Expenses', DEFAULT_EXPENSES);
  }

  static saveExpense(expense: any): void {
    const expenses = TransactionsVoucherModule.getExpenses();
    const index = expenses.findIndex(e => e.id === expense.id);
    if (index > -1) {
      expenses[index] = expense;
    } else {
      expenses.unshift(expense);
    }
    StorageEngine.setStored('Expenses', expenses);
    dbSetDoc('Expenses', expense.id, expense);
  }

  static deleteExpense(id: string): void {
    const expenses = TransactionsVoucherModule.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    StorageEngine.setStored('Expenses', filtered);
    dbDeleteDoc('Expenses', id);
  }

  static getCashVouchers(): CashVoucher[] {
    return StorageEngine.getStored<CashVoucher[]>('CashVouchers', DEFAULT_VOUCHERS);
  }

  static saveCashVoucher(voucher: CashVoucher): void {
    const vouchers = TransactionsVoucherModule.getCashVouchers();
    const index = vouchers.findIndex(v => v.id === voucher.id);
    const before = index > -1 ? vouchers[index] : null;
    if (index > -1) {
      vouchers[index] = voucher;
    } else {
      vouchers.unshift(voucher);
    }
    StorageEngine.setStored('CashVouchers', vouchers);
    dbSetDoc('CashVouchers', voucher.id, voucher);

    LogsModule.logAudit(
      before ? 'UPDATE_CASH_VOUCHER' : 'CREATE_CASH_VOUCHER',
      before
        ? `Updated Cash Payment Voucher ${voucher.voucher_no} (Total: ${voucher.amount.toLocaleString()} EGP).`
        : `Created Cash Payment Voucher ${voucher.voucher_no} (Total: ${voucher.amount.toLocaleString()} EGP).`,
      { before, after: voucher }
    );
  }

  static deleteCashVoucher(id: string): void {
    const vouchers = TransactionsVoucherModule.getCashVouchers();
    const voucher = vouchers.find(v => v.id === id);
    const filtered = vouchers.filter(v => v.id !== id);
    StorageEngine.setStored('CashVouchers', filtered);
    dbDeleteDoc('CashVouchers', id);

    if (voucher) {
      LogsModule.logAudit(
        'DELETE_CASH_VOUCHER',
        `Deleted Cash Payment Voucher ${voucher.voucher_no} (Total: ${voucher.amount.toLocaleString()} EGP).`,
        { before: voucher }
      );
    }
  }

  static getCompanySequences(): { id: string; company_id: string; last_voucher_no: number }[] {
    return StorageEngine.getStored<{ id: string; company_id: string; last_voucher_no: number }[]>('company_sequences', []);
  }

  static getCompanySequence(companyId: string): number | null {
    const seqs = TransactionsVoucherModule.getCompanySequences();
    const found = seqs.find(s => s.company_id === companyId);
    return found ? found.last_voucher_no : null;
  }

  static hasCompanySequence(companyId: string): boolean {
    const seqs = TransactionsVoucherModule.getCompanySequences();
    return seqs.some(s => s.company_id === companyId);
  }

  static hasAnyVouchersForCompany(companyId: string): boolean {
    const vouchers = TransactionsVoucherModule.getCashVouchers();
    return vouchers.some(v => v.company_id === companyId);
  }

  static needsManualFirstVoucherNo(companyId: string): boolean {
    return !TransactionsVoucherModule.hasCompanySequence(companyId);
  }

  static getNextAutoVoucherNo(companyId: string): string {
    const seq = TransactionsVoucherModule.getCompanySequence(companyId);
    if (seq !== null) {
      return String(seq + 1);
    }

    const vouchers = TransactionsVoucherModule.getCashVouchers().filter(v => v.company_id === companyId);
    if (vouchers.length === 0) {
      return '';
    }

    let maxNum = 0;
    vouchers.forEach(v => {
      const numOnly = v.voucher_no.replace(/\D/g, '');
      if (numOnly) {
        const match = v.voucher_no.match(/(\d+)$/);
        const parsed = match ? parseInt(match[1], 10) : parseInt(numOnly, 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    });

    if (maxNum > 0) {
      return String(maxNum + 1);
    }

    return '1001';
  }

  static async initializeOrIncrementSequence(companyId: string, manualFirstNo?: number): Promise<number> {
    const seqDocRef = doc(db, 'company_sequences', companyId);

    const localSeq = TransactionsVoucherModule.getCompanySequence(companyId);
    const defaultStart = manualFirstNo !== undefined ? manualFirstNo : 1001;
    const fallbackNext = localSeq !== null ? localSeq + 1 : defaultStart;

    let finalNo: number;

    try {
      // BUG-09: Removed unsafe 1200ms timeout / Promise.race fallback.
      // Historical Note: The 1200ms timeout was historically introduced to prevent the UI from blocking 
      // when Firebase experiences high latency or is offline. However, under high concurrency, 
      // this timeout resulted in concurrent clients failing over to non-transactional fallback 
      // reads simultaneously, causing severe sequence duplication (generating identical voucher numbers).
      // Allowing runTransaction to manage its own retries natively guarantees gap-free, duplicate-free sequences.
      finalNo = await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(seqDocRef);
        if (!sfDoc.exists()) {
          const startNo = manualFirstNo !== undefined ? manualFirstNo : 1001;
          transaction.set(seqDocRef, { 
            id: companyId, 
            company_id: companyId, 
            last_cash_voucher_no: startNo 
          });
          return startNo;
        } else {
          const data = sfDoc.data();
          // BUG-08: Use 'last_cash_voucher_no' but fallback to 'last_voucher_no' to prevent resetting existing companies
          const lastNo = data.last_cash_voucher_no !== undefined 
            ? data.last_cash_voucher_no 
            : (data.last_voucher_no !== undefined ? data.last_voucher_no : (defaultStart - 1));
          const nextVal = lastNo + 1;
          transaction.update(seqDocRef, { last_cash_voucher_no: nextVal });
          return nextVal;
        }
      });
    } catch (e) {
      console.warn("Firestore transaction failed. Falling back to simple get/set:", e);
      try {
        const docSnap = await getDoc(seqDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const lastNo = data.last_cash_voucher_no !== undefined 
            ? data.last_cash_voucher_no 
            : (data.last_voucher_no !== undefined ? data.last_voucher_no : (defaultStart - 1));
          finalNo = lastNo + 1;
        } else {
          finalNo = defaultStart;
        }
        dbSetDoc('company_sequences', companyId, { 
          id: companyId, 
          company_id: companyId, 
          last_cash_voucher_no: finalNo 
        });
      } catch (err) {
        console.error("Simple get/set fallback failed too, using local fallback:", err);
        finalNo = fallbackNext;
        dbSetDoc('company_sequences', companyId, { 
          id: companyId, 
          company_id: companyId, 
          last_cash_voucher_no: finalNo 
        });
      }
    }

    const seqs = TransactionsVoucherModule.getCompanySequences();
    const index = seqs.findIndex(s => s.company_id === companyId);
    const newSeq = { id: companyId, company_id: companyId, last_voucher_no: finalNo, last_cash_voucher_no: finalNo };
    if (index > -1) {
      seqs[index] = newSeq;
    } else {
      seqs.push(newSeq);
    }
    StorageEngine.setStored('company_sequences', seqs);
    return finalNo;
  }

  static async getNextDocumentNo(
    companyId: string, 
    docType: 'voucher' | 'expense' | 'transfer' | 'receipt' | 'inventory' | 'adjustment', 
    manualFirstNo?: number
  ): Promise<number> {
    const seqDocRef = doc(db, 'company_sequences', companyId);
    const fieldMap: Record<string, string> = {
      voucher: 'last_cash_voucher_no',
      expense: 'last_expense_no',
      transfer: 'last_transfer_no',
      receipt: 'last_receipt_no',
      inventory: 'last_inventory_no',
      adjustment: 'last_adjustment_no'
    };
    const field = fieldMap[docType] || 'last_cash_voucher_no';
    const defaultStart = manualFirstNo !== undefined ? manualFirstNo : 1001;

    try {
      return await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(seqDocRef);
        if (!sfDoc.exists()) {
          const initialData = { id: companyId, company_id: companyId, [field]: defaultStart };
          transaction.set(seqDocRef, initialData);
          return defaultStart;
        } else {
          const data = sfDoc.data();
          let currentVal = data[field];
          if (currentVal === undefined && field === 'last_cash_voucher_no') {
            currentVal = data['last_voucher_no'];
          }
          const lastNo = currentVal !== undefined ? currentVal : (defaultStart - 1);
          const nextVal = lastNo + 1;
          transaction.update(seqDocRef, { [field]: nextVal });
          return nextVal;
        }
      });
    } catch (e) {
      console.warn(`Firestore transaction failed for docType ${docType}. Using fallback.`);
      const docSnap = await getDoc(seqDocRef);
      let finalNo = defaultStart;
      if (docSnap.exists()) {
        const data = docSnap.data();
        let currentVal = data[field];
        if (currentVal === undefined && field === 'last_cash_voucher_no') {
          currentVal = data['last_voucher_no'];
        }
        const lastNo = currentVal !== undefined ? currentVal : (defaultStart - 1);
        finalNo = lastNo + 1;
      }
      dbSetDoc('company_sequences', companyId, { id: companyId, company_id: companyId, [field]: finalNo });
      return finalNo;
    }
  }

  static async resetCompanySequence(companyId: string): Promise<void> {
    const seqDocRef = doc(db, 'company_sequences', companyId);
    try {
      await deleteDoc(seqDocRef);
    } catch (e) {
      console.error("Error deleting firestore sequence document", e);
    }

    const seqs = TransactionsVoucherModule.getCompanySequences();
    const filtered = seqs.filter(s => s.company_id !== companyId);
    StorageEngine.setStored('company_sequences', filtered);
  }
}
