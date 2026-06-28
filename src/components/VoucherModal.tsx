import React from 'react';
import { X, Printer } from 'lucide-react';
import { CustodyDB } from '../db';
import { Transaction, Theme } from '../types';

interface VoucherModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
}

// Arabic Tafqeet (number to words) helper function
function getArabicTafqeet(amount: number): string {
  const parts = amount.toFixed(2).split('.');
  const pounds = parseInt(parts[0], 10);
  const piastres = parseInt(parts[1], 10);

  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertBelowHundred(n: number): string {
    if (n === 0) return '';
    if (n <= 10) return units[n];
    if (n < 20) return teens[n - 10];
    const u = n % 10;
    const t = Math.floor(n / 10);
    if (u > 0) {
      return units[u] + ' و' + tens[t];
    }
    return tens[t];
  }

  function convertBelowThousand(n: number): string {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rest = n % 100;
    let result = '';
    
    if (h > 0) {
      result += hundreds[h];
    }
    
    if (rest > 0) {
      if (h > 0) result += ' و';
      result += convertBelowHundred(rest);
    }
    return result;
  }

  function formatPounds(p: number): string {
    if (p === 0) return 'صفر';
    if (p === 1) return 'جنيه واحد';
    if (p === 2) return 'جنيهان';
    if (p >= 3 && p <= 10) return convertBelowThousand(p) + ' جنيهات';
    
    let result = '';
    const th = Math.floor(p / 1000);
    const rem = p % 1000;

    if (th > 0) {
      if (th === 1) result += 'ألف';
      else if (th === 2) result += 'ألفان';
      else if (th >= 3 && th <= 10) result += convertBelowThousand(th) + ' آلاف';
      else result += convertBelowThousand(th) + ' ألف';
    }

    if (rem > 0) {
      if (th > 0) result += ' و';
      result += convertBelowThousand(rem);
    }

    return result + ' جنيه';
  }

  let text = formatPounds(pounds);
  
  if (pounds > 10 && pounds % 100 !== 0) {
    text = text.replace(' جنيه', ' جنيهاً');
  }

  if (piastres > 0) {
    let piastreText = convertBelowHundred(piastres);
    if (piastres === 1) piastreText = 'قرش واحد';
    else if (piastres === 2) piastreText = 'قرشان';
    else if (piastres >= 3 && piastres <= 10) piastreText += ' قروش';
    else piastreText += ' قرشاً';
    text += ' و' + piastreText;
  }
  
  return 'فقط ' + text + ' لا غير';
}

export default function VoucherModal({ transaction, isOpen, onClose, theme }: VoucherModalProps) {
  if (!isOpen || !transaction) return null;

  // Fetch associated station
  const station = CustodyDB.getStations().find(s => s.id === transaction.station_id) || {
    station_name: 'مزرعة افتراضية',
    station_code: 'STN-XXX'
  };

  const catLabel = 'مصروفات عامة';

  // Split amount into Pounds and Piastres
  const pounds = Math.floor(transaction.amount);
  const piastres = Math.round((transaction.amount % 1) * 100);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Container Card */}
      <div 
        id="voucher-modal-card"
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh] ${
          theme === 'dark' ? 'bg-[#1e293b] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header (Hidden when printing via index.css) */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="text-emerald-500 h-5 w-5" />
            <h3 className="font-bold text-sm md:text-base">
              معاينة وطباعة مستند صرف النقدية
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body (Scrollable preview area) */}
        <div className="flex-1 p-6 overflow-auto bg-slate-100/50 dark:bg-slate-900/30">
          
          {/* Print button on screen */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/10 hover:shadow-lg transition-all"
            >
              <Printer size={15} />
              <span>طباعة مستند صرف النقدية</span>
            </button>
          </div>

          {/* Printable Sheet Wrapper */}
          <div 
            id="voucher-sheet-printable" 
            className="w-[210mm] min-h-[297mm] mx-auto p-10 border-[3px] border-black bg-white text-black text-xs font-bold leading-relaxed shadow-lg relative print:shadow-none print:border-black print:rounded-none print:w-full print:min-h-0 print:p-4" 
            dir="rtl"
          >
            {/* Upper Heading Row with Logo and Company Name */}
            <div className="flex justify-between items-start border-b-[2px] border-black pb-4 mb-4">
              {/* Right Side: Company Info & Logo */}
              <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="border-[2.5px] border-black rounded-[50%/50%] px-3.5 py-1.5 flex flex-col items-center justify-center leading-none bg-white shrink-0 shadow-sm h-[52px] w-[90px]">
                  <span className="text-[20px] font-black leading-none text-black">كوكي</span>
                  <span className="text-[9px] font-bold font-mono tracking-wider mt-0.5 leading-none text-black">Koki</span>
                </div>
                
                {/* Text Details next to Logo */}
                <div className="text-right space-y-0.5">
                  <h1 className="text-[13px] font-black text-black">شركة / القاهرة الجديدة للدواجن</h1>
                  <p className="text-[12px] text-neutral-800 font-bold">مزرعة / {station.station_name}</p>
                </div>
              </div>

              {/* Center / Left Side: Title */}
              <div className="text-center self-center">
                <h2 className="text-[15px] font-black border-[2.5px] border-black px-6 py-2 bg-neutral-100 text-black shadow-sm">
                  مستند صرف نقدى رقم {transaction.voucher_no || transaction.transaction_no}
                </h2>
              </div>
            </div>

            {/* Meta specification rows */}
            <div className="grid grid-cols-2 border border-black p-3 rounded-lg mb-4 text-xs font-bold text-black gap-2">
              <div className="space-y-2">
                <div>
                  <span className="text-neutral-500 font-bold">التاريخ: </span>
                  <span className="font-mono text-black font-black">{transaction.voucher_date || transaction.date}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-bold">الإسم: </span>
                  <span className="text-black font-black">{station.station_name}</span>
                </div>
              </div>
              <div className="text-left space-y-2 self-end">
                <div>
                  <span className="text-neutral-500 font-bold">الجهة : </span>
                  <span className="text-black font-black">الإدارة المالية</span>
                </div>
              </div>
            </div>

            {/* Table Details */}
            <div className="border border-black rounded-lg overflow-hidden mb-6">
              <table className="w-full text-center border-collapse text-xs font-bold">
                <thead>
                  <tr className="bg-neutral-100 text-black border-b border-black font-black">
                    <th className="border-l border-black py-2 w-[18%] text-xs" rowSpan={2}>التوجيــــــــــه</th>
                    <th className="border-l border-black py-2 w-[10%] text-xs" rowSpan={2}>المرفقات</th>
                    <th className="border-l border-black py-2 w-[52%] text-xs" rowSpan={2}>البيـــــــــــــــــان</th>
                    <th className="py-2 w-[20%] text-xs border-b border-black" colSpan={2}>المبلغ</th>
                  </tr>
                  <tr className="bg-neutral-50 text-black border-b-2 border-black text-[10px] font-black">
                    <th className="border-l border-black py-1 w-[13%]">جنيه</th>
                    <th className="py-1 w-[7%]">قرش</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const itemsToRender = transaction.items && transaction.items.length > 0 
                      ? transaction.items 
                      : [{ description: transaction.description, amount: transaction.amount }];

                    const totalRowsTarget = 12;
                    const emptyRowsNeeded = Math.max(1, totalRowsTarget - itemsToRender.length);

                    return (
                      <>
                        {/* Active expense rows */}
                        {itemsToRender.map((item, idx) => {
                          const isNegative = item.amount < 0;
                          const absAmount = Math.abs(item.amount);
                          const itemPounds = Math.floor(absAmount);
                          const itemPiastres = Math.round((absAmount % 1) * 100);
                          return (
                            <tr key={idx} className="h-9 border-b border-black text-black">
                              <td className="border-l border-black px-2 text-[11px] truncate max-w-[120px] font-bold text-center">
                                {catLabel}
                              </td>
                              <td className="border-l border-black text-neutral-800 font-bold text-[10px] text-center">
                                {idx === 0 && transaction.notes && (transaction.notes.includes('مرفق') || transaction.notes.includes('فاتورة')) ? 'مرفق' : '-'}
                              </td>
                              <td className="border-l border-black px-3 text-right font-black text-black leading-relaxed text-[11px]">
                                {item.description}
                              </td>
                              <td className="border-l border-black font-mono text-xs font-black text-black text-center">
                                {isNegative ? '-' : ''}{itemPounds.toLocaleString('en-US')}
                              </td>
                              <td className="font-mono text-[11px] font-black text-black text-center">
                                {itemPiastres === 0 ? '0' : itemPiastres}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Empty dotted spacers as in the original Excel form */}
                        {Array.from({ length: emptyRowsNeeded }).map((_, idx) => (
                          <tr key={idx} className="h-6 border-b border-black">
                            <td className="border-l border-black">&nbsp;</td>
                            <td className="border-l border-black">&nbsp;</td>
                            <td className="border-l border-black">&nbsp;</td>
                            <td className="border-l border-black">&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}
                      </>
                    );
                  })()}

                  {/* Total Row */}
                  <tr className="h-9 bg-neutral-50/60 font-black border-t-2 border-black text-black">
                    <td className="border-l border-black">&nbsp;</td>
                    <td className="border-l border-black">&nbsp;</td>
                    <td className="border-l border-black px-3 text-right text-[11px] text-black">
                      <span className="font-black">{getArabicTafqeet(transaction.amount)}</span>
                    </td>
                    <td className="border-l border-black font-mono text-xs text-black font-black text-center">
                      {pounds.toLocaleString('en-US')}
                    </td>
                    <td className="font-mono text-[11px] text-black font-black text-center">
                      {piastres === 0 ? '0' : piastres}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature section */}
            <div className="grid grid-cols-3 gap-y-12 gap-x-6 pt-6 text-center text-[11px] font-black border-t border-black text-black">
              {/* Right Column: المدير المسئول & الإدارة المختصة */}
              <div className="space-y-8">
                <div>
                  <p className="text-black font-black mb-1">المدير المسئول</p>
                  <div className="text-neutral-400 font-mono text-[11px] select-none tracking-tighter">................................................</div>
                </div>
                <div>
                  <p className="text-black font-black mb-1">الإدارة المختصة</p>
                  <div className="text-neutral-400 font-mono text-[11px] select-none tracking-tighter">................................................</div>
                </div>
              </div>

              {/* Center Column: المحاسب & مدير عام القطاع */}
              <div className="space-y-8">
                <div>
                  <p className="text-black font-black mb-1">المحاسب</p>
                  <div className="text-neutral-400 font-mono text-[11px] select-none tracking-tighter">................................................</div>
                </div>
                <div>
                  <p className="text-black font-black mb-1">مدير عام القطاع</p>
                  <div className="text-neutral-400 font-mono text-[11px] select-none tracking-tighter">................................................</div>
                </div>
              </div>

              {/* Left Column: المراجع & مدير عام المنطقة */}
              <div className="space-y-8">
                <div>
                  <p className="text-black font-black mb-1">المراجع</p>
                  <div className="text-neutral-400 font-mono text-[11px] select-none tracking-tighter">................................................</div>
                </div>
                <div>
                  <p className="text-black font-black mb-1">مدير عام المنطقة</p>
                  <div className="text-neutral-400 font-mono text-[11px] select-none tracking-tighter">................................................</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
