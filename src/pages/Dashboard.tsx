import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Clock, 
  FileCheck, 
  Activity, 
  TrendingDown, 
  Coins, 
  AlertTriangle,
  History,
  Trash2,
  Printer,
  CornerUpLeft,
  Search,
  Filter,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, Transaction, Station } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import VoucherModal from '../components/VoucherModal';

interface DashboardProps {
  language: Language;
  theme: Theme;
  onNavigate: (tab: string) => void;
  onSelectTransactionForSettle?: (tx: Transaction) => void;
}

export default function Dashboard({ 
  language, 
  theme, 
  onNavigate,
  onSelectTransactionForSettle 
}: DashboardProps) {
  const t = translations[language];
  const isRtl = language === 'ar';
  const user = CustodyDB.getActiveUser();
  const allStations = CustodyDB.getScopedStations();
  const isAdmin = user && (user.role === 'Admin' || user.role === 'SystemAdmin');

  // Local state for instant reactivity
  const [metrics, setMetrics] = useState(() => CustodyDB.getReconciliation());
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [logs, setLogs] = useState(() => CustodyDB.getLogs().slice(0, 5));

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Feedback state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revertingTx, setRevertingTx] = useState<Transaction | null>(null);
  const [printingTx, setPrintingTx] = useState<Transaction | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshData = () => {
    setMetrics(CustodyDB.getReconciliation());
    setAllTransactions(CustodyDB.getScopedTransactions());
    setLogs(CustodyDB.getLogs().slice(0, 5));
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Delete handler
  const handleDelete = (id: string) => {
    const success = CustodyDB.deleteTransaction(id);
    if (success) {
      showToast(isRtl ? 'تم حذف الحركة والعملية بالكامل بنجاح.' : 'Transaction successfully deleted.');
      refreshData();
      setDeletingId(null);
    } else {
      setAuthError(isRtl ? 'عذراً، يحتاج الحذف إلى صلاحيات مدير النظام (Admin)' : 'Unauthorized: Deletion requires Admin permissions.');
      setDeletingId(null);
    }
  };

  // Revert settlement status
  const handleRevert = (tx: Transaction) => {
    CustodyDB.updateTransaction(tx.id, {
      status: 'Pending',
      voucher_no: undefined,
      voucher_date: undefined
    });
    // Additional log for revert
    CustodyDB.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Revert Settlement',
      `Reverted transaction ${tx.transaction_no} (formerly voucher ${tx.voucher_no}) back to Pending status.`
    );
    showToast(isRtl ? 'تم إلغاء تسوية الحركة بنجاح وإعادتها كمعلقة.' : 'Settlement cancelled. Transaction reverted to Pending.');
    refreshData();
    setRevertingTx(null);
  };

  // Start settlement
  const handleStartSettle = (tx: Transaction) => {
    if (onSelectTransactionForSettle) {
      onSelectTransactionForSettle(tx);
      onNavigate('voucher');
    } else {
      // Fallback: quick settle
      const tempVoucherNo = 'TEMP-' + Math.floor(1000 + Math.random() * 9000);
      const tempDate = new Date().toISOString().split('T')[0];
      CustodyDB.updateTransaction(tx.id, {
        status: 'Under Settlement',
        voucher_no: tempVoucherNo,
        voucher_date: tempDate
      });
      showToast(isRtl ? 'تم عمل تسوية سريعة للمستند بنجاح.' : 'Quick voucher generated successfully.');
      refreshData();
    }
  };

  // Station Spend Chart calculation
  const stationSpendMap = new Map<string, number>();
  allTransactions.forEach(tx => {
    stationSpendMap.set(tx.station_id, (stationSpendMap.get(tx.station_id) || 0) + tx.amount);
  });

  const chartData = allStations.map((st, idx) => {
    const amount = stationSpendMap.get(st.id) || 0;
    return {
      name: st.station_name,
      amount,
      color: [
        '#10b981', // emerald
        '#3b82f6', // blue
        '#f59e0b', // amber
        '#ef4444', // red
        '#8b5cf6', // violet
        '#ec4899'  // pink
      ][idx % 6]
    };
  }).filter(item => item.amount > 0);

  const finalChartData = chartData.length > 0 ? chartData : [
    { name: isRtl ? 'لا توجد حركات بعد' : 'No movements yet', amount: 0, color: '#94a3b8' }
  ];

  const formatCurrency = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EGP';
  };

  // Filter transaction lists for unified view
  const pendingTxs = allTransactions.filter(tx => {
    if (tx.status !== 'Pending') return false;
    const matchesSearch = 
      tx.transaction_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const underSettlementTxs = allTransactions.filter(tx => {
    if (tx.status !== 'Under Settlement') return false;
    const matchesSearch = 
      tx.transaction_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.voucher_no && tx.voucher_no.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Upper Welcome Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">
            {t.dashboard}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isRtl 
              ? 'مراجعة الموقف المالي الفوري وصحة تسوية عهدة النقدية للشركة.' 
              : 'Review live financial standing and settlement status of the corporate cash custody.'
            }
          </p>
        </div>
        <div className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start md:self-auto mt-2 md:mt-0">
          {isRtl ? 'تاريخ النظام:' : 'System Date:'} 2026-06-26 11:32 UTC
        </div>
      </div>

      {/* Dynamic Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 z-50 p-4 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Dynamic KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Custody Value */}
        <div className={`p-5 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.custodyValue}</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Coins size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold font-mono tracking-tight md:text-2xl text-indigo-600 dark:text-indigo-400">
              {formatCurrency(metrics.custodyValue)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            {isRtl ? 'القيمة الإسمية المعتمدة للعهدة' : 'Approved nominal custody value'}
          </div>
        </div>

        {/* Cash Available */}
        <div className={`p-5 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.cashAvailable}</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold font-mono tracking-tight md:text-2xl text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.cashAvailable)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${metrics.cashAvailable < 5000 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>
              {isRtl 
                ? `النقدية المتوفرة حالياً بالخزينة` 
                : `Actual cash inside safety deposit box`
              }
            </span>
          </div>
        </div>

        {/* Pending Total */}
        <div 
          className={`p-5 rounded-2xl border transition-all ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.pendingTotal}</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold font-mono tracking-tight md:text-2xl text-amber-600 dark:text-amber-400">
              {formatCurrency(metrics.pendingTotal)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            <span>{t.pendingCount}: {metrics.pendingCount}</span>
          </div>
        </div>

        {/* Under Settlement Total */}
        <div 
          className={`p-5 rounded-2xl border transition-all ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.underSettlementTotal}</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold font-mono tracking-tight md:text-2xl text-blue-600 dark:text-blue-400">
              {formatCurrency(metrics.underSettlementTotal)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            <span>{t.underSettlementCount}: {metrics.underSettlementCount}</span>
          </div>
        </div>
      </div>

      {/* QUICK FILTER BAR ON DASHBOARD */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center justify-between ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-indigo-500" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isRtl ? 'البحث والتصفية السريعة للعمليات' : 'Quick Search & Operation Filtering'}
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:max-w-xl">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={isRtl ? 'ابحث برقم الحركة، البيان...' : 'Search by ID, description...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-1.5 pl-9 pr-3 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                theme === 'dark' 
                  ? 'bg-[#0f172a] border-slate-700 text-slate-100 placeholder-slate-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* UNIFIED TABLES SIDE-BY-SIDE OR STACKED ON ONE PAGE */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. PENDING TRANSACTIONS TABLE */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock size={14} />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {isRtl ? 'المعاملات المعلقة بالخزينة' : 'Pending Custody Operations'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">
                {pendingTxs.length} {isRtl ? 'معلقة' : 'Pending'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 font-semibold text-slate-500">{isRtl ? 'رقم الحركة' : 'ID'}</th>
                    <th className="py-2.5 font-semibold text-slate-500">{isRtl ? 'البيان' : 'Description'}</th>
                    <th className="py-2.5 font-semibold text-slate-500 text-right">{isRtl ? 'المبلغ' : 'Amount'}</th>
                    <th className="py-2.5 font-semibold text-slate-500 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingTxs.map((tx) => {
                    const st = allStations.find(s => s.id === tx.station_id);
                    const stationLabel = st ? st.station_name : 'N/A';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          <div>{tx.transaction_no}</div>
                          <div className="text-[9px] text-slate-400 font-normal">{tx.date}</div>
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={tx.description}>
                          <div className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">{stationLabel}</div>
                          <div className="text-[10px] text-slate-500 truncate">{tx.description}</div>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleStartSettle(tx)}
                              className="px-1.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 hover:text-white transition-all flex items-center gap-0.5 font-bold text-[9px]"
                            >
                              <FileCheck size={10} />
                              <span>{isRtl ? 'تسوية' : 'Settle'}</span>
                            </button>
                            <button
                              onClick={() => setDeletingId(tx.id)}
                              className="p-1 rounded bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingTxs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 text-[11px]">
                        {isRtl ? 'لا توجد معاملات معلقة.' : 'No pending transactions.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. TRANSACTIONS UNDER SETTLEMENT TABLE */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <FileCheck size={14} />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {isRtl ? 'مستندات الصرف تحت التسوية' : 'Vouchers Under Settlement'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">
                {underSettlementTxs.length} {isRtl ? 'مستند' : 'Vouchers'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 font-semibold text-slate-500">{isRtl ? 'رقم السند' : 'Voucher No'}</th>
                    <th className="py-2.5 font-semibold text-slate-500">{isRtl ? 'البيان' : 'Description'}</th>
                    <th className="py-2.5 font-semibold text-slate-500 text-right">{isRtl ? 'المبلغ' : 'Amount'}</th>
                    <th className="py-2.5 font-semibold text-slate-500 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {underSettlementTxs.map((tx) => {
                    const st = allStations.find(s => s.id === tx.station_id);
                    const stationLabel = st ? st.station_name : 'N/A';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          <div>{tx.voucher_no || 'N/A'}</div>
                          <div className="text-[9px] text-slate-400 font-normal">{tx.voucher_date || tx.date}</div>
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={tx.description}>
                          <div className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">{stationLabel}</div>
                          <div className="text-[10px] text-slate-500 truncate">{tx.description}</div>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setPrintingTx(tx)}
                              className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-0.5 font-bold text-[9px]"
                            >
                              <Printer size={10} />
                              <span>{isRtl ? 'سند' : 'Voucher'}</span>
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setRevertingTx(tx)}
                                  className="px-1 py-0.5 rounded bg-amber-500/10 hover:bg-amber-600 text-amber-600 hover:text-white transition-all flex items-center gap-0.5 font-bold text-[9px]"
                                >
                                  <CornerUpLeft size={10} />
                                  <span>{isRtl ? 'إرجاع' : 'Revert'}</span>
                                </button>
                                <button
                                  onClick={() => setDeletingId(tx.id)}
                                  className="p-1 rounded bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white transition-all"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {underSettlementTxs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 text-[11px]">
                        {isRtl ? 'لا توجد معاملات تحت التسوية.' : 'No vouchers under settlement.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* CHART & RECENT LOGS SECTION */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* spend station pie/bar distribution */}
        <div className={`lg:col-span-2 p-5 rounded-2xl border flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              {isRtl ? 'تحليل المصروفات حسب المحطة' : 'Expense Distribution by Station'}
            </h3>
          </div>
          
          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <AlertTriangle size={32} className="mb-2 text-slate-300" />
                <p className="text-xs">{isRtl ? 'لا توجد حركات مصروفة حتى الآن لعرضها بيانيا.' : 'No active expenses logged yet to display on chart.'}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                      color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                    formatter={(value) => [`${value.toLocaleString()} EGP`, isRtl ? 'القيمة' : 'Amount']}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {finalChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 justify-center border-t pt-3 border-slate-100 dark:border-slate-800">
            {finalChartData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-500 dark:text-slate-400 font-medium">{item.name}:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {item.amount.toLocaleString()} EGP
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log / Activity Tracking Column */}
        <div className={`p-5 rounded-2xl border ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 mb-4 border-b pb-3 border-slate-100 dark:border-slate-800">
            <History size={16} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t.recentLogs}
            </h3>
          </div>

          <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
            {logs.map((log) => (
              <div key={log.id} className="text-xs flex flex-col gap-1 border-b pb-2.5 last:border-0 border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {log.action}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  {log.details}
                </p>
                <div className="text-[10px] font-mono font-medium text-emerald-500/80">
                  By: {log.user_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRINT VOUCHER MODAL */}
      <VoucherModal
        transaction={printingTx}
        isOpen={printingTx !== null}
        onClose={() => setPrintingTx(null)}
        theme={theme}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base">{isRtl ? 'تأكيد الحذف النهائي' : 'Confirm Permanent Delete'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {isRtl 
                ? 'هل أنت متأكد من رغبتك في حذف هذه الحركة نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to permanently delete this transaction from the database? This action cannot be undone.'}
              {user?.role !== 'Admin' && user?.role !== 'SystemAdmin' && (
                <span className="block text-rose-500 font-bold mt-2">
                  * {isRtl ? 'تنبيه: يتطلب صلاحية أدمن عام أو أدمن الشركة لإتمام الحذف.' : 'Note: Requires System Admin or Company Admin credentials.'}
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 ${theme === 'dark' ? 'hover:bg-slate-800' : ''}`}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white"
              >
                {isRtl ? 'حذف نهائي' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVERT CONFIRMATION DIALOG */}
      {revertingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3 text-amber-500 mb-3">
              <CornerUpLeft className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base">{isRtl ? 'إلغاء تسوية المستند' : 'Revert Settlement'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {isRtl 
                ? `هل أنت متأكد من رغبتك في إلغاء تسوية المستند رقم (${revertingTx.voucher_no || revertingTx.transaction_no}) وإعادته كحركة معلقة بالخزينة؟`
                : `Are you sure you want to cancel the settlement for voucher (${revertingTx.voucher_no || revertingTx.transaction_no}) and revert it to a pending cash operation?`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRevertingTx(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 ${theme === 'dark' ? 'hover:bg-slate-800' : ''}`}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleRevert(revertingTx)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isRtl ? 'تأكيد الإرجاع' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTH ERROR DIALOG */}
      {authError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base">{isRtl ? 'خطأ في الصلاحيات' : 'Authorization Denied'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {authError}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setAuthError(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white"
              >
                {isRtl ? 'حسناً' : 'Okay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
