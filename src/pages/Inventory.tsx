import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  TrendingUp, 
  BarChart3, 
  SlidersHorizontal,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Printer,
  ShieldCheck,
  Building2,
  MapPin,
  PieChart,
  PackageCheck
} from 'lucide-react';
import { 
  InventoryDocument, 
  InventoryDocType, 
  InventoryDocStatus, 
  Warehouse, 
  Product, 
  StockMovement 
} from '../types/inventory';
import { InventoryModule } from '../db/inventory';
import { CustodyDB } from '../db';
import InventoryDocumentForm from '../components/InventoryDocumentForm';

interface InventoryProps {
  language: 'en' | 'ar';
  theme: 'light' | 'dark';
}

type SubTab = 'documents' | 'reports';
type ReportType = 'card' | 'balances' | 'valuation' | 'slow_moving' | 'stocktake' | 'movements';

export default function Inventory({ language, theme }: InventoryProps) {
  const isRtl = language === 'ar';
  const activeUser = CustodyDB.getActiveUser();

  const getDocTypeLabel = (type: string, scrapAction?: 'IN' | 'OUT') => {
    switch (type) {
      case 'Receipt':
        return isRtl ? 'إذن إضافة' : 'Receipt';
      case 'Issue':
        return isRtl ? 'إذن صرف' : 'Issue';
      case 'Transfer':
        return isRtl ? 'تحويل بين مخازن' : 'Transfer';
      case 'BranchTransfer':
        return isRtl ? 'تحويل إلى فرع' : 'Branch Transfer';
      case 'StationTransfer':
        return isRtl ? 'تحويل إلى محطة' : 'Station Transfer';
      case 'BranchReturn':
        return isRtl ? 'مرتجع فرع/محطة' : 'Branch Return';
      case 'SupplierReturn':
        return isRtl ? 'مرتجع إلى مورد' : 'Supplier Return';
      case 'Adjustment':
        return isRtl ? 'تسوية جردية' : 'Adjustment';
      case 'Damage':
        if (scrapAction === 'OUT') {
          return isRtl ? 'خردة/كهنة - صرف (بيع)' : 'Scrap/Obsolete - Issue';
        }
        return isRtl ? 'خردة/كهنة - إضافة' : 'Scrap/Obsolete - Receipt';
      default:
        return type;
    }
  };

  // Navigation state
  const [activeTab, setActiveTab] = useState<SubTab>('documents');
  const [activeReport, setActiveReport] = useState<ReportType>('balances');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  // Filter States (Documents)
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Report Filter States
  const [repWarehouse, setRepWarehouse] = useState<string>('all');
  const [repProduct, setRepProduct] = useState<string>('');

  // Refresh trigger state
  const [refreshKey, setRefreshKey] = useState(0);

  // Load lists from DB
  const warehouses = useMemo(() => InventoryModule.getWarehouses(), [refreshKey]);
  const products = useMemo(() => InventoryModule.getProducts(), [refreshKey]);
  const documents = useMemo(() => InventoryModule.getInventoryDocuments(), [refreshKey]);
  const stockMovements = useMemo(() => InventoryModule.getStockMovements(), [refreshKey]);

  const activeDoc = useMemo(() => {
    if (!selectedDocId) return null;
    return documents.find(d => d.id === selectedDocId) || null;
  }, [selectedDocId, documents]);

  // Document Filtering
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (filterType !== 'all' && doc.doc_type !== filterType) return false;
      if (filterStatus !== 'all' && doc.status !== filterStatus) return false;
      if (filterWarehouse !== 'all' && doc.source_warehouse_id !== filterWarehouse) return false;
      
      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase().trim();
        return (
          doc.doc_no.toLowerCase().includes(query) ||
          (doc.reason && doc.reason.toLowerCase().includes(query)) ||
          (doc.statement && doc.statement.toLowerCase().includes(query)) ||
          (doc.recipient && doc.recipient.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [documents, filterType, filterStatus, filterWarehouse, filterSearch]);

  // Handle document transition
  const handleTransition = async (docId: string, event: 'Submit' | 'Approve' | 'Reject' | 'Cancel') => {
    const res = await InventoryModule.triggerLifecycleTransition(docId, event);
    if (res.success) {
      setRefreshKey(prev => prev + 1);
    } else {
      alert(isRtl ? res.messageAr : res.messageEn);
    }
  };

  const handleDelete = (docId: string) => {
    if (confirm(isRtl ? 'هل أنت متأكد من حذف هذه المسودة نهائياً؟' : 'Are you sure you want to delete this draft?')) {
      InventoryModule.deleteInventoryDocument(docId);
      setSelectedDocId(null);
      setRefreshKey(prev => prev + 1);
    }
  };

  // Stepper helper for lifecycle visualizer
  const getStepperSteps = (status: InventoryDocStatus) => {
    const steps = [
      { key: 'Draft', labelAr: 'مسودة', labelEn: 'Draft' },
      { key: 'Pending', labelAr: 'مراجعة', labelEn: 'Pending' },
      { key: 'Posted', labelAr: 'مرحل', labelEn: 'Posted' }
    ];

    let currentIdx = 0;
    if (status === 'Pending') currentIdx = 1;
    if (status === 'Posted' || status === 'Approved') currentIdx = 2;
    if (status === 'Rejected' || status === 'Cancelled') {
      return [
        { key: 'Draft', labelAr: 'مسودة', labelEn: 'Draft' },
        { key: status, labelAr: status === 'Rejected' ? 'مرفوض' : 'ملغي', labelEn: status, isError: true }
      ];
    }

    return steps.map((s, idx) => ({
      ...s,
      isCompleted: idx < currentIdx,
      isActive: idx === currentIdx
    }));
  };

  // --- REPORT ANALYTICS COMPUTATIONS ---

  // Report: Stock Card (كارت الصنف للرصيد المستمر والوارد والمنصرف)
  const reportStockCard = useMemo(() => {
    if (!repProduct) return [];
    const prodMovements = stockMovements.filter(m => 
      m.product_id === repProduct && 
      (repWarehouse === 'all' || m.warehouse_id === repWarehouse)
    );
    // Sort chronologically
    const sorted = [...prodMovements].sort((a, b) => a.created_at.localeCompare(b.created_at));
    
    let runningBalance = 0;
    return sorted.map(m => {
      runningBalance += m.qty_change;
      return {
        ...m,
        runningBalance
      };
    }).reverse(); // Latest first
  }, [stockMovements, repProduct, repWarehouse]);

  // Report: Warehouse Balances & Min Alerts
  const reportBalances = useMemo(() => {
    return products.map(p => {
      const warehouseBalances = warehouses.map(w => {
        const stock = InventoryModule.getProductStock(p.id, w.id);
        return {
          warehouseId: w.id,
          warehouseName: w.name,
          stock
        };
      });

      const totalStock = warehouseBalances.reduce((sum, item) => sum + item.stock, 0);

      return {
        ...p,
        totalStock,
        balances: warehouseBalances,
        isUnderMin: totalStock < p.min_stock
      };
    });
  }, [products, warehouses, refreshKey]);

  // Report: Slow Moving Stock (Items with no movements in selected timeframe - simulated as 30 days)
  const reportSlowMoving = useMemo(() => {
    return products.filter(p => {
      const hasMovements = stockMovements.some(m => m.product_id === p.id);
      return !hasMovements; // No movements whatsoever
    });
  }, [products, stockMovements]);

  // Report: Valuation summary
  const reportValuation = useMemo(() => {
    let totalCostVal = 0;
    const items = products.map(p => {
      const totalStock = warehouses.reduce((sum, w) => sum + InventoryModule.getProductStock(p.id, w.id), 0);
      const price = p.last_purchase_price || 0;
      const valuation = totalStock * price;
      totalCostVal += valuation;
      return {
        ...p,
        totalStock,
        valuation
      };
    });

    return {
      items,
      totalCostVal
    };
  }, [products, warehouses, refreshKey]);

  return (
    <div id="inventory-module-page" className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <Layers className="text-emerald-500 h-6 w-6 md:h-8 md:w-8" />
            <span>{isRtl ? 'إدارة المستودعات وحركة المخزون' : 'Inventory & Warehouse Management'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
            {isRtl 
              ? 'مراقبة الرصيد المستمر، السندات المخزنية، ومطابقة حركة التوريدات والتحويلات' 
              : 'Continuous stock ledger tracking, inventory vouchers, supply logs, and transfers'}
          </p>
        </div>

        {!isFormOpen && !selectedDocId && (
          <button
            onClick={() => {
              setEditingDocId(null);
              setIsFormOpen(true);
            }}
            className="w-full md:w-auto px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-lg shadow-emerald-600/15 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>{isRtl ? 'إنشاء سند مخزني جديد' : 'New Inventory Voucher'}</span>
          </button>
        )}
      </div>

      {/* Sub tabs (Documents vs Reports) */}
      {!isFormOpen && !selectedDocId && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-xs md:text-sm font-black transition-all ${
              activeTab === 'documents'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isRtl ? 'أذون ومستندات الحركة' : 'Inventory Documents'}
          </button>
          <button
            onClick={() => {
              setActiveTab('reports');
              if (products.length > 0 && !repProduct) {
                setRepProduct(products[0].id);
              }
            }}
            className={`pb-3 text-xs md:text-sm font-black transition-all ${
              activeTab === 'reports'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isRtl ? 'التقارير الرقابية والتحليلية' : 'Inventory Reports'}
          </button>
        </div>
      )}

      {/* RENDER DYNAMIC FORM */}
      {isFormOpen && (
        <div className="space-y-4">
          <button
            onClick={() => setIsFormOpen(false)}
            className={`inline-flex items-center gap-1 text-xs font-bold ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            <span>{isRtl ? 'العودة لجدول المستندات' : 'Back to Documents'}</span>
          </button>
          <InventoryDocumentForm
            docId={editingDocId || undefined}
            onSave={() => {
              setIsFormOpen(false);
              setEditingDocId(null);
              setRefreshKey(prev => prev + 1);
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingDocId(null);
            }}
            language={language}
            theme={theme}
          />
        </div>
      )}

      {/* RENDER DETAILED VIEW WITH LIFE CYCLE CONTROLS */}
      {!isFormOpen && selectedDocId && activeDoc && (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedDocId(null)}
            className={`inline-flex items-center gap-1 text-xs font-bold ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            <span>{isRtl ? 'العودة لجدول المستندات' : 'Back to Documents'}</span>
          </button>

          {/* Stepper Visualizer (المسار الزمني لاعتماد السند) */}
          <div className={`p-4 md:p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'}`}>
            <h4 className="text-xs font-bold mb-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={14} />
              <span>{isRtl ? 'مسار دورة الاعتماد والامتثال للمستند' : 'Lifecycle Compliance Path'}</span>
            </h4>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6 w-full sm:w-auto">
                {getStepperSteps(activeDoc.status).map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      step.isActive ? 'bg-emerald-600 text-white animate-pulse' :
                      step.isCompleted ? 'bg-emerald-500/20 text-emerald-600' :
                      step.isError ? 'bg-rose-500/20 text-rose-600' :
                      'bg-slate-800 text-slate-500'
                    }`}>
                      {step.isCompleted ? '✓' : idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-black">{isRtl ? step.labelAr : step.labelEn}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{step.key}</p>
                    </div>
                    {idx < 2 && <div className="hidden sm:block w-12 h-0.5 bg-slate-700"></div>}
                  </div>
                ))}
              </div>

              {/* ACTION BUTTONS (تحكم دورة الاعتماد) */}
              <div className="flex items-center gap-2.5">
                {activeDoc.status === 'Draft' && (
                  <>
                    <button
                      onClick={() => handleTransition(activeDoc.id, 'Submit')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {isRtl ? 'إرسال للاعتماد النهائي' : 'Submit for Approval'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingDocId(activeDoc.id);
                        setIsFormOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black transition-all cursor-pointer"
                    >
                      {isRtl ? 'تعديل المسودة' : 'Edit Draft'}
                    </button>
                    <button
                      onClick={() => handleDelete(activeDoc.id)}
                      className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-500 text-xs font-black transition-all cursor-pointer"
                    >
                      {isRtl ? 'حذف المسودة' : 'Delete'}
                    </button>
                  </>
                )}

                {activeDoc.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => handleTransition(activeDoc.id, 'Approve')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {isRtl ? 'اعتماد وترحيل المخزون' : 'Approve & Post Stock'}
                    </button>
                    <button
                      onClick={() => handleTransition(activeDoc.id, 'Reject')}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {isRtl ? 'رفض المستند' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleTransition(activeDoc.id, 'Cancel')}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-black transition-all cursor-pointer"
                    >
                      {isRtl ? 'إلغاء المستند' : 'Cancel'}
                    </button>
                  </>
                )}

                {activeDoc.status === 'Posted' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 size={14} />
                    <span>{isRtl ? 'تم الترحيل النهائي وتحديث المخزن تلقائياً' : 'Posted & Inventory Updated'}</span>
                  </div>
                )}
                
                {activeDoc.status === 'Rejected' && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold bg-rose-500/5 px-3 py-1.5 rounded-xl border border-rose-500/20">
                    <XCircle size={14} />
                    <span>{isRtl ? 'تم رفض السند من المدير المسؤول' : 'Rejected'}</span>
                  </div>
                )}

                {activeDoc.status === 'Cancelled' && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold bg-slate-500/5 px-3 py-1.5 rounded-xl border border-slate-500/10">
                    <XCircle size={14} />
                    <span>{isRtl ? 'مستند ملغي' : 'Cancelled'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Document Content Block */}
          <div className={`p-6 md:p-8 rounded-3xl border transition-colors duration-200 shadow-xl ${
            theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
          }`}>
            <div className="border-b-2 border-dashed border-slate-200 dark:border-slate-800 pb-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                  CF
                </div>
                <div>
                  <h3 className="text-xs font-bold">Cairo Poultry ERP</h3>
                  <p className="text-[9px] font-mono text-slate-400">WAREHOUSE MANAGEMENT SHEET</p>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {isRtl ? 'تفاصيل السند المخزني الرسمي' : 'Official Stock Sheet Detail'}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{activeDoc.doc_no}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-mono text-slate-400">{activeDoc.date}</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeDoc.status === 'Posted' ? 'bg-emerald-500/10 text-emerald-500' :
                  activeDoc.status === 'Pending' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-slate-500/10 text-slate-400'
                }`}>
                  {activeDoc.status}
                </span>
              </div>
            </div>

            {/* Grid of basic data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs mb-8">
              <div>
                <p className="text-slate-400 font-bold mb-1">{isRtl ? 'نوع المستند' : 'Doc Type'}</p>
                <p className="font-black text-slate-700 dark:text-slate-200">
                  {getDocTypeLabel(activeDoc.doc_type, activeDoc.scrap_action)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-bold mb-1">
                  {activeDoc.doc_type === 'Damage' 
                    ? (isRtl ? 'مخزن الخردة / الكهنة' : 'Scrap / Obsolete Warehouse') 
                    : (isRtl ? 'المخزن الرئيسي' : 'Primary Warehouse')}
                </p>
                <p className="font-black text-slate-700 dark:text-slate-200">
                  {warehouses.find(w => w.id === activeDoc.source_warehouse_id)?.name || activeDoc.source_warehouse_id}
                </p>
              </div>
              {activeDoc.dest_entity_id && (
                <div>
                  <p className="text-slate-400 font-bold mb-1">{isRtl ? 'الجهة المستلمة' : 'Destination Entity'}</p>
                  <p className="font-black text-slate-700 dark:text-slate-200">
                    {activeDoc.dest_entity_id} ({activeDoc.dest_entity_type})
                  </p>
                </div>
              )}
              <div>
                <p className="text-slate-400 font-bold mb-1">{isRtl ? 'سبب الحركة' : 'Stock Reason'}</p>
                <p className="font-medium">{activeDoc.reason}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold mb-1">{isRtl ? 'البيان' : 'Memo'}</p>
                <p className="font-medium">{activeDoc.statement}</p>
              </div>
              {activeDoc.recipient && (
                <div>
                  <p className="text-slate-400 font-bold mb-1">
                    {activeDoc.doc_type === 'Damage'
                      ? (activeDoc.scrap_action === 'OUT' 
                          ? (isRtl ? 'الجهة المستلمة / المشتري' : 'Buyer / Scrap Recipient')
                          : (isRtl ? 'المشرف المسؤول عن التكهين' : 'Responsible Supervisor'))
                      : (isRtl ? 'المستلم المسئول' : 'Operator / Driver')}
                  </p>
                  <p className="font-medium">{activeDoc.recipient}</p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-8">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">{isRtl ? 'الصنف الكود والاسم' : 'Item Description'}</th>
                    <th className="p-3 text-center">{isRtl ? 'الوحدة' : 'Unit'}</th>
                    <th className="p-3 text-center">{isRtl ? 'الكمية المستندة' : 'Quantity'}</th>
                    {activeDoc.doc_type === 'Receipt' && <th className="p-3 text-center">{isRtl ? 'سعر الشراء (ج.م)' : 'Purchase Price'}</th>}
                    <th className="p-3">{isRtl ? 'ملاحظات الصنف' : 'Item Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                  {activeDoc.items.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="p-3 text-center font-mono text-slate-400 font-bold">{index + 1}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                        {item.product_name} <span className="text-[10px] font-mono text-slate-400">[{item.product_code}]</span>
                      </td>
                      <td className="p-3 text-center text-slate-500 dark:text-slate-400">{item.unit}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{item.qty}</td>
                      {activeDoc.doc_type === 'Receipt' && <td className="p-3 text-center font-mono">{item.last_purchase_price || 0}</td>}
                      <td className="p-3 text-slate-500 dark:text-slate-400">{item.notes || <span className="italic text-slate-400">---</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            {activeDoc.notes && (
              <div className="mb-8 p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs">
                <p className="font-bold mb-1 text-slate-400">{isRtl ? 'ملاحظات المستند العامة:' : 'General Document Comments:'}</p>
                <p className="text-slate-600 dark:text-slate-300">{activeDoc.notes}</p>
              </div>
            )}

            {/* Footer signatures */}
            <div className="grid grid-cols-3 gap-4 text-center text-[10px] pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
              <div>
                <p className="font-bold text-slate-300 mb-1">{isRtl ? 'مُعد السند' : 'Prepared by'}</p>
                <p className="font-mono text-slate-500">{activeDoc.created_by}</p>
              </div>
              <div>
                <p className="font-bold text-slate-300 mb-1">{isRtl ? 'توقيع المستلم' : 'Recipient Stamp'}</p>
                <p className="font-mono text-slate-500">{activeDoc.recipient || '---'}</p>
              </div>
              <div>
                <p className="font-bold text-slate-300 mb-1">{isRtl ? 'توقيع المدير المعتمد' : 'Authorized Signee'}</p>
                <p className="font-mono text-slate-500">{activeDoc.status === 'Posted' ? 'Enterprise Engine Sec' : '---'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: DOCUMENTS LIST */}
      {!isFormOpen && !selectedDocId && activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Controls / Filter row */}
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
            theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
          }`}>
            {/* Search inputs */}
            <div className="relative flex items-center w-full md:w-80">
              <Search size={14} className="absolute right-3.5 text-slate-400" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder={isRtl ? 'ابحث برقم المستند، المستلم، البيان...' : 'Search by voucher, recipient...'}
                className={`w-full pr-10 pl-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>

            {/* Select dropdown filters */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`px-3 py-2 text-xs border rounded-xl font-medium focus:outline-none ${
                  theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                }`}
              >
                <option value="all">{isRtl ? 'كل أنواع المستندات' : 'All Document Types'}</option>
                <option value="Receipt">{isRtl ? 'إذن إضافة' : 'Receipt'}</option>
                <option value="Issue">{isRtl ? 'إذن صرف' : 'Issue'}</option>
                <option value="Transfer">{isRtl ? 'تحويل بين مخازن' : 'Transfer'}</option>
                <option value="BranchTransfer">{isRtl ? 'تحويل إلى فرع' : 'Branch Transfer'}</option>
                <option value="StationTransfer">{isRtl ? 'تحويل إلى محطة' : 'Station Transfer'}</option>
                <option value="BranchReturn">{isRtl ? 'مرتجع فرع/محطة' : 'Branch Return'}</option>
                <option value="SupplierReturn">{isRtl ? 'مرتجع إلى مورد' : 'Supplier Return'}</option>
                <option value="Adjustment">{isRtl ? 'تسوية جرد' : 'Adjustment'}</option>
                <option value="Damage">{isRtl ? 'خردة / كهنة' : 'Scrap / Obsolete'}</option>
              </select>

              {/* Warehouse Filter */}
              <select
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
                className={`px-3 py-2 text-xs border rounded-xl font-medium focus:outline-none ${
                  theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                }`}
              >
                <option value="all">{isRtl ? 'كل المستودعات' : 'All Warehouses'}</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`px-3 py-2 text-xs border rounded-xl font-medium focus:outline-none ${
                  theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                }`}
              >
                <option value="all">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
                <option value="Draft">{isRtl ? 'مسودة' : 'Draft'}</option>
                <option value="Pending">{isRtl ? 'قيد المراجعة' : 'Pending'}</option>
                <option value="Posted">{isRtl ? 'مرحل / معتمد' : 'Posted'}</option>
                <option value="Rejected">{isRtl ? 'مرفوض' : 'Rejected'}</option>
                <option value="Cancelled">{isRtl ? 'ملغي' : 'Cancelled'}</option>
              </select>
            </div>
          </div>

          {/* Documents Table */}
          <div className={`rounded-3xl border overflow-hidden ${
            theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className={`text-[11px] font-bold border-b ${
                    theme === 'dark' ? 'bg-slate-800/30 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}>
                    <th className="p-4">{isRtl ? 'رقم المستند' : 'Doc No.'}</th>
                    <th className="p-4">{isRtl ? 'التاريخ' : 'Date'}</th>
                    <th className="p-4">{isRtl ? 'نوع المستند' : 'Type'}</th>
                    <th className="p-4">{isRtl ? 'المخزن الرئيسي' : 'Warehouse'}</th>
                    <th className="p-4">{isRtl ? 'عدد الأصناف' : 'Items'}</th>
                    <th className="p-4">{isRtl ? 'المستلم / الجهة' : 'Recipient / Entity'}</th>
                    <th className="p-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className="p-4 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold italic">
                        {isRtl ? 'لا توجد مستندات مخزنية تطابق الفلاتر المحددة' : 'No inventory documents match the active filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                        <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono">{doc.doc_no}</td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 font-mono">{doc.date}</td>
                        <td className="p-4 font-semibold">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-xs font-bold">
                            {getDocTypeLabel(doc.doc_type, doc.scrap_action)}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400">
                          {warehouses.find(w => w.id === doc.source_warehouse_id)?.name || doc.source_warehouse_id}
                        </td>
                        <td className="p-4 font-bold font-mono">{doc.items.length}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[150px] truncate">
                          {doc.recipient || doc.dest_entity_id || '---'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            doc.status === 'Posted' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            doc.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            doc.status === 'Draft' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                            'bg-slate-500/10 text-slate-400 border border-slate-500/15'
                          }`}>
                            {doc.status === 'Posted' ? (isRtl ? 'مرحل ومكتمل' : 'Posted') :
                             doc.status === 'Pending' ? (isRtl ? 'مراجعة معلقة' : 'Pending Approval') :
                             doc.status === 'Draft' ? (isRtl ? 'مسودة' : 'Draft') : doc.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedDocId(doc.id)}
                            className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                          >
                            <Eye size={12} />
                            <span className="text-[10px] font-black">{isRtl ? 'عرض ومسار الاعتماد' : 'Review Path'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: REPORTS ANALYTICS PANEL */}
      {!isFormOpen && !selectedDocId && activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left panel: Report selection menu */}
          <div className={`lg:col-span-1 p-4 rounded-3xl border h-fit space-y-2 ${
            theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
          }`}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 px-2">
              {isRtl ? 'قائمة التقارير والتحليلات' : 'Reports Directory'}
            </h3>
            
            <button
              onClick={() => setActiveReport('balances')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-right transition-all ${
                activeReport === 'balances'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>{isRtl ? 'أرصدة المخازن والحد الأدنى' : 'Warehouse Stock Balances'}</span>
              <PackageCheck size={14} />
            </button>

            <button
              onClick={() => setActiveReport('card')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-right transition-all ${
                activeReport === 'card'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>{isRtl ? 'حركة صنف (كارت الصنف)' : 'Stock Card Ledger'}</span>
              <FileSpreadsheet size={14} />
            </button>

            <button
              onClick={() => setActiveReport('valuation')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-right transition-all ${
                activeReport === 'valuation'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>{isRtl ? 'تقييم المخزون المالي' : 'Inventory Valuation (Cost)'}</span>
              <PieChart size={14} />
            </button>

            <button
              onClick={() => setActiveReport('slow_moving')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-right transition-all ${
                activeReport === 'slow_moving'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>{isRtl ? 'الأصناف الراكدة' : 'Slow Moving Items'}</span>
              <AlertTriangle size={14} />
            </button>

            <button
              onClick={() => setActiveReport('stocktake')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-right transition-all ${
                activeReport === 'stocktake'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>{isRtl ? 'تقرير وجدول جرد المخزون' : 'Stocktake Checklist'}</span>
              <Printer size={14} />
            </button>
          </div>

          {/* Right panel: Active Report Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Filter bar for Reports */}
            <div className={`p-4 rounded-3xl border grid grid-cols-1 md:grid-cols-3 gap-4 items-center ${
              theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
            }`}>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'المستودع المستهدف' : 'Warehouse Target'}</label>
                <select
                  value={repWarehouse}
                  onChange={(e) => setRepWarehouse(e.target.value)}
                  className={`w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                    theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                  }`}
                >
                  <option value="all">{isRtl ? 'كل المستودعات' : 'All Warehouses'}</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {activeReport === 'card' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'اختر الصنف' : 'Select Product'}</label>
                  <select
                    value={repProduct}
                    onChange={(e) => setRepProduct(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                      theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                    }`}
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} [{p.code}]</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex md:col-start-3 items-end justify-end pt-4">
                <button
                  onClick={() => setRefreshKey(prev => prev + 1)}
                  className="px-3.5 py-1.5 rounded-xl border border-dashed hover:bg-slate-800 text-slate-400 hover:text-white text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>{isRtl ? 'تحديث البيانات' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* REPORT 1: STOCK BALANCES */}
            {activeReport === 'balances' && (
              <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'}`}>
                <h3 className="text-sm font-black mb-4 text-emerald-600 dark:text-emerald-400">{isRtl ? 'مستند أرصدة المخازن والإنذار بالحد الأدنى' : 'Warehouse Balances & Min Alerts'}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="p-3">{isRtl ? 'الصنف' : 'Item Description'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الوحدة' : 'Unit'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الحد الأدنى للأمان' : 'Safety Min'}</th>
                        {warehouses.map(w => (
                          <th key={w.id} className="p-3 text-center">{w.name.split(' ')[0]}</th>
                        ))}
                        <th className="p-3 text-center">{isRtl ? 'إجمالي الرصيد الحالي' : 'Total Stock'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الحالة الرقابية' : 'Compliance Alert'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                      {reportBalances.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="p-3 font-semibold">
                            {p.name} <span className="text-[10px] font-mono text-slate-400">[{p.code}]</span>
                          </td>
                          <td className="p-3 text-center text-slate-500">{p.unit}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-500">{p.min_stock}</td>
                          {p.balances.map(b => (
                            <td key={b.warehouseId} className="p-3 text-center font-mono font-bold">{b.stock}</td>
                          ))}
                          <td className="p-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400">{p.totalStock}</td>
                          <td className="p-3 text-center">
                            {p.isUnderMin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold text-[10px]">
                                <AlertTriangle size={10} />
                                <span>{isRtl ? 'أقل من الحد الأدنى!' : 'Below Min!'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold text-[10px]">
                                <CheckCircle2 size={10} />
                                <span>{isRtl ? 'آمن ومستقر' : 'Secure'}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REPORT 2: STOCK CARD */}
            {activeReport === 'card' && (
              <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'}`}>
                <h3 className="text-sm font-black mb-4 text-emerald-600 dark:text-emerald-400">{isRtl ? 'كارت الصنف والتحليل المستمر للحركات' : 'Stock Card Ledger Ledger'}</h3>
                {!repProduct ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">{isRtl ? 'يرجى اختيار صنف لعرض كارت التحليل الخاص به' : 'Please select product'}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold">
                          <th className="p-3">{isRtl ? 'رقم المستند' : 'Document No.'}</th>
                          <th className="p-3">{isRtl ? 'التاريخ' : 'Date'}</th>
                          <th className="p-3">{isRtl ? 'النوع' : 'Doc Type'}</th>
                          <th className="p-3 text-center">{isRtl ? 'الكمية الواردة / المنصرفة' : 'Quantity Change'}</th>
                          <th className="p-3 text-center">{isRtl ? 'الرصيد بعد الحركة' : 'Balance After'}</th>
                          <th className="p-3">{isRtl ? 'بواسطة' : 'User'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                        {reportStockCard.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400 italic">{isRtl ? 'لا توجد حركات مخزنية مسجلة لهذا الصنف' : 'No movements recorded for this item'}</td>
                          </tr>
                        ) : (
                          reportStockCard.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{m.doc_no}</td>
                              <td className="p-3 text-slate-500 font-mono">{m.date}</td>
                              <td className="p-3 font-semibold">{m.doc_type}</td>
                              <td className={`p-3 text-center font-mono font-bold ${m.qty_change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                              </td>
                              <td className="p-3 text-center font-mono font-black text-slate-800 dark:text-slate-100">{m.runningBalance}</td>
                              <td className="p-3 text-slate-400">{m.created_by}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* REPORT 3: INVENTORY VALUATION */}
            {activeReport === 'valuation' && (
              <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-400">{isRtl ? 'تقييم المخزون الإجمالي وقيمة رأس المال السائل' : 'Inventory Valuation (Liquidity / Asset Cost)'}</h3>
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl px-4 py-2 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{isRtl ? 'إجمالي القيمة المالية للمخزون' : 'Total Asset Cost'}</p>
                    <p className="text-base font-mono font-black">{reportValuation.totalCostVal.toLocaleString()} EGP</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="p-3">{isRtl ? 'الصنف الكود والاسم' : 'Item Description'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الرصيد الكلي الحالي' : 'Total Available Stock'}</th>
                        <th className="p-3 text-center">{isRtl ? 'آخر سعر شراء معتمد' : 'Last Purchase Price'}</th>
                        <th className="p-3 text-center">{isRtl ? 'القيمة الإجمالية للمخزون (ج.م)' : 'Asset Value (EGP)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                      {reportValuation.items.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="p-3 font-semibold">
                            {p.name} <span className="text-[10px] font-mono text-slate-400">[{p.code}]</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold">{p.totalStock}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-500">{p.last_purchase_price || 0}</td>
                          <td className="p-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {p.valuation.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REPORT 4: SLOW MOVING STOCK */}
            {activeReport === 'slow_moving' && (
              <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'}`}>
                <h3 className="text-sm font-black mb-4 text-emerald-600 dark:text-emerald-400">{isRtl ? 'قائمة الأصناف الراكدة (التي لم يسجل لها حركات)' : 'Slow Moving Items Checklist (No Stock Activity)'}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="p-3">{isRtl ? 'الصنف الكود والاسم' : 'Item Description'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الوحدة' : 'Unit'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الحد الأدنى' : 'Min Safety limit'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الرصيد الإجمالي الحالي' : 'Total Current Stock'}</th>
                        <th className="p-3 text-center">{isRtl ? 'معدل الحركة' : 'Activity Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                      {reportSlowMoving.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">{isRtl ? 'لا توجد أصناف راكدة، جميع الأصناف نشطة ولها حركات' : 'No slow-moving items found'}</td>
                        </tr>
                      ) : (
                        reportSlowMoving.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="p-3 font-semibold">
                              {p.name} <span className="text-[10px] font-mono text-slate-400">[{p.code}]</span>
                            </td>
                            <td className="p-3 text-center text-slate-500">{p.unit}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-500">{p.min_stock}</td>
                            <td className="p-3 text-center font-mono font-bold">
                              {warehouses.reduce((sum, w) => sum + InventoryModule.getProductStock(p.id, w.id), 0)}
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[10px]">
                                {isRtl ? 'راكد (خامل)' : 'STAGNANT'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REPORT 5: STOCKTAKE CHECKLIST */}
            {activeReport === 'stocktake' && (
              <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-400">{isRtl ? 'تقرير وكشف جرد الأرصدة المخزنية الفعلي' : 'Inventory Stocktake & Reconciliation Checklist'}</h3>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer size={12} />
                    <span>{isRtl ? 'طباعة كشف الجرد الميداني' : 'Print Stocktake Sheet'}</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="p-3">{isRtl ? 'الصنف' : 'Item Description'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الوحدة' : 'Unit'}</th>
                        <th className="p-3 text-center">{isRtl ? 'الرصيد الدفتري الحالي' : 'System Stock'}</th>
                        <th className="p-3 text-center w-28">{isRtl ? 'الجرد الفعلي (يدوي)' : 'Physical Stock'}</th>
                        <th className="p-3 text-center w-28">{isRtl ? 'الفارق (العجز / الزيادة)' : 'Variance'}</th>
                        <th className="p-3">{isRtl ? 'توقيع المسؤول' : 'Signee'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                      {products.map(p => {
                        const totalStock = warehouses.reduce((sum, w) => sum + InventoryModule.getProductStock(p.id, w.id), 0);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="p-3 font-semibold">
                              {p.name} <span className="text-[10px] font-mono text-slate-400">[{p.code}]</span>
                            </td>
                            <td className="p-3 text-center text-slate-500">{p.unit}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{totalStock}</td>
                            <td className="p-3 text-center">
                              <div className="h-6 w-20 border border-dashed border-slate-400 dark:border-slate-700 rounded mx-auto"></div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="h-6 w-20 border border-dashed border-slate-400 dark:border-slate-700 rounded mx-auto"></div>
                            </td>
                            <td className="p-3 text-slate-400 italic">..........................</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
