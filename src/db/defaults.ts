import { AppUser, ExpenseCategory, Transaction, ActivityLog, CustodyConfig, Region, Station, Company, Expense, CashVoucher, TransactionHistory, Notification, AuditLog, SystemPermission, SystemRole } from '../types';

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
export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-1', name_en: 'Office Supplies', name_ar: 'أدوات مكتبية ومستلزمات' },
  { id: 'cat-2', name_en: 'Transport & Travel', name_ar: 'انتقالات ومصاريف سفر' },
  { id: 'cat-3', name_en: 'Hospitality & Food', name_ar: 'ضيافة ومأكولات' },
  { id: 'cat-4', name_en: 'Maintenance & Repairs', name_ar: 'صيانة وإصلاحات' },
  { id: 'cat-5', name_en: 'Utilities & Internet', name_ar: 'مرافق وإنترنت' },
  { id: 'cat-6', name_en: 'Miscellaneous', name_ar: 'مصاريف نثرية أخرى' }
];

// Pre-configured Users
export const DEFAULT_USERS: AppUser[] = [
  {
    id: 'user-sysadmin',
    email: 'admin@kemit-erp.com',
    full_name: 'Alaa Abu Salah (علاء أبو صلاح)',
    role: 'SystemAdmin',
    is_active: true,
    is_platform_owner: true,
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
      manage_companies: true,
      manage_regions: true,
      manage_stations: true,
      manage_roles: true,
      manage_settings: true,
      settle_voucher: true
    }
  },
  {
    id: 'user-sysadmin-gmail',
    email: 'alaaabusalah96@gmail.com',
    full_name: 'Alaa Abu Salah (علاء أبو صلاح)',
    role: 'SystemAdmin',
    is_active: true,
    is_platform_owner: true,
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
      manage_companies: true,
      manage_regions: true,
      manage_stations: true,
      manage_roles: true,
      manage_settings: true,
      settle_voucher: true
    }
  },
  {
    id: 'user-sysadmin-cbc',
    email: 'alaa@cbc.com',
    full_name: 'Alaa Abu Salah (علاء أبو صلاح)',
    role: 'SystemAdmin',
    is_active: true,
    is_platform_owner: true,
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
export const generateDefaultTransactions = (): Transaction[] => {
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

export const DEFAULT_TRANSACTIONS = generateDefaultTransactions();

export const DEFAULT_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    user_id: 'system',
    user_name: 'System Initializer',
    action: 'Database Initialized',
    details: 'Pre-seeded custody categories, regions, stations, users, and baseline transactions for Cairo Poultry.',
    timestamp: '2026-07-01T08:00:00Z'
  }
];

export const DEFAULT_CONFIG: CustodyConfig = {
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
