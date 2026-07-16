import { BaseMetadata } from './enterprise';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface GLAccount {
  id: string;
  company_id: string;
  code: string; // e.g., "110101"
  nameAr: string;
  nameEn: string;
  type: AccountType;
  balance: number; // Current calculated running balance
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface LedgerLine {
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  accountNameEn: string;
  debit: number;  // مدين
  credit: number; // دائن
  notes?: string;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  entryNumber: string; // e.g., "JE-2026-0001"
  date: string;
  sourceType: 'OPERATIONAL' | 'MANUAL';
  sourceReference?: string; // e.g., "Voucher #CF-2026-1002" or "PO #PO-2026-0001"
  statementAr: string;
  statementEn: string;
  lines: LedgerLine[];
  totalDebit: number;
  totalCredit: number;
  metadata: BaseMetadata;
}
