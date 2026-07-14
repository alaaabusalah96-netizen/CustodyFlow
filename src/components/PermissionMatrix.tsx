import React, { useState, useEffect } from 'react';
import { CustodyDB, ERP_MODULES_REGISTRY } from '../db';
import { SystemRole, UserPermissions } from '../types';
import { 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Copy, 
  Check, 
  RotateCcw, 
  ChevronRight, 
  ShieldAlert,
  Info
} from 'lucide-react';

interface PermissionMatrixProps {
  language: 'en' | 'ar';
  theme: 'light' | 'dark';
}

interface ScreenPermissionMapping {
  screenId: string;
  name_en: string;
  name_ar: string;
  module: string;
  permissions: {
    view?: keyof UserPermissions;
    create?: keyof UserPermissions;
    edit?: keyof UserPermissions;
    delete?: keyof UserPermissions;
    approve?: keyof UserPermissions;
    settle?: keyof UserPermissions;
    manage?: keyof UserPermissions;
  }
}

const STATIC_SCREEN_MAPPINGS: ScreenPermissionMapping[] = [
  {
    screenId: 'dashboard',
    name_en: 'Dashboard',
    name_ar: 'لوحة التحكم والمؤشرات',
    module: 'core',
    permissions: {}
  },
  {
    screenId: 'new-expense',
    name_en: 'Expenses Entry',
    name_ar: 'تسجيل المصروفات والعهد',
    module: 'custody',
    permissions: {
      create: 'create_expense',
      edit: 'edit_expense',
      delete: 'delete_expense'
    }
  },
  {
    screenId: 'voucher',
    name_en: 'Cash Vouchers',
    name_ar: 'مستندات وطلبات الصرف',
    module: 'custody',
    permissions: {
      create: 'create_voucher',
      approve: 'approve_voucher'
    }
  },
  {
    screenId: 'settled',
    name_en: 'Settlements & Replenishment',
    name_ar: 'استعاضة وتسويات العهد',
    module: 'custody',
    permissions: {
      create: 'replace_custody'
    }
  },
  {
    screenId: 'reconciliation',
    name_en: 'Cash Reconciliation',
    name_ar: 'المطابقات والجرد اليومي',
    module: 'custody',
    permissions: {
      settle: 'settle_voucher'
    }
  },
  {
    screenId: 'reports',
    name_en: 'Financial Reports',
    name_ar: 'التقارير المالية والتحليلات',
    module: 'reports',
    permissions: {
      view: 'view_reports'
    }
  },
  {
    screenId: 'settings',
    name_en: 'System Settings',
    name_ar: 'إعدادات النظام والمحددات',
    module: 'core',
    permissions: {
      manage: 'manage_settings'
    }
  },
  {
    screenId: 'inventory',
    name_en: 'Inventory Management',
    name_ar: 'إدارة المخازن وحركة المخزون',
    module: 'inventory',
    permissions: {
      view: 'view_reports',
      create: 'create_expense',
      edit: 'edit_expense',
      delete: 'delete_expense'
    }
  }
];

const COLUMNS: { key: keyof ScreenPermissionMapping['permissions']; label_en: string; label_ar: string }[] = [
  { key: 'view', label_en: 'View', label_ar: 'عرض' },
  { key: 'create', label_en: 'Create', label_ar: 'إنشاء' },
  { key: 'edit', label_en: 'Edit', label_ar: 'تعديل' },
  { key: 'delete', label_en: 'Delete', label_ar: 'حذف' },
  { key: 'approve', label_en: 'Approve', label_ar: 'اعتماد' },
  { key: 'settle', label_en: 'Settle', label_ar: 'تسوية' },
  { key: 'manage', label_en: 'Manage', label_ar: 'إدارة' }
];

export default function PermissionMatrix({ language, theme }: PermissionMatrixProps) {
  const isRtl = language === 'ar';

  // Core States
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('StationAdmin');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [copySourceRoleId, setCopySourceRoleId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Loaded Screen Mappings (Static + Dynamic expansion)
  const [screens, setScreens] = useState<ScreenPermissionMapping[]>([]);

  useEffect(() => {
    // 1. Load roles
    const dbRoles = CustodyDB.getRoles();
    setRoles(dbRoles);

    // 2. Build Screen mappings with dynamic expansion from ERP_MODULES_REGISTRY
    const combined = [...STATIC_SCREEN_MAPPINGS];
    ERP_MODULES_REGISTRY.forEach(mod => {
      mod.screens.forEach(scr => {
        if (!combined.some(item => item.screenId === scr)) {
          const formattedName = scr.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          combined.push({
            screenId: scr,
            name_en: `${formattedName} (Dynamic)`,
            name_ar: `${mod.name_ar} - ${formattedName}`,
            module: mod.id,
            permissions: {
              view: 'view_reports',
              create: 'create_expense',
              edit: 'edit_expense',
              delete: 'delete_expense'
            }
          });
        }
      });
    });
    setScreens(combined);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const getActiveRole = (): SystemRole | undefined => {
    return roles.find(r => r.id === selectedRoleId);
  };

  const handleToggleCell = (screenId: string, actionKey: keyof ScreenPermissionMapping['permissions']) => {
    const role = getActiveRole();
    if (!role) return;

    const screen = screens.find(s => s.screenId === screenId);
    if (!screen) return;

    const permissionKey = screen.permissions[actionKey];
    if (!permissionKey) return; // Action not applicable to this screen

    const currentPermissions = { ...role.permissions };
    const currentVal = !!currentPermissions[permissionKey];

    // Toggle
    currentPermissions[permissionKey] = !currentVal;

    // Save
    const updatedRole = { ...role, permissions: currentPermissions };
    CustodyDB.saveRole(updatedRole);
    
    // Refresh local state
    setRoles(CustodyDB.getRoles());
    triggerToast(isRtl ? 'تم تحديث الصلاحية فورياً ومزامنتها سحابياً.' : 'Permission synced securely.');
  };

  // Helper to check if a permission is enabled for the active role
  const isCellChecked = (screenId: string, actionKey: keyof ScreenPermissionMapping['permissions']): boolean => {
    const role = getActiveRole();
    if (!role) return false;

    const screen = screens.find(s => s.screenId === screenId);
    if (!screen) return false;

    const permissionKey = screen.permissions[actionKey];
    if (!permissionKey) return false;

    return !!role.permissions[permissionKey];
  };

  // Check if an action is applicable for a screen
  const isActionApplicable = (screenId: string, actionKey: keyof ScreenPermissionMapping['permissions']): boolean => {
    const screen = screens.find(s => s.screenId === screenId);
    return !!(screen && screen.permissions[actionKey]);
  };

  // Dynamic Row Filtering
  const filteredScreens = screens.filter(s => {
    // Search filter
    const matchesSearch = 
      s.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name_ar.includes(searchQuery) ||
      s.screenId.toLowerCase().includes(searchQuery.toLowerCase());

    // Module filter
    const matchesModule = moduleFilter === 'all' || s.module === moduleFilter;

    return matchesSearch && matchesModule;
  });

  // Action: Select Row (Check all applicable permissions in this row)
  const handleSelectRow = (screenId: string) => {
    const role = getActiveRole();
    if (!role) return;

    const screen = screens.find(s => s.screenId === screenId);
    if (!screen) return;

    const currentPermissions = { ...role.permissions };
    let changed = false;

    COLUMNS.forEach(col => {
      const permKey = screen.permissions[col.key];
      if (permKey && !currentPermissions[permKey]) {
        currentPermissions[permKey] = true;
        changed = true;
      }
    });

    if (changed) {
      const updatedRole = { ...role, permissions: currentPermissions };
      CustodyDB.saveRole(updatedRole);
      setRoles(CustodyDB.getRoles());
      triggerToast(isRtl ? 'تم تفعيل جميع صلاحيات الصف المحددة.' : 'Row permissions enabled.');
    }
  };

  // Action: Select Column (Check this permission across all applicable screens)
  const handleSelectColumn = (actionKey: keyof ScreenPermissionMapping['permissions']) => {
    const role = getActiveRole();
    if (!role) return;

    const currentPermissions = { ...role.permissions };
    let changed = false;

    filteredScreens.forEach(screen => {
      const permKey = screen.permissions[actionKey];
      if (permKey && !currentPermissions[permKey]) {
        currentPermissions[permKey] = true;
        changed = true;
      }
    });

    if (changed) {
      const updatedRole = { ...role, permissions: currentPermissions };
      CustodyDB.saveRole(updatedRole);
      setRoles(CustodyDB.getRoles());
      triggerToast(isRtl ? 'تم تفعيل صلاحية العمود لكافة الشاشات المفلترة.' : 'Column permissions enabled.');
    }
  };

  // Action: Select All (Check all applicable checkboxes in the matrix)
  const handleSelectAll = () => {
    const role = getActiveRole();
    if (!role) return;

    const currentPermissions = { ...role.permissions };
    let changed = false;

    filteredScreens.forEach(screen => {
      COLUMNS.forEach(col => {
        const permKey = screen.permissions[col.key];
        if (permKey && !currentPermissions[permKey]) {
          currentPermissions[permKey] = true;
          changed = true;
        }
      });
    });

    if (changed) {
      const updatedRole = { ...role, permissions: currentPermissions };
      CustodyDB.saveRole(updatedRole);
      setRoles(CustodyDB.getRoles());
      triggerToast(isRtl ? 'تم تفعيل مصفوفة الصلاحيات بالكامل!' : 'All applicable privileges activated!');
    }
  };

  // Action: Clear All (Uncheck all checkboxes in the matrix)
  const handleClearAll = () => {
    const role = getActiveRole();
    if (!role) return;

    const currentPermissions = { ...role.permissions };
    let changed = false;

    filteredScreens.forEach(screen => {
      COLUMNS.forEach(col => {
        const permKey = screen.permissions[col.key];
        if (permKey && currentPermissions[permKey]) {
          currentPermissions[permKey] = false;
          changed = true;
        }
      });
    });

    if (changed) {
      const updatedRole = { ...role, permissions: currentPermissions };
      CustodyDB.saveRole(updatedRole);
      setRoles(CustodyDB.getRoles());
      triggerToast(isRtl ? 'تم إلغاء تفعيل مصفوفة الصلاحيات بالكامل.' : 'All matrix selections cleared.');
    }
  };

  // Action: Copy Permissions Between Roles
  const handleCopyPermissions = () => {
    if (!copySourceRoleId) {
      alert(isRtl ? 'يرجى تحديد دور المصدر للنسخ منه.' : 'Please select a source role.');
      return;
    }
    if (copySourceRoleId === selectedRoleId) {
      alert(isRtl ? 'لا يمكن نسخ الصلاحيات لنفس الدور!' : 'Source and target roles cannot be identical!');
      return;
    }

    const sourceRole = roles.find(r => r.id === copySourceRoleId);
    const targetRole = getActiveRole();

    if (!sourceRole || !targetRole) return;

    const confirmed = confirm(
      isRtl 
        ? `هل أنت متأكد من نسخ صلاحيات دور (${isRtl ? sourceRole.name_ar : sourceRole.name_en}) إلى دور (${isRtl ? targetRole.name_ar : targetRole.name_en})؟ سيقوم هذا باستبدال الصلاحيات الحالية.` 
        : `Are you sure you want to duplicate permissions from ${sourceRole.name_en} to ${targetRole.name_en}? This will overwrite active configurations.`
    );

    if (!confirmed) return;

    const updatedRole = {
      ...targetRole,
      permissions: { ...sourceRole.permissions }
    };

    CustodyDB.saveRole(updatedRole);
    setRoles(CustodyDB.getRoles());
    triggerToast(isRtl ? 'تم نسخ الصلاحيات وتعميمها بنجاح!' : 'Permissions copied successfully!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2 shadow-lg backdrop-blur-md">
          <Check size={14} className="text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Control Panel Card */}
      <div className={`p-5 rounded-2xl border ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Role Selector */}
          <div className="flex-1 space-y-1">
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
              {isRtl ? '1. اختر الدور الوظيفي للتعديل:' : '1. Target Role & Profile:'}
            </label>
            <div className="flex flex-wrap gap-2">
              {roles.filter(r => r.id !== 'SystemAdmin').map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                    selectedRoleId === role.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : theme === 'dark'
                        ? 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ChevronRight size={12} className={`transition-transform ${selectedRoleId === role.id ? 'rotate-90' : ''}`} />
                  {isRtl ? role.name_ar : role.name_en}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Copy Engine */}
          <div className="p-3.5 rounded-xl bg-indigo-50/10 dark:bg-slate-800/40 border border-indigo-500/10 flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <div className="text-[11px] font-black text-slate-400">{isRtl ? 'نسخ الصلاحيات بالكامل:' : 'Clone Permissions:'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isRtl ? 'مضاعفة نموذج صلاحية ودمجه مع دور آخر' : 'Duplicate profile setup directly'}</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={copySourceRoleId}
                onChange={(e) => setCopySourceRoleId(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                }`}
              >
                <option value="">{isRtl ? 'اختر الدور المصدر...' : 'Select Source...'}</option>
                {roles.filter(r => r.id !== selectedRoleId).map(r => (
                  <option key={r.id} value={r.id}>{isRtl ? r.name_ar : r.name_en}</option>
                ))}
              </select>
              <button
                onClick={handleCopyPermissions}
                disabled={!copySourceRoleId}
                className={`p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer flex items-center gap-1 text-[11px] font-black ${
                  !copySourceRoleId ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Copy size={13} />
                <span>{isRtl ? 'نسخ وتطبيق' : 'Copy'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Dynamic Search, Filter, and Bulk controls */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        theme === 'dark' ? 'bg-[#1e293b]/60 border-[#334155]' : 'bg-slate-50 border-slate-200'
      }`}>
        {/* Search & Filter Inputs */}
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={isRtl ? 'البحث عن شاشة أو واجهة...' : 'Search screens...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
              }`}
            />
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
            <Filter size={14} className="text-slate-400" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
              }`}
            >
              <option value="all">{isRtl ? 'تصفية حسب كافة الأقسام' : 'All Modules'}</option>
              <option value="core">{isRtl ? 'النظام والتحكم (Core)' : 'Core Platform'}</option>
              <option value="custody">{isRtl ? 'قسم العهد النقدية (Custody)' : 'Custody'}</option>
              <option value="reports">{isRtl ? 'قسم التقارير والتحليل (Reports)' : 'Reports'}</option>
              <option value="inventory">{isRtl ? 'إدارة المخازن (Inventory)' : 'Inventory'}</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSelectAll}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1 border border-indigo-500/10"
          >
            <CheckSquare size={12} />
            <span>{isRtl ? 'تفعيل الكل' : 'Select All'}</span>
          </button>
          <button
            onClick={handleClearAll}
            className="px-2.5 py-1.5 rounded-lg bg-slate-500/15 hover:bg-slate-500/20 text-slate-600 dark:text-slate-400 font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1 border border-slate-500/10"
          >
            <RotateCcw size={12} />
            <span>{isRtl ? 'تفريغ المسودة' : 'Clear All'}</span>
          </button>
        </div>
      </div>

      {/* Grid Table Matrix */}
      <div className={`border rounded-2xl overflow-hidden ${
        theme === 'dark' ? 'border-[#334155]' : 'border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}>
                <th className="p-3 text-[11px] font-black uppercase text-center w-48 border-b border-dashed border-slate-700">
                  {isRtl ? 'اسم الشاشة / الواجهة' : 'Screen / Interface'}
                </th>
                <th className="p-3 text-[11px] font-black uppercase text-center w-28 border-b border-dashed border-slate-700">
                  {isRtl ? 'القسم / الوحدة' : 'Module'}
                </th>
                
                {COLUMNS.map((col) => (
                  <th key={col.key} className="p-3 text-[11px] font-black uppercase text-center border-b border-dashed border-slate-700">
                    <div className="flex flex-col items-center gap-1">
                      <span>{isRtl ? col.label_ar : col.label_en}</span>
                      <button
                        onClick={() => handleSelectColumn(col.key)}
                        title={isRtl ? `تفعيل كامل عمود ${col.label_ar}` : `Enable entire ${col.label_en} column`}
                        className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/10"
                      >
                        ↓ {isRtl ? 'كل' : 'All'}
                      </button>
                    </div>
                  </th>
                ))}

                <th className="p-3 text-[11px] font-black uppercase text-center w-24 border-b border-dashed border-slate-700">
                  {isRtl ? 'تكامل سريع' : 'Bulk Select'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredScreens.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    {isRtl ? 'لا توجد نتائج مطابقة لمؤشرات البحث الحالية.' : 'No matching screens found.'}
                  </td>
                </tr>
              ) : (
                filteredScreens.map((screen) => (
                  <tr 
                    key={screen.screenId}
                    className={`transition-colors hover:bg-slate-500/5 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {/* Screen Label */}
                    <td className="p-3 font-semibold">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {isRtl ? screen.name_ar : screen.name_en}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          /{screen.screenId}
                        </span>
                      </div>
                    </td>

                    {/* Module Tag */}
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        screen.module === 'custody'
                          ? 'bg-amber-500/10 text-amber-500'
                          : screen.module === 'inventory'
                            ? 'bg-blue-500/10 text-blue-500'
                            : screen.module === 'reports'
                              ? 'bg-purple-500/10 text-purple-500'
                              : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {screen.module}
                      </span>
                    </td>

                    {/* Permission Cells */}
                    {COLUMNS.map((col) => {
                      const applicable = isActionApplicable(screen.screenId, col.key);
                      const checked = isCellChecked(screen.screenId, col.key);

                      return (
                        <td key={col.key} className="p-3 text-center border-x border-slate-100 dark:border-slate-800/20">
                          {applicable ? (
                            <button
                              onClick={() => handleToggleCell(screen.screenId, col.key)}
                              className="mx-auto flex items-center justify-center p-1 rounded-lg transition-all text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/5"
                            >
                              {checked ? (
                                <CheckSquare size={16} className="text-indigo-500" />
                              ) : (
                                <Square size={16} className="opacity-40" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-mono text-[10px]">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Select Row Button */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleSelectRow(screen.screenId)}
                        className="px-2 py-1 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-indigo-600 hover:text-white transition-all text-[9px] font-extrabold flex items-center justify-center gap-0.5 mx-auto border border-slate-500/10"
                      >
                        <span>{isRtl ? 'تفويض ➔' : 'Authorize ➔'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Notice card */}
      <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
        theme === 'dark' ? 'bg-[#1e293b]/40 border-[#334155]/60 text-slate-300' : 'bg-indigo-50/30 border-indigo-100 text-slate-600'
      }`}>
        <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">{isRtl ? '💡 حوكمة الصلاحيات وإدارة الأمن اللامركزي:' : '💡 Enterprise Governance & Permission Matrix Rules:'}</p>
          <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
            {isRtl 
              ? 'تعتمد هذه المصفوفة كمنظم صلاحيات ديناميكي. يتم دمج وتطبيق الصلاحيات المعدلة هنا على جميع الموظفين التابعين للدور الوظيفي بشكل فوري، وتخضع حسابات أدمن النظام لقواعد عزل الشركات الصارمة.'
              : 'This matrix operates as a dynamic, decentralized security model. Custom privileges set here apply instantly to all corresponding employees under that specific job profile across corporate workspaces.'}
          </p>
        </div>
      </div>
    </div>
  );
}
