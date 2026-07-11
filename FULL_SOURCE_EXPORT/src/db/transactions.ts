import { 
  ExpenseCategory, 
  CustodyConfig, 
  Transaction, 
  TransactionStatus, 
  TransactionHistory, 
  DeletedTransaction, 
  CashVoucher, 
  Notification, 
  ActivityLog, 
  AuditLog, 
  Station, 
  Company, 
  Region 
} from '../types';
import { dbSetDoc, dbDeleteDoc, db, dbFetchPaginated } from '../firebase';
import { StorageEngine } from './storage';
import { 
  DEFAULT_CATEGORIES, 
  DEFAULT_TRANSACTIONS, 
  DEFAULT_EXPENSES, 
  DEFAULT_VOUCHERS, 
  DEFAULT_TX_HISTORY 
} from './defaults';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { CompaniesModule } from './companies';
import { StationsModule } from './stations';
import { writeBatch, doc } from 'firebase/firestore';

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  if (typeof obj === 'object') {
    const cleanObj: any = {};
    Object.keys(obj).forEach(k => {
      if (obj[k] !== undefined) {
        cleanObj[k] = cleanUndefined(obj[k]);
      }
    });
    return cleanObj;
  }
  return obj;
};

export class TransactionsModule {
  // Expense Categories
  static getCategories(): ExpenseCategory[] {
    return StorageEngine.getStored<ExpenseCategory[]>('categories', DEFAULT_CATEGORIES);
  }

  static saveCategories(categories: ExpenseCategory[]): void {
    StorageEngine.setStored('categories', categories);
    categories.forEach(c => dbSetDoc('categories', c.id, c));
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Categories', 'Modified available expense category configurations.');
  }

  // Custody Config
  static getConfig(): CustodyConfig {
    const targetCompanyId = CompaniesModule.getSelectedCompanyId();
    const companies = CompaniesModule.getCompanies();
    const activeCompany = companies.find(c => c.id === targetCompanyId) || companies[0] || { name: 'Unknown', custody_value: 0 };
    return {
      company_name: activeCompany.name,
      custody_value: activeCompany.custody_value
    };
  }

  static saveConfig(config: CustodyConfig): void {
    const targetCompanyId = CompaniesModule.getSelectedCompanyId();
    const companies = CompaniesModule.getCompanies();
    const updated = companies.map(c => {
      if (c.id === targetCompanyId) {
        return { ...c, name: config.company_name, custody_value: config.custody_value };
      }
      return c;
    });
    CompaniesModule.saveCompanies(updated);
    
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(
      user?.id || 'system', 
      user?.full_name || 'System', 
      'Update Custody', 
      `Adjusted company metadata for ${config.company_name}. Custody Base set to ${config.custody_value.toLocaleString()} EGP.`
    );
  }

  // Transactions list
  static getTransactions(): Transaction[] {
    return StorageEngine.getStored<Transaction[]>('transactions', DEFAULT_TRANSACTIONS);
  }

  static getScopedTransactions(): Transaction[] {
    const txs = TransactionsModule.getTransactions();
    const user = UsersModule.getActiveUser();
    if (!user) return txs;
    
    const targetCompanyId = CompaniesModule.getSelectedCompanyId();
    const companyTxs = txs.filter(t => t.company_id === targetCompanyId);
    
    if (user.role === 'Admin' || user.role === 'SystemAdmin') {
      return companyTxs;
    }
    if (user.role === 'RegionalManager') {
      const stations = StationsModule.getStations();
      const regionStations = stations.filter(s => {
        const isSameCompany = s.company_id === targetCompanyId;
        if (!isSameCompany) return false;
        if (!user.region_id) return true;
        return s.region_id === user.region_id || !s.region_id || s.region_id === '' || s.region_id === 'none';
      });
      const targetStationIds = regionStations.map(s => s.id);
      return companyTxs.filter(t => t.station_id && targetStationIds.includes(t.station_id));
    }
    const userStationId = user.station_id || 'stn-1-1-1';
    return companyTxs.filter(t => t.station_id === userStationId);
  }

  static saveTransactions(transactions: Transaction[]): void {
    StorageEngine.setStored('transactions', transactions);
  }

  static addTransaction(data: Omit<Transaction, 'id' | 'transaction_no' | 'status' | 'created_at' | 'updated_at' | 'created_by'> & { status?: TransactionStatus }): Transaction {
    const transactions = TransactionsModule.getTransactions();
    const transaction_no = "";
    
    const user = UsersModule.getActiveUser();
    const station_id = data.station_id || user?.station_id || 'stn-1-1-1';
    const company_id = user?.company_id || CompaniesModule.getSelectedCompanyId();

    const newTx: Transaction = {
      ...data,
      id: `tx-${Date.now()}`,
      transaction_no,
      status: data.status || 'Pending',
      created_by: user?.id || 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      station_id,
      company_id
    };

    transactions.push(newTx);
    TransactionsModule.saveTransactions(transactions);

    dbSetDoc('transactions', newTx.id, newTx);

    TransactionsModule.addTransactionHistory({
      id: `txh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      transaction_id: newTx.id,
      action: 'Created',
      performed_by: user?.id || 'unknown',
      performed_by_name: user?.full_name || 'Anonymous',
      timestamp: newTx.created_at,
      new_status: newTx.status,
      notes: newTx.notes || `Registered ${newTx.status} expense`
    });

    LogsModule.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Create Transaction',
      `Registered ${newTx.status} expense for ${newTx.amount.toLocaleString()} EGP - "${newTx.description}"`
    );

    LogsModule.logAudit(
      'CREATE_TRANSACTION',
      `Registered ${newTx.status} expense for ${newTx.amount.toLocaleString()} EGP - "${newTx.description}"`,
      { after: newTx }
    );

    return newTx;
  }

  static updateTransaction(id: string, updates: Partial<Transaction>): void {
    const transactions = TransactionsModule.getTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const user = UsersModule.getActiveUser();
      const old = transactions[idx];
      const updated = {
        ...old,
        ...updates,
        updated_at: new Date().toISOString()
      };

      if (updates.status === 'Settled' && old.status !== 'Settled') {
        const amount = updated.amount;
        const stationId = updated.station_id;
        if (stationId) {
          const stations = StationsModule.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const nextAmount = oldAmount - amount;
            stations[stIdx] = {
              ...stations[stIdx],
              custody_amount: nextAmount
            };
            StationsModule.saveStations(stations);
            dbSetDoc('stations', stationId, stations[stIdx]);

            const compId = stations[stIdx].company_id || CompaniesModule.getSelectedCompanyId();
            const companies = CompaniesModule.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) - amount
              };
              companies[compIdx] = updatedCompany;
              CompaniesModule.saveCompanies(companies);
              dbSetDoc('companies', compId, updatedCompany);
            }
          }
        }
      }

      if (old.status === 'Settled' && updates.status !== undefined && updates.status !== 'Settled') {
        const amount = old.amount;
        const stationId = old.station_id;
        if (stationId) {
          const stations = StationsModule.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const nextAmount = oldAmount + amount;
            stations[stIdx] = {
              ...stations[stIdx],
              custody_amount: nextAmount
            };
            StationsModule.saveStations(stations);
            dbSetDoc('stations', stationId, stations[stIdx]);

            const compId = stations[stIdx].company_id || CompaniesModule.getSelectedCompanyId();
            const companies = CompaniesModule.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) + amount
              };
              companies[compIdx] = updatedCompany;
              CompaniesModule.saveCompanies(companies);
              dbSetDoc('companies', compId, updatedCompany);
            }
          }
        }
      }

      if (old.status === 'Settled' && (updates.status === undefined || updates.status === 'Settled') && updates.amount !== undefined && updates.amount !== old.amount) {
        const diff = updates.amount - old.amount;
        const stationId = old.station_id;
        if (stationId) {
          const stations = StationsModule.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const nextAmount = oldAmount - diff;
            stations[stIdx] = {
              ...stations[stIdx],
              custody_amount: nextAmount
            };
            StationsModule.saveStations(stations);
            dbSetDoc('stations', stationId, stations[stIdx]);

            const compId = stations[stIdx].company_id || CompaniesModule.getSelectedCompanyId();
            const companies = CompaniesModule.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) - diff
              };
              companies[compIdx] = updatedCompany;
              CompaniesModule.saveCompanies(companies);
              dbSetDoc('companies', compId, updatedCompany);
            }
          }
        }
      }

      if (updates.status && updates.status !== old.status) {
        const vouchers = TransactionsModule.getCashVouchers();
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
      TransactionsModule.saveTransactions(transactions);

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

        TransactionsModule.addTransactionHistory({
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

  static async deleteTransaction(id: string, reason: string): Promise<boolean> {
    const user = UsersModule.getActiveUser();
    if (!user) return false;

    const transactions = TransactionsModule.getTransactions();
    const tx = transactions.find(t => t.id === id);
    if (!tx) return false;

    let isAuthorized = false;
    if (user.role === 'Admin' || user.role === 'SystemAdmin') {
      isAuthorized = true;
    } else if (user.role === 'RegionalManager') {
      const stations = StationsModule.getStations();
      const txStation = stations.find(s => s.id === tx.station_id);
      if (txStation && txStation.region_id === user.region_id) {
        isAuthorized = true;
      } else if (!tx.station_id) {
        isAuthorized = true;
      }
    } else if (user.role === 'StationAdmin') {
      if (tx.station_id === user.station_id) {
        isAuthorized = true;
      }
    } else if (user.id === tx.created_by) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      LogsModule.addLog(user?.id || 'unknown', user?.full_name || 'Anonymous', 'Access Rejected', `Attempted to delete transaction ${tx.transaction_no} without correct privileges.`);
      return false;
    }

    const stations = StationsModule.getStations();
    const station = stations.find(s => s.id === tx.station_id);
    const stationName = station ? station.station_name : (tx.station_id || 'Unknown');
    
    const regions = StationsModule.getRegions();
    const region = station ? regions.find(r => r.id === station.region_id) : null;
    const regionName = region ? region.name : 'Unknown';

    const updatedTxs = transactions.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'Deleted' as any,
          updated_at: new Date().toISOString()
        };
      }
      return t;
    });

    const vouchers = TransactionsModule.getCashVouchers();
    const updatedVouchers = vouchers.map(v => {
      if (v.expense_ids && v.expense_ids.includes(id)) {
        const remainingIds = v.expense_ids.filter(eid => eid !== id);
        const newAmount = Math.max(0, v.amount - tx.amount);
        return {
          ...v,
          expense_ids: remainingIds,
          amount: newAmount,
          status: (remainingIds.length === 0 ? 'Rejected' : v.status) as any
        };
      }
      return v;
    });

    const deletedRecordId = `del-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const deletedRecord: DeletedTransaction = {
      id: deletedRecordId,
      transaction_id: tx.id,
      transaction_no: tx.transaction_no,
      transaction_data: tx,
      transaction_type: 'Expense',
      amount: tx.amount,
      created_by_name: tx.created_by === 'user-regular' ? 'Mariam Ali' : (tx.created_by === 'user-admin' ? 'Ahmed El-Sayed' : tx.created_by),
      deleted_by_name: user.full_name,
      deleted_by_role: user.role,
      deleted_at: new Date().toISOString(),
      delete_reason: reason,
      station_name: stationName,
      region_name: regionName,
      branch: stationName,
      company_id: tx.company_id || user.company_id || '',
      description: tx.description,
      original_status: tx.status
    };

    const notificationsToSend: Notification[] = [];
    const allUsers = UsersModule.getUsers();

    const deletedByRoleAr = user.role === 'StationAdmin' ? 'أمين عهدة محطة' : (user.role === 'RegionalManager' ? 'مدير منطقة' : (user.role === 'Admin' ? 'أدمن الشركة' : 'مشرف النظام'));
    const deletedByRoleEn = user.role === 'StationAdmin' ? 'Station Cashier' : (user.role === 'RegionalManager' ? 'Regional Manager' : (user.role === 'Admin' ? 'Company Admin' : 'System Admin'));

    const notificationTitleAr = `⚠️ تم حذف عملية: ${tx.transaction_no}`;
    const notificationTitleEn = `⚠️ Deleted Transaction: ${tx.transaction_no}`;

    const notificationMessageAr = `قام [${user.full_name}] (${deletedByRoleAr}) بحذف عملية رقم (${tx.transaction_no}) بمبلغ (${tx.amount.toLocaleString()} ج.م) التابعة لمحطة [${stationName}]. سبب الحذف: ${reason}`;
    const notificationMessageEn = `[${user.full_name}] (${deletedByRoleEn}) deleted transaction (${tx.transaction_no}) worth (${tx.amount.toLocaleString()} EGP) of station [${stationName}]. Reason: ${reason}`;

    if (user.role === 'StationAdmin') {
      const regionalManagers = allUsers.filter(u => 
        u.role === 'RegionalManager' && 
        u.company_id === tx.company_id && 
        (station && u.region_id === station.region_id)
      );

      const companyAdmins = allUsers.filter(u => 
        u.role === 'Admin' && 
        u.company_id === tx.company_id
      );

      regionalManagers.forEach(rm => {
        notificationsToSend.push({
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: rm.id,
          title_ar: notificationTitleAr,
          title_en: notificationTitleEn,
          message_ar: notificationMessageAr,
          message_en: notificationMessageEn,
          is_read: false,
          type: 'warning',
          related_id: deletedRecordId,
          created_at: new Date().toISOString()
        });
      });

      companyAdmins.forEach(ca => {
        notificationsToSend.push({
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: ca.id,
          title_ar: notificationTitleAr,
          title_en: notificationTitleEn,
          message_ar: notificationMessageAr,
          message_en: notificationMessageEn,
          is_read: false,
          type: 'warning',
          related_id: deletedRecordId,
          created_at: new Date().toISOString()
        });
      });

    } else if (user.role === 'RegionalManager') {
      const companyAdmins = allUsers.filter(u => 
        u.role === 'Admin' && 
        u.company_id === tx.company_id
      );

      companyAdmins.forEach(ca => {
        notificationsToSend.push({
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: ca.id,
          title_ar: notificationTitleAr,
          title_en: notificationTitleEn,
          message_ar: notificationMessageAr,
          message_en: notificationMessageEn,
          is_read: false,
          type: 'warning',
          related_id: deletedRecordId,
          created_at: new Date().toISOString()
        });
      });
    }

    const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const logDetails = `Deleted transaction ${tx.transaction_no} worth ${tx.amount.toLocaleString()} EGP. Reason: ${reason}`;
    const newLog: ActivityLog = {
      id: logId,
      user_id: user.id,
      user_name: user.full_name,
      action: 'Delete Transaction',
      details: logDetails,
      timestamp: new Date().toISOString()
    };

    const auditLogId = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newAuditLog: AuditLog = {
      id: auditLogId,
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      action_type: 'DELETE_TRANSACTION',
      description: logDetails,
      timestamp: new Date().toISOString(),
      details: { before: tx, delete_reason: reason }
    };

    try {
      const batch = writeBatch(db);

      if (tx.status === 'Settled') {
        const amount = tx.amount;
        const stationId = tx.station_id;
        if (stationId) {
          const stations = StationsModule.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const updatedStation = {
              ...stations[stIdx],
              custody_amount: oldAmount + amount
            };
            stations[stIdx] = updatedStation;
            StationsModule.saveStations(stations);
            batch.set(doc(db, 'stations', stationId), cleanUndefined(updatedStation));

            const compId = stations[stIdx].company_id || CompaniesModule.getSelectedCompanyId();
            const companies = CompaniesModule.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) + amount
              };
              companies[compIdx] = updatedCompany;
              CompaniesModule.saveCompanies(companies);
              batch.set(doc(db, 'companies', compId), cleanUndefined(updatedCompany));
            }
          }
        }
      }

      const updatedTxObj = {
        ...tx,
        status: 'Deleted' as any,
        updated_at: new Date().toISOString()
      };
      batch.set(doc(db, 'transactions', tx.id), cleanUndefined(updatedTxObj));

      updatedVouchers.forEach(v => {
        if (v.expense_ids && v.expense_ids.length === 0) {
          batch.delete(doc(db, 'CashVouchers', v.id));
        } else {
          batch.set(doc(db, 'CashVouchers', v.id), cleanUndefined(v));
        }
      });

      batch.set(doc(db, 'deleted_transactions', deletedRecordId), cleanUndefined(deletedRecord));

      notificationsToSend.forEach(ntf => {
        batch.set(doc(db, 'Notifications', ntf.id), cleanUndefined(ntf));
      });

      batch.set(doc(db, 'logs', logId), cleanUndefined(newLog));
      batch.set(doc(db, 'AuditLogs', auditLogId), cleanUndefined(newAuditLog));

      await batch.commit();

      TransactionsModule.saveTransactions(updatedTxs);

      const currentDeleted = TransactionsModule.getDeletedTransactions();
      currentDeleted.unshift(deletedRecord);
      TransactionsModule.saveDeletedTransactions(currentDeleted);

      const remainingVouchers = updatedVouchers.filter(v => v.expense_ids && v.expense_ids.length > 0);
      StorageEngine.setStored('CashVouchers', remainingVouchers);

      const currentNotifications = StorageEngine.getStored<Notification[]>('Notifications', []);
      notificationsToSend.forEach(n => currentNotifications.unshift(n));
      StorageEngine.setStored('Notifications', currentNotifications);

      const currentLogs = StorageEngine.getStored<ActivityLog[]>('logs', []);
      currentLogs.unshift(newLog);
      StorageEngine.setStored('logs', currentLogs.slice(0, 150));

      const currentAudit = StorageEngine.getStored<AuditLog[]>('AuditLogs', []);
      currentAudit.unshift(newAuditLog);
      StorageEngine.setStored('AuditLogs', currentAudit);

      return true;
    } catch (err) {
      console.error('Database transaction failed. Changes rolled back. Error:', err);
      return false;
    }
  }

  static async restoreTransaction(id: string): Promise<boolean> {
    const user = UsersModule.getActiveUser();
    if (!user) return false;

    const deletedTxList = TransactionsModule.getDeletedTransactions();
    const delRecord = deletedTxList.find(d => d.id === id || d.transaction_id === id);
    if (!delRecord) {
      console.error('restoreTransaction: Deleted transaction record not found', id);
      return false;
    }

    const txId = delRecord.transaction_id || id;
    const originalStatus = (delRecord.original_status || 'Pending') as any;

    const transactions = TransactionsModule.getTransactions();
    const tx = transactions.find(t => t.id === txId || t.id === id);
    if (!tx) {
      console.error('restoreTransaction: Transaction not found in local state', txId);
      return false;
    }

    let isAuthorized = false;
    if (user.role === 'Admin' || user.role === 'SystemAdmin') {
      isAuthorized = true;
    } else if (user.role === 'RegionalManager') {
      const stations = StationsModule.getStations();
      const txStation = stations.find(s => s.id === tx.station_id);
      if (txStation && txStation.region_id === user.region_id) {
        isAuthorized = true;
      } else if (!tx.station_id) {
        isAuthorized = true;
      }
    } else if (user.role === 'StationAdmin') {
      if (tx.station_id === user.station_id) {
        isAuthorized = true;
      }
    } else if (user.id === tx.created_by) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      LogsModule.addLog(user?.id || 'unknown', user?.full_name || 'Anonymous', 'Access Rejected', `Attempted to restore transaction ${tx.transaction_no} without correct privileges.`);
      return false;
    }

    const stations = StationsModule.getStations();
    const station = stations.find(s => s.id === tx.station_id);
    const stationName = station ? station.station_name : (tx.station_id || 'Unknown');
    
    const regions = StationsModule.getRegions();
    const region = station ? regions.find(r => r.id === station.region_id) : null;
    const regionName = region ? region.name : 'Unknown';

    const updatedTxs = transactions.map(t => {
      if (t.id === tx.id) {
        return {
          ...t,
          status: originalStatus,
          updated_at: new Date().toISOString()
        };
      }
      return t;
    });

    const vouchers = TransactionsModule.getCashVouchers();
    let voucherToUpdateOrRecreate: CashVoucher | null = null;
    let isRecreatingVoucher = false;

    if (tx.voucher_no) {
      const existingVoucher = vouchers.find(v => v.voucher_no === tx.voucher_no);
      if (existingVoucher) {
        const expenseIds = existingVoucher.expense_ids || [];
        if (!expenseIds.includes(tx.id)) {
          expenseIds.push(tx.id);
        }
        const newAmount = existingVoucher.amount + tx.amount;
        voucherToUpdateOrRecreate = {
          ...existingVoucher,
          expense_ids: expenseIds,
          amount: newAmount,
          status: (existingVoucher.status === 'Rejected' ? 'Approved' : existingVoucher.status) as any
        };
      } else {
        isRecreatingVoucher = true;
        voucherToUpdateOrRecreate = {
          id: `vch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          voucher_no: tx.voucher_no,
          date: tx.voucher_date || tx.date || new Date().toISOString().split('T')[0],
          station_id: tx.station_id || '',
          company_id: tx.company_id || user.company_id || '',
          amount: tx.amount,
          amount_in_words: tx.amount_in_words || { ar: 'مسترجع', en: 'Restored' },
          recipient_name: tx.description || 'Restored Expense',
          status: (originalStatus === 'Settled' ? 'Settled' : 'Approved') as any,
          expense_ids: [tx.id],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    }

    let updatedStationObj: Station | null = null;
    let updatedCompanyObj: Company | null = null;

    if (originalStatus === 'Settled') {
      const amount = tx.amount;
      const stationId = tx.station_id;
      if (stationId) {
        const stIdx = stations.findIndex(s => s.id === stationId);
        if (stIdx !== -1) {
          const oldAmount = stations[stIdx].custody_amount;
          const nextCustody = Math.max(0, oldAmount - amount);
          updatedStationObj = {
            ...stations[stIdx],
            custody_amount: nextCustody
          };
          stations[stIdx] = updatedStationObj;
          StationsModule.saveStations(stations);

          const compId = stations[stIdx].company_id || CompaniesModule.getSelectedCompanyId();
          const companies = CompaniesModule.getCompanies();
          const compIdx = companies.findIndex(c => c.id === compId);
          if (compIdx !== -1) {
            const updatedCompany = {
              ...companies[compIdx],
              custody_value: Math.max(0, (companies[compIdx].custody_value || 0) - amount)
            };
            companies[compIdx] = updatedCompany;
            CompaniesModule.saveCompanies(companies);
            updatedCompanyObj = updatedCompany;
          }
        }
      }
    }

    const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const logDetails = `Restored transaction ${tx.transaction_no} worth ${tx.amount.toLocaleString()} EGP back to status: ${originalStatus}.`;
    const newLog: ActivityLog = {
      id: logId,
      user_id: user.id,
      user_name: user.full_name,
      action: 'Restore Transaction',
      details: logDetails,
      timestamp: new Date().toISOString()
    };

    const auditLogId = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newAuditLog: AuditLog = {
      id: auditLogId,
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      action_type: 'RESTORE_TRANSACTION',
      description: logDetails,
      timestamp: new Date().toISOString(),
      details: { transaction_id: tx.id, restored_status: originalStatus }
    };

    const notificationsToSend: Notification[] = [];
    const allUsers = UsersModule.getUsers();

    const restoredByRoleAr = user.role === 'StationAdmin' ? 'أمين عهدة محطة' : (user.role === 'RegionalManager' ? 'مدير منطقة' : (user.role === 'Admin' ? 'أدمن الشركة' : 'مشرف النظام'));
    const restoredByRoleEn = user.role === 'StationAdmin' ? 'Station Cashier' : (user.role === 'RegionalManager' ? 'Regional Manager' : (user.role === 'Admin' ? 'Company Admin' : 'System Admin'));

    const notificationTitleAr = `✅ تم استرجاع عملية: ${tx.transaction_no}`;
    const notificationTitleEn = `✅ Restored Transaction: ${tx.transaction_no}`;

    const notificationMessageAr = `قام [${user.full_name}] (${restoredByRoleAr}) باسترجاع عملية رقم (${tx.transaction_no}) بمبلغ (${tx.amount.toLocaleString()} ج.م) التابعة لمحطة [${stationName}]. الحالة المسترجعة: ${originalStatus}`;
    const notificationMessageEn = `[${user.full_name}] (${restoredByRoleEn}) restored transaction (${tx.transaction_no}) worth (${tx.amount.toLocaleString()} EGP) of station [${stationName}]. Restored status: ${originalStatus}`;

    if (user.role === 'StationAdmin') {
      const regionalManagers = allUsers.filter(u => 
        u.role === 'RegionalManager' && 
        u.company_id === tx.company_id && 
        (station && u.region_id === station.region_id)
      );
      const companyAdmins = allUsers.filter(u => u.role === 'Admin' && u.company_id === tx.company_id);

      regionalManagers.concat(companyAdmins).forEach(recipient => {
        notificationsToSend.push({
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: recipient.id,
          title_ar: notificationTitleAr,
          title_en: notificationTitleEn,
          message_ar: notificationMessageAr,
          message_en: notificationMessageEn,
          is_read: false,
          type: 'success',
          related_id: tx.id,
          created_at: new Date().toISOString()
        });
      });
    } else if (user.role === 'RegionalManager') {
      const companyAdmins = allUsers.filter(u => u.role === 'Admin' && u.company_id === tx.company_id);
      companyAdmins.forEach(ca => {
        notificationsToSend.push({
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: ca.id,
          title_ar: notificationTitleAr,
          title_en: notificationTitleEn,
          message_ar: notificationMessageAr,
          message_en: notificationMessageEn,
          is_read: false,
          type: 'success',
          related_id: tx.id,
          created_at: new Date().toISOString()
        });
      });
    }

    try {
      const batch = writeBatch(db);

      const restoredTxObj = {
        ...tx,
        status: originalStatus,
        updated_at: new Date().toISOString()
      };
      batch.set(doc(db, 'transactions', tx.id), cleanUndefined(restoredTxObj));

      if (delRecord) {
        batch.delete(doc(db, 'deleted_transactions', delRecord.id));
      }

      if (updatedStationObj) {
        batch.set(doc(db, 'stations', updatedStationObj.id), cleanUndefined(updatedStationObj));
      }
      if (updatedCompanyObj) {
        batch.set(doc(db, 'companies', updatedCompanyObj.id), cleanUndefined(updatedCompanyObj));
      }

      if (voucherToUpdateOrRecreate) {
        batch.set(doc(db, 'CashVouchers', voucherToUpdateOrRecreate.id), cleanUndefined(voucherToUpdateOrRecreate));
      }

      notificationsToSend.forEach(ntf => {
        batch.set(doc(db, 'Notifications', ntf.id), cleanUndefined(ntf));
      });

      batch.set(doc(db, 'logs', logId), cleanUndefined(newLog));
      batch.set(doc(db, 'AuditLogs', auditLogId), cleanUndefined(newAuditLog));

      await batch.commit();

      TransactionsModule.saveTransactions(updatedTxs);

      if (delRecord) {
        const remainingDeleted = deletedTxList.filter(d => d.id !== delRecord.id);
        TransactionsModule.saveDeletedTransactions(remainingDeleted);
      }

      if (voucherToUpdateOrRecreate) {
        const updatedVouchers = vouchers.map(v => v.id === voucherToUpdateOrRecreate!.id ? voucherToUpdateOrRecreate! : v);
        if (isRecreatingVoucher || !vouchers.some(v => v.id === voucherToUpdateOrRecreate!.id)) {
          updatedVouchers.unshift(voucherToUpdateOrRecreate);
        }
        StorageEngine.setStored('CashVouchers', updatedVouchers);
      }

      const currentNotifications = StorageEngine.getStored<Notification[]>('Notifications', []);
      notificationsToSend.forEach(n => currentNotifications.unshift(n));
      StorageEngine.setStored('Notifications', currentNotifications);

      const currentLogs = StorageEngine.getStored<ActivityLog[]>('logs', []);
      currentLogs.unshift(newLog);
      StorageEngine.setStored('logs', currentLogs.slice(0, 150));

      const currentAudit = StorageEngine.getStored<AuditLog[]>('AuditLogs', []);
      currentAudit.unshift(newAuditLog);
      StorageEngine.setStored('AuditLogs', currentAudit);

      return true;
    } catch (err) {
      console.error('Database transaction failed on restore. Error:', err);
      return false;
    }
  }

  static getReconciliation(stationId?: string, regionId?: string) {
    const targetCompanyId = CompaniesModule.getSelectedCompanyId();
    const stations = StationsModule.getStations().filter(s => s.company_id === targetCompanyId);
    const transactions = TransactionsModule.getTransactions().filter(t => t.company_id === targetCompanyId);
    const user = UsersModule.getActiveUser();

    let targetStationIds: string[] = [];
    let custodyValue = 0;

    if (stationId) {
      targetStationIds = [stationId];
      const st = stations.find(s => s.id === stationId);
      custodyValue = st ? st.custody_amount : 0;
    } else if (regionId) {
      const regionStations = stations.filter(s => s.region_id === regionId || !s.region_id || s.region_id === '' || s.region_id === 'none');
      targetStationIds = regionStations.map(s => s.id);
      custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
    } else if (user) {
      if (user.role === 'Admin' || user.role === 'SystemAdmin') {
        targetStationIds = stations.map(s => s.id);
        custodyValue = stations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else if (user.role === 'RegionalManager') {
        const regionStations = stations.filter(s => {
          if (!user.region_id) return true;
          return s.region_id === user.region_id || !s.region_id || s.region_id === '' || s.region_id === 'none';
        });
        targetStationIds = regionStations.map(s => s.id);
        custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else {
        const userStationId = user.station_id || 'stn-1-1-1';
        targetStationIds = [userStationId];
        const st = stations.find(s => s.id === userStationId);
        custodyValue = st ? st.custody_amount : 0;
      }
    } else {
      targetStationIds = [stations[0]?.id || 'stn-1-1-1'];
      const st = stations.find(s => s.id === (stations[0]?.id || 'stn-1-1-1'));
      custodyValue = st ? st.custody_amount : 0;
    }

    const filteredTxs = transactions.filter(t => t.station_id && targetStationIds.includes(t.station_id));

    const pendingTotal = filteredTxs
      .filter(t => t.status === 'Pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const underSettlementTotal = filteredTxs
      .filter(t => t.status === 'Under Settlement')
      .reduce((sum, t) => sum + t.amount, 0);

    const settledTotal = filteredTxs
      .filter(t => t.status === 'Settled')
      .reduce((sum, t) => sum + t.amount, 0);

    const cashAvailable = custodyValue - pendingTotal - underSettlementTotal;

    const pendingCount = filteredTxs.filter(t => t.status === 'Pending').length;
    const underSettlementCount = filteredTxs.filter(t => t.status === 'Under Settlement').length;
    const settledCount = filteredTxs.filter(t => t.status === 'Settled').length;

    const originalCustodyValue = custodyValue + settledTotal;
    const adjustedCustodyValue = custodyValue;

    return {
      custodyValue: adjustedCustodyValue,
      originalCustodyValue,
      cashAvailable,
      pendingTotal,
      underSettlementTotal,
      settledTotal,
      pendingCount,
      underSettlementCount,
      settledCount
    };
  }

  static getStationDeductedCustody(stationId: string): number {
    const stations = StationsModule.getStations();
    const st = stations.find(s => s.id === stationId);
    if (!st) return 0;
    return st.custody_amount;
  }

  static getCompanyDeductedCustody(companyId: string): number {
    const companies = CompaniesModule.getCompanies();
    const comp = companies.find(c => c.id === companyId);
    if (!comp) return 0;
    return comp.custody_value || 0;
  }

  static getExpenses(): any[] {
    return StorageEngine.getStored<any[]>('Expenses', DEFAULT_EXPENSES);
  }

  static saveExpense(expense: any): void {
    const expenses = TransactionsModule.getExpenses();
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
    const expenses = TransactionsModule.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    StorageEngine.setStored('Expenses', filtered);
    dbDeleteDoc('Expenses', id);
  }

  static getCashVouchers(): CashVoucher[] {
    return StorageEngine.getStored<CashVoucher[]>('CashVouchers', DEFAULT_VOUCHERS);
  }

  static saveCashVoucher(voucher: CashVoucher): void {
    const vouchers = TransactionsModule.getCashVouchers();
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
    const vouchers = TransactionsModule.getCashVouchers();
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
    const seqs = TransactionsModule.getCompanySequences();
    const found = seqs.find(s => s.company_id === companyId);
    return found ? found.last_voucher_no : null;
  }

  static hasCompanySequence(companyId: string): boolean {
    const seqs = TransactionsModule.getCompanySequences();
    return seqs.some(s => s.company_id === companyId);
  }

  static hasAnyVouchersForCompany(companyId: string): boolean {
    const vouchers = TransactionsModule.getCashVouchers();
    return vouchers.some(v => v.company_id === companyId);
  }

  static needsManualFirstVoucherNo(companyId: string): boolean {
    return !TransactionsModule.hasCompanySequence(companyId);
  }

  static getNextAutoVoucherNo(companyId: string): string {
    const seq = TransactionsModule.getCompanySequence(companyId);
    if (seq !== null) {
      return String(seq + 1);
    }

    const vouchers = TransactionsModule.getCashVouchers().filter(v => v.company_id === companyId);
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
    const { doc, getDoc } = await import('firebase/firestore');
    const seqDocRef = doc(db, 'company_sequences', companyId);

    const localSeq = TransactionsModule.getCompanySequence(companyId);
    const defaultStart = manualFirstNo !== undefined ? manualFirstNo : 1001;
    const fallbackNext = localSeq !== null ? localSeq + 1 : defaultStart;

    const runTransactionPromise = (async () => {
      const { runTransaction } = await import('firebase/firestore');
      return await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(seqDocRef);
        if (!sfDoc.exists()) {
          const startNo = manualFirstNo !== undefined ? manualFirstNo : 1001;
          transaction.set(seqDocRef, { id: companyId, company_id: companyId, last_voucher_no: startNo });
          return startNo;
        } else {
          const lastNo = sfDoc.data().last_voucher_no;
          const nextVal = lastNo + 1;
          transaction.update(seqDocRef, { last_voucher_no: nextVal });
          return nextVal;
        }
      });
    })();

    let finalNo: number;
    let timedOut = false;

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, 1200);
    });

    const result = await Promise.race([
      runTransactionPromise,
      timeoutPromise
    ]);

    if (result !== null && !timedOut) {
      finalNo = result;
    } else {
      console.warn("Firestore transaction timed out or failed. Falling back to simple get/set or local sequence.");
      try {
        const docSnap = await getDoc(seqDocRef);
        if (docSnap.exists()) {
          const lastNo = docSnap.data().last_voucher_no;
          finalNo = lastNo + 1;
        } else {
          finalNo = defaultStart;
        }
        dbSetDoc('company_sequences', companyId, { id: companyId, company_id: companyId, last_voucher_no: finalNo });
      } catch (e) {
        console.error("Simple get/set failed too, using local fallback:", e);
        finalNo = fallbackNext;
        dbSetDoc('company_sequences', companyId, { id: companyId, company_id: companyId, last_voucher_no: finalNo });
      }
    }

    const seqs = TransactionsModule.getCompanySequences();
    const index = seqs.findIndex(s => s.company_id === companyId);
    const newSeq = { id: companyId, company_id: companyId, last_voucher_no: finalNo };
    if (index > -1) {
      seqs[index] = newSeq;
    } else {
      seqs.push(newSeq);
    }
    StorageEngine.setStored('company_sequences', seqs);
    return finalNo;
  }

  static async resetCompanySequence(companyId: string): Promise<void> {
    const { deleteDoc, doc } = await import('firebase/firestore');
    const seqDocRef = doc(db, 'company_sequences', companyId);
    try {
      await deleteDoc(seqDocRef);
    } catch (e) {
      console.error("Error deleting firestore sequence document", e);
    }

    const seqs = TransactionsModule.getCompanySequences();
    const filtered = seqs.filter(s => s.company_id !== companyId);
    StorageEngine.setStored('company_sequences', filtered);
  }

  static getTransactionHistory(): TransactionHistory[] {
    return StorageEngine.getStored<TransactionHistory[]>('TransactionHistory', DEFAULT_TX_HISTORY);
  }

  static addTransactionHistory(history: TransactionHistory): void {
    const records = TransactionsModule.getTransactionHistory();
    records.unshift(history);
    StorageEngine.setStored('TransactionHistory', records);
    dbSetDoc('TransactionHistory', history.id, history);
  }

  static getDeletedTransactions(): DeletedTransaction[] {
    return StorageEngine.getStored<DeletedTransaction[]>('deleted_transactions', []);
  }

  static saveDeletedTransactions(records: DeletedTransaction[]): void {
    StorageEngine.setStored('deleted_transactions', records);
  }

  static async fetchPaginated<T>(
    collectionName: string,
    limitVal: number,
    lastDocId?: string
  ): Promise<{ data: T[]; lastDocId?: string; hasMore: boolean }> {
    const companyId = CompaniesModule.getSelectedCompanyId();
    return dbFetchPaginated<T>(collectionName, companyId, limitVal, lastDocId);
  }
}
