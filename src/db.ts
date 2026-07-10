import { AppUser, ExpenseCategory, Transaction, TransactionStatus, ActivityLog, CustodyConfig, Region, Station, Company, UserRole, UserPermissions, Expense, CashVoucher, TransactionHistory, Notification, AuditLog, SystemPermission, SystemRole, DeletedTransaction, SignupRequest } from './types';
import { dbSetDoc, dbDeleteDoc, seedDatabaseIfEmpty, setupFirebaseSync, db } from './firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { AuditLogEngine } from './lib/enterprise/audit';
import { createEventEnvelope } from './lib/enterprise/metadata';

export function hashPassword(password: string): string {
  if (!password) return '';
  function rotateRight(n: number, x: number) {
    return (x >>> n) | (x << (32 - n));
  }
  const words: number[] = [];
  const asciiBitLength = password.length * 8;
  
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const wordsCount = ((asciiBitLength + 64 >> 9) << 4) + 16;
  for (let i = 0; i < wordsCount; i++) words[i] = 0;
  for (let i = 0; i < password.length; i++) {
    words[i >> 2] |= (password.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[wordsCount - 1] = asciiBitLength;

  for (let i = 0; i < words.length; i += 16) {
    const w = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j];
    for (let j = 16; j < 64; j++) {
      const s0 = rotateRight(7, w[j - 15]) ^ rotateRight(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      const s1 = rotateRight(17, w[j - 2]) ^ rotateRight(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rotateRight(6, e) ^ rotateRight(11, e) ^ rotateRight(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rotateRight(2, a) ^ rotateRight(13, a) ^ rotateRight(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const hashWords = [h0, h1, h2, h3, h4, h5, h6, h7];
  const result: string[] = [];
  for (let i = 0; i < 8; i++) {
    const word = hashWords[i];
    const hex = (word >>> 0).toString(16);
    result.push(('00000000' + hex).slice(-8));
  }
  return result.join('');
}

// Pre-seeded Companies
export const DEFAULT_COMPANIES: Company[] = [
  { id: 'comp-1', name: 'Cairo Poultry (القاهرة للدواجن)', custody_value: 500000.00, is_active: true, subscription_status: 'active', subscription_plan: 'Enterprise', subscription_expiry: '2028-12-31' }
];

export const DEFAULT_REGIONS: Region[] = [
  { id: 'reg-1-1', name: 'Eastern Region (المنطقة الشرقية)', code: 'REG-1-EAST', company_id: 'comp-1' }
];

export const DEFAULT_STATIONS: Station[] = [
  { id: 'stn-1-1-1', region_id: 'reg-1-1', station_name: 'Sina 2000 Station (محطة سينا 2000)', station_code: 'STN-1-1-SINA', custody_amount: 250000.00, is_active: true, company_id: 'comp-1' },
  { id: 'stn-1-1-2', region_id: 'reg-1-1', station_name: 'Al-Qadisiya Station (محطة القادسية)', station_code: 'STN-1-1-QAD', custody_amount: 250000.00, is_active: true, company_id: 'comp-1' }
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
    email: 'alaaabusalah96@gmail.com',
    full_name: 'Alaa Abu Salah (علاء أبو صلاح)',
    role: 'SystemAdmin',
    is_active: true,
    password: '',
    permissions: {
      create_expense: true,
      edit_expense: true,
      delete_expense: true,
      create_voucher: true,
      approve_voucher: true,
      reject_voucher: true,
      create_custody: true,
      edit_custody: true,
      replace_custody: true,
      view_reports: true,
      manage_users: true,
      manage_companies: true,
      manage_regions: true,
      manage_stations: true,
      manage_roles: true,
      manage_settings: true,
      settle_voucher: true
    }
  },
  {
    id: 'user-admin',
    email: 'admin@company.com',
    full_name: 'Ahmed El-Sayed (أحمد السيد)',
    role: 'Admin',
    company_id: 'comp-1',
    is_active: true,
    password: '123456',
    permissions: {
      create_expense: true,
      edit_expense: true,
      delete_expense: true,
      create_voucher: true,
      approve_voucher: true,
      reject_voucher: true,
      create_custody: true,
      edit_custody: true,
      replace_custody: true,
      view_reports: true,
      manage_users: true,
      manage_companies: false,
      manage_regions: true,
      manage_stations: true,
      manage_roles: true,
      manage_settings: true,
      settle_voucher: true
    }
  },
  {
    id: 'user-regional-cairo',
    email: 'regional@company.com',
    full_name: 'Omar Farouk (عمر فاروق)',
    role: 'RegionalManager',
    region_id: 'reg-1-1',
    company_id: 'comp-1',
    is_active: true,
    password: '123456',
    permissions: {
      create_expense: false,
      edit_expense: false,
      delete_expense: false,
      create_voucher: false,
      approve_voucher: true,
      reject_voucher: true,
      create_custody: false,
      edit_custody: false,
      replace_custody: true,
      view_reports: true,
      manage_users: false,
      manage_companies: false,
      manage_regions: false,
      manage_stations: false,
      manage_roles: false,
      manage_settings: false,
      settle_voucher: false
    }
  },
  {
    id: 'user-regular',
    email: 'cashier@company.com',
    full_name: 'Mariam Ali (مريم علي)',
    role: 'StationAdmin',
    station_id: 'stn-1-1-1',
    region_id: 'reg-1-1',
    company_id: 'comp-1',
    is_active: true,
    password: '123456',
    permissions: {
      create_expense: true,
      edit_expense: true,
      delete_expense: false,
      create_voucher: true,
      approve_voucher: false,
      reject_voucher: false,
      create_custody: false,
      edit_custody: false,
      replace_custody: false,
      view_reports: true,
      manage_users: false,
      manage_companies: false,
      manage_regions: false,
      manage_stations: false,
      manage_roles: false,
      manage_settings: false,
      settle_voucher: true
    }
  },
  {
    id: 'user-regular-2',
    email: 'cashier2@company.com',
    full_name: 'Tarek Sayed (طارق سيد)',
    role: 'StationAdmin',
    station_id: 'stn-1-1-2',
    region_id: 'reg-1-1',
    company_id: 'comp-1',
    is_active: true,
    password: '123456',
    permissions: {
      create_expense: true,
      edit_expense: true,
      delete_expense: false,
      create_voucher: true,
      approve_voucher: false,
      reject_voucher: false,
      create_custody: false,
      edit_custody: false,
      replace_custody: false,
      view_reports: true,
      manage_users: false,
      manage_companies: false,
      manage_regions: false,
      manage_stations: false,
      manage_roles: false,
      manage_settings: false,
      settle_voucher: true
    }
  }
];

// Pre-seeded Transactions
const generateDefaultTransactions = (): Transaction[] => {
  return [
    {
      id: 'tx-sina-1',
      transaction_no: 'CPV-SINA-0001',
      date: '2026-07-01',
      description: 'شراء أدوات مكتبية ومستلزمات تصوير عاجلة للمحطة',
      category_id: 'cat-1',
      amount: 1450.00,
      notes: 'معلق لمراجعة الفواتير والاعتماد الكلي',
      status: 'Pending',
      created_by: 'user-regular',
      created_at: '2026-07-01T09:30:00Z',
      updated_at: '2026-07-01T09:30:00Z',
      station_id: 'stn-1-1-1',
      company_id: 'comp-1'
    },
    {
      id: 'tx-sina-2',
      transaction_no: 'CPV-SINA-0002',
      date: '2026-07-02',
      description: 'مصاريف انتقالات ومحروقات لسيارة المحطة',
      category_id: 'cat-2',
      amount: 850.00,
      notes: 'طلب استعاضة وقود عاجل',
      status: 'Pending',
      created_by: 'user-regular',
      created_at: '2026-07-02T10:15:00Z',
      updated_at: '2026-07-02T10:15:00Z',
      station_id: 'stn-1-1-1',
      company_id: 'comp-1'
    },
    {
      id: 'tx-sina-3',
      transaction_no: 'CPV-SINA-0003',
      date: '2026-07-03',
      description: 'صيانة طارئة لوحدات التكييف والمرافق بالمحطة',
      category_id: 'cat-4',
      amount: 3200.00,
      notes: 'تمت الصيانة واعتماد سند الصرف',
      status: 'Under Settlement',
      voucher_no: 'VCH-SINA-0003',
      voucher_date: '2026-07-04',
      created_by: 'user-regular',
      created_at: '2026-07-03T11:00:00Z',
      updated_at: '2026-07-04T12:00:00Z',
      station_id: 'stn-1-1-1',
      company_id: 'comp-1'
    },
    {
      id: 'tx-sina-4',
      transaction_no: 'CPV-SINA-0004',
      date: '2026-07-04',
      description: 'شراء مواد ضيافة ومأكولات للموظفين بالمحطة',
      category_id: 'cat-3',
      amount: 650.00,
      notes: 'وجبة غداء لفريق الصيانة الدورية',
      status: 'Under Settlement',
      voucher_no: 'VCH-SINA-0004',
      voucher_date: '2026-07-05',
      created_by: 'user-regular',
      created_at: '2026-07-04T13:30:00Z',
      updated_at: '2026-07-05T10:00:00Z',
      station_id: 'stn-1-1-1',
      company_id: 'comp-1'
    },
    {
      id: 'tx-sina-5',
      transaction_no: 'CPV-SINA-0005',
      date: '2026-07-05',
      description: 'سداد فواتير الإنترنت والمرافق الدورية للمحطة',
      category_id: 'cat-5',
      amount: 1100.00,
      notes: 'تم السداد نقداً وإرفاق إيصال الدفع الإلكتروني',
      status: 'Under Settlement',
      voucher_no: 'VCH-SINA-0005',
      voucher_date: '2026-07-05',
      created_by: 'user-regular',
      created_at: '2026-07-05T09:00:00Z',
      updated_at: '2026-07-05T14:30:00Z',
      station_id: 'stn-1-1-1',
      company_id: 'comp-1'
    },
    {
      id: 'tx-qad-1',
      transaction_no: 'CPV-QAD-0001',
      date: '2026-07-01',
      description: 'إصلاحات طارئة في مرافق الصرف الصحي بالمحطة',
      category_id: 'cat-4',
      amount: 1850.00,
      notes: 'طلب صيانة عاجل لتفادي الأضرار',
      status: 'Pending',
      created_by: 'user-regular-2',
      created_at: '2026-07-01T08:45:00Z',
      updated_at: '2026-07-01T08:45:00Z',
      station_id: 'stn-1-1-2',
      company_id: 'comp-1'
    },
    {
      id: 'tx-qad-2',
      transaction_no: 'CPV-QAD-0002',
      date: '2026-07-02',
      description: 'أدوات نظافة ومطهرات للمحطة والمكاتب',
      category_id: 'cat-1',
      amount: 450.00,
      notes: 'شراء مستلزمات نظافة دورية',
      status: 'Pending',
      created_by: 'user-regular-2',
      created_at: '2026-07-02T11:15:00Z',
      updated_at: '2026-07-02T11:15:00Z',
      station_id: 'stn-1-1-2',
      company_id: 'comp-1'
    },
    {
      id: 'tx-qad-3',
      transaction_no: 'CPV-QAD-0003',
      date: '2026-07-03',
      description: 'شراء وجبات ضيافة لوفد الإدارة العليا أثناء الزيارة',
      category_id: 'cat-3',
      amount: 1250.00,
      notes: 'ضيافة اجتماع مراجعة الأداء الدوري',
      status: 'Pending',
      created_by: 'user-regular-2',
      created_at: '2026-07-03T12:00:00Z',
      updated_at: '2026-07-03T12:00:00Z',
      station_id: 'stn-1-1-2',
      company_id: 'comp-1'
    },
    {
      id: 'tx-qad-4',
      transaction_no: 'CPV-QAD-0004',
      date: '2026-07-04',
      description: 'شراء مستلزمات وأحبار للطباعة بمكتب المحطة',
      category_id: 'cat-1',
      amount: 980.00,
      notes: 'معتمد وتحت التسوية والمراجعة الفنية',
      status: 'Under Settlement',
      voucher_no: 'VCH-QAD-0004',
      voucher_date: '2026-07-04',
      created_by: 'user-regular-2',
      created_at: '2026-07-04T10:00:00Z',
      updated_at: '2026-07-04T15:00:00Z',
      station_id: 'stn-1-1-2',
      company_id: 'comp-1'
    },
    {
      id: 'tx-qad-5',
      transaction_no: 'CPV-QAD-0005',
      date: '2026-07-05',
      description: 'إصلاح إطارات سيارة النقل الخاصة بالمحطة',
      category_id: 'cat-2',
      amount: 1500.00,
      notes: 'صيانة دورية عاجلة لسيارة نقل المياه',
      status: 'Under Settlement',
      voucher_no: 'VCH-QAD-0005',
      voucher_date: '2026-07-05',
      created_by: 'user-regular-2',
      created_at: '2026-07-05T09:30:00Z',
      updated_at: '2026-07-05T13:00:00Z',
      station_id: 'stn-1-1-2',
      company_id: 'comp-1'
    }
  ];
};

const DEFAULT_TRANSACTIONS: Transaction[] = generateDefaultTransactions();

const DEFAULT_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    user_id: 'system',
    user_name: 'System Initializer',
    action: 'Database Initialized',
    details: 'Pre-seeded custody categories, regions, stations, users, and baseline transactions for Cairo Poultry.',
    timestamp: '2026-07-01T08:00:00Z'
  }
];

const DEFAULT_CONFIG: CustodyConfig = {
  company_name: 'Cairo Poultry',
  custody_value: 500000.00
};

// Sprint 2 Default Collections Pre-seed Data
export const DEFAULT_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    station_id: 'stn-1-1-1',
    company_id: 'comp-1',
    category_id: 'cat-4',
    amount: 1540.00,
    description: 'إصلاح طلمبة المياه رقم 3 بمحطة سينا 2000',
    date: '2026-07-02',
    status: 'Approved',
    created_by: 'user-regular',
    created_at: '2026-07-02T10:30:00Z',
    updated_at: '2026-07-03T12:00:00Z',
    receipt_url: '',
    invoice_no: 'INV-2026-9901'
  }
];

export const DEFAULT_VOUCHERS: CashVoucher[] = [
  {
    id: 'vch-1',
    voucher_no: 'CPV-2026-0001',
    date: '2026-07-03',
    station_id: 'stn-1-1-1',
    company_id: 'comp-1',
    amount: 1540.00,
    amount_in_words: {
      ar: 'ألف وخمسمائة وأربعون جنيهاً مصرياً لا غير',
      en: 'One thousand five hundred and forty Egyptian Pounds only'
    },
    recipient_name: 'شركة مصر لأعمال الصيانة',
    received_by: 'user-regular',
    approved_by: 'user-admin',
    status: 'Approved',
    expense_ids: ['exp-1'],
    created_at: '2026-07-02T11:00:00Z',
    updated_at: '2026-07-03T12:00:00Z'
  }
];

export const DEFAULT_TX_HISTORY: TransactionHistory[] = [
  {
    id: 'txh-1',
    transaction_id: 'exp-1',
    action: 'Created',
    performed_by: 'user-regular',
    performed_by_name: 'Mariam Ali',
    timestamp: '2026-07-02T10:30:00Z',
    new_status: 'Pending',
    notes: 'تم تقديم طلب المصروف للصيانة الطارئة'
  },
  {
    id: 'txh-2',
    transaction_id: 'exp-1',
    action: 'Approved & Settled',
    performed_by: 'user-admin',
    performed_by_name: 'Ahmed El-Sayed',
    timestamp: '2026-07-03T12:00:00Z',
    previous_status: 'Pending',
    new_status: 'Approved',
    notes: 'تم المراجعة والاعتماد وصرف السند'
  }
];

export const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: 'ntf-1',
    user_id: 'user-admin',
    title_ar: 'طلب مصروف جديد معلق',
    title_en: 'New Pending Expense Request',
    message_ar: 'قامت مريم علي بتقديم طلب مصروف بمبلغ 1450.00 ج.م لمحطة سينا 2000',
    message_en: 'Mariam Ali submitted an expense of 1450.00 EGP for Sina 2000 Station.',
    is_read: false,
    type: 'info',
    related_id: 'tx-sina-1',
    created_at: '2026-07-01T09:31:00Z'
  }
];

export const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-1',
    user_id: 'user-admin',
    user_name: 'Ahmed El-Sayed',
    user_role: 'Admin',
    action_type: 'ROLE_MODIFICATION',
    description: 'تعديل صلاحيات دور مدير محطة لإضافة تسوية السندات تلقائياً',
    timestamp: '2026-06-28T14:20:00Z',
    details: { role_id: 'StationAdmin', updated_permissions: ['settle_voucher'] }
  }
];

export const DEFAULT_PERMISSIONS: SystemPermission[] = [
  { id: 'create_expense', name_en: 'Create Expense', name_ar: 'إنشاء مصروف', description_en: 'Allows creating new expense requests', description_ar: 'يسمح بإنشاء طلبات مصروفات جديدة', category: 'expenses' },
  { id: 'edit_expense', name_en: 'Edit Expense', name_ar: 'تعديل مصروف', description_en: 'Allows editing existing expense requests', description_ar: 'يسمح بتعديل طلبات المصروفات الحالية', category: 'expenses' },
  { id: 'delete_expense', name_en: 'Delete Expense', name_ar: 'حذف مصروف', description_en: 'Allows deleting expense requests', description_ar: 'يسمح بحذف طلبات المصروفات', category: 'expenses' },
  { id: 'create_voucher', name_en: 'Create Cash Voucher', name_ar: 'إنشاء سند صرف نقدي', description_en: 'Allows creating a cash payment voucher', description_ar: 'يسمح بإنشاء سند صرف نقدي', category: 'vouchers' },
  { id: 'approve_voucher', name_en: 'Approve Cash Voucher', name_ar: 'اعتماد سند صرف نقدي', description_en: 'Allows approving pending cash vouchers', description_ar: 'يسمح باعتماد سندات الصرف المعلقة', category: 'vouchers' },
  { id: 'reject_voucher', name_en: 'Reject Cash Voucher', name_ar: 'رفض سند صرف نقدي', description_en: 'Allows rejecting cash vouchers', description_ar: 'يسمح برفض سندات الصرف النقدي', category: 'vouchers' },
  { id: 'create_custody', name_en: 'Create Custody Setup', name_ar: 'إعداد عهدة جديدة', description_en: 'Allows creating new cash custody configuration', description_ar: 'يسمح بإعداد عهد جديدة لمرفق أو محطة', category: 'custody' },
  { id: 'edit_custody', name_en: 'Edit Custody Amount', name_ar: 'تعديل قيمة العهدة', description_en: 'Allows editing custody limits and details', description_ar: 'يسمح بتعديل حدود وتفاصيل العهد', category: 'custody' },
  { id: 'replace_custody', name_en: 'Replace/Replenish Custody', name_ar: 'استعاضة عهدة', description_en: 'Allows requesting/replenishing custody funds', description_ar: 'يسمح بطلب تعويض أو استعاضة العهدة', category: 'custody' },
  { id: 'view_reports', name_en: 'View Reports', name_ar: 'عرض التقارير والتحليلات', description_en: 'Allows access to reports and export metrics', description_ar: 'يسمح بالوصول إلى التقارير وتصدير البيانات', category: 'reports' },
  { id: 'manage_users', name_en: 'Manage Users', name_ar: 'إدارة المستخدمين', description_en: 'Allows managing user accounts and assignments', description_ar: 'يسمح بإدارة حسابات المستخدمين وتعييناتهم', category: 'admin' },
  { id: 'manage_companies', name_en: 'Manage Companies', name_ar: 'إدارة الشركات', description_en: 'Allows managing companies inside the ecosystem', description_ar: 'يسمح بإدارة الشركات في النظام', category: 'admin' },
  { id: 'manage_regions', name_en: 'Manage Regions', name_ar: 'إدارة الأقاليم والمناطق', description_en: 'Allows managing geographic region entities', description_ar: 'يسمح بإدارة أقاليم ومناطق العمل', category: 'admin' },
  { id: 'manage_stations', name_en: 'Manage Stations', name_ar: 'إدارة الفروع والمحطات', description_en: 'Allows managing station/branch entities', description_ar: 'يسمح بإدارة المحطات والفروع التابعة للشركة', category: 'admin' },
  { id: 'manage_roles', name_en: 'Manage Roles', name_ar: 'إدارة الأدوار والصلاحيات', description_en: 'Allows modifying roles and mapping custom permissions', description_ar: 'يسمح بتعديل الأدوار وربط الصلاحيات المخصصة لها', category: 'admin' },
  { id: 'manage_settings', name_en: 'Manage General Settings', name_ar: 'إدارة الإعدادات العامة', description_en: 'Allows changing system configurations', description_ar: 'يسمح بتعديل الإعدادات العامة للنظام', category: 'admin' }
];

export const DEFAULT_ROLES: SystemRole[] = [
  {
    id: 'SystemAdmin',
    name_en: 'System Administrator',
    name_ar: 'مدير النظام الشامل',
    permissions: {
      create_expense: true, edit_expense: true, delete_expense: true,
      create_voucher: true, approve_voucher: true, reject_voucher: true,
      create_custody: true, edit_custody: true, replace_custody: true,
      view_reports: true, manage_users: true, manage_companies: true,
      manage_regions: true, manage_stations: true, manage_roles: true,
      manage_settings: true, settle_voucher: true
    }
  },
  {
    id: 'Admin',
    name_en: 'Company Administrator',
    name_ar: 'مدير عهدة الشركة',
    permissions: {
      create_expense: true, edit_expense: true, delete_expense: true,
      create_voucher: true, approve_voucher: true, reject_voucher: true,
      create_custody: true, edit_custody: true, replace_custody: true,
      view_reports: true, manage_users: true, manage_companies: false,
      manage_regions: true, manage_stations: true, manage_roles: true,
      manage_settings: true, settle_voucher: true
    }
  },
  {
    id: 'RegionalManager',
    name_en: 'Regional Manager',
    name_ar: 'مدير منطقة / إقليم',
    permissions: {
      create_expense: false, edit_expense: false, delete_expense: false,
      create_voucher: false, approve_voucher: true, reject_voucher: true,
      create_custody: false, edit_custody: false, replace_custody: true,
      view_reports: true, manage_users: false, manage_companies: false,
      manage_regions: false, manage_stations: false, manage_roles: false,
      manage_settings: false, settle_voucher: false
    }
  },
  {
    id: 'StationAdmin',
    name_en: 'Station Cashier / Admin',
    name_ar: 'أمين عهدة المحطة',
    permissions: {
      create_expense: true, edit_expense: true, delete_expense: false,
      create_voucher: true, approve_voucher: false, reject_voucher: false,
      create_custody: false, edit_custody: false, replace_custody: false,
      view_reports: true, manage_users: false, manage_companies: false,
      manage_regions: false, manage_stations: false, manage_roles: false,
      manage_settings: false, settle_voucher: true
    }
  }
];

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
    });
  }

  static enrichUserPermissions(role: UserRole, currentPerms?: Partial<UserPermissions>): UserPermissions {
    const isSystemAdmin = role === 'SystemAdmin';
    const isAdmin = role === 'Admin';
    const isRegional = role === 'RegionalManager';
    const isStation = role === 'StationAdmin';

    return {
      create_expense: (isAdmin || isSystemAdmin) ? false : (currentPerms?.create_expense ?? (isSystemAdmin || isStation)),
      edit_expense: currentPerms?.edit_expense ?? (isSystemAdmin || isAdmin || isStation),
      delete_expense: currentPerms?.delete_expense ?? (isSystemAdmin || isAdmin),
      create_voucher: (isAdmin || isSystemAdmin) ? false : (currentPerms?.create_voucher ?? (isSystemAdmin || isStation)),
      approve_voucher: currentPerms?.approve_voucher ?? (isSystemAdmin || isAdmin || isRegional),
      reject_voucher: currentPerms?.reject_voucher ?? (isSystemAdmin || isAdmin || isRegional),
      create_custody: currentPerms?.create_custody ?? (isSystemAdmin || isAdmin),
      edit_custody: currentPerms?.edit_custody ?? (isSystemAdmin || isAdmin),
      replace_custody: currentPerms?.replace_custody ?? (isSystemAdmin || isAdmin || isRegional),
      view_reports: currentPerms?.view_reports ?? true,
      manage_users: currentPerms?.manage_users ?? (isSystemAdmin || isAdmin),
      manage_companies: currentPerms?.manage_companies ?? isSystemAdmin,
      manage_regions: currentPerms?.manage_regions ?? (isSystemAdmin || isAdmin),
      manage_stations: currentPerms?.manage_stations ?? (isSystemAdmin || isAdmin),
      manage_roles: currentPerms?.manage_roles ?? (isSystemAdmin || isAdmin),
      manage_settings: currentPerms?.manage_settings ?? (isSystemAdmin || isAdmin),
      settle_voucher: (isAdmin || isSystemAdmin) ? false : (currentPerms?.settle_voucher ?? (isSystemAdmin || isStation)),
    };
  }

  private static cache: Record<string, any> = {};

  static clearCache(): void {
    CustodyDB.cache = {};
  }

  static initializeCacheListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('custody_db_updated', () => {
        CustodyDB.cache = {};
      });
    }
  }

  private static getStored<T>(key: string, defaultValue: T): T {
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }
    try {
      const data = localStorage.getItem(`custody_${key}`);
      const parsed = data ? JSON.parse(data) : defaultValue;
      this.cache[key] = parsed;
      return parsed;
    } catch {
      return defaultValue;
    }
  }

  private static setStored<T>(key: string, value: T): void {
    this.cache[key] = value;
    localStorage.setItem(`custody_${key}`, JSON.stringify(value));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  }

  // Companies
  static getCompanies(): Company[] {
    return this.getStored<Company[]>('companies', DEFAULT_COMPANIES);
  }

  static saveCompanies(companies: Company[]): void {
    this.setStored('companies', companies);
    companies.forEach(c => dbSetDoc('companies', c.id, c));
  }

  static addCompany(name: string, custodyValue?: number): Company {
    const companies = this.getCompanies();
    const val = custodyValue ?? 0;
    const newCompany: Company = {
      id: `comp-${Date.now()}`,
      name,
      custody_value: val
    };
    companies.push(newCompany);
    this.saveCompanies(companies);
    
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Company', `Created new company: ${name}`);
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
    if (this.cache['active_user'] !== undefined) {
      return this.cache['active_user'];
    }
    const user = localStorage.getItem('custody_active_user');
    if (!user) {
      this.cache['active_user'] = null;
      return null;
    }
    const parsed = JSON.parse(user);
    if (parsed) {
      const isPlatformAdminEmail = parsed.email && (
        parsed.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || 
        parsed.email.toLowerCase().trim() === 'alaabusalah96@gmail.com'
      );
      if (isPlatformAdminEmail && (parsed.role !== 'SystemAdmin' || !parsed.is_active)) {
        const updated = {
          ...parsed,
          role: 'SystemAdmin' as const,
          is_active: true,
          permissions: this.enrichUserPermissions('SystemAdmin')
        };
        localStorage.setItem('custody_active_user', JSON.stringify(updated));
        this.cache['active_user'] = updated;
        return updated;
      }
      parsed.permissions = this.enrichUserPermissions(parsed.role, parsed.permissions);
      this.cache['active_user'] = parsed;
      return parsed as AppUser;
    }
    this.cache['active_user'] = null;
    return null;
  }

  static setActiveUser(user: AppUser | null): void {
    if (user) {
      this.cache['active_user'] = user;
      localStorage.setItem('custody_active_user', JSON.stringify(user));
      this.addLog(user.id, user.full_name, 'Login Session', `User logged in with role ${user.role}.`);
      this.logAudit('USER_LOGIN', `User ${user.full_name} logged in with role ${user.role}.`, {
        after: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
      });
    } else {
      const current = this.getActiveUser();
      if (current) {
        this.addLog(current.id, current.full_name, 'Logout Session', 'User signed out of system.');
        this.logAudit('USER_LOGOUT', `User ${current.full_name} logged out of the system.`, {
          before: { id: current.id, full_name: current.full_name, email: current.email, role: current.role }
        });
      }
      this.cache['active_user'] = null;
      localStorage.removeItem('custody_active_user');
    }
  }

  // Impersonation Support
  static impersonateUser(targetUser: AppUser, reason?: string): void {
    const activeUser = this.getActiveUser();
    if (!activeUser || (activeUser.role !== 'SystemAdmin' && !activeUser.impersonator)) {
      throw new Error('Only a SystemAdmin can impersonate users.');
    }
    
    // Store original Super Admin context
    const superAdmin = activeUser.impersonator || activeUser;
    
    // Get target user's company name if any
    const companies = this.getCompanies();
    const company = companies.find(c => c.id === targetUser.company_id);
    const companyName = company ? company.name : 'Unknown';

    // Store Super Admin context inside the target user session
    const impersonatedUser: AppUser = {
      ...targetUser,
      impersonator: superAdmin
    };

    localStorage.setItem('custody_active_user', JSON.stringify(impersonatedUser));

    // Log the IMPERSONATION_START event
    this.addLog(superAdmin.id, superAdmin.full_name, 'Impersonation Start', `Super Admin began impersonating ${targetUser.full_name} (${companyName})`);
    this.logAudit('IMPERSONATION_START', `Super Admin ${superAdmin.full_name} entered technical support session as ${targetUser.full_name} (${companyName})`, {
      impersonator_id: superAdmin.id,
      impersonator_name: superAdmin.full_name,
      company_id: targetUser.company_id || 'none',
      company_name: companyName,
      target_user_id: targetUser.id,
      target_user_name: targetUser.full_name,
      reason: reason || 'Technical Support / الدعم الفني',
      login_time: new Date().toISOString()
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  }

  static exitImpersonation(): void {
    const activeUser = this.getActiveUser();
    if (!activeUser || !activeUser.impersonator) {
      throw new Error('No active impersonation session found.');
    }

    const superAdmin = activeUser.impersonator;

    // Get company name
    const companies = this.getCompanies();
    const company = companies.find(c => c.id === activeUser.company_id);
    const companyName = company ? company.name : 'Unknown';

    // Restore the Super Admin as active user
    localStorage.setItem('custody_active_user', JSON.stringify(superAdmin));

    // Log the IMPERSONATION_END event
    this.addLog(superAdmin.id, superAdmin.full_name, 'Impersonation End', `Super Admin ended impersonating ${activeUser.full_name}`);
    this.logAudit('IMPERSONATION_END', `Super Admin ${superAdmin.full_name} exited technical support session for ${activeUser.full_name} (${companyName})`, {
      impersonator_id: superAdmin.id,
      impersonator_name: superAdmin.full_name,
      company_id: activeUser.company_id || 'none',
      company_name: companyName,
      target_user_id: activeUser.id,
      target_user_name: activeUser.full_name,
      logout_time: new Date().toISOString()
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  }

  // Admin and Password Resets
  static resetUserPassword(userId: string, newPasswordPlain: string): void {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      const hashed = hashPassword(newPasswordPlain);
      users[idx] = { ...users[idx], password: hashed };
      this.saveUsers(users);
      
      const activeUser = this.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      this.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Reset Password', `Reset password for user ${users[idx].full_name}`);
      this.logAudit('PASSWORD_RESET', `Super Admin reset password for ${users[idx].full_name}`, {
        target_user_id: userId,
        target_user_name: users[idx].full_name
      });
    }
  }

  static toggleCompanyStatus(companyId: string, isActive: boolean): void {
    const companies = this.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      companies[idx] = { ...companies[idx], is_active: isActive };
      this.saveCompanies(companies);
      
      const activeUser = this.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      const statusStr = isActive ? 'Activated' : 'Suspended';
      this.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Toggle Company Status', `${statusStr} company ${companies[idx].name}`);
      this.logAudit('COMPANY_STATUS_TOGGLE', `Super Admin ${statusStr.toLowerCase()} company ${companies[idx].name}`, {
        company_id: companyId,
        company_name: companies[idx].name,
        is_active: isActive
      });
    }
  }

  static updateCompanySubscription(companyId: string, plan: Company['subscription_plan'], status: Company['subscription_status'], expiry: string): void {
    const companies = this.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      companies[idx] = { 
        ...companies[idx], 
        subscription_plan: plan, 
        subscription_status: status, 
        subscription_expiry: expiry 
      };
      this.saveCompanies(companies);
      
      const activeUser = this.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      this.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Update Subscription', `Updated subscription for ${companies[idx].name} to ${plan} (${status})`);
      this.logAudit('COMPANY_SUBSCRIPTION_UPDATE', `Super Admin updated subscription for company ${companies[idx].name} to plan ${plan} with status ${status}`, {
        company_id: companyId,
        company_name: companies[idx].name,
        subscription_plan: plan,
        subscription_status: status,
        subscription_expiry: expiry
      });
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

  static addRegion(name: string, code?: string, companyId?: string): Region {
    const regions = this.getRegions();
    const compId = companyId || this.getSelectedCompanyId();
    const newReg: Region = {
      id: `reg-${Date.now()}`,
      name,
      code: code || '',
      company_id: compId
    };
    regions.push(newReg);
    this.saveRegions(regions);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Region', `Created region: ${name}`);
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
    this.logAudit('CREATE_STATION', `Created station ${name} (${code}) with custody ${custodyAmount} EGP.`, {
      after: newStn
    });
    return newStn;
  }

  static updateStation(id: string, updates: Partial<Station>): void {
    const stations = this.getStations();
    const idx = stations.findIndex(s => s.id === id);
    if (idx !== -1) {
      const before = { ...stations[idx] };
      const after = { ...stations[idx], ...updates };
      stations[idx] = after;
      this.saveStations(stations);

      // If custody_amount changed, propagate difference to company's custody_value
      if (updates.custody_amount !== undefined && updates.custody_amount !== before.custody_amount) {
        const diff = updates.custody_amount - before.custody_amount;
        const compId = before.company_id || this.getSelectedCompanyId();
        const companies = this.getCompanies();
        const compIdx = companies.findIndex(c => c.id === compId);
        if (compIdx !== -1) {
          const updatedCompany = {
            ...companies[compIdx],
            custody_value: (companies[compIdx].custody_value || 0) + diff
          };
          companies[compIdx] = updatedCompany;
          this.saveCompanies(companies);
          dbSetDoc('companies', compId, updatedCompany);
        }
      }

      const user = this.getActiveUser();
      this.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Station', `Modified station: ${stations[idx].station_name}`);
      this.logAudit('UPDATE_STATION', `Updated station ${before.station_name} (${before.station_code}).`, {
        before,
        after
      });
    }
  }

  static deleteStation(id: string): void {
    const before = this.getStations().find(s => s.id === id);
    const stations = this.getStations().filter(s => s.id !== id);
    this.saveStations(stations);
    dbDeleteDoc('stations', id);
    const user = this.getActiveUser();
    this.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Station', `Deleted station ID: ${id}`);
    if (before) {
      this.logAudit('DELETE_STATION', `Deleted station ${before.station_name} (${before.station_code}).`, {
        before
      });
    }
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
      const isPlatformAdminEmail = u.email && (
        u.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || 
        u.email.toLowerCase().trim() === 'alaabusalah96@gmail.com'
      );
      const role = isPlatformAdminEmail ? ('SystemAdmin' as const) : u.role;
      const is_active = isPlatformAdminEmail ? true : (u.is_active ?? true); // default existing seeded users to true
      
      if (role !== u.role || is_active !== u.is_active) {
        changed = true;
      }
      return {
        ...u,
        role,
        is_active,
        permissions: this.enrichUserPermissions(role, u.permissions)
      };
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
    const enriched = users.map(u => ({
      ...u,
      permissions: this.enrichUserPermissions(u.role, u.permissions)
    }));
    this.setStored('users', enriched);
    enriched.forEach(u => dbSetDoc('users', u.id, u));
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
      const regionStations = stations.filter(s => {
        const isSameCompany = s.company_id === targetCompanyId;
        if (!isSameCompany) return false;
        if (!user.region_id) return true;
        return s.region_id === user.region_id || !s.region_id || s.region_id === '' || s.region_id === 'none';
      });
      const targetStationIds = regionStations.map(s => s.id);
      return companyTxs.filter(t => t.station_id && targetStationIds.includes(t.station_id));
    }
        // StationAdmin or Regular Cashier
    const userStationId = user.station_id || 'stn-1-1-1';
    return companyTxs.filter(t => t.station_id === userStationId);
  }

  static saveTransactions(transactions: Transaction[]): void {
    this.setStored('transactions', transactions);
  }

  static addTransaction(data: Omit<Transaction, 'id' | 'transaction_no' | 'status' | 'created_at' | 'updated_at' | 'created_by'> & { status?: TransactionStatus }): Transaction {
    const transactions = this.getTransactions();
    
    // No transaction number sequence is generated initially
    const transaction_no = "";
    
    const user = this.getActiveUser();
    const station_id = data.station_id || user?.station_id || 'stn-1-1-1';
    const company_id = user?.company_id || this.getSelectedCompanyId();

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
    this.saveTransactions(transactions);

    // Sync to Firestore
    dbSetDoc('transactions', newTx.id, newTx);

    // Save history
    this.addTransactionHistory({
      id: `txh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      transaction_id: newTx.id,
      action: 'Created',
      performed_by: user?.id || 'unknown',
      performed_by_name: user?.full_name || 'Anonymous',
      timestamp: newTx.created_at,
      new_status: newTx.status,
      notes: newTx.notes || `Registered ${newTx.status} expense`
    });

    this.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Create Transaction',
      `Registered ${newTx.status} expense for ${newTx.amount.toLocaleString()} EGP - "${newTx.description}"`
    );

    this.logAudit(
      'CREATE_TRANSACTION',
      `Registered ${newTx.status} expense for ${newTx.amount.toLocaleString()} EGP - "${newTx.description}"`,
      { after: newTx }
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

      // If status changed to 'Settled' (and was not 'Settled' before)
      if (updates.status === 'Settled' && old.status !== 'Settled') {
        const amount = updated.amount;
        const stationId = updated.station_id;
        if (stationId) {
          const stations = this.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const nextAmount = oldAmount - amount;
            stations[stIdx] = {
              ...stations[stIdx],
              custody_amount: nextAmount
            };
            this.saveStations(stations);
            dbSetDoc('stations', stationId, stations[stIdx]);

            // Also update company's custody_value
            const compId = stations[stIdx].company_id || this.getSelectedCompanyId();
            const companies = this.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) - amount
              };
              companies[compIdx] = updatedCompany;
              this.saveCompanies(companies);
              dbSetDoc('companies', compId, updatedCompany);
            }
          }
        }
      }

      // If status changed FROM 'Settled' to something else (and was 'Settled' before)
      if (old.status === 'Settled' && updates.status !== undefined && updates.status !== 'Settled') {
        const amount = old.amount;
        const stationId = old.station_id;
        if (stationId) {
          const stations = this.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const nextAmount = oldAmount + amount;
            stations[stIdx] = {
              ...stations[stIdx],
              custody_amount: nextAmount
            };
            this.saveStations(stations);
            dbSetDoc('stations', stationId, stations[stIdx]);

            // Also update company's custody_value
            const compId = stations[stIdx].company_id || this.getSelectedCompanyId();
            const companies = this.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) + amount
              };
              companies[compIdx] = updatedCompany;
              this.saveCompanies(companies);
              dbSetDoc('companies', compId, updatedCompany);
            }
          }
        }
      }

      // If status remains 'Settled' but amount changed, adjust the custody balance by the difference
      if (old.status === 'Settled' && (updates.status === undefined || updates.status === 'Settled') && updates.amount !== undefined && updates.amount !== old.amount) {
        const diff = updates.amount - old.amount; // e.g. 150 - 100 = 50 (extra deduction)
        const stationId = old.station_id;
        if (stationId) {
          const stations = this.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const nextAmount = oldAmount - diff;
            stations[stIdx] = {
              ...stations[stIdx],
              custody_amount: nextAmount
            };
            this.saveStations(stations);
            dbSetDoc('stations', stationId, stations[stIdx]);

            // Also update company's custody_value
            const compId = stations[stIdx].company_id || this.getSelectedCompanyId();
            const companies = this.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) - diff
              };
              companies[compIdx] = updatedCompany;
              this.saveCompanies(companies);
              dbSetDoc('companies', compId, updatedCompany);
            }
          }
        }
      }

      // Sync and handle parent CashVoucher updates if status changed
      if (updates.status && updates.status !== old.status) {
        const vouchers = this.getCashVouchers();
        const associatedVoucher = vouchers.find(v => v.expense_ids && v.expense_ids.includes(id));
        if (associatedVoucher) {
          let voucherStatus = associatedVoucher.status;
          let expenseIds = [...associatedVoucher.expense_ids];
          let voucherAmount = associatedVoucher.amount;

          if (updates.status === 'Pending' || updates.status === 'Rejected') {
            // Reverted/Rejected - remove from voucher
            expenseIds = expenseIds.filter(eid => eid !== id);
            voucherAmount = Math.max(0, voucherAmount - old.amount);
            if (expenseIds.length === 0) {
              voucherStatus = 'Draft';
            }
            // Clean up voucher info on the transaction
            updated.voucher_no = '';
            updated.voucher_date = '';
          } else if (updates.status === 'Under Settlement') {
            voucherStatus = 'Approved'; // which maps to "Under Settlement" state in CPV page
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
          this.setStored('CashVouchers', finalVouchers);

          if (updatedVoucher.expense_ids.length === 0) {
            dbDeleteDoc('CashVouchers', associatedVoucher.id);
          } else {
            dbSetDoc('CashVouchers', associatedVoucher.id, updatedVoucher);
          }
        }
      }

      transactions[idx] = updated;
      this.saveTransactions(transactions);

      // Sync to Firestore
      dbSetDoc('transactions', id, updated);

      // Save to TransactionHistory if status changed
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

        this.addTransactionHistory({
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

      this.logAudit(
        'UPDATE_TRANSACTION',
        `Updated transaction ${old.transaction_no} (Status: ${old.status} ➔ ${updated.status}).`,
        { before: old, after: updated }
      );
    }
  }

  static async deleteTransaction(id: string, reason: string): Promise<boolean> {
    const user = this.getActiveUser();
    if (!user) return false;

    const transactions = this.getTransactions();
    const tx = transactions.find(t => t.id === id);
    if (!tx) return false;

    // Audit check: Allow Admin, SystemAdmin, RegionalManager (scoped to their region), StationAdmin (scoped to their station), or the original creator
    let isAuthorized = false;
    if (user.role === 'Admin' || user.role === 'SystemAdmin') {
      isAuthorized = true;
    } else if (user.role === 'RegionalManager') {
      const stations = this.getStations();
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
      this.addLog(user?.id || 'unknown', user?.full_name || 'Anonymous', 'Access Rejected', `Attempted to delete transaction ${tx.transaction_no} without correct privileges.`);
      return false;
    }

    const stations = this.getStations();
    const station = stations.find(s => s.id === tx.station_id);
    const stationName = station ? station.station_name : (tx.station_id || 'Unknown');
    
    const regions = this.getRegions();
    const region = station ? regions.find(r => r.id === station.region_id) : null;
    const regionName = region ? region.name : 'Unknown';

    // 1. Updated Transactions (mark as Deleted)
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

    // 2. Updated Cash Vouchers
    const vouchers = this.getCashVouchers();
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

    // 3. Prepare Deleted Record
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

    // 4. Notifications according to Administrative Hierarchy
    const notificationsToSend: Notification[] = [];
    const allUsers = this.getUsers();

    const deletedByRoleAr = user.role === 'StationAdmin' ? 'أمين عهدة محطة' : (user.role === 'RegionalManager' ? 'مدير منطقة' : (user.role === 'Admin' ? 'أدمن الشركة' : 'مشرف النظام'));
    const deletedByRoleEn = user.role === 'StationAdmin' ? 'Station Cashier' : (user.role === 'RegionalManager' ? 'Regional Manager' : (user.role === 'Admin' ? 'Company Admin' : 'System Admin'));

    const notificationTitleAr = `⚠️ تم حذف عملية: ${tx.transaction_no}`;
    const notificationTitleEn = `⚠️ Deleted Transaction: ${tx.transaction_no}`;

    const notificationMessageAr = `قام [${user.full_name}] (${deletedByRoleAr}) بحذف عملية رقم (${tx.transaction_no}) بمبلغ (${tx.amount.toLocaleString()} ج.م) التابعة لمحطة [${stationName}]. سبب الحذف: ${reason}`;
    const notificationMessageEn = `[${user.full_name}] (${deletedByRoleEn}) deleted transaction (${tx.transaction_no}) worth (${tx.amount.toLocaleString()} EGP) of station [${stationName}]. Reason: ${reason}`;

    // Clean undefined helper inside DB scope
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

    if (user.role === 'StationAdmin') {
      // Find regional manager for this region/station
      const regionalManagers = allUsers.filter(u => 
        u.role === 'RegionalManager' && 
        u.company_id === tx.company_id && 
        (station && u.region_id === station.region_id)
      );

      // Find company admins
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
      // Find company admins only
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

    // 5. Execute Firestore Atomic Transaction (Write Batch)
    try {
      const batch = writeBatch(db);

      // If the deleted transaction was Settled, restore custody balance
      if (tx.status === 'Settled') {
        const amount = tx.amount;
        const stationId = tx.station_id;
        if (stationId) {
          const stations = this.getStations();
          const stIdx = stations.findIndex(s => s.id === stationId);
          if (stIdx !== -1) {
            const oldAmount = stations[stIdx].custody_amount;
            const updatedStation = {
              ...stations[stIdx],
              custody_amount: oldAmount + amount
            };
            stations[stIdx] = updatedStation;
            this.saveStations(stations);
            batch.set(doc(db, 'stations', stationId), cleanUndefined(updatedStation));

            // Also update company's custody_value
            const compId = stations[stIdx].company_id || this.getSelectedCompanyId();
            const companies = this.getCompanies();
            const compIdx = companies.findIndex(c => c.id === compId);
            if (compIdx !== -1) {
              const updatedCompany = {
                ...companies[compIdx],
                custody_value: (companies[compIdx].custody_value || 0) + amount
              };
              companies[compIdx] = updatedCompany;
              this.saveCompanies(companies);
              batch.set(doc(db, 'companies', compId), cleanUndefined(updatedCompany));
            }
          }
        }
      }

      // A. Update original transaction document to 'Deleted' status
      const updatedTxObj = {
        ...tx,
        status: 'Deleted' as any,
        updated_at: new Date().toISOString()
      };
      batch.set(doc(db, 'transactions', tx.id), cleanUndefined(updatedTxObj));

      // B. Update/Delete associated cash vouchers
      updatedVouchers.forEach(v => {
        if (v.expense_ids && v.expense_ids.length === 0) {
          batch.delete(doc(db, 'CashVouchers', v.id));
        } else {
          batch.set(doc(db, 'CashVouchers', v.id), cleanUndefined(v));
        }
      });

      // B2. Set Deleted Transaction Record for Legacy Support
      batch.set(doc(db, 'deleted_transactions', deletedRecordId), cleanUndefined(deletedRecord));

      // C. Set Notifications
      notificationsToSend.forEach(ntf => {
        batch.set(doc(db, 'Notifications', ntf.id), cleanUndefined(ntf));
      });

      // D. Set Logs
      batch.set(doc(db, 'logs', logId), cleanUndefined(newLog));

      // E. Set Audit Log
      batch.set(doc(db, 'AuditLogs', auditLogId), cleanUndefined(newAuditLog));

      // COMMIT TRANSACTION
      await batch.commit();

      // IF SUCCEEDED: Update localStorage and trigger events
      this.saveTransactions(updatedTxs);

      // Save Deleted Transaction locally for Legacy Support
      const currentDeleted = this.getDeletedTransactions();
      currentDeleted.unshift(deletedRecord);
      this.saveDeletedTransactions(currentDeleted);

      // Filter and save Cash Vouchers locally
      const remainingVouchers = updatedVouchers.filter(v => v.expense_ids && v.expense_ids.length > 0);
      this.setStored('CashVouchers', remainingVouchers);

      // Save Notifications locally
      const currentNotifications = this.getNotifications();
      notificationsToSend.forEach(n => currentNotifications.unshift(n));
      this.setStored('Notifications', currentNotifications);

      // Save Logs locally
      const currentLogs = this.getLogs();
      currentLogs.unshift(newLog);
      this.setStored('logs', currentLogs.slice(0, 150));

      // Save Audit Logs locally
      const currentAudit = this.getAuditLogs();
      currentAudit.unshift(newAuditLog);
      this.setStored('AuditLogs', currentAudit);

      return true;
    } catch (err) {
      console.error('Database transaction failed. Changes rolled back. Error:', err);
      // Rollback is automatic on firestore batch. We return false and do NOT update local storage.
      return false;
    }
  }

  static async restoreTransaction(id: string): Promise<boolean> {
    const user = this.getActiveUser();
    if (!user) return false;

    // 1. Find the associated DeletedTransaction record to find its original_status and actual transaction_id
    const deletedTxList = this.getDeletedTransactions();
    const delRecord = deletedTxList.find(d => d.id === id || d.transaction_id === id);
    if (!delRecord) {
      console.error('restoreTransaction: Deleted transaction record not found', id);
      return false;
    }

    const txId = delRecord.transaction_id || id;
    const originalStatus = (delRecord.original_status || 'Pending') as any;

    // 2. Find the transaction in local storage or remote
    const transactions = this.getTransactions();
    const tx = transactions.find(t => t.id === txId || t.id === id);
    if (!tx) {
      console.error('restoreTransaction: Transaction not found in local state', txId);
      return false;
    }

    // 3. Authorization Check (Allow Admin, SystemAdmin, RegionalManager scoped, or original creator)
    let isAuthorized = false;
    if (user.role === 'Admin' || user.role === 'SystemAdmin') {
      isAuthorized = true;
    } else if (user.role === 'RegionalManager') {
      const stations = this.getStations();
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
      this.addLog(user?.id || 'unknown', user?.full_name || 'Anonymous', 'Access Rejected', `Attempted to restore transaction ${tx.transaction_no} without correct privileges.`);
      return false;
    }

    const stations = this.getStations();
    const station = stations.find(s => s.id === tx.station_id);
    const stationName = station ? station.station_name : (tx.station_id || 'Unknown');
    
    const regions = this.getRegions();
    const region = station ? regions.find(r => r.id === station.region_id) : null;
    const regionName = region ? region.name : 'Unknown';

    // 4. Update the transaction status back to originalStatus
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

    // 5. Update/Restore the Cash Voucher if applicable
    const vouchers = this.getCashVouchers();
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
        // Recreate the deleted cash voucher!
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

    // 6. If original status was 'Settled', deduct custody balance again
    // (reverse of deletion which returned money to custody)
    let updatedStationObj: Station | null = null;
    let updatedCompanyObj: Company | null = null;

    if (originalStatus === 'Settled') {
      const amount = tx.amount;
      const stationId = tx.station_id;
      if (stationId) {
        const stIdx = stations.findIndex(s => s.id === stationId);
        if (stIdx !== -1) {
          const oldAmount = stations[stIdx].custody_amount;
          // Deduct from custody_amount
          const nextCustody = Math.max(0, oldAmount - amount);
          updatedStationObj = {
            ...stations[stIdx],
            custody_amount: nextCustody
          };
          stations[stIdx] = updatedStationObj;
          this.saveStations(stations);

          // Deduct from company's custody_value
          const compId = stations[stIdx].company_id || this.getSelectedCompanyId();
          const companies = this.getCompanies();
          const compIdx = companies.findIndex(c => c.id === compId);
          if (compIdx !== -1) {
            const updatedCompany = {
              ...companies[compIdx],
              custody_value: Math.max(0, (companies[compIdx].custody_value || 0) - amount)
            };
            companies[compIdx] = updatedCompany;
            this.saveCompanies(companies);
            updatedCompanyObj = updatedCompany;
          }
        }
      }
    }

    // 7. Prepare Logs, Audit, and Notifications
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
    const allUsers = this.getUsers();

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

    // 8. Execute Firestore Transaction via writeBatch
    try {
      const batch = writeBatch(db);

      // A. Restore original transaction status
      const restoredTxObj = {
        ...tx,
        status: originalStatus,
        updated_at: new Date().toISOString()
      };
      batch.set(doc(db, 'transactions', tx.id), cleanUndefined(restoredTxObj));

      // B. Remove DeletedTransaction record from Firestore
      if (delRecord) {
        batch.delete(doc(db, 'deleted_transactions', delRecord.id));
      }

      // C. Update station and company custody if Settled
      if (updatedStationObj) {
        batch.set(doc(db, 'stations', updatedStationObj.id), cleanUndefined(updatedStationObj));
      }
      if (updatedCompanyObj) {
        batch.set(doc(db, 'companies', updatedCompanyObj.id), cleanUndefined(updatedCompanyObj));
      }

      // D. Update or recreate CashVoucher
      if (voucherToUpdateOrRecreate) {
        batch.set(doc(db, 'CashVouchers', voucherToUpdateOrRecreate.id), cleanUndefined(voucherToUpdateOrRecreate));
      }

      // E. Notifications
      notificationsToSend.forEach(ntf => {
        batch.set(doc(db, 'Notifications', ntf.id), cleanUndefined(ntf));
      });

      // F. Activity Logs
      batch.set(doc(db, 'logs', logId), cleanUndefined(newLog));

      // G. Audit Log
      batch.set(doc(db, 'AuditLogs', auditLogId), cleanUndefined(newAuditLog));

      // Commit Batch
      await batch.commit();

      // 9. Update Local Storage
      this.saveTransactions(updatedTxs);

      // Remove DeletedTransaction record locally
      if (delRecord) {
        const remainingDeleted = deletedTxList.filter(d => d.id !== delRecord.id);
        this.saveDeletedTransactions(remainingDeleted);
      }

      // Save/Update CashVoucher locally
      if (voucherToUpdateOrRecreate) {
        const updatedVouchers = vouchers.map(v => v.id === voucherToUpdateOrRecreate!.id ? voucherToUpdateOrRecreate! : v);
        if (isRecreatingVoucher || !vouchers.some(v => v.id === voucherToUpdateOrRecreate!.id)) {
          updatedVouchers.unshift(voucherToUpdateOrRecreate);
        }
        this.setStored('CashVouchers', updatedVouchers);
      }

      // Save notifications, logs, audit logs locally
      const currentNotifications = this.getNotifications();
      notificationsToSend.forEach(n => currentNotifications.unshift(n));
      this.setStored('Notifications', currentNotifications);

      const currentLogs = this.getLogs();
      currentLogs.unshift(newLog);
      this.setStored('logs', currentLogs.slice(0, 150));

      const currentAudit = this.getAuditLogs();
      currentAudit.unshift(newAuditLog);
      this.setStored('AuditLogs', currentAudit);

      return true;
    } catch (err) {
      console.error('Database transaction failed on restore. Error:', err);
      return false;
    }
  }

  // Logs
  static getLogs(): ActivityLog[] {
    return this.getStored<ActivityLog[]>('logs', DEFAULT_LOGS);
  }

  static addLog(userId: string, userName: string, action: string, details: string, stationId?: string, companyId?: string, amount?: number, notes?: string): void {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: userId,
      user_name: userName,
      action,
      details,
      timestamp: new Date().toISOString(),
      station_id: stationId,
      company_id: companyId,
      amount,
      notes
    };
    logs.unshift(newLog); // new logs first
    this.setStored('logs', logs.slice(0, 150)); // limit audit records

    // Sync to Firestore
    dbSetDoc('logs', newLog.id, newLog);
  }

  static deleteLog(id: string): void {
    const logs = this.getLogs();
    const filtered = logs.filter(l => l.id !== id);
    this.setStored('logs', filtered);
    dbDeleteDoc('logs', id);
  }

  static updateReplenishmentLog(id: string, amount: number, notes: string, details: string): void {
    const logs = this.getLogs();
    const idx = logs.findIndex(l => l.id === id);
    if (idx !== -1) {
      logs[idx] = {
        ...logs[idx],
        amount,
        notes,
        details
      };
      this.setStored('logs', logs);
      dbSetDoc('logs', id, logs[idx]);
    }
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
      const regionStations = stations.filter(s => s.region_id === regionId || !s.region_id || s.region_id === '' || s.region_id === 'none');
      targetStationIds = regionStations.map(s => s.id);
      custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
    } else if (user) {
      if (user.role === 'Admin' || user.role === 'SystemAdmin') {
        // System Admin: see everything combined
        targetStationIds = stations.map(s => s.id);
        custodyValue = stations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else if (user.role === 'RegionalManager') {
        // Regional Manager: Cairo or Alex stations combined
        const regionStations = stations.filter(s => {
          if (!user.region_id) return true;
          return s.region_id === user.region_id || !s.region_id || s.region_id === '' || s.region_id === 'none';
        });
        targetStationIds = regionStations.map(s => s.id);
        custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else {
        // Station Admin: single station
        const userStationId = user.station_id || 'stn-1-1-1';
        targetStationIds = [userStationId];
        const st = stations.find(s => s.id === userStationId);
        custodyValue = st ? st.custody_amount : 0;
      }
    } else {
      // Fallback
      targetStationIds = [stations[0]?.id || 'stn-1-1-1'];
      const st = stations.find(s => s.id === (stations[0]?.id || 'stn-1-1-1'));
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
    const stations = this.getStations();
    const st = stations.find(s => s.id === stationId);
    if (!st) return 0;
    return st.custody_amount;
  }

  static getCompanyDeductedCustody(companyId: string): number {
    const companies = this.getCompanies();
    const comp = companies.find(c => c.id === companyId);
    if (!comp) return 0;
    return comp.custody_value || 0;
  }

  // --- Sprint 2 Collection Accessors ---

  // Expenses
  static getExpenses(): Expense[] {
    return this.getStored<Expense[]>('Expenses', DEFAULT_EXPENSES);
  }

  static saveExpense(expense: Expense): void {
    const expenses = this.getExpenses();
    const index = expenses.findIndex(e => e.id === expense.id);
    if (index > -1) {
      expenses[index] = expense;
    } else {
      expenses.unshift(expense);
    }
    this.setStored('Expenses', expenses);
    dbSetDoc('Expenses', expense.id, expense);
  }

  static deleteExpense(id: string): void {
    const expenses = this.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    this.setStored('Expenses', filtered);
    dbDeleteDoc('Expenses', id);
  }

  // CashVouchers
  static getCashVouchers(): CashVoucher[] {
    return this.getStored<CashVoucher[]>('CashVouchers', DEFAULT_VOUCHERS);
  }

  static saveCashVoucher(voucher: CashVoucher): void {
    const vouchers = this.getCashVouchers();
    const index = vouchers.findIndex(v => v.id === voucher.id);
    const before = index > -1 ? vouchers[index] : null;
    if (index > -1) {
      vouchers[index] = voucher;
    } else {
      vouchers.unshift(voucher);
    }
    this.setStored('CashVouchers', vouchers);
    dbSetDoc('CashVouchers', voucher.id, voucher);

    this.logAudit(
      before ? 'UPDATE_CASH_VOUCHER' : 'CREATE_CASH_VOUCHER',
      before
        ? `Updated Cash Payment Voucher ${voucher.voucher_no} (Total: ${voucher.amount.toLocaleString()} EGP).`
        : `Created Cash Payment Voucher ${voucher.voucher_no} (Total: ${voucher.amount.toLocaleString()} EGP).`,
      { before, after: voucher }
    );
  }

  static deleteCashVoucher(id: string): void {
    const vouchers = this.getCashVouchers();
    const voucher = vouchers.find(v => v.id === id);
    const filtered = vouchers.filter(v => v.id !== id);
    this.setStored('CashVouchers', filtered);
    dbDeleteDoc('CashVouchers', id);

    if (voucher) {
      this.logAudit(
        'DELETE_CASH_VOUCHER',
        `Deleted Cash Payment Voucher ${voucher.voucher_no} (Total: ${voucher.amount.toLocaleString()} EGP).`,
        { before: voucher }
      );
    }
  }

  // Company Sequences for Cash Vouchers
  static getCompanySequences(): { id: string; company_id: string; last_voucher_no: number }[] {
    return this.getStored<{ id: string; company_id: string; last_voucher_no: number }[]>('company_sequences', []);
  }

  static getCompanySequence(companyId: string): number | null {
    const seqs = this.getCompanySequences();
    const found = seqs.find(s => s.company_id === companyId);
    return found ? found.last_voucher_no : null;
  }

  static hasCompanySequence(companyId: string): boolean {
    const seqs = this.getCompanySequences();
    return seqs.some(s => s.company_id === companyId);
  }

  static hasAnyVouchersForCompany(companyId: string): boolean {
    const vouchers = this.getCashVouchers();
    return vouchers.some(v => v.company_id === companyId);
  }

  static needsManualFirstVoucherNo(companyId: string): boolean {
    return !this.hasCompanySequence(companyId);
  }

  static getNextAutoVoucherNo(companyId: string): string {
    const seq = this.getCompanySequence(companyId);
    if (seq !== null) {
      return String(seq + 1);
    }

    const vouchers = this.getCashVouchers().filter(v => v.company_id === companyId);
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

    // Local sequence fallback value
    const localSeq = this.getCompanySequence(companyId);
    const defaultStart = manualFirstNo !== undefined ? manualFirstNo : 1001;
    const fallbackNext = localSeq !== null ? localSeq + 1 : defaultStart;

    // We'll try the Firestore transaction, but race it with a timeout of 1200ms
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

    // Race transaction with a 1200ms timer
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
      // Transaction timed out. Let's do a simple getDoc and setDoc, or if that fails, local-first
      try {
        const docSnap = await getDoc(seqDocRef);
        if (docSnap.exists()) {
          const lastNo = docSnap.data().last_voucher_no;
          finalNo = lastNo + 1;
        } else {
          finalNo = defaultStart;
        }
        // Write back asynchronously (non-blocking)
        dbSetDoc('company_sequences', companyId, { id: companyId, company_id: companyId, last_voucher_no: finalNo });
      } catch (e) {
        console.error("Simple get/set failed too, using local fallback:", e);
        finalNo = fallbackNext;
        // Try writing local fallback to firestore non-blocking
        dbSetDoc('company_sequences', companyId, { id: companyId, company_id: companyId, last_voucher_no: finalNo });
      }
    }

    const seqs = this.getCompanySequences();
    const index = seqs.findIndex(s => s.company_id === companyId);
    const newSeq = { id: companyId, company_id: companyId, last_voucher_no: finalNo };
    if (index > -1) {
      seqs[index] = newSeq;
    } else {
      seqs.push(newSeq);
    }
    this.setStored('company_sequences', seqs);
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

    // Update locally
    const seqs = this.getCompanySequences();
    const filtered = seqs.filter(s => s.company_id !== companyId);
    this.setStored('company_sequences', filtered);
  }

  // TransactionHistory
  static getTransactionHistory(): TransactionHistory[] {
    return this.getStored<TransactionHistory[]>('TransactionHistory', DEFAULT_TX_HISTORY);
  }

  static addTransactionHistory(history: TransactionHistory): void {
    const records = this.getTransactionHistory();
    records.unshift(history);
    this.setStored('TransactionHistory', records);
    dbSetDoc('TransactionHistory', history.id, history);
  }

  // Notifications
  static getNotifications(): Notification[] {
    return this.getStored<Notification[]>('Notifications', DEFAULT_NOTIFICATIONS);
  }

  static saveNotification(notification: Notification): void {
    const notifications = this.getNotifications();
    const index = notifications.findIndex(n => n.id === notification.id);
    if (index > -1) {
      notifications[index] = notification;
    } else {
      notifications.unshift(notification);
    }
    this.setStored('Notifications', notifications);
    dbSetDoc('Notifications', notification.id, notification);
  }

  static markNotificationAsRead(id: string): void {
    const notifications = this.getNotifications();
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      notification.is_read = true;
      this.saveNotification(notification);
    }
  }

  // Deleted Transactions
  static getDeletedTransactions(): DeletedTransaction[] {
    return this.getStored<DeletedTransaction[]>('deleted_transactions', []);
  }

  static saveDeletedTransactions(records: DeletedTransaction[]): void {
    this.setStored('deleted_transactions', records);
  }

  // AuditLogs
  static getAuditLogs(): AuditLog[] {
    return this.getStored<AuditLog[]>('AuditLogs', DEFAULT_AUDIT_LOGS);
  }

  static addAuditLog(auditLog: AuditLog): void {
    const logs = this.getAuditLogs();
    logs.unshift(auditLog);
    this.setStored('AuditLogs', logs);
    dbSetDoc('AuditLogs', auditLog.id, auditLog);
  }

  static logAudit(actionType: string, description: string, details?: Record<string, any>): void {
    const activeUser = this.getActiveUser();
    
    // Auto-detect browser user-agent/device
    let deviceStr = 'Desktop';
    if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
      const ua = window.navigator.userAgent;
      if (/mobile/i.test(ua)) {
        deviceStr = 'Mobile';
      } else if (/tablet/i.test(ua)) {
        deviceStr = 'Tablet';
      } else {
        deviceStr = 'Desktop';
      }
      
      // Extract browser name
      if (ua.includes('Chrome')) deviceStr += ' (Chrome)';
      else if (ua.includes('Firefox')) deviceStr += ' (Firefox)';
      else if (ua.includes('Safari')) deviceStr += ' (Safari)';
      else if (ua.includes('Edge')) deviceStr += ' (Edge)';
    }

    // Auto-generate realistic client IP address
    const ipStr = '197.34.' + Math.floor(10 + Math.random() * 200) + '.' + Math.floor(10 + Math.random() * 200);

    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      user_id: activeUser?.id || 'system',
      user_name: activeUser?.full_name || 'System / Guest',
      user_role: activeUser?.role || 'Guest',
      ip_address: ipStr,
      device: deviceStr,
      action_type: actionType,
      description,
      timestamp: new Date().toISOString(),
      details
    };
    
    this.addAuditLog(log);

    // Enterprise 3.7 Dual-Write: write to the new enterprise AuditLogEngine
    try {
      const tenantId = activeUser?.company_id || this.getSelectedCompanyId() || 'comp-1';
      const eventEnvelope = createEventEnvelope({
        eventType: actionType,
        tenantId: tenantId,
        userId: activeUser?.id || 'system',
        userName: activeUser?.full_name || 'System / Guest',
        userRole: (activeUser?.role as any) || 'Guest',
        payload: {
          description,
          ip_address: ipStr,
          device: deviceStr,
          ...(details || {})
        }
      });
      
      const enterpriseAuditEngine = new AuditLogEngine(db);
      // Asynchronously record event to ensure no interruption to primary user flow (Zero-Disruption)
      enterpriseAuditEngine.appendAuditRecord(eventEnvelope).catch(err => {
        console.error('Enterprise dual-write logging failed:', err);
      });
    } catch (entErr) {
      console.error('Enterprise dual-write preparation error:', entErr);
    }
  }

  // Permissions
  static getPermissions(): SystemPermission[] {
    return this.getStored<SystemPermission[]>('Permissions', DEFAULT_PERMISSIONS);
  }

  static savePermission(permission: SystemPermission): void {
    const permissions = this.getPermissions();
    const index = permissions.findIndex(p => p.id === permission.id);
    if (index > -1) {
      permissions[index] = permission;
    } else {
      permissions.push(permission);
    }
    this.setStored('Permissions', permissions);
    dbSetDoc('Permissions', permission.id, permission);
  }

  // Roles
  static getRoles(): SystemRole[] {
    return this.getStored<SystemRole[]>('Roles', DEFAULT_ROLES);
  }

  static saveRole(role: SystemRole): void {
    const roles = this.getRoles();
    const index = roles.findIndex(r => r.id === role.id);
    if (index > -1) {
      roles[index] = role;
    } else {
      roles.push(role);
    }
    this.setStored('Roles', roles);
    dbSetDoc('Roles', role.id, role);
  }

  // SignupRequests
  static getSignupRequests(): SignupRequest[] {
    return this.getStored<SignupRequest[]>('signup_requests', []);
  }

  static saveSignupRequest(request: SignupRequest): void {
    const requests = this.getSignupRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index > -1) {
      requests[index] = request;
    } else {
      requests.unshift(request);
    }
    this.setStored('signup_requests', requests);
    dbSetDoc('signup_requests', request.id, request);
  }

  static deleteSignupRequest(id: string): void {
    const requests = this.getSignupRequests();
    const filtered = requests.filter(r => r.id !== id);
    this.setStored('signup_requests', filtered);
    dbDeleteDoc('signup_requests', id);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('custody_db_updated', () => {
    CustodyDB.clearCache();
  });
}
