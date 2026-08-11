import React from 'react';
import { 
  ShieldCheck, Users2, UserPlus, Edit2, Trash2 
} from 'lucide-react';
import { Language, Theme, AppUser, UserRole, Region, Station, UserPermissions } from '../../types';
import { CustodyDB, ModulesModule } from '../../db';
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

interface SettingsUsersTabProps {
  language: Language;
  theme: Theme;
  currentUser: AppUser;
  users: AppUser[];
  regions: Region[];
  stations: Station[];
  pendingMappings: Record<string, { stationId?: string; regionId?: string; org_unit_id?: string }>;
  setPendingMappings: (v: Record<string, { stationId?: string; regionId?: string; org_unit_id?: string }>) => void;
  // Edit user state
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
  // New user state
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

export default function SettingsUsersTab({
  language,
  theme,
  currentUser,
  users,
  regions,
  stations,
  pendingMappings,
  setPendingMappings,
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
  handleAddUser,
  getAuthHeaders,
  setUsers,
  triggerToast
}: SettingsUsersTabProps) {
  const isRtl = language === 'ar';

  return (
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

          {CustodyDB.getUsers().filter(u => !u.is_active).length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 italic">
              {isRtl ? 'لا توجد طلبات تفعيل معلقة حالياً.' : 'No pending registration requests at this moment.'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {CustodyDB.getUsers().filter(u => !u.is_active).map((pendingUser) => {
                const requestedCompany = CustodyDB.getCompanies().find(c => c.id === pendingUser.company_id);
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

                      <div className="space-y-2 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-1">
                            {isRtl ? 'تعيين نطاق الوحدة التنظيمية (الشجرة):' : 'Assign Organization Unit Scope (Tree):'}
                          </label>
                          <OrgUnitTreeSelect
                            companyId={pendingUser.company_id || CustodyDB.getSelectedCompanyId()}
                            value={mapping.org_unit_id || ''}
                            onChange={(unitId) => setPendingMappings({
                              ...pendingMappings,
                              [pendingUser.id]: { ...mapping, org_unit_id: unitId }
                            })}
                            mode="single"
                            isRtl={isRtl}
                            theme={theme}
                            showInheritanceSummary={false}
                            placeholder={isRtl ? 'اختر الوحدة التنظيمية...' : 'Select Organization Unit...'}
                          />
                        </div>

                        {pendingUser.role === 'StationAdmin' && (
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1">
                              {isRtl ? 'تعيين لفرع/محطة الشركة (إرث):' : 'Assign Company Station (Legacy):'}
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
                            >
                              <option value="">{isRtl ? '--- اختر المحطة ---' : '--- Choose Station ---'}</option>
                              {companyStations.map(s => (
                                <option key={s.id} value={s.id}>{s.station_name} ({s.station_code})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {pendingUser.role === 'RegionalManager' && (
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1">
                              {isRtl ? 'تعيين لمنطقة الشركة الجغرافية (إرث):' : 'Assign Company Region (Legacy):'}
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
                            >
                              <option value="">{isRtl ? '--- اختر المنطقة ---' : '--- Choose Region ---'}</option>
                              {companyRegions.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={async () => {
                          if (pendingUser.role === 'StationAdmin' && !mapping.stationId) {
                            alert(isRtl ? 'يرجى اختيار المحطة التابعة لشركة الموظف أولاً.' : 'Please choose the station for this company employee first.');
                            return;
                          }
                          if (pendingUser.role === 'RegionalManager' && !mapping.regionId) {
                            alert(isRtl ? 'يرجى اختيار المنطقة التابعة لشركة الموظف أولاً.' : 'Please choose the region for this company employee first.');
                            return;
                          }

                          const chosenStation = companyStations.find(s => s.id === mapping.stationId);
                          const mappedRegionId = pendingUser.role === 'StationAdmin' 
                            ? (chosenStation?.region_id || '') 
                            : mapping.regionId;

                          const payload = {
                            is_active: true,
                            org_unit_id: mapping.org_unit_id || null,
                            station_id: pendingUser.role === 'StationAdmin' ? (mapping.stationId || null) : null,
                            region_id: mappedRegionId || null,
                            permissions: CustodyDB.enrichUserPermissions(pendingUser.role)
                          };

                          try {
                            const res = await fetch(`/api/admin/users/${pendingUser.id}`, {
                              method: 'PATCH',
                              headers: await getAuthHeaders(),
                              credentials: 'include',
                              body: JSON.stringify(payload)
                            });
                            const data = await res.json();

                            if (!res.ok || !data.success) {
                              alert(`⚠️ ${data.message || (isRtl ? 'فشل تفعيل حساب الموظف' : 'Failed to activate user')}`);
                              return;
                            }

                            if (data.user) {
                              const allDbUsers = CustodyDB.getUsers().map(u => u.id === pendingUser.id ? { ...u, ...data.user } : u);
                              await CustodyDB.saveUsers(allDbUsers);
                            }
                            setUsers(CustodyDB.getScopedUsers());
                            triggerToast(isRtl ? `تم تفعيل حساب الموظف ${pendingUser.full_name} بنجاح.` : `User account for ${pendingUser.full_name} successfully activated.`);
                          } catch (err: any) {
                            alert(isRtl ? `⚠️ خطأ في الاتصال بالخادم: ${err.message}` : `⚠️ Server connection error: ${err.message}`);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black hover:shadow-md transition-all cursor-pointer"
                      >
                        {isRtl ? 'الموافقة والتفعيل' : 'Approve & Activate'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(isRtl ? 'هل أنت متأكد من رفض وحذف طلب هذا التسجيل؟' : 'Are you sure you want to reject and delete this request?')) return;
                          const allDbUsers = CustodyDB.getUsers().filter(u => u.id !== pendingUser.id);
                          await CustodyDB.saveUsers(allDbUsers);
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

                      <div className="space-y-1.5 p-3 rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isRtl ? 'نطاق الصلاحية الإشرافية (شجرة الهيكل التنظيمي):' : 'Supervisory Access Scope (Organization Tree):'}
                        </label>
                        <OrgUnitTreeSelect
                          companyId={CustodyDB.getSelectedCompanyId()}
                          value={editUserOrgUnitId}
                          onChange={(unitId) => setEditUserOrgUnitId(unitId)}
                          mode="single"
                          isRtl={isRtl}
                          theme={theme}
                          showInheritanceSummary={true}
                          placeholder={isRtl ? 'اختر الوحدة التنظيمية النطاقية للمستخدم...' : 'Select user scope organization unit...'}
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
                            <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'ربط بالمحطة (إرث)' : 'Station Mapping (Legacy)'}</label>
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
                            <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'ربط بالمنطقة (إرث)' : 'Region Mapping (Legacy)'}</label>
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

                      <div className="space-y-2 border-t border-b py-2.5 my-2 border-slate-200 dark:border-slate-800">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                          {isRtl ? 'تخصيص الصلاحيات الفردية:' : 'Grant Scoped Authority:'}
                        </span>

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
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-black cursor-pointer"
                        >
                          {isRtl ? 'حفظ الصلاحيات' : 'Update Profile'}
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {isRtl ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  ) : (
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

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <ShieldCheck size={11} className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).manage_settings ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                          <span className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).manage_settings ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Manage settings</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShieldCheck size={11} className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).create_expense ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                          <span className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).create_expense ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Create expenses</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShieldCheck size={11} className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).settle_voucher ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                          <span className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).settle_voucher ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Settle vouchers</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShieldCheck size={11} className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).delete_expense ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                          <span className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).delete_expense ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Delete expenses</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShieldCheck size={11} className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).replace_custody ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                          <span className={(u.permissions || CustodyDB.enrichUserPermissions(u.role)).replace_custody ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>
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

                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRtl ? 'تعيين نطاق الصلاحية (شجرة الهيكل التنظيمي):' : 'Assign Authority Scope (Organization Tree):'}
                  </label>
                  <OrgUnitTreeSelect
                    companyId={CustodyDB.getSelectedCompanyId()}
                    value={newUserOrgUnitId}
                    onChange={(unitId) => setNewUserOrgUnitId(unitId)}
                    mode="single"
                    isRtl={isRtl}
                    theme={theme}
                    showInheritanceSummary={true}
                    placeholder={isRtl ? 'اختر الوحدة التنظيمية النطاقية...' : 'Select Organization Scope Unit...'}
                  />
                </div>

                {newUserRole === 'StationAdmin' && (
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'تعيين إلى فرع / محطة (إرث):' : 'Assign to Cash Station (Legacy):'}</label>
                    <select
                      value={newUserStationId}
                      onChange={(e) => setNewUserStationId(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <option value="">{isRtl ? 'اختر المحطة التابع لها...' : 'Select Station...'}</option>
                      {stations.map(s => (
                        <option key={s.id} value={s.id}>{s.station_name} ({s.station_code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {newUserRole === 'RegionalManager' && (
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'تعيين إلى منطقة جغرافية (إرث):' : 'Assign to Region Zone (Legacy):'}</label>
                    <select
                      value={newUserRegionId}
                      onChange={(e) => setNewUserRegionId(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                      }`}
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
                className="w-full mt-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all cursor-pointer"
              >
                + {isRtl ? 'تسجيل الموظف وتعميم الصلاحيات' : 'Register & Seed Credentials'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
