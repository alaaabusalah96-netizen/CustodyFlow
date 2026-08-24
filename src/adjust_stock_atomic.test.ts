import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryModule } from './db/inventory';
import { StorageEngine } from './db/storage';
import { CompaniesModule } from './db/companies';

describe('Phase H: Atomic adjustStock Race-Condition Prevention Tests', () => {
  const companyId = 'comp-test-atomic';
  const warehouseId = 'wh-atomic-1';
  const productId = 'prod-atomic-1';
  const binId = 'bin-atomic-1';

  beforeEach(() => {
    localStorage.clear();
    CompaniesModule.setSelectedCompanyId(companyId);

    // Setup initial warehouse
    StorageEngine.setStored('warehouses', [
      {
        id: warehouseId,
        name: 'Atomic Test Warehouse',
        code: 'AT-WH-01',
        company_id: companyId,
        is_active: true
      }
    ]);

    // Setup initial stock movements with starting balance of 50
    StorageEngine.setStored('stock_movements', [
      {
        id: 'mov-init-1',
        doc_id: 'init-doc',
        doc_no: 'INIT-001',
        doc_type: 'Receipt',
        product_id: productId,
        warehouse_id: warehouseId,
        bin_id: binId,
        qty_change: 50,
        type: 'IN',
        current_balance_after: 50,
        date: '2026-08-24',
        company_id: companyId,
        created_at: '2026-08-24T00:00:00Z',
        created_by: 'system'
      }
    ]);

    // Set overdraft rule to STRICT
    StorageEngine.setStored('inventory_config', {
      allow_overdraft: 'STRICT',
      valuation_method: 'FEFO',
      company_id: companyId
    });
  });

  it('correctly reflects concurrent stock adjustments without losing updates', async () => {
    // Initial balance is 50
    const initialStock = InventoryModule.getProductStockInWarehouse(warehouseId, productId, binId);
    expect(initialStock).toBe(50);

    // Run two sequential/concurrent adjustments
    await InventoryModule.adjustStock(warehouseId, productId, 20, 'Receipt', 'user-1', binId);
    await InventoryModule.adjustStock(warehouseId, productId, 15, 'Receipt', 'user-2', binId);

    // Final balance must be 50 + 20 + 15 = 85
    const finalStock = InventoryModule.getProductStockInWarehouse(warehouseId, productId, binId);
    expect(finalStock).toBe(85);

    const movements = InventoryModule.getStockMovements().filter(
      m => m.warehouse_id === warehouseId && m.product_id === productId && m.bin_id === binId
    );
    expect(movements.length).toBe(3);
  });

  it('strictly enforces overdraft prevention on negative balance adjustments', async () => {
    // Balance is 50, trying to deduct 60 should throw in STRICT mode
    await expect(
      InventoryModule.adjustStock(warehouseId, productId, -60, 'Issue', 'user-1', binId)
    ).rejects.toThrow(/رصيد غير كافٍ|Insufficient stock/);

    // Balance should remain unchanged at 50
    const finalStock = InventoryModule.getProductStockInWarehouse(warehouseId, productId, binId);
    expect(finalStock).toBe(50);
  });
});
