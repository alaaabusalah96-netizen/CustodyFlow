import { AppUser, ExpenseCategory, Transaction, ActivityLog, CustodyConfig, Region, Station, Company } from './types';
import { dbSetDoc, dbDeleteDoc, seedDatabaseIfEmpty, setupFirebaseSync } from './firebase';

// Pre-seeded Companies
export const DEFAULT_COMPANIES: Company[] = [
  { id: 'comp-1', name: 'Al-Futtaim Trading Co. (الفطيم للتجارة)', custody_value: 32000.00 },
  { id: 'comp-2', name: 'Elsewedy Electric (السويدي إليكتريك)', custody_value: 45000.00 },
  { id: 'comp-3', name: 'Ezz Steel (حديد عز)', custody_value: 60000.00 }
];

// Pre-seeded Regions
const DEFAULT_REGIONS: Region[] = [
  { id: 'reg-1', name: 'Cairo Region', code: 'REG-CAI', company_id: 'comp-1' },
  { id: 'reg-2', name: 'Alexandria Region', code: 'REG-ALX', company_id: 'comp-1' },
  { id: 'reg-sw-1', name: 'Elsewedy Cairo Region', code: 'REG-SW-CAI', company_id: 'comp-2' }
];

// Pre-seeded Stations
const DEFAULT_STATIONS: Station[] = [
  { id: 'stn-1', region_id: 'reg-1', station_name: 'New Cairo Hub', station_code: 'STN-NC', custody_amount: 30000.00, is_active: true, company_id: 'comp-1' },
  { id: 'stn-2', region_id: 'reg-1', station_name: 'Maadi Branch', station_code: 'STN-MD', custody_amount: 20000.00, is_active: true, company_id: 'comp-1' },
  { id: 'stn-3', region_id: 'reg-2', station_name: 'Alex Port Terminal', station_code: 'STN-AP', custody_amount: 25000.00, is_active: true, company_id: 'comp-1' },
  { id: 'stn-sw-1', region_id: 'reg-sw-1', station_name: 'Factory Hub 1', station_code: 'STN-SW-F1', custody_amount: 45000.00, is_active: true, company_id: 'comp-2' }
];

// Pre-seeded Categories
const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-1', name_en: 'Office Supplies', name_ar: 'أدوات مكتبية ومستلزمات' },
  { id: 'cat-2', name_en: 'Transport & Travel', name_ar: 'انتقالات ومصاريف سفر' },
  { id: 'cat-3', name_en: 'Hospitality & Food', name_ar: 'ضيافة ومأكولات' },
  { id: 'cat-4', name_en: 'Maintenance & Repairs', name_ar: 'صيانة وإصلاحات' },
  { id: 'cat-5', name_en: 'Utilities & Internet', name_ar: 'مرافق وإنترنت' },
  { id: 'cat-6', name_en: 'Miscellaneous', name_ar: 'مصاريف نثرية أخرى' }
];

// Pre-configured Users
const DEFAULT_USERS: AppUser[] = [
  {
    id: 'user-sysadmin',
    email: 'superadmin@app.com',
    full_name: 'Alaa Abu Salah (علاء أبو صلاح)',
    role: 'SystemAdmin',
    permissions: {
      manage_settings: true,
      create_expense: true,
      settle_voucher: true,
      delete_expense: true,
      view_reports: true
    }
  },
  {
    id: 'user-admin',
    email: 'admin@company.com',
    full_name: 'Ahmed El-Sayed (أحمد السيد)',
    role: 'Admin',
    company_id: 'comp-1',
    permissions: {
      manage_settings: true,
      create_expense: true,
      settle_voucher: true,
      delete_expense: true,
      view_reports: true
    }
  },
  {
    id: 'user-regional-cairo',
    email: 'regional@company.com',
    full_name: 'Omar Farouk (عمر فاروق)',
    role: 'RegionalManager',
    region_id: 'reg-1',
    company_id: 'comp-1',
    permissions: {
      manage_settings: false,
      create_expense: false,
      settle_voucher: false,
      delete_expense: false,
      view_reports: true
    }
  },
  {
    id: 'user-regional-alex',
    email: 'regional_alex@company.com',
    full_name: 'Hassan Karim (حسن كريم)',
    role: 'RegionalManager',
    region_id: 'reg-2',
    company_id: 'comp-1',
    permissions: {
      manage_settings: false,
      create_expense: false,
      settle_voucher: false,
      delete_expense: false,
      view_reports: true
    }
  },
  {
    id: 'user-regular',
    email: 'cashier@company.com',
    full_name: 'Mariam Ali (مريم علي)',
    role: 'StationAdmin',
    station_id: 'stn-1',
    region_id: 'reg-1',
    company_id: 'comp-1',
    permissions: {
      manage_settings: false,
      create_expense: true,
      settle_voucher: true,
      delete_expense: false,
      view_reports: true
    }
  },
  {
    id: 'user-regular-2',
    email: 'cashier2@company.com',
    full_name: 'Tarek Sayed (طارق سيد)',
    role: 'StationAdmin',
    station_id: 'stn-2',
    region_id: 'reg-1',
    company_id: 'comp-1',
    permissions: {
      manage_settings: false,
      create_expense: true,
      settle_voucher: true,
      delete_expense: false,
      view_reports: true
    }
  },
  {
    id: 'user-regular-3',
    email: 'cashier3@company.com',
    full_name: 'Youssef Mansour (يوسف منصور)',
    role: 'StationAdmin',
    station_id: 'stn-3',
    region_id: 'reg-2',
    company_id: 'comp-1',
    permissions: {
      manage_settings: false,
      create_expense: true,
      settle_voucher: true,
      delete_expense: false,
      view_reports: true
    }
  },
  {
    id: 'user-sw-admin',
    email: 'elsewedy_admin@company.com',
    full_name: 'Hani Hegazi (هاني حجازي)',
    role: 'Admin',
    company_id: 'comp-2',
    permissions: {
      manage_settings: true,
      create_expense: true,
      settle_voucher: true,
      delete_expense: true,
      view_reports: true
    }
  },
  {
    id: 'user-sw-cashier',
    email: 'elsewedy_cashier@company.com',
    full_name: 'Amr Hosny (عمرو حسني)',
    role: 'StationAdmin',
    station_id: 'stn-sw-1',
    region_id: 'reg-sw-1',
    company_id: 'comp-2',
    permissions: {
      manage_settings: false,
      create_expense: true,
      settle_voucher: true,
      delete_expense: false,
      view_reports: true
    }
  }
];

// Pre-seeded Transactions
const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    transaction_no: 'TX-2026-0001',
    date: '2026-06-15',
    description: 'Purchase of premium A4 copy paper and office stationery boxes',
    category_id: 'cat-1',
    amount: 1450.00,
    notes: 'Approved by Branch Manager',
    status: 'Under Settlement',
    voucher_no: 'TX-2026-0001',
    voucher_date: '2026-06-16',
    created_by: 'user-regular',
    created_at: '2026-06-15T09:30:00Z',
    updated_at: '2026-06-16T11:20:00Z',
    station_id: 'stn-1',
    company_id: 'comp-1'
  },
  {
    id: 'tx-2',
    transaction_no: 'TX-2026-0002',
    date: '2026-06-18',
    description: 'Emergency plumber service for water leakage in server room AC',
    category_id: 'cat-4',
    amount: 2300.00,
    notes: 'Water leak threatened core network rack. Fast-track approval.',
    status: 'Under Settlement',
    voucher_no: 'TX-2026-0002',
    voucher_date: '2026-06-19',
    created_by: 'user-admin',
    created_at: '2026-06-18T14:15:00Z',
    updated_at: '2026-06-19T09:00:00Z',
    station_id: 'stn-2',
    company_id: 'comp-1'
  },
  {
    id: 'tx-3',
    transaction_no: 'TX-2026-0003',
    date: '2026-06-22',
    description: 'VIP Clients Business Lunch catering (Hospitality)',
    category_id: 'cat-3',
    amount: 3200.00,
    notes: 'Alafia Restaurant. Invoice attached.',
    status: 'Pending',
    created_by: 'user-regular',
    created_at: '2026-06-22T13:00:00Z',
    updated_at: '2026-06-22T13:00:00Z',
    station_id: 'stn-1',
    company_id: 'comp-1'
  },
  {
    id: 'tx-4',
    transaction_no: 'TX-2026-0004',
    date: '2026-06-24',
    description: 'Taxi fares for technical sales visit to New Cairo client site',
    category_id: 'cat-2',
    amount: 480.00,
    notes: 'Three round-trips for engineering staff',
    status: 'Pending',
    created_by: 'user-regular',
    created_at: '2026-06-24T17:45:00Z',
    updated_at: '2026-06-24T17:45:00Z',
    station_id: 'stn-1',
    company_id: 'comp-1'
  },
  {
    id: 'tx-5',
    transaction_no: 'TX-2026-0005',
    date: '2026-06-25',
    description: 'Annual internet high-speed fiber subscription recharge',
    category_id: 'cat-5',
    amount: 4500.00,
    notes: 'Telecom Egypt invoice #TE-98231',
    status: 'Pending',
    created_by: 'user-admin',
    created_at: '2026-06-25T11:00:00Z',
    updated_at: '2026-06-25T11:00:00Z',
    station_id: 'stn-3',
    company_id: 'comp-1'
  },
  {
    id: 'tx-sw-1',
    transaction_no: 'TX-2026-0006',
    date: '2026-06-26',
    description: 'Copper cables distribution truck fuel and logistics allowance',
    category_id: 'cat-2',
    amount: 5200.00,
    notes: 'Elsewedy Logistics fuel card recharge',
    status: 'Pending',
    created_by: 'user-sw-cashier',
    created_at: '2026-06-26T10:00:00Z',
    updated_at: '2026-06-26T10:00:00Z',
    station_id: 'stn-sw-1',
    company_id: 'comp-2'
  }
];

const DEFAULT_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    user_id: 'system',
    user_name: 'System Initializer',
    action: 'Database Initialized',
    details: 'Pre-seeded custody categories, regions, stations, users, and baseline transactions.',
    timestamp: '2026-06-15T08:00:00Z'
  },
  {
    id: 'log-2',
    user_id: 'user-regular',
    user_name: 'Mariam Ali',
    action: 'Created Transaction',
    details: 'Registered pending expense TX-2026-0001 for 1,450.00 EGP (Office Supplies).',
    timestamp: '2026-06-15T09:30:00Z'
  },
  {
    id: 'log-3',
    user_id: 'user-admin',
    user_name: 'Ahmed El-Sayed',
    action: 'Approved & Settled Voucher',
    details: 'Assigned Voucher CPV-8801 to transaction TX-2026-0001.',
    timestamp: '2026-06-16T11:20:00Z'
  }
];

const DEFAULT_CONFIG: CustodyConfig = {
  company_name: 'Al-Futtaim Trading Co.',
  custody_value: 32000.00
};

// State Store Manager (LocalStorage wrapper)
export class CustodyDB {
  static initializeFirebase(): void {
    seedDatabaseIfEmpty({
      companies: DEFAULT_COMPANIES,
      regions: DEFAULT_REGIONS,
      stations: DEFAULT_STATIONS,
      categories: DEFAULT_CATEGORIES,
      users: DEFAULT_USERS,
      transactions: DEFAULT_TRANSACTIONS,
      logs: DEFAULT_LOGS,
      config: DEFAULT_CONFIG
    }).then(() => {
      setupFirebaseSync();
    });
  }

  private static getStored<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(`custody_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private static setStored<T>(key: string, value: T): void {
    localStorage.setItem(`custody_${key}`, JSON.stringify(value));
  }

  // Companies
  static getCompanies(): Company[] {
    return this.getStored<Company[]>('companies', DEFAULT_COMPANIES);
  }

  static saveCompanies(companies: Company[]): void {
    this.setStored('companies', companies);
    companies.forEach(c => dbSetDoc('companies', c.id, c));
  }

  static addCompany(name: string, custodyValue: number): Company {
    const companies = this.getCompanies();
    const newCompany: Company = {
      id: `comp-${Date.now()}`,
      name,
      custody_value: custodyValue
    };
    companies.push(newCompany);
    this.saveCompanies(companies);
    
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Company', `Created new company: ${name} with custody value ${custodyValue.toLocaleString()} EGP`);
    return newCompany;
  }

  static updateCompany(id: string, updates: Partial<Company>): void {
    const companies = this.getCompanies();
    const idx = companies.findIndex(c => c.id === id);
    if (idx !== -1) {
      companies[idx] = { ...companies[idx], ...updates };
      this.saveCompanies(companies);
      const user = this.getActiveUser();
      this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Company', `Modified company: ${companies[idx].name}`);
    }
  }

  static deleteCompany(id: string): void {
    const companies = this.getCompanies().filter(c => c.id !== id);
    this.saveCompanies(companies);
    dbDeleteDoc('companies', id);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Company', `Deleted company ID: ${id}`);
  }

  static getSelectedCompanyId(): string {
    const user = this.getActiveUser();
    if (!user) return 'comp-1';
    
    // If user is scoped to a specific company, they can't view others
    if (user.role !== 'SystemAdmin' && user.company_id) {
      return user.company_id;
    }
    
    // SystemAdmin can switch companies via localStorage
    const saved = localStorage.getItem('custody_selected_company_id');
    if (saved) return saved;
    return 'comp-1';
  }

  static setSelectedCompanyId(id: string): void {
    localStorage.setItem('custody_selected_company_id', id);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Switch Company', `Viewing focus changed to company ID: ${id}`);
  }

  // Get active user from session
  static getActiveUser(): AppUser | null {
    const user = localStorage.getItem('custody_active_user');
    if (!user) {
      // Auto-login SystemAdmin as fallback to keep preview friction-free and let user experience the platform
      this.setActiveUser(DEFAULT_USERS[0]);
      return DEFAULT_USERS[0];
    }
    const parsed = JSON.parse(user);
    if (parsed && parsed.email && parsed.email.toLowerCase() === 'alaabusalah96@gmail.com' && parsed.role !== 'SystemAdmin') {
      const updated = {
        ...parsed,
        role: 'SystemAdmin' as const,
        permissions: {
          manage_settings: true,
          create_expense: true,
          settle_voucher: true,
          delete_expense: true,
          view_reports: true
        }
      };
      localStorage.setItem('custody_active_user', JSON.stringify(updated));
      return updated;
    }
    return parsed;
  }

  static setActiveUser(user: AppUser | null): void {
    if (user) {
      localStorage.setItem('custody_active_user', JSON.stringify(user));
      this.addLog(user.id, user.full_name, 'Login Session', `User logged in with role ${user.role}.`);
    } else {
      const current = this.getActiveUser();
      if (current) {
        this.addLog(current.id, current.full_name, 'Logout Session', 'User signed out of system.');
      }
      localStorage.removeItem('custody_active_user');
    }
  }

  // Regions
  static getRegions(): Region[] {
    return this.getStored<Region[]>('regions', DEFAULT_REGIONS);
  }

  static getScopedRegions(): Region[] {
    const regions = this.getRegions();
    const targetCompanyId = this.getSelectedCompanyId();
    return regions.filter(r => r.company_id === targetCompanyId);
  }

  static saveRegions(regions: Region[]): void {
    this.setStored('regions', regions);
    regions.forEach(r => dbSetDoc('regions', r.id, r));
  }

  static addRegion(name: string, code: string, companyId?: string): Region {
    const regions = this.getRegions();
    const compId = companyId || this.getSelectedCompanyId();
    const newReg: Region = {
      id: `reg-${Date.now()}`,
      name,
      code,
      company_id: compId
    };
    regions.push(newReg);
    this.saveRegions(regions);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Region', `Created region: ${name} (${code})`);
    return newReg;
  }

  static updateRegion(id: string, updates: Partial<Region>): void {
    const regions = this.getRegions();
    const idx = regions.findIndex(r => r.id === id);
    if (idx !== -1) {
      regions[idx] = { ...regions[idx], ...updates };
      this.saveRegions(regions);
      const user = this.getActiveUser();
      this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Region', `Modified region: ${regions[idx].name}`);
    }
  }

  static deleteRegion(id: string): void {
    const regions = this.getRegions().filter(r => r.id !== id);
    this.saveRegions(regions);
    dbDeleteDoc('regions', id);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Region', `Deleted region ID: ${id}`);
  }

  // Stations
  static getStations(): Station[] {
    return this.getStored<Station[]>('stations', DEFAULT_STATIONS);
  }

  static getScopedStations(): Station[] {
    const stations = this.getStations();
    const targetCompanyId = this.getSelectedCompanyId();
    return stations.filter(s => s.company_id === targetCompanyId);
  }

  static saveStations(stations: Station[]): void {
    this.setStored('stations', stations);
    stations.forEach(s => dbSetDoc('stations', s.id, s));
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Stations', 'Modified available cash custody stations configuration.');
  }

  static addStation(name: string, code: string, custodyAmount: number, regionId?: string, companyId?: string): Station {
    const stations = this.getStations();
    const compId = companyId || this.getSelectedCompanyId();
    const newStn: Station = {
      id: `stn-${Date.now()}`,
      station_name: name,
      station_code: code,
      custody_amount: custodyAmount,
      is_active: true,
      region_id: regionId || undefined,
      company_id: compId
    };
    stations.push(newStn);
    this.saveStations(stations);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Station', `Created station: ${name} with custody ${custodyAmount} EGP`);
    return newStn;
  }

  static updateStation(id: string, updates: Partial<Station>): void {
    const stations = this.getStations();
    const idx = stations.findIndex(s => s.id === id);
    if (idx !== -1) {
      stations[idx] = { ...stations[idx], ...updates };
      this.saveStations(stations);
      const user = this.getActiveUser();
      this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Station', `Modified station: ${stations[idx].station_name}`);
    }
  }

  static deleteStation(id: string): void {
    const stations = this.getStations().filter(s => s.id !== id);
    this.saveStations(stations);
    dbDeleteDoc('stations', id);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Station', `Deleted station ID: ${id}`);
  }

  // Categories
  static getCategories(): ExpenseCategory[] {
    return this.getStored<ExpenseCategory[]>('categories', DEFAULT_CATEGORIES);
  }

  static saveCategories(categories: ExpenseCategory[]): void {
    this.setStored('categories', categories);
    categories.forEach(c => dbSetDoc('categories', c.id, c));
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Categories', 'Modified available expense category configurations.');
  }

  // Users
  static getUsers(): AppUser[] {
    const users = this.getStored<AppUser[]>('users', DEFAULT_USERS);
    let changed = false;
    const updated = users.map(u => {
      if (u.email && u.email.toLowerCase() === 'alaabusalah96@gmail.com' && u.role !== 'SystemAdmin') {
        changed = true;
        return {
          ...u,
          role: 'SystemAdmin' as const,
          permissions: {
            manage_settings: true,
            create_expense: true,
            settle_voucher: true,
            delete_expense: true,
            view_reports: true
          }
        };
      }
      return u;
    });

    if (changed) {
      // Defer saving to avoid circular storage listener updates, but apply locally
      setTimeout(() => {
        try {
          this.saveUsers(updated);
        } catch (e) {
          console.error('Error auto-promoting user in database:', e);
        }
      }, 100);
    }
    return updated;
  }

  static getScopedUsers(): AppUser[] {
    const users = this.getUsers();
    const activeUser = this.getActiveUser();
    if (!activeUser) return users;
    
    const targetCompanyId = this.getSelectedCompanyId();
    if (activeUser.role === 'SystemAdmin') {
      // System admin can see all other system admins and users belonging to the active company
      return users.filter(u => u.role === 'SystemAdmin' || u.company_id === targetCompanyId);
    }
    return users.filter(u => u.company_id === activeUser.company_id);
  }

  static saveUsers(users: AppUser[]): void {
    this.setStored('users', users);
    users.forEach(u => dbSetDoc('users', u.id, u));
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Users', 'Modified user roles and system permission profiles.');
  }

  // Config
  static getConfig(): CustodyConfig {
    const targetCompanyId = this.getSelectedCompanyId();
    const companies = this.getCompanies();
    const activeCompany = companies.find(c => c.id === targetCompanyId) || companies[0] || DEFAULT_COMPANIES[0];
    return {
      company_name: activeCompany.name,
      custody_value: activeCompany.custody_value
    };
  }

  static saveConfig(config: CustodyConfig): void {
    const targetCompanyId = this.getSelectedCompanyId();
    const companies = this.getCompanies();
    const updated = companies.map(c => {
      if (c.id === targetCompanyId) {
        return { ...c, name: config.company_name, custody_value: config.custody_value };
      }
      return c;
    });
    this.saveCompanies(updated);
    
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Custody', `Adjusted company metadata for ${config.company_name}. Custody Base set to ${config.custody_value.toLocaleString()} EGP.`);
  }

  // Transactions
  static getTransactions(): Transaction[] {
    return this.getStored<Transaction[]>('transactions', DEFAULT_TRANSACTIONS);
  }

  static getScopedTransactions(): Transaction[] {
    const txs = this.getTransactions();
    const user = this.getActiveUser();
    if (!user) return txs;
    
    const targetCompanyId = this.getSelectedCompanyId();
    const companyTxs = txs.filter(t => t.company_id === targetCompanyId);
    
    if (user.role === 'Admin' || user.role === 'SystemAdmin') {
      return companyTxs;
    }
    if (user.role === 'RegionalManager') {
      const stations = this.getStations();
      const regionStations = stations.filter(s => s.region_id === user.region_id && s.company_id === targetCompanyId);
      const targetStationIds = regionStations.map(s => s.id);
      return companyTxs.filter(t => t.station_id && targetStationIds.includes(t.station_id));
    }
    // StationAdmin or Regular Cashier
    const userStationId = user.station_id || 'stn-1';
    return companyTxs.filter(t => t.station_id === userStationId);
  }

  static saveTransactions(transactions: Transaction[]): void {
    this.setStored('transactions', transactions);
  }

  static addTransaction(data: Omit<Transaction, 'id' | 'transaction_no' | 'status' | 'created_at' | 'updated_at' | 'created_by'>): Transaction {
    const transactions = this.getTransactions();
    
    // Auto increment number sequence
    const nextNum = transactions.length + 1;
    const transaction_no = `TX-2026-${String(nextNum).padStart(4, '0')}`;
    
    const user = this.getActiveUser();
    const station_id = data.station_id || user?.station_id || 'stn-1';
    const company_id = user?.company_id || this.getSelectedCompanyId();

    const newTx: Transaction = {
      ...data,
      id: `tx-${Date.now()}`,
      transaction_no,
      status: 'Pending',
      created_by: user?.id || 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      station_id,
      company_id
    };

    transactions.push(newTx);
    this.saveTransactions(transactions);

    // Sync to Firestore
    dbSetDoc('transactions', newTx.id, newTx);

    this.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Create Transaction',
      `Registered pending expense ${transaction_no} for ${newTx.amount.toLocaleString()} EGP - "${newTx.description}"`
    );

    return newTx;
  }

  static updateTransaction(id: string, updates: Partial<Transaction>): void {
    const transactions = this.getTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const user = this.getActiveUser();
      const old = transactions[idx];
      const updated = {
        ...old,
        ...updates,
        updated_at: new Date().toISOString()
      };
      transactions[idx] = updated;
      this.saveTransactions(transactions);

      // Sync to Firestore
      dbSetDoc('transactions', id, updated);

      // Log details
      let details = `Updated fields on transaction ${old.transaction_no}.`;
      if (updates.status === 'Under Settlement') {
        details = `Settled transaction ${old.transaction_no} under Cash Payment Voucher ${updates.voucher_no || ''}.`;
      }
      this.addLog(
        user?.id || 'unknown',
        user?.full_name || 'Anonymous',
        updates.status === 'Under Settlement' ? 'Settle Transaction' : 'Update Transaction',
        details
      );
    }
  }

  static deleteTransaction(id: string): boolean {
    const transactions = this.getTransactions();
    const tx = transactions.find(t => t.id === id);
    if (!tx) return false;

    const user = this.getActiveUser();
    // Audit check: Only Admin, SystemAdmin, or owners with role permission can delete
    const isSystemAdmin = user && (user.role === 'Admin' || user.role === 'SystemAdmin');
    if (!isSystemAdmin && user?.id !== tx.created_by) {
      this.addLog(user?.id || 'unknown', user?.full_name || 'Anonymous', 'Access Rejected', `Attempted to delete transaction ${tx.transaction_no} without correct privileges.`);
      return false;
    }

    const filtered = transactions.filter(t => t.id !== id);
    this.saveTransactions(filtered);

    // Sync to Firestore
    dbDeleteDoc('transactions', id);

    this.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Delete Transaction',
      `Deleted transaction ${tx.transaction_no} worth ${tx.amount.toLocaleString()} EGP.`
    );
    return true;
  }

  // Logs
  static getLogs(): ActivityLog[] {
    return this.getStored<ActivityLog[]>('logs', DEFAULT_LOGS);
  }

  static addLog(userId: string, userName: string, action: string, details: string): void {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: userId,
      user_name: userName,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog); // new logs first
    this.setStored('logs', logs.slice(0, 150)); // limit audit records

    // Sync to Firestore
    dbSetDoc('logs', newLog.id, newLog);
  }

  // Formula Calculations
  static getReconciliation(stationId?: string, regionId?: string) {
    const targetCompanyId = this.getSelectedCompanyId();
    const stations = this.getStations().filter(s => s.company_id === targetCompanyId);
    const transactions = this.getTransactions().filter(t => t.company_id === targetCompanyId);
    const user = this.getActiveUser();

    // Determine target station(s)
    let targetStationIds: string[] = [];
    let custodyValue = 0;

    if (stationId) {
      // Direct station request
      targetStationIds = [stationId];
      const st = stations.find(s => s.id === stationId);
      custodyValue = st ? st.custody_amount : 0;
    } else if (regionId) {
      // Region stations combined
      const regionStations = stations.filter(s => s.region_id === regionId);
      targetStationIds = regionStations.map(s => s.id);
      custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
    } else if (user) {
      if (user.role === 'Admin' || user.role === 'SystemAdmin') {
        // System Admin: see everything combined
        targetStationIds = stations.map(s => s.id);
        custodyValue = stations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else if (user.role === 'RegionalManager') {
        // Regional Manager: Cairo or Alex stations combined
        const regionStations = stations.filter(s => s.region_id === user.region_id);
        targetStationIds = regionStations.map(s => s.id);
        custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else {
        // Station Admin: single station
        const userStationId = user.station_id || 'stn-1';
        targetStationIds = [userStationId];
        const st = stations.find(s => s.id === userStationId);
        custodyValue = st ? st.custody_amount : 0;
      }
    } else {
      // Fallback
      targetStationIds = ['stn-1'];
      const st = stations.find(s => s.id === 'stn-1');
      custodyValue = st ? st.custody_amount : 0;
    }

    // Filter transactions by target stations
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

    const cashAvailable = custodyValue - pendingTotal - underSettlementTotal - settledTotal;

    const pendingCount = filteredTxs.filter(t => t.status === 'Pending').length;
    const underSettlementCount = filteredTxs.filter(t => t.status === 'Under Settlement').length;
    const settledCount = filteredTxs.filter(t => t.status === 'Settled').length;

    return {
      custodyValue,
      cashAvailable,
      pendingTotal,
      underSettlementTotal,
      settledTotal,
      pendingCount,
      underSettlementCount,
      settledCount
    };
  }
}
