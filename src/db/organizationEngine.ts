import { OrganizationUnit, OrganizationUnitType, OrganizationPath, OrganizationTemplate, OrganizationTreeNode, OrganizationHierarchyValidationResult } from '../types/organization';
import { StorageEngine } from './storage';
import { dbSetDoc, dbDeleteDoc } from '../firebase';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { CompaniesModule } from './companies';
import { StationsModule } from './stations';

// Default system-wide organization unit types
export const DEFAULT_ORGANIZATION_UNIT_TYPES: OrganizationUnitType[] = [
  { id: 'out-company', companyId: null, code: 'COMPANY', nameAr: 'شركة / مؤسسة', nameEn: 'Company / Enterprise', level: 0, description: 'Top-level corporate entity', isActive: true },
  { id: 'out-holding', companyId: null, code: 'HOLDING', nameAr: 'شركة قابضة', nameEn: 'Holding Company', level: 0, description: 'Parent holding organization', isActive: true },
  { id: 'out-sector', companyId: null, code: 'SECTOR', nameAr: 'قطاع', nameEn: 'Sector', level: 1, description: 'Business sector or group division', isActive: true },
  { id: 'out-region', companyId: null, code: 'REGION', nameAr: 'إقليم / منطقة', nameEn: 'Region', level: 2, description: 'Geographical region', isActive: true },
  { id: 'out-branch', companyId: null, code: 'BRANCH', nameAr: 'فرع', nameEn: 'Branch', level: 3, description: 'Operational branch', isActive: true },
  { id: 'out-station', companyId: null, code: 'STATION', nameAr: 'محطة', nameEn: 'Station', level: 3, description: 'Field station or site', isActive: true },
  { id: 'out-department', companyId: null, code: 'DEPARTMENT', nameAr: 'إدارة / قسم', nameEn: 'Department', level: 4, description: 'Functional department', isActive: true },
  { id: 'out-farm', companyId: null, code: 'FARM', nameAr: 'مزرعة', nameEn: 'Farm', level: 3, description: 'Agricultural farm unit', isActive: true },
  { id: 'out-factory', companyId: null, code: 'FACTORY', nameAr: 'مصنع', nameEn: 'Factory', level: 3, description: 'Manufacturing facility', isActive: true },
  { id: 'out-unit', companyId: null, code: 'UNIT', nameAr: 'وحدة عمل', nameEn: 'Work Unit', level: 5, description: 'Operational work unit', isActive: true },
];

// Phase 3: Predefined Industry Organization Templates
export const DEFAULT_ORGANIZATION_TEMPLATES: OrganizationTemplate[] = [
  {
    id: 'tpl-trading',
    code: 'TRADING_STD',
    nameAr: 'هيكل شركة تجارة وتوزيع',
    nameEn: 'Trading & Distribution Template',
    descriptionAr: 'هيكل ينظم قطاعات المبيعات والتوزيع الإقليمية والفروع التشغيلية',
    descriptionEn: 'Standard structure for trading companies with sales sectors, regional hubs, and branch stores.',
    category: 'Trading',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'HQ', nameAr: 'المقر الرئيسي للشركة', nameEn: 'Corporate HQ' },
      { tempKey: 'sec_sales', parentTempKey: 'comp', typeCode: 'SECTOR', codePrefix: 'SEC-SALES', nameAr: 'قطاع المبيعات والتوزيع', nameEn: 'Sales & Distribution Sector' },
      { tempKey: 'sec_ops', parentTempKey: 'comp', typeCode: 'SECTOR', codePrefix: 'SEC-OPS', nameAr: 'قطاع العمليات واللوجستيات', nameEn: 'Operations & Logistics Sector' },
      { tempKey: 'reg_cairo', parentTempKey: 'sec_sales', typeCode: 'REGION', codePrefix: 'REG-CAIRO', nameAr: 'منطقة القاهرة الكبرى', nameEn: 'Greater Cairo Region' },
      { tempKey: 'reg_alex', parentTempKey: 'sec_sales', typeCode: 'REGION', codePrefix: 'REG-ALEX', nameAr: 'منطقة الإسكندرية والدلتا', nameEn: 'Alexandria & Delta Region' },
      { tempKey: 'br_cairo_main', parentTempKey: 'reg_cairo', typeCode: 'BRANCH', codePrefix: 'BR-CAI-01', nameAr: 'فرع القاهرة الرئيسي', nameEn: 'Cairo Main Branch' },
      { tempKey: 'br_alex_main', parentTempKey: 'reg_alex', typeCode: 'BRANCH', codePrefix: 'BR-ALX-01', nameAr: 'فرع الإسكندرية الرئيسي', nameEn: 'Alexandria Main Branch' },
    ]
  },
  {
    id: 'tpl-manufacturing',
    code: 'MFG_STD',
    nameAr: 'هيكل شركة صناعية ومصانع',
    nameEn: 'Manufacturing Industry Template',
    descriptionAr: 'هيكل ينظم المجمعات الصناعية، خطوط الإنتاج، وإدارات الجودة والصيانة',
    descriptionEn: 'Structure for manufacturing plants, production lines, quality labs, and maintenance divisions.',
    category: 'Manufacturing',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'CORP', nameAr: 'الشركة الصناعية', nameEn: 'Industrial Enterprise' },
      { tempKey: 'factory_1', parentTempKey: 'comp', typeCode: 'FACTORY', codePrefix: 'FAC-01', nameAr: 'مصنع الإنتاج الرئيسي', nameEn: 'Main Manufacturing Plant' },
      { tempKey: 'dept_prod', parentTempKey: 'factory_1', typeCode: 'DEPARTMENT', codePrefix: 'DEPT-PROD', nameAr: 'إدارة خطوط الإنتاج', nameEn: 'Production Department' },
      { tempKey: 'dept_qc', parentTempKey: 'factory_1', typeCode: 'DEPARTMENT', codePrefix: 'DEPT-QC', nameAr: 'إدارة الجودة والرقابة', nameEn: 'Quality Control Department' },
      { tempKey: 'line_a', parentTempKey: 'dept_prod', typeCode: 'UNIT', codePrefix: 'LINE-A', nameAr: 'خط إنتاج أ', nameEn: 'Production Line A' },
      { tempKey: 'line_b', parentTempKey: 'dept_prod', typeCode: 'UNIT', codePrefix: 'LINE-B', nameAr: 'خط إنتاج ب', nameEn: 'Production Line B' },
    ]
  },
  {
    id: 'tpl-poultry',
    code: 'POULTRY_STD',
    nameAr: 'هيكل شركة إنتاج داجني وحيواني',
    nameEn: 'Poultry & Livestock Template',
    descriptionAr: 'هيكل ينظم القطاعات الزراعية، المحطات، المزارع، ومصانع الأعلاف',
    descriptionEn: 'Structure tailored for poultry farms, hatcheries, feed mills, and processing plants.',
    category: 'Poultry',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'POULTRY-HQ', nameAr: 'شركة الإنتاج الداجني', nameEn: 'Poultry Enterprise HQ' },
      { tempKey: 'sec_farms', parentTempKey: 'comp', typeCode: 'SECTOR', codePrefix: 'SEC-FARMS', nameAr: 'قطاع المزارع والتربية', nameEn: 'Farms & Breeding Sector' },
      { tempKey: 'sec_processing', parentTempKey: 'comp', typeCode: 'SECTOR', codePrefix: 'SEC-PROC', nameAr: 'قطاع المجازر والتصنيع', nameEn: 'Processing & Slaughterhouse Sector' },
      { tempKey: 'stn_salam', parentTempKey: 'sec_farms', typeCode: 'STATION', codePrefix: 'STN-SALAM', nameAr: 'محطة السلام الدواجن', nameEn: 'El-Salam Station' },
      { tempKey: 'farm_salam_1', parentTempKey: 'stn_salam', typeCode: 'FARM', codePrefix: 'FRM-SLM-01', nameAr: 'مزرعة تسمين السلام 1', nameEn: 'El-Salam Broiler Farm 1' },
      { tempKey: 'farm_salam_2', parentTempKey: 'stn_salam', typeCode: 'FARM', codePrefix: 'FRM-SLM-02', nameAr: 'مزرعة تسمين السلام 2', nameEn: 'El-Salam Broiler Farm 2' },
    ]
  },
  {
    id: 'tpl-construction',
    code: 'CONST_STD',
    nameAr: 'هيكل شركة مقاولات وإنشاءات',
    nameEn: 'Construction & Contracting Template',
    descriptionAr: 'هيكل ينظم المشاريع الهندسية، مواقع البناء، والمحطات والمعدات',
    descriptionEn: 'Structure for construction firms organizing engineering sectors, project sites, and equipment yards.',
    category: 'Construction',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'CONST-HQ', nameAr: 'شركة المقاولات الرئيسية', nameEn: 'Construction Corp HQ' },
      { tempKey: 'sec_civil', parentTempKey: 'comp', typeCode: 'SECTOR', codePrefix: 'SEC-CIVIL', nameAr: 'قطاع الهندسة والإنشاءات', nameEn: 'Civil Engineering Sector' },
      { tempKey: 'reg_capital', parentTempKey: 'sec_civil', typeCode: 'REGION', codePrefix: 'REG-CAPITAL', nameAr: 'إقليم العاصمة الإدارية', nameEn: 'New Capital Region' },
      { tempKey: 'stn_site_1', parentTempKey: 'reg_capital', typeCode: 'STATION', codePrefix: 'SITE-NC-01', nameAr: 'موقع مشروع حي المال والأعمال', nameEn: 'Financial District Site' },
      { tempKey: 'dept_equipment', parentTempKey: 'stn_site_1', typeCode: 'DEPARTMENT', codePrefix: 'DEPT-EQP', nameAr: 'إدارة المعدات والآليات', nameEn: 'Heavy Equipment Division' },
    ]
  },
  {
    id: 'tpl-healthcare',
    code: 'HEALTH_STD',
    nameAr: 'هيكل مؤسسة رعاية صحية ومستشفيات',
    nameEn: 'Healthcare & Hospital Network Template',
    descriptionAr: 'هيكل ينظم المستشفيات، المجمعات الطبية، الأقسام العلاجية والخدمات المساندة',
    descriptionEn: 'Structure for hospitals, medical centers, clinical departments, and pharmacy networks.',
    category: 'Healthcare',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'MED-GRP', nameAr: 'مجموعة الرعاية الصحية', nameEn: 'Healthcare Medical Group' },
      { tempKey: 'hosp_main', parentTempKey: 'comp', typeCode: 'BRANCH', codePrefix: 'HOSP-01', nameAr: 'المستشفى الرئيسي', nameEn: 'Main Hospital Center' },
      { tempKey: 'dept_icu', parentTempKey: 'hosp_main', typeCode: 'DEPARTMENT', codePrefix: 'DEPT-ICU', nameAr: 'قسم العناية المركزة', nameEn: 'Intensive Care Unit' },
      { tempKey: 'dept_pharmacy', parentTempKey: 'hosp_main', typeCode: 'DEPARTMENT', codePrefix: 'DEPT-PHARM', nameAr: 'إدارة الصيدلة والمستلزمات الطبية', nameEn: 'Central Medical Pharmacy' },
    ]
  },
  {
    id: 'tpl-retail',
    code: 'RETAIL_STD',
    nameAr: 'هيكل سلسلة تجارة تجزئة وسوبرماركت',
    nameEn: 'Retail Store Network Template',
    descriptionAr: 'هيكل ينظم منافذ البيع والمتاجر والمستودعات المركزية',
    descriptionEn: 'Structure for retail chain stores, supermarkets, regional hubs, and retail outlets.',
    category: 'Retail',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'RETAIL-HQ', nameAr: 'شركة تجارة التجزئة', nameEn: 'Retail Enterprise HQ' },
      { tempKey: 'reg_north', parentTempKey: 'comp', typeCode: 'REGION', codePrefix: 'REG-N', nameAr: 'قطاع الفروع الشمالية', nameEn: 'Northern Retail Zone' },
      { tempKey: 'store_01', parentTempKey: 'reg_north', typeCode: 'BRANCH', codePrefix: 'STORE-01', nameAr: 'فرع الهايبر ماركت 1', nameEn: 'Hypermarket Store 1' },
      { tempKey: 'store_02', parentTempKey: 'reg_north', typeCode: 'BRANCH', codePrefix: 'STORE-02', nameAr: 'فرع الإكسبريس 2', nameEn: 'Express Outlet Store 2' },
    ]
  },
  {
    id: 'tpl-restaurants',
    code: 'REST_STD',
    nameAr: 'هيكل سلسلة مطاعم ومطابخ مركزية',
    nameEn: 'Restaurant Chain & Central Kitchen Template',
    descriptionAr: 'هيكل ينظم المطابخ المركزية، فروع المطاعم، وإدارات التجهيز والخدمة',
    descriptionEn: 'Structure for restaurant chains, central commissary kitchens, and dining outlets.',
    category: 'Restaurants',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'FOOD-HQ', nameAr: 'مجموعة المطاعم والأغذية', nameEn: 'Food Services Group HQ' },
      { tempKey: 'kitchen_central', parentTempKey: 'comp', typeCode: 'FACTORY', codePrefix: 'CK-01', nameAr: 'المطبخ المركزي والمجهز', nameEn: 'Central Commissary Kitchen' },
      { tempKey: 'rest_branch_1', parentTempKey: 'comp', typeCode: 'BRANCH', codePrefix: 'REST-01', nameAr: 'فرع مطعم النيل', nameEn: 'Nile Restaurant Outlet' },
      { tempKey: 'rest_branch_2', parentTempKey: 'comp', typeCode: 'BRANCH', codePrefix: 'REST-02', nameAr: 'فرع مطعم الشاطئ', nameEn: 'Beach Restaurant Outlet' },
    ]
  },
  {
    id: 'tpl-holding',
    code: 'HOLDING_STD',
    nameAr: 'هيكل مجموعة شركات قابضة',
    nameEn: 'Holding Company Group Template',
    descriptionAr: 'هيكل ينظم الشركات التابعة المتعددة تحت مظلة الشركة القابضة',
    descriptionEn: 'Structure for holding corporations managing multiple subsidiary companies across sectors.',
    category: 'Holding Company',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'holding', parentTempKey: null, typeCode: 'HOLDING', codePrefix: 'GRP-HOLD', nameAr: 'المجموعة القابضة', nameEn: 'Parent Holding Group' },
      { tempKey: 'sub_agri', parentTempKey: 'holding', typeCode: 'COMPANY', codePrefix: 'COMP-AGRI', nameAr: 'الشركة التابعة للتنمية الزراعية', nameEn: 'Agricultural Subsidiary Co' },
      { tempKey: 'sub_trade', parentTempKey: 'holding', typeCode: 'COMPANY', codePrefix: 'COMP-TRD', nameAr: 'الشركة التابعة للتجارة والاستيراد', nameEn: 'Trading Subsidiary Co' },
      { tempKey: 'sec_agri_farms', parentTempKey: 'sub_agri', typeCode: 'SECTOR', codePrefix: 'SEC-AGRI-F', nameAr: 'قطاع الإنتاج الزراعي', nameEn: 'Agricultural Sector' },
    ]
  },
  {
    id: 'tpl-educational',
    code: 'EDU_STD',
    nameAr: 'هيكل مؤسسة تعليمية وجامعية',
    nameEn: 'Educational Network & Campus Template',
    descriptionAr: 'هيكل ينظم المجمعات التعليمية، الكليات، المدارس، والمعامل والأنشطة',
    descriptionEn: 'Structure for schools, universities, faculties, and academic departments.',
    category: 'Educational',
    isPredefined: true,
    companyId: null,
    units: [
      { tempKey: 'comp', parentTempKey: null, typeCode: 'COMPANY', codePrefix: 'EDU-CORP', nameAr: 'المؤسسة التعليمية', nameEn: 'Educational System HQ' },
      { tempKey: 'campus_main', parentTempKey: 'comp', typeCode: 'BRANCH', codePrefix: 'CAMPUS-01', nameAr: 'المجمع التعليمي الرئيسي', nameEn: 'Main Campus' },
      { tempKey: 'dept_academic', parentTempKey: 'campus_main', typeCode: 'DEPARTMENT', codePrefix: 'DEPT-ACAD', nameAr: 'الشؤون الأكاديمية والتعليمية', nameEn: 'Academic Affairs' },
      { tempKey: 'dept_admin', parentTempKey: 'campus_main', typeCode: 'DEPARTMENT', codePrefix: 'DEPT-ADM', nameAr: 'الإدارة والخدمات المساندة', nameEn: 'Administrative Services' },
    ]
  }
];


export class OrganizationEngine {
  private static _unitLookupIndex: Map<string, OrganizationUnit> | null = null;
  private static _unitsVersionKey: string = '';

  static invalidateLookupIndex(): void {
    OrganizationEngine._unitLookupIndex = null;
    OrganizationEngine._unitsVersionKey = '';
  }

  static getUnitsVersionKey(): string {
    const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    return `${units.length}_${units[0]?.id || ''}_${units[units.length - 1]?.id || ''}_${units[units.length - 1]?.updatedAt || ''}`;
  }

  static getUnitLookupIndex(): Map<string, OrganizationUnit> {
    const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    const currentVersionKey = `${units.length}_${units[0]?.id || ''}_${units[units.length - 1]?.id || ''}_${units[units.length - 1]?.updatedAt || ''}`;
    if (OrganizationEngine._unitLookupIndex && OrganizationEngine._unitsVersionKey === currentVersionKey) {
      return OrganizationEngine._unitLookupIndex;
    }

    const index = new Map<string, OrganizationUnit>();
    for (const u of units) {
      index.set(u.id, u);
      if (u.code) index.set(u.code, u);
      if (u.metadata?.legacyStationId) {
        index.set(u.metadata.legacyStationId, u);
        index.set(`org-unit-station-${u.metadata.legacyStationId}`, u);
      }
      if (u.metadata?.legacy_station_id) {
        index.set(u.metadata.legacy_station_id, u);
        index.set(`org-unit-station-${u.metadata.legacy_station_id}`, u);
      }
      if (u.metadata?.legacyRegionId) {
        index.set(u.metadata.legacyRegionId, u);
        index.set(`org-unit-region-${u.metadata.legacyRegionId}`, u);
      }
      if (u.metadata?.legacy_region_id) {
        index.set(u.metadata.legacy_region_id, u);
        index.set(`org-unit-region-${u.metadata.legacy_region_id}`, u);
      }
      if (u.metadata?.legacyCompanyId) {
        index.set(u.metadata.legacyCompanyId, u);
        index.set(`org-unit-company-${u.metadata.legacyCompanyId}`, u);
      }
      if (u.metadata?.legacy_company_id) {
        index.set(u.metadata.legacy_company_id, u);
        index.set(`org-unit-company-${u.metadata.legacy_company_id}`, u);
      }
      if (u.parentId === null && (u.companyId || u.company_id)) {
        index.set(`comp-root-${u.companyId || u.company_id}`, u);
      }
    }

    OrganizationEngine._unitLookupIndex = index;
    OrganizationEngine._unitsVersionKey = currentVersionKey;
    return index;
  }

  // --- Organization Unit Types ---

  static getUnitTypes(companyId?: string): OrganizationUnitType[] {
    const types = StorageEngine.getStored<OrganizationUnitType[]>('organization_unit_types', DEFAULT_ORGANIZATION_UNIT_TYPES);
    const effectiveTypes = (types && types.length > 0) ? types : DEFAULT_ORGANIZATION_UNIT_TYPES;
    if (!companyId) return effectiveTypes;
    return effectiveTypes.filter(t => t.companyId === null || t.companyId === companyId);
  }

  static saveUnitTypes(types: OrganizationUnitType[]): void {
    StorageEngine.setStored('organization_unit_types', types);
    types.forEach(t => dbSetDoc('organization_unit_types', t.id, t));
  }

  static addUnitType(typeData: Omit<OrganizationUnitType, 'id'>): OrganizationUnitType {
    const types = StorageEngine.getStored<OrganizationUnitType[]>('organization_unit_types', DEFAULT_ORGANIZATION_UNIT_TYPES);
    const newType: OrganizationUnitType = {
      ...typeData,
      id: `out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    types.push(newType);
    OrganizationEngine.saveUnitTypes(types);
    return newType;
  }

  static updateUnitType(id: string, updates: Partial<OrganizationUnitType>): OrganizationUnitType | null {
    const types = StorageEngine.getStored<OrganizationUnitType[]>('organization_unit_types', DEFAULT_ORGANIZATION_UNIT_TYPES);
    const idx = types.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const updated: OrganizationUnitType = {
      ...types[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    types[idx] = updated;
    OrganizationEngine.saveUnitTypes(types);
    return updated;
  }

  // --- Organization Units ---

  static getOrganizationUnits(companyId?: string): OrganizationUnit[] {
    return OrganizationEngine.getUnits(companyId);
  }

  static addOrganizationUnit(params: {
    companyId: string;
    parentId?: string | null;
    typeId?: string;
    typeCode?: string;
    code: string;
    name?: string;
    nameAr: string;
    nameEn: string;
    metadata?: Record<string, any>;
    isActive?: boolean;
  }): OrganizationUnit {
    const unitTypes = OrganizationEngine.getUnitTypes(params.companyId);
    let effectiveTypeId = params.typeId;

    if (!effectiveTypeId && params.typeCode) {
      const matched = unitTypes.find(t => t.code && params.typeCode && t.code.toUpperCase() === params.typeCode.toUpperCase());
      effectiveTypeId = matched ? matched.id : 'out-unit';
    }

    return OrganizationEngine.addUnit({
      companyId: params.companyId,
      parentId: params.parentId,
      typeId: effectiveTypeId || 'out-unit',
      code: params.code,
      name: params.nameAr || params.name || params.nameEn || params.code,
      nameAr: params.nameAr,
      nameEn: params.nameEn,
      metadata: params.metadata,
      isActive: params.isActive,
    });
  }

  static getDescendantUnits(rootUnitId: string, companyId?: string): OrganizationUnit[] {
    const subtree = OrganizationEngine.getUnitSubtree(rootUnitId);
    return subtree.filter(u => u.id !== rootUnitId);
  }

  /**
   * Automatically migrates legacy Company -> Region -> Station structure into the Organization Tree without data loss.
   * Ensures idempotency: existing organization units will be reused.
   */
  static autoMigrateLegacyStructure(targetCompanyId?: string): { migratedUnitsCount: number; updatedUsersCount: number } {
    const existingUnits = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    const existingUnitIds = new Set(existingUnits.map(u => u.id));

    const companies = CompaniesModule.getCompanies();
    const filterCompanies = targetCompanyId ? companies.filter(c => c.id === targetCompanyId) : companies;

    const regions = StationsModule.getRegions();
    const stations = StationsModule.getStations();

    let migratedUnitsCount = 0;

    for (const company of filterCompanies) {
      // 1. Ensure Company Root Organization Unit
      const companyUnitId = `org-unit-company-${company.id}`;
      let companyUnit = existingUnits.find(u => u.id === companyUnitId || (u.companyId === company.id && u.typeId === 'out-company'));
      
      if (!companyUnit) {
        companyUnit = {
          id: companyUnitId,
          companyId: company.id,
          parentId: null,
          typeId: 'out-company',
          code: company.code || company.id.toUpperCase(),
          name: company.name,
          nameAr: company.name,
          nameEn: company.name,
          path: `/${companyUnitId}`,
          level: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { legacyCompanyId: company.id }
        };
        existingUnits.push(companyUnit);
        existingUnitIds.add(companyUnit.id);
        migratedUnitsCount++;
      }

      // 2. Ensure Region Organization Units
      const compRegions = regions.filter(r => r.company_id === company.id);
      for (const reg of compRegions) {
        const regionUnitId = `org-unit-region-${reg.id}`;
        let regionUnit = existingUnits.find(u => u.id === regionUnitId || (u.metadata && u.metadata.legacyRegionId === reg.id));

        if (!regionUnit) {
          regionUnit = {
            id: regionUnitId,
            companyId: company.id,
            parentId: companyUnit.id,
            typeId: 'out-region',
            code: reg.code || `REG-${reg.id}`,
            name: reg.name,
            nameAr: reg.name,
            nameEn: reg.name,
            path: `${companyUnit.path}/${regionUnitId}`,
            level: 1,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: { legacyRegionId: reg.id }
          };
          existingUnits.push(regionUnit);
          existingUnitIds.add(regionUnit.id);
          migratedUnitsCount++;
        }

        // Link region to org unit if missing
        if (!reg.org_unit_id) {
          reg.org_unit_id = regionUnit.id;
        }
      }

      // 3. Ensure Station Organization Units
      const compStations = stations.filter(s => s.company_id === company.id);
      for (const stn of compStations) {
        const stationUnitId = `org-unit-station-${stn.id}`;
        let stationUnit = existingUnits.find(u => u.id === stationUnitId || (u.metadata && u.metadata.legacyStationId === stn.id));

        if (!stationUnit) {
          let parentUnitId = companyUnit.id;
          if (stn.region_id) {
            const parentRegUnit = existingUnits.find(u => u.id === `org-unit-region-${stn.region_id}` || (u.metadata && u.metadata.legacyRegionId === stn.region_id));
            if (parentRegUnit) {
              parentUnitId = parentRegUnit.id;
            }
          }

          const parentUnit = existingUnits.find(u => u.id === parentUnitId);
          const parentPath = parentUnit?.path || `/${companyUnit.id}`;
          const parentLevel = parentUnit?.level ?? 0;

          stationUnit = {
            id: stationUnitId,
            companyId: company.id,
            parentId: parentUnitId,
            typeId: 'out-station',
            code: stn.station_code || `STN-${stn.id}`,
            name: stn.station_name,
            nameAr: stn.station_name,
            nameEn: stn.station_name,
            path: `${parentPath}/${stationUnitId}`,
            level: parentLevel + 1,
            isActive: stn.is_active !== false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: { legacyStationId: stn.id, custodyAmount: stn.custody_amount }
          };
          existingUnits.push(stationUnit);
          existingUnitIds.add(stationUnit.id);
          migratedUnitsCount++;
        }

        // Link station to org unit if missing
        if (!stn.org_unit_id) {
          stn.org_unit_id = stationUnit.id;
        }
      }
    }

    // Save updated units
    if (migratedUnitsCount > 0) {
      OrganizationEngine.saveUnits(existingUnits);
      StationsModule.saveRegions(regions);
      StationsModule.saveStations(stations);
    }

    // 4. Backfill AppUsers' org_unit_id
    const users = UsersModule.getUsers();
    let updatedUsersCount = 0;

    users.forEach(u => {
      if (!u.org_unit_id) {
        if (u.station_id) {
          u.org_unit_id = `org-unit-station-${u.station_id}`;
          updatedUsersCount++;
        } else if (u.region_id) {
          u.org_unit_id = `org-unit-region-${u.region_id}`;
          updatedUsersCount++;
        }
      }
    });

    if (updatedUsersCount > 0) {
      UsersModule.saveUsers(users);
    }

    return { migratedUnitsCount, updatedUsersCount };
  }

  static getUnits(companyId?: string): OrganizationUnit[] {
    let units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    if (units.length === 0) {
      OrganizationEngine.autoMigrateLegacyStructure();
      units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    }

    units = units.map(u => ({
      ...u,
      max_accounts_allowed: u.max_accounts_allowed ?? 1
    }));

    if (!companyId) return units;

    let filtered = units.filter(u => (u.companyId || u.company_id) === companyId);
    if (filtered.length === 0) {
      OrganizationEngine.autoMigrateLegacyStructure(companyId);
      units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
      filtered = units.map(u => ({
        ...u,
        max_accounts_allowed: u.max_accounts_allowed ?? 1
      })).filter(u => (u.companyId || u.company_id) === companyId);
    }

    return filtered;
  }

  static getUnitById(id: string): OrganizationUnit | null {
    const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    const found = units.find(u => u.id === id);
    if (!found) return null;
    return {
      ...found,
      max_accounts_allowed: found.max_accounts_allowed ?? 1
    };
  }

  static saveUnits(units: OrganizationUnit[]): void {
    OrganizationEngine.invalidateLookupIndex();
    StorageEngine.setStored('organization_units', units);
    units.forEach(u => dbSetDoc('organization_units', u.id, u));
  }

  static savePaths(paths: OrganizationPath[]): void {
    StorageEngine.setStored('organization_paths', paths);
    paths.forEach(p => dbSetDoc('organization_paths', p.id, p));
  }

  static getPaths(companyId?: string): OrganizationPath[] {
    const paths = StorageEngine.getStored<OrganizationPath[]>('organization_paths', []);
    if (!companyId) return paths;
    return paths.filter(p => p.companyId === companyId);
  }

  static getPathByUnitId(unitId: string): OrganizationPath | null {
    const paths = StorageEngine.getStored<OrganizationPath[]>('organization_paths', []);
    return paths.find(p => p.unitId === unitId) || null;
  }

  /**
   * Helper to compute path, level, and ancestorIds for a unit given its parent ID
   */
  private static computePathAndLevel(
    unitId: string,
    parentId: string | null,
    units: OrganizationUnit[]
  ): { path: string; level: number; ancestorIds: string[] } {
    if (!parentId) {
      return {
        path: `/${unitId}`,
        level: 0,
        ancestorIds: [],
      };
    }

    const parent = units.find(u => u.id === parentId);
    if (!parent) {
      return {
        path: `/${unitId}`,
        level: 0,
        ancestorIds: [],
      };
    }

    const parentPath = parent.path || `/${parent.id}`;
    const parentAncestors = OrganizationEngine.getAncestorsFromPath(parentPath, units);

    return {
      path: `${parentPath}/${unitId}`,
      level: (parent.level ?? 0) + 1,
      ancestorIds: [...parentAncestors.map(a => a.id), parent.id],
    };
  }

  private static getAncestorsFromPath(path: string, units: OrganizationUnit[]): OrganizationUnit[] {
    const segments = path.split('/').filter(Boolean);
    // last segment is current unit, so pop it
    segments.pop();
    const ancestors: OrganizationUnit[] = [];
    for (const segId of segments) {
      const u = units.find(unit => unit.id === segId);
      if (u) ancestors.push(u);
    }
    return ancestors;
  }

  static addUnit(params: {
    companyId: string;
    parentId?: string | null;
    typeId: string;
    code: string;
    name: string;
    nameAr?: string;
    nameEn?: string;
    metadata?: Record<string, any>;
    isActive?: boolean;
    max_accounts_allowed?: number;
  }): OrganizationUnit {
    const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    const paths = StorageEngine.getStored<OrganizationPath[]>('organization_paths', []);

    const unitId = `orgunit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const parentId = params.parentId || null;

    const { path, level, ancestorIds } = OrganizationEngine.computePathAndLevel(unitId, parentId, units);

    const now = new Date().toISOString();

    const newUnit: OrganizationUnit = {
      id: unitId,
      companyId: params.companyId,
      company_id: params.companyId,
      parentId,
      parent_id: parentId,
      typeId: params.typeId,
      type_id: params.typeId,
      code: params.code,
      name: params.name,
      nameAr: params.nameAr || params.name,
      nameEn: params.nameEn || params.name,
      path,
      level,
      metadata: params.metadata || {},
      isActive: params.isActive ?? true,
      is_active: params.isActive ?? true,
      max_accounts_allowed: params.max_accounts_allowed ?? 1,
      createdAt: now,
      updatedAt: now,
    };

    units.push(newUnit);
    OrganizationEngine.saveUnits(units);

    // Save corresponding OrganizationPath
    const newPathObj: OrganizationPath = {
      id: unitId,
      unitId,
      companyId: params.companyId,
      path,
      ancestorIds,
      depth: level,
      updatedAt: now,
    };

    paths.push(newPathObj);
    OrganizationEngine.savePaths(paths);

    // Reverse compatibility sync: if type is region or station, ensure legacy record exists
    try {
      if (params.typeId === 'out-region' || (params.metadata && params.metadata.legacyRegionId)) {
        const regId = (params.metadata && params.metadata.legacyRegionId) || unitId.replace('org-unit-region-', '');
        const regions = StationsModule.getRegions();
        if (!regions.some(r => r.id === regId)) {
          regions.push({
            id: regId,
            name: params.name,
            code: params.code,
            company_id: params.companyId,
            org_unit_id: unitId
          });
          StationsModule.saveRegions(regions);
        }
      } else if (params.typeId === 'out-station' || (params.metadata && params.metadata.legacyStationId)) {
        const stnId = (params.metadata && params.metadata.legacyStationId) || unitId.replace('org-unit-station-', '');
        const stations = StationsModule.getStations();
        if (!stations.some(s => s.id === stnId)) {
          let legacyRegId: string | undefined = undefined;
          if (params.parentId) {
            const parentUnit = units.find(u => u.id === params.parentId);
            if (parentUnit && (parentUnit.typeId === 'out-region' || parentUnit.metadata?.legacyRegionId)) {
              legacyRegId = parentUnit.metadata?.legacyRegionId || parentUnit.id.replace('org-unit-region-', '');
            }
          }
          stations.push({
            id: stnId,
            station_name: params.name,
            station_code: params.code,
            custody_amount: params.metadata?.custodyAmount || 0,
            is_active: params.isActive ?? true,
            region_id: legacyRegId,
            company_id: params.companyId,
            org_unit_id: unitId
          });
          StationsModule.saveStations(stations);
        }
      }
    } catch (err) {
      console.warn('Reverse compatibility sync failed in addUnit:', err);
    }

    const activeUser = UsersModule.getActiveUser();
    LogsModule.addLog(
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      'Add Organization Unit',
      `Created organization unit: ${params.name} (${params.code}) under company ${params.companyId}`
    );

    return newUnit;
  }

  static updateUnit(id: string, updates: Partial<Omit<OrganizationUnit, 'id'>>): OrganizationUnit | null {
    let units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    let paths = StorageEngine.getStored<OrganizationPath[]>('organization_paths', []);

    const idx = units.findIndex(u => u.id === id);
    if (idx === -1) return null;

    const currentUnit = units[idx];
    const newParentId = updates.parentId !== undefined ? updates.parentId : (updates.parent_id !== undefined ? updates.parent_id : currentUnit.parentId);
    const parentChanged = newParentId !== currentUnit.parentId;

    const now = new Date().toISOString();

    let updatedUnit: OrganizationUnit = {
      ...currentUnit,
      ...updates,
      parentId: newParentId,
      parent_id: newParentId,
      companyId: updates.companyId || updates.company_id || currentUnit.companyId,
      company_id: updates.companyId || updates.company_id || currentUnit.company_id || currentUnit.companyId,
      typeId: updates.typeId || updates.type_id || currentUnit.typeId,
      type_id: updates.typeId || updates.type_id || currentUnit.type_id || currentUnit.typeId,
      isActive: updates.isActive ?? updates.is_active ?? currentUnit.isActive,
      is_active: updates.isActive ?? updates.is_active ?? currentUnit.is_active ?? currentUnit.isActive,
      updatedAt: now,
    };

    // Recalculate path & level if parent changed
    if (parentChanged) {
      const { path, level } = OrganizationEngine.computePathAndLevel(id, newParentId, units);
      updatedUnit.path = path;
      updatedUnit.level = level;
    }

    units[idx] = updatedUnit;

    // Update path for current unit and all descendants if path changed
    if (parentChanged) {
      units = OrganizationEngine.recalculateSubtreePaths(id, units, paths);
    }

    OrganizationEngine.saveUnits(units);

    // Sync path object for updated unit
    const unitPathObj = OrganizationEngine.getPaths().find(p => p.unitId === id);
    if (unitPathObj) {
      const { ancestorIds } = OrganizationEngine.computePathAndLevel(id, updatedUnit.parentId, units);
      const updatedPathObj: OrganizationPath = {
        ...unitPathObj,
        path: updatedUnit.path,
        ancestorIds,
        depth: updatedUnit.level,
        updatedAt: now,
      };
      paths = StorageEngine.getStored<OrganizationPath[]>('organization_paths', []);
      const pIdx = paths.findIndex(p => p.unitId === id);
      if (pIdx !== -1) {
        paths[pIdx] = updatedPathObj;
      } else {
        paths.push(updatedPathObj);
      }
      OrganizationEngine.savePaths(paths);
    }

    // Reverse compatibility sync
    try {
      if (updatedUnit.typeId === 'out-region' || updatedUnit.metadata?.legacyRegionId) {
        const regId = updatedUnit.metadata?.legacyRegionId || updatedUnit.id.replace('org-unit-region-', '');
        const regions = StationsModule.getRegions();
        const rIdx = regions.findIndex(r => r.id === regId);
        if (rIdx !== -1) {
          regions[rIdx] = {
            ...regions[rIdx],
            name: updatedUnit.name || updatedUnit.nameAr || regions[rIdx].name,
            code: updatedUnit.code || regions[rIdx].code,
            company_id: updatedUnit.companyId || regions[rIdx].company_id
          };
          StationsModule.saveRegions(regions);
        }
      } else if (updatedUnit.typeId === 'out-station' || updatedUnit.metadata?.legacyStationId) {
        const stnId = updatedUnit.metadata?.legacyStationId || updatedUnit.id.replace('org-unit-station-', '');
        const stations = StationsModule.getStations();
        const sIdx = stations.findIndex(s => s.id === stnId);
        if (sIdx !== -1) {
          stations[sIdx] = {
            ...stations[sIdx],
            station_name: updatedUnit.name || updatedUnit.nameAr || stations[sIdx].station_name,
            station_code: updatedUnit.code || stations[sIdx].station_code,
            is_active: updatedUnit.isActive ?? stations[sIdx].is_active,
            custody_amount: updatedUnit.metadata?.custodyAmount !== undefined ? updatedUnit.metadata.custodyAmount : stations[sIdx].custody_amount,
            company_id: updatedUnit.companyId || stations[sIdx].company_id
          };
          StationsModule.saveStations(stations);
        }
      }
    } catch (err) {
      console.warn('Reverse compatibility sync failed in updateUnit:', err);
    }

    const activeUser = UsersModule.getActiveUser();
    LogsModule.addLog(
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      'Update Organization Unit',
      `Updated organization unit: ${updatedUnit.name} (${id})`
    );

    return updatedUnit;
  }

  private static recalculateSubtreePaths(
    rootId: string,
    units: OrganizationUnit[],
    paths: OrganizationPath[]
  ): OrganizationUnit[] {
    const root = units.find(u => u.id === rootId);
    if (!root) return units;

    // Find all immediate children
    const children = units.filter(u => u.parentId === rootId);
    for (const child of children) {
      const { path, level, ancestorIds } = OrganizationEngine.computePathAndLevel(child.id, rootId, units);
      child.path = path;
      child.level = level;
      child.updatedAt = new Date().toISOString();

      // Update paths
      const pIdx = paths.findIndex(p => p.unitId === child.id);
      if (pIdx !== -1) {
        paths[pIdx] = {
          ...paths[pIdx],
          path,
          ancestorIds,
          depth: level,
          updatedAt: new Date().toISOString(),
        };
      }

      // Recurse down
      OrganizationEngine.recalculateSubtreePaths(child.id, units, paths);
    }

    return units;
  }

  static deleteUnit(id: string): boolean {
    let units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
    let paths = StorageEngine.getStored<OrganizationPath[]>('organization_paths', []);

    const target = units.find(u => u.id === id);
    if (!target) return false;

    // Prevent deletion if unit has active children
    const hasChildren = units.some(u => u.parentId === id);
    if (hasChildren) {
      throw new Error(`Cannot delete organization unit ${id} because it has child units.`);
    }

    units = units.filter(u => u.id !== id);
    paths = paths.filter(p => p.unitId !== id);

    OrganizationEngine.saveUnits(units);
    OrganizationEngine.savePaths(paths);

    dbDeleteDoc('organization_units', id);
    dbDeleteDoc('organization_paths', id);

    // Reverse compatibility sync
    try {
      if (target.typeId === 'out-region' || target.metadata?.legacyRegionId) {
        const regId = target.metadata?.legacyRegionId || target.id.replace('org-unit-region-', '');
        const regions = StationsModule.getRegions().filter(r => r.id !== regId);
        StationsModule.saveRegions(regions);
        dbDeleteDoc('regions', regId);
      } else if (target.typeId === 'out-station' || target.metadata?.legacyStationId) {
        const stnId = target.metadata?.legacyStationId || target.id.replace('org-unit-station-', '');
        const stations = StationsModule.getStations().filter(s => s.id !== stnId);
        StationsModule.saveStations(stations);
        dbDeleteDoc('stations', stnId);
      }
    } catch (err) {
      console.warn('Reverse compatibility sync failed in deleteUnit:', err);
    }

    const activeUser = UsersModule.getActiveUser();
    LogsModule.addLog(
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      'Delete Organization Unit',
      `Deleted organization unit ID: ${id}`
    );

    return true;
  }

  // --- Subtree & Ancestor Queries ---

  static getUnitChildren(parentId: string | null, companyId?: string): OrganizationUnit[] {
    const units = OrganizationEngine.getUnits(companyId);
    return units.filter(u => u.parentId === parentId);
  }

  static getUnitSubtree(rootUnitId: string): OrganizationUnit[] {
    const root = OrganizationEngine.getUnitById(rootUnitId);
    if (!root) return [];

    const units = OrganizationEngine.getUnits(root.companyId);
    const rootPath = root.path || `/${root.id}`;
    const cleanPath = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath;

    return units.filter(u => {
      if (!u.path) return u.id === rootUnitId;
      const uClean = u.path.endsWith('/') ? u.path.slice(0, -1) : u.path;
      return uClean === cleanPath || uClean.startsWith(`${cleanPath}/`);
    });
  }

  static getSubtreeUnitIds(rootUnitId: string, _companyId?: string): string[] {
    const subtree = OrganizationEngine.getUnitSubtree(rootUnitId);
    return subtree.map(u => u.id);
  }

  static getUnitAncestors(unitId: string): OrganizationUnit[] {
    const unit = OrganizationEngine.getUnitById(unitId);
    if (!unit) return [];

    const units = OrganizationEngine.getUnits(unit.companyId);
    const pathObj = OrganizationEngine.getPathByUnitId(unitId);

    if (pathObj && pathObj.ancestorIds.length > 0) {
      return pathObj.ancestorIds.map(aid => units.find(u => u.id === aid)).filter((u): u is OrganizationUnit => Boolean(u));
    }

    // Fallback parsing from path
    const pathSegments = (unit.path || '').split('/').filter(Boolean);
    pathSegments.pop(); // remove current unit
    return pathSegments.map(segId => units.find(u => u.id === segId)).filter((u): u is OrganizationUnit => Boolean(u));
  }

  // --- Phase 3: Organization Templates ---

  static getTemplates(companyId?: string): OrganizationTemplate[] {
    const templates = StorageEngine.getStored<OrganizationTemplate[]>('organization_templates', DEFAULT_ORGANIZATION_TEMPLATES);
    const effectiveTemplates = (templates && templates.length > 0) ? templates : DEFAULT_ORGANIZATION_TEMPLATES;
    if (!companyId) return effectiveTemplates;
    return effectiveTemplates.filter(t => t.companyId === null || t.companyId === companyId);
  }

  static getTemplateById(id: string): OrganizationTemplate | null {
    const templates = OrganizationEngine.getTemplates();
    return templates.find(t => t.id === id) || null;
  }

  static saveTemplates(templates: OrganizationTemplate[]): void {
    StorageEngine.setStored('organization_templates', templates);
    templates.forEach(t => dbSetDoc('organization_templates', t.id, t));
  }

  static addCustomTemplate(templateData: Omit<OrganizationTemplate, 'id' | 'isPredefined'>): OrganizationTemplate {
    const templates = StorageEngine.getStored<OrganizationTemplate[]>('organization_templates', DEFAULT_ORGANIZATION_TEMPLATES);
    const newTemplate: OrganizationTemplate = {
      ...templateData,
      id: `tpl-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      isPredefined: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    templates.push(newTemplate);
    OrganizationEngine.saveTemplates(templates);

    const activeUser = UsersModule.getActiveUser();
    LogsModule.addLog(
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      'Add Custom Organization Template',
      `Created custom template: ${newTemplate.nameAr} (${newTemplate.code})`
    );

    return newTemplate;
  }

  /**
   * Instantiates an Organization Template for a target company, generating all organization units and materialized paths.
   */
  static applyTemplateToCompany(
    companyId: string,
    templateId: string,
    customRootName?: string
  ): OrganizationUnit[] {
    const template = OrganizationEngine.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Organization template ${templateId} not found.`);
    }

    const unitTypes = OrganizationEngine.getUnitTypes(companyId);
    const createdKeyMap = new Map<string, string>(); // tempKey -> actual Unit ID
    const createdUnits: OrganizationUnit[] = [];

    for (const spec of template.units) {
      const parentUnitId = spec.parentTempKey ? (createdKeyMap.get(spec.parentTempKey) || null) : null;

      // Match typeCode to unitType ID
      const matchedType = unitTypes.find(t => t.code && spec.typeCode && t.code.toUpperCase() === spec.typeCode.toUpperCase());
      const typeId = matchedType ? matchedType.id : 'out-unit';

      const isRootSpec = spec.parentTempKey === null;
      const unitName = (isRootSpec && customRootName) ? customRootName : spec.nameAr;

      const createdUnit = OrganizationEngine.addUnit({
        companyId,
        parentId: parentUnitId,
        typeId,
        code: `${spec.codePrefix}-${Math.floor(100 + Math.random() * 900)}`,
        name: unitName,
        nameAr: unitName,
        nameEn: spec.nameEn,
        metadata: {
          templateId: template.id,
          templateCategory: template.category,
          specTempKey: spec.tempKey,
          ...(spec.metadata || {}),
        },
      });

      createdKeyMap.set(spec.tempKey, createdUnit.id);
      createdUnits.push(createdUnit);
    }

    const activeUser = UsersModule.getActiveUser();
    LogsModule.addLog(
      activeUser?.id || 'system',
      activeUser?.full_name || 'System',
      'Apply Organization Template',
      `Applied template ${template.nameAr} (${template.code}) to company ${companyId}, created ${createdUnits.length} units.`
    );

    return createdUnits;
  }

  // --- Phase 4: Dynamic Organization Builder (Unlimited Hierarchy) ---

  /**
   * Constructs a nested hierarchical tree structure of unlimited depth for visual rendering & dynamic builders.
   */
  static getOrganizationTree(companyId: string, rootUnitId?: string | null): OrganizationTreeNode[] {
    return OrganizationEngine.buildTree(companyId, rootUnitId);
  }

  static buildTree(companyId: string, rootUnitId?: string | null): OrganizationTreeNode[] {
    const units = OrganizationEngine.getUnits(companyId);
    const unitTypes = OrganizationEngine.getUnitTypes(companyId);
    const typeMap = new Map(unitTypes.map(t => [t.id, t]));

    const unitNodeMap = new Map<string, OrganizationTreeNode>();
    units.forEach(u => {
      const typeObj = typeMap.get(u.typeId);
      unitNodeMap.set(u.id, {
        ...u,
        typeName: typeObj ? typeObj.nameAr : undefined,
        typeCode: typeObj ? typeObj.code : undefined,
        children: [],
      });
    });

    const rootNodes: OrganizationTreeNode[] = [];

    if (rootUnitId) {
      const targetRoot = unitNodeMap.get(rootUnitId);
      if (targetRoot) {
        rootNodes.push(targetRoot);
      }
    } else {
      unitNodeMap.forEach(node => {
        if (!node.parentId || !unitNodeMap.has(node.parentId)) {
          rootNodes.push(node);
        } else {
          const parentNode = unitNodeMap.get(node.parentId);
          if (parentNode) {
            parentNode.children.push(node);
          }
        }
      });
    }

    if (rootUnitId) {
      unitNodeMap.forEach(node => {
        if (node.parentId && unitNodeMap.has(node.parentId) && node.id !== rootUnitId) {
          const parentNode = unitNodeMap.get(node.parentId);
          if (parentNode) {
            parentNode.children.push(node);
          }
        }
      });
    }

    return rootNodes;
  }

  /**
   * Generates a flat, ordered depth-indexed view of the organization hierarchy suitable for UI trees and select dropdowns.
   */
  static getTreeFlatView(companyId: string): Array<OrganizationUnit & { typeName?: string; depthIndent: number; isLeaf: boolean; childrenCount: number }> {
    const tree = OrganizationEngine.buildTree(companyId);
    const result: Array<OrganizationUnit & { typeName?: string; depthIndent: number; isLeaf: boolean; childrenCount: number }> = [];

    function traverse(nodes: OrganizationTreeNode[], currentDepth: number) {
      for (const node of nodes) {
        const isLeaf = node.children.length === 0;
        result.push({
          ...node,
          depthIndent: currentDepth,
          isLeaf,
          childrenCount: node.children.length,
        });
        if (!isLeaf) {
          traverse(node.children, currentDepth + 1);
        }
      }
    }

    traverse(tree, 0);
    return result;
  }

  /**
   * Reparents an organization unit dynamically, validating against cycle creation and re-calculating paths/levels across subtrees.
   */
  static moveUnit(unitId: string, newParentId: string | null): OrganizationUnit {
    if (unitId === newParentId) {
      throw new Error(`Cannot set parent of unit ${unitId} to itself.`);
    }

    const unit = OrganizationEngine.getUnitById(unitId);
    if (!unit) {
      throw new Error(`Unit ${unitId} not found.`);
    }

    if (newParentId) {
      const newParent = OrganizationEngine.getUnitById(newParentId);
      if (!newParent) {
        throw new Error(`Target parent unit ${newParentId} not found.`);
      }

      // Check if newParent is in the subtree of unit (prevent cycle)
      const subtree = OrganizationEngine.getUnitSubtree(unitId);
      if (subtree.some(u => u.id === newParentId)) {
        throw new Error(`Cannot move unit ${unit.nameAr} under its descendant unit ${newParent.nameAr}.`);
      }
    }

    return OrganizationEngine.updateUnit(unitId, { parentId: newParentId });
  }

  /**
   * Audits and validates the organization hierarchy for cycles, orphan nodes, and path integrity.
   */
  static validateHierarchyTree(companyId: string): OrganizationHierarchyValidationResult {
    const units = OrganizationEngine.getUnits(companyId);
    const unitMap = new Map(units.map(u => [u.id, u]));

    const orphanUnitIds: string[] = [];
    const cycleUnitIds: string[] = [];
    const errors: string[] = [];
    let maxDepth = 0;

    for (const unit of units) {
      if (unit.level > maxDepth) {
        maxDepth = unit.level;
      }

      // Check orphan
      if (unit.parentId && !unitMap.has(unit.parentId)) {
        orphanUnitIds.push(unit.id);
        errors.push(`Unit ${unit.name} (${unit.code}) references non-existent parent ID ${unit.parentId}`);
      }

      // Check cycle using Floyd's / Visited Set
      const visited = new Set<string>();
      let currId: string | null = unit.id;
      while (currId && unitMap.has(currId)) {
        if (visited.has(currId)) {
          cycleUnitIds.push(unit.id);
          errors.push(`Cycle detected involving unit ${unit.name} (${unit.code})`);
          break;
        }
        visited.add(currId);
        currId = unitMap.get(currId)?.parentId || null;
      }
    }

    return {
      isValid: orphanUnitIds.length === 0 && cycleUnitIds.length === 0,
      totalUnits: units.length,
      maxDepth,
      orphanUnitIds,
      cycleUnitIds,
      errors,
    };
  }

  /**
   * Returns the maximum depth achieved in the organization hierarchy.
   */
  static getMaxHierarchyDepth(companyId: string): number {
    const units = OrganizationEngine.getUnits(companyId);
    if (units.length === 0) return 0;
    return Math.max(...units.map(u => u.level));
  }

  /**
   * Retrieves all units at a specific hierarchy depth level.
   */
  static getUnitsAtLevel(companyId: string, level: number): OrganizationUnit[] {
    const units = OrganizationEngine.getUnits(companyId);
    return units.filter(u => u.level === level);
  }

  /**
   * Resolves the exact OrganizationUnit for any user or signup request entity.
   */
  static resolveOrgUnitForEntity(
    entity: { org_unit_id?: string; station_id?: string; region_id?: string; company_id?: string; role?: string },
    companyId?: string
  ): OrganizationUnit | null {
    const targetCompanyId = companyId || entity.company_id;
    const allUnits = OrganizationEngine.getUnits(targetCompanyId);
    if (!allUnits || allUnits.length === 0) return null;

    const index = OrganizationEngine.getUnitLookupIndex();

    if (entity.org_unit_id) {
      const byId = index.get(entity.org_unit_id);
      if (byId && (!targetCompanyId || byId.companyId === targetCompanyId || byId.company_id === targetCompanyId)) {
        return byId;
      }
      const found = allUnits.find(u => u.id === entity.org_unit_id || u.code === entity.org_unit_id);
      if (found) return found;
    }

    if (entity.station_id) {
      const byStation = index.get(`org-unit-station-${entity.station_id}`) || index.get(entity.station_id);
      if (byStation && (!targetCompanyId || byStation.companyId === targetCompanyId || byStation.company_id === targetCompanyId)) {
        return byStation;
      }
      const found = allUnits.find(u =>
        u.id === `org-unit-station-${entity.station_id}` ||
        u.id === entity.station_id ||
        u.metadata?.legacyStationId === entity.station_id ||
        u.metadata?.legacy_station_id === entity.station_id
      );
      if (found) return found;
    }

    if (entity.region_id) {
      const byRegion = index.get(`org-unit-region-${entity.region_id}`) || index.get(entity.region_id);
      if (byRegion && (!targetCompanyId || byRegion.companyId === targetCompanyId || byRegion.company_id === targetCompanyId)) {
        return byRegion;
      }
      const found = allUnits.find(u =>
        u.id === `org-unit-region-${entity.region_id}` ||
        u.id === entity.region_id ||
        u.metadata?.legacyRegionId === entity.region_id ||
        u.metadata?.legacy_region_id === entity.region_id
      );
      if (found) return found;
    }

    if (entity.company_id) {
      const byCompany = index.get(`org-unit-company-${entity.company_id}`) || index.get(`comp-root-${entity.company_id}`) || index.get(entity.company_id);
      if (byCompany && (!targetCompanyId || byCompany.companyId === targetCompanyId || byCompany.company_id === targetCompanyId)) {
        return byCompany;
      }
      const found = allUnits.find(u =>
        u.id === `org-unit-company-${entity.company_id}` ||
        u.metadata?.legacyCompanyId === entity.company_id ||
        u.metadata?.legacy_company_id === entity.company_id ||
        (u.parentId === null && (u.companyId === entity.company_id || u.company_id === entity.company_id))
      );
      if (found) return found;
    }

    return null;
  }

  /**
   * Retrieves the current account headcount for a specific organization unit.
   */
  static getUnitAccountHeadcount(unitId: string): {
    activeAccountsCount: number;
    maxAllowed: number;
    activeUsers: any[];
  } {
    const unit = OrganizationEngine.getUnitById(unitId);
    const maxAllowed = unit?.max_accounts_allowed ?? 1;
    const allUsers = UsersModule.getUsers();

    const activeUsers = allUsers.filter(u => {
      if (u.is_active === false) return false;
      const resolvedUnit = OrganizationEngine.resolveOrgUnitForEntity(u, unit?.companyId || u.company_id);
      return resolvedUnit && resolvedUnit.id === unitId;
    });

    return {
      activeAccountsCount: activeUsers.length,
      maxAllowed,
      activeUsers
    };
  }

  /**
   * Checks whether the active user is at the organizational level directly above
   * the target unit (or higher administrative authority) to raise headcount.
   */
  static canRaiseMaxAccountsAllowed(targetUnit: OrganizationUnit, activeUser?: any | null): {
    canRaise: boolean;
    reasonAr?: string;
    reasonEn?: string;
  } {
    if (!activeUser) {
      return { canRaise: false, reasonAr: 'غير مصرح لك بإجراء هذا التعديل.', reasonEn: 'Unauthorized to modify account limits.' };
    }

    if (UsersModule.isPlatformOwner(activeUser.email) || activeUser.role === 'SystemAdmin') {
      return { canRaise: true };
    }

    if (activeUser.role === 'Admin' && activeUser.company_id === targetUnit.companyId) {
      return { canRaise: true };
    }

    if (targetUnit.parentId) {
      const parentUnit = OrganizationEngine.getUnitById(targetUnit.parentId);
      if (parentUnit) {
        const userResolvedUnit = OrganizationEngine.resolveOrgUnitForEntity(activeUser, targetUnit.companyId);
        if (userResolvedUnit && userResolvedUnit.id === parentUnit.id) {
          return { canRaise: true };
        }
      }
    }

    return {
      canRaise: false,
      reasonAr: 'يمكن فقط للمسؤول المباشر في المستوى التنظيمي الأعلى رفع الحد الأقصى لعدد حسابات هذه الوحدة.',
      reasonEn: 'Only the administrator at the organizational level directly above this unit can raise its account ceiling.'
    };
  }

  /**
   * Raises max_accounts_allowed by 1 increment (up to hard ceiling of 5).
   */
  static raiseMaxAccountsAllowed(unitId: string, activeUser?: any | null): {
    success: boolean;
    errorAr?: string;
    errorEn?: string;
    unit?: OrganizationUnit;
  } {
    const unit = OrganizationEngine.getUnitById(unitId);
    if (!unit) {
      return {
        success: false,
        errorAr: 'الوحدة التنظيمية غير موجودة.',
        errorEn: 'Organization unit not found.'
      };
    }

    const clearance = OrganizationEngine.canRaiseMaxAccountsAllowed(unit, activeUser);
    if (!clearance.canRaise) {
      return {
        success: false,
        errorAr: clearance.reasonAr,
        errorEn: clearance.reasonEn
      };
    }

    const currentMax = unit.max_accounts_allowed ?? 1;
    if (currentMax >= 5) {
      return {
        success: false,
        errorAr: 'الحد الأقصى المطلق لعدد الحسابات في أي وحدة تنظيمية هو 5 حسابات ولا يمكن تجاوزه.',
        errorEn: 'The absolute maximum headcount ceiling for any organization unit is 5 accounts and cannot be exceeded.'
      };
    }

    const nextMax = currentMax + 1;
    const updated = OrganizationEngine.updateUnit(unitId, {
      max_accounts_allowed: nextMax
    });

    if (!updated) {
      return {
        success: false,
        errorAr: 'فشل تحديث الحد الأقصى لعدد الحسابات.',
        errorEn: 'Failed to update account ceiling.'
      };
    }

    return {
      success: true,
      unit: updated
    };
  }
}


