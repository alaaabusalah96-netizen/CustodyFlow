import { Firestore, doc, runTransaction } from 'firebase/firestore';
import { SequenceOptions } from '../../types/enterprise';

/**
 * 3.2 Document Number / Sequence Engine
 * محرك توليد أرقام المستندات والترقيم المتسلسل التلقائي للمؤسسات
 * 
 * Provides an independent, highly isolated sequential number generator.
 * Operates inside a strict Firestore Transaction to guarantee gap-free, non-duplicate sequences.
 */
export class SequenceEngine {
  /**
   * Generates a gap-free sequential number for a specific document type within a company/tenant context.
   * Runs in a transaction to guarantee absolute safety and uniqueness under high concurrency.
   * 
   * @param dbInstance Firestore database instance
   * @param companyId Tenant identification string (company ID)
   * @param sequenceKey The field name representing the specific counter (e.g., 'last_voucher_no', 'last_expense_no', 'last_inventory_no')
   * @param options Sequence format parameters (prefix, suffix, padding, includeYear)
   * @returns Formatted sequence string (e.g., "WH-INV-2026-0001")
   */
  static async generateNextSequence(
    dbInstance: Firestore,
    companyId: string,
    sequenceKey: string = 'last_voucher_no',
    options: SequenceOptions
  ): Promise<string> {
    if (!companyId) {
      throw new Error('Company ID is required to generate sequential document number.');
    }

    const seqDocRef = doc(dbInstance, 'company_sequences', companyId);

    const nextNumericVal = await runTransaction(dbInstance, async (transaction) => {
      const sfDoc = await transaction.get(seqDocRef);
      const defaultStart = options.manualStartNo !== undefined ? options.manualStartNo : 1001;

      if (!sfDoc.exists()) {
        const initialDoc: Record<string, any> = {
          id: companyId,
          company_id: companyId,
          last_voucher_no: 1001 // Base field for backward compatibility
        };
        initialDoc[sequenceKey] = defaultStart;
        
        // Ensure last_voucher_no reflects the current update if sequenceKey is 'last_voucher_no'
        if (sequenceKey === 'last_voucher_no') {
          initialDoc.last_voucher_no = defaultStart;
        }

        transaction.set(seqDocRef, initialDoc);
        return defaultStart;
      } else {
        const data = sfDoc.data();
        const lastNo = data[sequenceKey] !== undefined ? data[sequenceKey] : (defaultStart - 1);
        const nextVal = lastNo + 1;
        
        const updateData: Record<string, any> = {};
        updateData[sequenceKey] = nextVal;
        
        // Keep the base last_voucher_no updated if the key matches or if it's the default field
        if (sequenceKey === 'last_voucher_no') {
          updateData.last_voucher_no = nextVal;
        }

        transaction.update(seqDocRef, updateData);
        return nextVal;
      }
    });

    const padding = options.padding ?? 4;
    const includeYear = options.includeYear ?? true;
    const yearStr = includeYear ? `-${new Date().getFullYear()}-` : '-';
    
    const paddedNum = String(nextNumericVal).padStart(padding, '0');
    const suffixStr = options.suffix ? `-${options.suffix}` : '';

    return `${options.prefix}${yearStr}${paddedNum}${suffixStr}`;
  }
}
