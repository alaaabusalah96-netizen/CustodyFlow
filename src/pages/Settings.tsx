import React, { useState, useEffect } from 'react';
import { CustodyDB, ModulesModule } from '../db';
import { auth, useScreenListeners } from '../firebase';
import ApprovalWorkflowManager from '../components/ApprovalWorkflowManager';
import OrgUnitTreeSelect from '../components/OrgUnitTreeSelect';
import SettingsGeneralTab from '../components/settings/SettingsGeneralTab';
import UnifiedAccessControlCenter from '../components/settings/UnifiedAccessControlCenter';
import { UsersModule } from '../db/users';
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
  useScreenListeners(['logs', 'AuditLogs']);

  const t = translations[language];
  const isRtl = language === 'ar';

  const currentUser = CustodyDB.getActiveUser();

  // Tab State
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'workflows'>('general');

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
  const [newUserOrgUnitId, setNewUserOrgUnitId] = useState('');
  const [newUserAssignedOrgUnitIds, setNewUserAssignedOrgUnitIds] = useState<string[]>([]);

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('StationAdmin');
  const [editUserStationId, setEditUserStationId] = useState('');
  const [editUserRegionId, setEditUserRegionId] = useState('');
  const [editUserOrgUnitId, setEditUserOrgUnitId] = useState('');
  const [editUserAssignedOrgUnitIds, setEditUserAssignedOrgUnitIds] = useState<string[]>([]);
  const [editUserPermissions, setEditUserPermissions] = useState<UserPermissions>({
    manage_settings: false,
    create_expense: false,
    settle_voucher: false,
    delete_expense: false,
    view_reports: false
  });
  const [editUserIsDefaultMode, setEditUserIsDefaultMode] = useState<boolean>(true);

  const [pendingMappings, setPendingMappings] = useState<Record<string, { stationId?: string; regionId?: string; org_unit_id?: string }>>({});

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

  const handleUpdateAdminPasswordDirectly = async (e: React.FormEvent) => {
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
    const adminUser = usersList.find(u => u.role === 'SystemAdmin' && CustodyDB.isPlatformOwner(u.email));

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

    await CustodyDB.saveUsers(updated);
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

  const handleVerifyAdminEmailCode = async (e: React.FormEvent) => {
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
      const isPlatformAdmin = u.email && CustodyDB.isPlatformOwner(u.email);
      if (isPlatformAdmin) {
        return { ...u, password: newAdminPassword };
      }
      return u;
    });

    await CustodyDB.saveUsers(updated);
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

    fileReader.onload = async (event) => {
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
        if (parsed.users) await CustodyDB.saveUsers(parsed.users);
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

  // Helper to fetch authorization headers for secure user admin API
  const getAuthHeaders = async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('Failed to retrieve ID token:', err);
    }
    return headers;
  };

  // --- USERS ACTIONS ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'SystemAdmin' && currentUser.role !== 'Admin' && !currentUser.permissions?.manage_users) {
      alert(isRtl ? '⚠️ هذه الصلاحية حصرية لإدارة المنصة والشركة فقط!' : '⚠️ Privilege restricted to Platform & Company Admins.');
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

    const companyId = currentUser.company_id || CustodyDB.getSelectedCompanyId() || '';
    const tempPassword = `TempPass${Math.floor(100000 + Math.random() * 900000)}!`;

    const payload = {
      email: newUserEmail.trim().toLowerCase(),
      password: tempPassword,
      full_name: newUserName.trim(),
      role: newUserRole,
      company_id: companyId,
      region_id: isRegional ? (newUserRegionId || null) : null,
      station_id: isStationAdmin ? (newUserStationId || null) : null,
      org_unit_id: newUserOrgUnitId || null,
      assigned_org_unit_ids: newUserAssignedOrgUnitIds.length > 0 ? newUserAssignedOrgUnitIds : [],
      permissions: permissions,
      must_change_password: true
    };

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: await getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.message || (isRtl ? 'فشل إنشاء حساب المستخدم' : 'Failed to create user');
        alert(`⚠️ ${errMsg}`);
        return;
      }

      if (data.user) {
        const allUsers = CustodyDB.getUsers();
        const existingIdx = allUsers.findIndex(u => u.id === data.user.id);
        if (existingIdx >= 0) {
          allUsers[existingIdx] = data.user;
        } else {
          allUsers.push(data.user);
        }
        await CustodyDB.saveUsers(allUsers);
      }
      setUsers(CustodyDB.getScopedUsers());

      setNewUserName('');
      setNewUserEmail('');
      setNewUserOrgUnitId('');
      setNewUserAssignedOrgUnitIds([]);
      setNewUserStationId('');
      setNewUserRegionId('');

      alert(isRtl
        ? `✅ تم إنشاء وتوثيق حساب الموظف بنجاح!\n\nكلمة المرور المؤقتة هي: ${tempPassword}\n\nيرجى تسليمها للموظف لاستخدامها عند تسجيل الدخول لأول مرة.`
        : `✅ User account created and provisioned successfully!\n\nTemporary Password: ${tempPassword}\n\nPlease share this temporary password with the user.`
      );

      triggerToast(isRtl ? 'تم إضافة وتوثيق حساب المستخدم بنجاح.' : 'New user created successfully.');
    } catch (err: any) {
      alert(isRtl ? `⚠️ خطأ في الاتصال بالخادم: ${err.message}` : `⚠️ Server connection error: ${err.message}`);
    }
  };

  const handleStartEditUser = (u: AppUser) => {
    setEditingUserId(u.id);
    setEditUserFullName(u.full_name);
    setEditUserRole(u.role);
    setEditUserStationId(u.station_id || '');
    setEditUserRegionId(u.region_id || '');
    setEditUserOrgUnitId(u.org_unit_id || '');
    setEditUserAssignedOrgUnitIds(u.assigned_org_unit_ids || []);
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

  const handleSaveEditUser = async (id: string) => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return;

    const accessCheck = UsersModule.canUserManageTargetUser(currentUser, targetUser);
    if (!accessCheck.allowed) {
      alert(`⚠️ ${accessCheck.reason || (isRtl ? 'ليس لديك صلاحية لتعديل هذا المستخدم!' : 'Insufficient permissions to edit this user!')}`);
      return;
    }
    if (!editUserFullName.trim()) return;

    const companyId = targetUser.company_id || currentUser.company_id || CustodyDB.getSelectedCompanyId() || '';

    const payload = {
      full_name: editUserFullName.trim(),
      role: editUserRole,
      company_id: companyId,
      region_id: editUserRole === 'RegionalManager' ? (editUserRegionId || null) : null,
      station_id: editUserRole === 'StationAdmin' ? (editUserStationId || null) : null,
      org_unit_id: editUserOrgUnitId || null,
      assigned_org_unit_ids: editUserAssignedOrgUnitIds.length > 0 ? editUserAssignedOrgUnitIds : [],
      permissions: editUserPermissions,
    };

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.message || (isRtl ? 'فشل تحديث بيانات المستخدم' : 'Failed to update user');
        alert(`⚠️ ${errMsg}`);
        return;
      }

      if (data.user) {
        const allUsers = CustodyDB.getUsers().map(u => u.id === id ? { ...u, ...data.user } : u);
        await CustodyDB.saveUsers(allUsers);
      }
      setUsers(CustodyDB.getScopedUsers());
      setEditingUserId(null);
      triggerToast(isRtl ? 'تم تحديث أدوار وصلاحيات الموظف بنجاح.' : 'User permissions successfully updated.');
    } catch (err: any) {
      alert(isRtl ? `⚠️ خطأ في الاتصال بالخادم: ${err.message}` : `⚠️ Server connection error: ${err.message}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
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
    await CustodyDB.saveUsers(allUsers);
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
          {isRtl ? '👥 الصلاحيات والوصول (شخص × فرع × موديول)' : '👥 Access Control & Scope'}
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-4 py-2 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'workflows'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-400'
          }`}
        >
          {isRtl ? '🔄 مسارات وسياسات الاعتماد' : '🔄 Approval Workflows'}
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
        <SettingsGeneralTab
          language={language}
          theme={theme}
          currentUser={currentUser}
          companyName={companyName}
          setCompanyName={setCompanyName}
          custodyValue={custodyValue}
          setCustodyValue={setCustodyValue}
          useCustomTemplate={useCustomTemplate}
          setUseCustomTemplate={setUseCustomTemplate}
          customTemplateImage={customTemplateImage}
          setCustomTemplateImage={setCustomTemplateImage}
          regions={regions}
          stations={stations}
          handleSaveConfig={handleSaveConfig}
          handleBackupData={handleBackupData}
          handleRestoreData={handleRestoreData}
          currentAdminPassword={currentAdminPassword}
          setCurrentAdminPassword={setCurrentAdminPassword}
          newAdminPassword={newAdminPassword}
          setNewAdminPassword={setNewAdminPassword}
          confirmAdminPassword={confirmAdminPassword}
          setConfirmAdminPassword={setConfirmAdminPassword}
          adminSecurityError={adminSecurityError}
          adminSecuritySuccess={adminSecuritySuccess}
          adminEmailResetStep={adminEmailResetStep}
          setAdminEmailResetStep={setAdminEmailResetStep}
          adminGeneratedCode={adminGeneratedCode}
          adminResetCodeInput={adminResetCodeInput}
          setAdminResetCodeInput={setAdminResetCodeInput}
          handleUpdateAdminPasswordDirectly={handleUpdateAdminPasswordDirectly}
          handleTriggerAdminEmailReset={handleTriggerAdminEmailReset}
          handleVerifyAdminEmailCode={handleVerifyAdminEmailCode}
          setAdminSecurityError={setAdminSecurityError}
          setAdminSecuritySuccess={setAdminSecuritySuccess}
        />
      )}

      {/* --- TAB 2: UNIFIED ACCESS CONTROL & PERMISSIONS (شخص × فرع × موديول) --- */}
      {activeTab === 'users' && (
        <UnifiedAccessControlCenter
          language={language}
          theme={theme}
          currentUser={currentUser}
          users={users}
          regions={regions}
          stations={stations}
          editingUserId={editingUserId}
          setEditingUserId={setEditingUserId}
          editUserFullName={editUserFullName}
          setEditUserFullName={setEditUserFullName}
          editUserRole={editUserRole}
          editUserStationId={editUserStationId}
          setEditUserStationId={setEditUserStationId}
          editUserRegionId={editUserRegionId}
          setEditUserRegionId={setEditUserRegionId}
          editUserOrgUnitId={editUserOrgUnitId}
          setEditUserOrgUnitId={setEditUserOrgUnitId}
          editUserAssignedOrgUnitIds={editUserAssignedOrgUnitIds}
          setEditUserAssignedOrgUnitIds={setEditUserAssignedOrgUnitIds}
          editUserPermissions={editUserPermissions}
          setEditUserPermissions={setEditUserPermissions}
          editUserIsDefaultMode={editUserIsDefaultMode}
          handleEditUserRoleChange={handleEditUserRoleChange}
          handleEditUserToggleMode={handleEditUserToggleMode}
          handleSaveEditUser={handleSaveEditUser}
          handleDeleteUser={handleDeleteUser}
          handleStartEditUser={handleStartEditUser}
          newUserName={newUserName}
          setNewUserName={setNewUserName}
          newUserEmail={newUserEmail}
          setNewUserEmail={setNewUserEmail}
          newUserRole={newUserRole}
          setNewUserRole={setNewUserRole}
          newUserStationId={newUserStationId}
          setNewUserStationId={setNewUserStationId}
          newUserRegionId={newUserRegionId}
          setNewUserRegionId={setNewUserRegionId}
          newUserOrgUnitId={newUserOrgUnitId}
          setNewUserOrgUnitId={setNewUserOrgUnitId}
          newUserAssignedOrgUnitIds={newUserAssignedOrgUnitIds}
          setNewUserAssignedOrgUnitIds={setNewUserAssignedOrgUnitIds}
          handleAddUser={handleAddUser}
          getAuthHeaders={getAuthHeaders}
          setUsers={setUsers}
          triggerToast={triggerToast}
        />
      )}

      {activeTab === 'workflows' && (
        <ApprovalWorkflowManager
          companyId={currentUser.company_id || CustodyDB.getSelectedCompanyId() || ''}
          isRtl={isRtl}
          theme={theme}
        />
      )}
    </div>
  );
}
