import { CostCenter } from '../types/accounting';
import { OrganizationUnit } from '../types/organization';
import { StorageEngine } from './storage';
import { syncWriteWithOfflineFallback } from './offlineQueue';
import { dbSetDoc, dbDeleteDoc } from '../firebase';
import { OrganizationEngine } from './organizationEngine';

export interface CostCenterTreeNode extends CostCenter {
  children: CostCenterTreeNode[];
}

export interface CostCenterFinancialSummary {
  costCenterId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  totalDebit: number;
  totalCredit: number;
  netAmount: number; // Expense debit - credit, or net movement
  budget?: number;
  budgetUtilizationPercent?: number;
}

export class CostCenterEngine {
  private static STORAGE_KEY = 'cost_centers';

  static getCostCenters(companyId?: string): CostCenter[] {
    const list = StorageEngine.getStored<CostCenter[]>(CostCenterEngine.STORAGE_KEY, []);
    if (!companyId) return list;
    return list.filter(cc => cc.company_id === companyId);
  }

  static getCostCenter(id: string): CostCenter | undefined {
    const list = StorageEngine.getStored<CostCenter[]>(CostCenterEngine.STORAGE_KEY, []);
    return list.find(cc => cc.id === id);
  }

  static saveCostCenters(centers: CostCenter[]): void {
    StorageEngine.setStored(CostCenterEngine.STORAGE_KEY, centers);
  }

  static addCostCenter(data: Omit<CostCenter, 'id'> & { id?: string }): CostCenter {
    const centers = CostCenterEngine.getCostCenters();
    const id = data.id || `cc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const orgUnitId = data.org_unit_id || data.orgUnitId;
    const parentId = data.parent_id || data.parentId;

    const newCC: CostCenter = {
      ...data,
      id,
      company_id: data.company_id,
      org_unit_id: orgUnitId,
      orgUnitId: orgUnitId,
      parent_id: parentId,
      parentId: parentId,
      category: data.category || 'OPERATIONAL',
      budget: data.budget ?? 0,
      isActive: data.isActive !== undefined ? data.isActive : true
    };

    centers.push(newCC);
    CostCenterEngine.saveCostCenters(centers);

    syncWriteWithOfflineFallback('cost_centers', id, newCC).catch(err => console.warn('CC sync failed:', err));

    return newCC;
  }

  static updateCostCenter(id: string, updates: Partial<CostCenter>): CostCenter {
    const centers = CostCenterEngine.getCostCenters();
    const idx = centers.findIndex(cc => cc.id === id);
    if (idx === -1) {
      throw new Error(`Cost Center with ID ${id} not found.`);
    }

    const orgUnitId = updates.org_unit_id || updates.orgUnitId || centers[idx].org_unit_id;
    const parentId = updates.parent_id || updates.parentId || centers[idx].parent_id;

    const updated: CostCenter = {
      ...centers[idx],
      ...updates,
      org_unit_id: orgUnitId,
      orgUnitId: orgUnitId,
      parent_id: parentId,
      parentId: parentId
    };

    centers[idx] = updated;
    CostCenterEngine.saveCostCenters(centers);

    syncWriteWithOfflineFallback('cost_centers', id, updated).catch(err => console.warn('CC sync failed:', err));

    return updated;
  }

  static deleteCostCenter(id: string): boolean {
    const centers = CostCenterEngine.getCostCenters();
    const filtered = centers.filter(cc => cc.id !== id);
    if (filtered.length === centers.length) return false;

    CostCenterEngine.saveCostCenters(filtered);

    syncWriteWithOfflineFallback('cost_centers', id, null, 4000).catch(err => console.warn('CC sync failed:', err));

    return true;
  }

  static getCostCentersByOrgUnit(orgUnitId: string, companyId?: string): CostCenter[] {
    const centers = CostCenterEngine.getCostCenters(companyId);
    return centers.filter(cc => cc.org_unit_id === orgUnitId || cc.orgUnitId === orgUnitId);
  }

  /**
   * Auto-creates or retrieves a Cost Center linked to an Organization Unit.
   * Ensures 1-to-1 dynamic linking between Org Units and Cost Centers.
   */
  static autoCreateOrLinkCostCenterForOrgUnit(orgUnit: OrganizationUnit): CostCenter {
    const existing = CostCenterEngine.getCostCentersByOrgUnit(orgUnit.id, orgUnit.companyId);
    if (existing.length > 0) {
      return existing[0];
    }

    return CostCenterEngine.addCostCenter({
      code: `CC-${orgUnit.code}`,
      nameAr: `مركز تكلفة - ${orgUnit.nameAr || orgUnit.name}`,
      nameEn: `Cost Center - ${orgUnit.nameEn || orgUnit.name}`,
      company_id: orgUnit.companyId,
      org_unit_id: orgUnit.id,
      orgUnitId: orgUnit.id,
      category: 'OPERATIONAL',
      budget: 0,
      isActive: orgUnit.isActive !== undefined ? orgUnit.isActive : true
    });
  }

  /**
   * Resolves or auto-generates the Cost Center associated with an Organization Unit ID.
   */
  static resolveCostCenterForOrgUnit(orgUnitId: string, companyId: string): CostCenter | undefined {
    const existing = CostCenterEngine.getCostCentersByOrgUnit(orgUnitId, companyId);
    if (existing.length > 0) {
      return existing[0];
    }

    try {
      const unit = OrganizationEngine.getUnitById(orgUnitId);
      if (unit) {
        return CostCenterEngine.autoCreateOrLinkCostCenterForOrgUnit(unit);
      }
    } catch {
      // Fallback
    }

    return undefined;
  }

  /**
   * Gets the complete subtree of cost centers starting from rootCostCenterId
   */
  static getCostCenterSubtree(rootCostCenterId: string, companyId?: string): CostCenter[] {
    const all = CostCenterEngine.getCostCenters(companyId);
    const result: CostCenter[] = [];

    const collect = (parentId: string) => {
      const match = all.find(c => c.id === parentId);
      if (match && !result.some(r => r.id === match.id)) {
        result.push(match);
      }
      const children = all.filter(c => c.parent_id === parentId || c.parentId === parentId);
      children.forEach(child => collect(child.id));
    };

    collect(rootCostCenterId);
    return result;
  }

  /**
   * Builds a hierarchical tree representation of cost centers for a company.
   */
  static buildCostCenterTree(companyId?: string): CostCenterTreeNode[] {
    const all = CostCenterEngine.getCostCenters(companyId);
    const map = new Map<string, CostCenterTreeNode>();

    all.forEach(cc => {
      map.set(cc.id, { ...cc, children: [] });
    });

    const roots: CostCenterTreeNode[] = [];

    map.forEach(node => {
      const pId = node.parent_id || node.parentId;
      if (pId && map.has(pId)) {
        map.get(pId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
