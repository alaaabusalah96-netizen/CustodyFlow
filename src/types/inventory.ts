import { BaseMetadata } from './enterprise';

export type InventoryDocType =
  | 'Receipt'          // إذن إضافة
  | 'Issue'            // إذن صرف
  | 'Transfer'         // إذن تحويل بين المخازن
  | 'BranchTransfer'   // إذن تحويل إلى فرع
  | 'StationTransfer'  // إذن تحويل إلى محطة
  | 'BranchReturn'     // مرتجع من فرع أو محطة
  | 'SupplierReturn'   // مرتجع إلى مورد
  | 'Adjustment'       // تسوية جرد
  | 'Damage';          // إذن إتلاف / خردة

export type InventoryDocStatus = 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled' | 'Dispatched';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  company_id: string;
  location?: string;
  receiving_approval_workflow: boolean; // whether it requires approval before stock updates
  max_capacity_qty?: number;            // Maximum total item units allowed (optional)
  max_capacity_volume?: number;         // Maximum volume allowed in m³ (optional)
  is_capacity_enforced?: boolean;       // Enable physical limit validation on postings
}

export interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  unit: string;
  min_stock: number;
  last_purchase_price?: number;
  is_active: boolean;
  company_id: string;
  description?: string;
}

export interface BinAllocation {
  bin_id: string;
  bin_code: string;
  qty: number;
}

export interface InventoryDocItem {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  qty: number;
  batch_no?: string;
  expiry_date?: string;
  notes?: string;
  last_purchase_price?: number;
  qty_received?: number;
  qty_variance?: number;
  variance_reason?: string;
  bin_allocations?: BinAllocation[]; // Multi-bin distribution for this item
}

export interface InventoryDocument extends BaseMetadata {
  id: string;
  doc_no: string;
  date: string;
  doc_type: InventoryDocType;
  company_id?: string;
  source_warehouse_id?: string; // From warehouse
  dest_entity_id?: string;       // To warehouse, branch, station, supplier, customer, etc.
  dest_entity_type?: 'warehouse' | 'branch' | 'station' | 'supplier' | 'customer' | 'scrap' | 'adjustment';
  receipt_source_type?: 'supplier' | 'transfer'; // For Receipt doc: Supplier vs Internal Transfer
  receipt_transfer_entity_id?: string;
  supplier_name?: string;
  ref_no?: string;
  reason?: string;
  recipient?: string;
  statement?: string;
  notes?: string;
  items: InventoryDocItem[];
  status: InventoryDocStatus;
  scrap_action?: 'IN' | 'OUT';
  received_date?: string;
  received_by?: string;
  received_notes?: string;
}

export interface StockMovement {
  id: string;
  doc_id: string;
  doc_no: string;
  doc_type: InventoryDocType;
  product_id: string;
  warehouse_id: string;
  qty_change: number; // Positive for IN, Negative for OUT
  type: 'IN' | 'OUT';
  current_balance_after: number;
  date: string;
  company_id: string;
  created_at: string;
  created_by: string;
  bin_id?: string;    // Specific bin targeted by this movement
  bin_code?: string;  // Specific bin code targeted
  batch_no?: string;  // Batch / Lot number
  expiry_date?: string; // Expiration date
}

export interface InventoryReportFilter {
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  productId?: string;
  docType?: InventoryDocType;
}

export interface InventoryLedgerEntry {
  id: string;
  company_id: string;
  warehouse_id: string;
  product_id: string;
  transaction_type: string; // e.g. Receipt, Issue, Transfer, etc.
  reference_document_id: string; // doc_id
  reference_document_no: string; // doc_no
  qty_in: number;
  qty_out: number;
  balance_before: number;
  balance_after: number;
  unit_cost: number;
  running_cost: number; // accumulated running cost (unit_cost * balance_after)
  timestamp: string; // ISO timestamp
  user_id: string;
  user_name?: string;
  audit_ref: string; // audit trace code
  bin_id?: string;    // Bin location of this ledger transaction
  bin_code?: string;  // Bin location code
  batch_no?: string;  // Batch / Lot number
  expiry_date?: string; // Expiration date
}

export interface WarehouseBin {
  id: string;
  warehouse_id: string;
  code: string;       // e.g., BIN-A1-S3
  name: string;       // e.g., Row A, Shelf 3
  max_capacity_qty: number; // Maximum units allowed in this bin
  is_active: boolean;
  zone?: string;      // e.g., Ambient, Cold Storage, Hazardous, etc.
}

export interface ProductBatchStock {
  batch_no: string;
  expiry_date?: string;
  available_qty: number;
}

export interface InventoryWorkflowConfig {
  valuation_method: 'FEFO' | 'FIFO' | 'LIFO' | 'MANUAL';
  allow_overdraft: 'STRICT' | 'WARNING' | 'ALLOWED';
  bin_tracking_policy: 'MANDATORY' | 'OPTIONAL' | 'DISABLED';
  batch_expiry_policy: 'MANDATORY' | 'WARNING' | 'OPTIONAL';
  transfer_approval_mode: 'TWO_STEP' | 'DIRECT';
  auto_post_accounting: boolean;
  require_approval_for_posting: boolean;
  reorder_alert_threshold_percent: number;
  default_inventory_account_code: string;
  default_ap_account_code: string;
  default_cogs_account_code: string;
  default_variance_account_code: string;
  default_scrap_account_code: string;
}


