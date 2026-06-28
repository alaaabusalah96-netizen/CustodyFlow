import React, { useState, useEffect } from 'react';
import { CustodyDB } from './db';
import { AppUser, Language, Theme, Transaction } from './types';
import Layout from './components/Layout';

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

export default function App() {
  // Try to load any existing active session, or default to null
  const [activeUser, setActiveUser] = useState<AppUser | null>(() => {
    // If we want the app to start with standard Login view, we don't auto-seed active_user in DB initially.
    // Let's check what is in localStorage.
    try {
      const stored = localStorage.getItem('custody_active_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('light');

  // Shared state: transaction pre-selected for voucher settlement
  const [selectedPendingTx, setSelectedPendingTx] = useState<Transaction | null>(null);

  const [dbVersion, setDbVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setDbVersion(prev => prev + 1);
      
      // Update local user state in case permission configurations or roles change
      const stored = localStorage.getItem('custody_active_user');
      if (stored) {
        try {
          setActiveUser(JSON.parse(stored));
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
    setCurrentTab('dashboard');
  };

  const handleLogout = () => {
    CustodyDB.setActiveUser(null);
    setActiveUser(null);
    setSelectedPendingTx(null);
  };

  const handleSelectTxForSettle = (tx: Transaction) => {
    setSelectedPendingTx(tx);
  };

  // Main Page Router Dispatcher
  const renderPage = () => {
    switch (currentTab) {
      case 'dashboard':
        if (activeUser?.role === 'RegionalManager') {
          return (
            <RegionalDashboard
              language={language}
              theme={theme}
              setCurrentTab={setCurrentTab}
              setSelectedStationId={setSelectedStationId}
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
            stationId={selectedStationId || 'stn-1'}
            language={language}
            theme={theme}
            onBack={() => setCurrentTab('stations')}
          />
        );
      case 'new-expense':
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
        return (
          <CashReconciliation 
            language={language} 
            theme={theme} 
            onNavigate={setCurrentTab}
            onSelectTransactionForSettle={handleSelectTxForSettle}
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
      default:
        if (activeUser?.role === 'RegionalManager') {
          return (
            <RegionalDashboard
              language={language}
              theme={theme}
              setCurrentTab={setCurrentTab}
              setSelectedStationId={setSelectedStationId}
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

  // If user is not logged in, force Login screen
  if (!activeUser) {
    return (
      <Login
        language={language}
        setLanguage={setLanguage}
        theme={theme}
        onLoginSuccess={handleLoginSuccess}
      />
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
      <div key={dbVersion}>
        {renderPage()}
      </div>
    </Layout>
  );
}
