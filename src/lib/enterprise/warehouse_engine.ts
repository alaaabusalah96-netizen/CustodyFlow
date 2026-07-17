import { EventEnvelope } from '../../types/enterprise';
import { BusinessEngineContract, EngineExecutionResult } from './warehouse_contracts';
import { InventoryModule } from '../../db/inventory';
import { AuditLogEngine } from './audit';

/**
 * Concrete Warehouse and Inventory Business Engine
 * محرك عمليات المخازن والمستودعات الفعلي
 * 
 * Implements BusinessEngineContract to handle stock transactions via standardized EventEnvelopes.
 * Strictly adheres to ADR-0005 (Centralized Business Logic) and is fully backward-compatible.
 */
export class WarehouseBusinessEngine implements BusinessEngineContract {
  engineId = 'warehouse_business_engine';
  supportedEvents = [
    'STOCK_RECEIVED',
    'STOCK_ISSUED',
    'STOCK_TRANSFERRED',
    'INVENTORY_COUNT_ADJUSTED'
  ];

  private auditEngine = new AuditLogEngine();

  async processEvent(event: EventEnvelope<any>): Promise<EngineExecutionResult<any>> {
    if (!this.supportedEvents.includes(event.eventType)) {
      return {
        success: false,
        engineId: this.engineId,
        eventId: event.eventId,
        processedAt: new Date().toISOString(),
        statusCode: 'UNSUPPORTED_EVENT',
        messageEn: `Event type ${event.eventType} is not supported by this engine.`,
        messageAr: `نوع الحدث ${event.eventType} غير مدعوم من هذا المحرك.`
      };
    }

    try {
      // 1. Audit Log persistence via Event Envelope
      await this.auditEngine.appendAuditRecord(event);

      // 2. Process based on event type
      switch (event.eventType) {
        case 'STOCK_RECEIVED': {
          const { warehouseId, items } = event.payload;
          // Verify warehouse exists and capacity
          const whs = InventoryModule.getWarehouses();
          const warehouse = whs.find(w => w.id === warehouseId);
          if (!warehouse) {
            throw new Error(`Warehouse ${warehouseId} not found`);
          }

          // Enforce capacity bounds if enabled
          if (warehouse.is_capacity_enforced && warehouse.max_capacity_qty) {
            const currentStock = InventoryModule.getWarehouseStock(warehouseId);
            const incomingQty = items.reduce((sum: number, item: any) => sum + item.qty, 0);
            if (currentStock + incomingQty > warehouse.max_capacity_qty) {
              return {
                success: false,
                engineId: this.engineId,
                eventId: event.eventId,
                processedAt: new Date().toISOString(),
                statusCode: 'INSUFFICIENT_CAPACITY',
                messageEn: `Cannot receive stock. Warehouse capacity exceeded (Max: ${warehouse.max_capacity_qty}).`,
                messageAr: `لا يمكن استلام البضاعة. تم تجاوز سعة المستودع القصوى (${warehouse.max_capacity_qty}).`
              };
            }
          }

          // Apply stock increase
          items.forEach((item: any) => {
            InventoryModule.adjustStock(warehouseId, item.product_id, item.qty, 'Receipt', event.user_id, item.bin_id);
          });

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: 'Stock received and processed successfully.',
            messageAr: 'تم استلام وتجهيز البضاعة بنجاح.'
          };
        }

        case 'STOCK_ISSUED': {
          const { warehouseId, items } = event.payload;
          
          // Verify stock levels before issuing
          for (const item of items) {
            const stock = InventoryModule.getProductStockInWarehouse(warehouseId, item.product_id, item.bin_id);
            if (stock < item.qty) {
              return {
                success: false,
                engineId: this.engineId,
                eventId: event.eventId,
                processedAt: new Date().toISOString(),
                statusCode: 'INSUFFICIENT_STOCK',
                messageEn: `Insufficient stock for product ${item.product_id} in bin/warehouse. Current stock: ${stock}.`,
                messageAr: `رصيد غير كافٍ للمنتج ${item.product_id} في الرف/المستودع. الرصيد الحالي: ${stock}.`
              };
            }
          }

          // Apply stock decrease
          items.forEach((item: any) => {
            InventoryModule.adjustStock(warehouseId, item.product_id, -item.qty, 'Issue', event.user_id, item.bin_id);
          });

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: 'Stock issued and processed successfully.',
            messageAr: 'تم صرف وتحديث أرصيد المخزن بنجاح.'
          };
        }

        case 'STOCK_TRANSFERRED': {
          const { srcWarehouseId, destWarehouseId, items } = event.payload;
          
          const whs = InventoryModule.getWarehouses();
          const destWh = whs.find(w => w.id === destWarehouseId);
          if (!destWh) {
            throw new Error(`Destination warehouse ${destWarehouseId} not found`);
          }

          // Verify destination capacity if enforced
          if (destWh.is_capacity_enforced && destWh.max_capacity_qty) {
            const currentStock = InventoryModule.getWarehouseStock(destWarehouseId);
            const incomingQty = items.reduce((sum: number, item: any) => sum + item.qty, 0);
            if (currentStock + incomingQty > destWh.max_capacity_qty) {
              return {
                success: false,
                engineId: this.engineId,
                eventId: event.eventId,
                processedAt: new Date().toISOString(),
                statusCode: 'INSUFFICIENT_CAPACITY',
                messageEn: `Cannot transfer stock. Destination warehouse capacity exceeded.`,
                messageAr: `لا يمكن نقل البضاعة. تم تجاوز السعة الاستيعابية للمستودع المستهدف.`
              };
            }
          }

          // Verify source stock levels
          for (const item of items) {
            const stock = InventoryModule.getProductStockInWarehouse(srcWarehouseId, item.product_id, item.src_bin_id);
            if (stock < item.qty) {
              return {
                success: false,
                engineId: this.engineId,
                eventId: event.eventId,
                processedAt: new Date().toISOString(),
                statusCode: 'INSUFFICIENT_STOCK',
                messageEn: `Insufficient source stock for product ${item.product_id}. Available: ${stock}.`,
                messageAr: `رصيد غير كافٍ في مستودع المصدر للمنتج ${item.product_id}. الرصيد المتاح: ${stock}.`
              };
            }
          }

          // Process the transfer
          items.forEach((item: any) => {
            // Deduct from source
            InventoryModule.adjustStock(srcWarehouseId, item.product_id, -item.qty, 'Transfer', event.user_id, item.src_bin_id);
            // Add to destination
            InventoryModule.adjustStock(destWarehouseId, item.product_id, item.qty, 'Transfer', event.user_id, item.dest_bin_id);
          });

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: 'Stock transfer processed successfully.',
            messageAr: 'تم معالجة حركة تحويل المخزون بنجاح.'
          };
        }

        case 'INVENTORY_COUNT_ADJUSTED': {
          const { warehouseId, productId, binId, expectedQty, countedQty, reason } = event.payload;
          const diff = countedQty - expectedQty;
          
          if (diff === 0) {
            return {
              success: true,
              engineId: this.engineId,
              eventId: event.eventId,
              processedAt: new Date().toISOString(),
              statusCode: 'NO_CHANGE',
              messageEn: 'Count matches expected stock. No adjustment needed.',
              messageAr: 'الكمية الفعلية تطابق الكمية الدفترية. لا توجد حاجة للتسوية.'
            };
          }

          InventoryModule.adjustStock(warehouseId, productId, diff, 'Adjustment', event.user_id, binId);

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: 'Inventory adjustment completed.',
            messageAr: 'تم تسجيل تسوية المخزون وتعديل الأرصدة بنجاح.'
          };
        }

        default:
          throw new Error(`Unhandled event type: ${event.eventType}`);
      }

    } catch (error: any) {
      return {
        success: false,
        engineId: this.engineId,
        eventId: event.eventId,
        processedAt: new Date().toISOString(),
        statusCode: 'EXECUTION_ERROR',
        messageEn: error.message || 'Unknown execution error occurred',
        messageAr: error.message || 'حدث خطأ مجهول أثناء المعالجة'
      };
    }
  }
}
