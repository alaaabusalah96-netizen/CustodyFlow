import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, FileText, Check, X, ClipboardList, ShoppingCart, 
  Store, Phone, Mail, MapPin, Hash, ShieldAlert, ArrowLeftRight, Clock,
  Calendar, CheckCircle2, ChevronRight, CornerDownLeft
} from 'lucide-react';
import { PurchasingBusinessEngine } from '../lib/enterprise/purchasing_engine';
import { InventoryModule } from '../db/inventory';
import { UsersModule } from '../db/users';
import { CompaniesModule } from '../db/companies';
import { PurchaseRequest, PurchaseOrder, Vendor, PRItem, POItem } from '../types/purchasing';
import { Product, Warehouse } from '../types/inventory';
import { createEventEnvelope } from '../lib/enterprise/metadata';

interface PurchasingProps {
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
}

export default function Purchasing({ language, theme }: PurchasingProps) {
  const isRtl = language === 'ar';
  const activeUser = UsersModule.getActiveUser();
  const companyId = CompaniesModule.getSelectedCompanyId();

  // Active Tab: 'requests' | 'orders' | 'vendors'
  const [activeTab, setActiveTab] = useState<'requests' | 'orders' | 'vendors'>('requests');

  // Load Data
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Modals & Forms State
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [showReceivePO, setShowReceivePO] = useState<string | null>(null);

  // New Vendor Form
  const [vendorForm, setVendorForm] = useState({
    nameAr: '', nameEn: '', phone: '', email: '', taxNo: '', address: ''
  });

  // New PR Form
  const [prNotes, setPrNotes] = useState('');
  const [prDepartment, setPrDepartment] = useState('');
  const [prItems, setPrItems] = useState<PRItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedEstPrice, setSelectedEstPrice] = useState(0);

  // Selected Warehouse for PO receiving
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');

  // Status message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllData = () => {
    const v = PurchasingBusinessEngine.getVendors(companyId);
    const pr = PurchasingBusinessEngine.getPurchaseRequests(companyId);
    const po = PurchasingBusinessEngine.getPurchaseOrders(companyId);
    const prd = InventoryModule.getProducts();
    const wh = InventoryModule.getWarehouses();

    setVendors(v);
    setRequests(pr);
    setOrders(po);
    setProducts(prd);
    setWarehouses(wh);

    if (wh.length > 0) {
      setReceiveWarehouseId(wh[0].id);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [companyId]);

  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. Submit Vendor
  const handleAddVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.nameAr || !vendorForm.nameEn) {
      triggerFeedback('error', isRtl ? 'يرجى إدخال اسم المورد باللغتين' : 'Please input vendor name in both languages');
      return;
    }

    PurchasingBusinessEngine.addVendor(
      companyId,
      vendorForm.nameAr,
      vendorForm.nameEn,
      vendorForm.phone,
      vendorForm.email,
      vendorForm.taxNo,
      vendorForm.address
    );

    triggerFeedback('success', isRtl ? 'تم تسجيل المورد بنجاح' : 'Vendor registered successfully');
    setVendorForm({ nameAr: '', nameEn: '', phone: '', email: '', taxNo: '', address: '' });
    setShowAddVendor(false);
    loadAllData();
  };

  // 2. PR Item Management
  const handleAddPRItem = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    // Check if already in items
    if (prItems.some(item => item.productId === selectedProductId)) {
      triggerFeedback('error', isRtl ? 'هذا المنتج مضاف بالفعل' : 'Product already added');
      return;
    }

    const newItem: PRItem = {
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      unit: prod.unit,
      qty: selectedQty,
      estimatedPrice: selectedEstPrice || prod.last_purchase_price || 0
    };

    setPrItems([...prItems, newItem]);
    setSelectedProductId('');
    setSelectedQty(1);
    setSelectedEstPrice(0);
  };

  const handleRemovePRItem = (productId: string) => {
    setPrItems(prItems.filter(item => item.productId !== productId));
  };

  // 3. Submit PR
  const handleCreatePR = async () => {
    if (prItems.length === 0) {
      triggerFeedback('error', isRtl ? 'يرجى إضافة صنف واحد على الأقل للطلب' : 'Please add at least one item');
      return;
    }

    const engine = new PurchasingBusinessEngine();
    const event = createEventEnvelope(
      'PR_SUBMITTED',
      companyId,
      companyId,
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      activeUser?.role || 'System',
      {
        requesterId: activeUser?.id || 'system',
        requesterName: activeUser?.full_name || 'System',
        department: prDepartment,
        items: prItems,
        notes: prNotes
      }
    );

    const result = await engine.processEvent(event);
    if (result.success) {
      triggerFeedback('success', isRtl ? result.messageAr : result.messageEn);
      setPrItems([]);
      setPrNotes('');
      setPrDepartment('');
      setShowCreatePR(false);
      loadAllData();
    } else {
      triggerFeedback('error', isRtl ? result.messageAr : result.messageEn);
    }
  };

  // 4. Approve / Reject PR
  const handleApprovePR = async (prId: string) => {
    const engine = new PurchasingBusinessEngine();
    const event = createEventEnvelope(
      'PR_APPROVED',
      companyId,
      companyId,
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      activeUser?.role || 'System',
      { prId }
    );

    const result = await engine.processEvent(event);
    if (result.success) {
      triggerFeedback('success', isRtl ? result.messageAr : result.messageEn);
      loadAllData();
    } else {
      triggerFeedback('error', isRtl ? result.messageAr : result.messageEn);
    }
  };

  const handleRejectPR = async (prId: string) => {
    const engine = new PurchasingBusinessEngine();
    const event = createEventEnvelope(
      'PR_REJECTED',
      companyId,
      companyId,
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      activeUser?.role || 'System',
      { prId }
    );

    const result = await engine.processEvent(event);
    if (result.success) {
      triggerFeedback('success', isRtl ? result.messageAr : result.messageEn);
      loadAllData();
    } else {
      triggerFeedback('error', isRtl ? result.messageAr : result.messageEn);
    }
  };

  // 5. Convert PR to PO (Issue PO)
  const handleConvertPRToPO = async (pr: PurchaseRequest) => {
    if (vendors.length === 0) {
      triggerFeedback('error', isRtl ? 'يرجى تسجيل مورد واحد على الأقل أولاً' : 'Please register at least one vendor first');
      return;
    }

    const defaultVendor = vendors[0];
    const engine = new PurchasingBusinessEngine();
    const event = createEventEnvelope(
      'PO_ISSUED',
      companyId,
      companyId,
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      activeUser?.role || 'System',
      {
        prId: pr.id,
        vendorId: defaultVendor.id,
        items: pr.items.map(it => ({
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          unit: it.unit,
          qty: it.qty,
          unitPrice: it.estimatedPrice
        })),
        notes: `Issued automatically from PR ${pr.prNumber}.`,
        deliveryWarehouseId: warehouses[0]?.id
      }
    );

    const result = await engine.processEvent(event);
    if (result.success) {
      triggerFeedback('success', isRtl ? result.messageAr : result.messageEn);
      setActiveTab('orders');
      loadAllData();
    } else {
      triggerFeedback('error', isRtl ? result.messageAr : result.messageEn);
    }
  };

  // 6. Receive PO Stock
  const handleReceivePO = async (poId: string) => {
    if (!receiveWarehouseId) {
      triggerFeedback('error', isRtl ? 'يرجى تحديد مستودع الاستلام' : 'Please select receiving warehouse');
      return;
    }

    const engine = new PurchasingBusinessEngine();
    const event = createEventEnvelope(
      'PO_RECEIVED',
      companyId,
      companyId,
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      activeUser?.role || 'System',
      {
        poId,
        warehouseId: receiveWarehouseId
      }
    );

    const result = await engine.processEvent(event);
    if (result.success) {
      triggerFeedback('success', isRtl ? result.messageAr : result.messageEn);
      setShowReceivePO(null);
      loadAllData();
    } else {
      triggerFeedback('error', isRtl ? result.messageAr : result.messageEn);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10">
          <ShoppingCart className="h-64 w-64 translate-x-12 translate-y-12" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold">
            <ShoppingCart className="h-3 w-3" />
            {isRtl ? 'موديول المشتريات والتموين' : 'Purchasing & Procurement Module'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
            {isRtl ? 'إدارة التموين والمشتريات' : 'Procurement & Supply Chain'}
          </h1>
          <p className="text-xs sm:text-sm text-indigo-100 max-w-xl leading-relaxed font-semibold">
            {isRtl 
              ? 'إدارة الموردين وطلبات الشراء الداخلية المعتمدة، وإصدار أوامر الشراء المباشرة مع تحديث الأرصدة والقيود تلقائياً.'
              : 'Seamless vendor management, internal purchase requests, binding purchase orders, and automated multi-warehouse stock updates.'}
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
          onClick={() => setActiveTab('requests')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'requests' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          {isRtl ? 'طلبات الشراء (PR)' : 'Purchase Requests'}
          <span className="ml-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
            {requests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'orders' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          {isRtl ? 'أوامر الشراء (PO)' : 'Purchase Orders'}
          <span className="ml-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'vendors' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          {isRtl ? 'دليل الموردين' : 'Vendors Directory'}
          <span className="ml-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
            {vendors.length}
          </span>
        </button>
      </div>

      {/* 1. Purchase Requests Section */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
              {isRtl ? 'سجل طلبات الشراء الداخلية' : 'Purchase Requests Ledger'}
            </h2>
            <button
              onClick={() => setShowCreatePR(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {isRtl ? 'تقديم طلب شراء' : 'New Purchase Request'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {requests.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400">
                <ClipboardList className="h-10 w-10 mx-auto opacity-40 mb-2" />
                <p className="text-xs font-semibold">{isRtl ? 'لا توجد طلبات شراء مسجلة حالياً' : 'No purchase requests recorded yet'}</p>
              </div>
            ) : (
              requests.map((pr) => (
                <div key={pr.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{pr.prNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          pr.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
                          pr.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          {isRtl ? (
                            pr.status === 'APPROVED' ? 'معتمد' : pr.status === 'REJECTED' ? 'مرفوض' : 'قيد الاعتماد'
                          ) : pr.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {pr.date} • {isRtl ? 'بواسطة:' : 'By:'} {pr.requesterName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold">{isRtl ? 'إجمالي المقدر' : 'Total Est.'}</p>
                      <p className="text-sm font-black text-indigo-600">{pr.totalAmount.toLocaleString()} EGP</p>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl space-y-1.5">
                    {pr.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        <span>{item.productName} ({item.qty} {item.unit})</span>
                        <span>{item.estimatedPrice.toLocaleString()} EGP</span>
                      </div>
                    ))}
                  </div>

                  {pr.notes && (
                    <p className="text-xs text-slate-500 font-semibold italic bg-amber-500/5 px-3 py-1.5 rounded-lg">
                      *{isRtl ? 'ملاحظة:' : 'Notes:'} {pr.notes}
                    </p>
                  )}

                  {/* Quick Admin Actions */}
                  {pr.status === 'PENDING_APPROVAL' && (
                    <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <button
                        onClick={() => handleRejectPR(pr.id)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all"
                      >
                        <X className="h-3 w-3" /> {isRtl ? 'رفض' : 'Reject'}
                      </button>
                      <button
                        onClick={() => handleApprovePR(pr.id)}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all"
                      >
                        <Check className="h-3 w-3" /> {isRtl ? 'اعتماد' : 'Approve'}
                      </button>
                    </div>
                  )}

                  {pr.status === 'APPROVED' && (
                    <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
                      <button
                        onClick={() => handleConvertPRToPO(pr)}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {isRtl ? 'توليد أمر توريد PO' : 'Convert to PO'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Purchase Orders Section */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
            {isRtl ? 'أوامر التوريد والشراء الصادرة' : 'Issued Purchase Orders'}
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {orders.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400">
                <ShoppingCart className="h-10 w-10 mx-auto opacity-40 mb-2" />
                <p className="text-xs font-semibold">{isRtl ? 'لا توجد أوامر توريد مسجلة حالياً' : 'No purchase orders issued yet'}</p>
              </div>
            ) : (
              orders.map((po) => (
                <div key={po.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{po.poNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          po.status === 'RECEIVED' ? 'bg-emerald-500/10 text-emerald-500' :
                          'bg-sky-500/10 text-sky-500'
                        }`}>
                          {isRtl ? (
                            po.status === 'RECEIVED' ? 'تم الاستلام' : 'صادر للمورد'
                          ) : po.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {po.date} • {isRtl ? 'المورد:' : 'Supplier:'} <span className="text-indigo-600 font-extrabold">{po.vendorName}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold">{isRtl ? 'قيمة الأمر الإجمالية' : 'PO Value'}</p>
                      <p className="text-sm font-black text-emerald-600">{po.totalAmount.toLocaleString()} EGP</p>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl space-y-1.5">
                    {po.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        <span>{item.productName} ({item.qty} {item.unit})</span>
                        <span>{item.totalPrice.toLocaleString()} EGP</span>
                      </div>
                    ))}
                  </div>

                  {po.status === 'ISSUED' && (
                    <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
                      <button
                        onClick={() => setShowReceivePO(po.id)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {isRtl ? 'إثبات الاستلام في المخازن' : 'Log Warehouse Receipt'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. Vendors Section */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
              {isRtl ? 'قائمة الموردين المعتمدين' : 'Approved Vendors Register'}
            </h2>
            <button
              onClick={() => setShowAddVendor(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {isRtl ? 'إضافة مورد جديد' : 'Add New Supplier'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400 col-span-full">
                <Store className="h-10 w-10 mx-auto opacity-40 mb-2" />
                <p className="text-xs font-semibold">{isRtl ? 'لا يوجد موردون مسجلون حالياً' : 'No registered vendors yet'}</p>
              </div>
            ) : (
              vendors.map((v) => (
                <div key={v.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {isRtl ? v.nameAr : v.nameEn}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold">{v.code}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 font-semibold">
                    {v.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" /> {v.phone}
                      </p>
                    )}
                    {v.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-400" /> {v.email}
                      </p>
                    )}
                    {v.taxNo && (
                      <p className="flex items-center gap-1.5">
                        <Hash className="h-3 w-3 text-slate-400" /> {isRtl ? 'سجل ضريبي:' : 'Tax No:'} {v.taxNo}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: Create Purchase Request */}
      {showCreatePR && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              {isRtl ? 'تعبئة طلب شراء جديد' : 'Initiate New Purchase Request'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'القسم / الإدارة الطالبة' : 'Requesting Department'}</label>
                <input
                  type="text"
                  value={prDepartment}
                  onChange={(e) => setPrDepartment(e.target.value)}
                  placeholder={isRtl ? 'مثال: محطة وقود العباسية' : 'e.g. Abbassia Fuel Station'}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Add Item Subsection */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'إضافة صنف إلى السلة' : 'Add Item to Cart'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                  >
                    <option value="">{isRtl ? 'اختر صنفاً...' : 'Select product...'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder={isRtl ? 'الكمية' : 'Qty'}
                    className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                  />

                  <input
                    type="number"
                    value={selectedEstPrice}
                    onChange={(e) => setSelectedEstPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder={isRtl ? 'سعر تقديري' : 'Est Price'}
                    className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddPRItem}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                >
                  {isRtl ? 'تأكيد إضافة الصنف' : 'Add to items list'}
                </button>
              </div>

              {/* Display items added */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'قائمة الأصناف المضافة' : 'Cart Items'}</label>
                {prItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">{isRtl ? 'لم تضف أي أصناف بعد' : 'No items added yet'}</p>
                ) : (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 space-y-1.5 bg-slate-50 dark:bg-slate-950">
                    {prItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>{item.productName} ({item.qty} {item.unit}) @ {item.estimatedPrice} EGP</span>
                        <button
                          onClick={() => handleRemovePRItem(item.productId)}
                          className="text-rose-500 hover:text-rose-600 text-[10px]"
                        >
                          {isRtl ? 'إزالة' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'ملاحظات إضافية' : 'Procurement Notes'}</label>
                <textarea
                  value={prNotes}
                  onChange={(e) => setPrNotes(e.target.value)}
                  placeholder={isRtl ? 'تفاصيل تسليم البضاعة أو متطلبات الجودة...' : 'Add delivery conditions or specifications...'}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent focus:ring-2 focus:ring-indigo-500 h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowCreatePR(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleCreatePR}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {isRtl ? 'إرسال للاعتماد' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Receive Goods */}
      {showReceivePO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-500" />
              {isRtl ? 'إثبات استلام وتوريد البضاعة' : 'Verify PO Delivery & Storage'}
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              {isRtl 
                ? 'سيقوم النظام آلياً بإدخال الكميات المذكورة في شحنة التوريد إلى المستودع المختار، وترحيل قيود الدائن والمدين المحاسبية لحسابات المورد المعتمدة.'
                : 'This will automatically deposit the PO items into the selected destination warehouse, and generate standard balanced ledger entries matching AP rules.'}
            </p>

            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'مستودع الوجهة للاستلام' : 'Select Destination Warehouse'}</label>
              <select
                value={receiveWarehouseId}
                onChange={(e) => setReceiveWarehouseId(e.target.value)}
                className="w-full mt-1.5 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
              >
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowReceivePO(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleReceivePO(showReceivePO)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {isRtl ? 'تأكيد التوريد والاستلام' : 'Confirm & Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Register Vendor */}
      {showAddVendor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddVendor} className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              {isRtl ? 'إضافة مورد جديد لقاعدة البيانات' : 'Register New Vendor'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'الاسم باللغة العربية' : 'Arabic Name'}</label>
                <input
                  type="text"
                  required
                  value={vendorForm.nameAr}
                  onChange={(e) => setVendorForm({ ...vendorForm, nameAr: e.target.value })}
                  placeholder="مثال: شركة النيل لزيوت البترول"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'الاسم باللغة الإنجليزية' : 'English Name'}</label>
                <input
                  type="text"
                  required
                  value={vendorForm.nameEn}
                  onChange={(e) => setVendorForm({ ...vendorForm, nameEn: e.target.value })}
                  placeholder="e.g. Nile Petroleum Oils Company"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'رقم الهاتف' : 'Phone'}</label>
                  <input
                    type="text"
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'الرقم الضريبي' : 'Tax Registration'}</label>
                  <input
                    type="text"
                    value={vendorForm.taxNo}
                    onChange={(e) => setVendorForm({ ...vendorForm, taxNo: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</label>
                <input
                  type="email"
                  value={vendorForm.email}
                  onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">{isRtl ? 'الموقع والعنوان الرئيسي' : 'Main Office Address'}</label>
                <input
                  type="text"
                  value={vendorForm.address}
                  onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowAddVendor(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {isRtl ? 'تأكيد التسجيل' : 'Confirm Registration'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
