import React from 'react';
import { AppUser, Company, Region, Station } from '../types';
import { Info, Search, UserCheck } from 'lucide-react';

interface SuperAdminImpersonateTabProps {
  supportUsersList: AppUser[];
  companies: Company[];
  regions: Region[];
  stations: Station[];
  supportUserSearch: string;
  setSupportUserSearch: (val: string) => void;
  impersonateError: string | null;
  handleStartImpersonation: (user: AppUser) => void;
  isRtl: boolean;
}

export const SuperAdminImpersonateTab: React.FC<SuperAdminImpersonateTabProps> = ({
  supportUsersList,
  companies,
  regions,
  stations,
  supportUserSearch,
  setSupportUserSearch,
  impersonateError,
  handleStartImpersonation,
  isRtl,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-4.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 flex items-start gap-3">
        <Info size={20} className="text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider">{isRtl ? 'بوابة الدعم الفني المباشر للمنصة' : 'Direct Technical Support Access'}</h4>
          <p className="text-[11px] leading-relaxed">
            {isRtl 
              ? 'تتيح لك البوابة الولوج السريع لأي مستخدم لمباشرة المشاكل الفنية وتصحيح العهد بدون إدخال كلمة مرورهم. سيحتفظ النظام بجلستك الأساسية كـ Super Admin، ويمكنك إنهاء الدعم والعودة بضغطة زر واحدة. يتم تسجيل كل جلسة في سجل الامتثال.'
              : 'Gain direct read/write context to any user account to troubleshoot bugs, adjust balances or guide cashiers. This session runs on temporary authentication under audit. You can resume your Super Admin dashboard instantly with one click.'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm w-full">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-2 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isRtl ? 'اختر مستخدماً لبدء الدعم' : 'Select Target Support Session'}
            </h3>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-bold">{isRtl ? `مجموع المستخدمين: ${supportUsersList.length}` : `Total Users: ${supportUsersList.length}`}</span>
          </div>
          
          {/* Support User Search Filter */}
          <div className="relative w-full">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={isRtl ? 'بحث باسم المستخدم، البريد، أو الصلاحية...' : 'Search target name, email or role...'}
              value={supportUserSearch}
              onChange={(e) => setSupportUserSearch(e.target.value)}
              className="w-full pl-4 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        {impersonateError && (
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 font-semibold border border-rose-500/20 text-[11px]">
            {impersonateError}
          </div>
        )}

        <div className="space-y-2 max-h-[380px] overflow-y-auto px-1">
          {supportUsersList.map(u => {
            const comp = companies.find(c => c.id === u.company_id);
            const userStation = stations.find(s => s.id === u.station_id);
            const userRegionId = u.region_id || userStation?.region_id;
            const userRegion = regions.find(r => r.id === userRegionId);

            // Friendly role display
            let friendlyRole: string = u.role;
            if (u.role === 'Admin') friendlyRole = isRtl ? 'ادمن الشركة' : 'Company Admin';
            else if (u.role === 'RegionalManager') friendlyRole = isRtl ? 'مدير منطقة' : 'Regional Manager';
            else if (u.role === 'StationAdmin') friendlyRole = isRtl ? 'مدير محطة' : 'Station Manager';

            return (
              <div 
                key={u.id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all text-xs"
              >
                <div className="space-y-1.5 w-full sm:w-auto">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    <span>{u.full_name}</span>
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-black tracking-wide">
                      {friendlyRole}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-1.5 items-center">
                    <span>{u.email}</span>
                    
                    {/* Company */}
                    {comp && (
                      <span className="text-slate-500 dark:text-slate-300 font-semibold flex items-center gap-1">
                        <span className="inline-block">🏢</span>
                        <span>{comp.name}</span>
                      </span>
                    )}

                    {/* Region */}
                    {userRegion && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <span className="inline-block">🌍</span>
                        <span>{isRtl ? `المنطقة: ${userRegion.name}` : `Region: ${userRegion.name}`}</span>
                      </span>
                    )}

                    {/* Station / Branch */}
                    {userStation && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="inline-block">📍</span>
                        <span>{isRtl ? `الفرع/المحطة: ${userStation.station_name}` : `Branch/Station: ${userStation.station_name}`}</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleStartImpersonation(u)}
                  className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[10px] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <UserCheck size={12} />
                  <span>{isRtl ? 'الدخول للدعم الفني' : 'Impersonate Account'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminImpersonateTab;
