import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, Transaction } from '../types';
import { 
  FileCheck, 
  Search, 
  CornerUpLeft, 
  CheckCircle, 
  Calendar, 
  Info, 
  Printer, 
  Trash2, 
  AlertTriangle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  XCircle,
  X
} from 'lucide-react';
import VoucherModal from '../components/VoucherModal';

interface UnderSettlementProps {
  language: Language;
  theme: Theme;
  onNavigate: (tab: string) => void;
}

export default function UnderSettlement({ language, theme, onNavigate }: UnderSettlementProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const user = CustodyDB.getActiveUser();
  const isAdmin = user && (user.role === 'Admin' || user.role === 'SystemAdmin');
  const isManager = user && (user.role === 'RegionalManager' || user.role === 'Admin' || user.role === 'SystemAdmin');

  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    CustodyDB.getScopedTransactions()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [printingTx, setPrintingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revertingTx, setRevertingTx] = useState<Transaction | null>(null);
  const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
  const [approvingTx, setApprovingTx] = useState<Transaction | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Toggle sections collapse
  const [underSettlementExpanded, setUnderSettlementExpanded] = useState(true);
  const [settledExpanded, setSettledExpanded] = useState(true);

  const refreshList = () => {
    setTransactions(CustodyDB.getScopedTransactions());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Delete Voucher/Transaction Handler
  const handleDelete = (id: string) => {
    const success = CustodyDB.deleteTransaction(id);
    if (success) {
      showToast(isRtl ? 'تم حذف مستند الصرف والحركة بالكامل بنجاح.' : 'Voucher and transaction deleted successfully.');
      refreshList();
      setDeletingId(null);
    } else {
      setAuthError(isRtl ? 'عذراً، يحتاج الحذف إلى صلاحيات مدير النظام (Admin)' : 'Unauthorized: Deletion requires Admin permissions.');
      setDeletingId(null);
    }
  };

  // Revert settlement action for typo corrections (Return for modification)
  const handleRevert = (tx: Transaction) => {
    if (!isManager) {
      setAuthError(isRtl ? 'عذراً، يحتاج هذا الإجراء إلى صلاحيات الإدارة أو مدير المنطقة.' : 'Unauthorized: Reverting requires Manager or Admin permissions.');
      setRevertingTx(null);
      return;
    }

    CustodyDB.updateTransaction(tx.id, {
      status: 'Pending',
      voucher_no: undefined,
      voucher_date: undefined
    });
    
    CustodyDB.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Return for Modification',
      `Returned transaction ${tx.transaction_no} (formerly voucher ${tx.voucher_no}) back to Pending status for modification.`
    );
    showToast(isRtl ? 'تم إرجاع الحركة للتعديل والمراجعة بنجاح.' : 'Returned to Pending status for modification.');
    refreshList();
    setRevertingTx(null);
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
    refreshList();
    setRejectingTx(null);
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
      `Approved and settled transaction ${tx.transaction_no} (voucher ${tx.voucher_no}) worth ${tx.amount.toLocaleString()} EGP.`
    );
    showToast(isRtl ? 'تم اعتماد ومطابقة مستند الصرف بنجاح وتنزيله من العهدة.' : 'Voucher successfully approved and settled against custody.');
    refreshList();
    setApprovingTx(null);
  };

  // Un-approve / revert to under settlement
  const handleRevertApproval = (tx: Transaction) => {
    if (!isAdmin) {
      setAuthError(isRtl ? 'عذراً، يحتاج هذا الإجراء إلى صلاحيات مدير النظام (Admin)' : 'Unauthorized: Reverting requires Admin permissions.');
      return;
    }

    CustodyDB.updateTransaction(tx.id, {
      status: 'Under Settlement'
    });

    CustodyDB.addLog(
      user?.id || 'unknown',
      user?.full_name || 'Anonymous',
      'Cancel Approval',
      `Cancelled approval for transaction ${tx.transaction_no}, returned to Under Settlement.`
    );
    showToast(isRtl ? 'تم إلغاء اعتماد السند وإعادته لمرحلة تحت التسوية.' : 'Approval cancelled. Reverted to under settlement.');
    refreshList();
  };

  // Filtered lists
  const filtered = transactions.filter(tx => {
    return (
      tx.voucher_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.transaction_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const underSettlementTxs = filtered.filter(tx => tx.status === 'Under Settlement');
  const settledTxs = filtered.filter(tx => tx.status === 'Settled');

  const totalUnderSettlementAmount = underSettlementTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const totalSettledAmount = settledTxs.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <FileCheck className="text-emerald-500" />
            <span>{isRtl ? 'مستندات الصرف واعتماد العهد' : 'Voucher Verification & Custody Settlement'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl 
              ? 'مراجعة واعتماد سندات الصرف الدورية. يقوم الإداري بتحميل السندات، ويعتمدها مدير المحطة، وللأدمن السيطرة الكاملة.' 
              : 'Review, approve, and settle periodic expense vouchers. Station Admins upload, Managers approve, Admins control.'
            }
          </p>
        </div>
      </div>

      {/* Success Toast Banner */}
      {toastMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Stats Summary Block */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Count Under Settlement */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">{isRtl ? 'تحت التسوية (بانتظار الاعتماد)' : 'Under Settlement'}</span>
            <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">{underSettlementTxs.length} {isRtl ? 'سند' : 'Vouchers'}</span>
          </div>
          <FileText className="text-amber-500/20 h-7 w-7" />
        </div>

        {/* Amount Under Settlement */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">{isRtl ? 'إجمالي بانتظار الاعتماد' : 'Total Pending Approval'}</span>
            <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
              {totalUnderSettlementAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
            </span>
          </div>
          <AlertTriangle className="text-amber-500/20 h-7 w-7" />
        </div>

        {/* Count Fully Settled */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">{isRtl ? 'معتمدة ومسواة نهائياً' : 'Fully Settled (Approved)'}</span>
            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{settledTxs.length} {isRtl ? 'حركة' : 'Approved'}</span>
          </div>
          <ShieldCheck className="text-emerald-500/20 h-7 w-7" />
        </div>

        {/* Amount Fully Settled */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">{isRtl ? 'إجمالي المبالغ المسواة' : 'Total Settled & Deducted'}</span>
            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {totalSettledAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
            </span>
          </div>
          <CheckCircle className="text-emerald-500/20 h-7 w-7" />
        </div>
      </div>

      {/* Search Input */}
      <div className={`p-4 rounded-xl border flex items-center ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex-1 relative">
          <Search className="absolute top-2.5 left-3 text-slate-400 h-4 w-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'ابحث برقم السند، رقم الحركة، البيان...' : 'Search by Voucher #, Transaction #, Description...'}
            className={`w-full text-xs py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
              isRtl ? 'pr-3 pl-10' : 'pl-10 pr-3'
            } ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200'
            }`}
          />
        </div>
      </div>

      {/* SECTION 1: AWAITING APPROVAL / UNDER SETTLEMENT */}
      <div className={`rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <button
          onClick={() => setUnderSettlementExpanded(!underSettlementExpanded)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800"
        >
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={16} />
            <span className="font-bold text-xs md:text-sm uppercase tracking-wider">
              {isRtl ? '1. مستندات صرف بانتظار المراجعة والاعتماد المالي' : '1. Vouchers Awaiting Manager Review & Approval'}
            </span>
            <span className="font-mono bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded text-[10px] font-bold">
              {underSettlementTxs.length}
            </span>
          </div>
          {underSettlementExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {underSettlementExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-medium bg-slate-50/20">
                  <th className="py-3 px-4 font-semibold text-slate-500">{isRtl ? 'رقم السند' : 'Voucher No'}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500">{isRtl ? 'تاريخ السند' : 'Voucher Date'}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500">{isRtl ? 'رقم القيد' : 'Ref No'}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500">{t.description}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500 text-right">{t.amount}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500 text-center">{isRtl ? 'الإجراءات والاعتماد' : 'Approval Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {underSettlementTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-600">
                      {tx.voucher_no}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {tx.voucher_date}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {tx.transaction_no}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={tx.description}>
                        {tx.description}
                      </div>
                      {tx.notes && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                          <Info size={10} className="text-amber-500 shrink-0" />
                          <span>{tx.notes}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-600">
                      {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1. Print button: always available */}
                        <button
                          onClick={() => setPrintingTx(tx)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all font-semibold text-[10px] flex items-center gap-1"
                          title={isRtl ? 'معاينة وطباعة مستند الصرف' : 'Print Voucher'}
                        >
                          <Printer size={11} />
                          <span>{isRtl ? 'طباعة' : 'Print'}</span>
                        </button>

                        {/* 2. Settle & Approval Controls: Available to RegionalManager and Admins */}
                        {isManager ? (
                          <>
                            <button
                              onClick={() => setApprovingTx(tx)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-all font-bold text-[10px] flex items-center gap-1"
                              title={isRtl ? 'اعتماد وتسوية الحركة نهائياً' : 'Approve & Settle'}
                            >
                              <ShieldCheck size={11} />
                              <span>{isRtl ? 'اعتماد' : 'Approve'}</span>
                            </button>

                            <button
                              onClick={() => setRevertingTx(tx)}
                              className="p-1 rounded bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-600 transition-all font-bold text-[10px] flex items-center gap-1"
                              title={isRtl ? 'إرجاع للتعديل' : 'Return for Revision'}
                            >
                              <CornerUpLeft size={11} />
                              <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                            </button>

                            <button
                              onClick={() => setRejectingTx(tx)}
                              className="p-1 rounded bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 transition-all font-bold text-[10px] flex items-center gap-1"
                              title={isRtl ? 'رفض المستند نهائياً' : 'Reject Voucher'}
                            >
                              <XCircle size={11} />
                              <span>{isRtl ? 'رفض' : 'Reject'}</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-amber-500 font-bold px-2 py-1 rounded bg-amber-500/10">
                            {isRtl ? 'بانتظار المدير' : 'Pending Manager'}
                          </span>
                        )}

                        {/* 3. Delete button: Admins only */}
                        {isAdmin ? (
                          <button
                            onClick={() => setDeletingId(tx.id)}
                            className="p-1 rounded bg-slate-100 hover:bg-rose-500 hover:text-white text-slate-500 transition-colors"
                            title={isRtl ? 'حذف الحركة نهائياً' : 'Delete'}
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {underSettlementTxs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      {isRtl ? 'لا توجد مستندات صرف بانتظار الاعتماد والتدقيق.' : 'No vouchers awaiting approval.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: APPROVED / FULLY SETTLED */}
      <div className={`rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <button
          onClick={() => setSettledExpanded(!settledExpanded)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800"
        >
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={16} />
            <span className="font-bold text-xs md:text-sm uppercase tracking-wider">
              {isRtl ? '2. سندات الصرف المعتمدة والمسواة نهائياً بالعهدة' : '2. Fully Settled & Approved Vouchers (Archived)'}
            </span>
            <span className="font-mono bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">
              {settledTxs.length}
            </span>
          </div>
          {settledExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {settledExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-medium bg-slate-50/20">
                  <th className="py-3 px-4 font-semibold text-slate-500">{isRtl ? 'رقم السند' : 'Voucher No'}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500">{isRtl ? 'رقم القيد' : 'Ref No'}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500">{t.description}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500 text-right">{t.amount}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500 text-center">{isRtl ? 'الحالة والرقابة' : 'Audit Status'}</th>
                  <th className="py-3 px-4 font-semibold text-slate-500 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {settledTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                      {tx.voucher_no}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {tx.transaction_no}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={tx.description}>
                        {tx.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-500/10">
                        <ShieldCheck size={10} />
                        <span>{isRtl ? 'مسوى ومعتمد' : 'Approved'}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1. Print button */}
                        <button
                          onClick={() => setPrintingTx(tx)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all font-semibold text-[10px] flex items-center gap-1"
                          title={isRtl ? 'عرض وطباعة مستند الصرف' : 'Print Voucher'}
                        >
                          <Printer size={11} />
                          <span>{isRtl ? 'طباعة' : 'Print'}</span>
                        </button>

                        {/* 2. Admin actions to cancel approval or delete */}
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => handleRevertApproval(tx)}
                              className="px-1.5 py-1 rounded bg-amber-500/10 hover:bg-amber-600 text-amber-600 hover:text-white transition-all text-[9px] font-bold"
                              title={isRtl ? 'إلغاء الاعتماد وإرجاع لتحت التسوية' : 'Revert Approval'}
                            >
                              {isRtl ? 'إلغاء الاعتماد' : 'Cancel Approval'}
                            </button>
                            <button
                              onClick={() => setDeletingId(tx.id)}
                              className="p-1 rounded text-rose-600 hover:bg-rose-500/10 transition-colors"
                              title={isRtl ? 'حذف نهائي' : 'Delete'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {settledTxs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      {isRtl ? 'لا توجد سندات معتمدة ومسواة في الأرشيف حالياً.' : 'No fully settled vouchers found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reusable Cash Payment Voucher Print Modal */}
      <VoucherModal
        transaction={printingTx}
        isOpen={!!printingTx}
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
              <h3 className="font-bold text-base">{isRtl ? 'تأكيد الحذف نهائياً' : 'Confirm Permanent Delete'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {isRtl 
                ? 'هل أنت متأكد من رغبتك في حذف هذا المستند وهذه الحركة نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to permanently delete this voucher and its transaction from the database? This action cannot be undone.'}
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

      {/* REVERT/RETURN FOR MODIFICATION CONFIRMATION DIALOG */}
      {revertingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3 text-amber-500 mb-3">
              <CornerUpLeft className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base">{isRtl ? 'إرجاع للتعديل والمراجعة' : 'Return for Revision'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {isRtl 
                ? `هل أنت متأكد من رغبتك في إرجاع مستند الصرف رقم (${revertingTx.voucher_no}) للتعديل؟ هذا سيحول حالته لمعلق ويتيح لمسئول المحطة تعديله وإعادة تقديمه.`
                : `Are you sure you want to return voucher (${revertingTx.voucher_no}) for modification? This will set its status to Pending, allowing the station custodian to edit and resubmit it.`}
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
                {isRtl ? 'تأكيد الإرجاع للتعديل' : 'Confirm Return'}
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
                ? `هل أنت متأكد من رغبتك في رفض مستند الصرف رقم (${rejectingTx.voucher_no}) نهائياً؟ سيتحول حالته إلى مرفوض.`
                : `Are you sure you want to reject voucher (${rejectingTx.voucher_no})? Its status will be updated to Rejected.`}
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
                ? `هل أنت متأكد من رغبتك في اعتماد مستند الصرف رقم (${approvingTx.voucher_no}) وتنزيل القيمة البالغة (${approvingTx.amount.toLocaleString()} جنيه) نهائياً من العهدة؟`
                : `Are you sure you want to approve voucher (${approvingTx.voucher_no}) for the amount of (${approvingTx.amount.toLocaleString()} EGP)? This permanently deducts the amount from custody.`}
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
