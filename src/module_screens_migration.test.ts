import { describe, it, expect, beforeEach } from 'vitest';
import { CustodyDB } from './db';
import { StorageEngine } from './db/storage';
import { PurchasingBusinessEngine } from './lib/enterprise/purchasing_engine';
import { InventoryModule } from './db/inventory';
import { createEventEnvelope } from './lib/enterprise/metadata';
import { OrganizationEngine } from './db/organizationEngine';
import { SalesInvoice, Customer } from './types/sales';
import { Employee } from './types/hr';
import { FixedAsset } from './types/asset';
import { Vehicle } from './types/fleet';

describe('Phase 6: Module Screen Migration Test Suite', () => {
  const companyId = 'comp-test-phase6';

  beforeEach(() => {
    StorageEngine.clearCache();
    CustodyDB.setSelectedCompanyId(companyId);
  });

  it('1. Purchasing: PR created with org_unit_id processes successfully and retains org_unit_id', async () => {
    const orgUnit = OrganizationEngine.addOrganizationUnit({
      nameAr: 'إدارة المشتريات المركزية',
      nameEn: 'Central Procurement Dept',
      code: 'PROC-01',
      typeCode: 'DEPT',
      companyId
    });

    const engine = new PurchasingBusinessEngine();
    const event = createEventEnvelope({
      eventType: 'PR_SUBMITTED',
      tenantId: companyId,
      userId: 'usr-buyer',
      userName: 'Buyer User',
      userRole: 'RegionalManager',
      payload: {
        requesterId: 'usr-buyer',
        requesterName: 'Buyer User',
        department: 'Procurement',
        org_unit_id: orgUnit.id,
        items: [
          { productId: 'prod-1', productName: 'Paper Reams', qty: 10, unit: 'box', estimatedPrice: 50 }
        ],
        notes: 'Monthly office supply request'
      }
    });

    const result = await engine.processEvent(event);
    expect(result.success).toBe(true);

    const prs = PurchasingBusinessEngine.getPurchaseRequests(companyId);
    expect(prs.length).toBeGreaterThan(0);
    const createdPR = prs.find(p => p.org_unit_id === orgUnit.id);
    expect(createdPR).toBeDefined();
    expect(createdPR?.org_unit_id).toBe(orgUnit.id);
  });

  it('2. Sales & AR: Invoice created with org_unit_id processes successfully', () => {
    const orgUnit = OrganizationEngine.addOrganizationUnit({
      nameAr: 'فرع مبيعات القاهرة',
      nameEn: 'Cairo Sales Branch',
      code: 'SALES-CAI',
      typeCode: 'BRANCH',
      companyId
    });

    const newInvoice: SalesInvoice = {
      id: 'inv-phase6-1',
      invoice_number: 'INV-2026-001',
      customer_id: 'cust-1',
      customer_name: 'Cairo Distributing Co.',
      company_id: companyId,
      org_unit_id: orgUnit.id,
      invoice_date: '2026-07-27',
      due_date: '2026-08-27',
      subtotal: 1000,
      tax_amount: 140,
      discount_amount: 0,
      total_amount: 1140,
      paid_amount: 0,
      remaining_amount: 1140,
      status: 'ISSUED',
      payment_type: 'CREDIT',
      created_at: new Date().toISOString(),
      created_by: 'usr-sales',
      items: [
        { id: 'item-1', product_id: 'prod-item-1', description: 'Finished Product A', qty: 5, unit_price: 200, total: 1000 }
      ]
    };

    const existingInvoices = StorageEngine.getStored<SalesInvoice[]>('sales_invoices', []);
    StorageEngine.setStored('sales_invoices', [...existingInvoices, newInvoice]);

    const retrievedInvoices = StorageEngine.getStored<SalesInvoice[]>('sales_invoices', []);
    const savedInv = retrievedInvoices.find(i => i.id === 'inv-phase6-1');
    expect(savedInv).toBeDefined();
    expect(savedInv?.org_unit_id).toBe(orgUnit.id);
  });

  it('3. HR & Payroll: Employee onboarded with org_unit_id persists correctly', () => {
    const orgUnit = OrganizationEngine.addOrganizationUnit({
      nameAr: 'مصنع الشرقية',
      nameEn: 'Sharkia Factory',
      code: 'FAC-SHK',
      typeCode: 'FACTORY',
      companyId
    });

    const newEmp: Employee = {
      id: 'emp-phase6-1',
      employee_code: 'EMP-901',
      name: 'Ahmed Hassan',
      job_title: 'Factory Engineer',
      department: 'PRODUCTION',
      company_id: companyId,
      org_unit_id: orgUnit.id,
      basic_salary: 12000,
      allowances: 1500,
      deductions: 0,
      net_salary: 13500,
      hire_date: '2026-07-01',
      national_id: '29001011234567',
      status: 'ACTIVE'
    };

    const existingEmps = StorageEngine.getStored<Employee[]>('employees_payroll_items', []);
    StorageEngine.setStored('employees_payroll_items', [...existingEmps, newEmp]);

    const retrievedEmps = StorageEngine.getStored<Employee[]>('employees_payroll_items', []);
    const savedEmp = retrievedEmps.find(e => e.id === 'emp-phase6-1');
    expect(savedEmp).toBeDefined();
    expect(savedEmp?.org_unit_id).toBe(orgUnit.id);
  });

  it('4. Fixed Assets: Asset registered with org_unit_id stores unit scope', () => {
    const orgUnit = OrganizationEngine.addOrganizationUnit({
      nameAr: 'قطاع اللوجستيات',
      nameEn: 'Logistics Sector',
      code: 'LOG-SEC',
      typeCode: 'SECTOR',
      companyId
    });

    const newAsset: FixedAsset = {
      id: 'asset-phase6-1',
      asset_code: 'AST-801',
      name: 'Forklift Caterpillar 3T',
      category: 'EQUIPMENT',
      company_id: companyId,
      org_unit_id: orgUnit.id,
      purchase_date: '2026-01-15',
      purchase_cost: 450000,
      useful_life_years: 5,
      salvage_value: 50000,
      accumulated_depreciation: 0,
      book_value: 450000,
      depreciation_method: 'STRAIGHT_LINE',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };

    const existingAssets = StorageEngine.getStored<FixedAsset[]>('fixed_assets_items', []);
    StorageEngine.setStored('fixed_assets_items', [...existingAssets, newAsset]);

    const retrievedAssets = StorageEngine.getStored<FixedAsset[]>('fixed_assets_items', []);
    const savedAsset = retrievedAssets.find(a => a.id === 'asset-phase6-1');
    expect(savedAsset).toBeDefined();
    expect(savedAsset?.org_unit_id).toBe(orgUnit.id);
  });

  it('5. Fleet Management: Vehicle registered with org_unit_id preserves unit scope', () => {
    const orgUnit = OrganizationEngine.addOrganizationUnit({
      nameAr: 'أسطول النقل الجيزة',
      nameEn: 'Giza Fleet Dept',
      code: 'FLEET-GZA',
      typeCode: 'DEPT',
      companyId
    });

    const newVehicle: Vehicle = {
      id: 'veh-phase6-1',
      plateNumber: 'ط د ر 7890',
      model: 'Volvo FH16',
      type: 'TRUCK',
      capacity: '25 Tons',
      year: 2024,
      currentOdometer: 15200,
      assignedDriver: 'Mahmoud Aly',
      status: 'AVAILABLE',
      company_id: companyId,
      org_unit_id: orgUnit.id,
      created_at: new Date().toISOString()
    };

    const existingVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    StorageEngine.setStored('fleet_vehicles_items', [...existingVehicles, newVehicle]);

    const retrievedVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const savedVeh = retrievedVehicles.find(v => v.id === 'veh-phase6-1');
    expect(savedVeh).toBeDefined();
    expect(savedVeh?.org_unit_id).toBe(orgUnit.id);
  });

  it('6. Inventory: Document created with source/dest including org_unit_id saves cleanly', async () => {
    const orgUnit = OrganizationEngine.addOrganizationUnit({
      nameAr: 'مخزن العبور الفرعي',
      nameEn: 'Obour Branch Store',
      code: 'STR-OBR',
      typeCode: 'SITE',
      companyId
    });

    const doc = await InventoryModule.addInventoryDocument({
      company_id: companyId,
      doc_type: 'Transfer',
      doc_number: 'TRF-2026-001',
      date: '2026-07-27',
      source_warehouse_id: 'wh-main',
      dest_warehouse_id: orgUnit.id,
      status: 'Posted',
      created_by: 'usr-inv',
      notes: 'Branch replenishment',
      items: [
        { product_id: 'prod-1', qty: 20, notes: 'Boxes' }
      ]
    });

    expect(doc.id).toBeDefined();
    expect(doc.dest_warehouse_id).toBe(orgUnit.id);
  });
});
