import React from 'react';
import { CustodyDB, ModulesModule } from '../db';
import { Company, AppUser, Region, Station, Theme } from '../types';
import { 
  Building2, Plus, Calendar, Sparkles, Search, Globe, X, Settings, Trash2, Edit,
  PlusCircle, Building, Network, Power, ArrowUpDown, KeyRound, ShieldCheck, ArrowRight, ArrowLeft
} from 'lucide-react';
import AdminCredentialsForm from './AdminCredentialsForm';

interface SuperAdminCompaniesTabProps {
  isRtl: boolean;
  theme: Theme;
  companies: Company[];
  users: AppUser[];
  regions: Region[];
  stations: Station[];
  companySearch: string;
  setCompanySearch: (val: string) => void;
  sortField: 'name' | 'status' | 'userCount' | 'expiry';
  handleSort: (field: 'name' | 'status' | 'userCount' | 'expiry') => void;
  sortedAndFilteredCompanies: Company[];
  filteredCompanies: Company[];
  isStructureOpen: boolean;
  setIsStructureOpen: (val: boolean) => void;
  structureView: 'tree' | 'tables';
  setStructureView: (val: 'tree' | 'tables') => void;
  structToastMsg: string;
  startStructAddCompany: () => void;
  startStructEditCompany: (c: Company) => void;
  handleStructDeleteCompany: (id: string) => void;
  startStructAddRegionForCompany: (companyId: string) => void;
  startStructAddStationDirectForCompany: (companyId: string) => void;
  startStructEditRegion: (r: Region) => void;
  handleStructDeleteRegion: (id: string) => void;
  startStructAddStationForRegion: (regionId: string, companyId?: string) => void;
  startStructEditStation: (s: Station) => void;
  handleStructDeleteStation: (id: string) => void;
  handleToggleCompanyActive: (companyId: string, currentStatus: boolean) => void;
  setEditingCompany: (c: Company | null) => void;
  setSubPlan: (plan: Company['subscription_plan']) => void;
  setSubStatus: (status: Company['subscription_status']) => void;
  setSubExpiry: (expiry: string) => void;
  setCompanyModules: (mods: Record<string, any>) => void;
  setActiveModalTab: (tab: 'subscription' | 'modules') => void;
  handleSaveCompanyAdmin: (companyId: string, email: string, pass: string, permissions?: any) => Promise<void>;
  handleSaveRegionManager: (regionId: string, companyId: string, email: string, pass: string, permissions?: any) => Promise<void>;
  handleSaveStationAdmin: (stationId: string, regionId: string | undefined, companyId: string, email: string, pass: string, permissions?: any) => Promise<void>;
  structureTab: 'companies' | 'regions' | 'stations';
  setStructureTab: (tab: 'companies' | 'regions' | 'stations') => void;
  structSelectedCompanyId: string;
}

export default function SuperAdminCompaniesTab({
  isRtl,
  theme,
  companies,
  users,
  regions,
  stations,
  companySearch,
  setCompanySearch,
  sortField,
  handleSort,
  sortedAndFilteredCompanies,
  filteredCompanies,
  isStructureOpen,
  setIsStructureOpen,
  structureView,
  setStructureView,
  structToastMsg,
  startStructAddCompany,
  startStructEditCompany,
  handleStructDeleteCompany,
  startStructAddRegionForCompany,
  startStructAddStationDirectForCompany,
  startStructEditRegion,
  handleStructDeleteRegion,
  startStructAddStationForRegion,
  startStructEditStation,
  handleStructDeleteStation,
  handleToggleCompanyActive,
  setEditingCompany,
  setSubPlan,
  setSubStatus,
  setSubExpiry,
  setCompanyModules,
  setActiveModalTab,
  handleSaveCompanyAdmin,
  handleSaveRegionManager,
  handleSaveStationAdmin,
  structureTab,
  setStructureTab,
  structSelectedCompanyId,
}: SuperAdminCompaniesTabProps) {
  return (
    <div className="space-y-6">
      {/* TOAST NOTIFICATION FOR STRUCTURE BUILDER */}
      {structToastMsg && (
        <div className="fixed bottom-5 right-5 z-[110] flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-fade-in text-xs font-bold">
          <span>{structToastMsg}</span>
        </div>
      )}

      {/* UNIFIED ACCESS CONTROL CENTER MIGRATION BANNER & QUICK LINK */}
      <div 
        id="unified-access-control-redirect-banner"
        className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/10 via-indigo-900/5 to-sky-900/10 border border-blue-200/80 dark:border-blue-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{isRtl ? 'مركز التحكم الموحد في الصلاحيات والشركات' : 'Unified Access Control & Multi-Tenant Center'}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                {isRtl ? 'موصى به' : 'Recommended'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {isRtl 
                ? 'تم توحيد إدارة الشركات، الهيكل التنظيمي، المستخدمين، طلبات التسجيل والتصحيح في شاشة موحدة تحت الإعدادات.'
                : 'Companies, Org Structure, User Accounts, Signups and Correction requests are now unified under Settings.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('navigate_tab', { 
              detail: { tab: 'settings', settingsTab: 'permissions' } 
            }));
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <span>{isRtl ? 'الانتقال إلى مركز التحكم الموحد' : 'Open Unified Access Control'}</span>
          {isRtl ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={isRtl ? 'بحث باسم الشركة أو المعرف...' : 'Search company name or ID...'}
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setIsStructureOpen(!isStructureOpen)}
            className={`w-full md:w-auto px-5 py-2.5 border rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 ${
              isStructureOpen 
                ? 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-505' 
                : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200 border-slate-200'
            }`}
          >
            <Settings size={14} />
            <span>{isRtl ? 'إدارة الهيكل التنظيمي والمحطات' : 'Organization Structure Builder'}</span>
          </button>
        </div>
      </div>

      {/* Registered Companies Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAFAFA] dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#2451B8]" />
            <h3 className="font-bold text-sm text-[#18181B] dark:text-slate-100">
              {isRtl ? 'دليل الشركات المسجلة بالمنصة' : 'Registered SaaS Entities Directory'}
            </h3>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[#71717A] dark:text-slate-400">
              {sortedAndFilteredCompanies.length}
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={startStructAddCompany}
              className="px-3.5 py-1.5 rounded-md bg-[#2451B8] hover:bg-[#1d429a] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? 'إضافة شركة جديدة' : 'Add Company'}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="bg-[#FAFAFA] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[#71717A] font-semibold">
                <th 
                  onClick={() => handleSort('name')}
                  className="p-3 text-right cursor-pointer hover:text-[#18181B] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>{isRtl ? 'اسم الشركة' : 'Company Name'}</span>
                    <ArrowUpDown size={12} className={sortField === 'name' ? 'text-[#2451B8]' : 'text-slate-400'} />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('status')}
                  className="p-3 text-right cursor-pointer hover:text-[#18181B] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>{isRtl ? 'الحالة' : 'Status'}</span>
                    <ArrowUpDown size={12} className={sortField === 'status' ? 'text-[#2451B8]' : 'text-slate-400'} />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('userCount')}
                  className="p-3 text-center cursor-pointer hover:text-[#18181B] select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{isRtl ? 'عدد المستخدمين' : 'Users'}</span>
                    <ArrowUpDown size={12} className={sortField === 'userCount' ? 'text-[#2451B8]' : 'text-slate-400'} />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('expiry')}
                  className="p-3 text-right cursor-pointer hover:text-[#18181B] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>{isRtl ? 'انتهاء الاشتراك' : 'Expiry Date'}</span>
                    <ArrowUpDown size={12} className={sortField === 'expiry' ? 'text-[#2451B8]' : 'text-slate-400'} />
                  </div>
                </th>
                <th className="p-3 text-center">{isRtl ? 'إجراءات سريعة' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedAndFilteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#71717A]">
                    {isRtl ? 'لا توجد شركات مطابقة للبحث' : 'No matching companies found'}
                  </td>
                </tr>
              ) : (
                sortedAndFilteredCompanies.map((c) => {
                  const userCount = users.filter(u => u.company_id === c.id).length;
                  const isActive = c.is_active !== false;
                  const plan = c.subscription_plan || 'Basic';
                  const expiry = c.subscription_expiry || '—';

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-[#2451B8]">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-[#18181B] dark:text-slate-100">{c.name}</div>
                            <div className="text-[10px] font-mono text-[#71717A] flex items-center gap-1.5">
                              <span>ID: {c.id}</span>
                              <span>•</span>
                              <span className="capitalize">{plan} Plan</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-[#16794F] bg-[#16794F]/10 border border-[#16794F]/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16794F]" />
                            <span>{isRtl ? 'نشطة' : 'Active'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-[#B91C1C] bg-[#B91C1C]/10 border border-[#B91C1C]/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]" />
                            <span>{isRtl ? 'معطّلة' : 'Disabled'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono font-bold text-xs text-[#18181B] dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          {userCount}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-[#71717A] dark:text-slate-300">
                        {expiry}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingCompany(c);
                              setSubPlan(c.subscription_plan || 'Basic');
                              setSubStatus(c.subscription_status || 'active');
                              setSubExpiry(c.subscription_expiry || '');
                              setCompanyModules(ModulesModule.getCompanyModules(c.id));
                              setActiveModalTab('subscription');
                            }}
                            title={isRtl ? 'تعديل والاشتراك' : 'Edit & Subscription'}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-[#2451B8] transition-colors cursor-pointer"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleCompanyActive(c.id, isActive)}
                            title={isActive ? (isRtl ? 'تعطيل' : 'Disable') : (isRtl ? 'تفعيل' : 'Activate')}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              isActive 
                                ? 'hover:bg-rose-50 text-[#B91C1C] dark:hover:bg-rose-950/30' 
                                : 'hover:bg-emerald-50 text-[#16794F] dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            onClick={() => handleStructDeleteCompany(c.id)}
                            title={isRtl ? 'حذف' : 'Delete'}
                            className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[#B91C1C] transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ENTERPRISE ORGANIZATIONAL STRUCTURE BUILDER */}
      {isStructureOpen && (
        <div className={`p-6 rounded-3xl border transition-all animate-fade-in ${
          theme === 'dark' ? 'bg-[#1e293b]/90 border-[#334155]' : 'bg-slate-50 border-slate-300'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b mb-6 border-slate-200 dark:border-slate-700 gap-3">
            <div className="flex items-center gap-2">
              <Network className="text-indigo-600 animate-pulse" size={20} />
              <div>
                <h3 className="font-bold text-sm md:text-base text-slate-800 dark:text-slate-100">
                  {isRtl ? 'محرر الهيكل التنظيمي والعهد والشركات التابعة' : 'Enterprise Corporate Structure & Custody Builder'}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {isRtl ? 'إضافة وتعديل وحذف الشركات، والقطاعات أو المناطق التابعة، ومحطات العهد التكليفية.' : 'Add, edit, and delete companies, regional sectors, and custody branch assets.'}
                </p>
              </div>
            </div>
            
            {/* Control Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex p-0.5 bg-slate-200/60 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setStructureView('tree')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    structureView === 'tree' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-850'
                  }`}
                >
                  🌳 {isRtl ? 'المخطط الشجري للمؤسسة' : 'Visual Hierarchy Tree'}
                </button>
                <button
                  type="button"
                  onClick={() => setStructureView('tables')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    structureView === 'tables' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-850'
                  }`}
                >
                  📋 {isRtl ? 'عرض الجداول والمدرجات' : 'Classic Tables List'}
                </button>
              </div>

              <button 
                onClick={() => setIsStructureOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={isRtl ? 'إغلاق المحرر' : 'Close Editor'}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* VIEW A: VISUAL HIERARCHY TREE */}
          {structureView === 'tree' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Sparkles size={14} className="text-amber-500 animate-pulse" />
                  <span>
                    {isRtl 
                      ? 'اضغط على أزرار الإضافة السريعة (+) على مستوى كل كارت لتربيط وفصل الهياكل بشكل مرن.' 
                      : 'Click the Quick Add (+) buttons on cards to automatically link regional sectors and custody branch assets.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={startStructAddCompany}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <PlusCircle size={13} />
                  <span>{isRtl ? 'إضافة شركة جديدة للهيكل' : 'Create New Company'}</span>
                </button>
              </div>

              <div className="space-y-10" dir={isRtl ? 'rtl' : 'ltr'}>
                {filteredCompanies.map(comp => {
                  const compRegs = regions.filter(r => r.company_id === comp.id);
                  const compStns = stations.filter(s => s.company_id === comp.id);
                  const directStns = compStns.filter(s => !s.region_id);

                  return (
                    <div 
                      key={comp.id}
                      className="border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-5 bg-indigo-50/5 dark:bg-slate-900/20 shadow-sm relative overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100 dark:border-slate-800/80 pb-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-md">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-slate-900 dark:text-white text-base md:text-lg">
                                {comp.name}
                              </h4>
                              <span className="text-[10px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold rounded-full">
                                {isRtl ? 'الشركة الأم' : 'Parent Enterprise'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                comp.is_active !== false 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}>
                                <span className={`h-1 w-1 rounded-full ${comp.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span>{comp.is_active !== false ? (isRtl ? 'مفعلة' : 'Active') : (isRtl ? 'معطلة' : 'Suspended')}</span>
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                comp.subscription_plan === 'Enterprise'
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                  : comp.subscription_plan === 'Professional'
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                              }`}>
                                {comp.subscription_plan || 'Basic'}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {isRtl ? 'العهدة الكلية:' : 'Total Custody:'} <strong className="text-slate-700 dark:text-slate-200">{CustodyDB.getCompanyDeductedCustody(comp.id).toLocaleString()} EGP</strong>
                              </span>
                              {comp.subscription_expiry && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({isRtl ? 'تنتهي:' : 'Expires:'} {comp.subscription_expiry})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-extrabold text-slate-400 px-2 hidden lg:inline">{isRtl ? 'الهيكل:' : 'Structure:'}</span>
                            <button
                              type="button"
                              onClick={() => startStructAddRegionForCompany(comp.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#2451B8]/10 hover:bg-[#2451B8]/20 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#2451B8] dark:text-blue-400 border border-[#2451B8]/20 dark:border-slate-700 text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                              title={isRtl ? 'إضافة قطاع/منطقة تحت هذه الشركة' : 'Add Sector under Company'}
                            >
                              <Globe size={13} className="text-[#2451B8]" />
                              <span>{isRtl ? 'إضافة قطاع' : 'Add Sector'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startStructAddStationDirectForCompany(comp.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-slate-700 text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                              title={isRtl ? 'إضافة فرع عهدة مباشر بدون قطاع' : 'Add Direct custody branch'}
                            >
                              <Building size={13} className="text-emerald-500" />
                              <span>{isRtl ? 'فرع مباشر' : 'Direct Branch'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-extrabold text-slate-400 px-2 hidden lg:inline">{isRtl ? 'الاشتراك:' : 'Subscription:'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCompany(comp);
                                setSubPlan(comp.subscription_plan || 'Basic');
                                setSubStatus(comp.subscription_status || 'active');
                                setSubExpiry(comp.subscription_expiry || '');
                                setCompanyModules(ModulesModule.getCompanyModules(comp.id));
                                setActiveModalTab('subscription');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700/80 hover:bg-[#2451B8]/10 dark:hover:bg-blue-900/30 text-[#2451B8] dark:text-blue-400 border border-slate-200 dark:border-slate-600 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title={isRtl ? 'إدارة الاشتراك والتراخيص' : 'Manage Subscription'}
                            >
                              <Calendar size={13} />
                              <span>{isRtl ? 'الترخيص' : 'Plan'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCompanyActive(comp.id, comp.is_active !== false)}
                              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                                comp.is_active !== false
                                  ? 'bg-amber-50 hover:bg-amber-100 dark:bg-slate-700 dark:hover:bg-amber-900/30 text-amber-600 border-amber-200 dark:border-amber-800'
                                  : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-700 dark:hover:bg-emerald-900/30 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                              }`}
                              title={comp.is_active !== false ? (isRtl ? 'تعطيل الحساب' : 'Suspend Account') : (isRtl ? 'تفعيل الحساب' : 'Activate Account')}
                            >
                              <Power size={13} />
                              <span>{comp.is_active !== false ? (isRtl ? 'تعطيل' : 'Suspend') : (isRtl ? 'تفعيل' : 'Activate')}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => startStructEditCompany(comp)}
                              className="p-1.5 rounded-lg hover:bg-[#2451B8]/10 dark:hover:bg-slate-700 text-[#2451B8] dark:text-blue-400 cursor-pointer transition-all"
                              title={isRtl ? 'تعديل اسم الشركة' : 'Edit Company Name'}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStructDeleteCompany(comp.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-700 text-rose-500 hover:text-rose-600 cursor-pointer transition-all"
                              title={isRtl ? 'حذف الشركة' : 'Delete Company'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Company Admin Credentials Section */}
                      <div className="mb-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-200/30 dark:border-indigo-900/30">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2.5">
                          <KeyRound size={13} />
                          <span>{isRtl ? 'حساب مدير الشركة (الأدمن)' : 'Company Administrator Account'}</span>
                        </div>
                        <AdminCredentialsForm
                          initialEmail={users.find(u => u.company_id === comp.id && u.role === 'Admin')?.email || ''}
                          initialPassword={users.find(u => u.company_id === comp.id && u.role === 'Admin')?.password || ''}
                          onSave={(email, pass, permissions) => handleSaveCompanyAdmin(comp.id, email, pass, permissions)}
                          isRtl={isRtl}
                          userRole="Admin"
                          companyId={comp.id}
                        />
                      </div>

                      {/* Tree Inner branches (Sectors and Stations) */}
                      <div className="space-y-6 pl-4 sm:pl-8 border-l-2 border-indigo-100 dark:border-slate-800/80 mr-1 sm:mr-4 rtl:pl-0 rtl:pr-4 sm:rtl:pr-8 rtl:border-l-0 rtl:border-r-2">
                        {compRegs.length === 0 && directStns.length === 0 ? (
                          <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-400">
                            {isRtl 
                              ? 'لا يوجد هيكل تنظيمي مضاف تحت هذه الشركة حتى الآن. ابدأ بإضافة قطاع أو فرع من الأزرار بالأعلى.' 
                              : 'No organizational structure has been added under this company yet. Start by adding a sector or direct branch.'}
                          </div>
                        ) : (
                          compRegs.map(reg => {
                            const regStns = compStns.filter(s => s.region_id === reg.id);

                            return (
                              <div key={reg.id} className="relative group/sector">
                                <div className="absolute -left-[25px] rtl:-right-[25px] top-6 h-2 w-2 rounded-full bg-indigo-400 border-2 border-white dark:border-[#1e293b]" />
                                
                                <div className="p-4 rounded-xl border border-indigo-100 dark:border-slate-800 bg-white/50 dark:bg-slate-800/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-900 transition-all">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                      <Globe size={16} />
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                                        {reg.name}
                                      </h5>
                                      <span className="text-[9px] font-mono font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                        {reg.code || 'REG-SEC'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startStructAddStationForRegion(reg.id, comp.id)}
                                      className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-450 text-[10px] font-black transition-all flex items-center gap-0.5 cursor-pointer"
                                      title={isRtl ? 'إضافة فرع عهدة تحت هذا القطاع' : 'Add Station under Sector'}
                                    >
                                      <Plus size={11} />
                                      <span>{isRtl ? 'إضافة فرع' : 'Add Branch'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startStructEditRegion(reg)}
                                      className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-450 cursor-pointer"
                                      title={isRtl ? 'تعديل القطاع' : 'Edit Sector'}
                                    >
                                      <Edit size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStructDeleteRegion(reg.id)}
                                      className="p-1 rounded hover:bg-rose-50 dark:hover:bg-slate-800 text-rose-500 hover:text-rose-600 cursor-pointer"
                                      title={isRtl ? 'حذف القطاع' : 'Delete Sector'}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-2.5 mb-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-200/20 dark:border-indigo-900/20 max-w-xl">
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-2">
                                    <KeyRound size={12} />
                                    <span>{isRtl ? 'حساب مدير القطاع (المنطقة)' : 'Regional Manager Account'}</span>
                                  </div>
                                  <AdminCredentialsForm
                                    initialEmail={users.find(u => u.region_id === reg.id && u.role === 'RegionalManager')?.email || ''}
                                    initialPassword={users.find(u => u.region_id === reg.id && u.role === 'RegionalManager')?.password || ''}
                                    onSave={(email, pass, permissions) => handleSaveRegionManager(reg.id, comp.id, email, pass, permissions)}
                                    isRtl={isRtl}
                                    userRole="RegionalManager"
                                    companyId={comp.id}
                                    regionId={reg.id}
                                  />
                                </div>

                                <div className="pl-6 mr-1 pr-0 sm:mr-3 sm:pr-0 border-l border-dashed border-indigo-200 dark:border-slate-800/80 my-2 space-y-3 rtl:pl-0 rtl:pr-6 rtl:border-l-0 rtl:border-r rtl:border-dashed">
                                  {regStns.length === 0 ? (
                                    <div className="p-3 text-[10px] text-slate-400 italic">
                                      {isRtl ? 'لا توجد فروع مضافة تحت هذا القطاع.' : 'No branches added under this sector yet.'}
                                    </div>
                                  ) : (
                                    regStns.map(stn => (
                                      <div 
                                        key={stn.id}
                                        className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/40 hover:border-slate-200 flex flex-col gap-2 max-w-xl"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <div className={`h-1.5 w-1.5 rounded-full ${stn.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <div>
                                              <div className="font-bold text-[11px] text-slate-700 dark:text-slate-200">
                                                {stn.station_name}
                                              </div>
                                              <div className="text-[9px] text-slate-400 font-mono">
                                                Code: {stn.station_code} | {isRtl ? 'العهدة:' : 'Custody:'} {CustodyDB.getStationDeductedCustody(stn.id).toLocaleString()} EGP
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => startStructEditStation(stn)}
                                              className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-850 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                              title={isRtl ? 'تعديل الفرع' : 'Edit Branch'}
                                            >
                                              <Edit size={12} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleStructDeleteStation(stn.id)}
                                              className="p-1 rounded hover:bg-rose-50 dark:hover:bg-slate-850 text-rose-500 hover:text-rose-600 cursor-pointer"
                                              title={isRtl ? 'حذف الفرع' : 'Delete Branch'}
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        </div>

                                        <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-450 dark:text-slate-500 mb-1.5">
                                            <KeyRound size={10} />
                                            <span>{isRtl ? 'حساب مسؤول الفرع (المحطة)' : 'Branch Manager Account'}</span>
                                          </div>
                                          <AdminCredentialsForm
                                            initialEmail={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.email || ''}
                                            initialPassword={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.password || ''}
                                            onSave={(email, pass, permissions) => handleSaveStationAdmin(stn.id, stn.region_id, comp.id, email, pass, permissions)}
                                            isRtl={isRtl}
                                            userRole="StationAdmin"
                                            companyId={comp.id}
                                            regionId={stn.region_id}
                                            stationId={stn.id}
                                          />
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}

                        {directStns.length > 0 && (
                          <div className="space-y-3 mt-4 pt-4 border-t border-dashed border-slate-150 dark:border-slate-800">
                            <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-2">
                              {isRtl ? '🔗 فروع مباشرة تحت الشركة الأم' : '🔗 Direct Corporate Branches'}
                            </div>
                            {directStns.map(stn => (
                              <div 
                                key={stn.id}
                                className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/40 hover:border-slate-200 flex flex-col gap-2 max-w-xl"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`h-1.5 w-1.5 rounded-full ${stn.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <div>
                                      <div className="font-bold text-[11px] text-slate-700 dark:text-slate-200">
                                        {stn.station_name}
                                      </div>
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        Code: {stn.station_code} | {isRtl ? 'العهدة:' : 'Custody:'} {CustodyDB.getStationDeductedCustody(stn.id).toLocaleString()} EGP
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startStructEditStation(stn)}
                                      className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-850 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                      title={isRtl ? 'تعديل الفرع' : 'Edit Branch'}
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStructDeleteStation(stn.id)}
                                      className="p-1 rounded hover:bg-rose-50 dark:hover:bg-slate-850 text-rose-500 hover:text-rose-600 cursor-pointer"
                                      title={isRtl ? 'حذف الفرع' : 'Delete Branch'}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-450 dark:text-slate-500 mb-1.5">
                                    <KeyRound size={10} />
                                    <span>{isRtl ? 'حساب مسؤول الفرع (المحطة)' : 'Branch Manager Account'}</span>
                                  </div>
                                  <AdminCredentialsForm
                                    initialEmail={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.email || ''}
                                    initialPassword={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.password || ''}
                                    onSave={(email, pass, permissions) => handleSaveStationAdmin(stn.id, stn.region_id, comp.id, email, pass, permissions)}
                                    isRtl={isRtl}
                                    userRole="StationAdmin"
                                    companyId={comp.id}
                                    regionId={stn.region_id}
                                    stationId={stn.id}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW B: CLASSIC LIST TABLES */}
          {structureView === 'tables' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
                <button
                  onClick={() => setStructureTab('companies')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    structureTab === 'companies' ? 'border-[#2451B8] text-[#2451B8]' : 'border-transparent text-slate-400'
                  }`}
                >
                  {isRtl ? '1. الشركات والكيانات' : '1. Companies'}
                </button>
                <button
                  onClick={() => setStructureTab('regions')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    structureTab === 'regions' ? 'border-[#2451B8] text-[#2451B8]' : 'border-transparent text-slate-400'
                  }`}
                >
                  {isRtl ? '2. قطاعات ومناطق جغرافية' : '2. Regions'}
                </button>
                <button
                  onClick={() => setStructureTab('stations')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    structureTab === 'stations' ? 'border-[#2451B8] text-[#2451B8]' : 'border-transparent text-slate-400'
                  }`}
                >
                  {isRtl ? '3. المحطات والفروع العهدية' : '3. Stations & Branches'}
                </button>
              </div>

              {structureTab === 'companies' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={startStructAddCompany}
                      className="px-3.5 py-1.5 bg-[#2451B8] text-white rounded-lg text-xs font-bold hover:bg-[#1d429a] transition-all flex items-center gap-1 shadow-md cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{isRtl ? 'إضافة شركة جديدة' : 'Add Company'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 mt-2 shadow-sm">
                    <table className="w-full text-xs text-left min-w-[750px]" dir={isRtl ? 'rtl' : 'ltr'}>
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3.5">ID</th>
                          <th className="p-3.5">{isRtl ? 'الشركة' : 'Company'}</th>
                          <th className="p-3.5 text-center">{isRtl ? 'حالة الحساب' : 'Account Status'}</th>
                          <th className="p-3.5 text-center">{isRtl ? 'الباقة المفعلة' : 'Subscription Plan'}</th>
                          <th className="p-3.5 text-center">{isRtl ? 'انتهاء الاشتراك' : 'Subscription Expiry'}</th>
                          <th className="p-3.5 text-center">{isRtl ? 'حد العهدة الكلية' : 'Total Custody Limit'}</th>
                          <th className="p-3.5 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredCompanies.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-3.5 font-mono text-slate-400">{c.id}</td>
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white text-xs md:text-sm">{c.name}</td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                c.is_active !== false 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${c.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span>{c.is_active !== false ? (isRtl ? 'مفعلة' : 'Active') : (isRtl ? 'معطلة' : 'Suspended')}</span>
                              </span>
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                c.subscription_plan === 'Enterprise'
                                  ? 'bg-[#2451B8]/10 text-[#2451B8] dark:text-blue-400'
                                  : c.subscription_plan === 'Professional'
                                    ? 'bg-[#2451B8]/10 text-[#2451B8] dark:text-blue-400'
                                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                              }`}>
                                {c.subscription_plan || 'Basic'}
                              </span>
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                              {c.subscription_expiry || '—'}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap font-mono font-black text-slate-700 dark:text-slate-200">
                              {CustodyDB.getCompanyDeductedCustody(c.id).toLocaleString()} EGP
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button 
                                  onClick={() => startStructEditCompany(c)} 
                                  className="p-1.5 hover:bg-[#2451B8]/10 dark:hover:bg-slate-800 rounded-lg text-[#2451B8] dark:text-blue-400 cursor-pointer transition-all"
                                  title={isRtl ? 'تعديل اسم الشركة' : 'Edit Company Name'}
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleToggleCompanyActive(c.id, c.is_active !== false)}
                                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    c.is_active !== false
                                      ? 'hover:bg-amber-50 dark:hover:bg-slate-800 text-amber-500'
                                      : 'hover:bg-emerald-50 dark:hover:bg-slate-800 text-emerald-500'
                                  }`}
                                  title={c.is_active !== false ? (isRtl ? 'تعطيل الحساب' : 'Suspend Account') : (isRtl ? 'تفعيل الحساب' : 'Activate Account')}
                                >
                                  <Power size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCompany(c);
                                    setSubPlan(c.subscription_plan || 'Basic');
                                    setSubStatus(c.subscription_status || 'active');
                                    setSubExpiry(c.subscription_expiry || '');
                                    setCompanyModules(ModulesModule.getCompanyModules(c.id));
                                    setActiveModalTab('subscription');
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-[#2451B8]/10 dark:hover:bg-slate-800 text-[#2451B8] cursor-pointer transition-all"
                                  title={isRtl ? 'إدارة الاشتراك والتراخيص' : 'Manage Subscription'}
                                >
                                  <Calendar size={14} />
                                </button>
                                <button 
                                  onClick={() => handleStructDeleteCompany(c.id)} 
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg text-rose-500 cursor-pointer transition-all"
                                  title={isRtl ? 'حذف الشركة بالكامل' : 'Delete Company'}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredCompanies.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              <Building2 size={24} className="mx-auto mb-2 text-slate-300" />
                              <span>{isRtl ? 'لم يتم العثور على أي شركات مطابقة.' : 'No matching companies found.'}</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {structureTab === 'regions' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => startStructAddRegionForCompany(structSelectedCompanyId)}
                      className="px-3.5 py-1.5 bg-[#2451B8] text-white rounded-lg text-xs font-bold hover:bg-[#1d429a] transition-all flex items-center gap-1 shadow-md cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{isRtl ? 'إضافة قطاع/منطقة جديدة' : 'Add Region'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border rounded-xl bg-white dark:bg-slate-900 mt-2">
                    <table className="w-full text-xs text-left min-w-[550px]" dir={isRtl ? 'rtl' : 'ltr'}>
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                        <tr>
                          <th className="p-3">ID</th>
                          <th className="p-3">{isRtl ? 'المنطقة' : 'Region'}</th>
                          <th className="p-3">{isRtl ? 'الشركة التابعة له' : 'Affiliated Company'}</th>
                          <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {regions.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono text-slate-400">{r.id}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{r.name}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">{companies.find(c => c.id === r.company_id)?.name || r.company_id}</td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => startStructEditRegion(r)} className="p-1 hover:bg-[#2451B8]/10 rounded text-[#2451B8] dark:text-blue-400 cursor-pointer"><Edit size={14} /></button>
                                <button onClick={() => handleStructDeleteRegion(r.id)} className="p-1 hover:bg-rose-50 rounded text-rose-500 cursor-pointer"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {structureTab === 'stations' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => startStructAddStationForRegion('none', structSelectedCompanyId)}
                      className="px-3.5 py-1.5 bg-[#2451B8] text-white rounded-lg text-xs font-bold hover:bg-[#1d429a] transition-all flex items-center gap-1 shadow-md cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{isRtl ? 'إضافة محطة/فرع عهدة جديدة' : 'Add Station'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border rounded-xl bg-white dark:bg-slate-900 mt-2">
                    <table className="w-full text-xs text-left min-w-[650px]" dir={isRtl ? 'rtl' : 'ltr'}>
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                        <tr>
                          <th className="p-3">ID</th>
                          <th className="p-3">{isRtl ? 'اسم الفرع/المحطة' : 'Station/Branch'}</th>
                          <th className="p-3">{isRtl ? 'مركز كلفة العهدة' : 'Cost Center'}</th>
                          <th className="p-3">{isRtl ? 'المبلغ الكلي للعهدة' : 'Custody Amount'}</th>
                          <th className="p-3">{isRtl ? 'المنطقة' : 'Region'}</th>
                          <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {stations.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono text-slate-400">{s.id}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{s.station_name}</td>
                            <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-450">{s.station_code}</td>
                            <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{CustodyDB.getStationDeductedCustody(s.id).toLocaleString()} EGP</td>
                            <td className="p-3">
                              {s.region_id ? (
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {regions.find(r => r.id === s.region_id)?.name || s.region_id}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                                  {isRtl ? 'مباشر - بدون منطقة' : 'Direct - No Region'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => startStructEditStation(s)} className="p-1 hover:bg-[#2451B8]/10 rounded text-[#2451B8] dark:text-blue-400 cursor-pointer"><Edit size={14} /></button>
                                <button onClick={() => handleStructDeleteStation(s.id)} className="p-1 hover:bg-rose-50 rounded text-rose-500 cursor-pointer"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
