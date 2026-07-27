import React, { useState, useEffect } from 'react';
import { CustodyDB, ModulesModule } from './db';
import { AppUser, Language, Theme, Transaction } from './types';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Layout from './components/Layout';
import { Download, X, Smartphone, ArrowDown, Sparkles, ShieldAlert } from 'lucide-react';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewExpense from './pages/NewExpense';
import PendingTransactions from './pages/PendingTransactions';
import CashPaymentVoucher from './pages/CashPaymentVoucher';
import UnderSettlement from './pages/UnderSettlement';
import CashReconciliation from './pages/CashReconciliation';
import Reports from './pages/Reports';
import Search from './pages/Search';
import Settings from './pages/Settings';
import RegionalDashboard from './pages/RegionalDashboard';
import Stations from './pages/Stations';
import StationDetails from './pages/StationDetails';
import AuditLogView from './pages/AuditLog';
import SuperAdmin from './pages/SuperAdmin';
import CompanyAdminDashboard from './pages/CompanyAdminDashboard';
import RegionAdminDashboard from './pages/RegionAdminDashboard';
import Inventory from './pages/Inventory';
import Purchasing from './pages/Purchasing';
import Accounting from './pages/Accounting';
import SalesAR from './pages/SalesAR';
import POS from './pages/POS';
import CRM from './pages/CRM';
import FixedAssets from './pages/FixedAssets';
import FleetManagement from './pages/FleetManagement';
import HRPayroll from './pages/HRPayroll';
import ApprovalInbox from './components/ApprovalInbox';

export default function App() {
  // Try to load any existing active session, or default to null
  const [activeUser, setActiveUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem('custody_active_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentTab, setCurrentTab] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('custody_active_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) {
          if (parsed.role === 'SystemAdmin') {
            return 'super-admin';
          }
          if (parsed.role === 'Admin') {
            return 'company-admin';
          }
          if (parsed.role === 'RegionalManager') {
            return 'region-admin';
          }
          if (parsed.role !== 'Admin' && parsed.role !== 'SystemAdmin') {
            return 'reconciliation';
          }
        }
      }
    } catch {
      // ignore
    }
    return 'reports';
  });
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('light');

  // Shared state: transaction pre-selected for voucher settlement
  const [selectedPendingTx, setSelectedPendingTx] = useState<Transaction | null>(null);

  const [dbVersion, setDbVersion] = useState(0);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showPwaBanner, setShowPwaBanner] = useState(false);

  useEffect(() => {
    // Detect iOS devices
    const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsIOS(isApple);

    // Only show banner if not in standalone and hasn't dismissed it in this session
    const isDismissed = sessionStorage.getItem('pwa_banner_dismissed') === 'true';
    if (!isStandalone && !isDismissed) {
      // For iOS, show it because we cannot capture beforeinstallprompt
      if (isApple) {
        setShowPwaBanner(true);
      }
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissed && !isStandalone) {
        setShowPwaBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('PWA installation outcome:', outcome);
      if (outcome === 'accepted') {
        setShowPwaBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      alert(
        language === 'ar'
          ? 'لتثبيت التطبيق على جهاز iPhone/iPad:\n1. اضغط على زر "مشاركة" (Share) في أسفل المتصفح.\n2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).\n3. اضغط "إضافة" (Add) في الزاوية العلوية.'
          : 'To install on iPhone/iPad:\n1. Tap the "Share" button at the bottom of Safari.\n2. Scroll down and tap "Add to Home Screen".\n3. Tap "Add" in the top-right corner.'
      );
    }
  };

  const dismissPwaBanner = () => {
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
    setShowPwaBanner(false);
  };

  // Redirect non-admin users if needed
  useEffect(() => {
    if (activeUser) {
      const isAdminOrSystemAdmin = activeUser.role === 'Admin' || activeUser.role === 'SystemAdmin';
      // No redirect needed as reports is default
    }
  }, [activeUser, currentTab]);

  useEffect(() => {
    const handleUpdate = () => {
      setDbVersion(prev => prev + 1);
      
      // Update local user state in case permission configurations or roles change
      const stored = localStorage.getItem('custody_active_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed) {
            setActiveUser(prev => {
              if (!prev || prev.id !== parsed.id || prev.role !== parsed.role || JSON.stringify(prev.permissions) !== JSON.stringify(parsed.permissions) || JSON.stringify(prev.impersonator) !== JSON.stringify(parsed.impersonator)) {
                return parsed;
              }
              return prev;
            });
          }
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener('custody_db_updated', handleUpdate);
    return () => {
      window.removeEventListener('custody_db_updated', handleUpdate);
    };
  }, []);

  // Monitor Firebase auth state to ensure session validity and multi-tenancy sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const stored = localStorage.getItem('custody_active_user');
      let currentLocalUser: AppUser | null = null;
      try {
        currentLocalUser = stored ? JSON.parse(stored) : null;
      } catch (e) {
        currentLocalUser = null;
      }

      if (firebaseUser) {
        // If we are currently impersonating and the impersonator matches the signed-in Firebase user, keep it as-is!
        const isImpersonatingAndValid = currentLocalUser && currentLocalUser.impersonator && 
          currentLocalUser.impersonator.email?.toLowerCase().trim() === firebaseUser.email?.toLowerCase().trim();

        if (isImpersonatingAndValid) {
          // Do nothing, let the user stay in support impersonation session
          return;
        }

        if (!currentLocalUser || currentLocalUser.email?.toLowerCase().trim() !== firebaseUser.email?.toLowerCase().trim()) {
          const users = CustodyDB.getUsers();
          const matchedUser = users.find(u => u.email?.toLowerCase().trim() === firebaseUser.email?.toLowerCase().trim());
          if (matchedUser) {
            // Synchronize ID if needed to enforce rules
            if (matchedUser.id !== firebaseUser.uid) {
              matchedUser.id = firebaseUser.uid;
              await CustodyDB.saveUsers(users.map(u => (u.email?.toLowerCase().trim() === firebaseUser.email?.toLowerCase().trim()) ? { ...u, id: firebaseUser.uid } : u));
            }
            CustodyDB.setActiveUser(matchedUser);
            setActiveUser(matchedUser);
          }
        }
      } else {
        // Firebase says signed out - clear session immediately to prevent local hijacking
        // ONLY if online. If we are offline, preserve the local cached session for full offline operations!
        // Also, do NOT clear the session if the active user is currently in an impersonation session
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          if (currentLocalUser && !currentLocalUser.impersonator) {
            CustodyDB.setActiveUser(null);
            setActiveUser(null);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Apply theme classes to standard document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleLoginSuccess = (user: AppUser) => {
    setActiveUser(user);
    if (user.role === 'SystemAdmin') {
      setCurrentTab('super-admin');
    } else if (user.role === 'Admin') {
      setCurrentTab('company-admin');
    } else if (user.role === 'RegionalManager') {
      setCurrentTab('region-admin');
    } else {
      setCurrentTab('reconciliation');
    }
  };

  const handleLogout = () => {
    CustodyDB.setActiveUser(null);
    setActiveUser(null);
    setSelectedPendingTx(null);
  };

  const handleSelectTxForSettle = (tx: Transaction) => {
    setSelectedPendingTx(tx);
  };

  const renderAccessDenied = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
          {isRtl ? 'غير مصرح بالوصول' : 'Access Denied'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed font-semibold">
          {isRtl 
            ? 'عذراً، تم تقييد هذا الحساب (Company Admin / SaaS Super Admin) من الوصول المباشر لهذه الشاشة للحفاظ على حوكمة فصل المهام وحماية سلامة العهد والقيود المالية.' 
            : 'Access restricted: This role (Company Admin / SaaS Super Admin) is restricted from directly accessing this screen to maintain segregation of duties and financial integrity.'}
        </p>
        <button 
          onClick={() => setCurrentTab(activeUser?.role === 'SystemAdmin' ? 'super-admin' : (activeUser?.role === 'Admin' ? 'reports' : 'reconciliation'))} 
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
        >
          {isRtl ? 'العودة للصفحة الرئيسية' : 'Return to Home'}
        </button>
      </div>
    );
  };

  // Main Page Router Dispatcher
  const renderPage = () => {
    if (activeUser?.company_id && !ModulesModule.isScreenEnabledForCompany(activeUser.company_id, currentTab)) {
      return renderAccessDenied();
    }

    switch (currentTab) {
      case 'dashboard':
        if (activeUser?.role !== 'Admin' && activeUser?.role !== 'SystemAdmin') {
          return (
            <CashReconciliation
              language={language}
              theme={theme}
              onNavigate={setCurrentTab}
              onSelectTransactionForSettle={handleSelectTxForSettle}
            />
          );
        }
        return (
          <Dashboard 
            language={language} 
            theme={theme} 
            onNavigate={setCurrentTab} 
            onSelectTransactionForSettle={handleSelectTxForSettle}
          />
        );
      case 'stations':
        return (
          <Stations
            language={language}
            theme={theme}
            setCurrentTab={setCurrentTab}
            setSelectedStationId={setSelectedStationId}
          />
        );
      case 'station-details':
        return (
          <StationDetails
            stationId={selectedStationId || 'stn-1-1-1'}
            language={language}
            theme={theme}
            onBack={() => setCurrentTab('stations')}
          />
        );
      case 'new-expense':
        if ((activeUser?.role === 'Admin' || activeUser?.role === 'SystemAdmin') && !activeUser?.impersonator) {
          return renderAccessDenied();
        }
        return (
          <NewExpense 
            language={language} 
            theme={theme} 
            onNavigate={setCurrentTab} 
          />
        );
      case 'pending':
        return (
          <PendingTransactions
            language={language}
            theme={theme}
            onNavigate={setCurrentTab}
            onSelectTransactionForSettle={handleSelectTxForSettle}
          />
        );
      case 'voucher':
        if ((activeUser?.role === 'Admin' || activeUser?.role === 'SystemAdmin') && !activeUser?.impersonator) {
          return renderAccessDenied();
        }
        return (
          <CashPaymentVoucher
            language={language}
            theme={theme}
            onNavigate={setCurrentTab}
            selectedTx={selectedPendingTx}
            setSelectedTx={setSelectedPendingTx}
          />
        );
      case 'settled':
        return (
          <UnderSettlement 
            language={language} 
            theme={theme} 
            onNavigate={setCurrentTab} 
          />
        );
      case 'reconciliation':
        if (activeUser?.role === 'SystemAdmin' && !activeUser?.impersonator) {
          return renderAccessDenied();
        }
        return (
          <CashReconciliation 
            language={language} 
            theme={theme} 
            onNavigate={setCurrentTab}
            onSelectTransactionForSettle={handleSelectTxForSettle}
          />
        );
      case 'approvals':
        return (
          <ApprovalInbox
            activeUser={activeUser}
            isRtl={language === 'ar'}
            theme={theme}
          />
        );
      case 'reports':
        return (
          <Reports 
            language={language} 
            theme={theme} 
          />
        );
      case 'search':
        return (
          <Search
            language={language}
            theme={theme}
            onNavigate={setCurrentTab}
            onSelectTransactionForSettle={handleSelectTxForSettle}
          />
        );
      case 'settings':
        return (
          <Settings 
            language={language} 
            theme={theme} 
          />
        );
      case 'audit-log':
        return (
          <AuditLogView
            language={language}
            theme={theme}
          />
        );
      case 'inventory':
        return (
          <Inventory
            language={language}
            theme={theme}
          />
        );
      case 'purchasing':
        return (
          <Purchasing
            language={language}
            theme={theme}
          />
        );
      case 'accounting':
        return (
          <Accounting
            language={language}
            theme={theme}
          />
        );
      case 'sales_ar':
        return (
          <SalesAR
            language={language}
            theme={theme}
          />
        );
      case 'pos':
        return (
          <POS
            language={language}
            theme={theme}
          />
        );
      case 'crm':
        return (
          <CRM
            language={language}
            theme={theme}
          />
        );
      case 'fixed_assets':
        return (
          <FixedAssets
            language={language}
            theme={theme}
          />
        );
      case 'fleet':
        return (
          <FleetManagement
            language={language}
            theme={theme}
          />
        );
      case 'hr_payroll':
        return (
          <HRPayroll
            language={language}
            theme={theme}
          />
        );
      case 'super-admin':
        return (
          <SuperAdmin
            language={language}
            theme={theme}
          />
        );
      case 'company-admin':
        if (activeUser?.role !== 'Admin' && activeUser?.role !== 'SystemAdmin') {
          return renderAccessDenied();
        }
        return (
          <CompanyAdminDashboard
            activeUser={activeUser!}
            language={language}
            theme={theme}
          />
        );
      case 'region-admin':
        if (activeUser?.role !== 'RegionalManager' && activeUser?.role !== 'SystemAdmin') {
          return renderAccessDenied();
        }
        return (
          <RegionAdminDashboard
            activeUser={activeUser!}
            language={language}
            theme={theme}
          />
        );
      default:
        if (activeUser?.role !== 'Admin' && activeUser?.role !== 'SystemAdmin') {
          return (
            <CashReconciliation
              language={language}
              theme={theme}
              onNavigate={setCurrentTab}
              onSelectTransactionForSettle={handleSelectTxForSettle}
            />
          );
        }
        return (
          <Dashboard 
            language={language} 
            theme={theme} 
            onNavigate={setCurrentTab} 
            onSelectTransactionForSettle={handleSelectTxForSettle}
          />
        );
    }
  };

  const isRtl = language === 'ar';

  const renderPwaBanner = () => {
    if (!showPwaBanner) return null;
    return (
      <div 
        dir={isRtl ? 'rtl' : 'ltr'}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-[9999] bg-gradient-to-r from-slate-900/95 to-slate-950/95 border border-emerald-500/30 text-white rounded-2xl p-4 shadow-2xl shadow-emerald-950/30 flex items-start gap-3.5 backdrop-blur-md animate-bounce-subtle"
      >
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 border border-emerald-500/20">
          <Smartphone size={20} className="animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider">
              {isRtl ? 'تثبيت تطبيق KEMIT ERP' : 'Install KEMIT ERP App'}
            </h4>
            <Sparkles size={12} className="text-amber-400" />
          </div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            {isRtl 
              ? 'ثبت التطبيق الآن على جهازك للوصول المباشر السريع بنقرة واحدة وتجربة تصفح مذهلة وفائقة السرعة!'
              : 'Install the app on your device for instant one-tap access and a lightning-fast experience!'}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handlePwaInstall}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/20 active:scale-95 cursor-pointer"
            >
              <Download size={12} />
              <span>{isRtl ? 'تثبيت الآن' : 'Install Now'}</span>
            </button>
            <button
              onClick={dismissPwaBanner}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
            >
              {isRtl ? 'ليس الآن' : 'Not Now'}
            </button>
          </div>
        </div>
        <button 
          onClick={dismissPwaBanner}
          className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/50 transition-all shrink-0 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    );
  };

  // If user is not logged in, force Login screen
  if (!activeUser) {
    return (
      <>
        <Login
          language={language}
          setLanguage={setLanguage}
          theme={theme}
          onLoginSuccess={handleLoginSuccess}
        />
        {renderPwaBanner()}
      </>
    );
  }

  return (
    <Layout
      currentTab={currentTab}
      setCurrentTab={setCurrentTab}
      language={language}
      setLanguage={setLanguage}
      theme={theme}
      setTheme={setTheme}
      activeUser={activeUser}
      onLogout={handleLogout}
    >
      <div>
        {renderPage()}
      </div>
      {renderPwaBanner()}
    </Layout>
  );
}
