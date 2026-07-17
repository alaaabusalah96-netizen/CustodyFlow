import { Transaction } from '../types';
import { dbSetDoc, dbDeleteDoc } from '../firebase';
import { StorageEngine } from './storage';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { StationsModule } from './stations';
import { CompaniesModule } from './companies';
import { TransactionsVoucherModule } from './transactions.voucher';
import { TransactionsHistoryModule } from './transactions.history';
import { CustodyService } from './custodyService';
import { ValidationEngine } from './validation';
import { DEFAULT_TRANSACTIONS } from './defaults';
import { AccountingBusinessEngine } from '../lib/enterprise/accounting_engine';
import { CustodyDB } from '../db';

export class TransactionsUpdateModule {
  static updateTransaction(id: string, updates: Partial<Transaction>): void {
    const transactions = StorageEngine.getStored<Transaction[]>('transactions', DEFAULT_TRANSACTIONS);
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const user = UsersModule.getActiveUser();
      const old = transactions[idx];
      const updated = {
        ...old,
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Run Validation
      const validation = ValidationEngine.validateTransaction(updated, user);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(' \n '));
      }

      // 1. Status change to Settled
      if (updates.status === 'Settled' && old.status !== 'Settled') {
        const amount = updated.amount;
        const stationId = updated.station_id;
        const compId = updated.company_id || user?.company_id || CompaniesModule.getSelectedCompanyId();
        if (stationId) {
          CustodyService.applySettlement(stationId, compId, amount);
        }

        // Auto-post double-entry accounting record
        try {
          const cats = CustodyDB.getCategories();
          const cat = cats.find(c => c.id === updated.category_id);
          const catName = cat ? (cat.name_en || '') : '';
          const expenseCode = catName.toLowerCase().includes('fuel') || catName.includes('وقود') ? '510201' : '510101';
          const statementAr = `قيد تلقائي: تسوية مصروف ${cat ? (cat.name_ar || cat.name_en || '') : ''} - سند رقم ${updated.voucher_no || ''}`;
          const statementEn = `Auto-post: Settlement of ${catName} expense - Voucher #${updated.voucher_no || ''}`;
          
          AccountingBusinessEngine.postOperationalDoubleEntry(
            compId,
            user?.id || 'system',
            `Voucher #${updated.voucher_no || 'N/A'}`,
            statementAr,
            statementEn,
            [
              { accountCode: expenseCode, debit: amount, credit: 0, notes: `Debit: Operational Expense (${updated.transaction_no})` },
              { accountCode: '110101', debit: 0, credit: amount, notes: `Credit: Cash in Hand` }
            ]
          ).catch(err => console.error('Automated double-entry posting failed:', err));
        } catch (err) {
          console.error('Automated double-entry posting preparation failed:', err);
        }
      }

      // 2. Status change away from Settled
      if (old.status === 'Settled' && updates.status !== undefined && updates.status !== 'Settled') {
        const amount = old.amount;
        const stationId = old.station_id;
        const compId = old.company_id || user?.company_id || CompaniesModule.getSelectedCompanyId();
        if (stationId) {
          CustodyService.rollbackSettlement(stationId, compId, amount);
        }
      }

      // 3. Amount change while already Settled
      if (old.status === 'Settled' && (updates.status === undefined || updates.status === 'Settled') && updates.amount !== undefined && updates.amount !== old.amount) {
        const diff = updates.amount - old.amount;
        const stationId = old.station_id;
        const compId = old.company_id || user?.company_id || CompaniesModule.getSelectedCompanyId();
        if (stationId) {
          // positive diff means more expense (deduct more from custody)
          // negative diff means less expense (add back to custody)
          CustodyService.updateStationCustody(stationId, -diff);
          CustodyService.updateCompanyCustody(compId, -diff);
        }
      }

      // 4. Handle Voucher Association status modifications
      if (updates.status && updates.status !== old.status) {
        const vouchers = TransactionsVoucherModule.getCashVouchers();
        const associatedVoucher = vouchers.find(v => v.expense_ids && v.expense_ids.includes(id));
        if (associatedVoucher) {
          let voucherStatus = associatedVoucher.status;
          let expenseIds = [...associatedVoucher.expense_ids];
          let voucherAmount = associatedVoucher.amount;

          if (updates.status === 'Pending' || updates.status === 'Rejected') {
            expenseIds = expenseIds.filter(eid => eid !== id);
            voucherAmount = Math.max(0, voucherAmount - old.amount);
            if (expenseIds.length === 0) {
              voucherStatus = 'Draft';
            }
            updated.voucher_no = '';
            updated.voucher_date = '';
          } else if (updates.status === 'Under Settlement') {
            voucherStatus = 'Approved';
          } else if (updates.status === 'Settled') {
            voucherStatus = 'Settled';
          }

          const updatedVoucher = {
            ...associatedVoucher,
            expense_ids: expenseIds,
            amount: voucherAmount,
            status: voucherStatus,
            updated_at: new Date().toISOString()
          };

          const updatedVouchers = vouchers.map(v => v.id === associatedVoucher.id ? updatedVoucher : v);
          const finalVouchers = updatedVouchers.filter(v => v.expense_ids && v.expense_ids.length > 0);
          StorageEngine.setStored('CashVouchers', finalVouchers);

          if (updatedVoucher.expense_ids.length === 0) {
            dbDeleteDoc('CashVouchers', associatedVoucher.id);
          } else {
            dbSetDoc('CashVouchers', associatedVoucher.id, updatedVoucher);
          }
        }
      }

      transactions[idx] = updated;
      StorageEngine.setStored('transactions', transactions);
      dbSetDoc('transactions', id, updated);

      if (updates.status && updates.status !== old.status) {
        let action = 'Status Updated';
        let notes = `Status changed from ${old.status} to ${updates.status}`;
        
        if (updates.status === 'Under Settlement') {
          action = 'Voucher Linked';
          notes = `Linked with Cash Payment Voucher ${updates.voucher_no || old.voucher_no || ''} on ${updates.voucher_date || old.voucher_date || ''}`;
        } else if (updates.status === 'Settled') {
          action = 'Approved & Settled';
          notes = 'Voucher approved and settled against custody.';
        } else if (updates.status === 'Pending') {
          action = 'Reverted';
          notes = 'Returned to Pending status for modification.';
        } else if (updates.status === 'Rejected') {
          action = 'Rejected';
          notes = 'Voucher was rejected by management.';
        }

        TransactionsHistoryModule.addTransactionHistory({
          id: `txh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          transaction_id: id,
          action,
          performed_by: user?.id || 'unknown',
          performed_by_name: user?.full_name || 'Anonymous',
          timestamp: new Date().toISOString(),
          previous_status: old.status,
          new_status: updates.status,
          notes
        });
      }

      let details = `Updated fields on transaction ${old.transaction_no}.`;
      if (updates.status === 'Under Settlement') {
        details = `Settled transaction ${old.transaction_no} under Cash Payment Voucher ${updates.voucher_no || ''}.`;
      }
      LogsModule.addLog(
        user?.id || 'unknown',
        user?.full_name || 'Anonymous',
        updates.status === 'Under Settlement' ? 'Settle Transaction' : 'Update Transaction',
        details
      );

      LogsModule.logAudit(
        'UPDATE_TRANSACTION',
        `Updated transaction ${old.transaction_no} (Status: ${old.status} ➔ ${updated.status}).`,
        { before: old, after: updated }
      );
    }
  }
}
