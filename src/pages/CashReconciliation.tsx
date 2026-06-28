import React, { useState, useEffect } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, Transaction, ExpenseCategory } from '../types';
import { 
  TrendingUp, 
  Coins, 
  Minus, 
  Equal, 
  Scale, 
  CheckSquare, 
  Printer, 
  Clock,
  FileCheck,
  Search,
  Trash2,
  CornerUpLeft,
  AlertTriangle,
  Info,
  Calendar,
  Filter,
  Plus,
  Check,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import VoucherModal from '../components/VoucherModal';

interface CashReconciliationProps {
  language: Language;
  theme: Theme;
  onNavigate?: (tab: string) => void;
  onSelectTransactionForSettle?: (tx: Transaction) => void;
}

export default function CashReconciliation({ 
  language, 
  theme,
  onNavigate,
  onSelectTransactionForSettle 
}: CashReconciliationProps) {
  const t = translations[language];
  const isRtl = language === 'ar';
  const user = CustodyDB.getActiveUser();
  const stations = CustodyDB.getScopedStations();
  const activeStation = stations.find(s => s.id === user?.station_id);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'SystemAdmin');
  const isManager = user && (user.role === 'RegionalManager' || user.role === 'Admin' || user.role === 'SystemAdmin');

  // Editable inventory/sheet title
  const [sheetTitle, setSheetTitle] = useState(() => {
    const saved = localStorage.getItem('reconciliation_sheet_title');
    if (saved) return saved;
    return activeStation 
      ? `جرد عهدة ${activeStation.station_name}`
      : 'جرد عهدة مزرعة سينا ٢٠٠٠';
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Metrics & transactions
  const [metrics, setMetrics] = useState(() => CustodyDB.getReconciliation());
  const [categories] = useState<ExpenseCategory[]>(() => CustodyDB.getCategories());
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Interactive dialog/modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revertingTx, setRevertingTx] = useState<Transaction | null>(null);
  const [printingTx, setPrintingTx] = useState<Transaction | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [approvingTx, setApprovingTx] = useState<Transaction | null>(null);
  const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);

  const refreshData = () => {
    setMetrics(CustodyDB.getReconciliation());
    setAllTransactions(CustodyDB.getScopedTransactions());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const formatVal = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EGP';
  };

  const handlePrint = () => {
    window.print();
  };

  // Save Title
  const handleSaveTitle = () => {
    localStorage.setItem('reconciliation_sheet_title', sheetTitle);
    setIsEditingTitle(false);
    showToast(isRtl ? 'تم حفظ عنوان صحيفة الجرد بنجاح.' : 'Sheet title saved successfully.');
  };

  // Revert settlement status (now executed from custom modal)
  const handleRevert = (tx: Transaction) => {
    CustodyDB.updateTransaction(tx.id, {
      status: 'Pending',
      voucher_no: undefined,
      voucher_date: undefined
    });
    showToast(isRtl ? 'تم إلغاء تسوية الحركة بنجاح وإعادتها كمعلقة.' : 'Settlement cancelled. Transaction reverted to Pending.');
    refreshData();
    setRevertingTx(null);
  };

  // Permanent Delete
  const handleDelete = (id: string) => {
    const success = CustodyDB.deleteTransaction(id);
    if (success) {
      showToast(isRtl ? 'تم حذف الحركة والعملية بالكامل من قاعدة البيانات.' : 'Transaction successfully deleted.');
      refreshData();
      setDeletingId(null);
    } else {
      setAuthError(isRtl ? 'عذراً، يحتاج الحذف إلى صلاحيات مدير النظام (Admin)' : 'Unauthorized: Deletion requires Admin permissions.');
      setDeletingId(null);
    }
  };

  // Approve / Settle Final Handler (For RegionalManager or Admin)
  const handleApprove = (tx: Transaction) => {
    if (!isManager) {
      setAuthError(isRtl ? 'عذراً، يتطلب اعتماد وتسوية الحركات صلاحية مدير المنطقة أو الأدمن.' : 'Unauthorized: Requires Regional Manager or Admin credentials.');
      setApprovingTx(null);
      return;
    }

    CustodyDB.updateTransaction(tx.id, {
      status: 'Settled'
    });

    CustodyDB.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Final Approve & Settle',
      `Approved and settled voucher ${tx.voucher_no} (transaction ${tx.transaction_no}) worth ${tx.amount.toLocaleString()} EGP.`
    );
    showToast(isRtl ? 'تم اعتماد وتسوية مستند الصرف نهائياً.' : 'Voucher successfully approved and settled.');
    refreshData();
    setApprovingTx(null);
  };

  // Reject transaction handler (Sets status to 'Rejected')
  const handleReject = (tx: Transaction) => {
    if (!isManager) {
      setAuthError(isRtl ? 'عذراً، يحتاج هذا الإجراء إلى صلاحيات الإدارة أو مدير المنطقة.' : 'Unauthorized: Rejecting requires Manager or Admin permissions.');
      setRejectingTx(null);
      return;
    }

    CustodyDB.updateTransaction(tx.id, {
      status: 'Rejected'
    });

    CustodyDB.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Reject Voucher',
      `Rejected voucher ${tx.voucher_no} (transaction ${tx.transaction_no}) worth ${tx.amount.toLocaleString()} EGP.`
    );
    showToast(isRtl ? 'تم رفض مستند الصرف وتحديث الحالة إلى مرفوض.' : 'Voucher successfully rejected.');
    refreshData();
    setRejectingTx(null);
  };

  // Settle action triggers routing to voucher page with preselected transaction
  const handleStartSettle = (tx: Transaction) => {
    if (onSelectTransactionForSettle && onNavigate) {
      onSelectTransactionForSettle(tx);
      onNavigate('voucher');
    } else {
      // Inline update to "Under Settlement" with quick temporary voucher info
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

  // Filter lists based on search
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

  const totalUnderSettlement = underSettlementTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const totalPending = pendingTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const custodyBase = metrics.custodyValue;
  const settledTotal = metrics.settledTotal || 0;
  const netCashAvailable = custodyBase - totalUnderSettlement - totalPending - settledTotal;

  return (
    <div className="space-y-6 print:space-y-4 font-sans text-slate-800 dark:text-slate-100">
      
      {/* Top action header for printing and toolbar */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <TrendingUp className="text-emerald-600" />
            <span>{isRtl ? 'صحيفة جرد ومطابقة العهدة' : 'Reconciliation & Custody Inventory'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isRtl 
              ? 'تجميعة تفاعلية للمصروفات تحت التسوية والمعلق والسيولة في جدول واحد مدمج.' 
              : 'Interactive overview of under-settlement expenses, pending entries, and liquid cash.'
            }
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto mt-2 sm:mt-0">
          <button
            onClick={() => onNavigate && onNavigate('new-expense')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
          >
            <Plus size={14} />
            <span>{isRtl ? 'تسجيل مصروف' : 'Add Expense'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md"
          >
            <Printer size={14} />
            <span>{isRtl ? 'طباعة الكشف' : 'Print Sheet'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 z-50 p-4 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckSquare size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Interactive Tool bar for quick filtering */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-3 items-center justify-between print:hidden ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-indigo-500" />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isRtl ? 'تصفية الجدول:' : 'Filter Spreadsheet:'}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:max-w-md">
          <input
            type="text"
            placeholder={isRtl ? 'ابحث برقم السند، البيان...' : 'Search description...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`py-1 px-3 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
              theme === 'dark' 
                ? 'bg-[#0f172a] border-slate-700 text-slate-100 placeholder-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {/* DUAL SPREADSHEET CARD GRID (EXCEL SHEET STYLING) */}
      <div className={`p-4 rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-md'
      }`}>
        
        {/* EXCEL GREEN HEADER BAR */}
        <div className="bg-emerald-700 text-white rounded-xl p-3 mb-4 flex items-center justify-between flex-wrap gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wider uppercase bg-emerald-800 px-2 py-0.5 rounded text-emerald-300 font-mono">
              {isRtl ? 'كشف مطابقة' : 'RECON SHEET'}
            </span>
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  className="bg-emerald-800 text-white px-2 py-0.5 rounded text-xs focus:outline-none font-bold border border-emerald-500"
                  autoFocus
                />
                <button 
                  onClick={handleSaveTitle}
                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <h3 
                className="font-bold text-sm md:text-base cursor-pointer hover:underline flex items-center gap-1"
                onClick={() => setIsEditingTitle(true)}
                title={isRtl ? 'اضغط لتعديل العنوان' : 'Click to edit title'}
              >
                {sheetTitle}
              </h3>
            )}
          </div>
          <div className="text-[10px] font-mono text-emerald-200">
            {isRtl ? 'تاريخ الجرد:' : 'Date:'} {new Date().toLocaleDateString(language)}
          </div>
        </div>

        {/* SIDE-BY-SIDE SPREADSHEET LAYOUT */}
        <div className="grid gap-0 md:grid-cols-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x dark:divide-slate-700 divide-slate-200">
          
          {/* ==================== LEFT SIDE: PENDING (المعلق) ==================== */}
          <div className="p-3 flex flex-col justify-between bg-slate-50/50 dark:bg-[#0f172a]/20 min-w-0">
            <div>
              {/* Table Sub Header */}
              <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2 rounded-lg mb-2 font-bold text-xs flex justify-between items-center">
                <span>{isRtl ? 'القسم الأول: المعاملات المعلقة بالخزينة (المعلق)' : 'Part 1: Pending Cash Operations (Unsettled)'}</span>
                <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded text-[10px]">
                  {pendingTxs.length} {isRtl ? 'معاملة' : 'Entries'}
                </span>
              </div>

              {/* Grid Sheet */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse min-w-[450px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-500">
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-center w-12">#</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-right">{isRtl ? 'البيان / الوصف' : 'Description'}</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-left w-24 font-mono">{isRtl ? 'المبلغ' : 'Amount'}</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-center w-16 print:hidden">{isRtl ? 'إجراء' : 'Act'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {pendingTxs.map((tx, idx) => {
                      return (
                        <tr key={tx.id} className="hover:bg-amber-500/5 transition-colors">
                          <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-2 border border-slate-200 dark:border-slate-700">
                            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug">{tx.description}</div>
                          </td>
                          <td className="p-2 border border-slate-200 dark:border-slate-700 text-left font-mono font-bold text-amber-600 dark:text-amber-400">
                            {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1 border border-slate-200 dark:border-slate-700 text-center print:hidden">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleStartSettle(tx)}
                                className="px-1.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 hover:text-white transition-all text-[9px] font-bold"
                                title={isRtl ? 'تسوية المستند' : 'Settle'}
                              >
                                {isRtl ? 'تسوية' : 'Settle'}
                              </button>
                              <button
                                onClick={() => setDeletingId(tx.id)}
                                className="p-1 rounded text-rose-600 hover:bg-rose-500/10 transition-colors"
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
                        <td colSpan={4} className="p-4 text-center text-slate-400 font-medium">
                          {isRtl ? 'لا توجد حركات معلقة حالياً.' : 'No pending transactions.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sum Row */}
            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 flex justify-between items-center px-2">
              <span className="font-bold text-xs text-slate-500">{isRtl ? 'إجمالي المعلق' : 'Total Pending'}</span>
              <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                {totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
              </span>
            </div>
          </div>

          {/* ==================== RIGHT SIDE: UNDER SETTLEMENT (تحت التسوية) ==================== */}
          <div className="p-3 flex flex-col justify-between bg-white dark:bg-[#1e293b]/10 min-w-0">
            <div>
              {/* Table Sub Header */}
              <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 p-2 rounded-lg mb-2 font-bold text-xs flex justify-between items-center">
                <span>{isRtl ? 'القسم الثاني: مستندات الصرف تحت التسوية (الحوافظ)' : 'Part 2: Under Settlement Vouchers (CPV)'}</span>
                <span className="font-mono bg-blue-500/20 px-2 py-0.5 rounded text-[10px]">
                  {underSettlementTxs.length} {isRtl ? 'سند' : 'Vouchers'}
                </span>
              </div>

              {/* Grid Sheet */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-500">
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-center w-12">#</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-right w-24">{isRtl ? 'رقم الحافظة' : 'Voucher No'}</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-right">{isRtl ? 'البيان / الوصف' : 'Description'}</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-left w-24 font-mono">{isRtl ? 'المبلغ' : 'Amount'}</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700 text-center w-48 print:hidden">{isRtl ? 'إجراء' : 'Act'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {underSettlementTxs.map((tx, idx) => {
                      return (
                        <tr key={tx.id} className="hover:bg-blue-500/5 transition-colors">
                          <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {tx.voucher_no || 'N/A'}
                          </td>
                          <td className="p-2 border border-slate-200 dark:border-slate-700">
                            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug">{tx.description}</div>
                          </td>
                          <td className="p-2 border border-slate-200 dark:border-slate-700 text-left font-mono font-bold text-blue-600 dark:text-blue-400">
                            {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1 border border-slate-200 dark:border-slate-700 text-center print:hidden">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {/* Print button */}
                              <button
                                onClick={() => setPrintingTx(tx)}
                                className="p-1 rounded text-slate-600 hover:bg-slate-500/10 transition-colors"
                                title={isRtl ? 'عرض وطباعة السند' : 'Print'}
                              >
                                <Printer size={10} />
                              </button>

                              {/* Settle / Approve button for Managers */}
                              {isManager && (
                                <button
                                  onClick={() => setApprovingTx(tx)}
                                  className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-all font-bold text-[9px] flex items-center gap-0.5"
                                  title={isRtl ? 'اعتماد وتسوية المستند' : 'Approve & Settle'}
                                >
                                  <ShieldCheck size={10} />
                                  <span>{isRtl ? 'اعتماد' : 'Approve'}</span>
                                </button>
                              )}

                              {/* Reject button for Managers */}
                              {isManager && (
                                <button
                                  onClick={() => setRejectingTx(tx)}
                                  className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500 text-rose-600 hover:text-white transition-all font-bold text-[9px] flex items-center gap-0.5"
                                  title={isRtl ? 'رفض المستند' : 'Reject'}
                                >
                                  <XCircle size={10} />
                                  <span>{isRtl ? 'رفض' : 'Reject'}</span>
                                </button>
                              )}

                              {/* Revert / edit button */}
                              <button
                                onClick={() => setRevertingTx(tx)}
                                className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-600 text-amber-600 hover:text-white text-[9px] font-bold"
                                title={isRtl ? 'إرجاع إلى معلق للتعديل' : 'Revert to Pending'}
                              >
                                {isRtl ? 'إرجاع' : 'Rev'}
                              </button>

                              {/* Delete button (Admins only) */}
                              {isAdmin && (
                                <button
                                  onClick={() => setDeletingId(tx.id)}
                                  className="p-1 rounded text-rose-600 hover:bg-rose-500/10 transition-colors"
                                  title={isRtl ? 'حذف نهائي' : 'Delete'}
                                >
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {underSettlementTxs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">
                          {isRtl ? 'لا توجد مستندات صرف تحت التسوية حالياً.' : 'No vouchers under settlement.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sum Row */}
            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 flex justify-between items-center px-2">
              <span className="font-bold text-xs text-slate-500">{isRtl ? 'إجمالي تحت التسوية' : 'Total Under Settlement'}</span>
              <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                {totalUnderSettlement.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
              </span>
            </div>
          </div>

        </div>

        {/* BOTTOM RECONCILIATION CALCULATION BLOCK (EXACTLY MATCHES SPREADSHEET MATH) */}
        <div className="mt-6 border-t pt-5 border-slate-200 dark:border-slate-700">
          <div className="w-full max-w-md mx-auto bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Scale size={14} className="text-emerald-600" />
              <span className="font-bold text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {isRtl ? 'ملخص تسوية ومطابقة العهدة النقدية' : 'Summary & Cash Reconciliation'}
              </span>
            </div>

            <div className="p-4 space-y-3 font-medium text-xs">
              
              {/* 1. Base Custody Amount */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">{isRtl ? 'العهدة (قيمة العهدة الإسمية)' : 'Custody (Nominal Base)'}</span>
                <span className="font-mono font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                  {custodyBase.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                </span>
              </div>

              {/* 2. Officially Settled Custody (Deducted) */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800 text-emerald-700 dark:text-emerald-400">
                <span>{isRtl ? 'المنصرف المعتمد والمخصوم نهائياً (-)' : 'Approved & Settled Custody (-)'}</span>
                <span className="font-mono font-extrabold text-sm">
                  ({settledTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}) EGP
                </span>
              </div>

              {/* 3. Remaining Custody Balance */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                <span>{isRtl ? 'رصيد العهدة المتبقي للاستعاضة' : 'Remaining Custody Balance'}</span>
                <span className="font-mono text-sm">
                  {(custodyBase - settledTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                </span>
              </div>

              {/* 4. Total Under Settlement */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800 text-blue-600">
                <span>{isRtl ? 'إجمالي تحت التسوية بانتظار الاعتماد (-)' : 'Total Under Settlement (Pending Approval) (-)'}</span>
                <span className="font-mono font-extrabold text-sm">
                  ({totalUnderSettlement.toLocaleString('en-US', { minimumFractionDigits: 2 })}) EGP
                </span>
              </div>

              {/* 5. Total Pending */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800 text-amber-600">
                <span>{isRtl ? 'إجمالي المعلق (-)' : 'Total Pending (-)'}</span>
                <span className="font-mono font-extrabold text-sm">
                  ({totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}) EGP
                </span>
              </div>

              {/* 6. Net Cash Available */}
              <div className="flex justify-between items-center pt-2 px-3 py-2 bg-emerald-600/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                <span className="font-bold">{isRtl ? 'نقدي (متبقي السيولة الفعلي بالخزينة)' : 'Liquid Cash Available (Net)'}</span>
                <span className="font-mono font-black text-base">
                  {netCashAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* Physical Signatures for Print Ledger */}
        <div className="hidden print:block mt-12 pt-8 border-t border-slate-300">
          <div className="grid grid-cols-3 gap-8 text-center text-[10px]">
            <div>
              <div className="font-bold mb-8">أمين العهدة / Cashier</div>
              <div className="border-b border-slate-400 w-24 mx-auto" />
            </div>
            <div>
              <div className="font-bold mb-8">القسم المالي / Chief Accountant</div>
              <div className="border-b border-slate-400 w-24 mx-auto" />
            </div>
            <div>
              <div className="font-bold mb-8">مدير المراجعة والتدقيق / Auditor</div>
              <div className="border-b border-slate-400 w-24 mx-auto" />
            </div>
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
                : 'Are you sure you want to permanently delete this transaction? This action cannot be undone.'}
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

      {/* FINAL REJECT CONFIRMATION DIALOG */}
      {rejectingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <XCircle className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base">{isRtl ? 'تأكيد الرفض النهائي للمستند' : 'Confirm Voucher Rejection'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {isRtl 
                ? `هل أنت متأكد من رغبتك في رفض مستند الصرف رقم (${rejectingTx.voucher_no || rejectingTx.transaction_no}) نهائياً؟ سيتحول حالته إلى مرفوض.`
                : `Are you sure you want to reject voucher (${rejectingTx.voucher_no || rejectingTx.transaction_no})? Its status will be updated to Rejected.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingTx(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 ${theme === 'dark' ? 'hover:bg-slate-800' : ''}`}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleReject(rejectingTx)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isRtl ? 'تأكيد الرفض نهائياً' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE FINAL CONFIRMATION DIALOG */}
      {approvingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3 text-emerald-600 mb-3">
              <ShieldCheck className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base">{isRtl ? 'تأكيد الاعتماد والتسوية النهائية' : 'Confirm Final Approval'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {isRtl 
                ? `هل أنت متأكد من رغبتك في اعتماد مستند الصرف رقم (${approvingTx.voucher_no || approvingTx.transaction_no}) وتنزيل القيمة البالغة (${approvingTx.amount.toLocaleString()} جنيه) نهائياً من العهدة؟`
                : `Are you sure you want to approve voucher (${approvingTx.voucher_no || approvingTx.transaction_no}) for the amount of (${approvingTx.amount.toLocaleString()} EGP)? This permanently deducts the amount from custody.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApprovingTx(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 ${theme === 'dark' ? 'hover:bg-slate-800' : ''}`}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleApprove(approvingTx)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isRtl ? 'اعتماد وتسوية نهائية' : 'Confirm Approve'}
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
