import { TransactionHistory, DeletedTransaction } from '../types';
import { StorageEngine } from './storage';
import { dbSetDoc } from '../firebase';
import { DEFAULT_TX_HISTORY } from './defaults';

export class TransactionsHistoryModule {
  static getTransactionHistory(): TransactionHistory[] {
    return StorageEngine.getStored<TransactionHistory[]>('TransactionHistory', DEFAULT_TX_HISTORY);
  }

  static addTransactionHistory(history: TransactionHistory): void {
    const records = TransactionsHistoryModule.getTransactionHistory();
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
}
