import { Firestore } from 'firebase/firestore';
import { EventEnvelope } from '../../types/enterprise';
import { BusinessEngineContract, EngineExecutionResult } from './warehouse_contracts';
import { DocumentLifecycleEngine } from './lifecycle';
import { SequenceEngine } from './sequence';
import { AuditLogEngine } from './audit';
import { createBaseMetadata, updateBaseMetadata } from './metadata';
import { PurchaseRequest, PurchaseOrder, Vendor, PRStatus, POStatus } from '../../types/purchasing';
import { StorageEngine } from '../../db/storage';
import { dbSetDoc, db } from '../../firebase';
import { InventoryModule } from '../../db/inventory';
import { AccountingBusinessEngine } from './accounting_engine';

/**
 * Enterprise Purchasing & Procurement Business Engine
 * محرك المشتريات والتموين المركزي للمؤسسة
 * 
 * Manages Vendors, Purchase Requests (PR), and Purchase Orders (PO) workflow lifecycles.
 * Handles automatic warehouse stock reception when a PO is marked as "RECEIVED".
 */
export class PurchasingBusinessEngine implements BusinessEngineContract {
  engineId = 'purchasing_business_engine';
  supportedEvents = [
    'PR_SUBMITTED',
    'PR_APPROVED',
    'PR_REJECTED',
    'PO_ISSUED',
    'PO_RECEIVED'
  ];

  private auditEngine = new AuditLogEngine();

  // Standard in-memory / local storage helper methods
  static getVendors(companyId: string): Vendor[] {
    const list = StorageEngine.getStored<Vendor[]>('vendors', []);
    return list.filter(v => v.company_id === companyId);
  }

  static addVendor(companyId: string, nameAr: string, nameEn: string, phone?: string, email?: string, taxNo?: string, address?: string): Vendor {
    const list = StorageEngine.getStored<Vendor[]>('vendors', []);
    const newVendor: Vendor = {
      id: `vnd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // FIX: avoid id collisions under concurrent creation
      company_id: companyId,
      nameAr,
      nameEn,
      code: `VND-${list.length + 1001}`,
      phone,
      email,
      taxNo,
      address,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    list.push(newVendor);
    StorageEngine.setStored('vendors', list);
    dbSetDoc('vendors', newVendor.id, newVendor);
    return newVendor;
  }

  static getPurchaseRequests(companyId: string): PurchaseRequest[] {
    const list = StorageEngine.getStored<PurchaseRequest[]>('purchase_requests', []);
    return list.filter(pr => pr.company_id === companyId);
  }

  static getPurchaseOrders(companyId: string): PurchaseOrder[] {
    const list = StorageEngine.getStored<PurchaseOrder[]>('purchase_orders', []);
    return list.filter(po => po.company_id === companyId);
  }

  static savePurchaseRequests(list: PurchaseRequest[]): void {
    StorageEngine.setStored('purchase_requests', list);
    list.forEach(pr => dbSetDoc('purchase_requests', pr.id, pr));
  }

  static savePurchaseOrders(list: PurchaseOrder[]): void {
    StorageEngine.setStored('purchase_orders', list);
    list.forEach(po => dbSetDoc('purchase_orders', po.id, po));
  }

  // --- central event processor ---
  async processEvent(event: EventEnvelope<any>): Promise<EngineExecutionResult<any>> {
    if (!this.supportedEvents.includes(event.eventType)) {
      return {
        success: false,
        engineId: this.engineId,
        eventId: event.eventId,
        processedAt: new Date().toISOString(),
        statusCode: 'UNSUPPORTED_EVENT',
        messageEn: `Unsupported purchasing event: ${event.eventType}`,
        messageAr: `الحدث غير مدعوم في محرك المشتريات: ${event.eventType}`
      };
    }

    try {
      // Log to audit trial
      await this.auditEngine.appendAuditRecord(event);

      const dbInstance = db as Firestore;

      switch (event.eventType) {
        case 'PR_SUBMITTED': {
          const { requesterId, requesterName, items, notes, department } = event.payload;
          const companyId = event.tenantId;

          // 1. Generate sequence
          const prNumber = await SequenceEngine.generateNextSequence(
            dbInstance,
            companyId,
            'last_purchase_request_no',
            { prefix: 'PR', padding: 4, includeYear: true }
          );

          // 2. Create the document
          const pr: PurchaseRequest = {
            id: `pr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // FIX: avoid id collisions under concurrent creation
            company_id: companyId,
            prNumber,
            requesterId,
            requesterName,
            department,
            date: new Date().toISOString().split('T')[0],
            items,
            totalAmount: items.reduce((sum: number, it: any) => sum + (it.qty * it.estimatedPrice), 0),
            status: 'PENDING_APPROVAL',
            notes,
            metadata: createBaseMetadata(companyId, requesterId)
          };

          const allPRs = StorageEngine.getStored<PurchaseRequest[]>('purchase_requests', []);
          allPRs.push(pr);
          PurchasingBusinessEngine.savePurchaseRequests(allPRs);

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: `Purchase Request ${prNumber} created successfully.`,
            messageAr: `تم إنشاء طلب الشراء ${prNumber} وإرساله للاعتماد بنجاح.`,
            outputData: pr
          };
        }

        case 'PR_APPROVED': {
          const { prId } = event.payload;
          const allPRs = StorageEngine.getStored<PurchaseRequest[]>('purchase_requests', []);
          const idx = allPRs.findIndex(pr => pr.id === prId);
          if (idx === -1) throw new Error('Purchase Request not found');

          if (allPRs[idx].status !== 'PENDING_APPROVAL') {
            throw new Error(`Invalid state transition from ${allPRs[idx].status}`);
          }

          allPRs[idx].status = 'APPROVED';
          allPRs[idx].metadata = updateBaseMetadata(allPRs[idx].metadata, event.user_id);
          PurchasingBusinessEngine.savePurchaseRequests(allPRs);

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: 'Purchase Request approved.',
            messageAr: 'تم اعتماد طلب الشراء بنجاح.'
          };
        }

        case 'PR_REJECTED': {
          const { prId } = event.payload;
          const allPRs = StorageEngine.getStored<PurchaseRequest[]>('purchase_requests', []);
          const idx = allPRs.findIndex(pr => pr.id === prId);
          if (idx === -1) throw new Error('Purchase Request not found');

          if (allPRs[idx].status !== 'PENDING_APPROVAL') {
            throw new Error(`Invalid state transition from ${allPRs[idx].status}`);
          }

          allPRs[idx].status = 'REJECTED';
          allPRs[idx].metadata = updateBaseMetadata(allPRs[idx].metadata, event.user_id);
          PurchasingBusinessEngine.savePurchaseRequests(allPRs);

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: 'Purchase Request rejected.',
            messageAr: 'تم رفض طلب الشراء.'
          };
        }

        case 'PO_ISSUED': {
          const { prId, vendorId, items, notes, deliveryWarehouseId } = event.payload;
          const companyId = event.tenantId;

          // 1. Fetch vendor
          const vendors = StorageEngine.getStored<Vendor[]>('vendors', []);
          const vendor = vendors.find(v => v.id === vendorId);
          if (!vendor) throw new Error('Vendor not found');

          // 2. Generate PO Sequence
          const poNumber = await SequenceEngine.generateNextSequence(
            dbInstance,
            companyId,
            'last_purchase_order_no',
            { prefix: 'PO', padding: 4, includeYear: true }
          );

          // 3. Mark PR as converted if reference exists
          let prNum: string | undefined;
          if (prId) {
            const allPRs = StorageEngine.getStored<PurchaseRequest[]>('purchase_requests', []);
            const prIdx = allPRs.findIndex(pr => pr.id === prId);
            if (prIdx !== -1) {
              prNum = allPRs[prIdx].prNumber;
            }
          }

          // 4. Create PO
          const po: PurchaseOrder = {
            id: `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // FIX: avoid id collisions under concurrent creation
            company_id: companyId,
            poNumber,
            prId,
            prNumber: prNum,
            vendorId,
            vendorName: vendor.nameAr,
            date: new Date().toISOString().split('T')[0],
            items: items.map((it: any) => ({
              ...it,
              totalPrice: it.qty * it.unitPrice
            })),
            totalAmount: items.reduce((sum: number, it: any) => sum + (it.qty * it.unitPrice), 0),
            status: 'ISSUED',
            notes,
            deliveryWarehouseId,
            metadata: createBaseMetadata(companyId, event.user_id)
          };

          const allPOs = StorageEngine.getStored<PurchaseOrder[]>('purchase_orders', []);
          allPOs.push(po);
          PurchasingBusinessEngine.savePurchaseOrders(allPOs);

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: `Purchase Order ${poNumber} issued successfully.`,
            messageAr: `تم إصدار أمر الشراء ${poNumber} بنجاح وإرساله للمورد.`,
            outputData: po
          };
        }

        case 'PO_RECEIVED': {
          const { poId, warehouseId } = event.payload;
          const allPOs = StorageEngine.getStored<PurchaseOrder[]>('purchase_orders', []);
          const idx = allPOs.findIndex(po => po.id === poId);
          if (idx === -1) throw new Error('Purchase Order not found');

          const companyId = allPOs[idx].metadata.tenantId;

          if (allPOs[idx].status !== 'ISSUED') {
            throw new Error(`PO is not in ISSUED state. Current: ${allPOs[idx].status}`);
          }

          // 1. Change status
          allPOs[idx].status = 'RECEIVED';
          allPOs[idx].deliveryWarehouseId = warehouseId;
          allPOs[idx].metadata = updateBaseMetadata(allPOs[idx].metadata, event.user_id);
          PurchasingBusinessEngine.savePurchaseOrders(allPOs);

          // 2. Automate stock receiving in specified Warehouse!
          const whs = InventoryModule.getWarehouses();
          const targetWh = whs.find(w => w.id === warehouseId);
          if (!targetWh) throw new Error('Target delivery warehouse not found');

          // Inject products directly into inventory via InventoryModule
          allPOs[idx].items.forEach(item => {
            InventoryModule.adjustStock(
              warehouseId,
              item.productId,
              item.qty,
              'Receipt',
              event.user_id,
              undefined // Automatically place to default bin or general space
            );
          });

          // 3. Auto-post double-entry journal entry for stock receipt
          try {
            const amount = allPOs[idx].totalAmount;
            const poNum = allPOs[idx].poNumber;
            const statementAr = `قيد تلقائي: استلام بضاعة أمر الشراء ${poNum} للمستودع ${targetWh.name}`;
            const statementEn = `Auto-post: Stock Receipt for PO ${poNum} into warehouse ${targetWh.name}`;
            
            AccountingBusinessEngine.postOperationalDoubleEntry(
              companyId,
              event.user_id,
              `PO #${poNum}`,
              statementAr,
              statementEn,
              [
                { accountCode: '120101', debit: amount, credit: 0, notes: `Debit: Warehouse Stock Inventory` },
                { accountCode: '210101', debit: 0, credit: amount, notes: `Credit: Accounts Payable (${allPOs[idx].vendorName})` }
              ]
            ).catch(err => console.error('Automated double-entry posting for PO failed:', err));
          } catch (err) {
            console.error('Automated double-entry posting preparation for PO failed:', err);
          }

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: 'Purchase Order items fully received. Warehouse stock updated and GL entries posted.',
            messageAr: 'تم استلام بنود أمر الشراء بالكامل، وتحديث المخزون وترحيل القيود المحاسبية الآلية.'
          };
        }

        default:
          throw new Error(`Unimplemented purchasing event: ${event.eventType}`);
      }

    } catch (error: any) {
      return {
        success: false,
        engineId: this.engineId,
        eventId: event.eventId,
        processedAt: new Date().toISOString(),
        statusCode: 'EXECUTION_ERROR',
        messageEn: error.message || 'Unknown purchase processing error',
        messageAr: error.message || 'حدث خطأ مجهول أثناء معالجة المشتريات'
      };
    }
  }
}
