import { 
  ExpenseCategory, 
  CustodyConfig, 
  Transaction, 
  TransactionStatus, 
  TransactionHistory, 
  DeletedTransaction, 
  CashVoucher 
} from '../types';
import { dbSetDoc, dbFetchPaginated } from '../firebase';
import { StorageEngine } from './storage';
import { DEFAULT_CATEGORIES, DEFAULT_TRANSACTIONS } from './defaults';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { CompaniesModule } from './companies';
import { StationsModule } from './stations';

// Import submodules
import { TransactionsCreateModule } from './transactions.create';
import { TransactionsUpdateModule } from './transactions.update';
import { TransactionsDeleteModule } from './transactions.delete';
import { TransactionsRestoreModule } from './transactions.restore';
import { TransactionsHistoryModule } from './transactions.history';
import { TransactionsVoucherModule } from './transactions.voucher';
import { TransactionsReconciliationModule } from './transactions.reconciliation';

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
    const activeCompany = companies.find(c => c.id === targetCompanyId) || companies[0] || { name: 'Unknown', custody_value: 0 } as any;
    return {
      company_name: activeCompany.name,
      custody_value: activeCompany.custody_value || 0,
      use_custom_template: activeCompany.use_custom_template || false,
      custom_template_image: activeCompany.custom_template_image || ''
    };
  }

  static saveConfig(config: CustodyConfig): void {
    const targetCompanyId = CompaniesModule.getSelectedCompanyId();
    const companies = CompaniesModule.getCompanies();
    const updated = companies.map(c => {
      if (c.id === targetCompanyId) {
        return { 
          ...c, 
          name: config.company_name, 
          custody_value: config.custody_value,
          use_custom_template: config.use_custom_template,
          custom_template_image: config.custom_template_image
        };
      }
      return c;
    });
    CompaniesModule.saveCompanies(updated);
    
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(
      user?.id || 'system', 
      user?.full_name || 'System', 
      'Update Custody', 
      `Adjusted company metadata for ${config.company_name}.`
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

  // Create
  static addTransaction(data: Omit<Transaction, 'id' | 'transaction_no' | 'status' | 'created_at' | 'updated_at' | 'created_by'> & { status?: TransactionStatus }): Transaction {
    return TransactionsCreateModule.addTransaction(data);
  }

  // Update
  static updateTransaction(id: string, updates: Partial<Transaction>): void {
    TransactionsUpdateModule.updateTransaction(id, updates);
  }

  // Delete
  static async deleteTransaction(id: string, reason: string): Promise<boolean> {
    return TransactionsDeleteModule.deleteTransaction(id, reason);
  }

  // Restore
  static async restoreTransaction(id: string): Promise<boolean> {
    return TransactionsRestoreModule.restoreTransaction(id);
  }

  // Reconciliation & Custody Metrics
  static getReconciliation(stationId?: string, regionId?: string) {
    return TransactionsReconciliationModule.getReconciliation(stationId, regionId);
  }

  static getStationDeductedCustody(stationId: string): number {
    return TransactionsReconciliationModule.getStationDeductedCustody(stationId);
  }

  static getCompanyDeductedCustody(companyId: string): number {
    return TransactionsReconciliationModule.getCompanyDeductedCustody(companyId);
  }

  // Voucher & Expenses
  static getExpenses(): any[] {
    return TransactionsVoucherModule.getExpenses();
  }

  static saveExpense(expense: any): void {
    TransactionsVoucherModule.saveExpense(expense);
  }

  static deleteExpense(id: string): void {
    TransactionsVoucherModule.deleteExpense(id);
  }

  static getCashVouchers(): CashVoucher[] {
    return TransactionsVoucherModule.getCashVouchers();
  }

  static saveCashVoucher(voucher: CashVoucher): void {
    TransactionsVoucherModule.saveCashVoucher(voucher);
  }

  static deleteCashVoucher(id: string): void {
    TransactionsVoucherModule.deleteCashVoucher(id);
  }

  static getCompanySequences(): { id: string; company_id: string; last_voucher_no: number }[] {
    return TransactionsVoucherModule.getCompanySequences();
  }

  static getCompanySequence(companyId: string): number | null {
    return TransactionsVoucherModule.getCompanySequence(companyId);
  }

  static hasCompanySequence(companyId: string): boolean {
    return TransactionsVoucherModule.hasCompanySequence(companyId);
  }

  static hasAnyVouchersForCompany(companyId: string): boolean {
    return TransactionsVoucherModule.hasAnyVouchersForCompany(companyId);
  }

  static needsManualFirstVoucherNo(companyId: string): boolean {
    return TransactionsVoucherModule.needsManualFirstVoucherNo(companyId);
  }

  static getNextAutoVoucherNo(companyId: string): string {
    return TransactionsVoucherModule.getNextAutoVoucherNo(companyId);
  }

  static async initializeOrIncrementSequence(companyId: string, manualFirstNo?: number): Promise<number> {
    return TransactionsVoucherModule.initializeOrIncrementSequence(companyId, manualFirstNo);
  }

  static async getNextDocumentNo(
    companyId: string, 
    docType: 'voucher' | 'expense' | 'transfer' | 'receipt' | 'inventory' | 'adjustment', 
    manualFirstNo?: number
  ): Promise<number> {
    return TransactionsVoucherModule.getNextDocumentNo(companyId, docType, manualFirstNo);
  }

  static async resetCompanySequence(companyId: string): Promise<void> {
    return TransactionsVoucherModule.resetCompanySequence(companyId);
  }

  // History & Deletes Log
  static getTransactionHistory(): TransactionHistory[] {
    return TransactionsHistoryModule.getTransactionHistory();
  }

  static addTransactionHistory(history: TransactionHistory): void {
    TransactionsHistoryModule.addTransactionHistory(history);
  }

  static getDeletedTransactions(): DeletedTransaction[] {
    return TransactionsHistoryModule.getDeletedTransactions();
  }

  static saveDeletedTransactions(records: DeletedTransaction[]): void {
    TransactionsHistoryModule.saveDeletedTransactions(records);
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
