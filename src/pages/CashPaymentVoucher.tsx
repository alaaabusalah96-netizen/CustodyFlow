import React, { useState, useEffect } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, Transaction } from '../types';
import { FileCheck, FileText, Search, CreditCard, Calendar, CheckCircle2, ListFilter, Printer } from 'lucide-react';
import VoucherModal from '../components/VoucherModal';

interface CashPaymentVoucherProps {
  language: Language;
  theme: Theme;
  onNavigate: (tab: string) => void;
  selectedTx: Transaction | null;
  setSelectedTx: (tx: Transaction | null) => void;
}

export default function CashPaymentVoucher({
  language,
  theme,
  onNavigate,
  selectedTx,
  setSelectedTx
}: CashPaymentVoucherProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [lastVoucherDetails, setLastVoucherDetails] = useState('');
  const [printingTx, setPrintingTx] = useState<Transaction | null>(null);
  const [lastSettledTx, setLastSettledTx] = useState<Transaction | null>(null);

  // Load all pending transactions
  useEffect(() => {
    const list = CustodyDB.getScopedTransactions().filter(tx => tx.status === 'Pending');
    setPendingTransactions(list);

    // If there is no pre-selected transaction but some exist, don't pre-fill yet, let user select
  }, [selectedTx]);

  useEffect(() => {
    if (selectedTx) {
      setVoucherNo(selectedTx.transaction_no);
    } else {
      setVoucherNo('');
    }
  }, [selectedTx]);

  const handleTransactionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const txId = e.target.value;
    const found = pendingTransactions.find(t => t.id === txId) || null;
    setSelectedTx(found);
    setError('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) {
      setError(isRtl ? 'يرجى اختيار حركة معلقة أولاً' : 'Please select a pending transaction.');
      return;
    }
    if (!voucherNo.trim()) {
      setError(t.required);
      return;
    }

    const updatedTx: Transaction = {
      ...selectedTx,
      status: 'Under Settlement',
      voucher_no: voucherNo.trim(),
      voucher_date: voucherDate,
      updated_at: new Date().toISOString()
    };

    // Update in database
    CustodyDB.updateTransaction(selectedTx.id, {
      status: 'Under Settlement',
      voucher_no: voucherNo.trim(),
      voucher_date: voucherDate
    });

    setLastVoucherDetails(`${selectedTx.transaction_no} ➔ ${voucherNo.trim()}`);
    setLastSettledTx(updatedTx);
    setSuccess(true);
    setVoucherNo('');
    setSelectedTx(null); // Clear selected
    setError('');

    // Re-fetch pending items
    const updatedPendingList = CustodyDB.getScopedTransactions().filter(tx => tx.status === 'Pending');
    setPendingTransactions(updatedPendingList);

    // Timeout toast
    setTimeout(() => {
      setSuccess(false);
    }, 15000); // Give user more time to print
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
          <FileCheck className="text-emerald-500" />
          <span>{t.cashPaymentVoucher}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {isRtl 
            ? 'ربط المصروف المعلق بسند صرف نقدية وتوثيق رقم الدفتر المالي لتحويل الحالة إلى تحت التسوية.' 
            : 'Formally assign financial ledger details to a pending expense, moving it into Under Settlement state.'
          }
        </p>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <span className="font-bold">{t.successSettled}</span>
              <div className="text-xs opacity-90 mt-0.5 font-mono">
                {isRtl 
                  ? `الحركة التي تم تسويتها بنجاح: ${lastVoucherDetails}` 
                  : `Settlement link logged: ${lastVoucherDetails}`
                }
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {lastSettledTx && (
              <button
                onClick={() => setPrintingTx(lastSettledTx)}
                className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                title={isRtl ? 'معاينة وطباعة مستند الصرف' : 'Print Voucher'}
              >
                <Printer size={13} />
                <span>{isRtl ? 'طباعة مستند الصرف' : 'Print Voucher'}</span>
              </button>
            )}
            
            <button 
              onClick={() => onNavigate('settled')}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 border-none shrink-0"
            >
              {isRtl ? 'عرض المصاريف المسواة' : 'View Settled'}
            </button>
          </div>
        </div>
      )}

      {/* Main Voucher form card */}
      <div className={`p-6 rounded-2xl border ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <form onSubmit={handleSave} className="space-y-5">
          {/* Transaction Selection dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ListFilter size={14} className="text-slate-400" />
              <span>{isRtl ? 'اختر الحركة المعلقة المراد صرفها *' : 'Select Pending Transaction *'}</span>
            </label>
            <select
              value={selectedTx?.id || ''}
              onChange={handleTransactionChange}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="" disabled>{isRtl ? '--- اختر من قائمة المصاريف المعلقة ---' : '--- Choose a Pending Transaction ---'}</option>
              {pendingTransactions.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {tx.transaction_no} | {tx.date} | {tx.amount.toLocaleString()} EGP - {tx.description.slice(0, 40)}...
                </option>
              ))}
            </select>
            {pendingTransactions.length === 0 && (
              <span className="text-amber-500 text-xs mt-1 block font-medium">
                ⚠️ {isRtl ? 'تنبيه: لا توجد حركات معلقة حالياً.' : 'Warning: No pending transactions available.'}
              </span>
            )}
          </div>

          {/* Load details dynamically once a transaction is selected */}
          {selectedTx && (
            <div className={`p-4 rounded-xl border border-dashed transition-all ${
              theme === 'dark' ? 'bg-slate-800/50 border-[#334155]' : 'bg-slate-50 border-slate-200'
            }`}>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {isRtl ? 'بيانات الحركة المحددة' : 'Selected Transaction Preview'}
              </h3>
              
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">{t.transactionNo}:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{selectedTx.transaction_no}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">{t.date}:</span>
                  <span className="font-mono font-bold">{selectedTx.date}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-medium block">{t.description}:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedTx.description}</span>
                </div>
                <div className="sm:col-span-2 border-t pt-2 mt-1 flex justify-between items-center">
                  <span className="text-slate-400 font-medium">{t.amount}:</span>
                  <span className="font-mono font-bold text-base text-slate-800 dark:text-slate-100">
                    {selectedTx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Voucher Entry form fields */}
          <div className="space-y-4">
            {/* Voucher Number */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <CreditCard size={14} className="text-slate-400" />
                <span>{t.voucherNo} *</span>
              </label>
              <input
                type="text"
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder={isRtl ? 'مثال: سند صرف PV-10293' : 'e.g., PV-10293'}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}
                required
              />
              {error && <span className="text-rose-500 text-xs mt-1 block">{error}</span>}
            </div>

            {/* Voucher Date */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Calendar size={14} className="text-slate-400" />
                <span>{t.voucherDate} *</span>
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}
                required
              />
            </div>
          </div>

          {/* Save Voucher */}
          <button
            id="btn-save-voucher"
            type="submit"
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg"
          >
            <FileCheck size={18} />
            <span>{isRtl ? 'حفظ السند وتحويل المصروف لتحت التسوية' : 'Save & Move to Under Settlement'}</span>
          </button>
        </form>
      </div>

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
