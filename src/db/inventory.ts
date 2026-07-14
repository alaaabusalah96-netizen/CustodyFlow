import { Warehouse, Product, InventoryDocument, StockMovement, InventoryDocType, InventoryDocStatus } from '../types/inventory';
import { StorageEngine } from './storage';
import { dbSetDoc, dbDeleteDoc, db } from '../firebase';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { SequenceEngine } from '../lib/enterprise/sequence';
import { DocumentLifecycleEngine } from '../lib/enterprise/lifecycle';
import { FsmConfig } from '../types/enterprise';
import { CompaniesModule } from './companies';
import { createBaseMetadata, updateBaseMetadata, createEventEnvelope } from '../lib/enterprise/metadata';
import { AuditLogEngine } from '../lib/enterprise/audit';

// Default seeded warehouses
const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-1',
    name: 'Cairo Main Warehouse (مخزن القاهرة الرئيسي)',
    code: 'WH-CAI-MAIN',
    is_active: true,
    company_id: 'comp-1',
    location: 'Abbassia, Cairo',
    receiving_approval_workflow: true
  },
  {
    id: 'wh-2',
    name: 'Alexandria Delivery Depot (مستودع الإسكندرية)',
    code: 'WH-ALX-DEPOT',
    is_active: true,
    company_id: 'comp-1',
    location: 'Smouha, Alexandria',
    receiving_approval_workflow: false
  },
  {
    id: 'wh-3',
    name: 'Giza Secondary Store (مخزن الجيزة الفرعي)',
    code: 'WH-GIZ-SUB',
    is_active: true,
    company_id: 'comp-1',
    location: 'Haram, Giza',
    receiving_approval_workflow: true
  }
];

// Default seeded products
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Shell Helix Motor Oil 4L (زيت محرك شل هيلكس 4 لتر)',
    code: 'PRD-MTR-01',
    barcode: '5011987249120',
    unit: 'عبوة (Bottle)',
    min_stock: 15,
    last_purchase_price: 1200,
    is_active: true,
    company_id: 'comp-1',
    description: 'زيت تخليقي بالكامل لمحركات البنزين والديزل عالية الأداء'
  },
  {
    id: 'prod-2',
    name: '12V 70Ah Car Battery (بطارية سيارة 12 فولت 70 أمبير)',
    code: 'PRD-BAT-02',
    barcode: '4013110223121',
    unit: 'عدد (Piece)',
    min_stock: 5,
    last_purchase_price: 3500,
    is_active: true,
    company_id: 'comp-1',
    description: 'بطارية سائلة عالية الكفاءة مع ضمان سنة كاملة'
  },
  {
    id: 'prod-3',
    name: 'Bridgestone Tire 205/55R16 (إطار بريدجستون 205/55R16)',
    code: 'PRD-TIR-03',
    barcode: '4902505112345',
    unit: 'عدد (Piece)',
    min_stock: 8,
    last_purchase_price: 4800,
    is_active: true,
    company_id: 'comp-1',
    description: 'إطار صيفي مريح وذو ثبات فائق على السرعات'
  },
  {
    id: 'prod-4',
    name: 'Air Filter (فلتر هواء محرك)',
    code: 'PRD-FIL-04',
    barcode: '4011558231201',
    unit: 'عدد (Piece)',
    min_stock: 20,
    last_purchase_price: 350,
    is_active: true,
    company_id: 'comp-1',
    description: 'فلتر هواء ذو كفاءة تنقية عالية للمحرك'
  },
  {
    id: 'prod-5',
    name: 'Front Brake Pads Set (طقم تيل فرامل أمامي)',
    code: 'PRD-BRK-05',
    barcode: '3286340561234',
    unit: 'طقم (Set)',
    min_stock: 12,
    last_purchase_price: 950,
    is_active: true,
    company_id: 'comp-1',
    description: 'تيل فرامل أمامي ياباني أصلي آمن ومعمر'
  }
];

// Initial pre-seeded Stock Movements to provide some starting inventory
const DEFAULT_MOVEMENTS: StockMovement[] = [
  {
    id: 'm-init-1',
    doc_id: 'init',
    doc_no: 'INITIAL-STOCK-01',
    doc_type: 'Receipt',
    product_id: 'prod-1',
    warehouse_id: 'wh-1',
    qty_change: 100,
    type: 'IN',
    current_balance_after: 100,
    date: '2026-06-01',
    company_id: 'comp-1',
    created_at: '2026-06-01T08:00:00Z',
    created_by: 'system'
  },
  {
    id: 'm-init-2',
    doc_id: 'init',
    doc_no: 'INITIAL-STOCK-01',
    doc_type: 'Receipt',
    product_id: 'prod-2',
    warehouse_id: 'wh-1',
    qty_change: 25,
    type: 'IN',
    current_balance_after: 25,
    date: '2026-06-01',
    company_id: 'comp-1',
    created_at: '2026-06-01T08:00:00Z',
    created_by: 'system'
  },
  {
    id: 'm-init-3',
    doc_id: 'init',
    doc_no: 'INITIAL-STOCK-01',
    doc_type: 'Receipt',
    product_id: 'prod-3',
    warehouse_id: 'wh-1',
    qty_change: 40,
    type: 'IN',
    current_balance_after: 40,
    date: '2026-06-01',
    company_id: 'comp-1',
    created_at: '2026-06-01T08:00:00Z',
    created_by: 'system'
  },
  {
    id: 'm-init-4',
    doc_id: 'init',
    doc_no: 'INITIAL-STOCK-02',
    doc_type: 'Receipt',
    product_id: 'prod-1',
    warehouse_id: 'wh-2',
    qty_change: 50,
    type: 'IN',
    current_balance_after: 50,
    date: '2026-06-01',
    company_id: 'comp-1',
    created_at: '2026-06-01T08:00:00Z',
    created_by: 'system'
  }
];

export class InventoryModule {
  // Warehouses
  static getWarehouses(): Warehouse[] {
    const companyId = CompaniesModule.getSelectedCompanyId();
    let list = StorageEngine.getStored<Warehouse[]>('warehouses', DEFAULT_WAREHOUSES);
    const companyWarehouses = list.filter(w => w.company_id === companyId);
    
    // Check if there's any scrap/obsolete warehouse for this company
    const hasScrapWh = companyWarehouses.some(w => 
      w.name.includes('خردة') || 
      w.name.includes('كهنة') || 
      w.name.toLowerCase().includes('scrap')
    );
    
    if (!hasScrapWh && companyId) {
      // Seed some default scrap/obsolete warehouses as specified by the user!
      const seedScrap: Warehouse[] = [
        {
          id: `wh-scrap-sina-${companyId}`,
          name: 'مخزن خردة/كهنة محطة سينا 2000 (Sina 2000 Scrap Store)',
          code: 'WH-SCRP-SINA',
          is_active: true,
          company_id: companyId,
          location: 'سيناء',
          receiving_approval_workflow: false
        },
        {
          id: `wh-scrap-qad-${companyId}`,
          name: 'مخزن خردة أو كهنة محطة القادسية (Qadisiya Scrap Store)',
          code: 'WH-SCRP-QAD',
          is_active: true,
          company_id: companyId,
          location: 'القادسية',
          receiving_approval_workflow: false
        },
        {
          id: `wh-scrap-alx-${companyId}`,
          name: 'مخزن خردة أو كهنة فرع الإسكندرية (Alexandria Scrap Store)',
          code: 'WH-SCRP-ALX',
          is_active: true,
          company_id: companyId,
          location: 'الإسكندرية',
          receiving_approval_workflow: false
        },
        {
          id: `wh-scrap-giz-${companyId}`,
          name: 'مخزن خردة أو كهنة إدارة الجيزة (Giza Admin Scrap Store)',
          code: 'WH-SCRP-GIZ',
          is_active: true,
          company_id: companyId,
          location: 'الجيزة',
          receiving_approval_workflow: false
        }
      ];
      
      // Save them
      const updatedList = [...list, ...seedScrap];
      StorageEngine.setStored('warehouses', updatedList);
      seedScrap.forEach(w => dbSetDoc('warehouses', w.id, w));
      return [...companyWarehouses, ...seedScrap];
    }
    
    return companyWarehouses;
  }

  static saveWarehouses(list: Warehouse[]): void {
    const all = StorageEngine.getStored<Warehouse[]>('warehouses', DEFAULT_WAREHOUSES);
    const companyId = CompaniesModule.getSelectedCompanyId();
    const filteredOut = all.filter(w => w.company_id !== companyId);
    const combined = [...filteredOut, ...list];
    StorageEngine.setStored('warehouses', combined);
    list.forEach(w => dbSetDoc('warehouses', w.id, w));
  }

  static addWarehouse(warehouse: Omit<Warehouse, 'id' | 'company_id'>): Warehouse {
    const list = InventoryModule.getWarehouses();
    const companyId = CompaniesModule.getSelectedCompanyId();
    const newW: Warehouse = {
      ...warehouse,
      id: `wh-${Date.now()}`,
      company_id: companyId
    };
    list.push(newW);
    InventoryModule.saveWarehouses(list);
    return newW;
  }

  // Products
  static getProducts(): Product[] {
    const companyId = CompaniesModule.getSelectedCompanyId();
    const list = StorageEngine.getStored<Product[]>('products', DEFAULT_PRODUCTS);
    return list.filter(p => p.company_id === companyId);
  }

  static saveProducts(list: Product[]): void {
    const all = StorageEngine.getStored<Product[]>('products', DEFAULT_PRODUCTS);
    const companyId = CompaniesModule.getSelectedCompanyId();
    const filteredOut = all.filter(p => p.company_id !== companyId);
    const combined = [...filteredOut, ...list];
    StorageEngine.setStored('products', combined);
    list.forEach(p => dbSetDoc('products', p.id, p));
  }

  static addProduct(product: Omit<Product, 'id' | 'company_id'>): Product {
    const list = InventoryModule.getProducts();
    const companyId = CompaniesModule.getSelectedCompanyId();
    const newP: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      company_id: companyId
    };
    list.push(newP);
    InventoryModule.saveProducts(list);
    return newP;
  }

  // Documents
  static getInventoryDocuments(): InventoryDocument[] {
    const companyId = CompaniesModule.getSelectedCompanyId();
    const list = StorageEngine.getStored<InventoryDocument[]>('inventory_documents', []);
    return list.filter(d => d.tenantId === companyId);
  }

  static saveInventoryDocuments(list: InventoryDocument[]): void {
    const all = StorageEngine.getStored<InventoryDocument[]>('inventory_documents', []);
    const companyId = CompaniesModule.getSelectedCompanyId();
    const filteredOut = all.filter(d => d.tenantId !== companyId);
    const combined = [...filteredOut, ...list];
    StorageEngine.setStored('inventory_documents', combined);
    list.forEach(d => dbSetDoc('inventory_documents', d.id, d));
  }

  // Stock Movements
  static getStockMovements(): StockMovement[] {
    const companyId = CompaniesModule.getSelectedCompanyId();
    const list = StorageEngine.getStored<StockMovement[]>('stock_movements', DEFAULT_MOVEMENTS);
    return list.filter(m => m.company_id === companyId);
  }

  static saveStockMovements(list: StockMovement[]): void {
    const all = StorageEngine.getStored<StockMovement[]>('stock_movements', DEFAULT_MOVEMENTS);
    const companyId = CompaniesModule.getSelectedCompanyId();
    const filteredOut = all.filter(m => m.company_id !== companyId);
    const combined = [...filteredOut, ...list];
    StorageEngine.setStored('stock_movements', combined);
    list.forEach(m => dbSetDoc('stock_movements', m.id, m));
  }

  /**
   * Helper to compute real-time product stock within a warehouse.
   */
  static getProductStock(productId: string, warehouseId: string): number {
    const movements = InventoryModule.getStockMovements();
    return movements
      .filter(m => m.product_id === productId && m.warehouse_id === warehouseId)
      .reduce((sum, m) => sum + m.qty_change, 0);
  }

  /**
   * Adds an Inventory Document
   */
  static async addInventoryDocument(
    docData: Omit<InventoryDocument, keyof import('../types/enterprise').BaseMetadata | 'id' | 'status' | 'doc_no'>
  ): Promise<InventoryDocument> {
    const companyId = CompaniesModule.getSelectedCompanyId();
    const user = UsersModule.getActiveUser();
    const operatorId = user?.id || 'system';

    // 1. Generate Sequence Number
    let docNo = '';
    const prefix = docData.doc_type.substring(0, 3).toUpperCase();
    try {
      docNo = await SequenceEngine.generateNextSequence(
        db,
        companyId,
        `last_inv_seq_${docData.doc_type}`,
        { prefix, padding: 4, includeYear: true }
      );
    } catch {
      // Fallback in case of database sync error
      docNo = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 2. Prepare metadata
    const metadata = createBaseMetadata(companyId, operatorId);

    // 3. Draft initial status
    // If the warehouse does NOT use Receiving Approval Workflow AND (Receipt or Return), auto-approve directly!
    // Or if the user submitted and warehouse is direct, we can skip Draft and go to Posted.
    // For now, let's start with 'Draft' so user can review/submit.
    const newDoc: InventoryDocument = {
      ...docData,
      ...metadata,
      id: `inv-doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      doc_no: docNo,
      status: 'Draft'
    };

    const documents = InventoryModule.getInventoryDocuments();
    documents.unshift(newDoc);
    InventoryModule.saveInventoryDocuments(documents);

    // Logs
    LogsModule.addLog(
      operatorId,
      user?.full_name || 'System',
      'Create Inventory Document',
      `Created document ${docNo} (${docData.doc_type}) with ${docData.items.length} items.`
    );

    LogsModule.logAudit('INV_DOC_CREATE', `Created inventory document ${docNo}`, {
      id: newDoc.id,
      doc_no: docNo,
      doc_type: docData.doc_type,
      source_warehouse_id: docData.source_warehouse_id
    });

    return newDoc;
  }

  /**
   * Update an existing draft document
   */
  static updateInventoryDocument(docId: string, updates: Partial<InventoryDocument>): void {
    const documents = InventoryModule.getInventoryDocuments();
    const idx = documents.findIndex(d => d.id === docId);
    if (idx !== -1) {
      if (documents[idx].status !== 'Draft') {
        throw new Error('Only Draft documents can be edited.');
      }
      const user = UsersModule.getActiveUser();
      const updatedMetadata = updateBaseMetadata(documents[idx], user?.id || 'system');
      documents[idx] = {
        ...documents[idx],
        ...updates,
        ...updatedMetadata
      };
      InventoryModule.saveInventoryDocuments(documents);

      LogsModule.addLog(
        user?.id || 'system',
        user?.full_name || 'System',
        'Update Inventory Document',
        `Updated draft document ${documents[idx].doc_no}`
      );
    }
  }

  /**
   * Deletes a Draft document
   */
  static deleteInventoryDocument(docId: string): void {
    const documents = InventoryModule.getInventoryDocuments();
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      if (doc.status !== 'Draft') {
        throw new Error('Only Draft documents can be deleted.');
      }
      const filtered = documents.filter(d => d.id !== docId);
      InventoryModule.saveInventoryDocuments(filtered);
      dbDeleteDoc('inventory_documents', docId);

      const user = UsersModule.getActiveUser();
      LogsModule.addLog(
        user?.id || 'system',
        user?.full_name || 'System',
        'Delete Inventory Document',
        `Deleted draft document ${doc.doc_no}`
      );
    }
  }

  /**
   * Document Lifecycle FSM engine transition.
   * Handles state machine and updates stock ledger when reaching 'Posted' or 'Approved'.
   */
  static async triggerLifecycleTransition(
    docId: string,
    event: 'Submit' | 'Approve' | 'Reject' | 'Cancel'
  ): Promise<{ success: boolean; messageAr: string; messageEn: string }> {
    const documents = InventoryModule.getInventoryDocuments();
    const docIndex = documents.findIndex(d => d.id === docId);
    if (docIndex === -1) {
      return { success: false, messageAr: 'المستند غير موجود', messageEn: 'Document not found' };
    }

    const document = documents[docIndex];
    const user = UsersModule.getActiveUser();
    if (!user) {
      return { success: false, messageAr: 'يجب تسجيل الدخول أولاً', messageEn: 'User must be authenticated' };
    }

    // FSM Setup
    const fsmConfig: FsmConfig<InventoryDocStatus, 'Submit' | 'Approve' | 'Reject' | 'Cancel', InventoryDocument> = {
      documentType: 'InventoryDocument',
      initialState: 'Draft',
      states: {
        Draft: { name: 'Draft', labelAr: 'مسودة', labelEn: 'Draft', isInitial: true },
        Pending: { name: 'Pending', labelAr: 'قيد المراجعة', labelEn: 'Pending' },
        Approved: { name: 'Approved', labelAr: 'معتمد', labelEn: 'Approved', isTerminal: true },
        Posted: { name: 'Posted', labelAr: 'مرحل', labelEn: 'Posted', isTerminal: true },
        Rejected: { name: 'Rejected', labelAr: 'مرفوض', labelEn: 'Rejected', isTerminal: true },
        Cancelled: { name: 'Cancelled', labelAr: 'ملغي', labelEn: 'Cancelled', isTerminal: true }
      },
      transitions: [
        {
          event: 'Submit',
          from: 'Draft',
          to: 'Pending',
          labelAr: 'إرسال للاعتماد',
          labelEn: 'Submit for Approval',
          authorizedRoles: ['StationAdmin', 'Admin', 'SystemAdmin']
        },
        {
          event: 'Approve',
          from: 'Pending',
          to: 'Posted', // We'll resolve to Approved or Posted dynamically
          labelAr: 'اعتماد نهائي',
          labelEn: 'Final Approval',
          authorizedRoles: ['Admin', 'RegionalManager', 'SystemAdmin']
        },
        {
          event: 'Reject',
          from: 'Pending',
          to: 'Rejected',
          labelAr: 'رفض المستند',
          labelEn: 'Reject Document',
          authorizedRoles: ['Admin', 'RegionalManager', 'SystemAdmin']
        },
        {
          event: 'Cancel',
          from: 'Draft',
          to: 'Cancelled',
          labelAr: 'إلغاء',
          labelEn: 'Cancel',
          authorizedRoles: ['StationAdmin', 'Admin', 'SystemAdmin']
        },
        {
          event: 'Cancel',
          from: 'Pending',
          to: 'Cancelled',
          labelAr: 'إلغاء',
          labelEn: 'Cancel',
          authorizedRoles: ['Admin', 'RegionalManager', 'SystemAdmin']
        }
      ]
    };

    const fsm = new DocumentLifecycleEngine(fsmConfig);
    const clearance = await fsm.canTransition(document.status, event, user.role, document);
    if (!clearance.can) {
      return { success: false, messageAr: clearance.reasonAr, messageEn: clearance.reasonEn };
    }

    // Determine target state.
    // If the event is 'Approve', let's check the destination state based on the warehouse's configuration.
    // However, if the warehouse does NOT have 'receiving_approval_workflow' or if we want to directly POST,
    // we set state to 'Posted' (Final) and execute the stock ledger updates.
    let nextStatus: InventoryDocStatus = 'Draft';
    if (event === 'Submit') {
      const warehouses = InventoryModule.getWarehouses();
      const warehouse = warehouses.find(w => w.id === document.source_warehouse_id);
      
      // If no receiving approval workflow is required, submit triggers IMMEDIATE Approved/Posted!
      if (warehouse && !warehouse.receiving_approval_workflow) {
        nextStatus = 'Posted';
      } else {
        nextStatus = 'Pending';
      }
    } else if (event === 'Approve') {
      nextStatus = 'Posted';
    } else if (event === 'Reject') {
      nextStatus = 'Rejected';
    } else if (event === 'Cancel') {
      nextStatus = 'Cancelled';
    }

    // Trigger state change
    const updatedMetadata = updateBaseMetadata(document, user.id);
    const updatedDoc: InventoryDocument = {
      ...document,
      status: nextStatus,
      ...updatedMetadata
    };

    // If nextState is 'Posted', we MUST generate stock movements and update stock!
    if (nextStatus === 'Posted') {
      try {
        InventoryModule.generateStockMovementsForDoc(updatedDoc, user.id);
      } catch (err: any) {
        return {
          success: false,
          messageAr: `فشل ترحيل المخزون: ${err.message}`,
          messageEn: `Stock posting failed: ${err.message}`
        };
      }
    }

    documents[docIndex] = updatedDoc;
    InventoryModule.saveInventoryDocuments(documents);

    // Audit Log & Event Log
    LogsModule.addLog(
      user.id,
      user.full_name,
      'Transition Inventory Document',
      `Document ${document.doc_no} transitioned from ${document.status} to ${nextStatus} via ${event}.`
    );

    LogsModule.logAudit('INV_DOC_TRANSITION', `Transitioned document ${document.doc_no} to ${nextStatus}`, {
      id: document.id,
      doc_no: document.doc_no,
      old_status: document.status,
      new_status: nextStatus,
      event
    });

    return {
      success: true,
      messageAr: `تم تنفيذ الإجراء بنجاح: المستند الآن في حالة (${fsmConfig.states[nextStatus]?.labelAr})`,
      messageEn: `Action executed successfully: Document is now (${fsmConfig.states[nextStatus]?.labelEn})`
    };
  }

  /**
   * Generates StockMovement records based on the approved document's details.
   */
  private static generateStockMovementsForDoc(doc: InventoryDocument, operatorId: string): void {
    const movements = InventoryModule.getStockMovements();
    const products = InventoryModule.getProducts();
    const updatedProductsList = [...products];

    doc.items.forEach(item => {
      // Find and update product's last_purchase_price if doc is Receipt
      if (doc.doc_type === 'Receipt' && item.last_purchase_price) {
        const prodIdx = updatedProductsList.findIndex(p => p.id === item.product_id);
        if (prodIdx !== -1) {
          updatedProductsList[prodIdx] = {
            ...updatedProductsList[prodIdx],
            last_purchase_price: item.last_purchase_price
          };
        }
      }

      // Check current stock first to make sure we don't overdraft unless allowed (by default ERP rules)
      const currentStock = InventoryModule.getProductStock(item.product_id, doc.source_warehouse_id);
      
      // Determine qty changes for source warehouse
      let sourceQtyChange = 0;
      let targetQtyChange = 0;

      switch (doc.doc_type) {
        case 'Receipt': // الإضافة
        case 'BranchReturn': // مرتجع من فرع
          sourceQtyChange = item.qty;
          break;

        case 'Issue': // الصرف
        case 'BranchTransfer': // تحويل لفرع
        case 'StationTransfer': // تحويل لمحطة
        case 'SupplierReturn': // مرتجع لمورد
          sourceQtyChange = -item.qty;
          break;

        case 'Damage': // خردة/كهنة
          if (doc.scrap_action === 'IN') {
            sourceQtyChange = item.qty; // إضافة للمخزن عند التكهين
          } else {
            sourceQtyChange = -item.qty; // صرف من المخزن عند بيع الخردة
          }
          break;

        case 'Transfer': // تحويل بين المخازن
          sourceQtyChange = -item.qty;
          targetQtyChange = item.qty;
          break;

        case 'Adjustment': // تسوية جردية
          // In adjustment, row qty is the actual physical count.
          // Therefore, the qty_change needed to reach it is: actual_qty - current_stock
          sourceQtyChange = item.qty - currentStock;
          break;
      }

      // Validate overdraft if negative movement
      if (sourceQtyChange < 0 && (currentStock + sourceQtyChange) < 0) {
        // Allow overdraft for Adjustments, but reject for other documents
        if (doc.doc_type !== 'Adjustment') {
          throw new Error(`عذراً، الرصيد غير كافٍ للصنف ${item.product_name} في المخزن المحدد (الرصيد الحالي: ${currentStock})`);
        }
      }

      // 1. Create movement for source warehouse
      if (sourceQtyChange !== 0) {
        const newBalanceAfter = currentStock + sourceQtyChange;
        const movSource: StockMovement = {
          id: `mov-${Date.now()}-${item.product_id}-source-${Math.floor(Math.random() * 1000)}`,
          doc_id: doc.id,
          doc_no: doc.doc_no,
          doc_type: doc.doc_type,
          product_id: item.product_id,
          warehouse_id: doc.source_warehouse_id,
          qty_change: sourceQtyChange,
          type: sourceQtyChange > 0 ? 'IN' : 'OUT',
          current_balance_after: newBalanceAfter,
          date: doc.date,
          company_id: doc.tenantId,
          created_at: new Date().toISOString(),
          created_by: operatorId
        };
        movements.push(movSource);
      }

      // 2. Create movement for target warehouse if Transfer
      if (doc.doc_type === 'Transfer' && targetQtyChange > 0 && doc.dest_entity_type === 'warehouse') {
        const targetCurrentStock = InventoryModule.getProductStock(item.product_id, doc.dest_entity_id);
        const movTarget: StockMovement = {
          id: `mov-${Date.now()}-${item.product_id}-target-${Math.floor(Math.random() * 1000)}`,
          doc_id: doc.id,
          doc_no: doc.doc_no,
          doc_type: doc.doc_type,
          product_id: item.product_id,
          warehouse_id: doc.dest_entity_id,
          qty_change: targetQtyChange,
          type: 'IN',
          current_balance_after: targetCurrentStock + targetQtyChange,
          date: doc.date,
          company_id: doc.tenantId,
          created_at: new Date().toISOString(),
          created_by: operatorId
        };
        movements.push(movTarget);
      }
    });

    // Save everything in transaction-like batch
    InventoryModule.saveStockMovements(movements);
    InventoryModule.saveProducts(updatedProductsList);
  }
}
