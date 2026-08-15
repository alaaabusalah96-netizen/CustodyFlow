import React, { useState, useMemo } from 'react';
import { 
  Users2, 
  ShieldCheck, 
  Building2, 
  MapPin, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  UserPlus, 
  Check, 
  X, 
  Car, 
  Receipt, 
  FileText, 
  BarChart3, 
  Sliders, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Info,
  Lock,
  ChevronRight,
  Shield,
  Eye,
  CheckSquare,
  Square
} from 'lucide-react';
import { Language, Theme, AppUser, UserRole, Region, Station, UserPermissions, OrganizationUnit } from '../../types';
import { CustodyDB, ModulesModule } from '../../db';
import { UsersModule } from '../../db/users';
import { OrganizationEngine } from '../../db/organizationEngine';
import { OrganizationScopeEngine } from '../../db/organizationScopeEngine';
import OrgUnitTreeSelect from '../OrgUnitTreeSelect';

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
    bgClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    systemAdminOnly: true
  },
  {
    id: 'Admin',
    labelEn: 'Company Admin',
    labelAr: 'أدمن الشركة (Company Admin)',
    colorClass: 'text-rose-500 font-bold dark:text-rose-400',
    bgClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
  },
  {
    id: 'RegionalManager',
    labelEn: 'Regional Manager',
    labelAr: 'مدير منطقة / قطاع (Regional Manager)',
    colorClass: 'text-sky-600 font-semibold dark:text-sky-400',
    bgClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20'
  },
  {
    id: 'StationAdmin',
    labelEn: 'Station / Branch Admin',
    labelAr: 'مدير فرع / محطة / أمين عهدة',
    colorClass: 'text-emerald-600 font-semibold dark:text-emerald-400',
    bgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
  }
];

// Module Categories definition for visual grouping
interface ModuleCategoryConfig {
  id: 'custody_expenses' | 'vouchers' | 'fleet' | 'reports' | 'admin';
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  badgeBg: string;
  badgeText: string;
  permissions: {
    key: keyof UserPermissions;
    nameAr: string;
    nameEn: string;
    descAr: string;
    descEn: string;
    systemAdminOnly?: boolean;
  }[];
}

const MODULE_CATEGORIES: ModuleCategoryConfig[] = [
  {
    id: 'custody_expenses',
    nameAr: 'العهد النقدية والمصروفات',
    nameEn: 'Cash Custody & Expenses',
    descAr: 'إدارة وتخصيص حدود العهد النقدية للمحطات وتسجيل وتعديل المصروفات اليومية واستعاضتها',
    descEn: 'Manage custody limits, record and edit expenses, and process replenishments',
    icon: Receipt,
    color: 'emerald',
    badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    permissions: [
      { key: 'create_expense', nameAr: 'إضافة وتسجيل المصروفات', nameEn: 'Create & Record Expenses', descAr: 'إنشاء طلبات مصروفات جديدة في اليومية', descEn: 'Create new expense entries' },
      { key: 'edit_expense', nameAr: 'تعديل المصروفات', nameEn: 'Edit Expenses', descAr: 'تعديل بيانات وفواتير المصروفات غير المغلقة', descEn: 'Edit pending/draft expense records' },
      { key: 'delete_expense', nameAr: 'حذف المصروفات', nameEn: 'Delete Expenses', descAr: 'إلغاء وحذف قيود المصروفات المسجلة', descEn: 'Remove expense entries' },
      { key: 'create_custody', nameAr: 'إعداد عهدة جديدة', nameEn: 'Create Custody Account', descAr: 'تهيئة وإسناد رصيد عهدة نقدية لفرع أو شخص', descEn: 'Setup cash custody accounts' },
      { key: 'edit_custody', nameAr: 'تعديل سقف العهدة', nameEn: 'Edit Custody Limit', descAr: 'تعديل الحدود المالية وسقوف العهد', descEn: 'Modify custody financial thresholds' },
      { key: 'replace_custody', nameAr: 'طلب استعاضة العهدة', nameEn: 'Request Replenishment', descAr: 'تقديم وطلب استعاضة المبالغ المصروفة للعهدة', descEn: 'Request custody replenishment funds' },
    ]
  },
  {
    id: 'vouchers',
    nameAr: 'سندات الصرف والتسويات',
    nameEn: 'Cash Vouchers & Settlements',
    descAr: 'إنشاء ومراجعة واعتماد سندات الصرف النقدي وإقفال وتسوية المطالبات المالية',
    descEn: 'Create, review, approve cash vouchers and close financial settlements',
    icon: FileText,
    color: 'blue',
    badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20',
    badgeText: 'text-blue-600 dark:text-blue-400',
    permissions: [
      { key: 'create_voucher', nameAr: 'إنشاء سند صرف نقدي', nameEn: 'Create Cash Voucher', descAr: 'تحرير سندات الصرف النقدي للطلبات', descEn: 'Generate cash payment vouchers' },
      { key: 'approve_voucher', nameAr: 'اعتماد سندات الصرف', nameEn: 'Approve Cash Vouchers', descAr: 'الموافقة على سندات الصرف في مسار الاعتماد', descEn: 'Authorize pending vouchers' },
      { key: 'reject_voucher', nameAr: 'رفض سندات الصرف', nameEn: 'Reject Cash Vouchers', descAr: 'إرجاع أو رفض سندات الصرف غير المستوفاة', descEn: 'Reject or return vouchers' },
      { key: 'settle_voucher', nameAr: 'تسوية وإقفال المطالبات', nameEn: 'Settle & Close Vouchers', descAr: 'إقفال السندات محاسبياً وتسوية الأرصدة', descEn: 'Finalize and settle voucher balances' },
    ]
  },
  {
    id: 'fleet',
    nameAr: 'الأسطول وحركة المركبات',
    nameEn: 'Fleet & Logistics Management',
    descAr: 'إدارة أسطول المركبات، السائقين، المشاوير، خطوط السير، الأعطال، وبوابة السائق الميدانية',
    descEn: 'Manage vehicle inventory, drivers, trip dispatching, breakdowns, and driver portal',
    icon: Car,
    color: 'amber',
    badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
    badgeText: 'text-amber-600 dark:text-amber-400',
    permissions: [
      { key: 'manage_fleet', nameAr: 'إدارة الأسطول والمركبات', nameEn: 'Manage Fleet Inventory', descAr: 'إضافة وتعديل بيانات المركبات والسائقين والوثائق', descEn: 'Manage vehicles and driver records' },
      { key: 'create_trip', nameAr: 'إنشاء طلب مشوار', nameEn: 'Create Trip Request', descAr: 'جدولة مشاوير جديدة وتحديد نقاط التوقف', descEn: 'Schedule new dispatch trips' },
      { key: 'approve_trip', nameAr: 'اعتماد المشاوير', nameEn: 'Approve Trips', descAr: 'مراجعة وتأكيد أوامر التحرك وجداول الرحلات', descEn: 'Authorize trip dispatch orders' },
      { key: 'dispatch_trip', nameAr: 'تحريك وتنفيذ المشوار', nameEn: 'Dispatch & Execute Trips', descAr: 'بدء تحرك المركبة وتسجيل قراءات العداد والانطلاق', descEn: 'Dispatch vehicle and log starts' },
      { key: 'reassign_vehicle', nameAr: 'إعادة إسناد مهام الأعطال', nameEn: 'Reassign Breakdown Tasks', descAr: 'إعادة توزيع مهام مركبة متعطلة لمركبات بديلة', descEn: 'Redistribute tasks on breakdown' },
      { key: 'execute_breakdown_decision', nameAr: 'اتخاذ قرارات الأعطال', nameEn: 'Breakdown Governance', descAr: 'اعتماد قرارات التأجيل أو التوزيع عند الطوارئ', descEn: 'Decide breakdown handling flows' },
      { key: 'create_emergency_trip', nameEn: 'Create Emergency Trip', nameAr: 'إنشاء مشوار طارئ', descAr: 'إطلاق مشوار طارئ فوري لتفادي تعطل العمليات', descEn: 'Direct emergency trip dispatch' },
      { key: 'manage_vehicle_constraints', nameAr: 'إدارة قيود وصول المركبات', nameEn: 'Vehicle Access Rules', descAr: 'ضبط المناطق المحظورة والقيود الجغرافية للمركبات', descEn: 'Manage restricted zones and rules' },
      { key: 'execute_trip_tasks', nameAr: 'تنفيذ مهام السائق الميدانية', nameEn: 'Driver Field Portal', descAr: 'تأكيد إنجاز المهام ونقاط التسليم من الهاتف', descEn: 'Execute driver checklist tasks' },
    ]
  },
  {
    id: 'reports',
    nameAr: 'التقارير والتحليلات',
    nameEn: 'Reports & Business Analytics',
    descAr: 'الاطلاع على المؤشرات المالية والتشغيلية، كشوفات الحسابات، وتصدير الملفات',
    descEn: 'Access operational dashboards, financial summaries, and export data',
    icon: BarChart3,
    color: 'purple',
    badgeBg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20',
    badgeText: 'text-purple-600 dark:text-purple-400',
    permissions: [
      { key: 'view_reports', nameAr: 'عرض وتصدير التقارير المالية والإدارية', nameEn: 'View Financial & Operational Reports', descAr: 'الوصول إلى تقارير النفقات والعهد والأسطول وتصديرها', descEn: 'View and export analytics and summaries' },
    ]
  },
  {
    id: 'admin',
    nameAr: 'إدارة النظام والتحكم',
    nameEn: 'System Administration & Security',
    descAr: 'إدارة حسابات الموظفين، الفروع والمحطات، السياسات، الإعدادات العامة والأمان',
    descEn: 'Manage user profiles, organizational units, general settings, and governance',
    icon: Sliders,
    color: 'slate',
    badgeBg: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
    badgeText: 'text-slate-600 dark:text-slate-400',
    permissions: [
      { key: 'manage_users', nameAr: 'إدارة حسابات الموظفين', nameEn: 'Manage User Profiles', descAr: 'إنشاء حسابات المستخدمين وتعديل الصلاحيات', descEn: 'Manage employee accounts and roles' },
      { key: 'manage_roles', nameAr: 'إدارة مصفوفة الأدوار', nameEn: 'Manage Role Definitions', descAr: 'تخصيص حزم الصلاحيات الافتراضية لكل دور', descEn: 'Configure default role permission sets' },
      { key: 'manage_settings', nameAr: 'الإعدادات العامة والنسخ', nameEn: 'General Settings & Backups', descAr: 'تغيير إعدادات المؤسسة والنسخ الاحتياطي', descEn: 'Manage system settings and backups' },
      { key: 'manage_stations', nameAr: 'إدارة الفروع والمحطات', nameEn: 'Manage Branches & Stations', descAr: 'إضافة وتعديل بيانات الفروع والمحطات والمواقع', descEn: 'Manage physical branches and stations' },
      { key: 'manage_regions', nameAr: 'إدارة الأقاليم والمناطق', nameEn: 'Manage Geographical Regions', descAr: 'إدارة التقسيم الجغرافي والإقليمي للشركة', descEn: 'Manage company geographical regions' },
      { key: 'manage_companies', nameAr: 'إدارة الشركات (منصة SaaS)', nameEn: 'Manage Multi-Tenant Companies', descAr: 'إدارة شركات المنصة والاشتراكات (حصري للمنصة)', descEn: 'Manage tenant companies (Platform Admin only)', systemAdminOnly: true },
    ]
  }
];

export interface UnifiedAccessControlCenterProps {
  language: Language;
  theme: Theme;
  currentUser: AppUser;
  users: AppUser[];
  regions: Region[];
  stations: Station[];
  editingUserId: string | null;
  setEditingUserId: (v: string | null) => void;
  editUserFullName: string;
  setEditUserFullName: (v: string) => void;
  editUserRole: UserRole;
  editUserStationId: string;
  setEditUserStationId: (v: string) => void;
  editUserRegionId: string;
  setEditUserRegionId: (v: string) => void;
  editUserOrgUnitId: string;
  setEditUserOrgUnitId: (v: string) => void;
  editUserAssignedOrgUnitIds: string[];
  setEditUserAssignedOrgUnitIds: (v: string[]) => void;
  editUserPermissions: UserPermissions;
  setEditUserPermissions: (v: UserPermissions) => void;
  editUserIsDefaultMode: boolean;
  handleEditUserRoleChange: (role: UserRole) => void;
  handleEditUserToggleMode: (useDefault: boolean) => void;
  handleSaveEditUser: (id: string) => void;
  handleDeleteUser: (id: string) => void;
  handleStartEditUser: (u: AppUser) => void;
  newUserName: string;
  setNewUserName: (v: string) => void;
  newUserEmail: string;
  setNewUserEmail: (v: string) => void;
  newUserRole: UserRole;
  setNewUserRole: (v: UserRole) => void;
  newUserStationId: string;
  setNewUserStationId: (v: string) => void;
  newUserRegionId: string;
  setNewUserRegionId: (v: string) => void;
  newUserOrgUnitId: string;
  setNewUserOrgUnitId: (v: string) => void;
  newUserAssignedOrgUnitIds: string[];
  setNewUserAssignedOrgUnitIds: (v: string[]) => void;
  handleAddUser: (e: React.FormEvent) => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  setUsers: (users: AppUser[]) => void;
  triggerToast: (msg: string) => void;
}

export default function UnifiedAccessControlCenter({
  language,
  theme,
  currentUser,
  users,
  regions,
  stations,
  editingUserId,
  setEditingUserId,
  editUserFullName,
  setEditUserFullName,
  editUserRole,
  editUserStationId,
  setEditUserStationId,
  editUserRegionId,
  setEditUserRegionId,
  editUserOrgUnitId,
  setEditUserOrgUnitId,
  editUserAssignedOrgUnitIds,
  setEditUserAssignedOrgUnitIds,
  editUserPermissions,
  setEditUserPermissions,
  editUserIsDefaultMode,
  handleEditUserRoleChange,
  handleEditUserToggleMode,
  handleSaveEditUser,
  handleDeleteUser,
  handleStartEditUser,
  newUserName,
  setNewUserName,
  newUserEmail,
  setNewUserEmail,
  newUserRole,
  setNewUserRole,
  newUserStationId,
  setNewUserStationId,
  newUserRegionId,
  setNewUserRegionId,
  newUserOrgUnitId,
  setNewUserOrgUnitId,
  newUserAssignedOrgUnitIds,
  setNewUserAssignedOrgUnitIds,
  handleAddUser,
  getAuthHeaders,
  setUsers,
  triggerToast
}: UnifiedAccessControlCenterProps) {
  const isRtl = language === 'ar';

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [showNewUserModal, setShowNewUserModal] = useState(false);

  const effectiveCompanyId = currentUser.role === 'SystemAdmin'
    ? (CustodyDB.getSelectedCompanyId() || currentUser.company_id || 'comp-sewedy-mfg')
    : (currentUser.company_id || CustodyDB.getSelectedCompanyId() || 'comp-sewedy-mfg');

  const companyOrgUnits = useMemo(() => {
    return OrganizationEngine.getOrganizationUnits(effectiveCompanyId);
  }, [effectiveCompanyId]);

  // Check if current user can manage users
  const canManageUsers = useMemo(() => {
    return currentUser.role === 'SystemAdmin' || 
           currentUser.role === 'Admin' || 
           !!currentUser.permissions?.manage_users || 
           !!currentUser.permissions?.manage_roles;
  }, [currentUser]);

  // Helper: check what modules a user has active
  const getUserActiveModules = (user: AppUser) => {
    const p = user.permissions || CustodyDB.enrichUserPermissions(user.role);
    const activeMods: { id: string; nameAr: string; nameEn: string; icon: any; color: string; badgeBg: string }[] = [];

    const hasCustody = !!(p.create_expense || p.edit_expense || p.delete_expense || p.create_custody || p.edit_custody || p.replace_custody);
    if (hasCustody) {
      activeMods.push({ id: 'custody', nameAr: 'العهد والمصروفات', nameEn: 'Custody & Expenses', icon: Receipt, color: 'emerald', badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' });
    }

    const hasVouchers = !!(p.create_voucher || p.approve_voucher || p.reject_voucher || p.settle_voucher);
    if (hasVouchers) {
      activeMods.push({ id: 'vouchers', nameAr: 'سندات الصرف', nameEn: 'Vouchers', icon: FileText, color: 'blue', badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' });
    }

    const hasFleet = !!(p.manage_fleet || p.create_trip || p.approve_trip || p.dispatch_trip || p.reassign_vehicle || p.execute_breakdown_decision || p.create_emergency_trip || p.manage_vehicle_constraints || p.execute_trip_tasks);
    if (hasFleet) {
      activeMods.push({ id: 'fleet', nameAr: 'الأسطول والحركة', nameEn: 'Fleet', icon: Car, color: 'amber', badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' });
    }

    const hasReports = !!p.view_reports;
    if (hasReports) {
      activeMods.push({ id: 'reports', nameAr: 'التقارير', nameEn: 'Reports', icon: BarChart3, color: 'purple', badgeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' });
    }

    const hasAdmin = !!(p.manage_users || p.manage_roles || p.manage_settings || p.manage_stations || p.manage_regions || p.manage_companies);
    if (hasAdmin) {
      activeMods.push({ id: 'admin', nameAr: 'الإدارة', nameEn: 'Admin', icon: Sliders, color: 'slate', badgeBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20' });
    }

    return activeMods;
  };

  // Helper: get branch name for a user
  const getUserBranchLabel = (user: AppUser) => {
    if (user.role === 'SystemAdmin') {
      return { text: isRtl ? '🌐 كامل المنصة' : '🌐 Platform Scope', isAll: true };
    }
    if (user.role === 'Admin' && !user.org_unit_id) {
      return { text: isRtl ? '🏢 كامل نطاق الشركة' : '🏢 Company-wide Scope', isAll: true };
    }

    if (user.org_unit_id) {
      const matchUnit = companyOrgUnits.find(u => u.id === user.org_unit_id);
      if (matchUnit) {
        return { text: isRtl ? (matchUnit.nameAr || matchUnit.name) : (matchUnit.nameEn || matchUnit.name), isAll: false };
      }
    }

    if (user.assigned_org_unit_ids && user.assigned_org_unit_ids.length > 0) {
      const first = companyOrgUnits.find(u => u.id === user.assigned_org_unit_ids![0]);
      const count = user.assigned_org_unit_ids.length;
      if (count === 1 && first) {
        return { text: isRtl ? (first.nameAr || first.name) : (first.nameEn || first.name), isAll: false };
      }
      return { text: isRtl ? `${count} فروع مخصصة` : `${count} Assigned Branches`, isAll: false };
    }

    if (user.station_id) {
      const stn = stations.find(s => s.id === user.station_id);
      if (stn) return { text: stn.station_name, isAll: false };
    }

    if (user.region_id) {
      const reg = regions.find(r => r.id === user.region_id);
      if (reg) return { text: reg.name, isAll: false };
    }

    return { text: isRtl ? '⚠️ غير مخصص لفرع' : '⚠️ Unassigned Scope', isAll: false, isWarning: true };
  };

  // Filter users list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (u.is_active === false) return false;

      // Search match
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = u.full_name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesRole = u.role?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesRole) return false;
      }

      // Role filter
      if (roleFilter !== 'ALL' && u.role !== roleFilter) {
        return false;
      }

      // Branch filter
      if (branchFilter !== 'ALL') {
        if (u.org_unit_id !== branchFilter && (!u.assigned_org_unit_ids || !u.assigned_org_unit_ids.includes(branchFilter))) {
          return false;
        }
      }

      // Module filter
      if (moduleFilter !== 'ALL') {
        const activeMods = getUserActiveModules(u);
        if (!activeMods.some(m => m.id === moduleFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [users, searchTerm, roleFilter, moduleFilter, branchFilter, companyOrgUnits]);

  // Master module toggle helper inside edit mode
  const handleToggleModuleCategory = (category: ModuleCategoryConfig, enable: boolean) => {
    const updated = { ...editUserPermissions };
    category.permissions.forEach(p => {
      if (!p.systemAdminOnly || currentUser.role === 'SystemAdmin') {
        updated[p.key] = enable;
      }
    });
    setEditUserPermissions(updated);
    if (editUserIsDefaultMode) {
      handleEditUserToggleMode(false);
    }
  };

  // Check if a category is fully or partially enabled in edit mode
  const getCategoryStatusInEdit = (category: ModuleCategoryConfig) => {
    const applicable = category.permissions.filter(p => !p.systemAdminOnly || currentUser.role === 'SystemAdmin');
    const enabledCount = applicable.filter(p => !!editUserPermissions[p.key]).length;
    const totalCount = applicable.length;

    return {
      allEnabled: enabledCount === totalCount && totalCount > 0,
      noneEnabled: enabledCount === 0,
      partiallyEnabled: enabledCount > 0 && enabledCount < totalCount,
      enabledCount,
      totalCount
    };
  };

  const activeEditingUser = useMemo(() => {
    if (!editingUserId) return null;
    return users.find(u => u.id === editingUserId) || null;
  }, [editingUserId, users]);

  return (
    <div className="space-y-6 animate-fade-in" id="unified-access-control-center">
      {/* Top Banner / Scope Summary Header */}
      <div className={`p-5 rounded-2xl border ${
        theme === 'dark' 
          ? 'bg-slate-900/90 border-slate-800 shadow-xl' 
          : 'bg-gradient-to-r from-indigo-50/70 via-white to-sky-50/70 border-indigo-100 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/30">
                <ShieldCheck size={20} />
              </div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                {isRtl ? 'إدارة الصلاحيات والوصول الموحدة (شخص × فرع × موديول)' : 'Unified Access Control & Scope Management'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {isRtl 
                ? 'لوحة موحدة لضبط نطاق الفروع والمحطات، تخصيص الصلاحيات الفردية، وتفعيل موديولات النظام بدقة لكل موظف.' 
                : 'Centralized governance hub to assign branch scopes, customize fine-grained authority, and toggle ERP modules per employee.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canManageUsers && (
              <button
                onClick={() => {
                  setEditingUserId(null);
                  setShowNewUserModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                id="btn-register-new-employee"
              >
                <UserPlus size={15} />
                <span>{isRtl ? '+ تسجيل موظف جديد' : '+ Register Employee'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Access Scope Status Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
            <span className="text-[11px] text-slate-400">{isRtl ? 'نطاق إشرافك الحالي:' : 'Your Active Scope:'}</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20">
              {currentUser.role === 'SystemAdmin' 
                ? (isRtl ? '🌐 منصة شاملة (كافة الشركات والفروع)' : '🌐 Platform Full Access (All Companies)') 
                : currentUser.role === 'Admin'
                ? (isRtl ? `🏢 أدمن الشركة (${effectiveCompanyId})` : `🏢 Company Admin (${effectiveCompanyId})`)
                : (isRtl ? '📍 مدير نطاق فروع محددة' : '📍 Scoped Branch Manager')}
            </span>
          </div>

          <div className="hidden sm:block text-slate-300 dark:text-slate-700">|</div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>{isRtl ? `الموظفون في النطاق: ${filteredUsers.length} من إجمالي ${users.length}` : `Employees in Scope: ${filteredUsers.length} of ${users.length}`}</span>
          </div>
        </div>
      </div>

      {/* Main Filter Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex-1 relative">
          <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث بالاسم، البريد الإلكتروني، أو الدور...' : 'Search by name, email, or role...'}
            className={`w-full py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            } ${
              theme === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${isRtl ? 'left-3' : 'right-3'}`}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <option value="ALL">{isRtl ? 'جميع الأدوار (All Roles)' : 'All Roles'}</option>
            {SYSTEM_ROLES.map(r => (
              <option key={r.id} value={r.id}>{isRtl ? r.labelAr : r.labelEn}</option>
            ))}
          </select>

          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <option value="ALL">{isRtl ? 'جميع الموديولات (All Modules)' : 'All Modules'}</option>
            <option value="custody">{isRtl ? '💰 العهد والمصروفات' : '💰 Custody & Expenses'}</option>
            <option value="vouchers">{isRtl ? '📄 سندات الصرف' : '📄 Cash Vouchers'}</option>
            <option value="fleet">{isRtl ? '🚗 الأسطول والمركبات' : '🚗 Fleet & Logistics'}</option>
            <option value="reports">{isRtl ? '📊 التقارير' : '📊 Reports'}</option>
            <option value="admin">{isRtl ? '⚙️ الإدارة والنظام' : '⚙️ Administration'}</option>
          </select>

          {/* Org Unit / Branch Filter */}
          {companyOrgUnits.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[180px] truncate ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="ALL">{isRtl ? 'جميع الفروع / الوحدات' : 'All Branches & Units'}</option>
              {companyOrgUnits.map(u => (
                <option key={u.id} value={u.id}>{isRtl ? (u.nameAr || u.name) : (u.nameEn || u.name)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Layout: List of Users + Editing Drawer / Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / User List Column */}
        <div className={editingUserId ? "lg:col-span-5 space-y-3" : "lg:col-span-12 space-y-3"}>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isRtl ? `قائمة الموظفين والوصول (${filteredUsers.length})` : `Employee Access Profiles (${filteredUsers.length})`}
            </span>
            {editingUserId && (
              <button
                onClick={() => setEditingUserId(null)}
                className="text-xs text-indigo-600 hover:text-indigo-500 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Eye size={13} />
                <span>{isRtl ? 'عرض كامل للشاشة' : 'Expand View'}</span>
              </button>
            )}
          </div>

          {filteredUsers.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${
              theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {isRtl ? 'لم يتم العثور على موظفين يطابقون خيارات البحث أو التصفية.' : 'No employees matching your search or filters.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isRtl ? 'جرب تغيير شروط البحث أو مسح التصفيات.' : 'Try changing search terms or clearing active filters.'}
              </p>
            </div>
          ) : (
            <div className={editingUserId ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"}>
              {filteredUsers.map((u) => {
                const isSelected = editingUserId === u.id;
                const activeMods = getUserActiveModules(u);
                const branchInfo = getUserBranchLabel(u);
                const roleDef = SYSTEM_ROLES.find(r => r.id === u.role);
                const userCanManageThis = UsersModule.canUserManageTargetUser(currentUser, u).allowed;

                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-2xl border transition-all relative flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                        : theme === 'dark'
                        ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div>
                      {/* User Identity Header */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm ${
                            roleDef?.bgClass || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {u.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {u.id === currentUser.id && (
                                <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded font-mono">
                                  {isRtl ? 'حسابك' : 'You'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block">{u.email}</span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black shrink-0 ${roleDef?.bgClass || 'bg-slate-100 text-slate-600'}`}>
                          {roleDef ? (isRtl ? roleDef.labelAr : roleDef.labelEn) : u.role}
                        </span>
                      </div>

                      {/* Branch / Scope Badge */}
                      <div className="flex items-center gap-1.5 text-[11px] mb-3">
                        <MapPin size={12} className={branchInfo.isWarning ? "text-amber-500 shrink-0" : "text-sky-500 shrink-0"} />
                        <span className={`font-semibold ${
                          branchInfo.isWarning 
                            ? 'text-amber-600 dark:text-amber-400' 
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {branchInfo.text}
                        </span>
                      </div>

                      {/* Active Modules Pills (شخص × فرع × موديول) */}
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          {isRtl ? 'الموديولات المفعّلة للموظف:' : 'Active Enabled Modules:'}
                        </span>

                        {activeMods.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md font-semibold border border-rose-500/15">
                            <AlertTriangle size={10} />
                            {isRtl ? 'لا توجد موديولات مفعّلة' : 'No Modules Enabled'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {activeMods.map(m => {
                              const IconComponent = m.icon;
                              return (
                                <span
                                  key={m.id}
                                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold border ${m.badgeBg}`}
                                >
                                  <IconComponent size={10} />
                                  <span>{isRtl ? m.nameAr : m.nameEn}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleStartEditUser(u)}
                        disabled={!userCanManageThis}
                        className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : userCanManageThis
                            ? 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400'
                            : 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        <Edit2 size={12} />
                        <span>{isRtl ? 'تعديل الصلاحيات والنطاق' : 'Edit Scope & Authority'}</span>
                      </button>

                      {currentUser.role === 'SystemAdmin' && u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                          title={isRtl ? 'حذف الحساب' : 'Delete user profile'}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right / Edit Mode Workspace (شخص × فرع × موديول) */}
        {editingUserId && activeEditingUser && (
          <div className="lg:col-span-7 sticky top-4 space-y-4 animate-fade-in" id="unified-editor-panel">
            <div className={`p-5 rounded-2xl border shadow-lg ${
              theme === 'dark' ? 'bg-slate-900 border-indigo-500/30' : 'bg-white border-indigo-200'
            }`}>
              {/* Editor Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black text-xs">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      {isRtl ? `تخصيص صلاحيات ونطاق: ${activeEditingUser.full_name}` : `Customizing Access: ${activeEditingUser.full_name}`}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">{activeEditingUser.email}</span>
                  </div>
                </div>

                <button
                  onClick={() => setEditingUserId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 pt-3.5">
                {/* 1. Identity & Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {isRtl ? 'الاسم بالكامل' : 'Full Name'}
                    </label>
                    <input
                      type="text"
                      value={editUserFullName}
                      onChange={(e) => setEditUserFullName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {isRtl ? 'الدور الوظيفي' : 'System Role'}
                    </label>
                    <select
                      value={editUserRole}
                      onChange={(e) => handleEditUserRoleChange(e.target.value as UserRole)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      {SYSTEM_ROLES.filter(r => !r.systemAdminOnly || currentUser.role === 'SystemAdmin').map(r => (
                        <option key={r.id} value={r.id}>{isRtl ? r.labelAr : r.labelEn}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Organizational Scope (نطاق الفرع والمحطة) */}
                <div className={`p-3.5 rounded-xl border ${
                  theme === 'dark' ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                }`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 size={13} className="text-indigo-500" />
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                      {isRtl ? 'نطاق الإشراف الجغرافي والهيكلي (الفرع / المحطة):' : 'Supervisory Branch / Station Scope (Tree):'}
                    </label>
                  </div>

                  <OrgUnitTreeSelect
                    companyId={activeEditingUser.company_id || effectiveCompanyId}
                    value={editUserOrgUnitId}
                    onChange={(unitId) => setEditUserOrgUnitId(unitId)}
                    mode="single"
                    isRtl={isRtl}
                    theme={theme}
                    showInheritanceSummary={true}
                    placeholder={isRtl ? 'اختر الفرع أو المحطة أو القطاع المسؤول عنه...' : 'Select assigned Branch, Station, or Sector...'}
                  />

                  {/* Fallback Legacy bindings if needed */}
                  {editUserRole === 'StationAdmin' && !editUserOrgUnitId && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        {isRtl ? 'ربط مباشر بالمحطة (إرث):' : 'Direct Station Mapping (Legacy):'}
                      </label>
                      <select
                        value={editUserStationId}
                        onChange={(e) => setEditUserStationId(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                          theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <option value="">{isRtl ? 'بدون محطة' : 'Unmapped'}</option>
                        {stations.map(s => (
                          <option key={s.id} value={s.id}>{s.station_name} ({s.station_code})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editUserRole === 'RegionalManager' && !editUserOrgUnitId && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        {isRtl ? 'ربط بالمنطقة الجغرافية (إرث):' : 'Direct Region Mapping (Legacy):'}
                      </label>
                      <select
                        value={editUserRegionId}
                        onChange={(e) => setEditUserRegionId(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                          theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <option value="">{isRtl ? 'بدون منطقة' : 'Unmapped'}</option>
                        {regions.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 3. Modules & Fine-Grained Permissions Mode Switcher */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      {isRtl ? 'الموديولات والصلاحيات الدقيقة:' : 'Modules & Granular Permissions:'}
                    </span>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => handleEditUserToggleMode(true)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          editUserIsDefaultMode
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {isRtl ? 'الافتراضية للدور' : 'Role Defaults'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditUserToggleMode(false)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          !editUserIsDefaultMode
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {isRtl ? 'تخصيص يدوي' : 'Custom Individual'}
                      </button>
                    </div>
                  </div>

                  {/* Modular Cards Grouping */}
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {MODULE_CATEGORIES.map((cat) => {
                      const IconComp = cat.icon;
                      const catStatus = getCategoryStatusInEdit(cat);

                      return (
                        <div
                          key={cat.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            catStatus.allEnabled
                              ? 'border-indigo-500/40 bg-indigo-500/5'
                              : catStatus.partiallyEnabled
                              ? 'border-amber-500/30 bg-amber-500/5'
                              : theme === 'dark'
                              ? 'bg-slate-800/20 border-slate-800'
                              : 'bg-slate-50/50 border-slate-200'
                          }`}
                        >
                          {/* Module Header & Master Toggle */}
                          <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg border ${cat.badgeBg}`}>
                                <IconComp size={14} />
                              </div>
                              <div>
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                                  {isRtl ? cat.nameAr : cat.nameEn}
                                </span>
                                <span className="text-[10px] text-slate-400 block line-clamp-1">
                                  {isRtl ? cat.descAr : cat.descEn}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                catStatus.allEnabled
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : catStatus.partiallyEnabled
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                              }`}>
                                {catStatus.enabledCount} / {catStatus.totalCount}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleToggleModuleCategory(cat, !catStatus.allEnabled)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                  catStatus.allEnabled
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white'
                                }`}
                              >
                                {catStatus.allEnabled ? (isRtl ? 'مفعّل' : 'Active') : (isRtl ? 'تمكين الكل' : 'Enable All')}
                              </button>
                            </div>
                          </div>

                          {/* Fine-grained permissions checkboxes */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {cat.permissions.filter(p => !p.systemAdminOnly || currentUser.role === 'SystemAdmin').map((perm) => {
                              const isChecked = !!editUserPermissions[perm.key];

                              return (
                                <label
                                  key={perm.key}
                                  className={`flex items-start gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                                    isChecked
                                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40 text-slate-800 dark:text-slate-200'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setEditUserPermissions({
                                        ...editUserPermissions,
                                        [perm.key]: e.target.checked
                                      });
                                      if (editUserIsDefaultMode) {
                                        handleEditUserToggleMode(false);
                                      }
                                    }}
                                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 shrink-0"
                                  />
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-[11px] block leading-tight">
                                      {isRtl ? perm.nameAr : perm.nameEn}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block leading-tight">
                                      {isRtl ? perm.descAr : perm.descEn}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Live Impact Summary Bar */}
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Info size={15} className="text-indigo-600 shrink-0" />
                    <span className="text-indigo-900 dark:text-indigo-300 font-semibold text-[11px]">
                      {isRtl ? 'ملخص الإسناد: سيتم تحديث صلاحيات الموظف على مستوى الفروع والموديولات المحددة فوراً.' : 'Summary: User authority across assigned branches and modules will apply immediately.'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingUserId(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveEditUser(activeEditingUser.id)}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                    id="btn-save-user-access"
                  >
                    <Check size={14} />
                    <span>{isRtl ? 'حفظ الصلاحيات والنطاق' : 'Save Access Profile'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New User Register Modal (if triggered) */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg p-5 rounded-2xl border shadow-2xl space-y-4 ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  <UserPlus size={16} />
                </div>
                <h3 className="font-black text-sm">
                  {isRtl ? 'تسجيل وتعيين موظف جديد' : 'Register & Provision New Employee'}
                </h3>
              </div>

              <button
                onClick={() => setShowNewUserModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              await handleAddUser(e);
              setShowNewUserModal(false);
            }} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">{isRtl ? 'الاسم بالكامل:' : 'Full Name:'}</label>
                <input
                  type="text"
                  required
                  placeholder={isRtl ? 'الاسم الثلاثي للموظف' : 'Employee Full Name'}
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">{isRtl ? 'البريد الإلكتروني:' : 'Email Address:'}</label>
                <input
                  type="email"
                  required
                  placeholder="user@company.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">{isRtl ? 'الدور الوظيفي:' : 'System Role:'}</label>
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800/50">
                  {SYSTEM_ROLES.filter(r => !r.systemAdminOnly || currentUser.role === 'SystemAdmin').map(r => (
                    <label key={r.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="modalUserRole"
                        checked={newUserRole === r.id}
                        onChange={() => setNewUserRole(r.id)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`text-[11px] font-bold ${r.colorClass}`}>{isRtl ? r.labelAr : r.labelEn}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-500 font-bold mb-1">
                  {isRtl ? 'نطاق الفرع / المحطة (الشجرة التنظيمية):' : 'Supervisory Scope (Organization Tree):'}
                </label>
                <OrgUnitTreeSelect
                  companyId={effectiveCompanyId}
                  value={newUserOrgUnitId}
                  onChange={(unitId) => setNewUserOrgUnitId(unitId)}
                  mode="single"
                  isRtl={isRtl}
                  theme={theme}
                  showInheritanceSummary={true}
                  placeholder={isRtl ? 'اختر الفرع أو المحطة التابع لها...' : 'Select assigned Branch or Station...'}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 rounded-xl border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md shadow-indigo-600/20"
                >
                  {isRtl ? 'إنشاء وتعميم الصلاحيات' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
