export type UserRole = 'SystemAdmin' | 'Admin' | 'RegionalManager' | 'StationAdmin';

export interface Company {
  id: string;
  name: string;
  custody_value: number;
}

export interface UserPermissions {
  manage_settings: boolean;
  create_expense: boolean;
  settle_voucher: boolean;
  delete_expense: boolean;
  view_reports: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  permissions: UserPermissions;
  station_id?: string;
  region_id?: string;
  company_id?: string;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  company_id?: string;
}

export interface Station {
  id: string;
  region_id?: string;
  station_name: string;
  station_code: string;
  custody_amount: number;
  is_active: boolean;
  company_id?: string;
}

export interface ExpenseCategory {
  id: string;
  name_en: string;
  name_ar: string;
}

export type TransactionStatus = 'Pending' | 'Under Settlement' | 'Settled' | 'Rejected';

export interface TransactionItem {
  description: string;
  amount: number;
}

export interface Transaction {
  id: string;
  transaction_no: string;
  date: string;
  description: string;
  category_id?: string;
  amount: number;
  items?: TransactionItem[];
  amount_in_words?: {
    ar: string;
    en: string;
  };
  notes?: string;
  status: TransactionStatus;
  voucher_no?: string;
  voucher_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  station_id?: string; // Every transaction belongs to ONE station
  company_id?: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface CustodyConfig {
  company_name: string;
  custody_value: number;
}

export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';

// Translation dictionaries
export const translations = {
  en: {
    title: 'Cash Custody Management',
    dashboard: 'Dashboard',
    newExpense: 'New Expense',
    pendingTransactions: 'Pending Transactions',
    cashPaymentVoucher: 'Cash Payment Voucher',
    underSettlement: 'Under Settlement',
    cashReconciliation: 'Cash Reconciliation',
    reports: 'Reports',
    search: 'Advanced Search',
    settings: 'Settings',
    logout: 'Logout',
    
    // Dashboard metric cards
    custodyValue: 'Custody Value',
    cashAvailable: 'Cash Available',
    pendingTotal: 'Pending Total',
    underSettlementTotal: 'Under Settlement Total',
    pendingCount: 'Pending Count',
    underSettlementCount: 'Settled Count',
    latestTransactions: 'Latest Activity',
    recentLogs: 'Recent Audit Logs',
    
    // Status
    statusPending: 'Pending',
    statusSettled: 'Under Settlement',
    statusFullySettled: 'Fully Settled (Approved)',
    status: 'Status',
    
    // Form fields
    date: 'Date',
    description: 'Description',
    amount: 'Amount (EGP)',
    category: 'Category',
    notes: 'Notes',
    voucherNo: 'Voucher Number',
    voucherDate: 'Voucher Date',
    transactionNo: 'Transaction No',
    actions: 'Actions',
    
    // Validation
    required: 'This field is required',
    positiveNumber: 'Amount must be a positive number',
    successCreated: 'Expense created successfully!',
    successSettled: 'Voucher registered. Transaction is now Under Settlement.',
    successDeleted: 'Transaction deleted successfully.',
    successUpdated: 'Transaction updated successfully.',
    successSettings: 'Settings updated successfully.',
    confirmDelete: 'Are you sure you want to delete this transaction?',
    confirmSettle: 'Are you sure you want to settle this transaction?',
    
    // Reports
    generateReport: 'Generate Report',
    reportType: 'Report Type',
    pendingReport: 'Pending Report',
    settledReport: 'Under Settlement Report',
    dailyReport: 'Daily Report',
    monthlyReport: 'Monthly Report',
    cashMovementReport: 'Cash Movement Report',
    exportExcel: 'Export Excel',
    exportPDF: 'Export PDF',
    print: 'Print',
    noData: 'No transactions found for this query',
    
    // Search
    searchPlaceholder: 'Search description, voucher #, transaction #, category...',
    instantSearch: 'Instant Search',
    filters: 'Filters',
    clearFilters: 'Clear Filters',
    
    // Settings
    companySettings: 'Company Settings',
    companyName: 'Company Name',
    custodyAmount: 'Custody Amount (EGP)',
    categoriesList: 'Expense Categories',
    addCategory: 'Add Category',
    catNameEn: 'Category Name (EN)',
    catNameAr: 'Category Name (AR)',
    userManagement: 'User Management',
    role: 'Role',
    permissions: 'Permissions',
    saveChanges: 'Save Changes',
    
    // Language & styling
    langSwitch: 'العربية',
    rtl: 'LTR',
    login: 'Login',
    email: 'Email',
    password: 'Password',
    loginTitle: 'Secure Portal Login',
    loginSubtitle: 'Cash Custody ERP Module',
    adminLabel: 'Admin Account',
    regularLabel: 'Regular User Account',
    mockAuthTip: 'Select a pre-configured account below to log in immediately:',
    accessDenied: 'Access Denied: You do not have permissions to view this screen.',
    allRightsReserved: 'All rights reserved.',
    regionalDashboard: 'Regional Dashboard',
    stations: 'Stations',
    totalStations: 'Total Stations',
    totalCustody: 'Total Custody',
    totalPending: 'Total Pending',
    totalUnderSettlement: 'Total Under Settlement',
    totalCashAvailable: 'Total Cash Available',
    numPendingTransactions: 'Pending Transactions Count',
    numSettledTransactions: 'Settled Transactions Count',
    latestTransactionsRegion: 'Latest Transactions Across Region',
    stationName: 'Station Name',
    stationCode: 'Station Code',
    is_active: 'Status',
    lastActivity: 'Last Activity',
    viewDashboard: 'View Dashboard',
    regionalReports: 'Regional Reports',
    regionalSearch: 'Regional Search',
    station: 'Station',
    allStations: 'All Stations',
    region: 'Region',
    dateRange: 'Date Range',
    minAmount: 'Min Amount',
    maxAmount: 'Max Amount',
    roleSystemAdmin: 'Platform Admin',
    roleAdmin: 'Company Admin',
    roleRegionalManager: 'Regional Manager',
    roleStationAdmin: 'Station Manager',
    stationDetails: 'Station Details',
    timelineOfActivities: 'Timeline of Activities',
    singleStation: 'Single Station',
    multipleStations: 'Multiple Stations',
    entireRegion: 'Entire Region',
    generateRegionalReport: 'Generate Regional Report',
    stationsList: 'Stations List',
    active: 'Active',
    inactive: 'Inactive'
  },
  ar: {
    title: 'نظام إدارة عهدة النقدية',
    dashboard: 'لوحة التحكم',
    newExpense: 'تسجيل مصروف جديد',
    pendingTransactions: 'المعاملات المعلقة',
    cashPaymentVoucher: 'سند صرف نقدية',
    underSettlement: 'تحت التسوية',
    cashReconciliation: 'مطابقة العهدة',
    reports: 'التقارير المالية',
    search: 'البحث المتقدم',
    settings: 'الإعدادات العامة',
    logout: 'تسجيل الخروج',
    
    // Dashboard metric cards
    custodyValue: 'قيمة العهدة',
    cashAvailable: 'النقدية المتاحة',
    pendingTotal: 'إجمالي المعلق',
    underSettlementTotal: 'إجمالي تحت التسوية',
    pendingCount: 'عدد المعلق',
    underSettlementCount: 'عدد تحت التسوية',
    latestTransactions: 'آخر العمليات',
    recentLogs: 'سجل التدقيق والمراجعة',
    
    // Status
    statusPending: 'معلقة',
    statusSettled: 'تحت التسوية',
    statusFullySettled: 'معتمدة ومسواة نهائياً',
    status: 'الحالة',
    
    // Form fields
    date: 'التاريخ',
    description: 'البيان / الوصف',
    amount: 'المبلغ (جنيه)',
    category: 'التصنيف',
    notes: 'ملاحظات',
    voucherNo: 'رقم مستند الصرف',
    voucherDate: 'تاريخ مستند الصرف',
    transactionNo: 'رقم الحركة',
    actions: 'الإجراءات',
    
    // Validation
    required: 'هذا الحقل مطلوب',
    positiveNumber: 'يجب أن يكون المبلغ رقماً موجباً',
    successCreated: 'تم تسجيل المصروف المعلق بنجاح!',
    successSettled: 'تم تسجيل السند بنجاح وتحويل الحركة إلى تحت التسوية.',
    successDeleted: 'تم حذف الحركة بنجاح.',
    successUpdated: 'تم تعديل الحركة بنجاح.',
    successSettings: 'تم حفظ الإعدادات بنجاح.',
    confirmDelete: 'هل أنت متأكد من رغبتك في حذف هذه الحركة؟',
    confirmSettle: 'هل أنت متأكد من رغبتك في تسوية هذه الحركة؟',
    
    // Reports
    generateReport: 'عرض التقرير',
    reportType: 'نوع التقرير',
    pendingReport: 'تقرير المصاريف المعلقة',
    settledReport: 'تقرير المصاريف تحت التسوية',
    dailyReport: 'التقرير اليومي',
    monthlyReport: 'التقرير الشهري',
    cashMovementReport: 'تقرير حركة النقدية التفصيلي',
    exportExcel: 'تصدير إكسل',
    exportPDF: 'تصدير PDF',
    print: 'طباعة التقرير',
    noData: 'لا توجد حركات مطابقة لهذا التصفية',
    
    // Search
    searchPlaceholder: 'ابحث بالبيان، رقم السند، رقم الحركة، التصنيف...',
    instantSearch: 'بحث فوري',
    filters: 'مرشحات إضافية',
    clearFilters: 'إعادة تعيين الفلاتر',
    
    // Settings
    companySettings: 'إعدادات الشركة والعهدة',
    companyName: 'اسم الشركة',
    custodyAmount: 'قيمة عهدة النقدية (جنيه)',
    categoriesList: 'تصنيفات المصروفات المعتمدة',
    addCategory: 'إضافة تصنيف جديد',
    catNameEn: 'اسم التصنيف (إنجليزي)',
    catNameAr: 'اسم التصنيف (عربي)',
    userManagement: 'إدارة المستخدمين والصلاحيات',
    role: 'الدور / الصلاحية',
    permissions: 'الصلاحيات الممنوحة',
    saveChanges: 'حفظ التعديلات',
    
    // Language & styling
    langSwitch: 'English',
    rtl: 'RTL',
    login: 'تسجيل الدخول',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    loginTitle: 'بوابة تسجيل الدخول الآمن',
    loginSubtitle: 'وحدة نظام إدارة عهدة النقدية ERP',
    adminLabel: 'حساب مدير النظام (كامل الصلاحيات)',
    regularLabel: 'حساب مستخدم عادي (محدود)',
    mockAuthTip: 'اختر أحد الحسابات المهيأة مسبقاً للولوج فوراً إلى النظام:',
    accessDenied: 'عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الشاشة.',
    allRightsReserved: 'جميع الحقوق محفوظة.',
    regionalDashboard: 'لوحة التحكم الإقليمية',
    stations: 'المحطات',
    totalStations: 'إجمالي المحطات',
    totalCustody: 'إجمالي قيمة العهد',
    totalPending: 'إجمالي المصاريف المعلقة',
    totalUnderSettlement: 'إجمالي تحت التسوية الإقليمي',
    totalCashAvailable: 'إجمالي النقدية المتاحة إقليمياً',
    numPendingTransactions: 'عدد المعلق للإقليم',
    numSettledTransactions: 'عدد تحت التسوية للإقليم',
    latestTransactionsRegion: 'آخر العمليات عبر المحطات والإقليم',
    stationName: 'اسم المحطة',
    stationCode: 'كود المحطة',
    is_active: 'الحالة',
    lastActivity: 'آخر حركة نشطة',
    viewDashboard: 'عرض لوحة التحكم',
    regionalReports: 'التقارير الإقليمية الشاملة',
    regionalSearch: 'البحث الإقليمي الشامل',
    station: 'المحطة',
    allStations: 'جميع المحطات',
    region: 'الإقليم',
    dateRange: 'النطاق الزمني',
    minAmount: 'الحد الأدنى للمبلغ',
    maxAmount: 'الحد الأقصى للمبلغ',
    roleSystemAdmin: 'أدمن منصة',
    roleAdmin: 'ادمن الشركة',
    roleRegionalManager: 'مدير منطقة',
    roleStationAdmin: 'مدير محطة (أمين عهدة)',
    stationDetails: 'تفاصيل المحطة وعرض المستندات',
    timelineOfActivities: 'سجل الأنشطة والتدقيق الزمني',
    singleStation: 'محطة فردية',
    multipleStations: 'محطات متعددة',
    entireRegion: 'الإقليم بالكامل',
    generateRegionalReport: 'توليد التقرير الإقليمي المدمج',
    stationsList: 'قائمة المحطات النشطة',
    active: 'نشط',
    inactive: 'غير نشط'
  }
};
