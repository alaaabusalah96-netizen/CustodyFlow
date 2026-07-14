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

export type InventoryDocStatus = 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  company_id: string;
  location?: string;
  receiving_approval_workflow: boolean; // whether it requires approval before stock updates
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

export interface InventoryDocItem {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  qty: number;
  notes?: string;
  last_purchase_price?: number;
}

export interface InventoryDocument extends BaseMetadata {
  id: string;
  doc_no: string;
  date: string;
  doc_type: InventoryDocType;
  source_warehouse_id: string; // From warehouse
  dest_entity_id: string;       // To warehouse, branch, station, supplier, customer, etc.
  dest_entity_type: 'warehouse' | 'branch' | 'station' | 'supplier' | 'customer' | 'scrap' | 'adjustment';
  reason: string;
  recipient: string;
  statement: string;
  notes?: string;
  items: InventoryDocItem[];
  status: InventoryDocStatus;
  scrap_action?: 'IN' | 'OUT';
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
}

export interface InventoryReportFilter {
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  productId?: string;
  docType?: InventoryDocType;
}
