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
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import { CustodyDB } from '../db';
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
  const [roleSwitcherOpen, setRoleSwitcherOpen] = React.useState(false);

  // Auto-close sidebar on mobile/tablet screen sizes on initial mount
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // Get live available cash metrics for header badge
  const metrics = CustodyDB.getReconciliation();
  const config = CustodyDB.getConfig();

  // Get unique users and sort them so that all roles are easily testable
  const rawUsers = CustodyDB.getUsers();
  const switcherUsers = React.useMemo(() => {
    // 1. Remove duplicate emails
    const uniqueMap = new Map<string, AppUser>();
    rawUsers.forEach(u => {
      if (u.email) {
        const key = u.email.toLowerCase().trim();
        // Keep the one with SystemAdmin or Admin if there are multiple
        const existing = uniqueMap.get(key);
        if (!existing || (u.role === 'SystemAdmin' && existing.role !== 'SystemAdmin')) {
          uniqueMap.set(key, u);
        }
      } else {
        uniqueMap.set(u.id, u);
      }
    });

    const uniqueList = Array.from(uniqueMap.values());

    // 2. Sort by role precedence
    const roleOrder = {
      'SystemAdmin': 1,
      'Admin': 2,
      'RegionalManager': 3,
      'StationAdmin': 4
    };

    return uniqueList.sort((a, b) => {
      const orderA = roleOrder[a.role as keyof typeof roleOrder] || 99;
      const orderB = roleOrder[b.role as keyof typeof roleOrder] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.full_name.localeCompare(b.full_name);
    });
  }, [rawUsers]);

  const menuItems = [
    { id: 'dashboard', label: activeUser?.role === 'RegionalManager' ? (isRtl ? 'لوحة المتابعة الإقليمية' : 'Regional Overview') : t.dashboard, icon: LayoutDashboard },
    { id: 'stations', label: isRtl ? 'دليل المحطات والعهد' : 'Stations Directory', icon: Building, roleAllowed: ['RegionalManager', 'Admin', 'SystemAdmin'] },
    { id: 'new-expense', label: t.newExpense, icon: PlusCircle, permission: 'create_expense' },
    { id: 'voucher', label: t.cashPaymentVoucher, icon: FileCheck, permission: 'settle_voucher' },
    { id: 'reconciliation', label: isRtl ? 'جرد ومطابقة العهدة' : 'Custody Reconciliation & Inventory', icon: TrendingUp, roleAllowed: ['StationAdmin', 'Admin', 'SystemAdmin'] },
    { id: 'reports', label: t.reports, icon: FileText, permission: 'view_reports' },
    { id: 'search', label: t.search, icon: SearchIcon },
    { id: 'settings', label: t.settings, icon: SettingsIcon, permission: 'manage_settings' },
  ];

  // Filter menu items by user permissions and roleAllowed scopes
  const filteredMenuItems = menuItems.filter(item => {
    if (!activeUser) return false;
    
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              {activeUser?.role === 'SystemAdmin' ? (
                <div className="flex items-center gap-2">
                  <select
                    value={CustodyDB.getSelectedCompanyId()}
                    onChange={(e) => {
                      CustodyDB.setSelectedCompanyId(e.target.value);
                      window.location.reload();
                    }}
                    className={`text-xs font-bold border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      theme === 'dark' ? 'text-slate-100 bg-[#1e293b] border-[#334155]' : 'text-slate-800 bg-white border-slate-200'
                    }`}
                  >
                    {CustodyDB.getCompanies().map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                    {isRtl ? 'مشرف عام المنصة' : 'Platform Admin'}
                  </span>
                </div>
              ) : (
                <h1 className="text-xs sm:text-sm md:text-lg font-bold tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-none">
                  {config.company_name}
                </h1>
              )}
              <p className="text-[8px] sm:text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-semibold mt-0.5 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-none">
                {t.loginSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Header Stats & Utilities */}
        <div className="flex items-center gap-2 md:gap-4">
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
          className={`flex-1 p-4 md:p-6 min-h-[calc(100vh-4rem)] transition-all duration-300 ${
            sidebarOpen 
              ? isRtl ? 'lg:mr-64 mr-0' : 'lg:ml-64 ml-0' 
              : 'm-0'
          }`}
        >
          {/* Quick Alert if custody gets low */}
          {metrics.cashAvailable < 5000 && (
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
          <div className="max-w-7xl mx-auto">
            {currentTab !== 'dashboard' && (
              <button
                id="btn-back-to-home-global"
                onClick={() => setCurrentTab('dashboard')}
                className={`mb-6 inline-flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-black rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
                  theme === 'dark'
                    ? 'bg-[#1e293b] border-[#334155] hover:bg-slate-800 text-slate-200 hover:text-white'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-950'
                }`}
              >
                <LayoutDashboard size={16} className="text-emerald-500" />
                <span>العودة إلى لوحة التحكم الرئيسية</span>
              </button>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Try System Roles Widget */}
      <button
        onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-indigo-500/20 transition-all font-black text-xs md:text-sm cursor-pointer border border-indigo-500/30"
      >
        <Sparkles size={16} className="animate-pulse" />
        <span>{isRtl ? 'تجربة جميع الأدوار ⚡' : 'Try System Roles ⚡'}</span>
        <ChevronUp size={14} className={`transition-transform duration-200 ${roleSwitcherOpen ? 'rotate-180' : ''}`} />
      </button>

      {roleSwitcherOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-40"
            onClick={() => setRoleSwitcherOpen(false)}
          />
          {/* Card */}
          <div 
            className={`fixed bottom-20 left-6 z-50 w-80 max-w-sm rounded-2xl border p-4 shadow-2xl transition-all duration-300 space-y-3 ${
              theme === 'dark' 
                ? 'bg-slate-900/95 border-slate-800 text-slate-100' 
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-indigo-500" />
                  <span>{isRtl ? 'تجربة أدوار النظام المختلفة' : 'Try System Roles'}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isRtl 
                    ? 'اضغط على أي مستخدم لتغيير الصلاحيات والمشاهدة فورياً' 
                    : 'Click any user to switch permissions and views instantly'}
                </p>
              </div>
              <button 
                onClick={() => setRoleSwitcherOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1 font-sans">
              {switcherUsers.map((user) => {
                const isSelected = activeUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      CustodyDB.setActiveUser(user);
                      setCurrentTab('dashboard');
                      setRoleSwitcherOpen(false);
                      window.dispatchEvent(new Event('custody_db_updated'));
                    }}
                    className={`w-full text-right p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 shadow-sm'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="text-right">
                      <div className="text-xs font-black flex items-center gap-1.5">
                        {isSelected && <UserCheck size={12} className="text-indigo-500 shrink-0" />}
                        <span>{user.full_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {user.email}
                      </div>
                    </div>

                    <span className={`text-[9px] font-black font-mono tracking-wide px-2 py-0.5 rounded uppercase shrink-0 ${
                      user.role === 'SystemAdmin'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                        : user.role === 'Admin'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : user.role === 'RegionalManager'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {user.role === 'SystemAdmin'
                        ? (isRtl ? 'أدمن منصة' : 'Platform Admin')
                        : user.role === 'Admin'
                          ? (isRtl ? 'أدمن الشركة' : 'Company Admin')
                          : user.role === 'RegionalManager'
                            ? (isRtl ? 'مدير منطقة' : 'Regional')
                            : (isRtl ? 'مدير محطة' : 'Station Mgr')
                    }
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
