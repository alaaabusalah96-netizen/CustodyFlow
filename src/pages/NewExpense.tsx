import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme } from '../types';
import { getArabicTafqeet, getEnglishTafqeet } from '../utils/tafqeet';
import { PlusCircle, Calendar, FileText, DollarSign, FilePlus2, CheckCircle2, Plus, Trash2, Coins } from 'lucide-react';

interface NewExpenseProps {
  language: Language;
  theme: Theme;
  onNavigate: (tab: string) => void;
}

interface ItemInput {
  description: string;
  amount: string;
  sign: '+' | '-';
}

export default function NewExpense({ language, theme, onNavigate }: NewExpenseProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  // Form states
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ItemInput[]>([{ description: '', amount: '', sign: '+' }]);
  const [notes, setNotes] = useState<string>('');

  // Validation & feedback states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showToast, setShowToast] = useState<boolean>(false);
  const [createdTxNo, setCreatedTxNo] = useState<string>('');

  const handleAddItem = () => {
    if (items.length >= 10) return;
    setItems([...items, { description: '', amount: '', sign: '+' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = <K extends keyof ItemInput>(index: number, field: K, value: ItemInput[K]) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  // Calculate dynamic totals
  const totalAmount = items.reduce((sum, item) => {
    const val = parseFloat(item.amount) || 0;
    const signedVal = item.sign === '-' ? -val : val;
    return sum + signedVal;
  }, 0);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    let hasItemErrors = false;

    items.forEach((item, idx) => {
      if (!item.description.trim()) {
        newErrors[`desc_${idx}`] = t.required;
        hasItemErrors = true;
      }
      if (!item.amount) {
        newErrors[`amt_${idx}`] = t.required;
        hasItemErrors = true;
      } else {
        const num = parseFloat(item.amount);
        if (isNaN(num) || num <= 0) {
          newErrors[`amt_${idx}`] = t.positiveNumber;
          hasItemErrors = true;
        }
      }
    });

    if (totalAmount <= 0) {
      newErrors['total_amount'] = isRtl
        ? 'يجب أن يكون إجمالي مبلغ المصروف أكبر من الصفر.'
        : 'Total expense amount must be greater than zero.';
      hasItemErrors = true;
    }

    setErrors(newErrors);
    return !hasItemErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Map items to sub-items structure
    const parsedItems = items.map(it => {
      const val = parseFloat(it.amount) || 0;
      const signedVal = it.sign === '-' ? -val : val;
      return {
        description: it.description.trim(),
        amount: signedVal
      };
    });

    // Combined descriptions for lists
    const combinedDescription = parsedItems.map(it => {
      const prefix = it.amount < 0 ? '(-)' : '';
      return `${prefix}${it.description}`;
    }).join(' / ');
    
    // Add transaction via CustodyDB manager
    const newTx = CustodyDB.addTransaction({
      date,
      description: combinedDescription,
      amount: totalAmount,
      items: parsedItems,
      amount_in_words: {
        ar: getArabicTafqeet(totalAmount),
        en: getEnglishTafqeet(totalAmount)
      },
      notes: notes.trim() || undefined
    });

    // Reset Form to initial single empty row
    setItems([{ description: '', amount: '', sign: '+' }]);
    setNotes('');
    setCreatedTxNo(newTx.transaction_no);
    setShowToast(true);

    // Auto hide toast after 4 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
          <PlusCircle className="text-emerald-500" />
          <span>{t.newExpense}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {isRtl 
            ? 'إنشاء مصروف جديد يسجل في حالة (معلق) لحين تقديم سند الصرف النقدي لتسويته.' 
            : 'Create a new cash expense with Pending status, awaiting formal payment voucher entry.'
          }
        </p>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-3 shadow-md animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <span className="font-bold">{t.successCreated}</span>
            <div className="text-xs opacity-90 mt-0.5">
              {isRtl 
                ? `رقم الحركة الصادر تلقائياً: ${createdTxNo}` 
                : `Generated Sequence Number: ${createdTxNo}`
              }
            </div>
          </div>
          <button 
            onClick={() => onNavigate('pending')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 border-none shrink-0 ${
              isRtl ? 'margin-right-auto mr-auto' : 'margin-left-auto ml-auto'
            }`}
          >
            {isRtl ? 'عرض المصاريف المعلقة' : 'View Pending'}
          </button>
        </div>
      )}

      {/* Form Container */}
      <div className={`p-6 rounded-2xl border ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date Picker Row */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar size={14} className="text-slate-400" />
              <span>{t.date} *</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
              required
            />
          </div>

          {/* Items Section (Up to 10 lines) */}
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isRtl ? 'البنود والبيانات المصاحبة (حتى 10 بنود)' : 'Line Items & Details (Up to 10 items)'}
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={items.length >= 10}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  items.length >= 10
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <Plus size={14} />
                <span>{isRtl ? 'إضافة بيان ومبلغ' : 'Add Description & Amount'}</span>
              </button>
            </div>

            <div className="space-y-3.5">
              {items.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border relative transition-all ${
                    theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/40 border-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold bg-slate-200/60 dark:bg-slate-800 px-2.5 py-0.5 rounded-md text-slate-500">
                      {isRtl ? `بند #${idx + 1}` : `Item #${idx + 1}`}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* Item Description */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <FileText size={12} />
                        <span>{isRtl ? 'البيان / الوصف *' : 'Description *'}</span>
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        placeholder={isRtl ? 'مثال: شراء أحبار ومستلزمات مكتبية' : 'e.g., Ink cartridges and stationery'}
                        className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                      {errors[`desc_${idx}`] && (
                        <span className="text-rose-500 text-[10px] mt-0.5 block">{errors[`desc_${idx}`]}</span>
                      )}
                    </div>

                    {/* Item Amount */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <DollarSign size={12} />
                        <span>{isRtl ? 'المعامل والمبلغ *' : 'Sign & Amount *'}</span>
                      </label>
                      <div className="flex gap-1.5 items-center">
                        {/* Sign Selector */}
                        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 h-[34px] p-0.5 bg-slate-100 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => handleItemChange(idx, 'sign', '+')}
                            className={`w-7 h-full flex items-center justify-center rounded-md text-[13px] font-black transition-all ${
                              item.sign === '+' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemChange(idx, 'sign', '-')}
                            className={`w-7 h-full flex items-center justify-center rounded-md text-[13px] font-black transition-all ${
                              item.sign === '-' 
                                ? 'bg-rose-500 text-white shadow-sm' 
                                : 'bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                          >
                            -
                          </button>
                        </div>

                        {/* Numeric Input */}
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                            placeholder="0.00"
                            className={`w-full h-[34px] px-3 py-2 rounded-lg border text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                            } ${isRtl ? 'pl-8' : 'pr-8'}`}
                          />
                          <div className={`absolute top-0 bottom-0 flex items-center px-2 text-[10px] font-bold text-slate-400 ${
                            isRtl ? 'left-0 border-r border-slate-200 dark:border-slate-700' : 'right-0 border-l border-slate-200 dark:border-slate-700'
                          }`}>
                            ج.م
                          </div>
                        </div>
                      </div>
                      {errors[`amt_${idx}`] && (
                        <span className="text-rose-500 text-[10px] mt-0.5 block">{errors[`amt_${idx}`]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Grand Total Card with live Tafneet */}
          {totalAmount > 0 && (
            <div className={`p-4 rounded-xl border flex flex-col gap-2.5 ${
              theme === 'dark' ? 'bg-emerald-950/15 border-emerald-500/20' : 'bg-emerald-50/40 border-emerald-500/10'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Coins size={14} className="text-emerald-500" />
                  {isRtl ? 'إجمالي مبلغ المصروف:' : 'Total Expense Amount:'}
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
                </span>
              </div>

              <div className="text-xs space-y-1.5 border-t border-dashed border-slate-200 dark:border-slate-800 pt-2.5">
                <div className="flex items-start gap-1">
                  <span className="text-slate-400 font-bold shrink-0">{isRtl ? 'التفقيط بالعربية:' : 'Arabic Words:'}</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{getArabicTafqeet(totalAmount)}</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-slate-400 font-bold shrink-0">{isRtl ? 'التفقيط بالإنجليزية:' : 'English Words:'}</span>
                  <span className="font-semibold text-slate-600 dark:text-neutral-400">{getEnglishTafqeet(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Validation message for non-positive net total */}
          {errors.total_amount && (
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-xs font-bold leading-relaxed">
              {errors.total_amount}
            </div>
          )}

          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {t.notes} <span className="text-[10px] text-slate-400 lowercase">({isRtl ? 'اختياري' : 'optional'})</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isRtl ? 'ملاحظات تدقيقية للقسم المالي...' : 'Internal notes or approval references...'}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
          </div>

          {/* Submit Button */}
          <button
            id="btn-submit-expense"
            type="submit"
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg hover:scale-[1.01]"
          >
            <FilePlus2 size={18} />
            <span>{isRtl ? 'تسجيل كحركة معلقة' : 'Register Pending Expense'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
