import React, { useState, useEffect } from 'react';
import { CustodyDB, ModulesModule } from '../db';
import PermissionMatrix from '../components/PermissionMatrix';
import { translations, Language, Theme, AppUser, UserRole, Region, Station, UserPermissions } from '../types';
import { 
  Settings as SettingsIcon, 
  Building, 
  Coins, 
  Users2, 
  ShieldCheck, 
  Lock, 
  PlusCircle, 
  Check, 
  Trash2, 
  UserPlus,
  Download,
  Upload,
  Edit2,
  MapPin,
  Globe,
  RefreshCw,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Inbox
} from 'lucide-react';

interface SettingsProps {
  language: Language;
  theme: Theme;
}

interface RoleDefinition {
  id: UserRole;
  labelEn: string;
  labelAr: string;
  colorClass: string;
  bgClass: string;
  systemAdminOnly?: boolean;
}

const SYSTEM_ROLES: RoleDefinition[] = [
  {
    id: 'SystemAdmin',
    labelEn: 'Platform Admin',
    labelAr: 'أدمن منصة (Platform Admin)',
    colorClass: 'text-indigo-600 font-bold dark:text-indigo-400',
    bgClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10',
    systemAdminOnly: true
  },
  {
    id: 'Admin',
    labelEn: 'Company Admin',
    labelAr: 'ادمن الشركة (Company Admin)',
    colorClass: 'text-rose-500 font-bold dark:text-rose-400',
    bgClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/10'
  },
  {
    id: 'RegionalManager',
    labelEn: 'Regional Manager',
    labelAr: 'مدير منطقة (Regional Manager)',
    colorClass: 'text-sky-600 font-semibold dark:text-sky-400',
    bgClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/10'
  },
  {
    id: 'StationAdmin',
    labelEn: 'Station Manager',
    labelAr: 'مدير محطة / أمين عهدة',
    colorClass: 'text-emerald-600 font-semibold dark:text-emerald-400',
    bgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
  }
];

const PERMISSIONS_LIST = [
  { key: 'create_expense', ar: 'إضافة وتسجيل المصروفات', en: 'Create & record expenses' },
  { key: 'delete_expense', ar: 'حذف المصروفات المسجلة', en: 'Delete recorded expenses' },
  { key: 'settle_voucher', ar: 'تسوية وإقفال المطالبات', en: 'Settle & close vouchers' },
  { key: 'replace_custody', ar: 'طلب استعاضة العهدة النقدية', en: 'Request replenishment' },
  { key: 'view_reports', ar: 'عرض وتصدير التقارير المالية', en: 'View financial reports' },
  { key: 'manage_settings', ar: 'إدارة الإعدادات والنسخ', en: 'Manage settings & backups' },
] as const;

export default function Settings({ language, theme }: SettingsProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const currentUser = CustodyDB.getActiveUser();

  // Tab State
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'matrix'>('general');

  // General Settings State
  const [companyName, setCompanyName] = useState(() => CustodyDB.getConfig().company_name);
  const [custodyValue, setCustodyValue] = useState(() => String(CustodyDB.getConfig().custody_value));
  const [useCustomTemplate, setUseCustomTemplate] = useState(() => CustodyDB.getConfig().use_custom_template || false);
  const [customTemplateImage, setCustomTemplateImage] = useState(() => CustodyDB.getConfig().custom_template_image || '');

  // Infrastructure Lists
  const [regions, setRegions] = useState<Region[]>(() => CustodyDB.getScopedRegions());
  const [stations, setStations] = useState<Station[]>(() => CustodyDB.getScopedStations());

  // Regions Form & Edit State
  const [newRegName, setNewRegName] = useState('');
  const [newRegCode, setNewRegCode] = useState('');
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editRegName, setEditRegName] = useState('');
  const [editRegCode, setEditRegCode] = useState('');

  // Stations Form & Edit State
  const [newStnName, setNewStnName] = useState('');
  const [newStnCode, setNewStnCode] = useState('');
  const [newStnCustody, setNewStnCustody] = useState('');
  const [newStnRegionId, setNewStnRegionId] = useState('');
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editStnName, setEditStnName] = useState('');
  const [editStnCode, setEditStnCode] = useState('');
  const [editStnCustody, setEditStnCustody] = useState('');
  const [editStnRegionId, setEditStnRegionId] = useState('');

  // Users Lists & Edit State
  const [users, setUsers] = useState<AppUser[]>(() => CustodyDB.getScopedUsers());
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('StationAdmin');
  const [newUserStationId, setNewUserStationId] = useState('');
  const [newUserRegionId, setNewUserRegionId] = useState('');

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('StationAdmin');
  const [editUserStationId, setEditUserStationId] = useState('');
  const [editUserRegionId, setEditUserRegionId] = useState('');
  const [editUserPermissions, setEditUserPermissions] = useState<UserPermissions>({
    manage_settings: false,
    create_expense: false,
    settle_voucher: false,
    delete_expense: false,
    view_reports: false
  });
  const [editUserIsDefaultMode, setEditUserIsDefaultMode] = useState<boolean>(true);

  const [pendingMappings, setPendingMappings] = useState<Record<string, { stationId?: string; regionId?: string }>>({});

  const [toastMessage, setToastMessage] = useState('');

  // Platform Admin Security Settings State
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [adminSecurityError, setAdminSecurityError] = useState('');
  const [adminSecuritySuccess, setAdminSecuritySuccess] = useState('');
  const [adminEmailResetStep, setAdminEmailResetStep] = useState(0); // 0: Idle, 1: Sending, 2: Code Sent, 3: Success
  const [adminGeneratedCode, setAdminGeneratedCode] = useState('');
  const [adminResetCodeInput, setAdminResetCodeInput] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleUpdateAdminPasswordDirectly = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSecurityError('');
    setAdminSecuritySuccess('');

    if (newAdminPassword.length < 4) {
      setAdminSecurityError(isRtl ? '❌ يجب ألا تقل كلمة المرور الجديدة عن 4 أحرف.' : '❌ Password must be at least 4 characters long.');
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setAdminSecurityError(isRtl ? '❌ كلمات المرور الجديدة غير متطابقة.' : '❌ Passwords do not match.');
      return;
    }

    const usersList = CustodyDB.getUsers();
    const adminUser = usersList.find(u => u.role === 'SystemAdmin' && (
      u.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' ||
      u.email.toLowerCase().trim() === 'alaabusalah96@gmail.com'
    ));

    if (!adminUser) {
      setAdminSecurityError(isRtl ? '❌ لم يتم العثور على حساب أدمن المنصة في قاعدة البيانات!' : '❌ Platform Admin account not found.');
      return;
    }

    if (adminUser.password && adminUser.password !== currentAdminPassword) {
      setAdminSecurityError(isRtl ? '❌ كلمة المرور الحالية غير صحيحة.' : '❌ Current password is incorrect.');
      return;
    }

    const updated = usersList.map(u => {
      if (u.id === adminUser.id) {
        return { ...u, password: newAdminPassword };
      }
      return u;
    });

    CustodyDB.saveUsers(updated);
    setAdminSecuritySuccess(isRtl ? '✅ تم تحديث كلمة مرور أدمن المنصة وحفظها بنجاح!' : '✅ Platform Admin password updated successfully.');
    setCurrentAdminPassword('');
    setNewAdminPassword('');
    setConfirmAdminPassword('');
  };

  const handleTriggerAdminEmailReset = () => {
    setAdminSecurityError('');
    setAdminSecuritySuccess('');
    setAdminEmailResetStep(1);

    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setAdminGeneratedCode(code);
      setAdminEmailResetStep(2);
      setAdminSecuritySuccess(isRtl 
        ? '📩 تم إرسال كود التحقق الأمني السري إلى بريدك بنجاح! راجع محاكي علبة الوارد بالأسفل.' 
        : '📩 Security verification code sent to your email! Please check the simulator card below.'
      );
    }, 1200);
  };

  const handleVerifyAdminEmailCode = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSecurityError('');
    setAdminSecuritySuccess('');

    if (adminResetCodeInput.trim() !== adminGeneratedCode) {
      setAdminSecurityError(isRtl ? '❌ كود التحقق المدخل غير صحيح.' : '❌ Invalid verification code.');
      return;
    }

    if (newAdminPassword.length < 4) {
      setAdminSecurityError(isRtl ? '❌ يجب ألا تقل كلمة المرور الجديدة عن 4 أحرف.' : '❌ New password must be at least 4 characters.');
      return;
    }

    const usersList = CustodyDB.getUsers();
    const updated = usersList.map(u => {
      const isPlatformAdmin = u.email && (
        u.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' ||
        u.email.toLowerCase().trim() === 'alaabusalah96@gmail.com'
      );
      if (isPlatformAdmin) {
        return { ...u, password: newAdminPassword };
      }
      return u;
    });

    CustodyDB.saveUsers(updated);
    setAdminEmailResetStep(3);
    setAdminSecuritySuccess(isRtl ? '🎉 تم تحديث كلمة مرور أدمن المنصة بنجاح عبر البريد الإلكتروني!' : '🎉 Password successfully updated via email code!');
    setNewAdminPassword('');
    setConfirmAdminPassword('');
    setAdminResetCodeInput('');
  };

  useEffect(() => {
    const handleUpdate = () => {
      setCompanyName(CustodyDB.getConfig().company_name);
      setCustodyValue(String(CustodyDB.getConfig().custody_value));
      setRegions(CustodyDB.getScopedRegions());
      setStations(CustodyDB.getScopedStations());
      setUsers(CustodyDB.getScopedUsers());
    };
    window.addEventListener('custody_db_updated', handleUpdate);
    return () => {
      window.removeEventListener('custody_db_updated', handleUpdate);
    };
  }, []);

  // 1. Access Security Check: Only Admin and SystemAdmin roles can enter Settings
  if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'SystemAdmin')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <Lock size={32} />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
          {t.accessDenied}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mt-2">
          {isRtl 
            ? 'تتطلب هذه الصفحة صلاحيات مدير النظام (Admin). يرجى التبديل لحساب "أحمد السيد" لتجربة الإعدادات.' 
            : 'Access is restricted to Admin role credentials. Please switch your profile session to modify configuration.'
          }
        </p>
      </div>
    );
  }

  // --- GENERAL SETTINGS ACTIONS ---
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();

    CustodyDB.saveConfig({
      company_name: companyName.trim(),
      custody_value: 0,
      use_custom_template: useCustomTemplate,
      custom_template_image: customTemplateImage
    });

    triggerToast(isRtl ? 'تم حفظ التعديلات العامة وتعميمها بنجاح' : 'General parameters saved and synchronized.');
  };

  // Backup Data to JSON
  const handleBackupData = () => {
    try {
      const backupObj = {
        companies: CustodyDB.getCompanies(),
        regions: CustodyDB.getRegions(),
        stations: CustodyDB.getStations(),
        categories: CustodyDB.getCategories(),
        users: CustodyDB.getUsers(),
        transactions: CustodyDB.getTransactions(),
        logs: CustodyDB.getLogs()
      };

      const dataStr = JSON.stringify(backupObj, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

      const exportFileDefaultName = `kemiterp-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      CustodyDB.addLog(
        currentUser.id,
        currentUser.full_name,
        'Export Backup',
        'Successfully downloaded complete platform database snapshot.'
      );
      triggerToast(isRtl ? 'تم تصدير نسخة احتياطية كاملة بنجاح.' : 'JSON Database snapshot exported successfully.');
    } catch (e) {
      alert(isRtl ? 'فشل تصدير البيانات.' : 'Backup failed.');
    }
  };

  // Restore Data from JSON
  const handleRestoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Validation checks
        if (!parsed.companies || !parsed.users || !parsed.transactions) {
          alert(isRtl ? 'ملف النسخة الاحتياطية غير صالح أو ناقص البنية!' : 'Invalid backup file schema!');
          return;
        }

        // Write directly to local DB
        if (parsed.companies) CustodyDB.saveCompanies(parsed.companies);
        if (parsed.regions) CustodyDB.saveRegions(parsed.regions);
        if (parsed.stations) CustodyDB.saveStations(parsed.stations);
        if (parsed.categories) CustodyDB.saveCategories(parsed.categories);
        if (parsed.users) CustodyDB.saveUsers(parsed.users);
        if (parsed.transactions) CustodyDB.saveTransactions(parsed.transactions);

        // Reload page states
        setCompanyName(CustodyDB.getConfig().company_name);
        setCustodyValue(String(CustodyDB.getConfig().custody_value));
        setRegions(CustodyDB.getScopedRegions());
        setStations(CustodyDB.getScopedStations());
        setUsers(CustodyDB.getScopedUsers());

        CustodyDB.addLog(
          currentUser.id,
          currentUser.full_name,
          'Restore Backup',
          `Restored platform snapshot containing ${parsed.transactions.length} records and ${parsed.users.length} user profiles.`
        );

        triggerToast(isRtl ? 'تم استعادة قاعدة البيانات وتحديث النظام بالكامل بنجاح!' : 'Database successfully restored and synchronized.');
      } catch (err) {
        alert(isRtl ? 'فشل قراءة الملف كبنية JSON صالحة.' : 'Failed to parse JSON backup file.');
      }
    };
    fileReader.readAsText(file);
  };

  // --- REGIONS ACTIONS ---
  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegName.trim()) return;

    CustodyDB.addRegion(newRegName.trim(), '');
    setRegions(CustodyDB.getScopedRegions());
    setNewRegName('');
    setNewRegCode('');
    triggerToast(isRtl ? 'تم إنشاء المنطقة الجغرافية الجديدة بنجاح.' : 'Geographical region added.');
  };

  const handleStartEditRegion = (reg: Region) => {
    setEditingRegionId(reg.id);
    setEditRegName(reg.name);
    setEditRegCode('');
  };

  const handleSaveEditRegion = (id: string) => {
    if (!editRegName.trim()) return;
    CustodyDB.updateRegion(id, {
      name: editRegName.trim(),
      code: ''
    });
    setRegions(CustodyDB.getScopedRegions());
    setEditingRegionId(null);
    triggerToast(isRtl ? 'تم تحديث بيانات المنطقة.' : 'Geographical region updated.');
  };

  const handleDeleteRegion = (id: string) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من حذف هذه المنطقة؟ سيتم فصل فروعها التابعة.' : 'Delete this region? This will detach its stations.')) return;
    CustodyDB.deleteRegion(id);
    setRegions(CustodyDB.getScopedRegions());
    triggerToast(isRtl ? 'تم حذف المنطقة بنجاح.' : 'Region deleted.');
  };

  // --- STATIONS ACTIONS ---
  const handleAddStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStnName.trim() || !newStnCode.trim() || !newStnCustody.trim()) return;

    const amount = parseFloat(newStnCustody);
    if (isNaN(amount) || amount < 0) return;

    CustodyDB.addStation(
      newStnName.trim(),
      newStnCode.trim().toUpperCase(),
      amount,
      newStnRegionId || undefined
    );
    setStations(CustodyDB.getScopedStations());
    setNewStnName('');
    setNewStnCode('');
    setNewStnCustody('');
    triggerToast(isRtl ? 'تم إنشاء فرع/محطة الصرف والصندوق التابع بنجاح.' : 'Station added.');
  };

  const handleStartEditStation = (stn: Station) => {
    setEditingStationId(stn.id);
    setEditStnName(stn.station_name);
    setEditStnCode(stn.station_code);
    setEditStnCustody(String(stn.custody_amount));
    setEditStnRegionId(stn.region_id || '');
  };

  const handleSaveEditStation = (id: string) => {
    const amount = parseFloat(editStnCustody);
    if (!editStnName.trim() || !editStnCode.trim() || isNaN(amount)) return;

    CustodyDB.updateStation(id, {
      station_name: editStnName.trim(),
      station_code: editStnCode.trim().toUpperCase(),
      custody_amount: amount,
      region_id: editStnRegionId || undefined
    });
    setStations(CustodyDB.getScopedStations());
    setEditingStationId(null);
    triggerToast(isRtl ? 'تم حفظ تعديلات المحطة.' : 'Station updated.');
  };

  const handleDeleteStation = (id: string) => {
    if (!confirm(isRtl ? 'هل تريد حذف هذه المحطة؟' : 'Are you sure you want to delete this station?')) return;
    CustodyDB.deleteStation(id);
    setStations(CustodyDB.getScopedStations());
    triggerToast(isRtl ? 'تم حذف المحطة.' : 'Station deleted.');
  };

  // --- USERS ACTIONS ---
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'SystemAdmin') {
      alert(isRtl ? '⚠️ هذه الصلاحية حصرية لأدمن المنصة فقط!' : '⚠️ This privilege is exclusive to Platform Admins.');
      return;
    }
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    const isUserAdmin = newUserRole === 'Admin' || newUserRole === 'SystemAdmin';
    const isRegional = newUserRole === 'RegionalManager';
    const isStationAdmin = newUserRole === 'StationAdmin';

    const permissions = {
      manage_settings: isUserAdmin,
      create_expense: isUserAdmin || isStationAdmin,
      settle_voucher: isUserAdmin || isStationAdmin,
      delete_expense: isUserAdmin,
      view_reports: true
    };

    const companyId = CustodyDB.getSelectedCompanyId();

    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      email: newUserEmail.trim(),
      full_name: newUserName.trim(),
      role: newUserRole,
      permissions,
      company_id: companyId,
      is_active: true,
      password: '123456',
      ...(isStationAdmin && newUserStationId ? { station_id: newUserStationId } : {}),
      ...(isRegional && newUserRegionId ? { region_id: newUserRegionId } : {})
    };

    const allUsers = CustodyDB.getUsers();
    CustodyDB.saveUsers([...allUsers, newUser]);
    setUsers(CustodyDB.getScopedUsers());

    setNewUserName('');
    setNewUserEmail('');
    triggerToast(isRtl ? 'تم إضافة الملف المالي للمستخدم بنجاح.' : 'New user created successfully.');
  };

  const handleStartEditUser = (u: AppUser) => {
    setEditingUserId(u.id);
    setEditUserFullName(u.full_name);
    setEditUserRole(u.role);
    setEditUserStationId(u.station_id || '');
    setEditUserRegionId(u.region_id || '');
    setEditUserPermissions({ ...u.permissions });

    // Check if permissions match default permissions for this role
    const defaults = CustodyDB.enrichUserPermissions(u.role);
    const keysToCheck = ['create_expense', 'delete_expense', 'settle_voucher', 'replace_custody', 'view_reports', 'manage_settings'];
    const isMatching = keysToCheck.every(k => !!u.permissions[k as keyof UserPermissions] === !!defaults[k as keyof UserPermissions]);
    setEditUserIsDefaultMode(isMatching);
  };

  const handleEditUserRoleChange = (role: UserRole) => {
    setEditUserRole(role);
    if (editUserIsDefaultMode) {
      setEditUserPermissions(CustodyDB.enrichUserPermissions(role));
    }
  };

  const handleEditUserToggleMode = (useDefault: boolean) => {
    setEditUserIsDefaultMode(useDefault);
    if (useDefault) {
      setEditUserPermissions(CustodyDB.enrichUserPermissions(editUserRole));
    }
  };

  const handleSaveEditUser = (id: string) => {
    if (currentUser.role !== 'SystemAdmin') {
      alert(isRtl ? '⚠️ هذه الصلاحية حصرية لأدمن المنصة فقط!' : '⚠️ This privilege is exclusive to Platform Admins.');
      return;
    }
    if (!editUserFullName.trim()) return;

    const allUsers = CustodyDB.getUsers();
    const updatedUsers = allUsers.map(u => {
      if (u.id === id) {
        return {
          ...u,
          full_name: editUserFullName.trim(),
          role: editUserRole,
          permissions: editUserPermissions,
          station_id: editUserRole === 'StationAdmin' ? editUserStationId || undefined : undefined,
          region_id: editUserRole === 'RegionalManager' ? editUserRegionId || undefined : undefined
        };
      }
      return u;
    });

    CustodyDB.saveUsers(updatedUsers);
    setUsers(CustodyDB.getScopedUsers());
    setEditingUserId(null);
    triggerToast(isRtl ? 'تم تحديث أدوار وصلاحيات الموظف بنجاح.' : 'User permissions successfully updated.');
  };

  const handleDeleteUser = (id: string) => {
    if (currentUser.role !== 'SystemAdmin') {
      alert(isRtl ? '⚠️ هذه الصلاحية حصرية لأدمن المنصة فقط!' : '⚠️ This privilege is exclusive to Platform Admins.');
      return;
    }
    if (id === currentUser.id) {
      alert(isRtl ? 'لا يمكن حذف حسابك النشط!' : 'You cannot delete your active session profile!');
      return;
    }
    if (!confirm(isRtl ? 'حذف حساب هذا الموظف وسحب الصلاحيات؟' : 'Permanently remove this user?')) return;

    const allUsers = CustodyDB.getUsers().filter(u => u.id !== id);
    CustodyDB.saveUsers(allUsers);
    setUsers(CustodyDB.getScopedUsers());
    triggerToast(isRtl ? 'تم حذف حساب الموظف.' : 'User deleted.');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <SettingsIcon className="text-emerald-500" />
            <span>{t.settings}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl 
              ? 'إدارة محددات الصناديق، صلاحيات الموظفين، الفروع الجغرافية، والنسخ الاحتياطي لقاعدة البيانات.' 
              : 'Configure general system parameters, corporate cash base, geographical stations, and database backups.'
            }
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-400'
          }`}
        >
          {isRtl ? '⚙️ الإعدادات العامة' : '⚙️ General Settings'}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-400'
          }`}
        >
          {isRtl ? '👥 الموظفون والحسابات' : '👥 Users & Accounts'}
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-400'
          }`}
        >
          {isRtl ? '🛡️ مصفوفة الصلاحيات (Matrix)' : '🛡️ Permission Matrix'}
        </button>
      </div>

      {/* Success Toast Banner */}
      {toastMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --- TAB 1: GENERAL & BACKUP --- */}
      {activeTab === 'general' && (
        <div className="grid gap-6 md:grid-cols-2 animate-fade-in">
          {/* Card 1: General configuration */}
          <div className={`p-5 rounded-2xl border ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2 mb-4 border-b pb-2.5 border-slate-100 dark:border-slate-800">
              <Building size={16} className="text-emerald-500" />
              <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.companySettings}
              </h3>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.companyName} *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Custom Print Template Upload */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                  {isRtl ? 'إعدادات قوالب الطباعة والهوية' : 'Print Layout & Branding Templates'}
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCustomTemplate"
                    checked={useCustomTemplate}
                    onChange={(e) => setUseCustomTemplate(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="useCustomTemplate" className="text-slate-600 dark:text-slate-400 font-medium">
                    {isRtl ? 'استخدام قالب تصميم خاص بالشركة (خلفية مخصصة)' : 'Use custom company backdrop template'}
                  </label>
                </div>

                {useCustomTemplate && (
                  <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-slate-500 font-semibold mb-1">
                      {isRtl ? 'تحميل نموذج التصميم (PDF أو صورة عالية الجودة)' : 'Upload backdrop template (PDF or High-quality image)'}
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCustomTemplateImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-600 hover:file:bg-emerald-500/20"
                    />
                    {customTemplateImage && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] text-slate-400 block">
                          {isRtl ? '✓ تم تحميل الملف ومعالجته تلقائياً' : '✓ Template uploaded and processed successfully'}
                        </span>
                        <div className="h-16 w-24 border rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                          <img src={customTemplateImage} alt="Template Preview" className="h-full object-contain" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomTemplateImage('')}
                          className="text-[10px] text-rose-500 hover:underline"
                        >
                          {isRtl ? 'حذف القالب' : 'Remove template'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-all text-xs animate-pulse"
              >
                {t.saveChanges}
              </button>
            </form>
          </div>

          {/* Card 2: JSON Backup & Data Restore */}
          <div className={`p-5 rounded-2xl border ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2 mb-4 border-b pb-2.5 border-slate-100 dark:border-slate-800">
              <RefreshCw size={16} className="text-indigo-500" />
              <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isRtl ? 'النسخ الاحتياطي واستعادة البيانات المرفقة' : 'Data Backup & Restore Panel'}
              </h3>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <p>
                {isRtl 
                  ? 'يمكنك تصدير قاعدة البيانات بالكامل بما يشمل المحطات، الصلاحيات، الفواتير، والمسجل التاريخي، في ملف مشفر واحد لحماية بياناتك من الفقدان.' 
                  : 'You can export all configurations, transaction histories, audit journals, and employee metadata locally as an offline JSON snapshot.'}
              </p>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-[11px] flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  {isRtl 
                    ? 'تحذير: استعادة ملف احتياطي قديم سيقوم بدمج أو استبدال البيانات الحالية على هذا المتصفح ومزامنتها للجميع.' 
                    : 'Warning: Uploading a database restore file will overwrite or combine matching records across your cloud storage.'}
                </span>
              </div>

              <div className="grid gap-3 pt-2">
                {/* Export Action */}
                <button
                  onClick={handleBackupData}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all text-xs"
                >
                  <Download size={15} />
                  <span>{isRtl ? 'تصدير نسخة احتياطية فورية (JSON)' : 'Download Complete Backup (JSON)'}</span>
                </button>

                {/* Import Action */}
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    id="db-restore-upload"
                    onChange={handleRestoreData}
                    className="hidden"
                  />
                  <label
                    htmlFor="db-restore-upload"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-all text-xs cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>{isRtl ? 'استيراد واستعادة قاعدة البيانات' : 'Restore database from JSON'}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Platform Admin Account Security (Exclusive to SystemAdmin) */}
          {currentUser && currentUser.role === 'SystemAdmin' && (
            <div className={`p-5 rounded-2xl border ${
              theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-2 mb-4 border-b pb-2.5 border-slate-100 dark:border-slate-800">
                <Lock size={16} className="text-rose-500 animate-pulse" />
                <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isRtl ? 'أمان حساب أدمن المنصة والتحقق الثنائي' : 'Platform Admin Account Security & 2FA'}
                </h3>
              </div>

              {adminSecuritySuccess && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  {adminSecuritySuccess}
                </div>
              )}

              {adminSecurityError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                  {adminSecurityError}
                </div>
              )}

              {adminEmailResetStep === 0 ? (
                /* Choose or Direct Update */
                <form onSubmit={handleUpdateAdminPasswordDirectly} className="space-y-4 text-xs">
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    {isRtl 
                      ? 'بصفتك مدير المنصة العام، يمكنك تحديث كلمة المرور الخاصة بك مباشرة باستخدام الرقم السري الحالي، أو اختبار كود التحقق الآمن عبر البريد الإلكتروني.' 
                      : 'As the Platform Admin, you can update your master credentials directly, or experience the secure email OTP simulation.'
                    }
                  </p>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'كلمة المرور الحالية *' : 'Current Password *'}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={currentAdminPassword}
                      onChange={(e) => setCurrentAdminPassword(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'كلمة المرور الجديدة *' : 'New Password *'}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>

                  <div className="grid gap-2 pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition-all text-xs cursor-pointer"
                    >
                      {isRtl ? 'حفظ التحديث مباشرة 💾' : 'Save Changes Directly 💾'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerAdminEmailReset}
                      className="w-full py-2.5 rounded-xl border border-indigo-500 text-indigo-500 hover:bg-indigo-500/10 font-bold transition-all text-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>{isRtl ? 'إرسال كود تعيين للإيميل 📧' : 'Send Reset Code to Email 📧'}</span>
                    </button>
                  </div>
                </form>
              ) : adminEmailResetStep === 1 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-xs">
                  <RefreshCw size={24} className="animate-spin text-indigo-500 mb-2" />
                  <p className="text-slate-400">{isRtl ? 'جاري توليد كود التحقق المشفر وإرساله...' : 'Generating security verification code...'}</p>
                </div>
              ) : adminEmailResetStep === 2 ? (
                /* Verify OTP & Set Password */
                <form onSubmit={handleVerifyAdminEmailCode} className="space-y-4 text-xs">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[11px] leading-relaxed">
                    {isRtl 
                      ? 'تم توليد كود تحقق سري ومحاكاة إرساله إلى بريدك alaaabusalah96@gmail.com بنجاح! يرجى نسخ الرمز المعروض بالأسفل وإدخاله هنا.' 
                      : 'Security verification code has been dispatched to alaaabusalah96@gmail.com. Please copy the code below.'
                    }
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'أدخل كود التحقق السري (6 أرقام) *' : 'Verification OTP (6 digits) *'}</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={adminResetCodeInput}
                      onChange={(e) => setAdminResetCodeInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-center font-mono text-base tracking-widest focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 text-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'كلمة المرور الجديدة *' : 'New Password *'}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all text-xs cursor-pointer"
                    >
                      {isRtl ? 'تأكيد وحفظ كلمة المرور' : 'Confirm & Save Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminEmailResetStep(0)}
                      className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-300 transition-all text-xs cursor-pointer"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Success step */
                <div className="flex flex-col items-center justify-center py-6 text-center text-xs">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2 animate-bounce">
                    <CheckCircle size={20} />
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{isRtl ? 'تم تحديث كلمة المرور بالكامل!' : 'Password updated successfully!'}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{isRtl ? 'تم مزامنة الرقم السري الجديد مع الخادم السحابي بنجاح.' : 'New master key synced to Firestore.'}</p>
                  <button
                    onClick={() => {
                      setAdminEmailResetStep(0);
                      setAdminSecuritySuccess('');
                      setAdminSecurityError('');
                    }}
                    className="mt-4 px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all text-[11px] font-bold cursor-pointer"
                  >
                    {isRtl ? 'العودة' : 'Go Back'}
                  </button>
                </div>
              )}

              {/* Settings Internal Mailbox Simulator View */}
              {adminEmailResetStep === 2 && (
                <div className="mt-4 p-3 rounded-xl border border-indigo-500/20 bg-slate-900/90 text-slate-300 text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold border-b border-slate-800 pb-1.5 mb-1.5 uppercase tracking-wider text-[9px]">
                    <Inbox size={12} />
                    <span>{isRtl ? 'علبة الوارد الافتراضية لأدمن المنصة' : 'Virtual Mail Inbox (alaaabusalah96@gmail.com)'}</span>
                  </div>
                  <p className="text-slate-200 font-bold">{isRtl ? '🔐 رمز الأمان السري لإعادة تعيين كلمة مرور KEMIT ERP' : '🔐 KEMIT ERP Security OTP'}</p>
                  <p className="mt-1 text-slate-400">{isRtl ? 'الرمز المؤقت لتحديث حسابك بالكامل هو:' : 'Your master account OTP token is:'}</p>
                  <div className="my-2 p-2 rounded bg-indigo-950/40 text-center font-mono text-base font-extrabold tracking-widest text-indigo-400">
                    {adminGeneratedCode}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: USER ACCOUNTS & PERMISSIONS MODULE --- */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-fade-in">
          {/* Pending Approval Requests Section (SystemAdmin Only) */}
          {currentUser.role === 'SystemAdmin' && (
            <div className={`p-5 rounded-2xl border flex flex-col ${
              theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-2 mb-4 border-b pb-2.5 border-slate-100 dark:border-slate-800">
                <ShieldCheck size={16} className="text-amber-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isRtl ? 'طلبات التسجيل وتفعيل الحسابات المعلقة (لكل شركة منفصلة)' : 'Pending Registration & Activation Queue (Company Isolated)'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isRtl 
                      ? 'قم بمراجعة طلبات الانضمام، وتحديد المنطقة/الفرع المناسب لكل موظف وعزل حسابه داخل شركته الخاصة.' 
                      : 'Review incoming requests, assign their specific geographical scopes, and approve them securely.'}
                  </p>
                </div>
              </div>

              {/* Grid of pending user requests */}
              {CustodyDB.getUsers().filter(u => !u.is_active).length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  {isRtl ? 'لا توجد طلبات تفعيل معلقة حالياً.' : 'No pending registration requests at this moment.'}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {CustodyDB.getUsers().filter(u => !u.is_active).map((pendingUser) => {
                    const requestedCompany = CustodyDB.getCompanies().find(c => c.id === pendingUser.company_id);
                    // Filter stations and regions by the pending user's requested company_id
                    const companyStations = CustodyDB.getStations().filter(s => s.company_id === pendingUser.company_id);
                    const companyRegions = CustodyDB.getRegions().filter(r => r.company_id === pendingUser.company_id);

                    const mapping = pendingMappings[pendingUser.id] || {};

                    return (
                      <div 
                        key={pendingUser.id}
                        className={`p-4 rounded-xl border text-xs flex flex-col justify-between gap-3 ${
                          theme === 'dark' ? 'bg-slate-800/40 border-slate-700' : 'bg-amber-50/20 border-amber-200/40 shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-100">{pendingUser.full_name}</span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              {pendingUser.role === 'Admin' ? (isRtl ? 'أدمن شركة' : 'Company Admin') : pendingUser.role === 'RegionalManager' ? (isRtl ? 'مدير منطقة' : 'Regional Manager') : (isRtl ? 'مدير محطة' : 'Station Mgr')}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mb-2">{pendingUser.email}</div>
                          
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] mb-3">
                            <div className="font-bold text-slate-500 mb-0.5">{isRtl ? 'الشركة المطلوبة:' : 'Requested Corporate:'}</div>
                            <div className="text-emerald-600 dark:text-emerald-400 font-extrabold">{requestedCompany?.name || pendingUser.company_id || (isRtl ? 'غير محدد' : 'Not Specified')}</div>
                          </div>

                          {/* Company Scope Mapping Options */}
                          <div className="space-y-2 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                            {pendingUser.role === 'StationAdmin' && (
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 mb-1">
                                  {isRtl ? 'تعيين لفرع/محطة الشركة:' : 'Assign Company Station:'}
                                </label>
                                <select
                                  value={mapping.stationId || ''}
                                  onChange={(e) => setPendingMappings({
                                    ...pendingMappings,
                                    [pendingUser.id]: { ...mapping, stationId: e.target.value }
                                  })}
                                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                                    theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                                  }`}
                                  required
                                >
                                  <option value="">{isRtl ? '--- اختر المحطة ---' : '--- Choose Station ---'}</option>
                                  {companyStations.map(s => (
                                    <option key={s.id} value={s.id}>{s.station_name} ({s.station_code})</option>
                                  ))}
                                </select>
                                {companyStations.length === 0 && (
                                  <span className="text-[9px] text-rose-500 mt-1 block">
                                    {isRtl ? '⚠️ لا توجد محطات مسجلة لهذه الشركة بعد!' : '⚠️ No stations registered for this company yet!'}
                                  </span>
                                )}
                              </div>
                            )}

                            {pendingUser.role === 'RegionalManager' && (
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 mb-1">
                                  {isRtl ? 'تعيين لمنطقة الشركة الجغرافية:' : 'Assign Company Region:'}
                                </label>
                                <select
                                  value={mapping.regionId || ''}
                                  onChange={(e) => setPendingMappings({
                                    ...pendingMappings,
                                    [pendingUser.id]: { ...mapping, regionId: e.target.value }
                                  })}
                                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                                    theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                                  }`}
                                  required
                                >
                                  <option value="">{isRtl ? '--- اختر المنطقة ---' : '--- Choose Region ---'}</option>
                                  {companyRegions.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                  ))}
                                </select>
                                {companyRegions.length === 0 && (
                                  <span className="text-[9px] text-rose-500 mt-1 block">
                                    {isRtl ? '⚠️ لا توجد مناطق مسجلة لهذه الشركة بعد!' : '⚠️ No regions registered for this company yet!'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => {
                              // Perform activation
                              if (pendingUser.role === 'StationAdmin' && !mapping.stationId) {
                                alert(isRtl ? 'يرجى اختيار المحطة التابعة لشركة الموظف أولاً.' : 'Please choose the station for this company employee first.');
                                return;
                              }
                              if (pendingUser.role === 'RegionalManager' && !mapping.regionId) {
                                alert(isRtl ? 'يرجى اختيار المنطقة التابعة لشركة الموظف أولاً.' : 'Please choose the region for this company employee first.');
                                return;
                              }

                              // Find the station or region details to map correctly
                              const chosenStation = companyStations.find(s => s.id === mapping.stationId);
                              const mappedRegionId = pendingUser.role === 'StationAdmin' 
                                ? (chosenStation?.region_id || '') 
                                : mapping.regionId;

                              const allDbUsers = CustodyDB.getUsers();
                              const updatedDbUsers = allDbUsers.map(u => {
                                if (u.id === pendingUser.id) {
                                  return {
                                    ...u,
                                    is_active: true,
                                    station_id: pendingUser.role === 'StationAdmin' ? mapping.stationId : undefined,
                                    region_id: mappedRegionId || undefined,
                                    permissions: CustodyDB.enrichUserPermissions(u.role)
                                  };
                                }
                                return u;
                              });

                              CustodyDB.saveUsers(updatedDbUsers);
                              setUsers(CustodyDB.getScopedUsers());
                              triggerToast(isRtl ? `تم تفعيل حساب الموظف ${pendingUser.full_name} بنجاح.` : `User account for ${pendingUser.full_name} successfully activated.`);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black hover:shadow-md transition-all cursor-pointer"
                          >
                            {isRtl ? 'الموافقة والتفعيل' : 'Approve & Activate'}
                          </button>
                          <button
                            onClick={() => {
                              if (!confirm(isRtl ? 'هل أنت متأكد من رفض وحذف طلب هذا التسجيل؟' : 'Are you sure you want to reject and delete this request?')) return;
                              const allDbUsers = CustodyDB.getUsers().filter(u => u.id !== pendingUser.id);
                              CustodyDB.saveUsers(allDbUsers);
                              setUsers(CustodyDB.getScopedUsers());
                              triggerToast(isRtl ? 'تم رفض وحذف الطلب المعلق.' : 'Pending request rejected and deleted.');
                            }}
                            className="px-3 py-1.5 rounded-lg border text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                          >
                            {isRtl ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className={currentUser.role === 'SystemAdmin' ? "grid gap-6 md:grid-cols-2" : "max-w-3xl mx-auto w-full"}>
            {/* Card 1: Users Accounts list */}
            <div className={`p-5 rounded-2xl border flex flex-col ${
              theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-2 mb-4 border-b pb-2.5 border-slate-100 dark:border-slate-800">
                <Users2 size={16} className="text-emerald-500" />
                <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isRtl ? 'قائمة حسابات الموظفين وصلاحياتهم' : 'Employees & Security Profiles'}
                </h3>
              </div>

              {/* List of current scoped users */}
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 flex-1">
                {users.filter(u => u.is_active !== false).map((u) => {
                  const isEditing = editingUserId === u.id;
                  const uStation = u.station_id ? stations.find(s => s.id === u.station_id) : null;
                  const uRegion = u.region_id ? regions.find(r => r.id === u.region_id) : null;
                  
                  return (
                    <div 
                      key={u.id} 
                      className={`p-3.5 rounded-xl border text-xs relative ${
                        isEditing 
                          ? 'border-indigo-500 bg-indigo-500/5' 
                          : (theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50/50 border-slate-150')
                      }`}
                    >
                      {isEditing ? (
                        /* Expanded Edit User Sub Form */
                        <div className="space-y-3">
                          <div className="font-black text-slate-700 dark:text-slate-200">
                            {isRtl ? `تعديل صلاحيات: ${u.full_name}` : `Modifying parameters: ${u.full_name}`}
                          </div>

                          <div>
                            <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'الاسم بالكامل' : 'Full Name'}</label>
                            <input
                              type="text"
                              value={editUserFullName}
                              onChange={(e) => setEditUserFullName(e.target.value)}
                              className={`w-full px-2 py-1 rounded text-xs focus:outline-none ${
                                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                              }`}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'الدور المالي' : 'Role'}</label>
                              <select
                                value={editUserRole}
                                onChange={(e) => handleEditUserRoleChange(e.target.value as UserRole)}
                                className={`w-full px-2 py-1 rounded text-xs focus:outline-none ${
                                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                                }`}
                              >
                                {SYSTEM_ROLES.filter(r => !r.systemAdminOnly || currentUser.role === 'SystemAdmin').map(r => (
                                  <option key={r.id} value={r.id}>{isRtl ? r.labelAr : r.labelEn}</option>
                                ))}
                              </select>
                            </div>

                            {editUserRole === 'StationAdmin' && (
                              <div>
                                <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'ربط بالمحطة' : 'Station Mapping'}</label>
                                <select
                                  value={editUserStationId}
                                  onChange={(e) => setEditUserStationId(e.target.value)}
                                  className={`w-full px-2 py-1 rounded text-xs focus:outline-none ${
                                    theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                                  }`}
                                >
                                  <option value="">{isRtl ? 'بدون محطة' : 'Unmapped'}</option>
                                  {stations.map(s => (
                                    <option key={s.id} value={s.id}>{s.station_name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {editUserRole === 'RegionalManager' && (
                              <div>
                                <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'ربط بالمنطقة' : 'Region Mapping'}</label>
                                <select
                                  value={editUserRegionId}
                                  onChange={(e) => setEditUserRegionId(e.target.value)}
                                  className={`w-full px-2 py-1 rounded text-xs focus:outline-none ${
                                    theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                                  }`}
                                >
                                  <option value="">{isRtl ? 'بدون منطقة' : 'Unmapped'}</option>
                                  {regions.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Interactive Permissions checklist */}
                          <div className="space-y-2 border-t border-b py-2.5 my-2 border-slate-200 dark:border-slate-800">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                              {isRtl ? 'تخصيص الصلاحيات الفردية:' : 'Grant Scoped Authority:'}
                            </span>

                            {/* Toggle between Default and Custom */}
                            <div className="flex bg-slate-100/80 dark:bg-slate-950/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 mb-2">
                              <button
                                type="button"
                                onClick={() => handleEditUserToggleMode(true)}
                                className={`flex-1 py-1 rounded text-[9px] font-bold transition-all text-center cursor-pointer ${
                                  editUserIsDefaultMode 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                              >
                                {isRtl ? 'الافتراضية للدور (Default)' : 'Default for Role'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditUserToggleMode(false)}
                                className={`flex-1 py-1 rounded text-[9px] font-bold transition-all text-center cursor-pointer ${
                                  !editUserIsDefaultMode 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                              >
                                {isRtl ? 'تخصيص يدوي (Manual)' : 'Manual Customization'}
                              </button>
                            </div>

                            <div className={`grid grid-cols-2 gap-2 text-[10px] ${editUserIsDefaultMode ? 'opacity-70 font-medium' : ''}`}>
                              {PERMISSIONS_LIST.filter(p => !currentUser?.company_id || ModulesModule.isPermissionEnabledForCompany(currentUser.company_id, p.key)).map((p) => (
                                <label key={p.key} className={`flex items-center gap-1.5 text-slate-600 dark:text-slate-300 ${editUserIsDefaultMode ? 'cursor-not-allowed' : 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400'}`}>
                                  <input
                                    type="checkbox"
                                    disabled={editUserIsDefaultMode}
                                    checked={!!editUserPermissions[p.key as keyof UserPermissions]}
                                    onChange={(e) => setEditUserPermissions({
                                      ...editUserPermissions,
                                      [p.key]: e.target.checked
                                    })}
                                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="font-semibold">{isRtl ? p.ar : p.en}</span>
                                </label>
                              ))}
                            </div>

                            {editUserIsDefaultMode && (
                              <p className="text-[9px] text-slate-400 font-semibold italic text-center pt-1">
                                {isRtl ? '💡 يتم تطبيق الصلاحيات القياسية لهذا الدور المالي تلقائياً.' : '💡 Standard permissions are locked to this role automatically.'}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleSaveEditUser(u.id)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-black"
                            >
                              {isRtl ? 'حفظ الصلاحيات' : 'Update Profile'}
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              {isRtl ? 'إلغاء' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display User View */
                        <>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100 block">{u.full_name}</span>
                              <span className="text-[10px] text-slate-400 block font-mono mb-1">{u.email}</span>
                              {uStation && (
                                <span className="text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-semibold inline-block">
                                  {isRtl ? `فرع/محطة: ${uStation.station_name}` : `Station: ${uStation.station_name}`}
                                </span>
                              )}
                              {!uStation && uRegion && (
                                <span className="text-[10px] bg-sky-500/10 px-1.5 py-0.5 rounded text-sky-600 dark:text-sky-400 font-semibold inline-block">
                                  {isRtl ? `منطقة: ${uRegion.name}` : `Region: ${uRegion.name}`}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {(() => {
                                const rDef = SYSTEM_ROLES.find(r => r.id === u.role);
                                return (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${rDef?.bgClass || 'bg-slate-500/15 text-slate-600 border border-slate-500/10'}`}>
                                    {rDef ? (isRtl ? rDef.labelAr : rDef.labelEn) : u.role}
                                  </span>
                                );
                              })()}
                              
                              {/* Actions buttons */}
                              {currentUser.role === 'SystemAdmin' && (
                                <>
                                  <button
                                    onClick={() => handleStartEditUser(u)}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                                    title="Edit role & fine-grain permissions"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    title="Delete employee profile"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Scoped privileges checkmarks */}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-400">
                            <div className="flex items-center gap-1">
                              <ShieldCheck size={11} className={u.permissions.manage_settings ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                              <span className={u.permissions.manage_settings ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Manage settings</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ShieldCheck size={11} className={u.permissions.create_expense ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                              <span className={u.permissions.create_expense ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Create expenses</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ShieldCheck size={11} className={u.permissions.settle_voucher ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                              <span className={u.permissions.settle_voucher ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Settle vouchers</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ShieldCheck size={11} className={u.permissions.delete_expense ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                              <span className={u.permissions.delete_expense ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Delete expenses</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ShieldCheck size={11} className={u.permissions.replace_custody ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                              <span className={u.permissions.replace_custody ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>
                                {isRtl ? 'استعاضة العهدة' : 'Replenish custody'}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Register New User Profile Form */}
            {currentUser.role === 'SystemAdmin' && (
              <div className={`p-5 rounded-2xl border flex flex-col ${
                theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-2 mb-4 border-b pb-2.5 border-slate-100 dark:border-slate-800">
                  <UserPlus size={16} className="text-emerald-500" />
                  <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isRtl ? 'تسجيل موظف مالي جديد' : 'Pre-seed New User Credentials'}
                  </h3>
                </div>

                <form onSubmit={handleAddUser} className="space-y-3.5 text-xs flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'الاسم بالكامل' : 'Full Name'}</label>
                      <input
                        type="text"
                        placeholder={isRtl ? 'الاسم الثلاثي للموظف' : 'Full Name'}
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</label>
                      <input
                        type="email"
                        placeholder={isRtl ? 'user@company.com' : 'Email address'}
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'الدور الوظيفي والمسؤولية:' : 'Role Selection:'}</label>
                      <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 border rounded-xl">
                        {SYSTEM_ROLES.filter(r => !r.systemAdminOnly || currentUser.role === 'SystemAdmin').map((role) => (
                          <label key={role.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="newUserRoleRadio"
                              checked={newUserRole === role.id}
                              onChange={() => setNewUserRole(role.id)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className={role.colorClass}>
                              {isRtl ? role.labelAr : role.labelEn}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Conditional Station selection */}
                    {newUserRole === 'StationAdmin' && (
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'تعيين إلى فرع / محطة:' : 'Assign to Cash Station:'}</label>
                        <select
                          value={newUserStationId}
                          onChange={(e) => setNewUserStationId(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                          }`}
                          required
                        >
                          <option value="">{isRtl ? 'اختر المحطة التابع لها...' : 'Select Station...'}</option>
                          {stations.map(s => (
                            <option key={s.id} value={s.id}>{s.station_name} ({s.station_code})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Conditional Region selection */}
                    {newUserRole === 'RegionalManager' && (
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'تعيين إلى منطقة جغرافية:' : 'Assign to Region Zone:'}</label>
                        <select
                          value={newUserRegionId}
                          onChange={(e) => setNewUserRegionId(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                          }`}
                          required
                        >
                          <option value="">{isRtl ? 'اختر المنطقة الجغرافية...' : 'Select Region...'}</option>
                          {regions.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all"
                  >
                    + {isRtl ? 'تسجيل الموظف وتعميم الصلاحيات' : 'Register & Seed Credentials'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <PermissionMatrix language={language} theme={theme} />
      )}
    </div>
  );
}
