import { Firestore } from 'firebase/firestore';
import { EventEnvelope } from '../../types/enterprise';
import { BusinessEngineContract, EngineExecutionResult } from './warehouse_contracts';
import { SequenceEngine } from './sequence';
import { AuditLogEngine } from './audit';
import { createBaseMetadata } from './metadata';
import { GLAccount, JournalEntry, LedgerLine, AccountType } from '../../types/accounting';
import { StorageEngine } from '../../db/storage';
import { dbSetDoc, db } from '../../firebase';

/**
 * Enterprise Accounting & Double-Entry Ledger Engine
 * محرك الحسابات المزدوجة ودفتر القيود الموحد للمؤسسات
 * 
 * Manages standard Chart of Accounts (COA) and ensures robust, balanced Journal Entries.
 * Employs SequenceEngine and AuditLogEngine to track all ledger activities.
 */
export class AccountingBusinessEngine implements BusinessEngineContract {
  engineId = 'accounting_business_engine';
  supportedEvents = [
    'JOURNAL_ENTRY_POSTED',
    'CHART_OF_ACCOUNTS_INITIALIZED'
  ];

  private auditEngine = new AuditLogEngine();

  // Standard accounts template for initialization
  static STANDARD_COA_TEMPLATE: Omit<GLAccount, 'id' | 'company_id' | 'createdAt'>[] = [
    // Assets (1)
    { code: '110101', nameAr: 'صندوق الخزينة الرئيسي (Cash in Hand)', nameEn: 'Cash in Hand (Main Box)', type: 'ASSET', balance: 50000, status: 'ACTIVE' },
    { code: '110201', nameAr: 'حساب بنك الشركة الجاري (Corporate Bank Account)', nameEn: 'Corporate Checking Account', type: 'ASSET', balance: 250000, status: 'ACTIVE' },
    { code: '110301', nameAr: 'حسابات العملاء والمدينين (Accounts Receivable)', nameEn: 'Accounts Receivable (Customers)', type: 'ASSET', balance: 0, status: 'ACTIVE' },
    { code: '120101', nameAr: 'مخزون مستودع قطع الغيار والوقود (Inventory)', nameEn: 'Warehouse Parts & Fuel Inventory', type: 'ASSET', balance: 0, status: 'ACTIVE' },
    { code: '130101', nameAr: 'الأصول الثابتة (Fixed Assets)', nameEn: 'Fixed Assets', type: 'ASSET', balance: 0, status: 'ACTIVE' },
    { code: '130201', nameAr: 'مجمع إهلاك الأصول الثابتة (Accumulated Depreciation)', nameEn: 'Accumulated Depreciation', type: 'ASSET', balance: 0, status: 'ACTIVE' },
    // Liabilities (2)
    { code: '210101', nameAr: 'حسابات الموردين والدائنين (Accounts Payable)', nameEn: 'Accounts Payable (Vendors)', type: 'LIABILITY', balance: 0, status: 'ACTIVE' },
    { code: '210201', nameAr: 'مستحقات ضريبة القيمة المضافة (VAT Payable)', nameEn: 'VAT Payable (State Tax)', type: 'LIABILITY', balance: 0, status: 'ACTIVE' },
    { code: '210301', nameAr: 'ضريبة الخصم والتحصيل تحت حساب الضريبة (Withholding Tax Payable)', nameEn: 'Withholding Tax Payable', type: 'LIABILITY', balance: 0, status: 'ACTIVE' },
    { code: '210401', nameAr: 'مستحقات الهيئة القومية للتأمين الاجتماعي (Social Insurance Payable)', nameEn: 'Social Insurance Payable', type: 'LIABILITY', balance: 0, status: 'ACTIVE' },
    { code: '210501', nameAr: 'ضريبة كسب العمل المستحقة (Payroll Tax Payable)', nameEn: 'Payroll Taxes Payable', type: 'LIABILITY', balance: 0, status: 'ACTIVE' },
    // Equity (3)
    { code: '310101', nameAr: 'رأس مال الشركة المدفوع (Share Capital)', nameEn: 'Corporate Paid-in Capital', type: 'EQUITY', balance: 300000, status: 'ACTIVE' },
    // Revenue (4)
    { code: '410101', nameAr: 'إيرادات مبيعات الوقود والخدمات (Sales Revenue)', nameEn: 'Sales & Services Revenue', type: 'REVENUE', balance: 0, status: 'ACTIVE' },
    // Expenses (5)
    { code: '510101', nameAr: 'مصروفات المحطات والمواقع التشغيلية (Site Expenses)', nameEn: 'Site Operational Expenses', type: 'EXPENSE', balance: 0, status: 'ACTIVE' },
    { code: '510201', nameAr: 'مصروفات وقود الديزل والبنزين (Fuel Expenses)', nameEn: 'Diesel & Fuel Expenses', type: 'EXPENSE', balance: 0, status: 'ACTIVE' },
    { code: '510301', nameAr: 'مصروفات الصيانة الفنية وقطع الغيار (Maintenance)', nameEn: 'Maintenance & Repairs Expenses', type: 'EXPENSE', balance: 0, status: 'ACTIVE' },
    { code: '510401', nameAr: 'مصروفات عمومية وإدارية (G&A Expenses)', nameEn: 'General & Administrative Expenses', type: 'EXPENSE', balance: 0, status: 'ACTIVE' },
    { code: '510501', nameAr: 'مصروف إهلاك الأصول الثابتة (Depreciation Expense)', nameEn: 'Depreciation Expense', type: 'EXPENSE', balance: 0, status: 'ACTIVE' },
    { code: '510601', nameAr: 'مصروف رواتب وأجور الموظفين (Salaries & Wages Expense)', nameEn: 'Salaries & Wages Expense', type: 'EXPENSE', balance: 0, status: 'ACTIVE' },
    { code: '510701', nameAr: 'مصروف حصة الشركة في التأمينات (Employer Social Insurance Expense)', nameEn: 'Employer Social Insurance Expense', type: 'EXPENSE', balance: 0, status: 'ACTIVE' }
  ];

  static getAccounts(companyId: string): GLAccount[] {
    const list = StorageEngine.getStored<GLAccount[]>('gl_accounts', []);
    const companyAccounts = list.filter(a => a.company_id === companyId);
    
    if (companyAccounts.length === 0) {
      // Auto-initialize standard COA template for this company
      const initialized = AccountingBusinessEngine.STANDARD_COA_TEMPLATE.map((tpl, i) => {
        const newAcc: GLAccount = {
          ...tpl,
          id: `acc-${companyId}-${tpl.code}`,
          company_id: companyId,
          createdAt: new Date().toISOString()
        };
        list.push(newAcc);
        dbSetDoc('gl_accounts', newAcc.id, newAcc);
        return newAcc;
      });
      StorageEngine.setStored('gl_accounts', list);
      return initialized;
    }
    
    return companyAccounts;
  }

  static getJournalEntries(companyId: string): JournalEntry[] {
    const list = StorageEngine.getStored<JournalEntry[]>('journal_entries', []);
    return list.filter(je => je.company_id === companyId);
  }

  static saveAccounts(companyId: string, companyAccounts: GLAccount[]): void {
    const all = StorageEngine.getStored<GLAccount[]>('gl_accounts', []);
    const filteredOut = all.filter(a => a.company_id !== companyId);
    const combined = [...filteredOut, ...companyAccounts];
    StorageEngine.setStored('gl_accounts', combined);
    companyAccounts.forEach(a => dbSetDoc('gl_accounts', a.id, a));
  }

  static saveJournalEntries(list: JournalEntry[]): void {
    StorageEngine.setStored('journal_entries', list);
    list.forEach(je => dbSetDoc('journal_entries', je.id, je));
  }

  /**
   * Helper to trigger automated double-entry postings for standard operations.
   */
  static async postOperationalDoubleEntry(
    companyId: string,
    operatorId: string,
    sourceRef: string,
    statementAr: string,
    statementEn: string,
    lines: { accountCode: string; debit: number; credit: number; notes?: string }[]
  ): Promise<JournalEntry> {
    const engine = new AccountingBusinessEngine();
    const accounts = AccountingBusinessEngine.getAccounts(companyId);

    // Form complete Ledger Lines
    const ledgerLines: LedgerLine[] = lines.map(ln => {
      const acc = accounts.find(a => a.code === ln.accountCode);
      if (!acc) throw new Error(`GL Account code ${ln.accountCode} not found in corporate COA.`);
      return {
        accountId: acc.id,
        accountCode: acc.code,
        accountNameAr: acc.nameAr,
        accountNameEn: acc.nameEn,
        debit: ln.debit,
        credit: ln.credit,
        notes: ln.notes
      };
    });

    const dbInstance = db as Firestore;
    const entryNumber = await SequenceEngine.generateNextSequence(
      dbInstance,
      companyId,
      'last_journal_entry_no',
      { prefix: 'JE', padding: 4, includeYear: true }
    );

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    // Validate double-entry balance
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Balanced Journal Entry check failed: Debits (${totalDebit}) must equal Credits (${totalCredit}).`);
    }

    const je: JournalEntry = {
      id: `je-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      company_id: companyId,
      entryNumber,
      date: new Date().toISOString().split('T')[0],
      sourceType: 'OPERATIONAL',
      sourceReference: sourceRef,
      statementAr,
      statementEn,
      lines: ledgerLines,
      totalDebit,
      totalCredit,
      metadata: createBaseMetadata(companyId, operatorId)
    };

    // Commit Journal Entry
    const allJEs = StorageEngine.getStored<JournalEntry[]>('journal_entries', []);
    allJEs.push(je);
    AccountingBusinessEngine.saveJournalEntries(allJEs);

    // Update balances on GL accounts
    const updatedAccounts = accounts.map(acc => {
      const line = ledgerLines.find(l => l.accountId === acc.id);
      if (line) {
        let diff = 0;
        if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
          // Asset/Expense: debit increases, credit decreases
          diff = line.debit - line.credit;
        } else {
          // Liability/Equity/Revenue: credit increases, debit decreases
          diff = line.credit - line.debit;
        }
        return {
          ...acc,
          balance: acc.balance + diff
        };
      }
      return acc;
    });
    AccountingBusinessEngine.saveAccounts(companyId, updatedAccounts);

    return je;
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
        messageEn: `Accounting engine does not support event: ${event.eventType}`,
        messageAr: `محرك الحسابات لا يدعم الحدث: ${event.eventType}`
      };
    }

    try {
      // Log to append-only audit trail
      await this.auditEngine.appendAuditRecord(event);

      const dbInstance = db as Firestore;

      switch (event.eventType) {
        case 'CHART_OF_ACCOUNTS_INITIALIZED': {
          const companyId = event.tenantId;
          const accounts = AccountingBusinessEngine.getAccounts(companyId);
          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: `Chart of accounts initialized for company ${companyId}`,
            messageAr: `تم تهيئة شجرة الحسابات بنجاح للشركة ${companyId}`,
            outputData: accounts
          };
        }

        case 'JOURNAL_ENTRY_POSTED': {
          const { statementAr, statementEn, lines, sourceRef } = event.payload;
          const companyId = event.tenantId;

          const je = await AccountingBusinessEngine.postOperationalDoubleEntry(
            companyId,
            event.user_id,
            sourceRef,
            statementAr,
            statementEn,
            lines
          );

          return {
            success: true,
            engineId: this.engineId,
            eventId: event.eventId,
            processedAt: new Date().toISOString(),
            statusCode: 'SUCCESS',
            messageEn: `Manual/Operational journal entry ${je.entryNumber} posted successfully.`,
            messageAr: `تم ترحيل قيد اليومية المحاسبي ${je.entryNumber} بنجاح.`,
            outputData: je
          };
        }

        default:
          throw new Error(`Unhandled event: ${event.eventType}`);
      }

    } catch (error: any) {
      return {
        success: false,
        engineId: this.engineId,
        eventId: event.eventId,
        processedAt: new Date().toISOString(),
        statusCode: 'EXECUTION_ERROR',
        messageEn: error.message || 'Unknown accounting processing error',
        messageAr: error.message || 'حدث خطأ مجهول أثناء معالجة القيود'
      };
    }
  }
}
