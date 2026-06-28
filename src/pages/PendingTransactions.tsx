import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, Transaction } from '../types';
import { 
  Clock, 
  Search, 
  Trash2, 
  Edit, 
  FileCheck, 
  X, 
  Check, 
  Calendar, 
  AlertTriangle,
  Info,
  Printer
} from 'lucide-react';
import VoucherModal from '../components/VoucherModal';

interface PendingTransactionsProps {
  language: Language;
  theme: Theme;
  onNavigate: (tab: string) => void;
  onSelectTransactionForSettle?: (tx: Transaction) => void;
}

export default function PendingTransactions({ 
  language, 
  theme, 
  onNavigate,
  onSelectTransactionForSettle 
}: PendingTransactionsProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const user = CustodyDB.getActiveUser();

  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => 
    CustodyDB.getScopedTransactions().filter(t => t.status === 'Pending' || t.status === 'Rejected')
  );
  
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Action states
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [settlingTx, setSettlingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [printingTx, setPrintingTx] = useState<Transaction | null>(null);

  // Edit fields
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Settle fields
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleError, setSettleError] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState('');

  const refreshList = () => {
    setTransactions(CustodyDB.getScopedTransactions().filter(t => t.status === 'Pending' || t.status === 'Rejected'));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Delete Transaction Handler
  const handleDelete = (id: string) => {
    const success = CustodyDB.deleteTransaction(id);
    if (success) {
      showToast(t.successDeleted);
      refreshList();
      setDeletingId(null);
    } else {
      alert(isRtl ? 'عذراً، يحتاج الحذف إلى صلاحيات مدير النظام (Admin)' : 'Unauthorized: Deletion requires Admin permissions.');
      setDeletingId(null);
    }
  };

  // Edit Transaction Click
  const startEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDesc(tx.description);
    setEditAmount(String(tx.amount));
    setEditNotes(tx.notes || '');
  };

  // Save Edits
  const saveEdit = () => {
    if (!editingTx) return;
    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert(t.positiveNumber);
      return;
    }

    CustodyDB.updateTransaction(editingTx.id, {
      description: editDesc,
      amount: amountNum,
      notes: editNotes || undefined
    });

    showToast(t.successUpdated);
    setEditingTx(null);
    refreshList();
  };

  // Start Settle Click
  const startSettle = (tx: Transaction) => {
    if (onSelectTransactionForSettle) {
      // If we have a custom router workflow, let's navigate there
      onSelectTransactionForSettle(tx);
      onNavigate('voucher');
    } else {
      // fall back to inline modal
      setSettlingTx(tx);
      setVoucherNo('');
      setVoucherDate(new Date().toISOString().split('T')[0]);
      setSettleError('');
    }
  };

  // Save Settle (Inline Voucher preparation)
  const saveSettle = () => {
    if (!settlingTx) return;
    if (!voucherNo.trim()) {
      setSettleError(t.required);
      return;
    }

    CustodyDB.updateTransaction(settlingTx.id, {
      status: 'Under Settlement',
      voucher_no: voucherNo.trim(),
      voucher_date: voucherDate
    });

    showToast(t.successSettled);
    setSettlingTx(null);
    refreshList();
  };

  // Search filter
  const filtered = transactions.filter(tx => {
    const matchesSearch = 
      tx.transaction_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <Clock className="text-amber-500" />
            <span>{t.pendingTransactions}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl 
              ? 'مصاريف مسجلة غير معتمدة مالياً حتى الآن. تحتاج إلى إقران سند صرف لتحت التسوية.' 
              : 'Logged expenses awaiting accounting voucher verification. Unsettled cash outflows.'
            }
          </p>
        </div>
        <button 
          onClick={() => onNavigate('new-expense')}
          className="self-start md:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-md"
        >
          {isRtl ? 'إضافة مصروف جديد +' : 'Add New Expense +'}
        </button>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-3 ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
      }`}>
        {/* Search Field */}
        <div className="flex-1 relative">
          <Search className="absolute top-2.5 left-3 text-slate-400 h-4 w-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full text-xs py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
              isRtl ? 'pr-3 pl-10' : 'pl-10 pr-3'
            } ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200'
            }`}
          />
        </div>


      </div>

      {/* Transactions Table */}
      <div className={`rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-medium bg-slate-50/50 dark:bg-slate-800/20">
                <th className="py-3 px-4 font-semibold text-slate-500">{t.transactionNo}</th>
                <th className="py-3 px-4 font-semibold text-slate-500">{t.date}</th>
                <th className="py-3 px-4 font-semibold text-slate-500">{t.description}</th>
                <th className="py-3 px-4 font-semibold text-slate-500 text-right">{t.amount}</th>
                <th className="py-3 px-4 font-semibold text-slate-500 text-center">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((tx) => {
                const isRejected = tx.status === 'Rejected';
                return (
                  <tr key={tx.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${isRejected ? 'bg-rose-500/5' : ''}`}>
                    {/* Transaction number with beautiful pending dot */}
                    <td className="py-4 px-4 font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isRejected ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <span className={isRejected ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400'}>{tx.transaction_no}</span>
                        {isRejected && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-rose-500 text-white font-black uppercase">
                            {isRtl ? 'مرفوض' : 'Rejected'}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Date */}
                    <td className="py-4 px-4 font-mono text-slate-500 dark:text-slate-400">{tx.date}</td>
                    
                    {/* Description & internal notes */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-100 max-w-xs md:max-w-md truncate" title={tx.description}>
                        {tx.description}
                      </div>
                      {tx.notes && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                          <Info size={10} className="text-emerald-500" />
                          <span>{tx.notes}</span>
                        </div>
                      )}
                    </td>
                    
                    {/* Amount */}
                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-50">
                      {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    
                    {/* Action buttons */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Print/Preview Voucher Button */}
                        <button
                          onClick={() => setPrintingTx(tx)}
                          className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500 text-blue-600 hover:text-white transition-all font-semibold text-[10px] flex items-center gap-1"
                          title={isRtl ? 'معاينة وطباعة مستند الصرف' : 'Preview & Print Voucher'}
                        >
                          <Printer size={12} />
                          <span>{isRtl ? 'طباعة' : 'Print'}</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => startEdit(tx)}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>

                        {/* Settle (convert) Button */}
                        <button
                          onClick={() => startSettle(tx)}
                          className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all font-semibold text-[10px] flex items-center gap-1"
                          title="Settle Transaction"
                        >
                          <FileCheck size={12} />
                          <span>{isRtl ? 'تسوية' : 'Settle'}</span>
                        </button>

                        {/* Delete Button (Restricted) */}
                        <button
                          onClick={() => setDeletingId(tx.id)}
                          className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base">{isRtl ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {t.confirmDelete}
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

      {/* EDIT MODAL */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl animate-fade-in ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm">
                {isRtl ? `تعديل الحركة المعلقة ${editingTx.transaction_no}` : `Edit Pending ${editingTx.transaction_no}`}
              </h3>
              <button 
                onClick={() => setEditingTx(null)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.description}</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.amount}</label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold focus:outline-none ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.notes}</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              {/* Action row */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setEditingTx(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={saveEdit}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isRtl ? 'حفظ التغييرات' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK INLINE SETTLE DIALOG */}
      {settlingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm p-5 rounded-2xl border shadow-xl animate-fade-in ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-emerald-600">
                {isRtl ? 'تسوية حركة مصروف معلق' : 'Settle Pending Expense'}
              </h3>
              <button 
                onClick={() => setSettlingTx(null)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Loaded description and amount summary card */}
              <div className={`p-3 rounded-lg text-xs space-y-1 ${
                theme === 'dark' ? 'bg-slate-800/80' : 'bg-slate-50'
              }`}>
                <div className="font-bold text-slate-500 uppercase text-[10px]">
                  {isRtl ? 'تفاصيل الحركة معلقة' : 'Pending Details'}
                </div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {settlingTx.transaction_no} - {settlingTx.description}
                </div>
                <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {settlingTx.amount.toLocaleString()} EGP
                </div>
              </div>

              {/* Voucher Number input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  {t.voucherNo} *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CPV-2026-098"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
                {settleError && <span className="text-rose-500 text-[10px] mt-0.5 block">{settleError}</span>}
              </div>

              {/* Voucher Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  {t.voucherDate}
                </label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none font-mono font-semibold ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              {/* Settle Action Button */}
              <button
                onClick={saveSettle}
                className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md"
              >
                {isRtl ? 'تأكيد وحفظ السند' : 'Confirm Voucher Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Cash Payment Voucher Print Modal */}
      <VoucherModal
        transaction={printingTx}
        isOpen={!!printingTx}
        onClose={() => setPrintingTx(null)}
        theme={theme}
      />
    </div>
  );
}
