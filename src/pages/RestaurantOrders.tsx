import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  CreditCard, 
  DollarSign, 
  Printer, 
  Users, 
  MapPin, 
  Phone, 
  User, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Utensils, 
  ArrowRight,
  Check,
  X,
  FileText
} from 'lucide-react';
import { CompaniesModule } from '../db/companies';
import { UsersModule } from '../db/users';
import { InventoryModule } from '../db/inventory';
import { RestaurantEngine } from '../db/restaurant';
import { 
  MenuItem, 
  MenuCategory, 
  RestaurantTable, 
  RestaurantOrder, 
  RestaurantOrderItem, 
  OrderType, 
  OrderStatus, 
  PaymentMethod 
} from '../types/restaurant';
import { Language, Theme } from '../types';

interface RestaurantOrdersProps {
  language: Language;
  theme: Theme;
}

export default function RestaurantOrders({ language, theme }: RestaurantOrdersProps) {
  const isRtl = language === 'ar';
  const activeUser = UsersModule.getActiveUser();
  const selectedCompanyId = CompaniesModule.getSelectedCompanyId();

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState<'pos' | 'tables' | 'kitchen'>('pos');

  // Master Data
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  // POS State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<RestaurantOrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [applyVat, setApplyVat] = useState<boolean>(true);

  // Modals & Notifications
  const [receiptModalOrder, setReceiptModalOrder] = useState<RestaurantOrder | null>(null);
  const [isAddTableOpen, setIsAddTableOpen] = useState<boolean>(false);
  const [newTableNumber, setNewTableNumber] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Data
  const loadData = () => {
    if (!selectedCompanyId) return;
    const cats = RestaurantEngine.getCategories(selectedCompanyId);
    const dishes = RestaurantEngine.getMenuItems(selectedCompanyId);
    const tbls = RestaurantEngine.getTables(selectedCompanyId);
    const ords = RestaurantEngine.getOrders(selectedCompanyId);
    const whs = InventoryModule.getWarehouses(selectedCompanyId);

    setCategories(cats);
    setMenuItems(dishes);
    setTables(tbls);
    setOrders(ords);
    setWarehouses(whs);

    if (whs.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(whs[0].id);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('custody_db_updated', handleUpdate);
    return () => window.removeEventListener('custody_db_updated', handleUpdate);
  }, [selectedCompanyId]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Filtered Menu Items
  const filteredDishes = useMemo(() => {
    return menuItems.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category_id === selectedCategory;
      const matchQuery = !searchQuery || 
        item.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.name_en.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery && item.is_available;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart Handlers
  const addToCart = (dish: MenuItem) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(i => i.menu_item_id === dish.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const qty = updated[existingIdx].quantity + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: qty,
          total_price: Number((qty * dish.price).toFixed(2))
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            menu_item_id: dish.id,
            name_ar: dish.name_ar,
            name_en: dish.name_en,
            quantity: 1,
            unit_price: dish.price,
            total_price: dish.price,
            notes: ''
          }
        ];
      }
    });
  };

  const updateCartQuantity = (dishId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.menu_item_id === dishId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            total_price: Number((newQty * item.unit_price).toFixed(2))
          };
        }
        return item;
      }).filter(Boolean) as RestaurantOrderItem[];
    });
  };

  const updateCartItemNote = (dishId: string, note: string) => {
    setCart(prev => prev.map(item => item.menu_item_id === dishId ? { ...item, notes: note } : item));
  };

  const removeFromCart = (dishId: string) => {
    setCart(prev => prev.filter(item => item.menu_item_id !== dishId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedTableId('');
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDiscountAmount(0);
  };

  // Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total_price, 0);
  }, [cart]);

  const vatAmount = useMemo(() => {
    return applyVat ? Number((cartSubtotal * 0.14).toFixed(2)) : 0;
  }, [cartSubtotal, applyVat]);

  const cartTotal = useMemo(() => {
    const total = cartSubtotal + vatAmount - discountAmount;
    return total > 0 ? Number(total.toFixed(2)) : 0;
  }, [cartSubtotal, vatAmount, discountAmount]);

  // Submit Order
  const handleCreateOrder = (targetStatus: OrderStatus = 'pending') => {
    if (cart.length === 0) {
      showNotification('error', isRtl ? 'السلة فارغة! اختر بعض الوجبات أولاً' : 'Cart is empty!');
      return;
    }

    if (orderType === 'dine_in' && !selectedTableId) {
      showNotification('error', isRtl ? 'يرجى اختيار الطاولة للطلبات داخل الصالة' : 'Please select a table for Dine-in orders');
      return;
    }

    if (orderType === 'delivery' && !customerName) {
      showNotification('error', isRtl ? 'يرجى إدخال اسم العميل لطلب الدليفري' : 'Please enter customer name');
      return;
    }

    const selectedTable = tables.find(t => t.id === selectedTableId);

    const newOrder = RestaurantEngine.createOrder({
      company_id: selectedCompanyId,
      order_type: orderType,
      table_id: orderType === 'dine_in' ? selectedTableId : undefined,
      table_number: orderType === 'dine_in' ? selectedTable?.table_number : undefined,
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      delivery_address: deliveryAddress || undefined,
      items: cart,
      status: targetStatus,
      subtotal: cartSubtotal,
      tax: vatAmount,
      discount: discountAmount,
      total: cartTotal,
      payment_method: paymentMethod,
      warehouse_id: selectedWarehouseId,
      created_by: activeUser?.id
    });

    showNotification('success', isRtl ? `تم تسجيل الطلب بنجاح رقم [${newOrder.order_number}]` : `Order created [${newOrder.order_number}]`);
    
    // Automatically trigger thermal invoice view
    setReceiptModalOrder(newOrder);

    clearCart();
    loadData();
  };

  // Kitchen Order Status Advance
  const handleAdvanceOrderStatus = (order: RestaurantOrder, newStatus: OrderStatus) => {
    RestaurantEngine.updateOrderStatus(order.id, newStatus, selectedWarehouseId, activeUser?.id);
    showNotification('success', isRtl ? `تم تحديث حالة الطلب [${order.order_number}] إلى ${getStatusBadgeLabel(newStatus)}` : `Updated order status`);
    loadData();
  };

  // Add Table
  const handleAddTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber) return;
    RestaurantEngine.addTable({
      company_id: selectedCompanyId,
      table_number: newTableNumber,
      capacity: newTableCapacity,
      status: 'available'
    });
    setNewTableNumber('');
    setIsAddTableOpen(false);
    showNotification('success', isRtl ? 'تم إضافة الطاولة بنجاح' : 'Table added successfully');
    loadData();
  };

  const getStatusBadgeLabel = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return isRtl ? 'جديد' : 'New';
      case 'in_kitchen': return isRtl ? 'في المطبخ' : 'In Kitchen';
      case 'ready': return isRtl ? 'جاهز' : 'Ready';
      case 'served': return isRtl ? 'تم التقديم' : 'Served';
      case 'paid': return isRtl ? 'مدفوع' : 'Paid';
      case 'cancelled': return isRtl ? 'ملغي' : 'Cancelled';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'in_kitchen': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'ready': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      case 'served': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'paid': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'cancelled': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 left-6 z-50 p-4 rounded-xl border shadow-2xl flex items-center gap-3 animate-bounce-subtle ${
          notification.type === 'success' 
            ? 'bg-emerald-900/95 border-emerald-500/40 text-emerald-100' 
            : 'bg-rose-900/95 border-rose-500/40 text-rose-100'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-rose-400" />}
          <span className="text-xs font-bold font-sans">{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20">
              <ChefHat className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {isRtl ? 'طلبات المطعم ونقطة البيع (POS)' : 'Restaurant Orders & POS'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl 
                  ? 'إدارة كاشير الطلبات، خريطة الطاولات، والتخصيم التلقائي للمواد الخام من المخزن' 
                  : 'Manage POS orders, floor tables, and automatic raw material stock deduction'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Warehouse Selector */}
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-500" />
              <select
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
                className={`text-xs font-medium px-3 py-2 rounded-xl border transition-colors ${
                  theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tab Switchers */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('pos')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pos'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>{isRtl ? 'نقطة البيع (POS)' : 'POS'}</span>
              </button>

              <button
                onClick={() => setActiveTab('tables')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'tables'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>{isRtl ? 'خريطة الطاولات' : 'Tables Floor'}</span>
                <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {tables.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('kitchen')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'kitchen'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ChefHat className="h-3.5 w-3.5" />
                <span>{isRtl ? 'متابعة المطبخ' : 'Kitchen Kanban'}</span>
                <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {orders.filter(o => o.status !== 'paid' && o.status !== 'cancelled').length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: POINT OF SALE (POS) */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Menu Catalog (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Category Pills & Search */}
            <div className={`p-4 rounded-2xl border ${
              theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? 'بحث باسم الوجبة...' : 'Search dish...'}
                    className={`w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div className="text-xs text-slate-500 font-semibold">
                  {isRtl ? `عدد الأطعمة المتاحة: ${filteredDishes.length}` : `Dishes: ${filteredDishes.length}`}
                </div>
              </div>

              {/* Categories Scrollable Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : theme === 'dark'
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isRtl ? 'الكل' : 'All'}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-600 text-white shadow-md'
                        : theme === 'dark'
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isRtl ? cat.name_ar : cat.name_en}
                  </button>
                ))}
              </div>
            </div>

            {/* Dish Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredDishes.length === 0 ? (
                <div className="col-span-full p-8 text-center text-slate-500 text-xs font-semibold">
                  {isRtl ? 'لا توجد وجبات تطابق البحث' : 'No menu items found'}
                </div>
              ) : (
                filteredDishes.map(dish => (
                  <button
                    key={dish.id}
                    onClick={() => addToCart(dish)}
                    className={`p-3 rounded-2xl border text-right transition-all group hover:scale-[1.02] active:scale-95 cursor-pointer flex flex-col justify-between h-32 ${
                      theme === 'dark' 
                        ? 'bg-[#1e293b] border-[#334155] hover:border-emerald-500/50' 
                        : 'bg-white border-slate-200 hover:border-emerald-500/50 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-lg">
                          {dish.price} EGP
                        </span>
                        <Utensils className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 line-clamp-2">
                        {isRtl ? dish.name_ar : dish.name_en}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>{isRtl ? 'انقر للإضافة' : 'Click to add'}</span>
                      <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        <Plus className="h-3 w-3" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Order Cart & Billing (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className={`p-4 rounded-2xl border flex flex-col h-full ${
              theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              {/* Order Type Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setOrderType('dine_in')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    orderType === 'dine_in' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isRtl ? 'صالة (Dine-in)' : 'Dine-in'}
                </button>
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    orderType === 'takeaway' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isRtl ? 'سفري (Takeaway)' : 'Takeaway'}
                </button>
                <button
                  onClick={() => setOrderType('delivery')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    orderType === 'delivery' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isRtl ? 'دليفري (Delivery)' : 'Delivery'}
                </button>
              </div>

              {/* Order Specific Details */}
              {orderType === 'dine_in' && (
                <div className="mb-4">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isRtl ? 'اختر الطاولة *' : 'Select Table *'}
                  </label>
                  <select
                    value={selectedTableId}
                    onChange={e => setSelectedTableId(e.target.value)}
                    className={`w-full text-xs p-2 rounded-xl border focus:ring-2 focus:ring-emerald-500 ${
                      theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="">{isRtl ? '-- حدد رقم الطاولة --' : '-- Select Table --'}</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.table_number} ({isRtl ? `سعة: ${t.capacity}` : `Capacity: ${t.capacity}`}) - [{t.status === 'available' ? (isRtl ? 'متاحة' : 'Available') : (isRtl ? 'مشغولة' : 'Occupied')}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {orderType === 'delivery' && (
                <div className="grid grid-cols-1 gap-2 mb-4">
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder={isRtl ? 'اسم العميل *' : 'Customer Name *'}
                    className={`text-xs p-2 rounded-xl border ${
                      theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder={isRtl ? 'رقم الهاتف' : 'Phone Number'}
                    className={`text-xs p-2 rounded-xl border ${
                      theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder={isRtl ? 'عنوان التوصيل' : 'Delivery Address'}
                    className={`text-xs p-2 rounded-xl border ${
                      theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              )}

              {/* Cart List */}
              <div className="flex-1 min-h-[220px] max-h-[320px] overflow-y-auto space-y-2 mb-4 pr-1">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 py-8">
                    <ShoppingBag className="h-10 w-10 opacity-40" />
                    <span className="text-xs font-semibold">{isRtl ? 'السلة فارغة. انقر على الأطعمة لإضافتها' : 'Cart is empty'}</span>
                  </div>
                ) : (
                  cart.map(item => (
                    <div
                      key={item.menu_item_id}
                      className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
                        theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {isRtl ? item.name_ar : item.name_en}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.total_price} EGP
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={e => updateCartItemNote(item.menu_item_id, e.target.value)}
                          placeholder={isRtl ? 'ملاحظات الوجبة (مثلاً: بدون بصل)...' : 'Dish notes...'}
                          className="text-[10px] p-1 px-2 rounded-lg border w-full bg-transparent border-slate-200 dark:border-slate-700"
                        />

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => updateCartQuantity(item.menu_item_id, -1)}
                            className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold font-mono px-1.5">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.menu_item_id, 1)}
                            className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.menu_item_id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors mr-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Calculations Summary */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs mb-4">
                <div className="flex justify-between text-slate-500">
                  <span>{isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                  <span className="font-mono font-bold">{cartSubtotal} EGP</span>
                </div>

                <div className="flex justify-between items-center text-slate-500">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyVat}
                      onChange={e => setApplyVat(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{isRtl ? 'ضريبة القيمة المضافة (14%):' : 'VAT (14%):'}</span>
                  </label>
                  <span className="font-mono font-bold">{vatAmount} EGP</span>
                </div>

                <div className="flex justify-between items-center text-slate-500">
                  <span>{isRtl ? 'خصم:' : 'Discount:'}</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount || ''}
                    onChange={e => setDiscountAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-16 p-0.5 text-left text-xs font-mono rounded border bg-transparent text-right border-slate-300 dark:border-slate-700"
                  />
                </div>

                <div className="flex justify-between text-sm font-extrabold text-slate-800 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>{isRtl ? 'الإجمالي النهائي:' : 'Grand Total:'}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{cartTotal} EGP</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-1.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 cursor-pointer ${
                    paymentMethod === 'cash' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{isRtl ? 'نقداً (Cash)' : 'Cash'}</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`py-1.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 cursor-pointer ${
                    paymentMethod === 'card' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>{isRtl ? 'فيزا/بطاقة' : 'Card'}</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('credit')}
                  className={`py-1.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 cursor-pointer ${
                    paymentMethod === 'credit' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <span>{isRtl ? 'حساب آجل' : 'Credit'}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCreateOrder('pending')}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ChefHat className="h-4 w-4" />
                  <span>{isRtl ? 'إرسال للمطبخ' : 'Send to Kitchen'}</span>
                </button>

                <button
                  onClick={() => handleCreateOrder('paid')}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>{isRtl ? 'دفع وطباعة الفاتورة' : 'Pay & Print'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TABLES FLOOR MAP */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                {isRtl ? `متاحة (${tables.filter(t => t.status === 'available').length})` : `Available`}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-500 inline-block" />
                {isRtl ? `مشغولة (${tables.filter(t => t.status === 'occupied').length})` : `Occupied`}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500 inline-block" />
                {isRtl ? `محجوزة (${tables.filter(t => t.status === 'reserved').length})` : `Reserved`}
              </span>
            </div>

            <button
              onClick={() => setIsAddTableOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{isRtl ? 'إضافة طاولة جديدة' : 'Add Table'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tables.map(table => {
              const activeOrder = orders.find(o => o.id === table.current_order_id);
              return (
                <div
                  key={table.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between h-44 relative ${
                    table.status === 'available'
                      ? 'bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/20'
                      : table.status === 'occupied'
                        ? 'bg-rose-500/5 border-rose-500/30 dark:bg-rose-950/20'
                        : 'bg-amber-500/5 border-amber-500/30 dark:bg-amber-950/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        table.status === 'available'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : table.status === 'occupied'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}>
                        {table.status === 'available' ? (isRtl ? 'متاحة' : 'Available') : table.status === 'occupied' ? (isRtl ? 'مشغولة' : 'Occupied') : (isRtl ? 'محجوزة' : 'Reserved')}
                      </span>

                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {table.capacity}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                      {table.table_number}
                    </h3>

                    {table.status === 'occupied' && activeOrder && (
                      <div className="mt-2 text-[11px] space-y-0.5 font-mono text-slate-600 dark:text-slate-300">
                        <div>{activeOrder.order_number}</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{activeOrder.total} EGP</div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800">
                    {table.status === 'available' ? (
                      <button
                        onClick={() => {
                          setSelectedTableId(table.id);
                          setOrderType('dine_in');
                          setActiveTab('pos');
                        }}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] transition-all cursor-pointer"
                      >
                        {isRtl ? 'فتح طلب جديد' : 'New Order'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (activeOrder) setReceiptModalOrder(activeOrder);
                        }}
                        className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[11px] transition-all cursor-pointer"
                      >
                        {isRtl ? 'عرض الطلب / تسوية' : 'View Order'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: KITCHEN KANBAN VIEW */}
      {activeTab === 'kitchen' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['pending', 'in_kitchen', 'ready', 'served'] as OrderStatus[]).map(statusCol => {
            const colOrders = orders.filter(o => o.status === statusCol);
            return (
              <div
                key={statusCol}
                className={`p-3 rounded-2xl border min-h-[500px] flex flex-col ${
                  theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-slate-100/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {getStatusBadgeLabel(statusCol)}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {colOrders.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colOrders.map(order => (
                    <div
                      key={order.id}
                      className={`p-3 rounded-xl border transition-all ${
                        theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">
                          {order.order_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeClass(order.status)}`}>
                          {order.order_type === 'dine_in' ? (order.table_number || (isRtl ? 'صالة' : 'Dine-in')) : order.order_type === 'takeaway' ? (isRtl ? 'سفري' : 'Takeaway') : (isRtl ? 'دليفري' : 'Delivery')}
                        </span>
                      </div>

                      {order.customer_name && (
                        <div className="text-[11px] text-slate-500 font-semibold mb-2">
                          👤 {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ''}
                        </div>
                      )}

                      {/* Items List */}
                      <div className="space-y-1 mb-3 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                            <span>{item.quantity}x {isRtl ? item.name_ar : item.name_en}</span>
                            {item.notes && <span className="text-[10px] text-amber-500">({item.notes})</span>}
                          </div>
                        ))}
                      </div>

                      {/* Raw Material Stock Deduction Status */}
                      <div className="flex items-center justify-between text-[10px] mb-3">
                        <span className="text-slate-400">{isRtl ? 'خصم المخزون:' : 'Stock Deduction:'}</span>
                        {order.is_stock_deducted ? (
                          <span className="text-emerald-500 font-bold flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            {isRtl ? 'تم التخصيم' : 'Deducted'}
                          </span>
                        ) : (
                          <span className="text-amber-500 font-bold">{isRtl ? 'في انتظار الخدمة' : 'Pending'}</span>
                        )}
                      </div>

                      {/* Action buttons to advance status */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {statusCol === 'pending' && (
                          <button
                            onClick={() => handleAdvanceOrderStatus(order, 'in_kitchen')}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] transition-all cursor-pointer"
                          >
                            {isRtl ? 'بدء التحضير' : 'Start Preparing'}
                          </button>
                        )}
                        {statusCol === 'in_kitchen' && (
                          <button
                            onClick={() => handleAdvanceOrderStatus(order, 'ready')}
                            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] transition-all cursor-pointer"
                          >
                            {isRtl ? 'جاهز للتقديم' : 'Mark Ready'}
                          </button>
                        )}
                        {statusCol === 'ready' && (
                          <button
                            onClick={() => handleAdvanceOrderStatus(order, 'served')}
                            className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] transition-all cursor-pointer"
                          >
                            {isRtl ? 'تقديم وتخصيم مخزون' : 'Serve & Deduct'}
                          </button>
                        )}
                        {statusCol === 'served' && (
                          <button
                            onClick={() => handleAdvanceOrderStatus(order, 'paid')}
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-all cursor-pointer"
                          >
                            {isRtl ? 'تحصيل الحساب (إغلاق)' : 'Mark Paid'}
                          </button>
                        )}
                        <button
                          onClick={() => setReceiptModalOrder(order)}
                          className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 transition-colors"
                          title="View Receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD TABLE */}
      {isAddTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {isRtl ? 'إضافة طاولة جديدة' : 'Add New Table'}
              </h3>
              <button onClick={() => setIsAddTableOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'اسم / رقم الطاولة *' : 'Table Number/Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newTableNumber}
                  onChange={e => setNewTableNumber(e.target.value)}
                  placeholder={isRtl ? 'مثلاً: طاولة 7 أو VIP-1' : 'e.g. Table 7'}
                  className={`w-full p-2 text-xs rounded-xl border ${
                    theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'السعة (عدد الأفراد)' : 'Capacity (Seats)'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={newTableCapacity}
                  onChange={e => setNewTableCapacity(Number(e.target.value))}
                  className={`w-full p-2 text-xs rounded-xl border ${
                    theme === 'dark' ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                >
                  {isRtl ? 'حفظ الطاولة' : 'Save Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: THERMAL RECEIPT / INVOICE PREVIEW */}
      {receiptModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm p-6 rounded-2xl border shadow-2xl space-y-4 ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-emerald-500" />
                <span>{isRtl ? 'فاتورة الطلب الحرارية' : 'Thermal Receipt'}</span>
              </h3>
              <button onClick={() => setReceiptModalOrder(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Thermal Receipt Body */}
            <div className="p-4 bg-white text-slate-900 rounded-xl font-mono text-xs border border-slate-200 space-y-3">
              <div className="text-center space-y-1">
                <h2 className="font-extrabold text-sm uppercase">KEMIT RESTAURANT</h2>
                <p className="text-[10px] text-slate-500">{isRtl ? 'فاتورة مبيعات مطعم' : 'Restaurant Invoice'}</p>
                <div className="text-[10px] text-slate-500 font-bold border-t border-b border-dashed border-slate-300 py-1 my-1">
                  {receiptModalOrder.order_number} | {new Date(receiptModalOrder.created_at).toLocaleString()}
                </div>
              </div>

              <div className="text-[11px] space-y-0.5">
                <div>{isRtl ? 'نوع الطلب:' : 'Type:'} <span className="font-bold">{receiptModalOrder.order_type}</span></div>
                {receiptModalOrder.table_number && <div>{isRtl ? 'الطاولة:' : 'Table:'} <span className="font-bold">{receiptModalOrder.table_number}</span></div>}
                {receiptModalOrder.customer_name && <div>{isRtl ? 'العميل:' : 'Customer:'} <span className="font-bold">{receiptModalOrder.customer_name}</span></div>}
              </div>

              <table className="w-full text-right text-[11px] border-t border-b border-slate-300 py-1">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-1">{isRtl ? 'الصنف' : 'Item'}</th>
                    <th className="py-1 text-center">{isRtl ? 'ع' : 'Qty'}</th>
                    <th className="py-1 text-left">{isRtl ? 'إجمالي' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptModalOrder.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-1">{isRtl ? item.name_ar : item.name_en}</td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-left">{item.total_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between">
                  <span>{isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                  <span>{receiptModalOrder.subtotal} EGP</span>
                </div>
                {receiptModalOrder.tax > 0 && (
                  <div className="flex justify-between">
                    <span>{isRtl ? 'ضريبة القيمة المضافة (14%):' : 'VAT:'}</span>
                    <span>{receiptModalOrder.tax} EGP</span>
                  </div>
                )}
                {receiptModalOrder.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>{isRtl ? 'الخصم:' : 'Discount:'}</span>
                    <span>-{receiptModalOrder.discount} EGP</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm border-t border-slate-300 pt-1">
                  <span>{isRtl ? 'الإجمالي:' : 'Total:'}</span>
                  <span>{receiptModalOrder.total} EGP</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                {isRtl ? 'شكراً لزيارتكم! نتمنى لكم وجبة شهية' : 'Thank you for your visit!'}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>{isRtl ? 'طباعة الفاتورة' : 'Print Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
