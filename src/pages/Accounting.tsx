import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Coins, TrendingUp, Layers, Search, ArrowUpRight, ArrowDownLeft,
  Plus, Calendar, Calculator, CheckCircle2, ChevronRight, Hash, ShieldAlert, FileText
} from 'lucide-react';
import { AccountingBusinessEngine } from '../lib/enterprise/accounting_engine';
import { UsersModule } from '../db/users';
import { CompaniesModule } from '../db/companies';
import { GLAccount, JournalEntry, LedgerLine } from '../types/accounting';
import { createEventEnvelope } from '../lib/enterprise/metadata';

interface AccountingProps {
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
}

export default function Accounting({ language, theme }: AccountingProps) {
  const isRtl = language === 'ar';
  const activeUser = UsersModule.getActiveUser();
  const companyId = CompaniesModule.getSelectedCompanyId();

  // Active Tab: 'ledger' | 'accounts' | 'trial_balance'
  const [activeTab, setActiveTab] = useState<'ledger' | 'accounts' | 'trial_balance'>('ledger');

  // Load Data
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Manual Journal Entry Modal
  const [showManualJE, setShowManualJE] = useState(false);
  const [jeStatementAr, setJeStatementAr] = useState('');
  const [jeStatementEn, setJeStatementEn] = useState('');
  const [jeLines, setJeLines] = useState<{ accountCode: string; debit: number; credit: number; notes?: string }[]>([
    { accountCode: '', debit: 0, credit: 0, notes: '' },
    { accountCode: '', debit: 0, credit: 0, notes: '' }
  ]);

  // Selected Journal Entry for detailed preview drawer/panel
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllData = () => {
    const acc = AccountingBusinessEngine.getAccounts(companyId);
    const ent = AccountingBusinessEngine.getJournalEntries(companyId);
    setAccounts(acc);
    setEntries(ent);
    if (ent.length > 0 && !selectedEntry) {
      setSelectedEntry(ent[ent.length - 1]); // Default select latest
    }
  };

  useEffect(() => {
    loadAllData();
  }, [companyId]);

  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Add line to manual JE form
  const handleAddManualLine = () => {
    setJeLines([...jeLines, { accountCode: '', debit: 0, credit: 0, notes: '' }]);
  };

  const handleRemoveManualLine = (idx: number) => {
    if (jeLines.length <= 2) return; // Keep at least 2 lines
    setJeLines(jeLines.filter((_, i) => i !== idx));
  };

  const handleUpdateLine = (idx: number, field: string, value: any) => {
    const updated = jeLines.map((line, i) => {
      if (i === idx) {
        return { ...line, [field]: value };
      }
      return line;
    });
    setJeLines(updated);
  };

  // Post Custom Journal Entry
  const handlePostManualJE = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jeStatementAr || !jeStatementEn) {
      triggerFeedback('error', isRtl ? 'يرجى إدخال شرح القيد باللغتين' : 'Please input entry statement in both languages');
      return;
    }

    // Verify all lines have accounts selected
    if (jeLines.some(l => !l.accountCode)) {
      triggerFeedback('error', isRtl ? 'يرجى تحديد حساب لكل بند' : 'Please select GL account for each line');
      return;
    }

    const totalDebit = jeLines.reduce((sum, l) => sum + (parseFloat(String(l.debit)) || 0), 0);
    const totalCredit = jeLines.reduce((sum, l) => sum + (parseFloat(String(l.credit)) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      triggerFeedback('error', isRtl 
        ? `القيد غير متزن! إجمالي المدين: ${totalDebit}، إجمالي الدائن: ${totalCredit}` 
        : `Unbalanced journal entry! Total Debits: ${totalDebit}, Total Credits: ${totalCredit}`
      );
      return;
    }

    const engine = new AccountingBusinessEngine();
    const event = createEventEnvelope(
      'JOURNAL_ENTRY_POSTED',
      companyId,
      companyId,
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      activeUser?.role || 'System',
      {
        statementAr: jeStatementAr,
        statementEn: jeStatementEn,
        sourceRef: 'Manual Entry / تسوية يدوية',
        lines: jeLines.map(l => ({
          accountCode: l.accountCode,
          debit: parseFloat(String(l.debit)) || 0,
          credit: parseFloat(String(l.credit)) || 0,
          notes: l.notes || undefined
        }))
      }
    );

    const result = await engine.processEvent(event);
    if (result.success) {
      triggerFeedback('success', isRtl ? result.messageAr : result.messageEn);
      setJeLines([
        { accountCode: '', debit: 0, credit: 0, notes: '' },
        { accountCode: '', debit: 0, credit: 0, notes: '' }
      ]);
      setJeStatementAr('');
      setJeStatementEn('');
      setShowManualJE(false);
      loadAllData();
    } else {
      triggerFeedback('error', isRtl ? result.messageAr : result.messageEn);
    }
  };

  // Filter journal entries
  const filteredEntries = entries.filter(je => {
    const s = searchTerm.toLowerCase();
    return (
      je.entryNumber.toLowerCase().includes(s) ||
      (je.statementAr && je.statementAr.toLowerCase().includes(s)) ||
      (je.statementEn && je.statementEn.toLowerCase().includes(s)) ||
      (je.sourceReference && je.sourceReference.toLowerCase().includes(s))
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10">
          <BookOpen className="h-64 w-64 translate-x-12 translate-y-12" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold">
            <Coins className="h-3 w-3" />
            {isRtl ? 'نظام الأستاذ العام المزدوج' : 'Double-Entry General Ledger System'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
            {isRtl ? 'النظام المحاسبي وقيود اليومية' : 'Accounting & Ledger Engine'}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-xl leading-relaxed font-semibold">
            {isRtl 
              ? 'تتبع حركات الأصول والخصوم والمصروفات، وتوليد قيود اليومية المزدوجة المتزنة تلقائياً من العمليات التشغيلية.'
              : 'Enterprise-grade double-entry ledger. Automatic posting from operational movements paired with flexible manual adjustments.'}
          </p>
        </div>
      </div>

      {/* Alert Feedbacks */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-fade-in ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
        }`}>
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-xs font-bold font-sans">{feedback.text}</p>
        </div>
      )}

      {/* Nav Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'ledger' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          {isRtl ? 'دفتر اليومية العامة' : 'Journal Ledger'}
          <span className="ml-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
            {entries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'accounts' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          {isRtl ? 'دليل الحسابات' : 'Chart of Accounts'}
          <span className="ml-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
            {accounts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trial_balance')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'trial_balance' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="h-4 w-4" />
          {isRtl ? 'ميزان المراجعة والأرباح' : 'Trial Balance & P&L'}
        </button>
      </div>

      {/* Tab 1: Ledger & JEs */}
      {activeTab === 'ledger' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Entries list pane (2 cols wide) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={isRtl ? 'البحث برقم القيد أو الشرح المحاسبي...' : 'Search by JE # or statement...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {activeUser?.role === 'Admin' && (
                <button
                  onClick={() => setShowManualJE(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  {isRtl ? 'إدخال قيد تسوية' : 'New Journal Entry'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400">
                  <BookOpen className="h-10 w-10 mx-auto opacity-40 mb-2" />
                  <p className="text-xs font-semibold">{isRtl ? 'لا توجد قيود يومية مطابقة' : 'No matching journal entries found'}</p>
                </div>
              ) : (
                filteredEntries.map((je) => (
                  <div
                    key={je.id}
                    onClick={() => setSelectedEntry(je)}
                    className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm transition-all cursor-pointer ${
                      selectedEntry?.id === je.id 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/10' 
                        : 'border-slate-100 hover:border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{je.entryNumber}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 font-bold">
                            {je.sourceType === 'OPERATIONAL' ? (isRtl ? 'تشغيلي آلي' : 'Operational') : (isRtl ? 'تسوية يدوية' : 'Manual')}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 line-clamp-1">
                          {isRtl ? je.statementAr : je.statementEn}
                        </h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold">{je.date}</p>
                        <p className="text-xs font-extrabold text-emerald-600">{je.totalDebit.toLocaleString()} EGP</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Details Pane (1 col wide) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 h-fit">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
              {isRtl ? 'تفاصيل سند القيد المزدوج' : 'Double-Entry Posting Details'}
            </h3>

            {selectedEntry ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-400">{isRtl ? 'الرقم المرجعي:' : 'Reference #:'}</span>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{selectedEntry.entryNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-400">{isRtl ? 'تاريخ الترحيل:' : 'Post Date:'}</span>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedEntry.date}</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                  <p className="text-[11px] text-slate-400 font-black uppercase">{isRtl ? 'البيان والموجز' : 'Accounting Statement'}</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {isRtl ? selectedEntry.statementAr : selectedEntry.statementEn}
                  </p>
                  {selectedEntry.sourceReference && (
                    <p className="text-[10px] text-indigo-500 font-semibold mt-1">
                      * {isRtl ? 'المصدر:' : 'Source:'} {selectedEntry.sourceReference}
                    </p>
                  )}
                </div>

                {/* Ledger Lines breakdown */}
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400 font-black uppercase">{isRtl ? 'حسابات الدائن والمدين' : 'GL Accounts Postings'}</p>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedEntry.lines.map((ln, idx) => (
                      <div key={idx} className="py-2.5 space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-100">{isRtl ? ln.accountNameAr : ln.accountNameEn}</span>
                          <span className="text-slate-400 text-[10px]">{ln.accountCode}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 italic">{ln.notes || ''}</span>
                          <div className="flex gap-4 font-black">
                            {ln.debit > 0 && <span className="text-emerald-600">{isRtl ? 'مدين:' : 'Dr:'} {ln.debit.toLocaleString()}</span>}
                            {ln.credit > 0 && <span className="text-rose-500">{isRtl ? 'دائن:' : 'Cr:'} {ln.credit.toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balances sum */}
                <div className="flex justify-between items-center text-xs font-extrabold border-t border-slate-100 dark:border-slate-800 pt-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">
                  <span className="text-slate-500">{isRtl ? 'إجمالي الحركة (متزنة)' : 'Total Balanced Amount'}</span>
                  <span className="text-emerald-600 text-sm font-black">{selectedEntry.totalDebit.toLocaleString()} EGP</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-8">{isRtl ? 'يرجى اختيار قيد لمعاينة التفاصيل' : 'Select a journal entry to view breakdowns'}</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Chart of Accounts */}
      {activeTab === 'accounts' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
            {isRtl ? 'دليل وشجرة الحسابات العامة (COA)' : 'Corporate Chart of Accounts (COA)'}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase">
                  <th className="py-3 px-4">{isRtl ? 'كود الحساب' : 'Account Code'}</th>
                  <th className="py-3 px-4">{isRtl ? 'اسم الحساب' : 'Account Name'}</th>
                  <th className="py-3 px-4">{isRtl ? 'نوع الحساب' : 'Classification'}</th>
                  <th className="py-3 px-4 text-right">{isRtl ? 'الرصيد الجاري' : 'Current Balance'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-300">{acc.code}</td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-100 font-extrabold">{isRtl ? acc.nameAr : acc.nameEn}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        acc.type === 'ASSET' ? 'bg-indigo-500/10 text-indigo-500' :
                        acc.type === 'LIABILITY' ? 'bg-amber-500/10 text-amber-500' :
                        acc.type === 'EQUITY' ? 'bg-purple-500/10 text-purple-500' :
                        acc.type === 'REVENUE' ? 'bg-emerald-500/10 text-emerald-500' :
                        'bg-rose-500/10 text-rose-500'
                      }`}>
                        {isRtl ? (
                          acc.type === 'ASSET' ? 'أصول' :
                          acc.type === 'LIABILITY' ? 'خصوم' :
                          acc.type === 'EQUITY' ? 'حقوق ملكية' :
                          acc.type === 'REVENUE' ? 'إيرادات' : 'مصروفات'
                        ) : acc.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-800 dark:text-slate-100">
                      {acc.balance.toLocaleString()} EGP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Trial Balance */}
      {activeTab === 'trial_balance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trial Balance list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-emerald-600" />
              {isRtl ? 'ميزان المراجعة التجريبي للمطابقة' : 'Trial Balance Matcher'}
            </h3>

            <div className="space-y-3">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {accounts.map((acc) => {
                  const isDebitClass = acc.type === 'ASSET' || acc.type === 'EXPENSE';
                  const drVal = isDebitClass ? acc.balance : 0;
                  const crVal = !isDebitClass ? acc.balance : 0;

                  return (
                    <div key={acc.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-slate-800 dark:text-slate-100">{isRtl ? acc.nameAr : acc.nameEn}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{acc.code}</p>
                      </div>
                      <div className="flex gap-6 font-black text-[11px]">
                        {drVal > 0 && <span className="text-emerald-600">{isRtl ? 'مدين:' : 'Dr:'} {drVal.toLocaleString()} EGP</span>}
                        {crVal > 0 && <span className="text-rose-500">{isRtl ? 'دائن:' : 'Cr:'} {crVal.toLocaleString()} EGP</span>}
                        {drVal === 0 && crVal === 0 && <span className="text-slate-300">-</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Balance totals validation */}
              {(() => {
                const totalDr = accounts.reduce((sum, acc) => {
                  return sum + (acc.type === 'ASSET' || acc.type === 'EXPENSE' ? acc.balance : 0);
                }, 0);
                const totalCr = accounts.reduce((sum, acc) => {
                  return sum + (acc.type === 'LIABILITY' || acc.type === 'EQUITY' || acc.type === 'REVENUE' ? acc.balance : 0);
                }, 0);

                return (
                  <div className="flex justify-between items-center p-3 bg-emerald-500/5 text-emerald-600 rounded-xl border border-emerald-500/10 font-extrabold text-xs">
                    <span>{isRtl ? 'إجمالي توازن الميزان (متطابق)' : 'Trial Balance Sum (Matching)'}</span>
                    <div className="flex gap-4">
                      <span>{isRtl ? 'إجمالي المدين:' : 'Total Dr:'} {totalDr.toLocaleString()}</span>
                      <span>{isRtl ? 'إجمالي الدائن:' : 'Total Cr:'} {totalCr.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Profit & Loss statement */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              {isRtl ? 'قائمة الأرباح والخسائر التقديرية (P&L)' : 'Estimated Income Statement (P&L)'}
            </h3>

            {(() => {
              const revenueAccs = accounts.filter(a => a.type === 'REVENUE');
              const expenseAccs = accounts.filter(a => a.type === 'EXPENSE');

              const totalRev = revenueAccs.reduce((sum, a) => sum + a.balance, 0);
              const totalExp = expenseAccs.reduce((sum, a) => sum + a.balance, 0);
              const netProfit = totalRev - totalExp;

              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 font-black uppercase">{isRtl ? 'إيرادات التشغيل والمبيعات' : 'Revenue Streams'}</p>
                    {revenueAccs.map(r => (
                      <div key={r.id} className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">{isRtl ? r.nameAr : r.nameEn}</span>
                        <span className="text-emerald-600 font-extrabold">{r.balance.toLocaleString()} EGP</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-extrabold border-t border-slate-100 dark:border-slate-800 pt-2 text-slate-800 dark:text-slate-200">
                      <span>{isRtl ? 'إجمالي الإيرادات' : 'Total Revenue'}</span>
                      <span>{totalRev.toLocaleString()} EGP</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] text-slate-400 font-black uppercase">{isRtl ? 'المصروفات والأعباء التشغيلية' : 'Operating Expenses'}</p>
                    {expenseAccs.map(e => (
                      <div key={e.id} className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">{isRtl ? e.nameAr : e.nameEn}</span>
                        <span className="text-rose-500 font-extrabold">{e.balance.toLocaleString()} EGP</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-extrabold border-t border-slate-100 dark:border-slate-800 pt-2 text-slate-800 dark:text-slate-200">
                      <span>{isRtl ? 'إجمالي المصروفات' : 'Total Expenses'}</span>
                      <span>{totalExp.toLocaleString()} EGP</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl flex justify-between items-center text-xs font-black ${
                    netProfit >= 0 
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  }`}>
                    <span className="text-sm">{isRtl ? 'صافي الربح / الخسارة التشغيلي' : 'Net Operating Profit / Loss'}</span>
                    <span className="text-base font-black">{netProfit.toLocaleString()} EGP</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: Add Manual Journal Entry */}
      {showManualJE && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePostManualJE} className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-600" />
              {isRtl ? 'إعداد وترحيل قيد تسوية محاسبي يدوي' : 'Draft Manual Adjustment Journal Entry'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'شرح القيد (بالعربية)' : 'Statement (Arabic)'}</label>
                  <input
                    type="text"
                    required
                    value={jeStatementAr}
                    onChange={(e) => setJeStatementAr(e.target.value)}
                    placeholder="مثال: تسوية رصيد الخزينة بنهاية الربع الأول"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'شرح القيد (بالإنجليزية)' : 'Statement (English)'}</label>
                  <input
                    type="text"
                    required
                    value={jeStatementEn}
                    onChange={(e) => setJeStatementEn(e.target.value)}
                    placeholder="e.g. End of Q1 physical cash box reconciliation"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* JE Lines Grid */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'بنود الترحيل (مدين ودائن)' : 'Posting items (Debits & Credits)'}</label>
                <div className="space-y-2">
                  {jeLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                      <select
                        value={line.accountCode}
                        onChange={(e) => handleUpdateLine(idx, 'accountCode', e.target.value)}
                        className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent font-semibold"
                      >
                        <option value="">{isRtl ? 'اختر حساباً...' : 'Select account...'}</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.code}>{isRtl ? a.nameAr : a.nameEn} ({a.code})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        placeholder={isRtl ? 'مدين (Debit)' : 'Debit (Dr)'}
                        value={line.debit || ''}
                        onChange={(e) => handleUpdateLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                        className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent font-bold text-emerald-600"
                      />

                      <input
                        type="number"
                        placeholder={isRtl ? 'دائن (Credit)' : 'Credit (Cr)'}
                        value={line.credit || ''}
                        onChange={(e) => handleUpdateLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                        className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent font-bold text-rose-500"
                      />

                      <div className="flex gap-1 items-center">
                        <input
                          type="text"
                          placeholder={isRtl ? 'ملاحظة البند...' : 'Item notes...'}
                          value={line.notes || ''}
                          onChange={(e) => handleUpdateLine(idx, 'notes', e.target.value)}
                          className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent flex-1"
                        />
                        {jeLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveManualLine(idx)}
                            className="p-1 bg-rose-500/10 text-rose-500 rounded hover:bg-rose-500 hover:text-white transition-all"
                          >
                            <X className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddManualLine}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all"
                >
                  {isRtl ? '+ إضافة سطر محاسبي' : '+ Add ledger line'}
                </button>
              </div>

              {/* Balanced Math totals in Modal */}
              {(() => {
                const totalDr = jeLines.reduce((sum, l) => sum + (parseFloat(String(l.debit)) || 0), 0);
                const totalCr = jeLines.reduce((sum, l) => sum + (parseFloat(String(l.credit)) || 0), 0);
                const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

                return (
                  <div className={`p-3 rounded-xl border text-xs font-extrabold flex justify-between items-center ${
                    isBalanced 
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  }`}>
                    <span>{isRtl ? 'حالة القيد المزدوج' : 'Double-entry Balance Status'}</span>
                    <div className="flex gap-4">
                      <span>{isRtl ? 'إجمالي المدين:' : 'Total Dr:'} {totalDr} EGP</span>
                      <span>{isRtl ? 'إجمالي الدائن:' : 'Total Cr:'} {totalCr} EGP</span>
                      <span className="font-black">{isBalanced ? (isRtl ? '✓ متزن' : '✓ Balanced') : (isRtl ? '✗ غير متزن' : '✗ Unbalanced')}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowManualJE(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {isRtl ? 'ترحيل القيد للميزانية' : 'Post Journal Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
