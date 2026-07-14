import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Search, 
  Check, 
  AlertCircle, 
  FileText, 
  ChevronDown, 
  Calendar, 
  User, 
  Tag, 
  HelpCircle,
  Hash,
  Activity,
  DollarSign
} from 'lucide-react';
import { 
  InventoryDocument, 
  InventoryDocType, 
  InventoryDocStatus, 
  InventoryDocItem,
  Warehouse,
  Product
} from '../types/inventory';
import { InventoryModule } from '../db/inventory';
import { CustodyDB } from '../db';

interface InventoryDocumentFormProps {
  docId?: string; // If editing
  initialDocType?: InventoryDocType;
  onSave: (doc: InventoryDocument) => void;
  onCancel: () => void;
  language: 'en' | 'ar';
  theme: 'light' | 'dark';
}

interface DropdownItem {
  id: string;
  name: string;
  code: string;
  subText?: string;
}

// Pre-seeded suppliers for autocomplete
const DEFAULT_SUPPLIERS = [
  { id: 'sup-1', name: 'Shell Egypt (شل مصر)', code: 'SUP-SHELL', subText: 'مورد زيوت معتمد' },
  { id: 'sup-2', name: 'Bridgestone Middle East (بريدجستون الشرق الأوسط)', code: 'SUP-BRIDGE', subText: 'مورد إطارات أصلي' },
  { id: 'sup-3', name: 'El-Ahram Batteries Co. (شركة الأهرام للبطاريات)', code: 'SUP-AHRAM', subText: 'مورد بطاريات وطني' },
  { id: 'sup-4', name: 'Ghabour Auto Parts (جي بي غبور لقطع الغيار)', code: 'SUP-GB', subText: 'قطع غيار سيارات أصلية' }
];

export default function InventoryDocumentForm({
  docId,
  initialDocType = 'Receipt',
  onSave,
  onCancel,
  language,
  theme
}: InventoryDocumentFormProps) {
  const isRtl = language === 'ar';
  const activeUser = CustodyDB.getActiveUser();

  // Load basic lists
  const warehouses = useMemo(() => InventoryModule.getWarehouses(), []);
  const products = useMemo(() => InventoryModule.getProducts(), []);
  const stations = useMemo(() => CustodyDB.getStations(), []);
  const regions = useMemo(() => CustodyDB.getRegions(), []);

  // Form states
  const [docType, setDocType] = useState<InventoryDocType>(initialDocType);
  const [scrapAction, setScrapAction] = useState<'IN' | 'OUT'>('IN');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>('');
  const [destEntityId, setDestEntityId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [statement, setStatement] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<Omit<InventoryDocItem, 'product_code' | 'product_name' | 'unit'>[]>([]);

  // Filter warehouses for Scrap / Obsolete documents
  const filteredWarehouses = useMemo(() => {
    if (docType === 'Damage') {
      return warehouses.filter(w =>
        w.name.includes('خردة') ||
        w.name.includes('كهنة') ||
        w.name.toLowerCase().includes('scrap') ||
        w.name.toLowerCase().includes('obsolete')
      );
    }
    return warehouses;
  }, [docType, warehouses]);

  // Automatically select first scrap warehouse if docType is Damage
  useEffect(() => {
    if (docType === 'Damage') {
      const scrapWhs = warehouses.filter(w =>
        w.name.includes('خردة') ||
        w.name.includes('كهنة') ||
        w.name.toLowerCase().includes('scrap') ||
        w.name.toLowerCase().includes('obsolete')
      );
      if (scrapWhs.length > 0) {
        const isCurrentScrap = scrapWhs.some(w => w.id === sourceWarehouseId);
        if (!isCurrentScrap) {
          setSourceWarehouseId(scrapWhs[0].id);
        }
      } else {
        setSourceWarehouseId('');
      }
    }
  }, [docType, warehouses]);

  // Validation/Error feedback state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Editing state loading
  useEffect(() => {
    if (docId) {
      const documents = InventoryModule.getInventoryDocuments();
      const document = documents.find(d => d.id === docId);
      if (document) {
        setDocType(document.doc_type);
        if (document.scrap_action) {
          setScrapAction(document.scrap_action);
        }
        setDate(document.date);
        setSourceWarehouseId(document.source_warehouse_id);
        setDestEntityId(document.dest_entity_id);
        setReason(document.reason);
        setRecipient(document.recipient);
        setStatement(document.statement);
        setNotes(document.notes || '');
        // Items loading
        setItems(document.items.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          notes: i.notes || '',
          last_purchase_price: i.last_purchase_price
        })));
      }
    } else {
      // Set default source warehouse if available
      if (docType === 'Damage') {
        const scrapWhs = warehouses.filter(w =>
          w.name.includes('خردة') ||
          w.name.includes('كهنة') ||
          w.name.toLowerCase().includes('scrap') ||
          w.name.toLowerCase().includes('obsolete')
        );
        if (scrapWhs.length > 0) {
          setSourceWarehouseId(scrapWhs[0].id);
        }
      } else if (warehouses.length > 0) {
        setSourceWarehouseId(warehouses[0].id);
      }
      // Initialize with one empty item row
      setItems([{ product_id: '', qty: 1, notes: '', last_purchase_price: 0 }]);
    }
  }, [docId, warehouses, docType]);

  // Handle document type selection adjustments
  const destEntityType = useMemo((): 'warehouse' | 'branch' | 'station' | 'supplier' | 'customer' | 'scrap' | 'adjustment' => {
    switch (docType) {
      case 'Transfer':
        return 'warehouse';
      case 'BranchTransfer':
      case 'BranchReturn':
        return 'branch';
      case 'StationTransfer':
        return 'station';
      case 'SupplierReturn':
        return 'supplier';
      case 'Damage':
        return 'scrap';
      case 'Adjustment':
        return 'adjustment';
      default:
        return 'supplier';
    }
  }, [docType]);

  // Dynamically resolve target entity list for searchable dropdown
  const destEntityList = useMemo((): DropdownItem[] => {
    switch (destEntityType) {
      case 'warehouse':
        return warehouses
          .filter(w => w.id !== sourceWarehouseId)
          .map(w => ({ id: w.id, name: w.name, code: w.code, subText: w.location }));
      case 'branch':
        return regions.map(r => ({ id: r.id, name: r.name, code: r.code || r.id, subText: isRtl ? 'فرع مؤسسة' : 'Company Branch' }));
      case 'station':
        return stations.map(s => ({ id: s.id, name: s.station_name, code: s.station_code, subText: s.custody_amount.toLocaleString() + ' EGP' }));
      case 'supplier':
        return DEFAULT_SUPPLIERS;
      default:
        return [];
    }
  }, [destEntityType, warehouses, sourceWarehouseId, regions, stations, isRtl]);

  // Autocomplete suggestions for fields
  const [activeDropdown, setActiveDropdown] = useState<{ type: 'dest' | number; search: string } | null>(null);

  // Validate fields before submission
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!sourceWarehouseId) {
      newErrors.sourceWarehouseId = isRtl ? 'المخزن المصدر إلزامي' : 'Source warehouse is required';
    }

    if (destEntityType !== 'scrap' && destEntityType !== 'adjustment' && !destEntityId) {
      newErrors.destEntityId = isRtl ? 'الجهة المستلمة/المعنية إلزامية' : 'Destination entity is required';
    }

    if (sourceWarehouseId && destEntityId && sourceWarehouseId === destEntityId && destEntityType === 'warehouse') {
      newErrors.destEntityId = isRtl ? 'لا يمكن التحويل لنفس المخزن' : 'Cannot transfer to the same warehouse';
    }

    if (!reason.trim()) {
      newErrors.reason = isRtl ? 'سبب الحركة إلزامي' : 'Reason is required';
    }

    if (!recipient.trim()) {
      newErrors.recipient = isRtl ? 'المستلم/المشرف إلزامي' : 'Recipient/Operator is required';
    }

    if (!statement.trim()) {
      newErrors.statement = isRtl ? 'البيان إلزامي' : 'Statement is required';
    }

    if (items.length === 0) {
      newErrors.items = isRtl ? 'يجب إضافة صنف واحد على الأقل' : 'At least one item is required';
    }

    // Items row-level validation
    items.forEach((item, idx) => {
      if (!item.product_id) {
        newErrors[`item_product_${idx}`] = isRtl ? 'يرجى اختيار الصنف' : 'Please select product';
      }
      if (item.qty <= 0) {
        newErrors[`item_qty_${idx}`] = isRtl ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be > 0';
      }

      // Overdraft check if it decreases stock
      if (item.product_id && sourceWarehouseId && docType !== 'Receipt' && docType !== 'BranchReturn' && docType !== 'Adjustment') {
        const isAddition = docType === 'Receipt' || docType === 'BranchReturn' || (docType === 'Damage' && scrapAction === 'IN');
        if (!isAddition) {
          const currentStock = InventoryModule.getProductStock(item.product_id, sourceWarehouseId);
          if (currentStock < item.qty) {
            newErrors[`item_qty_${idx}`] = isRtl 
              ? `الكمية المطلوبة تتجاوز الرصيد الحالي (${currentStock})` 
              : `Requested quantity exceeds current stock (${currentStock})`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Build final items array with enriched codes/names
    const enrichedItems: InventoryDocItem[] = items.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      return {
        product_id: item.product_id,
        product_code: prod?.code || '',
        product_name: prod?.name || '',
        unit: prod?.unit || '',
        qty: item.qty,
        notes: item.notes,
        last_purchase_price: item.last_purchase_price || prod?.last_purchase_price || 0
      };
    });

    try {
      if (docId) {
        // Update draft
        InventoryModule.updateInventoryDocument(docId, {
          date,
          doc_type: docType,
          source_warehouse_id: sourceWarehouseId,
          dest_entity_id: destEntityId,
          dest_entity_type: destEntityType,
          reason,
          recipient,
          statement,
          notes,
          items: enrichedItems,
          scrap_action: docType === 'Damage' ? scrapAction : undefined
        });
        setSuccessMsg(isRtl ? 'تم تحديث المسودة بنجاح!' : 'Draft updated successfully!');
      } else {
        // Add new document
        await InventoryModule.addInventoryDocument({
          date,
          doc_type: docType,
          source_warehouse_id: sourceWarehouseId,
          dest_entity_id: destEntityId,
          dest_entity_type: destEntityType,
          reason,
          recipient,
          statement,
          notes,
          items: enrichedItems,
          scrap_action: docType === 'Damage' ? scrapAction : undefined
        });
        setSuccessMsg(isRtl ? 'تم إنشاء السند المخزني كمسودة بنجاح!' : 'Inventory document draft created successfully!');
      }

      setTimeout(() => {
        onSave({} as any); // Trigger reload
      }, 1500);

    } catch (err: any) {
      setErrors({ global: err.message });
    }
  };

  // Items table row modifiers
  const handleAddItemRow = () => {
    setItems([...items, { product_id: '', qty: 1, notes: '', last_purchase_price: 0 }]);
  };

  const handleDeleteItemRow = (index: number) => {
    if (items.length === 1) {
      setItems([{ product_id: '', qty: 1, notes: '', last_purchase_price: 0 }]);
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleDuplicateItemRow = (index: number) => {
    const rowToCopy = items[index];
    const newItems = [...items];
    newItems.splice(index + 1, 0, { ...rowToCopy });
    setItems(newItems);
  };

  const handleUpdateItemValue = (index: number, key: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };

    // Auto-fill price or show alerts when product changes
    if (key === 'product_id' && value) {
      const prod = products.find(p => p.id === value);
      if (prod) {
        updated[index].last_purchase_price = prod.last_purchase_price || 0;
      }
    }

    setItems(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Document Frame / Paper-like Look */}
      <div className={`rounded-3xl border p-4 md:p-8 transition-colors duration-200 shadow-xl ${
        theme === 'dark' ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-100'
      }`}>
        {/* Document Header (أعلى الورقة المستندية) */}
        <div className="border-b-2 border-dashed border-slate-200 dark:border-slate-800 pb-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Right: Company Logo Block */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                CF
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Cairo Poultry Co.</h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">CustodyFlow ERP</p>
              </div>
            </div>

            {/* Center: Main Document Title Card */}
            <div className="text-center bg-slate-50 dark:bg-slate-800 px-6 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-700">
              <h2 className="text-sm md:text-lg font-black text-emerald-600 dark:text-emerald-400">
                {docType === 'Receipt' && (isRtl ? 'إذن إضافة مخزنـي (Receipt Voucher)' : 'Inventory Receipt Voucher')}
                {docType === 'Issue' && (isRtl ? 'إذن صرف مخزنـي (Issue Voucher)' : 'Inventory Issue Voucher')}
                {docType === 'Transfer' && (isRtl ? 'إذن تحويل مخزنـي (Transfer Voucher)' : 'Warehouse Transfer Voucher')}
                {docType === 'BranchTransfer' && (isRtl ? 'تحويل مخزني إلى فرع (Branch Transfer)' : 'Branch Transfer Voucher')}
                {docType === 'StationTransfer' && (isRtl ? 'تحويل مخزني إلى محطة (Station Transfer)' : 'Station Transfer Voucher')}
                {docType === 'BranchReturn' && (isRtl ? 'مرتجع من فرع / محطة (Branch Return)' : 'Branch Return Voucher')}
                {docType === 'SupplierReturn' && (isRtl ? 'مرتجع إلى مورد (Supplier Return)' : 'Supplier Return Voucher')}
                {docType === 'Adjustment' && (isRtl ? 'سند تسوية جردية (Inventory Adjustment)' : 'Inventory Adjustment Voucher')}
                {docType === 'Damage' && (isRtl ? 'إذن خردة / كهنة (Scrap & Obsolete)' : 'Scrap & Obsolete Voucher')}
              </h2>
              <p className="text-[9px] text-slate-400 font-mono mt-0.5">SECURE TRANSACTION SHEET</p>
            </div>

            {/* Left: Metadata Numbering & Date */}
            <div className="text-right flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">{isRtl ? 'الرقم:' : 'Serial:'}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {docId ? 'Draft / قيد التعديل' : 'AUTO_SEQUENCE_KEY'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400 font-mono mt-1">
                <Calendar size={12} />
                <span>{date}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Error/Success Message */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{successMsg}</span>
          </div>
        )}
        {errors.global && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errors.global}</span>
          </div>
        )}

        {/* Basic Fields (البيانات الأساسية للمستند) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Document Type Selection */}
          <div className="w-full">
            <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {isRtl ? 'نوع المستند' : 'Document Type'}
            </label>
            <select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value as InventoryDocType);
                setDestEntityId('');
              }}
              disabled={!!docId}
              className={`w-full px-3.5 py-2 text-xs border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                theme === 'dark' ? 'text-slate-100 bg-[#1e293b] border-[#334155]' : 'text-slate-800 bg-white border-slate-200'
              }`}
            >
              <option value="Receipt">{isRtl ? 'إذن إضافة' : 'Receipt'}</option>
              <option value="Issue">{isRtl ? 'إذن صرف' : 'Issue'}</option>
              <option value="Transfer">{isRtl ? 'إذن تحويل بين المخازن' : 'Transfer'}</option>
              <option value="BranchTransfer">{isRtl ? 'إذن تحويل إلى فرع' : 'Branch Transfer'}</option>
              <option value="StationTransfer">{isRtl ? 'إذن تحويل إلى محطة' : 'Station Transfer'}</option>
              <option value="BranchReturn">{isRtl ? 'مرتجع من فرع أو محطة' : 'Branch Return'}</option>
              <option value="SupplierReturn">{isRtl ? 'مرتجع إلى مورد' : 'Supplier Return'}</option>
              <option value="Adjustment">{isRtl ? 'تسوية جرد' : 'Adjustment'}</option>
              <option value="Damage">{isRtl ? 'إذن خردة / كهنة' : 'Scrap / Obsolete'}</option>
            </select>
          </div>

          {/* Source Warehouse (المخزن الأساسي) */}
          <div className="w-full">
            <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {docType === 'Damage' 
                ? (isRtl ? 'مخزن الخردة / الكهنة' : 'Scrap & Obsolete Warehouse') 
                : (isRtl ? 'المخزن الرئيسي للمستند' : 'Primary Warehouse')}
            </label>
            <select
              value={sourceWarehouseId}
              onChange={(e) => setSourceWarehouseId(e.target.value)}
              className={`w-full px-3.5 py-2 text-xs border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                theme === 'dark' ? 'text-slate-100 bg-[#1e293b] border-[#334155]' : 'text-slate-800 bg-white border-slate-200'
              } ${errors.sourceWarehouseId ? 'border-rose-500' : ''}`}
            >
              <option value="">
                {docType === 'Damage' 
                  ? (isRtl ? '-- اختر مخزن الخردة/الكهنة --' : '-- Select Scrap Store --') 
                  : (isRtl ? '-- اختر المخزن --' : '-- Select Warehouse --')}
              </option>
              {filteredWarehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} [{w.code}] {w.receiving_approval_workflow ? (isRtl ? '(يتطلب اعتماد)' : '(Requires Approval)') : ''}
                </option>
              ))}
            </select>
            {errors.sourceWarehouseId && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.sourceWarehouseId}</p>}
          </div>

          {/* Date Picker */}
          <div className="w-full">
            <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {isRtl ? 'التاريخ' : 'Document Date'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                theme === 'dark' ? 'text-slate-100 bg-[#1e293b] border-[#334155]' : 'text-slate-800 bg-white border-slate-200'
              }`}
            />
          </div>
        </div>

        {/* Scrap / Obsolete action nature selection buttons */}
        {docType === 'Damage' && (
          <div className="p-5 rounded-2xl border mb-8 bg-amber-500/5 border-amber-500/20 space-y-4 animate-fade-in">
            <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Tag size={14} />
              <span>{isRtl ? 'طبيعة حركة الخردة / الكهنة' : 'Scrap / Obsolete Transaction Nature'}</span>
            </h4>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                type="button"
                onClick={() => setScrapAction('IN')}
                className={`flex-1 w-full px-4 py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 text-right ${
                  scrapAction === 'IN'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${scrapAction === 'IN' ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
                <div>
                  <div className="font-extrabold">{isRtl ? 'إضافة للمخزن (تكهين صنف خردة)' : 'Inward / Addition (Scrapping Item)'}</div>
                  <div className={`text-[10px] mt-0.5 ${scrapAction === 'IN' ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {isRtl ? 'يتم زيادة رصيد مخزن الخردة/الكهنة المحدد عند تكهين أو إتلاف أصل/صنف' : 'Increases scrap/obsolete stock balance upon scrapping'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScrapAction('OUT')}
                className={`flex-1 w-full px-4 py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 text-right ${
                  scrapAction === 'OUT'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${scrapAction === 'OUT' ? 'bg-white animate-pulse' : 'bg-rose-500'}`} />
                <div>
                  <div className="font-extrabold">{isRtl ? 'صرف من المخزن (بيع الخردة/الكهنة)' : 'Outward / Issue (Selling Scrap)'}</div>
                  <div className={`text-[10px] mt-0.5 ${scrapAction === 'OUT' ? 'text-rose-100' : 'text-slate-400'}`}>
                    {isRtl ? 'يتم خصم رصيد مخزن الخردة/الكهنة المحدد عند بيع أو التخلص من الخردة' : 'Decreases scrap/obsolete stock balance upon selling scrap'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic target selection block depending on docType */}
        {destEntityType !== 'adjustment' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {destEntityType !== 'scrap' ? (
              <>
                {/* Searchable dropdown for destination/entity */}
                <div className="w-full">
                  <SearchableDropdown
                    label={
                      destEntityType === 'warehouse' ? (isRtl ? 'المخزن المستلم' : 'Destination Warehouse') :
                      destEntityType === 'branch' ? (isRtl ? 'الفرع المستلم' : 'Target Branch') :
                      destEntityType === 'station' ? (isRtl ? 'المحطة المستلمة' : 'Target Station') :
                      isRtl ? 'المورد المستهدف' : 'Supplier Target'
                    }
                    placeholder={isRtl ? 'اختر الجهة...' : 'Select entity...'}
                    value={destEntityId}
                    list={destEntityList}
                    onSelect={(id) => setDestEntityId(id)}
                    error={errors.destEntityId}
                    typeKey="dest"
                    theme={theme}
                    isRtl={isRtl}
                    activeDropdown={activeDropdown}
                    setActiveDropdown={setActiveDropdown}
                  />
                </div>

                {/* Recipient / Driver / Supervisor */}
                <div className="w-full">
                  <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isRtl ? 'المستلم أو الناقل المسئول' : 'Recipient / Driver'}
                  </label>
                  <div className="relative flex items-center">
                    <User size={14} className="absolute right-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder={isRtl ? 'اسم المستلم ثلاثياً، رقم السيارة، إلخ...' : 'Recipient full name or vehicle license...'}
                      className={`w-full pr-10 pl-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                        theme === 'dark' ? 'bg-[#1e293b] border-[#334155] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                      } ${errors.recipient ? 'border-rose-500' : ''}`}
                    />
                  </div>
                  {errors.recipient && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.recipient}</p>}
                </div>
              </>
            ) : (
              /* If scrap: only show recipient with customized label */
              <div className="w-full col-span-2">
                <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  {scrapAction === 'OUT' 
                    ? (isRtl ? 'الجهة المستلمة / المشتري للخردة' : 'Buyer / Scrap Recipient')
                    : (isRtl ? 'المشرف المسؤول عن التكهين' : 'Responsible Supervisor / Technician')}
                </label>
                <div className="relative flex items-center">
                  <User size={14} className="absolute right-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={
                      scrapAction === 'OUT'
                        ? (isRtl ? 'اسم المشتري، رقم السيارة، شركة إعادة التدوير...' : 'Buyer name, vehicle license, recycling company...')
                        : (isRtl ? 'اسم رئيس لجنة التكهين أو الفني المسؤول...' : 'Commission head name, technician...')
                    }
                    className={`w-full pr-10 pl-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                      theme === 'dark' ? 'bg-[#1e293b] border-[#334155] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    } ${errors.recipient ? 'border-rose-500' : ''}`}
                  />
                </div>
                {errors.recipient && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.recipient}</p>}
              </div>
            )}
          </div>
        )}

        {/* Statement & Reason for transaction */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Reason (سبب الحركة) */}
          <div className="w-full">
            <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {isRtl ? 'سبب الحركة المخزنية' : 'Stock Movement Reason'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isRtl ? 'مثال: توريد كميات سنوية، طلبية طوارئ، تالف تعويضات...' : 'e.g. Emergency replenishment, regular supply...'}
              className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                theme === 'dark' ? 'bg-[#1e293b] border-[#334155] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              } ${errors.reason ? 'border-rose-500' : ''}`}
            />
            {errors.reason && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.reason}</p>}
          </div>

          {/* Statement (البيان) */}
          <div className="w-full">
            <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {isRtl ? 'البيان الإجمالي (الشرح العام)' : 'General Statement / Memo'}
            </label>
            <input
              type="text"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder={isRtl ? 'مثال: صرف وتوريد قطع غيار عهدة المحطات الشرقية...' : 'General memo for the entire document...'}
              className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                theme === 'dark' ? 'bg-[#1e293b] border-[#334155] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              } ${errors.statement ? 'border-rose-500' : ''}`}
            />
            {errors.statement && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.statement}</p>}
          </div>
        </div>

        {/* Dynamic Items Grid (جدول الأصناف المرفقة) */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-800">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-xs font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Activity size={14} />
              <span>{isRtl ? 'الأصناف وحركة الكميات المرفقة' : 'Document Items & Quantities'}</span>
            </h4>
            <button
              type="button"
              onClick={handleAddItemRow}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus size={12} />
              <span>{isRtl ? 'إضافة صنف' : 'Add Item'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className={`text-[11px] font-bold border-b ${
                  theme === 'dark' ? 'bg-slate-800/30 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 min-w-[200px]">{isRtl ? 'الصنف المستهدف' : 'Product / Item'}</th>
                  <th className="p-3 w-28">{isRtl ? 'الوحدة' : 'Unit'}</th>
                  <th className="p-3 w-28 text-center">{isRtl ? 'الرصيد المتاح' : 'Available Stock'}</th>
                  <th className="p-3 w-28">{isRtl ? 'الكمية المطلوبة' : 'Quantity'}</th>
                  {docType === 'Receipt' && <th className="p-3 w-32">{isRtl ? 'سعر الشراء (ج.م)' : 'Purchase Price'}</th>}
                  <th className="p-3 min-w-[150px]">{isRtl ? 'ملاحظات الصنف' : 'Item Notes'}</th>
                  <th className="p-3 w-24 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {items.map((item, idx) => {
                  const selectedProd = products.find(p => p.id === item.product_id);
                  const currentStock = sourceWarehouseId && item.product_id 
                    ? InventoryModule.getProductStock(item.product_id, sourceWarehouseId)
                    : 0;

                  return (
                    <tr 
                      key={idx} 
                      className={`text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${
                        errors[`item_product_${idx}`] || errors[`item_qty_${idx}`] ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      {/* Row Index */}
                      <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>

                      {/* Product Smart Searchable Dropdown */}
                      <td className="p-2 relative">
                        <SearchableDropdown
                          label=""
                          placeholder={isRtl ? '-- اختر الصنف --' : '-- Select Product --'}
                          value={item.product_id}
                          list={products.map(p => ({
                            id: p.id,
                            name: p.name,
                            code: p.code,
                            subText: (p.barcode ? `Barcode: ${p.barcode}` : '') + ` | Min: ${p.min_stock}`
                          }))}
                          onSelect={(id) => handleUpdateItemValue(idx, 'product_id', id)}
                          error={errors[`item_product_${idx}`]}
                          typeKey={idx}
                          theme={theme}
                          isRtl={isRtl}
                          activeDropdown={activeDropdown}
                          setActiveDropdown={setActiveDropdown}
                        />
                      </td>

                      {/* Unit (Automatic) */}
                      <td className="p-3 font-medium text-slate-500 dark:text-slate-400">
                        {selectedProd ? selectedProd.unit : <span className="italic text-slate-400">---</span>}
                      </td>

                      {/* Available Balance (Calculated) */}
                      <td className="p-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                        {item.product_id ? (
                          <span className={`px-2 py-0.5 rounded ${
                            currentStock < (selectedProd?.min_stock || 0)
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {currentStock}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">---</span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleUpdateItemValue(idx, 'qty', parseFloat(e.target.value) || 0)}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                          } ${errors[`item_qty_${idx}`] ? 'border-rose-500 ring-2 ring-rose-500/10' : ''}`}
                        />
                        {errors[`item_qty_${idx}`] && <p className="text-[9px] text-rose-500 font-bold mt-1 text-center">{errors[`item_qty_${idx}`]}</p>}
                      </td>

                      {/* Last Purchase Price (only for Receipt) */}
                      {docType === 'Receipt' && (
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.last_purchase_price || 0}
                            onChange={(e) => handleUpdateItemValue(idx, 'last_purchase_price', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </td>
                      )}

                      {/* Notes */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleUpdateItemValue(idx, 'notes', e.target.value)}
                          placeholder={isRtl ? 'مواصفات إضافية...' : 'Item specifications...'}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        />
                      </td>

                      {/* Actions */}
                      <td className="p-2 text-center flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateItemRow(idx)}
                          className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all cursor-pointer"
                          title={isRtl ? 'تكرار الصف' : 'Duplicate Row'}
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItemRow(idx)}
                          className="p-1.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                          title={isRtl ? 'حذف الصف' : 'Delete Row'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes & Comments */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <div>
            <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {isRtl ? 'ملاحظات المستند العامة' : 'General Document Notes'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={isRtl ? 'اكتب أي ملاحظات أو توجيهات إدارية هنا...' : 'Write any other administrative comments or notes here...'}
              className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                theme === 'dark' ? 'bg-[#1e293b] border-[#334155] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
          </div>
        </div>

        {/* Print Signatures Block (مربعات توقيع المستند الورقي) */}
        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-6 mt-8">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-6">
            {isRtl ? 'أختام وتوقيعات اعتماد المستند المخزني' : 'Document Authentication & Signatures'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className={`p-4 rounded-2xl border border-dashed ${theme === 'dark' ? 'border-[#334155]' : 'border-slate-200'}`}>
              <p className="text-xs font-bold">{isRtl ? 'مُعد المستند (أمين المخزن)' : 'Document Creator (Storekeeper)'}</p>
              <div className="h-10 border-b border-slate-200 dark:border-slate-800 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">
                {activeUser?.full_name} | {new Date().toLocaleDateString('en-US')}
              </p>
            </div>
            <div className={`p-4 rounded-2xl border border-dashed ${theme === 'dark' ? 'border-[#334155]' : 'border-slate-200'}`}>
              <p className="text-xs font-bold">{isRtl ? 'المستلم أو الناقل المعتمد' : 'Recipient / Delivery Agent'}</p>
              <div className="h-10 border-b border-slate-200 dark:border-slate-800 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">
                {recipient ? recipient : <span className="italic">---</span>}
              </p>
            </div>
            <div className={`p-4 rounded-2xl border border-dashed ${theme === 'dark' ? 'border-[#334155]' : 'border-slate-200'}`}>
              <p className="text-xs font-bold">{isRtl ? 'الاعتماد النهائي (المدير المسؤول)' : 'Final Approval (Authorizing Manager)'}</p>
              <div className="h-10 border-b border-slate-200 dark:border-slate-800 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">Enterprise Lifecycle Engine Sec</p>
            </div>
          </div>
        </div>
      </div>

      {/* Save / Cancel Controls */}
      <div className="flex items-center justify-end gap-3.5">
        <button
          type="button"
          onClick={onCancel}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {isRtl ? 'إلغاء والعودة' : 'Cancel & Back'}
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-lg shadow-emerald-600/10 active:scale-95 cursor-pointer"
        >
          {docId ? (isRtl ? 'حفظ التغييرات' : 'Save Changes') : (isRtl ? 'حفظ كمسودة' : 'Save Draft')}
        </button>
      </div>
    </form>
  );
}

// Standalone SearchableDropdown Component to maintain stable lifecycle & styling
interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  list: DropdownItem[];
  onSelect: (id: string) => void;
  error?: string;
  typeKey: 'dest' | number;
  theme: 'light' | 'dark';
  isRtl: boolean;
  activeDropdown: { type: 'dest' | number; search: string } | null;
  setActiveDropdown: React.Dispatch<React.SetStateAction<{ type: 'dest' | number; search: string } | null>>;
}

function SearchableDropdown({
  label,
  placeholder,
  value,
  list,
  onSelect,
  error,
  typeKey,
  theme,
  isRtl,
  activeDropdown,
  setActiveDropdown
}: SearchableDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter list based on smart search query
  const filteredList = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return list;
    return list.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.code.toLowerCase().includes(query) ||
      (item.subText && item.subText.toLowerCase().includes(query))
    );
  }, [list, searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setActiveDropdown]);

  const selectedItem = list.find(item => item.id === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && (
        <label className={`block text-xs font-bold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setActiveDropdown(activeDropdown?.type === typeKey ? null : { type: typeKey, search: '' })}
        className={`flex w-full items-center justify-between px-3.5 py-2 border rounded-xl text-xs font-medium text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
          theme === 'dark' 
            ? 'bg-[#1e293b] border-[#334155] text-slate-100 hover:bg-[#334155]/50' 
            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
        } ${error ? 'border-rose-500 ring-2 ring-rose-500/10' : ''}`}
      >
        <span className="truncate">
          {selectedItem ? `${selectedItem.name} [${selectedItem.code}]` : placeholder}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>

      {activeDropdown?.type === typeKey && (
        <div className={`absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border p-2 shadow-xl ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
        }`}>
          <div className="relative flex items-center mb-2 px-1">
            <Search size={14} className="absolute right-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'ابحث بالاسم أو الكود...' : 'Search by name or code...'}
              className={`w-full pr-8 pl-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
              }`}
              autoFocus
            />
          </div>
          
          <div className="space-y-0.5">
            {filteredList.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                {isRtl ? 'لا توجد نتائج مطابقة' : 'No matching results'}
              </div>
            ) : (
              filteredList.map(item => {
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setActiveDropdown(null);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-right ${
                      isSelected 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold' 
                        : theme === 'dark' 
                          ? 'text-slate-300 hover:bg-slate-800' 
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold truncate">{item.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {item.code}
                        </span>
                        {item.subText && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            {item.subText}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-emerald-500 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={10} />{error}</p>}
    </div>
  );
}

