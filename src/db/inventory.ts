import { Warehouse, Product, InventoryDocument, StockMovement, InventoryDocType, InventoryDocStatus, InventoryLedgerEntry, WarehouseBin } from '../types/inventory';
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
      
      // Save them asynchronously to avoid side-effects during render
      setTimeout(() => {
        try {
          const currentAll = StorageEngine.getStored<Warehouse[]>('warehouses', DEFAULT_WAREHOUSES);
          const hasScrapNow = currentAll.some(w => w.company_id === companyId && (
            w.name.includes('خردة') || w.name.includes('كهنة') || w.name.toLowerCase().includes('scrap')
          ));
          if (!hasScrapNow) {
            const updatedList = [...currentAll, ...seedScrap];
            StorageEngine.setStored('warehouses', updatedList);
            seedScrap.forEach(w => dbSetDoc('warehouses', w.id, w));
          }
        } catch (e) {
          console.error('Error seeding scrap warehouses:', e);
        }
      }, 0);
      
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

  // Warehouse Bins (Phase 3)
  static getWarehouseBins(warehouseId?: string): WarehouseBin[] {
    const list = StorageEngine.getStored<WarehouseBin[]>('warehouse_bins', []);
    if (warehouseId) {
      return list.filter(b => b.warehouse_id === warehouseId);
    }
    return list;
  }

  static saveWarehouseBins(bins: WarehouseBin[]): void {
    StorageEngine.setStored('warehouse_bins', bins);
    bins.forEach(b => dbSetDoc('warehouse_bins', b.id, b));
  }

  static addWarehouseBin(bin: Omit<WarehouseBin, 'id'>): WarehouseBin {
    const list = StorageEngine.getStored<WarehouseBin[]>('warehouse_bins', []);
    const newBin: WarehouseBin = {
      ...bin,
      id: `bin-${Date.now()}`
    };
    list.push(newBin);
    InventoryModule.saveWarehouseBins(list);
    return newBin;
  }

  static updateWarehouseBin(binId: string, updates: Partial<WarehouseBin>): void {
    const list = StorageEngine.getStored<WarehouseBin[]>('warehouse_bins', []);
    const idx = list.findIndex(b => b.id === binId);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...updates
      };
      InventoryModule.saveWarehouseBins(list);
    }
  }

  static deleteWarehouseBin(binId: string): void {
    const list = StorageEngine.getStored<WarehouseBin[]>('warehouse_bins', []);
    const filtered = list.filter(b => b.id !== binId);
    InventoryModule.saveWarehouseBins(filtered);
    dbDeleteDoc('warehouse_bins', binId);
  }

  // Stock tracking at Bin Level
  static getBinProductStock(productId: string, binId: string): number {
    const movements = InventoryModule.getStockMovements();
    return movements
      .filter(m => m.product_id === productId && m.bin_id === binId)
      .reduce((sum, m) => sum + m.qty_change, 0);
  }

  static getBinTotalStock(binId: string): number {
    const movements = InventoryModule.getStockMovements();
    return movements
      .filter(m => m.bin_id === binId)
      .reduce((sum, m) => sum + m.qty_change, 0);
  }

  static getWarehouseTotalStock(warehouseId: string): number {
    const movements = InventoryModule.getStockMovements();
    return movements
      .filter(m => m.warehouse_id === warehouseId)
      .reduce((sum, m) => sum + m.qty_change, 0);
  }

  // Relocation: Move stock internally between bins in the same warehouse
  static relocateBinStock(
    companyId: string,
    warehouseId: string,
    productId: string,
    fromBinId: string,
    toBinId: string,
    qty: number
  ): { success: boolean; messageAr: string; messageEn: string } {
    if (qty <= 0) {
      return {
        success: false,
        messageAr: 'يجب أن تكون الكمية أكبر من الصفر',
        messageEn: 'Quantity must be greater than zero'
      };
    }

    // Verify source bin stock
    const sourceStock = InventoryModule.getBinProductStock(productId, fromBinId);
    if (sourceStock < qty) {
      return {
        success: false,
        messageAr: 'عذراً، رصيد الحاوية المصدر غير كافٍ لإتمام عملية النقل',
        messageEn: 'Sorry, the source bin does not have enough stock to complete the transfer'
      };
    }

    const bins = InventoryModule.getWarehouseBins(warehouseId);
    const sourceBin = bins.find(b => b.id === fromBinId);
    const destBin = bins.find(b => b.id === toBinId);

    if (!sourceBin || !destBin) {
      return {
        success: false,
        messageAr: 'الحاوية المحددة غير موجودة في هذا المستودع',
        messageEn: 'The specified bin was not found in this warehouse'
      };
    }

    // Validate capacity on destination bin
    const destCurrentStock = InventoryModule.getBinTotalStock(toBinId);
    if (destBin.max_capacity_qty && (destCurrentStock + qty) > destBin.max_capacity_qty) {
      return {
        success: false,
        messageAr: `عذراً، عملية النقل تتجاوز السعة القصوى للحاوية المستهدفة (${destBin.name}). السعة المتاحة: ${destBin.max_capacity_qty - destCurrentStock} وحدة.`,
        messageEn: `Sorry, this relocation exceeds the maximum capacity of target bin (${destBin.name}). Available capacity: ${destBin.max_capacity_qty - destCurrentStock} units.`
      };
    }

    const user = UsersModule.getActiveUser();
    const operatorId = user?.id || 'system';
    const userName = user?.full_name || 'System';

    const movements = InventoryModule.getStockMovements();
    const ledgerEntries = InventoryModule.getInventoryLedger();

    // 1. Negative movement from source bin
    const movFromId = `mov-${Date.now()}-${productId}-reloc-out-${Math.floor(Math.random() * 1000)}`;
    const movFrom: StockMovement = {
      id: movFromId,
      doc_id: `reloc-${Date.now()}`,
      doc_no: `RELOC-${Date.now()}`,
      doc_type: 'Adjustment', // adjustment-type stock record
      product_id: productId,
      warehouse_id: warehouseId,
      qty_change: -qty,
      type: 'OUT',
      current_balance_after: InventoryModule.getProductStock(productId, warehouseId) - qty,
      date: new Date().toISOString().split('T')[0],
      company_id: companyId,
      created_at: new Date().toISOString(),
      created_by: operatorId,
      bin_id: fromBinId,
      bin_code: sourceBin.code
    };

    // 2. Positive movement to destination bin
    const movToId = `mov-${Date.now()}-${productId}-reloc-in-${Math.floor(Math.random() * 1000)}`;
    const movTo: StockMovement = {
      id: movToId,
      doc_id: movFrom.doc_id,
      doc_no: movFrom.doc_no,
      doc_type: 'Adjustment',
      product_id: productId,
      warehouse_id: warehouseId,
      qty_change: qty,
      type: 'IN',
      current_balance_after: InventoryModule.getProductStock(productId, warehouseId),
      date: movFrom.date,
      company_id: companyId,
      created_at: new Date().toISOString(),
      created_by: operatorId,
      bin_id: toBinId,
      bin_code: destBin.code
    };

    movements.push(movFrom, movTo);

    // Ledger records
    const ledFrom: InventoryLedgerEntry = {
      id: `led-${Date.now()}-${productId}-reloc-out-${Math.floor(Math.random() * 1000)}`,
      company_id: companyId,
      warehouse_id: warehouseId,
      product_id: productId,
      transaction_type: 'Bin Relocation (Out)',
      reference_document_id: movFrom.doc_id,
      reference_document_no: movFrom.doc_no,
      qty_in: 0,
      qty_out: qty,
      balance_before: InventoryModule.getProductStock(productId, warehouseId),
      balance_after: InventoryModule.getProductStock(productId, warehouseId) - qty,
      unit_cost: 0,
      running_cost: 0,
      timestamp: new Date().toISOString(),
      user_id: operatorId,
      user_name: userName,
      audit_ref: `${movFrom.doc_no}-LEDGER`,
      bin_id: fromBinId,
      bin_code: sourceBin.code
    };

    const ledTo: InventoryLedgerEntry = {
      id: `led-${Date.now()}-${productId}-reloc-in-${Math.floor(Math.random() * 1000)}`,
      company_id: companyId,
      warehouse_id: warehouseId,
      product_id: productId,
      transaction_type: 'Bin Relocation (In)',
      reference_document_id: movTo.doc_id,
      reference_document_no: movTo.doc_no,
      qty_in: qty,
      qty_out: 0,
      balance_before: InventoryModule.getProductStock(productId, warehouseId) - qty,
      balance_after: InventoryModule.getProductStock(productId, warehouseId),
      unit_cost: 0,
      running_cost: 0,
      timestamp: new Date().toISOString(),
      user_id: operatorId,
      user_name: userName,
      audit_ref: `${movTo.doc_no}-LEDGER`,
      bin_id: toBinId,
      bin_code: destBin.code
    };

    ledgerEntries.push(ledFrom, ledTo);

    InventoryModule.saveStockMovements(movements);
    InventoryModule.saveInventoryLedger(ledgerEntries);

    LogsModule.addLog(
      operatorId,
      userName,
      'Internal Bin Relocation',
      `Moved ${qty} units of item ${productId} from Bin ${sourceBin.code} to Bin ${destBin.code} inside warehouse ${warehouseId}.`
    );

    return {
      success: true,
      messageAr: 'تم نقل المخزون داخلياً بين الحاويات بنجاح',
      messageEn: 'Internal bin stock relocation completed successfully'
    };
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

  // Ledger Entries
  static getInventoryLedger(): InventoryLedgerEntry[] {
    const companyId = CompaniesModule.getSelectedCompanyId();
    const defaultLedger: InventoryLedgerEntry[] = [
      {
        id: 'led-init-1',
        company_id: 'comp-1',
        warehouse_id: 'wh-1',
        product_id: 'prod-1',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-01',
        qty_in: 100,
        qty_out: 0,
        balance_before: 0,
        balance_after: 100,
        unit_cost: 1200,
        running_cost: 120000,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-01'
      },
      {
        id: 'led-init-2',
        company_id: 'comp-1',
        warehouse_id: 'wh-1',
        product_id: 'prod-2',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-01',
        qty_in: 25,
        qty_out: 0,
        balance_before: 0,
        balance_after: 25,
        unit_cost: 3500,
        running_cost: 87500,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-01'
      },
      {
        id: 'led-init-3',
        company_id: 'comp-1',
        warehouse_id: 'wh-1',
        product_id: 'prod-3',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-01',
        qty_in: 40,
        qty_out: 0,
        balance_before: 0,
        balance_after: 40,
        unit_cost: 4800,
        running_cost: 192000,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-01'
      },
      {
        id: 'led-init-4',
        company_id: 'comp-1',
        warehouse_id: 'wh-2',
        product_id: 'prod-1',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-02',
        qty_in: 50,
        qty_out: 0,
        balance_before: 0,
        balance_after: 50,
        unit_cost: 1200,
        running_cost: 60000,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-02'
      }
    ];
    const list = StorageEngine.getStored<InventoryLedgerEntry[]>('inventory_ledger', defaultLedger);
    return list.filter(entry => entry.company_id === companyId);
  }

  static saveInventoryLedger(list: InventoryLedgerEntry[]): void {
    const companyId = CompaniesModule.getSelectedCompanyId();
    const all = StorageEngine.getStored<InventoryLedgerEntry[]>('inventory_ledger', []);
    
    // In case storage was completely empty, seed the defaults
    const initialList = all.length === 0 ? [
      {
        id: 'led-init-1',
        company_id: 'comp-1',
        warehouse_id: 'wh-1',
        product_id: 'prod-1',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-01',
        qty_in: 100,
        qty_out: 0,
        balance_before: 0,
        balance_after: 100,
        unit_cost: 1200,
        running_cost: 120000,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-01'
      },
      {
        id: 'led-init-2',
        company_id: 'comp-1',
        warehouse_id: 'wh-1',
        product_id: 'prod-2',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-01',
        qty_in: 25,
        qty_out: 0,
        balance_before: 0,
        balance_after: 25,
        unit_cost: 3500,
        running_cost: 87500,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-01'
      },
      {
        id: 'led-init-3',
        company_id: 'comp-1',
        warehouse_id: 'wh-1',
        product_id: 'prod-3',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-01',
        qty_in: 40,
        qty_out: 0,
        balance_before: 0,
        balance_after: 40,
        unit_cost: 4800,
        running_cost: 192000,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-01'
      },
      {
        id: 'led-init-4',
        company_id: 'comp-1',
        warehouse_id: 'wh-2',
        product_id: 'prod-1',
        transaction_type: 'Receipt',
        reference_document_id: 'init',
        reference_document_no: 'INITIAL-STOCK-02',
        qty_in: 50,
        qty_out: 0,
        balance_before: 0,
        balance_after: 50,
        unit_cost: 1200,
        running_cost: 60000,
        timestamp: '2026-06-01T08:00:00Z',
        user_id: 'system',
        user_name: 'System',
        audit_ref: 'INITIAL-STOCK-02'
      }
    ] : all;

    const filteredOut = initialList.filter(entry => entry.company_id !== companyId);
    const combined = [...filteredOut, ...list];
    StorageEngine.setStored('inventory_ledger', combined);
    list.forEach(entry => dbSetDoc('inventory_ledger', entry.id, entry));
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
    event: 'Submit' | 'Approve' | 'Reject' | 'Cancel' | 'Receive'
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
    const fsmConfig: FsmConfig<InventoryDocStatus, 'Submit' | 'Approve' | 'Reject' | 'Cancel' | 'Receive', InventoryDocument> = {
      documentType: 'InventoryDocument',
      initialState: 'Draft',
      states: {
        Draft: { name: 'Draft', labelAr: 'مسودة', labelEn: 'Draft', isInitial: true },
        Pending: { name: 'Pending', labelAr: 'قيد المراجعة', labelEn: 'Pending' },
        Dispatched: { name: 'Dispatched', labelAr: 'مشحون قيد النقل', labelEn: 'Dispatched / In-Transit' },
        Approved: { name: 'Approved', labelAr: 'معتمد', labelEn: 'Approved', isTerminal: true },
        Posted: { name: 'Posted', labelAr: 'مرحل / مستلم', labelEn: 'Posted', isTerminal: true },
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
          to: 'Posted', // We'll resolve dynamically below
          labelAr: 'اعتماد نهائي',
          labelEn: 'Final Approval',
          authorizedRoles: ['Admin', 'RegionalManager', 'SystemAdmin']
        },
        {
          event: 'Receive',
          from: 'Dispatched',
          to: 'Posted',
          labelAr: 'تأكيد الاستلام والترخيص',
          labelEn: 'Confirm Receipt & Authorize',
          authorizedRoles: ['Admin', 'RegionalManager', 'SystemAdmin', 'Storekeeper', 'StationAdmin']
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
      
      // If no receiving approval workflow is required, submit triggers IMMEDIATE Approved/Posted (or Dispatched for Transfers)!
      if (warehouse && !warehouse.receiving_approval_workflow) {
        if (document.doc_type === 'Transfer' || document.doc_type === 'BranchTransfer' || document.doc_type === 'StationTransfer') {
          nextStatus = 'Dispatched';
        } else {
          nextStatus = 'Posted';
        }
      } else {
        nextStatus = 'Pending';
      }
    } else if (event === 'Approve') {
      if (document.doc_type === 'Transfer' || document.doc_type === 'BranchTransfer' || document.doc_type === 'StationTransfer') {
        nextStatus = 'Dispatched';
      } else {
        nextStatus = 'Posted';
      }
    } else if (event === 'Receive') {
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

    // Validate capacities and simple overdrafts before executing transitions that generate stock records
    if (nextStatus === 'Dispatched' || nextStatus === 'Posted') {
      const valResult = InventoryModule.validateCapacityAndOverdraft(updatedDoc, nextStatus);
      if (!valResult.success) {
        return valResult;
      }
    }

    // If nextState is 'Dispatched', we generate dispatch stock movements (source warehouse deduction)
    if (nextStatus === 'Dispatched') {
      try {
        InventoryModule.generateStockMovementsForDoc(updatedDoc, user.id, 'Dispatched');
      } catch (err: any) {
        return {
          success: false,
          messageAr: `فشل ترحيل شحنة التحويل: ${err.message}`,
          messageEn: `Transfer dispatch posting failed: ${err.message}`
        };
      }
    }

    // If nextState is 'Posted', we generate stock movements and update stock!
    if (nextStatus === 'Posted') {
      try {
        InventoryModule.generateStockMovementsForDoc(updatedDoc, user.id, 'Posted');
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
  private static generateStockMovementsForDoc(
    doc: InventoryDocument, 
    operatorId: string, 
    stage: 'Dispatched' | 'Posted' = 'Posted'
  ): void {
    const movements = InventoryModule.getStockMovements();
    const ledgerEntries = InventoryModule.getInventoryLedger();
    const products = InventoryModule.getProducts();
    const updatedProductsList = [...products];
    const activeUser = UsersModule.getActiveUser();
    const userName = activeUser?.full_name || 'System';

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

      const isTransferType = doc.doc_type === 'Transfer' || doc.doc_type === 'BranchTransfer' || doc.doc_type === 'StationTransfer';

      if (isTransferType) {
        // If we are at 'Posted' stage, check if we already did the source deduction during 'Dispatched' stage
        const existingMovements = movements.filter(m => m.doc_id === doc.id);
        const isTwoStepFlow = existingMovements.some(m => m.qty_change < 0);

        if (stage === 'Dispatched') {
          // STEP 1: Dispatched (Out from Source)
          sourceQtyChange = -item.qty;
        } else if (stage === 'Posted') {
          // STEP 2: Posted (In to Destination)
          const qtyReceived = item.qty_received !== undefined ? item.qty_received : item.qty;
          targetQtyChange = qtyReceived;
          if (!isTwoStepFlow) {
            // Backward-compatible: If it wasn't dispatched first, do source deduction now too!
            sourceQtyChange = -item.qty;
          }
        }
      } else {
        // Simple/other documents processed entirely at 'Posted' stage
        if (stage === 'Posted') {
          switch (doc.doc_type) {
            case 'Receipt': // الإضافة
            case 'BranchReturn': // مرتجع من فرع
              sourceQtyChange = item.qty;
              break;

            case 'Issue': // الصرف
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

            case 'Adjustment': // تسوية جردية
              sourceQtyChange = item.qty - currentStock;
              break;
          }
        }
      }

      // Validate overdraft if negative movement
      if (sourceQtyChange < 0 && (currentStock + sourceQtyChange) < 0) {
        // Allow overdraft for Adjustments, but reject for other documents
        if (doc.doc_type !== 'Adjustment') {
          throw new Error(`عذراً، الرصيد غير كافٍ للصنف ${item.product_name} في المخزن المحدد (الرصيد الحالي: ${currentStock})`);
        }
      }

      const prod = products.find(p => p.id === item.product_id);
      const unit_cost = item.last_purchase_price || prod?.last_purchase_price || 0;

      // 1. Create movement for source warehouse
      if (sourceQtyChange !== 0) {
        const allocations = item.bin_allocations || [];
        if (allocations.length > 0) {
          // SPLIT BY BINS
          let runningStock = currentStock;
          allocations.forEach((alloc, allocIdx) => {
            const signedAllocQty = sourceQtyChange > 0 ? alloc.qty : -alloc.qty;
            const newBalanceAfter = runningStock + signedAllocQty;
            
            const movSource: StockMovement = {
              id: `mov-${Date.now()}-${item.product_id}-source-bin-${alloc.bin_id}-${Math.floor(Math.random() * 1000)}`,
              doc_id: doc.id,
              doc_no: doc.doc_no,
              doc_type: doc.doc_type,
              product_id: item.product_id,
              warehouse_id: doc.source_warehouse_id,
              qty_change: signedAllocQty,
              type: signedAllocQty > 0 ? 'IN' : 'OUT',
              current_balance_after: newBalanceAfter,
              date: doc.date,
              company_id: doc.tenantId,
              created_at: new Date().toISOString(),
              created_by: operatorId,
              bin_id: alloc.bin_id,
              bin_code: alloc.bin_code
            };
            movements.push(movSource);

            const ledgerSource: InventoryLedgerEntry = {
              id: `led-${Date.now()}-${item.product_id}-source-bin-${alloc.bin_id}-${Math.floor(Math.random() * 1000)}`,
              company_id: doc.tenantId,
              warehouse_id: doc.source_warehouse_id,
              product_id: item.product_id,
              transaction_type: isTransferType ? `${doc.doc_type} - Dispatched (Bin)` : `${doc.doc_type} (Bin)`,
              reference_document_id: doc.id,
              reference_document_no: doc.doc_no,
              qty_in: signedAllocQty > 0 ? signedAllocQty : 0,
              qty_out: signedAllocQty < 0 ? Math.abs(signedAllocQty) : 0,
              balance_before: runningStock,
              balance_after: newBalanceAfter,
              unit_cost,
              running_cost: newBalanceAfter * unit_cost,
              timestamp: new Date().toISOString(),
              user_id: operatorId,
              user_name: userName,
              audit_ref: `${doc.doc_no}-LEDGER`,
              bin_id: alloc.bin_id,
              bin_code: alloc.bin_code
            };
            ledgerEntries.push(ledgerSource);
            runningStock = newBalanceAfter;
          });
        } else {
          // Standard warehouse overall transaction
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

          // CREATE SOURCE LEDGER ENTRY
          const ledgerSource: InventoryLedgerEntry = {
            id: `led-${Date.now()}-${item.product_id}-source-${Math.floor(Math.random() * 1000)}`,
            company_id: doc.tenantId,
            warehouse_id: doc.source_warehouse_id,
            product_id: item.product_id,
            transaction_type: isTransferType ? `${doc.doc_type} - Dispatched` : doc.doc_type,
            reference_document_id: doc.id,
            reference_document_no: doc.doc_no,
            qty_in: sourceQtyChange > 0 ? sourceQtyChange : 0,
            qty_out: sourceQtyChange < 0 ? Math.abs(sourceQtyChange) : 0,
            balance_before: currentStock,
            balance_after: newBalanceAfter,
            unit_cost,
            running_cost: newBalanceAfter * unit_cost,
            timestamp: new Date().toISOString(),
            user_id: operatorId,
            user_name: userName,
            audit_ref: `${doc.doc_no}-LEDGER`
          };
          ledgerEntries.push(ledgerSource);
        }
      }

      // 2. Create movement for target warehouse if Transfer & Target Entity is a Warehouse
      const isDestAWarehouse = InventoryModule.getWarehouses().some(w => w.id === doc.dest_entity_id);

      if (isTransferType && targetQtyChange > 0 && isDestAWarehouse) {
        const targetCurrentStock = InventoryModule.getProductStock(item.product_id, doc.dest_entity_id);
        const allocations = item.bin_allocations || [];

        if (allocations.length > 0) {
          // SPLIT BY DESTINATION BINS
          let runningStock = targetCurrentStock;
          allocations.forEach((alloc, allocIdx) => {
            const newBalanceAfter = runningStock + alloc.qty;
            const movTarget: StockMovement = {
              id: `mov-${Date.now()}-${item.product_id}-target-bin-${alloc.bin_id}-${Math.floor(Math.random() * 1000)}`,
              doc_id: doc.id,
              doc_no: doc.doc_no,
              doc_type: doc.doc_type,
              product_id: item.product_id,
              warehouse_id: doc.dest_entity_id,
              qty_change: alloc.qty,
              type: 'IN',
              current_balance_after: newBalanceAfter,
              date: doc.date,
              company_id: doc.tenantId,
              created_at: new Date().toISOString(),
              created_by: operatorId,
              bin_id: alloc.bin_id,
              bin_code: alloc.bin_code
            };
            movements.push(movTarget);

            // CREATE TARGET LEDGER ENTRY
            const ledgerTarget: InventoryLedgerEntry = {
              id: `led-${Date.now()}-${item.product_id}-target-bin-${alloc.bin_id}-${Math.floor(Math.random() * 1000)}`,
              company_id: doc.tenantId,
              warehouse_id: doc.dest_entity_id,
              product_id: item.product_id,
              transaction_type: `${doc.doc_type} - Received (Bin)`,
              reference_document_id: doc.id,
              reference_document_no: doc.doc_no,
              qty_in: alloc.qty,
              qty_out: 0,
              balance_before: runningStock,
              balance_after: newBalanceAfter,
              unit_cost,
              running_cost: newBalanceAfter * unit_cost,
              timestamp: new Date().toISOString(),
              user_id: operatorId,
              user_name: userName,
              audit_ref: `${doc.doc_no}-LEDGER`,
              bin_id: alloc.bin_id,
              bin_code: alloc.bin_code
            };
            ledgerEntries.push(ledgerTarget);
            runningStock = newBalanceAfter;
          });
        } else {
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

          // CREATE TARGET LEDGER ENTRY
          const ledgerTarget: InventoryLedgerEntry = {
            id: `led-${Date.now()}-${item.product_id}-target-${Math.floor(Math.random() * 1000)}`,
            company_id: doc.tenantId,
            warehouse_id: doc.dest_entity_id,
            product_id: item.product_id,
            transaction_type: `${doc.doc_type} - Received`,
            reference_document_id: doc.id,
            reference_document_no: doc.doc_no,
            qty_in: targetQtyChange,
            qty_out: 0,
            balance_before: targetCurrentStock,
            balance_after: targetCurrentStock + targetQtyChange,
            unit_cost,
            running_cost: (targetCurrentStock + targetQtyChange) * unit_cost,
            timestamp: new Date().toISOString(),
            user_id: operatorId,
            user_name: userName,
            audit_ref: `${doc.doc_no}-LEDGER`
          };
          ledgerEntries.push(ledgerTarget);
        }
      }
    });

    // Save everything in transaction-like batch
    InventoryModule.saveStockMovements(movements);
    InventoryModule.saveInventoryLedger(ledgerEntries);
    InventoryModule.saveProducts(updatedProductsList);
  }

  /**
   * Validates capacity constraints and simple overdrafts before a document reaches its next stage.
   */
  static validateCapacityAndOverdraft(
    doc: InventoryDocument,
    nextStatus: InventoryDocStatus
  ): { success: boolean; messageAr: string; messageEn: string } {
    const warehouses = InventoryModule.getWarehouses();
    const stage = nextStatus === 'Dispatched' ? 'Dispatched' : 'Posted';

    for (const item of doc.items) {
      const currentStock = InventoryModule.getProductStock(item.product_id, doc.source_warehouse_id);
      
      let sourceQtyChange = 0;
      let targetQtyChange = 0;
      const isTransferType = doc.doc_type === 'Transfer' || doc.doc_type === 'BranchTransfer' || doc.doc_type === 'StationTransfer';

      if (isTransferType) {
        if (stage === 'Dispatched') {
          sourceQtyChange = -item.qty;
        } else if (stage === 'Posted') {
          const qtyReceived = item.qty_received !== undefined ? item.qty_received : item.qty;
          targetQtyChange = qtyReceived;
        }
      } else {
        if (stage === 'Posted') {
          switch (doc.doc_type) {
            case 'Receipt':
            case 'BranchReturn':
              sourceQtyChange = item.qty;
              break;
            case 'Issue':
            case 'SupplierReturn':
              sourceQtyChange = -item.qty;
              break;
            case 'Damage':
              sourceQtyChange = doc.scrap_action === 'IN' ? item.qty : -item.qty;
              break;
            case 'Adjustment':
              sourceQtyChange = item.qty - currentStock;
              break;
          }
        }
      }

      // 1. Validate simple overdraft
      if (sourceQtyChange < 0 && (currentStock + sourceQtyChange) < 0) {
        if (doc.doc_type !== 'Adjustment') {
          return {
            success: false,
            messageAr: `عذراً، الرصيد غير كافٍ للصنف ${item.product_name} في المخزن المحدد (الرصيد الحالي: ${currentStock})`,
            messageEn: `Sorry, insufficient stock for item ${item.product_name} in selected warehouse (Current stock: ${currentStock})`
          };
        }
      }

      // 2. Validate warehouse capacity limits if adding stock
      if (sourceQtyChange > 0) {
        const wh = warehouses.find(w => w.id === doc.source_warehouse_id);
        if (wh && wh.is_capacity_enforced && wh.max_capacity_qty) {
          const currentTotal = InventoryModule.getWarehouseTotalStock(doc.source_warehouse_id);
          if ((currentTotal + sourceQtyChange) > wh.max_capacity_qty) {
            return {
              success: false,
              messageAr: `عذراً، لا يمكن إتمام العملية لأنها ستتجاوز السعة القصوى للمستودع (${wh.name}). السعة المتاحة: ${wh.max_capacity_qty - currentTotal} وحدة.`,
              messageEn: `Sorry, this operation exceeds the maximum capacity of warehouse (${wh.name}). Available capacity: ${wh.max_capacity_qty - currentTotal} units.`
            };
          }
        }
      }

      if (targetQtyChange > 0) {
        const wh = warehouses.find(w => w.id === doc.dest_entity_id);
        if (wh && wh.is_capacity_enforced && wh.max_capacity_qty) {
          const currentTotal = InventoryModule.getWarehouseTotalStock(doc.dest_entity_id);
          if ((currentTotal + targetQtyChange) > wh.max_capacity_qty) {
            return {
              success: false,
              messageAr: `عذراً، لا يمكن إتمام العملية لأنها ستتجاوز السعة القصوى للمستودع المستلم (${wh.name}). السعة المتاحة: ${wh.max_capacity_qty - currentTotal} وحدة.`,
              messageEn: `Sorry, this operation exceeds the maximum capacity of target warehouse (${wh.name}). Available capacity: ${wh.max_capacity_qty - currentTotal} units.`
            };
          }
        }
      }

      // 3. Validate bin capacity limits if bin allocations are specified
      const allocations = item.bin_allocations || [];
      if (allocations.length > 0) {
        const activeWhId = sourceQtyChange !== 0 ? doc.source_warehouse_id : doc.dest_entity_id;
        const bins = InventoryModule.getWarehouseBins(activeWhId);

        for (const alloc of allocations) {
          const bin = bins.find(b => b.id === alloc.bin_id);
          if (bin && bin.is_active && bin.max_capacity_qty) {
            const currentBinStock = InventoryModule.getBinTotalStock(alloc.bin_id);
            const change = sourceQtyChange !== 0 
              ? (sourceQtyChange > 0 ? alloc.qty : -alloc.qty)
              : alloc.qty;

            if (change > 0 && (currentBinStock + change) > bin.max_capacity_qty) {
              return {
                success: false,
                messageAr: `عذراً، عملية التخصيص تتجاوز السعة القصوى للحاوية (${bin.name}). السعة المتاحة: ${bin.max_capacity_qty - currentBinStock} وحدة.`,
                messageEn: `Sorry, allocation exceeds the maximum capacity of bin (${bin.name}). Available capacity: ${bin.max_capacity_qty - currentBinStock} units.`
              };
            }
          }
        }
      }
    }

    return { success: true, messageAr: '', messageEn: '' };
  }

  /**
   * Completes a Multi-Echelon transfer by receiving the dispatched stock,
   * recording actual received quantities and variances, and updating stock.
   */
  static async receiveTransferDocument(
    docId: string,
    receivedItems: { product_id: string; qty_received: number; variance_reason?: string }[],
    receivedNotes?: string
  ): Promise<{ success: boolean; messageAr: string; messageEn: string }> {
    const documents = InventoryModule.getInventoryDocuments();
    const docIndex = documents.findIndex(d => d.id === docId);
    if (docIndex === -1) {
      return { success: false, messageAr: 'المستند غير موجود', messageEn: 'Document not found' };
    }

    const document = documents[docIndex];
    if (document.status !== 'Dispatched') {
      return {
        success: false,
        messageAr: 'عذراً، يمكن فقط استلام المستندات التي تم شحنها وقيد النقل بالفعل',
        messageEn: 'Only dispatched or in-transit documents can be received'
      };
    }

    const user = UsersModule.getActiveUser();
    if (!user) {
      return { success: false, messageAr: 'يجب تسجيل الدخول أولاً', messageEn: 'User must be authenticated' };
    }

    // Map received items onto document
    const updatedItems = document.items.map(item => {
      const rec = receivedItems.find(r => r.product_id === item.product_id);
      const qtyReceived = rec !== undefined ? rec.qty_received : item.qty;
      const variance = item.qty - qtyReceived;
      return {
        ...item,
        qty_received: qtyReceived,
        qty_variance: variance,
        variance_reason: rec?.variance_reason || ''
      };
    });

    // Save the document with received fields first so triggerLifecycleTransition loads it
    const updatedMetadata = updateBaseMetadata(document, user.id);
    document.items = updatedItems;
    document.received_date = new Date().toISOString();
    document.received_by = user.id;
    document.received_notes = receivedNotes || '';
    
    documents[docIndex] = {
      ...document,
      ...updatedMetadata
    };
    InventoryModule.saveInventoryDocuments(documents);

    // Now trigger the transition to 'Posted'
    return await InventoryModule.triggerLifecycleTransition(docId, 'Receive');
  }
}
