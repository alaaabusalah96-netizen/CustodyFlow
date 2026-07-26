import { StorageEngine } from '../../db/storage';
import { dbSetDoc } from '../../firebase';
import { DocumentNumberEngine } from '../../db/documentNumberEngine';
import { CostCenterEngine } from '../../db/costCenterEngine';
import { OrganizationEngine } from '../../db/organizationEngine';
import { AccountingBusinessEngine } from './accounting_engine';
import { FixedAsset, AssetCategory, DepreciationRunLog } from '../../types/asset';

export class AssetBusinessEngine {
  /**
   * Retrieves all fixed assets filtered by company and optional organization unit subtree
   */
  public static getAssetsByOrgUnit(companyId: string, orgUnitId?: string): FixedAsset[] {
    const all = StorageEngine.getStored<FixedAsset[]>('fixed_assets_items', []);
    const companyAssets = all.filter(a => a.company_id === companyId);

    if (!orgUnitId || orgUnitId === 'ALL') {
      return companyAssets;
    }

    const validSubtreeIds = new Set(OrganizationEngine.getSubtreeUnitIds(orgUnitId, companyId));
    return companyAssets.filter(a => a.org_unit_id && validSubtreeIds.has(a.org_unit_id));
  }

  /**
   * Registers a new fixed asset with automatic sequence numbering and cost-center resolution
   */
  public static async createAsset(
    companyId: string,
    data: {
      name: string;
      category: AssetCategory;
      purchaseDate: string;
      originalCost: number;
      depreciationRate: number; // e.g. 10 for 10%
      org_unit_id?: string;
      cost_center_id?: string;
    }
  ): Promise<FixedAsset> {
    const allAssets = StorageEngine.getStored<FixedAsset[]>('fixed_assets_items', []);
    const targetOrgUnit = data.org_unit_id || undefined;

    let targetCostCenter = data.cost_center_id;
    if (!targetCostCenter && targetOrgUnit) {
      const cc = CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    // Code generation
    let code = '';
    try {
      const genResult = DocumentNumberEngine.generateNextNumber({
        companyId,
        documentType: 'ASSET',
        orgUnitId: targetOrgUnit
      });
      code = genResult.documentNumber;
    } catch {
      const nextCodeNo = 3001 + allAssets.filter(a => a.company_id === companyId).length;
      code = `AST-${data.category}-${nextCodeNo}`;
    }

    const newAsset: FixedAsset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      org_unit_id: targetOrgUnit,
      cost_center_id: targetCostCenter,
      name: data.name,
      code,
      category: data.category,
      purchaseDate: data.purchaseDate,
      originalCost: Number(data.originalCost),
      depreciationRate: Number(data.depreciationRate) / 100, // percentage e.g. 10 -> 0.10
      accumulatedDepreciation: 0,
      netBookValue: Number(data.originalCost),
      createdAt: new Date().toISOString()
    };

    const updated = [...allAssets, newAsset];
    StorageEngine.setStored('fixed_assets_items', updated);
    await dbSetDoc('fixed_assets_items', newAsset.id, newAsset);

    return newAsset;
  }

  /**
   * Calculates monthly straight-line depreciation for a given set of assets
   */
  public static calculateMonthlyDepreciation(assets: FixedAsset[]): DepreciationRunLog[] {
    return assets.map(a => {
      const exp = (a.originalCost * a.depreciationRate) / 12;
      return {
        assetName: a.name,
        code: a.code,
        expense: Math.min(exp, a.netBookValue),
        org_unit_id: a.org_unit_id,
        cost_center_id: a.cost_center_id
      };
    }).filter(log => log.expense > 0);
  }

  /**
   * Posts depreciation run entries to storage, firestore, and General Ledger double-entry
   */
  public static async postDepreciationRun(
    companyId: string,
    operatorId: string,
    depreciationDate: string,
    runLogs: DepreciationRunLog[],
    orgUnitId?: string,
    costCenterId?: string
  ): Promise<void> {
    if (runLogs.length === 0) return;

    const allAssets = StorageEngine.getStored<FixedAsset[]>('fixed_assets_items', []);
    const updated = allAssets.map(a => {
      const log = runLogs.find(rl => rl.code === a.code);
      if (log) {
        const newAccum = a.accumulatedDepreciation + log.expense;
        const newBook = Math.max(0, a.originalCost - newAccum);
        return {
          ...a,
          accumulatedDepreciation: newAccum,
          netBookValue: newBook
        };
      }
      return a;
    });

    StorageEngine.setStored('fixed_assets_items', updated);

    // Sync to firebase
    for (const item of updated) {
      if (item.company_id === companyId) {
        await dbSetDoc('fixed_assets_items', item.id, item);
      }
    }

    const totalExp = runLogs.reduce((sum, rl) => sum + rl.expense, 0);
    const targetOrgUnit = orgUnitId || undefined;

    let targetCostCenter = costCenterId;
    if (!targetCostCenter && targetOrgUnit) {
      const cc = CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    // Post Accounting Double-Entry with Organizational Metadata
    try {
      const statementAr = `قيد استهلاك الأصول الثابتة الشهري للفترة المنتهية في ${depreciationDate}`;
      const statementEn = `Monthly fixed assets depreciation run for period ending ${depreciationDate}`;

      await AccountingBusinessEngine.postOperationalDoubleEntry(
        companyId,
        operatorId,
        `DEP-${Date.now()}`,
        statementAr,
        statementEn,
        [
          // Debit Depreciation Expense (510501)
          { accountCode: '510501', debit: totalExp, credit: 0, notes: `مصروف إهلاك أصول الشركة` },
          // Credit Accumulated Depreciation (130201)
          { accountCode: '130201', debit: 0, credit: totalExp, notes: `إلى حساب مجمع إهلاك الأصول الثابتة` }
        ],
        {
          org_unit_id: targetOrgUnit,
          cost_center_id: targetCostCenter
        }
      );
    } catch (glError) {
      console.error('Asset depreciation GL double entry posting error:', glError);
    }
  }
}
