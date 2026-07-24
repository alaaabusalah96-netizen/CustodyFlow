import { StorageEngine } from './storage';
import { 
  DocumentType, 
  DocumentNumberConfig, 
  GenerateNumberParams, 
  GenerateNumberResult 
} from '../types/documentNumber';

export class DocumentNumberEngine {
  private static readonly STORAGE_KEY_CONFIGS = 'document_number_configs';

  /**
   * Resets local cache state (primarily for unit tests)
   */
  public static resetState(): void {
    StorageEngine.setStored(this.STORAGE_KEY_CONFIGS, []);
  }

  /**
   * Retrieves all document number configurations for a company, optionally filtered by Org Unit
   */
  public static getConfigs(companyId: string, orgUnitId?: string): DocumentNumberConfig[] {
    const all = StorageEngine.getStored<DocumentNumberConfig[]>(this.STORAGE_KEY_CONFIGS, []);
    return all.filter(c => {
      if (c.company_id !== companyId) return false;
      if (orgUnitId !== undefined) {
        return c.org_unit_id === orgUnitId;
      }
      return true;
    });
  }

  /**
   * Finds a specific configuration for a company + document type + org unit combination
   */
  public static getConfig(companyId: string, documentType: DocumentType, orgUnitId?: string): DocumentNumberConfig | null {
    const all = StorageEngine.getStored<DocumentNumberConfig[]>(this.STORAGE_KEY_CONFIGS, []);
    
    // 1. Try exact match (companyId + documentType + orgUnitId)
    if (orgUnitId) {
      const exact = all.find(c => c.company_id === companyId && c.documentType === documentType && c.org_unit_id === orgUnitId);
      if (exact) return exact;
    }

    // 2. Fallback to company-wide config (companyId + documentType + no orgUnitId)
    const companyWide = all.find(c => c.company_id === companyId && c.documentType === documentType && (!c.org_unit_id || c.org_unit_id === ''));
    if (companyWide) return companyWide;

    return null;
  }

  /**
   * Returns default prefix for a standard enterprise document type
   */
  public static getDefaultPrefix(documentType: DocumentType): string {
    const prefixes: Record<string, string> = {
      INVOICE: 'INV',
      RECEIPT: 'REC',
      PO: 'PO',
      PR: 'PR',
      TRANSFER: 'TRF',
      INVENTORY: 'INV-DOC',
      ASSET: 'AST',
      HR: 'HR',
      CUSTODY: 'CUST',
      VOUCHER: 'VOUCH',
      EXPENSE: 'EXP',
      JOURNAL_ENTRY: 'JV'
    };
    return prefixes[documentType] || documentType.toUpperCase().substring(0, 5);
  }

  /**
   * Saves or updates a document number configuration
   */
  public static saveConfig(
    configData: Omit<DocumentNumberConfig, 'id' | 'updatedAt'> & { id?: string }
  ): DocumentNumberConfig {
    const all = StorageEngine.getStored<DocumentNumberConfig[]>(this.STORAGE_KEY_CONFIGS, []);
    const now = new Date().toISOString();

    const existingIdx = configData.id 
      ? all.findIndex(c => c.id === configData.id)
      : all.findIndex(c => c.company_id === configData.company_id && c.documentType === configData.documentType && (c.org_unit_id || '') === (configData.org_unit_id || ''));

    let saved: DocumentNumberConfig;

    if (existingIdx >= 0) {
      saved = {
        ...all[existingIdx],
        ...configData,
        id: all[existingIdx].id,
        updatedAt: now
      };
      all[existingIdx] = saved;
    } else {
      saved = {
        id: configData.id || `doc-num-cfg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...configData,
        updatedAt: now
      };
      all.push(saved);
    }

    StorageEngine.setStored(this.STORAGE_KEY_CONFIGS, all);
    return saved;
  }

  /**
   * Creates default document numbering configurations for all core document types for a company or org unit
   */
  public static createDefaultConfigs(companyId: string, orgUnitId?: string): DocumentNumberConfig[] {
    const types: DocumentType[] = [
      'INVOICE', 'RECEIPT', 'PO', 'PR', 'TRANSFER', 
      'INVENTORY', 'ASSET', 'HR', 'CUSTODY', 'VOUCHER', 'EXPENSE', 'JOURNAL_ENTRY'
    ];

    const created: DocumentNumberConfig[] = [];
    for (const docType of types) {
      const prefix = this.getDefaultPrefix(docType);
      const cfg = this.saveConfig({
        company_id: companyId,
        org_unit_id: orgUnitId,
        documentType: docType,
        prefix,
        pattern: orgUnitId ? `{PREFIX}-{ORG_CODE}-{YEAR}-{SEQ:4}` : `{PREFIX}-{YEAR}-{SEQ:4}`,
        padding: 4,
        resetFrequency: 'YEARLY',
        includeYear: true,
        includeOrgCode: !!orgUnitId,
        currentSequence: 0,
        manualStartNo: 1001
      });
      created.push(cfg);
    }

    return created;
  }

  /**
   * Generates the next document number atomically for an enterprise document.
   * Replaces tokens: {PREFIX}, {ORG_CODE}, {YEAR}, {YY}, {MONTH}, {SEQ:N}, {SEQ}, {SUFFIX}
   */
  public static generateNextNumber(params: GenerateNumberParams): GenerateNumberResult {
    const { companyId, documentType, orgUnitId, orgCode, date } = params;

    let config = this.getConfig(companyId, documentType, orgUnitId);
    if (!config) {
      // Auto-create default config for this company & document type
      const prefix = this.getDefaultPrefix(documentType);
      config = this.saveConfig({
        company_id: companyId,
        org_unit_id: orgUnitId,
        documentType,
        prefix,
        pattern: orgUnitId ? `{PREFIX}-{ORG_CODE}-{YEAR}-{SEQ:4}` : `{PREFIX}-{YEAR}-{SEQ:4}`,
        padding: 4,
        resetFrequency: 'YEARLY',
        includeYear: true,
        includeOrgCode: !!orgCode || !!orgUnitId,
        currentSequence: 0,
        manualStartNo: 1001
      });
    }

    // Determine current sequence and calculate next value
    const startVal = config.manualStartNo !== undefined ? config.manualStartNo : 1001;
    const nextSeq = config.currentSequence === 0 ? startVal : config.currentSequence + 1;

    // Update current sequence in storage
    config.currentSequence = nextSeq;
    this.saveConfig(config);

    // Format date components
    const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
    const year = d.getFullYear().toString();
    const yy = year.substring(2);
    const month = String(d.getMonth() + 1).padStart(2, '0');

    const cleanOrgCode = orgCode || '';
    const cleanPrefix = config.prefix || this.getDefaultPrefix(documentType);
    const cleanSuffix = config.suffix || '';

    // Process pattern template or construct default
    let pattern = config.pattern;
    if (!pattern) {
      if (config.includeOrgCode && cleanOrgCode) {
        pattern = config.includeYear ? `{PREFIX}-{ORG_CODE}-{YEAR}-{SEQ}` : `{PREFIX}-{ORG_CODE}-{SEQ}`;
      } else {
        pattern = config.includeYear ? `{PREFIX}-{YEAR}-{SEQ}` : `{PREFIX}-{SEQ}`;
      }
    }

    // Handle {SEQ:N} token parsing with specific padding (e.g., {SEQ:5})
    let formattedSeq = String(nextSeq).padStart(config.padding || 4, '0');

    let resultStr = pattern;

    // Check for {SEQ:N} pattern token
    const seqMatch = pattern.match(/\{SEQ:(\d+)\}/);
    if (seqMatch) {
      const customPadding = parseInt(seqMatch[1], 10);
      formattedSeq = String(nextSeq).padStart(customPadding, '0');
      resultStr = resultStr.replace(seqMatch[0], formattedSeq);
    } else {
      resultStr = resultStr.replace(/\{SEQ\}/g, formattedSeq);
    }

    resultStr = resultStr
      .replace(/\{PREFIX\}/g, cleanPrefix)
      .replace(/\{ORG_CODE\}/g, cleanOrgCode)
      .replace(/\{YEAR\}/g, year)
      .replace(/\{YY\}/g, yy)
      .replace(/\{MONTH\}/g, month)
      .replace(/\{SUFFIX\}/g, cleanSuffix);

    // Clean up duplicate or trailing dashes if tokens were empty (e.g. empty ORG_CODE)
    resultStr = resultStr.replace(/--+/g, '-').replace(/^-|-$/g, '');

    return {
      documentNumber: resultStr,
      sequenceNumber: nextSeq,
      configId: config.id,
      documentType
    };
  }

  /**
   * Resets sequence counter for a document configuration
   */
  public static resetSequence(companyId: string, documentType: DocumentType, orgUnitId?: string, newSequenceValue: number = 0): void {
    const config = this.getConfig(companyId, documentType, orgUnitId);
    if (config) {
      config.currentSequence = newSequenceValue;
      this.saveConfig(config);
    }
  }
}
