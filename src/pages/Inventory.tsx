import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  X,
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
  PackageCheck,
  Settings,
  Check,
  Workflow
} from 'lucide-react';
import { 
  InventoryDocument, 
  InventoryDocType, 
  InventoryDocStatus, 
  Warehouse, 
  Product, 
  StockMovement,
  InventoryLedgerEntry,
  InventoryWorkflowConfig
} from '../types/inventory';
import { InventoryModule } from '../db/inventory';
import { CustodyDB } from '../db';
import InventoryDocumentForm from '../components/InventoryDocumentForm';
import WarehouseTreeSelect from '../components/WarehouseTreeSelect';
import WarehouseHierarchyManager from '../components/WarehouseHierarchyManager';
import InventoryDocumentsTab from '../components/inventory/InventoryDocumentsTab';

interface InventoryProps {
  language: 'en' | 'ar';
  theme: 'light' | 'dark';
}

type SubTab = 'documents' | 'reports' | 'warehouses' | 'settings';
type ReportType = 'card' | 'balances' | 'valuation' | 'slow_moving' | 'stocktake' | 'movements' | 'ledger';

export default function Inventory({ language, theme }: InventoryProps) {
  const isRtl = language === 'ar';
  const activeUser = CustodyDB.getActiveUser();

  const getDocTypeLabel = (type: string, scrapAction?: 'IN' | 'OUT') => {
    switch (type) {
      case 'Receipt':
        return isRtl ? 'إذن استلام' : 'Receipt';
      case 'Addition':
        return isRtl ? 'إذن إضافة' : 'Addition';
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
  const [printInventoryDoc, setPrintInventoryDoc] = useState<InventoryDocument | null>(null);

  // Workflow Configuration State
  const [invConfig, setInvConfig] = useState<InventoryWorkflowConfig>(() => InventoryModule.getInventoryConfig());
  const [configSavedToast, setConfigSavedToast] = useState(false);

  // Multi-Echelon Stock Transfer Receipt UI State
  const [activeDocSubTab, setActiveDocSubTab] = useState<'all' | 'transit'>('all');
  const [receivingDocId, setReceivingDocId] = useState<string | null>(null);
  const [receivedItemsInput, setReceivedItemsInput] = useState<{ [prodId: string]: { qty_received: number; variance_reason: string } }>({});
  const [receivedNotesInput, setReceivedNotesInput] = useState<string>('');

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

  // Warehouse & Bin management states
  const [selectedWhForBins, setSelectedWhForBins] = useState<string | null>(null);
  const [binEditingId, setBinEditingId] = useState<string | null>(null);
  const [binFormName, setBinFormName] = useState('');
  const [binFormCode, setBinFormCode] = useState('');
  const [binFormZone, setBinFormZone] = useState('');
  const [binFormCapacity, setBinFormCapacity] = useState('');
  const [binShowForm, setBinShowForm] = useState(false);

  // Warehouse capacity inputs (key is warehouse_id)
  const [whEnforceCap, setWhEnforceCap] = useState<{ [whId: string]: boolean }>({});
  const [whCapQty, setWhCapQty] = useState<{ [whId: string]: number }>({});
  
  // Relocation panel states
  const [relocShow, setRelocShow] = useState(false);
  const [relocWhId, setRelocWhId] = useState('');
  const [relocProdId, setRelocProdId] = useState('');
  const [relocFromBinId, setRelocFromBinId] = useState('');
  const [relocToBinId, setRelocToBinId] = useState('');
  const [relocQty, setRelocQty] = useState(1);
  const [relocError, setRelocError] = useState('');
  const [relocSuccess, setRelocSuccess] = useState('');

  // Load lists from DB
  const warehouses = useMemo(() => InventoryModule.getWarehouses(), [refreshKey]);
  const products = useMemo(() => InventoryModule.getProducts(), [refreshKey]);
  const documents = useMemo(() => InventoryModule.getInventoryDocuments(), [refreshKey]);
  const stockMovements = useMemo(() => InventoryModule.getStockMovements(), [refreshKey]);
  const ledgerEntries = useMemo(() => InventoryModule.getInventoryLedger(), [refreshKey]);

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

  const transitDocsCount = useMemo(() => {
    return documents.filter(d => d.status === 'Dispatched').length;
  }, [documents]);

  const transitDocs = useMemo(() => {
    return documents.filter(d => d.status === 'Dispatched');
  }, [documents]);

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
      const res = InventoryModule.deleteInventoryDocument(docId);
      if (!res.success) {
        alert(res.errors?.join('\n') || 'Failed to delete document');
        return;
      }
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

  // Report: Item Ledger (التحليل المفصل لحركات الصنف والوارد والمنصرف بالقيم المالية وتتبع الامتثال والاعتماد)
  const reportItemLedger = useMemo(() => {
    if (!repProduct) return [];
    const filtered = ledgerEntries.filter(entry => 
      entry.product_id === repProduct &&
      (repWarehouse === 'all' || entry.warehouse_id === repWarehouse)
    );
    // Sort chronological first to build running balances/costs properly, then reverse to show latest first
    const sorted = [...filtered].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return sorted.reverse(); // Latest first
  }, [ledgerEntries, repProduct, repWarehouse]);

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

      {/* Sub tabs (Documents vs Reports vs Warehouses) */}
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
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`pb-3 text-xs md:text-sm font-black transition-all ${
              activeTab === 'warehouses'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isRtl ? 'تهيئة المستودعات والحاويات' : 'Warehouse & Bin Settings'}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-xs md:text-sm font-black transition-all flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings size={15} />
            <span>{isRtl ? 'قواعد ودورة عمل المخازن' : 'Workflow & Business Rules'}</span>
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
          <div className="flex justify-between items-center gap-4">
            <button
              onClick={() => setSelectedDocId(null)}
              className={`inline-flex items-center gap-1 text-xs font-bold ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              <span>{isRtl ? 'العودة لجدول المستندات' : 'Back to Documents'}</span>
            </button>

            <button
              onClick={() => setPrintInventoryDoc(activeDoc)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black flex items-center gap-2 rounded-xl transition-all cursor-pointer border border-slate-700 shadow-sm"
            >
              <Printer size={15} />
              <span>{isRtl ? 'طباعة مستند الحركة المخزنية (A4)' : 'Print Stock Voucher (A4)'}</span>
            </button>
          </div>

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
                      {isRtl ? 'اعتماد المستند وتحديث المخزون' : 'Approve & Release Stock'}
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

                {activeDoc.status === 'Dispatched' && (
                  <>
                    <button
                      onClick={() => {
                        const initialInput: typeof receivedItemsInput = {};
                        activeDoc.items.forEach(item => {
                          initialInput[item.product_id] = { qty_received: item.qty, variance_reason: '' };
                        });
                        setReceivedItemsInput(initialInput);
                        setReceivedNotesInput('');
                        setReceivingDocId(activeDoc.id);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <PackageCheck size={14} />
                      <span>{isRtl ? 'تأكيد الاستلام والاعتماد' : 'Confirm Receipt & Authorize'}</span>
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
                    <span>{isRtl ? 'تم الاعتماد النهائي وتحديث المخزن تلقائياً' : 'Approved & Inventory Updated'}</span>
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
                    {(activeDoc.doc_type === 'Receipt' || activeDoc.doc_type === 'Addition') && <th className="p-3 text-center">{isRtl ? 'سعر الشراء (ج.م)' : 'Purchase Price'}</th>}
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
                      {(activeDoc.doc_type === 'Receipt' || activeDoc.doc_type === 'Addition') && <td className="p-3 text-center font-mono">{item.last_purchase_price || 0}</td>}
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

            {/* Multi-Echelon Receipt Verification */}
            {activeDoc.received_by && (
              <div className="mb-8 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                <h4 className="font-bold mb-3 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={15} />
                  <span>{isRtl ? 'بيانات تتبع واستلام الشحنة بالكامل (Multi-Echelon Receipt Verification)' : 'Multi-Echelon Receipt Audit Verification'}</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-slate-400 font-bold mb-0.5">{isRtl ? 'تاريخ وتوقيت الاستلام' : 'Date Received'}</p>
                    <p className="font-mono font-bold text-slate-700 dark:text-slate-200">
                      {new Date(activeDoc.received_date!).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-bold mb-0.5">{isRtl ? 'المستلم المصادق' : 'Received By'}</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{activeDoc.received_by}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-bold mb-0.5">{isRtl ? 'ملاحظات الاستلام والترخيص' : 'Receipt Notes'}</p>
                    <p className="font-medium text-slate-600 dark:text-slate-300">{activeDoc.received_notes || (isRtl ? 'لا توجد ملاحظات' : 'No notes')}</p>
                  </div>
                </div>

                {/* Variance analysis inside details */}
                <div className="border border-emerald-500/20 rounded-xl overflow-hidden mt-2">
                  <table className="w-full text-right border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                        <th className="p-2">{isRtl ? 'الصنف' : 'Item'}</th>
                        <th className="p-2 text-center">{isRtl ? 'الكمية المشحونة' : 'Shipped Qty'}</th>
                        <th className="p-2 text-center">{isRtl ? 'الكمية المستلمة' : 'Received Qty'}</th>
                        <th className="p-2 text-center">{isRtl ? 'العجز / الفارق' : 'Variance'}</th>
                        <th className="p-2">{isRtl ? 'سبب الفارق' : 'Variance Reason'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-500/10">
                      {activeDoc.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-emerald-500/5">
                          <td className="p-2 font-semibold">{item.product_name}</td>
                          <td className="p-2 text-center font-mono">{item.qty}</td>
                          <td className="p-2 text-center font-mono font-bold">{item.qty_received ?? item.qty}</td>
                          <td className={`p-2 text-center font-mono font-bold ${
                            (item.qty_variance ?? 0) > 0 ? 'text-amber-500' : 'text-emerald-500'
                          }`}>
                            {item.qty_variance ?? 0}
                          </td>
                          <td className="p-2 text-slate-500 italic">{item.variance_reason || '---'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
        <InventoryDocumentsTab
          isRtl={isRtl}
          activeDocSubTab={activeDocSubTab}
          setActiveDocSubTab={setActiveDocSubTab}
          transitDocsCount={transitDocsCount}
          theme={theme}
          filterSearch={filterSearch}
          setFilterSearch={setFilterSearch}
          filterType={filterType}
          setFilterType={setFilterType}
          filterWarehouse={filterWarehouse}
          setFilterWarehouse={setFilterWarehouse}
          warehouses={warehouses}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filteredDocs={filteredDocs}
          getDocTypeLabel={getDocTypeLabel}
          setSelectedDocId={setSelectedDocId}
          transitDocs={transitDocs}
          receivedItemsInput={receivedItemsInput}
          setReceivedItemsInput={setReceivedItemsInput}
          setReceivedNotesInput={setReceivedNotesInput}
          setReceivingDocId={setReceivingDocId}
          receivingDocId={receivingDocId}
          documents={documents}
          receivedNotesInput={receivedNotesInput}
          setRefreshKey={setRefreshKey}
        />
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
              onClick={() => setActiveReport('ledger')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-right transition-all ${
                activeReport === 'ledger'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>{isRtl ? 'الأستاذ التحليلي للمخزون' : 'Enterprise Item Ledger'}</span>
              <FileText size={14} />
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

              {(activeReport === 'card' || activeReport === 'ledger') && (
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

            {/* REPORT: ENTERPRISE ITEM LEDGER */}
            {activeReport === 'ledger' && (
              <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'}`}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {isRtl ? 'دفتر الأستاذ التحليلي للمخزون والرقابة المالية' : 'Enterprise Continuous Item Ledger'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isRtl ? 'مسار التدقيق المالي الكامل، أرصدة اللحظية وتتبع التكلفة التاريخية للامتثال' : 'Real-time financial stock tracking, instant balance reconciliation & historic audit trail'}
                    </p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-end sm:self-auto"
                  >
                    <Printer size={12} />
                    <span>{isRtl ? 'طباعة كشف الأستاذ' : 'Print Ledger Sheet'}</span>
                  </button>
                </div>
                {!repProduct ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">{isRtl ? 'يرجى اختيار صنف لعرض كارت الأستاذ الخاص به' : 'Please select product'}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-800/10 dark:bg-slate-800/30">
                          <th className="p-3">{isRtl ? 'المستند المرجعي' : 'Ref Document'}</th>
                          <th className="p-3">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</th>
                          <th className="p-3 text-center">{isRtl ? 'نوع الحركة' : 'Tx Type'}</th>
                          <th className="p-3 text-center">{isRtl ? 'الوارد (+)' : 'Qty In (+)'}</th>
                          <th className="p-3 text-center">{isRtl ? 'المنصرف (-)' : 'Qty Out (-)'}</th>
                          <th className="p-3 text-center text-slate-400">{isRtl ? 'الرصيد السابق' : 'Bal Before'}</th>
                          <th className="p-3 text-center text-emerald-500">{isRtl ? 'الرصيد بعد الحركة' : 'Bal After'}</th>
                          <th className="p-3 text-center">{isRtl ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                          <th className="p-3 text-center">{isRtl ? 'القيمة الجارية' : 'Running Value'}</th>
                          <th className="p-3">{isRtl ? 'المستخدم' : 'Operator'}</th>
                          <th className="p-3">{isRtl ? 'رمز التدقيق' : 'Audit Trace'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                        {reportItemLedger.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="p-6 text-center text-slate-400 italic">{isRtl ? 'لا توجد حركات مسجلة في الأستاذ لهذا الصنف' : 'No ledger records found for this item'}</td>
                          </tr>
                        ) : (
                          reportItemLedger.map(entry => (
                            <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                              <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{entry.reference_document_no}</td>
                              <td className="p-3 text-slate-500 font-mono">
                                {new Date(entry.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                              </td>
                              <td className="p-3 text-center">
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {getDocTypeLabel(entry.transaction_type)}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-emerald-500">
                                {entry.qty_in > 0 ? `+${entry.qty_in}` : '-'}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-rose-500">
                                {entry.qty_out > 0 ? `-${entry.qty_out}` : '-'}
                              </td>
                              <td className="p-3 text-center font-mono text-slate-400">{entry.balance_before}</td>
                              <td className="p-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400">{entry.balance_after}</td>
                              <td className="p-3 text-center font-mono text-slate-500">{entry.unit_cost.toLocaleString()} {isRtl ? 'ج.م' : 'EGP'}</td>
                              <td className="p-3 text-center font-mono font-black text-slate-700 dark:text-slate-200">{entry.running_cost.toLocaleString()} {isRtl ? 'ج.م' : 'EGP'}</td>
                              <td className="p-3 text-slate-500 font-medium">{entry.user_name || 'System'}</td>
                              <td className="p-3 text-slate-400 font-mono text-[10px]">{entry.audit_ref}</td>
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

      {/* SUB-TAB: WAREHOUSE & BIN SETTINGS */}
      {!isFormOpen && !selectedDocId && activeTab === 'warehouses' && (
        <div className="space-y-6">
          {/* Warehouse Hierarchy Tree & Template Manager */}
          <WarehouseHierarchyManager
            companyId={activeUser?.company_id || CustodyDB.getSelectedCompanyId() || ''}
            isRtl={isRtl}
            theme={theme}
            onWarehousesUpdated={() => setRefreshKey(prev => prev + 1)}
          />

          {/* Header & Internal Relocation Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-3xl border bg-slate-500/5 dark:bg-slate-800/10">
            <div>
              <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {isRtl ? 'بنية السعة والتنظيم الداخلي (الحاويات والرفوف)' : 'Storage Capacities & Internal Bins'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isRtl 
                  ? 'قم بتعيين حدود السعة القصوى لكل مستودع، وإنشاء وإدارة الحاويات والرفوف الداخلية (Bins)' 
                  : 'Configure storage capacities per warehouse and organize internal bins or racks.'}
              </p>
            </div>
            
            <button
              onClick={() => {
                setRelocShow(!relocShow);
                setRelocSuccess('');
                setRelocError('');
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow shadow-emerald-600/10 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} className={relocShow ? 'rotate-180 transition-transform duration-300' : ''} />
              <span>{isRtl ? 'مناقلة داخلية بين الحاويات' : 'Internal Bin Relocation'}</span>
            </button>
          </div>

          {/* INTERNAL BIN RELOCATION FORM */}
          {relocShow && (
            <div className={`p-6 rounded-3xl border space-y-4 shadow-lg ${
              theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-slate-50 border-slate-200'
            }`}>
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw size={13} />
                <span>{isRtl ? 'طلب مناقلة داخلية للمخزون' : 'Internal Bin-to-Bin Stock Transfer'}</span>
              </h4>

              {relocError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl font-bold">
                  {relocError}
                </div>
              )}
              {relocSuccess && (
                <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl font-bold">
                  {relocSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1">{isRtl ? 'المخزن الرئيسي' : 'Warehouse'}</label>
                  <WarehouseTreeSelect
                    value={relocWhId}
                    onChange={(whId) => {
                      setRelocWhId(whId);
                      setRelocFromBinId('');
                      setRelocToBinId('');
                    }}
                    companyId={activeUser?.company_id || CustodyDB.getSelectedCompanyId() || ''}
                    isRtl={isRtl}
                    theme={theme}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1">{isRtl ? 'الصنف المستهدف' : 'Product'}</label>
                  <select
                    value={relocProdId}
                    disabled={!relocWhId}
                    onChange={(e) => setRelocProdId(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                      theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                    }`}
                  >
                    <option value="">{isRtl ? '-- اختر الصنف --' : '-- Select Product --'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} [{p.code}]</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1">{isRtl ? 'الحاوية المصدر' : 'From Bin'}</label>
                  <select
                    value={relocFromBinId}
                    disabled={!relocWhId}
                    onChange={(e) => setRelocFromBinId(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                      theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                    }`}
                  >
                    <option value="">{isRtl ? '-- اختر الحاوية --' : '-- Select Bin --'}</option>
                    {InventoryModule.getWarehouseBins(relocWhId).map(b => {
                      const avail = relocProdId ? InventoryModule.getBinProductStock(relocProdId, b.id) : 0;
                      return (
                        <option key={b.id} value={b.id}>{b.name} ({b.code}) - {isRtl ? `رصيد: ${avail}` : `Stock: ${avail}`}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1">{isRtl ? 'الحاوية المستهدفة' : 'To Bin'}</label>
                  <select
                    value={relocToBinId}
                    disabled={!relocWhId}
                    onChange={(e) => setRelocToBinId(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                      theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                    }`}
                  >
                    <option value="">{isRtl ? '-- اختر الحاوية --' : '-- Select Bin --'}</option>
                    {InventoryModule.getWarehouseBins(relocWhId)
                      .filter(b => b.id !== relocFromBinId)
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1">{isRtl ? 'الكمية المنقولة' : 'Transfer Qty'}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={relocQty}
                      onChange={(e) => setRelocQty(parseInt(e.target.value) || 1)}
                      className={`w-full px-3 py-1 text-xs rounded-xl border focus:outline-none font-mono ${
                        theme === 'dark' ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'
                      }`}
                    />
                    <button
                      onClick={async () => {
                        setRelocError('');
                        setRelocSuccess('');
                        if (!relocWhId || !relocProdId || !relocFromBinId || !relocToBinId || relocQty <= 0) {
                          setRelocError(isRtl ? 'يرجى ملء جميع الحقول أولاً' : 'Please fill all inputs first');
                          return;
                        }
                        const res = InventoryModule.relocateBinStock(
                          activeUser?.company_id || CustodyDB.getSelectedCompanyId() || '',
                          relocWhId,
                          relocProdId,
                          relocFromBinId,
                          relocToBinId,
                          relocQty
                        );
                        if (res.success) {
                          setRelocSuccess(isRtl ? res.messageAr : res.messageEn);
                          setRefreshKey(prev => prev + 1);
                        } else {
                          setRelocError(isRtl ? res.messageAr : res.messageEn);
                        }
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer active:scale-95 shrink-0"
                    >
                      {isRtl ? 'نقل الآن' : 'Execute'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WAREHOUSE CARDS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {warehouses.map(wh => {
              const totalStock = InventoryModule.getWarehouseTotalStock(wh.id);
              const isEnforced = whEnforceCap[wh.id] !== undefined ? whEnforceCap[wh.id] : !!wh.is_capacity_enforced;
              const capQty = whCapQty[wh.id] !== undefined ? whCapQty[wh.id] : wh.max_capacity_qty || 0;
              const utilization = capQty > 0 ? (totalStock / capQty) * 100 : 0;
              const binsList = InventoryModule.getWarehouseBins(wh.id);

              return (
                <div key={wh.id} className={`p-6 rounded-3xl border flex flex-col justify-between gap-6 transition-all shadow-md ${
                  theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
                }`}>
                  {/* Title & Location */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase bg-slate-500/10 px-2.5 py-0.5 rounded border border-slate-500/10">
                        {wh.code}
                      </span>
                      <Building2 size={16} className="text-emerald-500" />
                    </div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-2">{wh.name}</h4>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <MapPin size={10} />
                      <span>{wh.location || (isRtl ? 'غير محدد' : 'Not Specified')}</span>
                    </p>
                  </div>

                  {/* Capacity Settings Panel */}
                  <div className="p-4 rounded-2xl bg-slate-500/5 dark:bg-slate-800/20 border border-slate-200/40 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{isRtl ? 'تفعيل رقابة السعة' : 'Enforce Capacity Limit'}</span>
                      <input
                        type="checkbox"
                        checked={isEnforced}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setWhEnforceCap(prev => ({ ...prev, [wh.id]: val }));
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{isRtl ? 'السعة القصوى (وحدة)' : 'Max capacity (units)'}</span>
                      <input
                        type="number"
                        min="0"
                        value={capQty || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setWhCapQty(prev => ({ ...prev, [wh.id]: val }));
                        }}
                        className={`w-24 px-2 py-1 text-xs rounded-lg border text-center font-mono focus:outline-none ${
                          theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                        <span>{isRtl ? `الاستهلاك: %${utilization.toFixed(1)}` : `Utilized: ${utilization.toFixed(1)}%`}</span>
                        <span>{totalStock} / {capQty || '∞'}</span>
                      </div>
                      <div className="w-full bg-slate-300 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            utilization > 90 ? 'bg-rose-500' : utilization > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, utilization)}%` }}
                        />
                      </div>
                    </div>

                    {/* Save Button for capacity */}
                    <button
                      onClick={() => {
                        const allWh = InventoryModule.getWarehouses();
                        const targetIdx = allWh.findIndex(w => w.id === wh.id);
                        if (targetIdx !== -1) {
                          allWh[targetIdx] = {
                            ...allWh[targetIdx],
                            is_capacity_enforced: isEnforced,
                            max_capacity_qty: capQty || undefined
                          };
                          InventoryModule.saveWarehouses(allWh);
                          setRefreshKey(prev => prev + 1);
                          alert(isRtl ? 'تم حفظ إعدادات السعة بنجاح' : 'Capacity settings saved successfully');
                        }
                      }}
                      className="w-full py-1 bg-emerald-600/10 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-lg transition-all border border-emerald-500/20"
                    >
                      {isRtl ? 'تطبيق وحفظ التغييرات' : 'Save Capacity Configuration'}
                    </button>
                  </div>

                  {/* Bins Management Trigger */}
                  <button
                    onClick={() => {
                      if (selectedWhForBins === wh.id) {
                        setSelectedWhForBins(null);
                      } else {
                        setSelectedWhForBins(wh.id);
                        setBinShowForm(false);
                        setBinEditingId(null);
                      }
                    }}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      selectedWhForBins === wh.id 
                        ? 'bg-emerald-600 text-white border-emerald-500' 
                        : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-800/10'
                    }`}
                  >
                    <Layers size={13} />
                    <span>{isRtl ? `إدارة الحاويات والرفوف (${binsList.length})` : `Manage Bins (${binsList.length})`}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* ACTIVE BINS CRUD PANEL */}
          {selectedWhForBins && (
            <div className={`p-6 rounded-3xl border space-y-6 shadow-xl ${
              theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
            }`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800 pb-4">
                <div>
                  <h4 className="text-xs md:text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {isRtl ? 'الحاويات والرفوف المرتبطة بالمستودع المختار' : 'Warehouse Bins & Storage Units'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isRtl ? 'إعداد البنية التحتية الداخلية لتسهيل فرز السلع وتحميلها' : 'Configure storage cells, zones, and individual max capacities.'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setBinFormName('');
                    setBinFormCode('');
                    setBinFormZone('');
                    setBinFormCapacity('');
                    setBinEditingId(null);
                    setBinShowForm(!binShowForm);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={12} />
                  <span>{isRtl ? 'إضافة حاوية/رف جديد' : 'Add New Bin'}</span>
                </button>
              </div>

              {/* BIN ADD/EDIT FORM */}
              {binShowForm && (
                <div className={`p-4 rounded-2xl border grid grid-cols-1 md:grid-cols-5 gap-4 items-end ${
                  theme === 'dark' ? 'bg-[#1e293b]/50 border-slate-800' : 'bg-slate-50 border-slate-200/50'
                }`}>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'اسم الحاوية' : 'Bin Name'}</label>
                    <input
                      type="text"
                      value={binFormName}
                      onChange={(e) => setBinFormName(e.target.value)}
                      placeholder="e.g. Bin A1"
                      className={`w-full px-3 py-1 text-xs rounded-lg border focus:outline-none ${
                        theme === 'dark' ? 'text-slate-100 bg-slate-900 border-slate-700' : 'text-slate-800 bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'كود الحاوية الفريد' : 'Bin Code'}</label>
                    <input
                      type="text"
                      value={binFormCode}
                      onChange={(e) => setBinFormCode(e.target.value)}
                      placeholder="e.g. BIN-A1"
                      className={`w-full px-3 py-1 text-xs rounded-lg border focus:outline-none ${
                        theme === 'dark' ? 'text-slate-100 bg-slate-900 border-slate-700' : 'text-slate-800 bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'المنطقة (Zone)' : 'Zone'}</label>
                    <input
                      type="text"
                      value={binFormZone}
                      onChange={(e) => setBinFormZone(e.target.value)}
                      placeholder="e.g. Zone A"
                      className={`w-full px-3 py-1 text-xs rounded-lg border focus:outline-none ${
                        theme === 'dark' ? 'text-slate-100 bg-slate-900 border-slate-700' : 'text-slate-800 bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'السعة القصوى (وحدة)' : 'Max Capacity'}</label>
                    <input
                      type="number"
                      min="1"
                      value={binFormCapacity}
                      onChange={(e) => setBinFormCapacity(e.target.value)}
                      placeholder="e.g. 500"
                      className={`w-full px-3 py-1 text-xs rounded-lg border focus:outline-none font-mono ${
                        theme === 'dark' ? 'text-slate-100 bg-slate-900 border-slate-700' : 'text-slate-800 bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setBinShowForm(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!binFormName || !binFormCode) {
                          alert(isRtl ? 'يرجى إدخال اسم وكود الحاوية' : 'Please input bin name and code');
                          return;
                        }

                        const capacityVal = parseInt(binFormCapacity) || undefined;

                        if (binEditingId) {
                          // Edit
                          InventoryModule.updateWarehouseBin(binEditingId, {
                            name: binFormName,
                            code: binFormCode,
                            zone: binFormZone || undefined,
                            max_capacity_qty: capacityVal
                          });
                        } else {
                          // Add
                          InventoryModule.addWarehouseBin({
                            warehouse_id: selectedWhForBins,
                            name: binFormName,
                            code: binFormCode,
                            zone: binFormZone || undefined,
                            max_capacity_qty: capacityVal,
                            is_active: true
                          });
                        }

                        setBinShowForm(false);
                        setBinEditingId(null);
                        setRefreshKey(prev => prev + 1);
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer"
                    >
                      {isRtl ? 'حفظ الحاوية' : 'Save Bin'}
                    </button>
                  </div>
                </div>
              )}

              {/* BINS TABLE LIST */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-500/5">
                      <th className="p-3">{isRtl ? 'اسم الحاوية' : 'Bin Name'}</th>
                      <th className="p-3 text-center">{isRtl ? 'الكود' : 'Code'}</th>
                      <th className="p-3 text-center">{isRtl ? 'المنطقة' : 'Zone'}</th>
                      <th className="p-3 text-center">{isRtl ? 'الاستخدام الحالي' : 'Stock Utilization'}</th>
                      <th className="p-3 text-center w-36">{isRtl ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/20">
                    {InventoryModule.getWarehouseBins(selectedWhForBins).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                          {isRtl ? 'لا توجد حاويات معرفة لهذا المخزن حتى الآن.' : 'No bins defined for this warehouse yet.'}
                        </td>
                      </tr>
                    ) : (
                      InventoryModule.getWarehouseBins(selectedWhForBins).map(b => {
                        const binStock = InventoryModule.getBinTotalStock(b.id);
                        const limit = b.max_capacity_qty || 0;
                        const utilPercent = limit > 0 ? (binStock / limit) * 100 : 0;

                        return (
                          <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{b.name}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{b.code}</td>
                            <td className="p-3 text-center text-slate-500">{b.zone || '---'}</td>
                            <td className="p-3 text-center font-mono">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {binStock} / {limit || '∞'} {isRtl ? 'وحدة' : 'units'}
                                </span>
                                {limit > 0 && (
                                  <div className="w-24 bg-slate-300 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        utilPercent > 90 ? 'bg-rose-500' : utilPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${Math.min(100, utilPercent)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBinEditingId(b.id);
                                    setBinFormName(b.name);
                                    setBinFormCode(b.code);
                                    setBinFormZone(b.zone || '');
                                    setBinFormCapacity(b.max_capacity_qty ? b.max_capacity_qty.toString() : '');
                                    setBinShowForm(true);
                                  }}
                                  className="px-2.5 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded transition-all cursor-pointer text-[10px] font-bold"
                                >
                                  {isRtl ? 'تعديل' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(isRtl ? 'هل أنت متأكد من حذف هذه الحاوية؟' : 'Are you sure you want to delete this bin?')) {
                                      InventoryModule.deleteWarehouseBin(b.id);
                                      setRefreshKey(prev => prev + 1);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded transition-all cursor-pointer text-[10px] font-bold"
                                >
                                  {isRtl ? 'حذف' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WORKFLOW RULES & SETTINGS TAB */}
      {!isFormOpen && !selectedDocId && activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                      <Workflow size={24} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                        {isRtl ? 'قواعد ودورة عمل المخازن والتخصيص الذاتي' : 'Warehouse Workflow & Business Rules'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {isRtl 
                          ? 'تخصيص سياسات الصرف، الربط المالي التلقائي، الرصيد السالب، الأرفف والباتشات حسب دورة عمل الشركة دون الحاجة لتعديل برمجي'
                          : 'Configure valuation, financial account mapping, negative stock policy, bin & batch enforcement dynamically'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      InventoryModule.saveInventoryConfig(invConfig);
                      setConfigSavedToast(true);
                      setTimeout(() => setConfigSavedToast(false), 3000);
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Check size={16} />
                    <span>{isRtl ? 'حفظ قواعد العمل والتغييرات' : 'Save Workflow Rules'}</span>
                  </button>
                </div>

                {configSavedToast && (
                  <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
                    <ShieldCheck size={16} />
                    <span>{isRtl ? 'تم حفظ وتطبيق قواعد وإعدادات دورة العمل المخزنية بنجاح!' : 'Warehouse workflow settings updated and applied successfully!'}</span>
                  </div>
                )}
              </div>

              {/* Grid of Rule Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Valuation & Dispatch Strategy */}
                <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                  <div className="flex items-center gap-2 border-b pb-3 border-slate-200 dark:border-slate-800">
                    <SlidersHorizontal size={18} className="text-emerald-500" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {isRtl ? '1. سياسة تقييم وترتيب صرف المخزون' : '1. Dispatch Valuation Strategy'}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isRtl ? 'طريقة تحديد أولوية الصرف التلقائي للتشغيلات:' : 'Auto Dispatch Priority Strategy:'}
                    </label>
                    <select
                      value={invConfig.valuation_method}
                      onChange={(e) => setInvConfig({ ...invConfig, valuation_method: e.target.value as any })}
                      className={`w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <option value="FEFO">{isRtl ? '⭐ FEFO - الأقدم صلاحية أولاً (First Expired, First Out)' : '⭐ FEFO - First Expired, First Out'}</option>
                      <option value="FIFO">{isRtl ? '📦 FIFO - الوارد أولاً يصرف أولاً (First In, First Out)' : '📦 FIFO - First In, First Out'}</option>
                      <option value="LIFO">{isRtl ? '🔄 LIFO - الوارد أخيراً يصرف أولاً (Last In, First Out)' : '🔄 LIFO - Last In, First Out'}</option>
                      <option value="MANUAL">{isRtl ? '✏️ MANUAL - اختيار يدوي مجرد بدون إجبار ترتيب' : '✏️ MANUAL - Manual Selection'}</option>
                    </select>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      {isRtl 
                        ? 'تؤثر هذه السياسة على الترتيب التلقائي للباتشات المتاحة عند إنشاء أذون الصرف والتحويل.' 
                        : 'Controls automatic batch ordering during issue and transfer vouchers.'}
                    </p>
                  </div>
                </div>

                {/* 2. Negative Stock Policy */}
                <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                  <div className="flex items-center gap-2 border-b pb-3 border-slate-200 dark:border-slate-800">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {isRtl ? '2. سياسة تجاوز الرصيد المتاح (السالب)' : '2. Negative Stock Policy'}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isRtl ? 'الإجراء المتخذ عند عدم كفاية الرصيد المخزني:' : 'Action upon insufficient warehouse balance:'}
                    </label>
                    <select
                      value={invConfig.allow_overdraft}
                      onChange={(e) => setInvConfig({ ...invConfig, allow_overdraft: e.target.value as any })}
                      className={`w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <option value="STRICT">{isRtl ? '⛔ STRICT - منع الصرف نهائياً عند عدم كفاية الرصيد (صارم)' : '⛔ STRICT - Strictly block insufficient balance'}</option>
                      <option value="WARNING">{isRtl ? '⚠️ WARNING - إظهار تحذير لمسؤول الإدخال مع السماح بالمرور' : '⚠️ WARNING - Warn user but allow dispatch'}</option>
                      <option value="ALLOWED">{isRtl ? '✅ ALLOWED - سماح تام ومطلق بالصرف بالسالب' : '✅ ALLOWED - Allow negative balance without restriction'}</option>
                    </select>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      {isRtl 
                        ? 'تتيح هذه السياسة للشركات ذات الأنشطة السريعة مرونة الصرف قبل تسجيل فواتير الوارد.' 
                        : 'Provides flexibility for high-volume operational workflows.'}
                    </p>
                  </div>
                </div>

                {/* 3. Bin & Batch Tracking Policy */}
                <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                  <div className="flex items-center gap-2 border-b pb-3 border-slate-200 dark:border-slate-800">
                    <Layers size={18} className="text-blue-500" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {isRtl ? '3. سياسات تتبع الأرفف والباتشات' : '3. Bin & Batch Tracking Policies'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                        {isRtl ? 'تتبع الأرفف (Bins):' : 'Bin Locations:'}
                      </label>
                      <select
                        value={invConfig.bin_tracking_policy}
                        onChange={(e) => setInvConfig({ ...invConfig, bin_tracking_policy: e.target.value as any })}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="MANDATORY">{isRtl ? 'إلزامي لكل حركة' : 'Mandatory'}</option>
                        <option value="OPTIONAL">{isRtl ? 'اختياري' : 'Optional'}</option>
                        <option value="DISABLED">{isRtl ? 'معطل' : 'Disabled'}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                        {isRtl ? 'التشغيلات والصلاحيات:' : 'Batch & Expiry:'}
                      </label>
                      <select
                        value={invConfig.batch_expiry_policy}
                        onChange={(e) => setInvConfig({ ...invConfig, batch_expiry_policy: e.target.value as any })}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="MANDATORY">{isRtl ? 'إلزامي' : 'Mandatory'}</option>
                        <option value="WARNING">{isRtl ? 'تحذير عند المنتهي' : 'Warn Expired'}</option>
                        <option value="OPTIONAL">{isRtl ? 'اختياري' : 'Optional'}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Workflow Approval & Transfer Mode */}
                <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                  <div className="flex items-center gap-2 border-b pb-3 border-slate-200 dark:border-slate-800">
                    <ShieldCheck size={18} className="text-indigo-500" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {isRtl ? '4. دورة التحويلات والاعتمادات' : '4. Transfer & Approval Workflow'}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isRtl ? 'دورة أذون التحويل بين الفروع والمخازن:' : 'Inter-Warehouse Transfer Cycle:'}
                    </label>
                    <select
                      value={invConfig.transfer_approval_mode}
                      onChange={(e) => setInvConfig({ ...invConfig, transfer_approval_mode: e.target.value as any })}
                      className={`w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <option value="TWO_STEP">{isRtl ? '🔄 دورة تحويل مرحلتين (صرف تحويل + استلام ومصادقة في المستلم)' : '🔄 Two-Step (Dispatch + Receive Audit)'}</option>
                      <option value="DIRECT">{isRtl ? '⚡ تحويل فوري مباشر بدون خطوة استلام' : '⚡ Direct Immediate Transfer'}</option>
                    </select>

                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="require_app_chk"
                        checked={invConfig.require_approval_for_posting}
                        onChange={(e) => setInvConfig({ ...invConfig, require_approval_for_posting: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="require_app_chk" className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                        {isRtl ? 'اشتراط موافقة مدير المخازن قبل الاعتماد النهائي لسندات الحركة' : 'Require manager approval prior to finalizing documents'}
                      </label>
                    </div>
                  </div>
                </div>

                {/* 5. Automated Accounting GL Settings */}
                <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} md:col-span-2 space-y-4`}>
                  <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={18} className="text-purple-500" />
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {isRtl ? '5. الربط المالي التلقائي للحسابات (Financial Mapping)' : '5. Automated Financial Mapping'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="auto_gl_chk"
                        checked={invConfig.auto_post_accounting}
                        onChange={(e) => setInvConfig({ ...invConfig, auto_post_accounting: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="auto_gl_chk" className="text-xs font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer">
                        {isRtl ? 'تفعيل الربط المالي التلقائي' : 'Enable Automated Financial Sync'}
                      </label>
                    </div>
                  </div>

                  {invConfig.auto_post_accounting && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isRtl ? 'حساب أصول المخزون الرئيسي:' : 'Inventory Asset Account:'}
                        </label>
                        <input
                          type="text"
                          value={invConfig.default_inventory_account_code}
                          onChange={(e) => setInvConfig({ ...invConfig, default_inventory_account_code: e.target.value })}
                          placeholder="120101"
                          className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isRtl ? 'حساب الموردين والذمم الدائنة:' : 'Accounts Payable (AP):'}
                        </label>
                        <input
                          type="text"
                          value={invConfig.default_ap_account_code}
                          onChange={(e) => setInvConfig({ ...invConfig, default_ap_account_code: e.target.value })}
                          placeholder="210101"
                          className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isRtl ? 'حساب التكلفة والمصروفات:' : 'COGS / Operational Expense:'}
                        </label>
                        <input
                          type="text"
                          value={invConfig.default_cogs_account_code}
                          onChange={(e) => setInvConfig({ ...invConfig, default_cogs_account_code: e.target.value })}
                          placeholder="510101"
                          className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isRtl ? 'حساب تسويات وعجز المخزون:' : 'Inventory Variance Account:'}
                        </label>
                        <input
                          type="text"
                          value={invConfig.default_variance_account_code}
                          onChange={(e) => setInvConfig({ ...invConfig, default_variance_account_code: e.target.value })}
                          placeholder="510401"
                          className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isRtl ? 'حساب أرباح ومبيعات الخردة:' : 'Scrap / Wastage Account:'}
                        </label>
                        <input
                          type="text"
                          value={invConfig.default_scrap_account_code}
                          onChange={(e) => setInvConfig({ ...invConfig, default_scrap_account_code: e.target.value })}
                          placeholder="410101"
                          className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isRtl ? 'نسبة تنبيه حد الأمان المخزني (%):' : 'Safety Reorder Level (%):'}
                        </label>
                        <input
                          type="number"
                          value={invConfig.reorder_alert_threshold_percent}
                          onChange={(e) => setInvConfig({ ...invConfig, reorder_alert_threshold_percent: parseInt(e.target.value) || 0 })}
                          placeholder="20"
                          className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

      {/* INVENTORY DOC PRINT MODAL */}
      {printInventoryDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 print:p-0 print:shadow-none print:rounded-none">
            <div className="flex justify-between items-center print:hidden border-b pb-3 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {isRtl ? 'معاينة السند المخزني للطباعة' : 'Inventory Document Print Preview'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  <span>{isRtl ? 'طباعة المستند' : 'Print Voucher'}</span>
                </button>
                <button
                  onClick={() => setPrintInventoryDoc(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div
              id="voucher-sheet-printable"
              className="w-[210mm] min-h-[297mm] mx-auto p-12 border border-slate-300 bg-white text-black text-xs font-bold leading-relaxed shadow-xl relative print:shadow-none print:border-none print:w-full print:min-h-0 print:p-2"
              dir={isRtl ? 'rtl' : 'ltr'}
              style={{
                backgroundImage: (CustodyDB.getConfig().use_custom_template && CustodyDB.getConfig().custom_template_image) ? `url(${CustodyDB.getConfig().custom_template_image})` : undefined,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div className="flex justify-between items-center border-b-2 border-black pb-5 mb-6 gap-4">
                {!CustodyDB.getConfig().use_custom_template ? (
                  <div className="flex items-center gap-3">
                    <div className="border-[2.5px] border-black rounded-[50%/50%] px-3 py-1.5 flex flex-col items-center justify-center leading-none bg-white shrink-0 shadow-sm h-[52px] w-[90px]">
                      <span className="text-[20px] font-black leading-none text-black">كوكي</span>
                      <span className="text-[9px] font-bold font-mono tracking-wider mt-0.5 leading-none text-black">Koki</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <h1 className="text-[13px] font-black text-black">شركة / القاهرة الجديدة للدواجن</h1>
                      <p className="text-[10px] text-neutral-800 font-bold">{isRtl ? 'إدارة المستودعات وسلاسل الإمداد' : 'Warehouse & Inventory Control'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-right space-y-0.5">
                    <h1 className="text-[13px] font-black text-emerald-600">{CustodyDB.getConfig().company_name}</h1>
                    <p className="text-[10px] text-neutral-800 font-bold">{isRtl ? 'إدارة المستودعات وسلاسل الإمداد' : 'Warehouse & Inventory Control'}</p>
                  </div>
                )}
                
                <div className="text-center">
                  <h2 className="text-[14px] font-black border-[2.5px] border-black px-4 py-2 bg-neutral-100 text-black shadow-sm uppercase">
                    {getDocTypeLabel(printInventoryDoc.doc_type, printInventoryDoc.scrap_action)}
                  </h2>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs font-mono font-bold text-black border border-black px-2.5 py-1 bg-neutral-50 rounded">
                    {isRtl ? 'سند رقم: ' : 'Voucher #: '} <span className="font-black font-mono">{printInventoryDoc.doc_no}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-600">
                    {isRtl ? 'التاريخ: ' : 'Date: '} {printInventoryDoc.date}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border border-black p-3 rounded mb-6 bg-neutral-50/50">
                <div>
                  <span className="text-slate-500 font-semibold">{isRtl ? 'موقع المخزن المسؤول:' : 'Primary Warehouse:'}</span>
                  <p className="font-bold text-black">{warehouses.find(w => w.id === printInventoryDoc.source_warehouse_id)?.name || printInventoryDoc.source_warehouse_id}</p>
                </div>
                {printInventoryDoc.dest_entity_id && (
                  <div>
                    <span className="text-slate-500 font-semibold">{isRtl ? 'الجهة المستلمة / المخزن البديل:' : 'Destination Entity / Wh:'}</span>
                    <p className="font-bold text-black">{printInventoryDoc.dest_entity_id} ({printInventoryDoc.dest_entity_type})</p>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 font-semibold">{isRtl ? 'سبب المعاملة:' : 'Reason / Reference:'}</span>
                  <p className="font-bold text-black">{printInventoryDoc.reason || '---'}</p>
                </div>
                {printInventoryDoc.recipient && (
                  <div>
                    <span className="text-slate-500 font-semibold">{isRtl ? 'أمين المخزن / السائق المستلم:' : 'Recipient Personnel:'}</span>
                    <p className="font-bold text-black">{printInventoryDoc.recipient}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-slate-500 font-semibold">{isRtl ? 'البيان العام للحركة:' : 'Voucher Statement:'}</span>
                  <p className="font-bold text-black">{printInventoryDoc.statement || '---'}</p>
                </div>
              </div>

              <table className="w-full text-right border-collapse text-xs border border-black mb-8">
                <thead>
                  <tr className="bg-neutral-100 border-b border-black text-black font-black">
                    <th className="p-2 border-r border-black w-10 text-center">#</th>
                    <th className="p-2 border-r border-black w-28 text-center">{isRtl ? 'كود الصنف' : 'Item Code'}</th>
                    <th className="p-2 border-r border-black">{isRtl ? 'اسم ووصف الصنف المخزني' : 'Item Name & Description'}</th>
                    <th className="p-2 border-r border-black w-24 text-center">{isRtl ? 'الكمية' : 'Qty'}</th>
                    <th className="p-2 border-r border-black w-24 text-center">{isRtl ? 'الوحدة' : 'Unit'}</th>
                    <th className="p-2 w-48">{isRtl ? 'ملاحظات الصنف' : 'Line Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-black">
                  {printInventoryDoc.items.map((item, index) => (
                    <tr key={index} className="border-b border-black">
                      <td className="p-2 border-r border-black text-center font-mono font-bold">{index + 1}</td>
                      <td className="p-2 border-r border-black text-center font-mono font-bold">{item.product_code}</td>
                      <td className="p-2 border-r border-black font-extrabold">{item.product_name}</td>
                      <td className="p-2 border-r border-black text-center font-mono font-black">{item.qty}</td>
                      <td className="p-2 border-r border-black text-center font-medium">{item.unit || (isRtl ? 'وحدة' : 'Unit')}</td>
                      <td className="p-2 text-slate-700">{item.notes || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {printInventoryDoc.received_by && (
                <div className="mb-6 p-3 border border-emerald-500 rounded bg-emerald-500/5 text-black">
                  <p className="font-black text-emerald-800 mb-1">{isRtl ? 'تأكيد تتبع الشحنة اللوجستي (Multi-Echelon Audit Trail):' : 'Multi-Echelon Logistic Audit Verification:'}</p>
                  <p className="text-[11px] font-bold">
                    {isRtl ? 'المستلم المصادق:' : 'Received by:'} <span className="font-black text-slate-800">{printInventoryDoc.received_by}</span> • {isRtl ? 'تاريخ الاستلام المخزني الفعلي:' : 'Date:'} <span className="font-black text-slate-800">{new Date(printInventoryDoc.received_date!).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>
                  </p>
                  {printInventoryDoc.received_notes && (
                    <p className="text-[11px] font-medium mt-1">
                      {isRtl ? 'ملاحظات المستلم الفعلي:' : 'Recipient Comments:'} <span className="italic text-slate-700">{printInventoryDoc.received_notes}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-4 gap-4 text-center mt-12 pt-6 border-t border-slate-300">
                <div className="space-y-6">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">{isRtl ? 'أمين مخزن الصرف / الإضافة' : 'Storekeeper Signature'}</p>
                  <div className="h-10 border-b border-black w-32 mx-auto border-dashed"></div>
                  <p className="text-[9px] text-black font-semibold">{printInventoryDoc.created_by}</p>
                </div>
                <div className="space-y-6">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">{isRtl ? 'السائق / المستلم الفعلي' : 'Recipient / Transporter'}</p>
                  <div className="h-10 border-b border-black w-32 mx-auto border-dashed"></div>
                  <p className="text-[9px] text-black font-mono">{printInventoryDoc.recipient || '---'}</p>
                </div>
                <div className="space-y-6">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">{isRtl ? 'البوابة / تصريح الأمن' : 'Security Clearance Gate'}</p>
                  <div className="h-10 border-b border-black w-32 mx-auto border-dashed"></div>
                  <p className="text-[9px] text-black font-mono">---</p>
                </div>
                <div className="space-y-6">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">{isRtl ? 'مدير إدارة المستودعات' : 'Logistics Manager'}</p>
                  <div className="h-10 border-b border-black w-32 mx-auto border-dashed"></div>
                  <p className="text-[9px] text-black font-mono">{printInventoryDoc.status === 'Posted' ? '✓ SYSTEM_POSTED' : '---'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
