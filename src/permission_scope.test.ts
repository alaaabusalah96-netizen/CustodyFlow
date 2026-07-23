import { describe, it, expect, beforeEach } from 'vitest';
import { OrganizationEngine } from './db/organizationEngine';
import { OrganizationScopeEngine } from './db/organizationScopeEngine';
import { StationsModule } from './db/stations';
import { StorageEngine } from './db/storage';
import { AppUser } from './types';

describe('Phase 7: Permission Scope Engine Unit Tests', () => {
  const companyId = 'comp-perm-scope-test';

  beforeEach(() => {
    StorageEngine.setStored('organization_units', []);
    StorageEngine.setStored('organization_unit_types', []);
    StorageEngine.setStored('stations', []);
    StorageEngine.setStored('regions', []);
  });

  it('should allow SystemAdmin or Admin full company scope access', () => {
    // Setup org hierarchy: Company -> Sector -> Region -> Station
    const root = OrganizationEngine.addOrganizationUnit({ nameAr: 'شركة الاختبار', nameEn: 'Test Company', code: 'HQ', typeCode: 'COMPANY', companyId });
    const sector = OrganizationEngine.addOrganizationUnit({ nameAr: 'قطاع الشمال', nameEn: 'North Sector', code: 'SEC-N', typeCode: 'SECTOR', parentId: root.id, companyId });
    const region = OrganizationEngine.addOrganizationUnit({ nameAr: 'منطقة القاهرة', nameEn: 'Cairo Region', code: 'REG-CAI', typeCode: 'REGION', parentId: sector.id, companyId });
    const station = OrganizationEngine.addOrganizationUnit({ nameAr: 'محطة ألعاب', nameEn: 'Station Alpha', code: 'STN-A', typeCode: 'STATION', parentId: region.id, companyId });

    const adminUser: AppUser = {
      id: 'usr-admin',
      email: 'admin@test.com',
      full_name: 'System Admin',
      role: 'SystemAdmin',
      company_id: companyId,
      permissions: { view_reports: true, manage_settings: true },
    };

    const accessible = OrganizationScopeEngine.getAccessibleOrgUnitIds(adminUser, companyId);
    expect(accessible.length).toBe(4);
    expect(accessible).toContain(root.id);
    expect(accessible).toContain(sector.id);
    expect(accessible).toContain(region.id);
    expect(accessible).toContain(station.id);
  });

  it('should automatically inherit permissions down the organization tree hierarchy', () => {
    // Setup hierarchy: Company -> Sector -> Region -> Branch
    const root = OrganizationEngine.addOrganizationUnit({ nameAr: 'المقر الرئيسي', nameEn: 'HQ', code: 'HQ', typeCode: 'COMPANY', companyId });
    const sector = OrganizationEngine.addOrganizationUnit({ nameAr: 'قطاع المبيعات', nameEn: 'Sales Sector', code: 'SEC-SALES', typeCode: 'SECTOR', parentId: root.id, companyId });
    const regCai = OrganizationEngine.addOrganizationUnit({ nameAr: 'منطقة القاهرة', nameEn: 'Cairo Region', code: 'REG-CAI', typeCode: 'REGION', parentId: sector.id, companyId });
    const regAlex = OrganizationEngine.addOrganizationUnit({ nameAr: 'منطقة الإسكندرية', nameEn: 'Alex Region', code: 'REG-ALX', typeCode: 'REGION', parentId: sector.id, companyId });
    const brCai1 = OrganizationEngine.addOrganizationUnit({ nameAr: 'فرع المعادي', nameEn: 'Maadi Branch', code: 'BR-MAADI', typeCode: 'BRANCH', parentId: regCai.id, companyId });
    const brCai2 = OrganizationEngine.addOrganizationUnit({ nameAr: 'فرع مدينة نصر', nameEn: 'Nasr City Branch', code: 'BR-NASR', typeCode: 'BRANCH', parentId: regCai.id, companyId });

    // User assigned to Cairo Region (regCai)
    const regionalMgr: AppUser = {
      id: 'usr-reg-mgr',
      email: 'cairo.mgr@test.com',
      full_name: 'Cairo Regional Manager',
      role: 'RegionalManager',
      company_id: companyId,
      org_unit_id: regCai.id,
      permissions: { view_reports: true, manage_settings: false },
    };

    const accessibleIds = OrganizationScopeEngine.getAccessibleOrgUnitIds(regionalMgr, companyId);

    // Should include regCai and its descendants (brCai1, brCai2)
    expect(accessibleIds).toContain(regCai.id);
    expect(accessibleIds).toContain(brCai1.id);
    expect(accessibleIds).toContain(brCai2.id);

    // Should NOT include root, sector, or Alex Region (regAlex)
    expect(accessibleIds).not.toContain(root.id);
    expect(accessibleIds).not.toContain(sector.id);
    expect(accessibleIds).not.toContain(regAlex.id);

    // Validate isOrgUnitInScope
    expect(OrganizationScopeEngine.isOrgUnitInScope(brCai1.id, regionalMgr, companyId)).toBe(true);
    expect(OrganizationScopeEngine.isOrgUnitInScope(regAlex.id, regionalMgr, companyId)).toBe(false);
  });

  it('should restrict leaf-assigned user to their exact org unit without access to parent or sibling units', () => {
    const root = OrganizationEngine.addOrganizationUnit({ nameAr: 'المقر الرئيسي', nameEn: 'HQ', code: 'HQ', typeCode: 'COMPANY', companyId });
    const regCai = OrganizationEngine.addOrganizationUnit({ nameAr: 'منطقة القاهرة', nameEn: 'Cairo Region', code: 'REG-CAI', typeCode: 'REGION', parentId: root.id, companyId });
    const br1 = OrganizationEngine.addOrganizationUnit({ nameAr: 'فرع المعادي', nameEn: 'Maadi Branch', code: 'BR-1', typeCode: 'BRANCH', parentId: regCai.id, companyId });
    const br2 = OrganizationEngine.addOrganizationUnit({ nameAr: 'فرع المعادي 2', nameEn: 'Maadi Branch 2', code: 'BR-2', typeCode: 'BRANCH', parentId: regCai.id, companyId });

    const branchUser: AppUser = {
      id: 'usr-branch',
      email: 'branch1@test.com',
      full_name: 'Branch 1 Supervisor',
      role: 'StationAdmin',
      company_id: companyId,
      org_unit_id: br1.id,
      permissions: { view_reports: true, manage_settings: false },
    };

    const accessibleIds = OrganizationScopeEngine.getAccessibleOrgUnitIds(branchUser, companyId);
    expect(accessibleIds).toEqual([br1.id]);

    expect(OrganizationScopeEngine.isOrgUnitInScope(br1.id, branchUser, companyId)).toBe(true);
    expect(OrganizationScopeEngine.isOrgUnitInScope(br2.id, branchUser, companyId)).toBe(false);
    expect(OrganizationScopeEngine.isOrgUnitInScope(regCai.id, branchUser, companyId)).toBe(false);
  });

  it('should filter items seamlessly using filterByOrganizationScope and maintain legacy fallback', () => {
    const user: AppUser = {
      id: 'usr-regional',
      email: 'reg@test.com',
      full_name: 'Regional User',
      role: 'RegionalManager',
      company_id: companyId,
      org_unit_id: 'org-unit-cairo',
      region_id: 'reg-cairo-legacy',
      permissions: { view_reports: true, manage_settings: false },
    };

    const items = [
      { id: '1', company_id: companyId, org_unit_id: 'org-unit-cairo', name: 'Cairo Item' },
      { id: '2', company_id: companyId, org_unit_id: 'org-unit-alex', name: 'Alex Item' },
      { id: '3', company_id: companyId, region_id: 'reg-cairo-legacy', name: 'Legacy Cairo Item' },
    ];

    const filtered = OrganizationScopeEngine.filterByOrganizationScope(items, user);
    expect(filtered.map(i => i.id)).toContain('1');
    expect(filtered.map(i => i.id)).toContain('3');
    expect(filtered.map(i => i.id)).not.toContain('2');
  });
});
