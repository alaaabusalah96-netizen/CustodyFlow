import { 
  AppUser, 
  ExpenseCategory, 
  Transaction, 
  TransactionStatus, 
  ActivityLog, 
  CustodyConfig, 
  Region, 
  Station, 
  Company, 
  UserRole, 
  UserPermissions, 
  CashVoucher, 
  TransactionHistory, 
  Notification, 
  AuditLog, 
  SystemPermission, 
  SystemRole, 
  DeletedTransaction, 
  SignupRequest 
} from './types';

import { seedDatabaseIfEmpty, setupFirebaseSync, dbFetchUserByEmail } from './firebase';

import { StorageEngine } from './db/storage';
import { 
  DEFAULT_COMPANIES,
  DEFAULT_REGIONS,
  DEFAULT_STATIONS,
  DEFAULT_CATEGORIES,
  DEFAULT_USERS,
  DEFAULT_TRANSACTIONS,
  DEFAULT_LOGS,
  DEFAULT_CONFIG,
  DEFAULT_EXPENSES,
  DEFAULT_VOUCHERS,
  DEFAULT_TX_HISTORY,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_AUDIT_LOGS,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES
} from './db/defaults';

import { LogsModule } from './db/logs';
import { UsersModule } from './db/users';
import { hashPassword, legacyHashPassword, legacySinglePassHashPassword, legacyStretchedHashPassword1000 } from './lib/hash';
import { CompaniesModule } from './db/companies';
import { StationsModule } from './db/stations';
import { NotificationsModule } from './db/notifications';
import { TransactionsModule } from './db/transactions';
import { ModulesModule, ERP_MODULES_REGISTRY, CompanyModuleSettings } from './db/modules';
import { ConfigurationEngine } from './lib/enterprise/configuration';
import { TenantSettings } from './types/enterprise';
import { db } from './firebase';

export { hashPassword, legacyHashPassword, legacySinglePassHashPassword, legacyStretchedHashPassword1000, ModulesModule, ERP_MODULES_REGISTRY, type CompanyModuleSettings, ConfigurationEngine, type TenantSettings };

export class CustodyDB {
  static hashPassword(password: string, salt: string = ''): string {
    return hashPassword(password, salt);
  }

  static legacyStretchedHashPassword1000(password: string, salt: string = ''): string {
    return legacyStretchedHashPassword1000(password, salt);
  }

  static legacySinglePassHashPassword(password: string, salt: string = ''): string {
    return legacySinglePassHashPassword(password, salt);
  }

  static legacyHashPassword(password: string, salt: string = ''): string {
    return legacyHashPassword(password, salt);
  }

  static initializeFirebase(): void {
    seedDatabaseIfEmpty({
      companies: DEFAULT_COMPANIES,
      regions: DEFAULT_REGIONS,
      stations: DEFAULT_STATIONS,
      categories: DEFAULT_CATEGORIES,
      users: DEFAULT_USERS,
      transactions: DEFAULT_TRANSACTIONS,
      logs: DEFAULT_LOGS,
      config: DEFAULT_CONFIG,
      expenses: DEFAULT_EXPENSES,
      cashVouchers: DEFAULT_VOUCHERS,
      transactionHistory: DEFAULT_TX_HISTORY,
      notifications: DEFAULT_NOTIFICATIONS,
      auditLogs: DEFAULT_AUDIT_LOGS,
      permissions: DEFAULT_PERMISSIONS,
      roles: DEFAULT_ROLES
    }).then(() => {
      setupFirebaseSync();
    }).catch(err => {
      console.warn('Failed to seed or synchronize with Firebase, running in fallback mode:', err);
    });
  }

  static enrichUserPermissions(role: UserRole, currentPerms?: Partial<UserPermissions>): UserPermissions {
    return UsersModule.enrichUserPermissions(role, currentPerms);
  }

  static clearCache(): void {
    StorageEngine.clearCache();
  }

  static initializeCacheListener(): void {
    StorageEngine.initializeCacheListener();
  }

  // Companies
  static getCompanies(): Company[] {
    return CompaniesModule.getCompanies();
  }

  static saveCompanies(companies: Company[]): void {
    CompaniesModule.saveCompanies(companies);
  }

  static addCompany(name: string, custodyValue?: number): Company {
    return CompaniesModule.addCompany(name, custodyValue);
  }

  static updateCompany(id: string, updates: Partial<Company>): void {
    CompaniesModule.updateCompany(id, updates);
  }

  static deleteCompany(id: string): void {
    CompaniesModule.deleteCompany(id);
  }

  static getSelectedCompanyId(): string {
    return CompaniesModule.getSelectedCompanyId();
  }

  static setSelectedCompanyId(id: string): void {
    CompaniesModule.setSelectedCompanyId(id);
  }

  static toggleCompanyStatus(companyId: string, isActive: boolean): void {
    CompaniesModule.toggleCompanyStatus(companyId, isActive);
  }

  static updateCompanySubscription(
    companyId: string,
    plan: Company['subscription_plan'],
    status: Company['subscription_status'],
    expiry: string
  ): void {
    CompaniesModule.updateCompanySubscription(companyId, plan, status, expiry);
  }

  // Users
  static isPlatformOwner(email?: string): boolean {
    return UsersModule.isPlatformOwner(email);
  }

  static getUsers(): AppUser[] {
    return UsersModule.getUsers();
  }

  static getActiveUser(): AppUser | null {
    return UsersModule.getActiveUser();
  }

  static setActiveUser(user: AppUser | null): void {
    UsersModule.setActiveUser(user);
  }

  static async saveUsers(users: AppUser[]): Promise<void> {
    return UsersModule.saveUsers(users);
  }

  static async fetchUserByEmail(email: string): Promise<AppUser | null> {
    return dbFetchUserByEmail(email);
  }

  static upsertLocalUser(user: AppUser): void {
    UsersModule.upsertLocalUser(user);
  }

  static getScopedUsers(): AppUser[] {
    return UsersModule.getScopedUsers();
  }

  static impersonateUser(targetUser: AppUser, reason?: string): void {
    UsersModule.impersonateUser(targetUser, reason);
  }

  static exitImpersonation(): void {
    UsersModule.exitImpersonation();
  }

  static async resetUserPassword(userId: string, newPasswordPlain: string): Promise<void> {
    return UsersModule.resetUserPassword(userId, newPasswordPlain);
  }

  static getPermissions(): SystemPermission[] {
    return UsersModule.getPermissions();
  }

  static savePermission(permission: SystemPermission): void {
    UsersModule.savePermission(permission);
  }

  static getRoles(): SystemRole[] {
    return UsersModule.getRoles();
  }

  static saveRole(role: SystemRole): void {
    UsersModule.saveRole(role);
  }

  static getSignupRequests(): SignupRequest[] {
    return UsersModule.getSignupRequests();
  }

  static saveSignupRequest(request: SignupRequest): void {
    UsersModule.saveSignupRequest(request);
  }

  static deleteSignupRequest(id: string): void {
    UsersModule.deleteSignupRequest(id);
  }

  // Regions
  static getRegions(): Region[] {
    return StationsModule.getRegions();
  }

  static getScopedRegions(): Region[] {
    return StationsModule.getScopedRegions();
  }

  static saveRegions(regions: Region[]): void {
    StationsModule.saveRegions(regions);
  }

  static addRegion(name: string, code?: string, companyId?: string): Region {
    return StationsModule.addRegion(name, code, companyId);
  }

  static updateRegion(id: string, updates: Partial<Region>): void {
    StationsModule.updateRegion(id, updates);
  }

  static deleteRegion(id: string): void {
    StationsModule.deleteRegion(id);
  }

  // Stations
  static getStations(): Station[] {
    return StationsModule.getStations();
  }

  static getScopedStations(): Station[] {
    return StationsModule.getScopedStations();
  }

  static saveStations(stations: Station[]): void {
    StationsModule.saveStations(stations);
  }

  static addStation(name: string, code: string, custodyAmount: number, regionId?: string, companyId?: string): Station {
    return StationsModule.addStation(name, code, custodyAmount, regionId, companyId);
  }

  static updateStation(id: string, updates: Partial<Station>): void {
    StationsModule.updateStation(id, updates);
  }

  static deleteStation(id: string): void {
    StationsModule.deleteStation(id);
  }

  // Notifications
  static getNotifications(): Notification[] {
    return NotificationsModule.getNotifications();
  }

  static saveNotification(notification: Notification): void {
    NotificationsModule.saveNotification(notification);
  }

  static markNotificationAsRead(id: string): void {
    NotificationsModule.markNotificationAsRead(id);
  }

  // Logs
  static getLogs(): ActivityLog[] {
    return LogsModule.getLogs();
  }

  static addLog(
    userId: string,
    userName: string,
    action: string,
    details: string,
    stationId?: string,
    companyId?: string,
    amount?: number,
    notes?: string
  ): void {
    LogsModule.addLog(userId, userName, action, details, stationId, companyId, amount, notes);
  }

  static deleteLog(id: string): void {
    LogsModule.deleteLog(id);
  }

  static updateReplenishmentLog(id: string, amount: number, notes: string, details: string): void {
    LogsModule.updateReplenishmentLog(id, amount, notes, details);
  }

  static getAuditLogs(): AuditLog[] {
    return LogsModule.getAuditLogs();
  }

  static addAuditLog(auditLog: AuditLog): void {
    LogsModule.addAuditLog(auditLog);
  }

  static logAudit(actionType: string, description: string, details?: Record<string, any>): void {
    LogsModule.logAudit(actionType, description, details);
  }

  // Config
  static getConfig(): CustodyConfig {
    return TransactionsModule.getConfig();
  }

  static saveConfig(config: CustodyConfig): void {
    TransactionsModule.saveConfig(config);
  }

  // Categories
  static getCategories(): ExpenseCategory[] {
    return TransactionsModule.getCategories();
  }

  static saveCategories(categories: ExpenseCategory[]): void {
    TransactionsModule.saveCategories(categories);
  }

  // Transactions
  static getTransactions(): Transaction[] {
    return TransactionsModule.getTransactions();
  }

  static getScopedTransactions(): Transaction[] {
    return TransactionsModule.getScopedTransactions();
  }

  static saveTransactions(transactions: Transaction[]): void {
    TransactionsModule.saveTransactions(transactions);
  }

  static async addTransaction(data: Omit<Transaction, 'id' | 'transaction_no' | 'status' | 'created_at' | 'updated_at' | 'created_by'> & { status?: TransactionStatus }): Promise<{ success: boolean; errors?: string[]; data?: Transaction }> {
    return TransactionsModule.addTransaction(data);
  }

  static async updateTransaction(id: string, updates: Partial<Transaction>): Promise<{ success: boolean; errors?: string[] }> {
    return TransactionsModule.updateTransaction(id, updates);
  }

  static deleteTransaction(id: string, reason: string): Promise<boolean> {
    return TransactionsModule.deleteTransaction(id, reason);
  }

  static restoreTransaction(id: string): Promise<boolean> {
    return TransactionsModule.restoreTransaction(id);
  }

  static getReconciliation(stationId?: string, regionId?: string, orgUnitId?: string) {
    return TransactionsModule.getReconciliation(stationId, regionId, orgUnitId);
  }

  static getStationDeductedCustody(stationId: string): number {
    return TransactionsModule.getStationDeductedCustody(stationId);
  }

  static getCompanyDeductedCustody(companyId: string): number {
    return TransactionsModule.getCompanyDeductedCustody(companyId);
  }

  static getExpenses(): any[] {
    return TransactionsModule.getExpenses();
  }

  static saveExpense(expense: any): void {
    TransactionsModule.saveExpense(expense);
  }

  static deleteExpense(id: string): void {
    TransactionsModule.deleteExpense(id);
  }

  static getCashVouchers(): CashVoucher[] {
    return TransactionsModule.getCashVouchers();
  }

  static saveCashVoucher(voucher: CashVoucher): void {
    TransactionsModule.saveCashVoucher(voucher);
  }

  static deleteCashVoucher(id: string): void {
    TransactionsModule.deleteCashVoucher(id);
  }

  static getCompanySequences(): { id: string; company_id: string; last_voucher_no: number }[] {
    return TransactionsModule.getCompanySequences();
  }

  static getCompanySequence(companyId: string): number | null {
    return TransactionsModule.getCompanySequence(companyId);
  }

  static hasCompanySequence(companyId: string): boolean {
    return TransactionsModule.hasCompanySequence(companyId);
  }

  static hasAnyVouchersForCompany(companyId: string): boolean {
    return TransactionsModule.hasAnyVouchersForCompany(companyId);
  }

  static needsManualFirstVoucherNo(companyId: string): boolean {
    return TransactionsModule.needsManualFirstVoucherNo(companyId);
  }

  static getNextAutoVoucherNo(companyId: string): string {
    return TransactionsModule.getNextAutoVoucherNo(companyId);
  }

  static initializeOrIncrementSequence(companyId: string, manualFirstNo?: number): Promise<number> {
    return TransactionsModule.initializeOrIncrementSequence(companyId, manualFirstNo);
  }

  static resetCompanySequence(companyId: string): Promise<void> {
    return TransactionsModule.resetCompanySequence(companyId);
  }

  static getTransactionHistory(): TransactionHistory[] {
    return TransactionsModule.getTransactionHistory();
  }

  static addTransactionHistory(history: TransactionHistory): void {
    TransactionsModule.addTransactionHistory(history);
  }

  static getDeletedTransactions(): DeletedTransaction[] {
    return TransactionsModule.getDeletedTransactions();
  }

  static saveDeletedTransactions(records: DeletedTransaction[]): void {
    TransactionsModule.saveDeletedTransactions(records);
  }

  static fetchPaginated<T>(
    collectionName: string,
    limitVal: number,
    lastDocId?: string
  ): Promise<{ data: T[]; lastDocId?: string; hasMore: boolean }> {
    return TransactionsModule.fetchPaginated<T>(collectionName, limitVal, lastDocId);
  }

  static getConfigurationEngine(): ConfigurationEngine {
    return new ConfigurationEngine(db as any);
  }

  static async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const engine = CustodyDB.getConfigurationEngine();
    return await engine.getTenantSettings(tenantId);
  }

  static async saveTenantSettings(tenantId: string, settings: Partial<TenantSettings>): Promise<TenantSettings> {
    const engine = CustodyDB.getConfigurationEngine();
    return await engine.saveTenantSettings(tenantId, settings);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('custody_db_updated', () => {
    CustodyDB.clearCache();
  });
}
