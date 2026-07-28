import { StorageEngine } from '../../db/storage';
import { dbSetDoc } from '../../firebase';
import { DocumentNumberEngine } from '../../db/documentNumberEngine';
import { CostCenterEngine } from '../../db/costCenterEngine';
import { OrganizationEngine } from '../../db/organizationEngine';
import { AccountingBusinessEngine } from './accounting_engine';
import { Employee, PayrollItem, PayrollRun, EmployeeDepartment, EmployeeStatus } from '../../types/hr';

export class HRBusinessEngine {
  /**
   * Retrieves all employees filtered by company, supporting organizational subtree filtering
   */
  public static getEmployeesByOrgUnit(companyId: string, orgUnitId?: string): Employee[] {
    const all = StorageEngine.getStored<Employee[]>('employees_payroll_items', []);
    const companyEmployees = all.filter(e => e.company_id === companyId);

    if (!orgUnitId || orgUnitId === 'ALL') {
      return companyEmployees;
    }

    const validSubtreeIds = new Set(OrganizationEngine.getSubtreeUnitIds(orgUnitId, companyId));
    return companyEmployees.filter(e => e.org_unit_id && validSubtreeIds.has(e.org_unit_id));
  }

  /**
   * Retrieves all processed payroll runs filtered by company, supporting organizational subtree filtering
   */
  public static getPayrollRunsByOrgUnit(companyId: string, orgUnitId?: string): PayrollRun[] {
    const all = StorageEngine.getStored<PayrollRun[]>('payroll_processed_runs', []);
    const companyRuns = all.filter(r => r.company_id === companyId);

    if (!orgUnitId || orgUnitId === 'ALL') {
      return companyRuns;
    }

    const validSubtreeIds = new Set(OrganizationEngine.getSubtreeUnitIds(orgUnitId, companyId));
    return companyRuns.filter(r => r.org_unit_id && validSubtreeIds.has(r.org_unit_id));
  }

  /**
   * Registers a new employee with auto-sequence numbering and cost-center resolution
   */
  public static async createEmployee(
    companyId: string,
    data: {
      name: string;
      department: EmployeeDepartment;
      jobTitle: string;
      baseSalary: number;
      hireDate?: string;
      status?: EmployeeStatus;
      org_unit_id?: string;
      cost_center_id?: string;
    }
  ): Promise<Employee> {
    const allEmployees = StorageEngine.getStored<Employee[]>('employees_payroll_items', []);
    const targetOrgUnit = data.org_unit_id || undefined;

    let targetCostCenter = data.cost_center_id;
    if (!targetCostCenter && targetOrgUnit) {
      const cc = await CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    // Code generation
    let code = '';
    try {
      const genResult = DocumentNumberEngine.generateNextNumber({
        companyId,
        documentType: 'HR',
        orgUnitId: targetOrgUnit
      });
      code = genResult.documentNumber;
    } catch {
      const count = 201 + allEmployees.filter(emp => emp.company_id === companyId).length;
      code = `EMP-${data.department}-${count}`;
    }

    const newEmployee: Employee = {
      id: `emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      org_unit_id: targetOrgUnit,
      cost_center_id: targetCostCenter,
      name: data.name,
      code,
      department: data.department,
      jobTitle: data.jobTitle,
      baseSalary: Number(data.baseSalary),
      hireDate: data.hireDate || new Date().toISOString().split('T')[0],
      status: data.status || 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const updated = [...allEmployees, newEmployee];
    StorageEngine.setStored('employees_payroll_items', updated);
    await dbSetDoc('employees_payroll_items', newEmployee.id, newEmployee);

    return newEmployee;
  }

  /**
   * Settle and post monthly HR payroll run with automatic double-entry posting and org metadata stamping
   */
  public static async processPayrollRun(
    companyId: string,
    operatorId: string,
    operatorName: string,
    data: {
      period: string;
      sheet: PayrollItem[];
      totalPayout: number;
      totalGross: number;
      totalEmployeeIns: number;
      totalEmployerIns: number;
      totalTax: number;
      org_unit_id?: string;
      cost_center_id?: string;
    }
  ): Promise<PayrollRun> {
    const allRuns = StorageEngine.getStored<PayrollRun[]>('payroll_processed_runs', []);
    const targetOrgUnit = data.org_unit_id || undefined;

    let targetCostCenter = data.cost_center_id;
    if (!targetCostCenter && targetOrgUnit) {
      const cc = await CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    const runRecord: PayrollRun = {
      id: `payrun-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      org_unit_id: targetOrgUnit,
      cost_center_id: targetCostCenter,
      period: data.period,
      items: data.sheet,
      totalPayout: data.totalPayout,
      totalGross: data.totalGross,
      totalEmployeeIns: data.totalEmployeeIns,
      totalEmployerIns: data.totalEmployerIns,
      totalTax: data.totalTax,
      processedBy: operatorName,
      timestamp: new Date().toISOString()
    };

    StorageEngine.setStored('payroll_processed_runs', [...allRuns, runRecord]);
    await dbSetDoc('payroll_processed_runs', runRecord.id, runRecord);

    // Post Accounting Double-Entry (General Ledger Integration with Org Dimensions)
    try {
      const statementAr = `قيد استحقاق رواتب الموظفين لشهر ${data.period} - متضمن التأمينات والضرائب`;
      const statementEn = `Payroll accrual for period ${data.period} - including social security and taxes`;

      await AccountingBusinessEngine.postOperationalDoubleEntry(
        companyId,
        operatorId,
        `PAY-${data.period}`,
        statementAr,
        statementEn,
        [
          // Debit: Salaries Expense (510601) - Gross amount
          { accountCode: '510601', debit: data.totalGross, credit: 0, notes: `رواتب أساسية وبدلات` },
          // Debit: Employer Insurance Expense (510701)
          { accountCode: '510701', debit: data.totalEmployerIns, credit: 0, notes: `حصة الشركة في التأمينات` },
          // Credit: Social Insurance Payable (210401)
          { accountCode: '210401', debit: 0, credit: data.totalEmployeeIns + data.totalEmployerIns, notes: `مستحقات هيئة التأمينات الاجتماعية` },
          // Credit: Payroll Taxes Payable (210501)
          { accountCode: '210501', debit: 0, credit: data.totalTax, notes: `مستحقات مصلحة الضرائب (ضريبة كسب العمل)` },
          // Credit: Bank account (110201)
          { accountCode: '110201', debit: 0, credit: data.totalPayout, notes: `صافي الرواتب المنصرفة للبنوك` }
        ],
        {
          org_unit_id: targetOrgUnit,
          cost_center_id: targetCostCenter
        }
      );
    } catch (e) {
      console.error('HR Payroll GL double entry posting error:', e);
    }

    return runRecord;
  }
}
