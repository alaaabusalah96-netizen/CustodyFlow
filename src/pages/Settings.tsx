import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, AppUser, UserRole } from '../types';
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
  UserPlus
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
    colorClass: 'text-indigo-600 font-bold',
    bgClass: 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/10',
    systemAdminOnly: true
  },
  {
    id: 'Admin',
    labelEn: 'Company Admin',
    labelAr: 'ادمن الشركة (Company Admin)',
    colorClass: 'text-rose-500 font-bold',
    bgClass: 'bg-rose-500/15 text-rose-600 border border-rose-500/10'
  },
  {
    id: 'RegionalManager',
    labelEn: 'Regional Manager',
    labelAr: 'مدير منطقة (Regional Manager)',
    colorClass: 'text-sky-600 font-semibold',
    bgClass: 'bg-sky-500/15 text-sky-600 border border-sky-500/10'
  },
  {
    id: 'StationAdmin',
    labelEn: 'Station Manager',
    labelAr: 'مدير محطة / أمين عهدة',
    colorClass: 'text-emerald-600 font-semibold',
    bgClass: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/10'
  }
];

export default function Settings({ language, theme }: SettingsProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const currentUser = CustodyDB.getActiveUser();

  // 1. Security Gate: Only Admin users can enter Settings
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

  // Admin view states
  const [companyName, setCompanyName] = useState(() => CustodyDB.getConfig().company_name);
  const [custodyValue, setCustodyValue] = useState(() => String(CustodyDB.getConfig().custody_value));
  
  const [users, setUsers] = useState<AppUser[]>(() => CustodyDB.getScopedUsers());
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('StationAdmin');
  const [selectedStationId, setSelectedStationId] = useState(() => {
    const stations = CustodyDB.getScopedStations();
    return stations[0]?.id || '';
  });
  const [selectedRegionId, setSelectedRegionId] = useState(() => {
    const regions = CustodyDB.getScopedRegions();
    return regions[0]?.id || '';
  });

  const allStations = CustodyDB.getScopedStations();
  const allRegions = CustodyDB.getScopedRegions();

  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Save General Config
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const valueNum = parseFloat(custodyValue);
    if (isNaN(valueNum) || valueNum < 0) {
      alert(t.positiveNumber);
      return;
    }

    CustodyDB.saveConfig({
      company_name: companyName.trim(),
      custody_value: valueNum
    });

    triggerToast(t.successSettings);
  };



  // Add simulated user
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      alert(t.required);
      return;
    }

    const isUserAdmin = newUserRole === 'Admin' || newUserRole === 'SystemAdmin';
    const isRegional = newUserRole === 'RegionalManager';
    const isStationAdmin = newUserRole === 'StationAdmin';

    const newUserPermissions = {
      manage_settings: isUserAdmin,
      create_expense: isUserAdmin || isStationAdmin,
      settle_voucher: isUserAdmin || isStationAdmin,
      delete_expense: isUserAdmin,
      view_reports: true
    };

    let userStationId: string | undefined = undefined;
    let userRegionId: string | undefined = undefined;

    if (isRegional) {
      userRegionId = selectedRegionId;
    } else if (newUserRole === 'StationAdmin') {
      userStationId = selectedStationId;
      const st = allStations.find(s => s.id === selectedStationId);
      if (st) {
        userRegionId = st.region_id;
      }
    }

    const currentCompanyId = CustodyDB.getSelectedCompanyId();

    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      email: newUserEmail.trim(),
      full_name: newUserName.trim(),
      role: newUserRole,
      permissions: newUserPermissions,
      company_id: currentCompanyId,
      ...(userStationId ? { station_id: userStationId } : {}),
      ...(userRegionId ? { region_id: userRegionId } : {})
    };

    const allUsers = CustodyDB.getUsers();
    // Keep other company users and other system admins intact
    const otherUsers = allUsers.filter(u => u.company_id !== currentCompanyId);
    const updatedAll = [...otherUsers, newUser];
    
    CustodyDB.saveUsers(updatedAll);
    setUsers(CustodyDB.getScopedUsers());

    setNewUserName('');
    setNewUserEmail('');
    triggerToast(isRtl ? 'تم تسجيل مستخدم جديد بالصلاحية بنجاح.' : 'Simulated user profile registered.');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
          <SettingsIcon className="text-emerald-500" />
          <span>{t.settings}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {isRtl 
            ? 'إدارة محددات النظام والسياسة المالية للشركة وتصنيف بنود المصروفات وصلاحيات الأفراد.' 
            : 'Configure general system parameters, corporate cash base thresholds, approved ledger categories, and staff privileges.'
          }
        </p>
      </div>

      {/* Success Toast Banner */}
      {toastMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: General Custody Config */}
        <div className="space-y-6">
          {/* General settings card */}
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
              {/* Company Name input */}
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

              {/* Custody Threshold */}
              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.custodyAmount} *</label>
                <input
                  type="number"
                  step="100"
                  value={custodyValue}
                  onChange={(e) => setCustodyValue(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all text-xs"
              >
                {t.saveChanges}
              </button>
            </form>
          </div>


        </div>

        {/* Right Column: Simulated Users Roles and Permissions Profiles */}
        <div className={`p-5 rounded-2xl border ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 mb-4 border-b pb-2.5 border-slate-100 dark:border-slate-800">
            <Users2 size={16} className="text-emerald-500" />
            <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t.userManagement}
            </h3>
          </div>

          {/* User profile list */}
          <div className="space-y-4 mb-5 max-h-80 overflow-y-auto pr-1">
            {users.map((u) => {
              const uStation = u.station_id ? allStations.find(s => s.id === u.station_id) : null;
              const uRegion = u.region_id ? allRegions.find(r => r.id === u.region_id) : null;
              return (
                <div 
                  key={u.id} 
                  className={`p-3 rounded-xl border text-xs ${
                    theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50/50 border-slate-150'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{u.full_name}</span>
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
                    {(() => {
                      const rDef = SYSTEM_ROLES.find(r => r.id === u.role);
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${rDef?.bgClass || 'bg-slate-500/15 text-slate-600 border border-slate-500/10'}`}>
                          {rDef ? (isRtl ? rDef.labelAr : rDef.labelEn) : u.role}
                        </span>
                      );
                    })()}
                  </div>

                {/* Permissions Indicators checklist */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={12} className={u.permissions.manage_settings ? "text-emerald-500" : "text-slate-300"} />
                    <span className={u.permissions.manage_settings ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Manage settings</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={12} className={u.permissions.create_expense ? "text-emerald-500" : "text-slate-300"} />
                    <span className={u.permissions.create_expense ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Create expenses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={12} className={u.permissions.settle_voucher ? "text-emerald-500" : "text-slate-300"} />
                    <span className={u.permissions.settle_voucher ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Settle vouchers</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={12} className={u.permissions.delete_expense ? "text-emerald-500" : "text-slate-300"} />
                    <span className={u.permissions.delete_expense ? "text-slate-600 dark:text-slate-300 font-semibold" : ""}>Delete expenses</span>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Add simulated User profile form */}
          <form onSubmit={handleAddUser} className="border-t pt-3 border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
            <div className="font-bold text-slate-400 uppercase text-[10px] flex items-center gap-1">
              <UserPlus size={12} />
              <span>{isRtl ? 'إضافة مستخدم وهمي جديد لقاعدة البيانات' : 'Pre-seed New User profile'}</span>
            </div>

            <div className="grid gap-2">
              <input
                type="text"
                placeholder={isRtl ? 'الاسم بالكامل' : 'Full Name'}
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                }`}
                required
              />
              <input
                type="email"
                placeholder={isRtl ? 'البريد الإلكتروني' : 'Email address'}
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none font-mono ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                }`}
                required
              />
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-slate-400 font-bold text-[10px] uppercase">{isRtl ? 'الدور / الصلاحية:' : 'Role / Authority:'}</span>
                <div className="flex flex-wrap gap-3">
                  {SYSTEM_ROLES.filter(r => !r.systemAdminOnly || currentUser?.role === 'SystemAdmin').map((role) => (
                    <label key={role.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="newRole"
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

              {newUserRole === 'RegionalManager' && (
                <div className="mt-1 space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">
                    {isRtl ? 'اختر المنطقة التابع لها:' : 'Assign to Region:'}
                  </label>
                  <select
                    value={selectedRegionId}
                    onChange={(e) => setSelectedRegionId(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    {allRegions.map(reg => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name} ({reg.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newUserRole === 'StationAdmin' && (
                <div className="mt-1 space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">
                    {isRtl ? 'اختر الفرع / المحطة التابع لها:' : 'Assign to Station:'}
                  </label>
                  <select
                    value={selectedStationId}
                    onChange={(e) => setSelectedStationId(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    {allStations.map(stn => (
                      <option key={stn.id} value={stn.id}>
                        {stn.station_name} ({stn.station_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
            >
              {isRtl ? '+ تسجيل وتعميم الصلاحيات' : '+ Seed User Credentials'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
