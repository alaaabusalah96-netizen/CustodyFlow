export type EmployeeDepartment = 'PRODUCTION' | 'POULTRY_MANAGEMENT' | 'SALES' | 'ACCOUNTING' | 'ADMINISTRATION';
export type EmployeeStatus = 'ACTIVE' | 'LEAVE' | 'SUSPENDED';

export interface Employee {
  id: string;
  company_id: string;
  org_unit_id?: string;
  cost_center_id?: string;
  name: string;
  code: string;
  department: EmployeeDepartment;
  jobTitle: string;
  baseSalary: number;
  hireDate: string;
  status: EmployeeStatus;
  createdAt: string;
}

export interface PayrollItem {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  baseSalary: number;
  allowances: number;
  deductions: number; // Includes general manual deductions
  socialInsuranceEmployee: number; // 11% deduction
  socialInsuranceEmployer: number; // 18.75% paid by employer
  payrollTax: number; // Progressive tax
  netSalary: number;
  org_unit_id?: string;
  cost_center_id?: string;
}

export interface PayrollRun {
  id: string;
  company_id: string;
  org_unit_id?: string;
  cost_center_id?: string;
  period: string; // e.g., "2026-07"
  items: PayrollItem[];
  totalPayout: number;
  totalGross: number;
  totalEmployeeIns: number;
  totalEmployerIns: number;
  totalTax: number;
  processedBy: string;
  timestamp: string;
}
