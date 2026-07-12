import { Transaction, TransactionStatus } from '../types';
import { dbSetDoc } from '../firebase';
import { StorageEngine } from './storage';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { CompaniesModule } from './companies';
import { TransactionsHistoryModule } from './transactions.history';
import { ValidationEngine } from './validation';
import { DEFAULT_TRANSACTIONS } from './defaults';

export class TransactionsCreateModule {
  static addTransaction(data: Omit<Transaction, 'id' | 'transaction_no' | 'status' | 'created_at' | 'updated_at' | 'created_by'> & { status?: TransactionStatus }): Transaction {
    const transactions = StorageEngine.getStored<Transaction[]>('transactions', DEFAULT_TRANSACTIONS);
    const user = UsersModule.getActiveUser();
    const station_id = data.station_id || user?.station_id || 'stn-1-1-1';
    const company_id = user?.company_id || CompaniesModule.getSelectedCompanyId();

    const newTx: Transaction = {
      ...data,
      id: `tx-${Date.now()}`,
      transaction_no: '',
      status: data.status || 'Pending',
      created_by: user?.id || 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      station_id,
      company_id
    };

    // Run Validation
    const validation = ValidationEngine.validateTransaction(newTx, user);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(' \n '));
    }

    transactions.push(newTx);
    StorageEngine.setStored('transactions', transactions);

    dbSetDoc('transactions', newTx.id, newTx);

    TransactionsHistoryModule.addTransactionHistory({
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

    // Enhanced Audit with metadata
    LogsModule.logAudit(
      'CREATE_TRANSACTION',
      `Registered ${newTx.status} expense for ${newTx.amount.toLocaleString()} EGP - "${newTx.description}"`,
      { after: newTx }
    );

    return newTx;
  }
}
