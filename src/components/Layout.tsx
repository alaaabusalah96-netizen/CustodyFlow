import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Clock, 
  FileCheck, 
  TrendingUp, 
  FileText, 
  Search as SearchIcon, 
  Settings as SettingsIcon, 
  LogOut, 
  Sun, 
  Moon, 
  Languages, 
  Coins, 
  User as UserIcon,
  Building,
  Layers,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  ChevronUp,
  UserCheck,
  Trash2,
  Fuel
} from 'lucide-react';
import { CustodyDB, ModulesModule } from '../db';
import { translations, Language, Theme, AppUser } from '../types';

interface LayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  activeUser: AppUser | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({
  currentTab,
  setCurrentTab,
  language,
  setLanguage,
  theme,
  setTheme,
  activeUser,
  onLogout,
  children
}: LayoutProps) {
  const t = translations[language];
  const isRtl = language === 'ar';
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  // User Affiliations for clear display
  const companiesList = React.useMemo(() => CustodyDB.getCompanies(), []);
  const regionsList = React.useMemo(() => CustodyDB.getRegions(), []);
  const stationsList = React.useMemo(() => CustodyDB.getStations(), []);

  const userComp = activeUser ? companiesList.find(c => c.id === activeUser.company_id) : null;
  const userStation = activeUser ? stationsList.find(s => s.id === activeUser.station_id) : null;
  const userRegionId = activeUser?.region_id || userStation?.region_id;
  const userRegion = userRegionId ? regionsList.find(r => r.id === userRegionId) : null;
  const homeTab = activeUser?.role === 'SystemAdmin' ? 'super-admin' : (activeUser?.role === 'Admin' ? 'company-admin' : (activeUser?.role === 'RegionalManager' ? 'region-admin' : 'reconciliation'));

  // Auto-close sidebar on mobile/tablet screen sizes on initial mount
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // Get live available cash metrics for header badge
  const metrics = CustodyDB.getReconciliation();
  const config = CustodyDB.getConfig();

  const menuItems = [
    { id: 'super-admin', label: isRtl ? 'لوحة تحكم الساس SaaS' : 'SaaS Super Admin', icon: ShieldCheck, roleAllowed: ['SystemAdmin'] },
    { id: 'company-admin', label: isRtl ? 'لوحة تحكم الشركة' : 'Company Dashboard', icon: Building, roleAllowed: ['Admin'] },
    { id: 'region-admin', label: isRtl ? 'لوحة تحكم المنطقة' : 'Region Dashboard', icon: Layers, roleAllowed: ['RegionalManager'] },
    { id: 'new-expense', label: t.newExpense, icon: PlusCircle, permission: 'create_expense' },
    { id: 'voucher', label: t.cashPaymentVoucher, icon: FileCheck, permission: 'settle_voucher' },
    { id: 'reconciliation', label: isRtl ? 'جرد ومطابقة العهدة' : 'Custody Reconciliation & Inventory', icon: TrendingUp, roleAllowed: ['Admin', 'StationAdmin', 'RegionalManager'] },
    { id: 'inventory', label: isRtl ? 'إدارة المخازن والمستودعات' : 'Inventory & Warehouses', icon: Layers, roleAllowed: ['SystemAdmin', 'Admin', 'RegionalManager', 'StationAdmin'] },
    { id: 'fuel-comparison', label: isRtl ? 'مقارنة السولار والتحليلات' : 'Fuel Comparison & Analytics', icon: Fuel, permission: 'view_reports', roleAllowed: ['SystemAdmin', 'Admin', 'RegionalManager', 'StationAdmin'] },
    { id: 'reports', label: t.reports, icon: FileText, permission: 'view_reports' },
    { id: 'search', label: t.search, icon: SearchIcon },
    { id: 'audit-log', label: isRtl ? 'سجل الرقابة والامتثال' : 'Security & Audit Log', icon: ShieldCheck, roleAllowed: ['Admin', 'SystemAdmin'] },
    { id: 'settings', label: t.settings, icon: SettingsIcon, permission: 'manage_settings' },
  ];

  // Filter menu items by user permissions and roleAllowed scopes
  const filteredMenuItems = menuItems.filter(item => {
    if (!activeUser) return false;
    
    // Check if the screen/item belongs to an enabled module for the user's company
    if (activeUser.company_id && !ModulesModule.isScreenEnabledForCompany(activeUser.company_id, item.id)) {
      return false;
    }
    
    // Explicitly hide specified features from Admin & SystemAdmin
    if (activeUser.role === 'SystemAdmin') {
      if (item.id === 'new-expense' || item.id === 'voucher' || item.id === 'reconciliation') {
        return false;
      }
    }
    if (activeUser.role === 'Admin') {
      if (item.id === 'new-expense' || item.id === 'voucher') {
        return false;
      }
    }
    
    if (item.roleAllowed && !item.roleAllowed.includes(activeUser.role)) {
      return false;
    }
    
    if (item.permission) {
      const permKey = item.permission as keyof typeof activeUser.permissions;
      return activeUser.permissions[permKey];
    }
    return true;
  });

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div 
      id="app-root-container"
      className={`min-h-screen w-full max-w-full overflow-x-hidden font-sans transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Navigation Bar */}
      <header 
        id="app-header"
        className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 md:px-6 transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#1e293b]/95 border-[#334155] backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md'
        }`}
      >
        <div className="flex items-center gap-3">
          <button 
            id="toggle-sidebar-mobile"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg hover:bg-slate-100 ${theme === 'dark' ? 'hover:bg-slate-800' : ''}`}
            aria-label="Toggle Sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              {activeUser?.role === 'SystemAdmin' ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={CustodyDB.getSelectedCompanyId()}
                    onChange={(e) => {
                      CustodyDB.setSelectedCompanyId(e.target.value);
                      window.location.reload();
                    }}
                    className={`text-xs font-bold border rounded-lg px-1.5 py-1 max-w-[110px] xs:max-w-[140px] sm:max-w-[200px] md:max-w-none truncate focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      theme === 'dark' ? 'text-slate-100 bg-[#1e293b] border-[#334155]' : 'text-slate-800 bg-white border-slate-200'
                    }`}
                  >
                    {CustodyDB.getCompanies().map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                  <span className="hidden xs:inline-block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">
                    {isRtl ? 'مشرف عام المنصة' : 'Platform Admin'}
                  </span>
                </div>
              ) : (
                <h1 className="text-xs sm:text-sm md:text-lg font-bold tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-none">
                  {config.company_name}
                </h1>
              )}
              <p className="hidden md:block text-[8px] sm:text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-semibold mt-0.5 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-none">
                {t.loginSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Header Stats & Utilities */}
        <div className="flex items-center gap-1.5 md:gap-4">
          {/* Cloud Sync Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold font-mono bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-duration-1000"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>{isRtl ? 'سحابي نشط' : 'LIVE CLOUD'}</span>
          </div>

          {/* Quick Cash available info */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-slate-500 dark:text-slate-400">{t.cashAvailable}:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
              {metrics.cashAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
            </span>
          </div>

          {/* Theme Switcher */}
          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors border ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-amber-400' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
            }`}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language Switcher hidden to keep app Arabic only */}

          {/* User Profile Info */}
          {activeUser && (
            <div className={`flex items-center gap-2 border-l pl-2 md:pl-4 ${isRtl ? 'border-r pr-2 md:pr-4 border-l-0' : 'border-l pl-2 md:pl-4'} border-slate-200 dark:border-slate-700`}>
              <div className="hidden md:block text-right">
                <div className="text-xs font-bold">{activeUser.full_name}</div>
                <div className="flex flex-col items-end gap-1 mt-1">
                  <div className={`text-[9px] inline-block px-1.5 py-0.5 rounded font-mono font-bold leading-none ${
                    activeUser.role === 'SystemAdmin'
                      ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                      : activeUser.role === 'Admin'
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                        : activeUser.role === 'RegionalManager'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {activeUser.role === 'SystemAdmin'
                      ? (isRtl ? 'أدمن منصة' : 'Platform Admin')
                      : activeUser.role === 'Admin'
                        ? (isRtl ? 'أدمن الشركة' : 'Company Admin')
                        : activeUser.role === 'RegionalManager'
                          ? (isRtl ? 'مدير منطقة' : 'Regional Manager')
                          : (isRtl ? 'مدير محطة (أمين عهدة)' : 'Station Manager')
                    }
                  </div>
                  
                  {/* Affiliation info next to role */}
                  {activeUser.role === 'Admin' && userComp && (
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                      🏢 {userComp.name}
                    </span>
                  )}
                  {activeUser.role === 'RegionalManager' && (userRegion || userComp) && (
                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                      🌍 {userRegion?.name || ''} {userComp ? `| 🏢 ${userComp.name}` : ''}
                    </span>
                  )}
                  {activeUser.role === 'StationAdmin' && (userStation || userComp) && (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                      📍 {userStation?.station_name || ''} {userComp ? `| 🏢 ${userComp.name}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                id="btn-logout"
                onClick={onLogout}
                className={`p-2 rounded-lg border transition-colors text-rose-500 ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 hover:bg-rose-500/10' 
                    : 'bg-white border-slate-200 hover:bg-rose-50'
                }`}
                title={t.logout}
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex w-full max-w-full overflow-x-hidden">
        {/* Mobile Sidebar Backdrop Overlay */}
        {sidebarOpen && (
          <div 
            id="sidebar-mobile-backdrop"
            className="fixed inset-0 top-16 bg-slate-900/40 backdrop-blur-[1px] z-10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          id="app-sidebar"
          className={`fixed inset-y-16 bottom-0 z-20 flex w-64 flex-col border-r transition-all duration-300 ${
            isRtl ? 'right-0 border-l border-r-0' : 'left-0 border-r'
          } ${
            sidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'
          } ${
            theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200'
          }`}
        >
          {/* Main Menu Links */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  id={`nav-item-${item.id}`}
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setSidebarOpen(false); // Auto-close sidebar on mobile/desktop after selection
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/10'
                      : theme === 'dark'
                        ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Info Footer */}
          <div className={`p-4 border-t text-[11px] font-mono text-slate-400 text-center ${
            theme === 'dark' ? 'border-[#1e293b]' : 'border-slate-100'
          }`}>
            <div className="font-semibold text-emerald-500 uppercase tracking-wider mb-1">
              {t.title}
            </div>
            <div>
              ERP Custody v2.6
            </div>
            <div className="mt-1">
              &copy; 2026 {t.allRightsReserved}
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main
          id="app-main-content-wrapper"
          className={`flex-1 min-w-0 max-w-full overflow-hidden min-h-[calc(100vh-4rem)] transition-all duration-300 ${
            currentTab === 'fuel-comparison' ? 'p-0' : 'p-4 md:p-6'
          } ${
            sidebarOpen 
              ? isRtl ? 'lg:mr-64 mr-0' : 'lg:ml-64 ml-0' 
              : 'm-0'
          }`}
        >
          {/* Support Session Impersonation Banner */}
          {activeUser?.impersonator && currentTab !== 'fuel-comparison' && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-rose-500">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 rounded-full bg-white animate-ping shrink-0" />
                <div className="text-xs">
                  <p className="font-extrabold text-sm">
                    {isRtl 
                      ? `⚠️ جلسة دعم فني نشطة للمدير العام: أنت منتحل هوية [${activeUser.full_name}]`
                      : `⚠️ Active Technical Support Session: Impersonating [${activeUser.full_name}]`
                    }
                  </p>
                  <p className="opacity-90 font-mono mt-0.5 text-[10px]">
                    {isRtl
                      ? `المشرف الأصلي: ${activeUser.impersonator.full_name} | جميع الإجراءات مسجلة ومؤمنة في سجل الرقابة والامتثال.`
                      : `Original Admin: ${activeUser.impersonator.full_name} | All actions are securely logged in the audit registry.`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  CustodyDB.exitImpersonation();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-white text-rose-600 font-extrabold rounded-xl hover:bg-slate-100 transition-all text-xs shrink-0 cursor-pointer shadow-lg active:scale-95 flex items-center gap-1.5"
              >
                <LogOut size={14} />
                <span>{isRtl ? 'إنهاء جلسة الدعم والعودة للوحة SaaS' : 'Exit & Return to SaaS'}</span>
              </button>
            </div>
          )}

          {/* Quick Alert if custody gets low */}
          {metrics.cashAvailable < 5000 && currentTab !== 'fuel-comparison' && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                {isRtl 
                  ? `تحذير: رصيد العهدة المتوفر منخفض حالياً (${metrics.cashAvailable.toLocaleString()} ج.م). يرجى تقديم طلب تسوية قريباً.`
                  : `Alert: Low custody balance available (${metrics.cashAvailable.toLocaleString()} EGP). Please process outstanding settlements soon.`
                }
              </span>
            </div>
          )}

          {/* Children container */}
          {currentTab === 'fuel-comparison' ? (
            children
          ) : (
            <div className="max-w-7xl mx-auto">
              {currentTab !== homeTab && (
                <button
                  id="btn-back-to-home-global"
                  onClick={() => setCurrentTab(homeTab)}
                  className={`mb-6 inline-flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-black rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
                    theme === 'dark'
                      ? 'bg-[#1e293b] border-[#334155] hover:bg-slate-800 text-slate-200 hover:text-white'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-950'
                  }`}
                >
                  <LayoutDashboard size={16} className="text-emerald-500" />
                  <span>{isRtl ? 'العودة إلى الصفحة الرئيسية' : 'Back to Home'}</span>
                </button>
              )}
              {children}
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
