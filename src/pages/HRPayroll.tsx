import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Plus, Calculator, Check, X, FileText, 
  Search, Users, Landmark, Coins, Heart, AlertCircle, Calendar, Edit2, ShieldAlert, Building2
} from 'lucide-react';
import { StorageEngine } from '../db/storage';
import { UsersModule } from '../db/users';
import { CompaniesModule } from '../db/companies';
import { LogsModule } from '../db/logs';
import { dbSetDoc } from '../firebase';
import { AccountingBusinessEngine } from '../lib/enterprise/accounting_engine';
import { OrganizationEngine } from '../db/organizationEngine';
import { HRBusinessEngine } from '../lib/enterprise/hr_engine';
import { Employee, PayrollItem, PayrollRun } from '../types/hr';

export type { Employee, PayrollItem, PayrollRun };

interface HRPayrollProps {
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
}

export default function HRPayroll({ language, theme }: HRPayrollProps) {
  const isRtl = language === 'ar';
  const companyId = CompaniesModule.getSelectedCompanyId() || 'comp-default';
  const activeUser = UsersModule.getActiveUser();

  // Core States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');

  // Organization Engine State
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [selectedOrgUnitFilter, setSelectedOrgUnitFilter] = useState<string>('ALL');
  const [formOrgUnitId, setFormOrgUnitId] = useState<string>('');

  // Modals
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showProcessPayroll, setShowProcessPayroll] = useState(false);

  // Form States - Employee
  const [empForm, setEmpForm] = useState({
    name: '', department: 'PRODUCTION' as Employee['department'], jobTitle: '', baseSalary: 0,
    hireDate: new Date().toISOString().split('T')[0], status: 'ACTIVE' as Employee['status']
  });

  // Payroll run states
  const [payrollPeriod, setPayrollPeriod] = useState('2026-07');
  const [payrollSheet, setPayrollSheet] = useState<PayrollItem[]>([]);
  const [isPayrollGenerated, setIsPayrollGenerated] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Employees
  const loadEmployees = () => {
    const units = OrganizationEngine.getUnits(companyId);
    setOrgUnits(units);

    const companyEmployees = HRBusinessEngine.getEmployeesByOrgUnit(companyId, selectedOrgUnitFilter);

    if (companyEmployees.length === 0 && selectedOrgUnitFilter === 'ALL') {
      // Seed default employees
      const defaultEmployees: Employee[] = [
        {
          id: 'emp-1',
          company_id: companyId,
          name: isRtl ? 'أحمد عبد الرحمن (مشرف إنتاج علف)' : 'Ahmed Abdel-Rahman (Feed Production Supervisor)',
          code: 'EMP-PROD-201',
          department: 'PRODUCTION',
          jobTitle: 'Production Supervisor',
          baseSalary: 12500,
          hireDate: '2025-02-15',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        },
        {
          id: 'emp-2',
          company_id: companyId,
          name: isRtl ? 'د. مروان عادل (طبيب بيطري)' : 'Dr. Marwan Adel (Veterinary Doctor)',
          code: 'EMP-POUL-202',
          department: 'POULTRY_MANAGEMENT',
          jobTitle: 'Senior Veterinarian',
          baseSalary: 18000,
          hireDate: '2024-11-01',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        },
        {
          id: 'emp-3',
          company_id: companyId,
          name: isRtl ? 'سارة محمد (محاسب مالي أول)' : 'Sara Mohamed (Senior Accountant)',
          code: 'EMP-ACCT-203',
          department: 'ACCOUNTING',
          jobTitle: 'Senior Accountant',
          baseSalary: 11000,
          hireDate: '2025-05-10',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        }
      ];
      StorageEngine.setStored('employees_payroll_items', defaultEmployees);
      setEmployees(defaultEmployees);
    } else {
      setEmployees(companyEmployees);
    }
  };

  useEffect(() => {
    loadEmployees();
    const onUpdate = () => loadEmployees();
    window.addEventListener('custody_db_updated', onUpdate);
    return () => window.removeEventListener('custody_db_updated', onUpdate);
  }, [companyId, selectedOrgUnitFilter]);

  // Calculations
  const totalBasePay = employees.reduce((sum, e) => sum + e.baseSalary, 0);
  const activeStaffCount = employees.filter(e => e.status === 'ACTIVE').length;
  const averageSalary = employees.length > 0 ? (totalBasePay / employees.length) : 0;

  // Submit Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name || !empForm.jobTitle) {
      showToast('error', isRtl ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    if (empForm.baseSalary <= 0) {
      showToast('error', isRtl ? 'الراتب الأساسي يجب أن يكون أكبر من الصفر' : 'Base salary must be greater than zero');
      return;
    }

    try {
      const newEmp = await HRBusinessEngine.createEmployee(companyId, {
        name: empForm.name,
        department: empForm.department,
        jobTitle: empForm.jobTitle,
        baseSalary: Number(empForm.baseSalary),
        hireDate: empForm.hireDate,
        status: empForm.status,
        org_unit_id: formOrgUnitId || activeUser?.org_unit_id
      });

      // Logs
      LogsModule.addLog(
        activeUser?.id || 'system',
        activeUser?.full_name || 'System',
        isRtl ? 'تعيين موظف جديد' : 'Hired New Employee',
        `Registered employee ${newEmp.name} under department ${newEmp.department} with base salary ${newEmp.baseSalary.toLocaleString()} EGP`
      );

      showToast('success', isRtl ? 'تم تسجيل بيانات الموظف بنجاح' : 'Employee registered successfully');
      setEmpForm({ name: '', department: 'PRODUCTION', jobTitle: '', baseSalary: 0, hireDate: new Date().toISOString().split('T')[0], status: 'ACTIVE' });
      setFormOrgUnitId('');
      setShowAddEmployee(false);
      loadEmployees();
    } catch (err) {
      console.error('Create employee error:', err);
      showToast('error', isRtl ? 'حدث خطأ أثناء تسجيل بيانات الموظف' : 'Error registering employee');
    }
  };

  // Helper to calculate official Egyptian social insurance and tax deductions
  const calculateEgyptianDeductions = (base: number) => {
    // Insurable limit is capped at 12,600 EGP in Egypt for standard monthly base
    const insurableBase = Math.min(base, 12600);
    const socialInsuranceEmployee = Math.round(insurableBase * 0.11);
    const socialInsuranceEmployer = Math.round(insurableBase * 0.1875);
    
    // Taxable monthly base: base - employee insurance portion - standard personal exemption (monthly personal exemption ~3500 EGP)
    const taxableBase = Math.max(0, base - socialInsuranceEmployee - 3500);
    
    // Egyptian Payroll Tax Bracket Simulation (Monthly representation of standard brackets)
    let payrollTax = 0;
    if (taxableBase <= 4000) {
      payrollTax = 0;
    } else if (taxableBase <= 7000) {
      payrollTax = Math.round((taxableBase - 4000) * 0.025);
    } else if (taxableBase <= 10000) {
      payrollTax = Math.round(75 + (taxableBase - 7000) * 0.10);
    } else {
      payrollTax = Math.round(375 + (taxableBase - 10000) * 0.15);
    }
    
    return {
      socialInsuranceEmployee,
      socialInsuranceEmployer,
      payrollTax
    };
  };

  // Generate Payroll Sheet
  const handleGeneratePayrollSheet = () => {
    const list = employees.filter(e => e.status === 'ACTIVE').map(e => {
      const { socialInsuranceEmployee, socialInsuranceEmployer, payrollTax } = calculateEgyptianDeductions(e.baseSalary);
      const netSalary = e.baseSalary - socialInsuranceEmployee - payrollTax;
      return {
        employeeId: e.id,
        employeeName: e.name,
        employeeCode: e.code,
        baseSalary: e.baseSalary,
        allowances: 0,
        deductions: 0,
        socialInsuranceEmployee,
        socialInsuranceEmployer,
        payrollTax,
        netSalary
      };
    });
    setPayrollSheet(list);
    setIsPayrollGenerated(true);
  };

  // Update sheet cell (Allowances / Deductions)
  const updateSheetItem = (empId: string, field: 'allowances' | 'deductions', value: number) => {
    setPayrollSheet(payrollSheet.map(item => {
      if (item.employeeId === empId) {
        const allow = field === 'allowances' ? value : item.allowances;
        const deduct = field === 'deductions' ? value : item.deductions;
        const net = item.baseSalary + allow - deduct - item.socialInsuranceEmployee - item.payrollTax;
        return {
          ...item,
          [field]: value,
          netSalary: net
        };
      }
      return item;
    }));
  };

  // Post Settle Payroll Sheet
  const handlePostPayroll = async () => {
    if (payrollSheet.length === 0) return;

    const totalGross = payrollSheet.reduce((sum, item) => sum + item.baseSalary + item.allowances, 0);
    const totalEmployeeIns = payrollSheet.reduce((sum, item) => sum + item.socialInsuranceEmployee, 0);
    const totalEmployerIns = payrollSheet.reduce((sum, item) => sum + item.socialInsuranceEmployer, 0);
    const totalTax = payrollSheet.reduce((sum, item) => sum + item.payrollTax, 0);
    const totalNet = payrollSheet.reduce((sum, item) => sum + item.netSalary, 0);

    try {
      await HRBusinessEngine.processPayrollRun(
        companyId,
        activeUser?.id || 'system',
        activeUser?.full_name || 'HR Manager',
        {
          period: payrollPeriod,
          sheet: payrollSheet,
          totalPayout: totalNet,
          totalGross,
          totalEmployeeIns,
          totalEmployerIns,
          totalTax,
          org_unit_id: formOrgUnitId || activeUser?.org_unit_id
        }
      );

      // Audit Log and log double-entry transaction
      LogsModule.addLog(
        activeUser?.id || 'system',
        activeUser?.full_name || 'System',
        isRtl ? 'ترحيل مسير رواتب الموظفين' : 'Post HR Monthly Payroll',
        `Processed payroll run for period ${payrollPeriod}. Total Payout: ${totalNet.toLocaleString()} EGP`
      );

      showToast('success', isRtl ? 'تم ترحيل وصرف مسير الرواتب الشهري للموظفين بنجاح وتوليد قيد اليومية الآلي' : 'Monthly payroll processed and posted successfully with automated GL ledger entries');
      setIsPayrollGenerated(false);
      setPayrollSheet([]);
      setFormOrgUnitId('');
      setShowProcessPayroll(false);
      loadEmployees();
    } catch (err) {
      console.error('Post payroll error:', err);
      showToast('error', isRtl ? 'حدث خطأ أثناء ترحيل مسير الرواتب' : 'Error processing payroll run');
    }
  };

  // Filters
  const filteredEmployees = employees.filter(e => {
    const matchesDept = deptFilter === 'ALL' || e.department === deptFilter;
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Toast Feedback */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-white flex items-center gap-3 transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'
        }`}>
          <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-bold font-sans">{toast.text}</span>
        </div>
      )}

      {/* Main Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="text-emerald-500 h-6 w-6" />
            <span>{isRtl ? 'الموارد البشرية والرواتب' : 'HR & Payroll Ledger'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl 
              ? 'إدارة شؤون العاملين وسجلات تعيين الموظفين، صياغة بدلات واستقطاعات مسير الرواتب الشهري.' 
              : 'Employee files tracking, role assignments, allowances/deductions model, and monthly payroll processing.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProcessPayroll(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Calculator className="h-4 w-4" />
            <span>{isRtl ? 'مسير الرواتب الشهري' : 'Process Payroll'}</span>
          </button>
          <button
            onClick={() => setShowAddEmployee(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{isRtl ? 'تعيين موظف جديد' : 'Hire Employee'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{isRtl ? 'عدد الكادر والموظفين الفعالين' : 'Active Personnel'}</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{activeStaffCount} {isRtl ? 'موظفين' : 'Staff'}</h3>
          </div>
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{isRtl ? 'إجمالي الرواتب الأساسية المعلقة' : 'Total Base Salary Pool'}</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{totalBasePay.toLocaleString()} EGP</h3>
          </div>
          <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
            <Coins className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{isRtl ? 'متوسط أجور الشركة' : 'Average Wage'}</p>
            <h3 className="text-lg font-black text-indigo-600 mt-1">{averageSalary.toLocaleString(undefined, {maximumFractionDigits:0})} EGP</h3>
          </div>
          <div className="p-2 bg-pink-500/10 text-pink-600 rounded-xl">
            <Heart className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* HR Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-1">
        {(['employees', 'payroll'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === tab
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'employees' && (isRtl ? 'كتالوج الموظفين' : 'Employee Directory')}
            {tab === 'payroll' && (isRtl ? 'الرواتب المصروفة سابقاً' : 'Salary Runs History')}
          </button>
        ))}
      </div>

      {/* Employee directory view */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={isRtl ? 'ابحث باسم الموظف أو رقم الكود...' : 'Search by employee name or code...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="ALL">{isRtl ? 'جميع الأقسام' : 'All Departments'}</option>
                <option value="PRODUCTION">{isRtl ? 'إنتاج وتصنيع الأعلاف' : 'Feed Production'}</option>
                <option value="POULTRY_MANAGEMENT">{isRtl ? 'إدارة القطاع الداجني' : 'Poultry Sector'}</option>
                <option value="SALES">{isRtl ? 'إدارة التسويق والمبيعات' : 'Sales'}</option>
                <option value="ACCOUNTING">{isRtl ? 'الحسابات والمحاسبة المالية' : 'Accounting'}</option>
                <option value="ADMINISTRATION">{isRtl ? 'الإدارة العامة والموارد' : 'Administration'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((e) => (
              <div key={e.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between h-[170px]">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-400 font-bold uppercase">{e.code}</span>
                      <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1.5">{e.name}</h3>
                    </div>
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                      e.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}>
                      {e.status}
                    </span>
                  </div>

                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">{e.jobTitle} | {e.department}</p>
                </div>

                <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-medium">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{isRtl ? 'تاريخ التعيين:' : 'Hired Date:'}</span>
                    <span className="font-mono text-slate-500 block">{e.hireDate}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{isRtl ? 'الراتب الأساسي:' : 'Base Salary:'}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-100 font-black text-xs block">{e.baseSalary.toLocaleString()} EGP</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salary runs history */}
      {activeTab === 'payroll' && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-center text-slate-400 font-medium p-8">
          {isRtl ? 'لم يتم ترحيل أي رواتب شهرية مطبوعة بعد في الفترة المحاسبية الحالية.' : 'No salary sheets posted yet for the current fiscal period.'}
        </div>
      )}

      {/* MODAL 1: REGISTER NEW EMPLOYEE */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddEmployee(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={16} />
            </button>
            <h3 className="text-md font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Users className="text-emerald-500 h-5 w-5" />
              <span>{isRtl ? 'تسجيل وتوظيف موظف جديد' : 'Hire New Employee'}</span>
            </h3>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'الاسم بالكامل للموظف *' : 'Employee Full Name *'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aly, Mona..."
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'القسم الوظيفي' : 'Department'}</label>
                  <select
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PRODUCTION">{isRtl ? 'إنتاج علف' : 'Feed Production'}</option>
                    <option value="POULTRY_MANAGEMENT">{isRtl ? 'القطاع الداجني' : 'Poultry Sector'}</option>
                    <option value="SALES">{isRtl ? 'المبيعات والتسويق' : 'Sales'}</option>
                    <option value="ACCOUNTING">{isRtl ? 'الحسابات والمحاسبة' : 'Accounting'}</option>
                    <option value="ADMINISTRATION">{isRtl ? 'الإدارة العامة' : 'Administration'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'المسمى الوظيفي *' : 'Job Title *'}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operator, Analyst"
                    value={empForm.jobTitle}
                    onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'الراتب الأساسي (EGP) *' : 'Base Salary (EGP) *'}</label>
                  <input
                    type="number"
                    required
                    value={empForm.baseSalary}
                    onChange={(e) => setEmpForm({ ...empForm, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'تاريخ التعيين' : 'Hiring Date'}</label>
                  <input
                    type="date"
                    value={empForm.hireDate}
                    onChange={(e) => setEmpForm({ ...empForm, hireDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddEmployee(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                >
                  {isRtl ? 'حفظ وبيان التعيين' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MONTHLY PAYROLL PROCESS */}
      {showProcessPayroll && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowProcessPayroll(false);
                setIsPayrollGenerated(false);
                setPayrollSheet([]);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={16} />
            </button>
            <h3 className="text-md font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              <Calculator className="text-indigo-500 h-5 w-5" />
              <span>{isRtl ? 'محرك احتساب وصرف مسير الرواتب' : 'HR Payroll Run Engine'}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {isRtl 
                ? 'توليد مسير الرواتب المالي الشهري، مع إمكانية تعديل البدلات والاستقطاعات بشكل فوري لكل موظف نشط بالشركة.'
                : 'Process wages for active staff. Direct inline adjustments to Allowances (bonuses) and Deductions are computed automatically.'}
            </p>

            <div className="space-y-4 text-xs font-medium">
              <div className="flex items-end gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'الفترة المالية / الشهر:' : 'Payroll Month period:'}</label>
                  <input
                    type="month"
                    value={payrollPeriod}
                    onChange={(e) => setPayrollPeriod(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
                <button
                  onClick={handleGeneratePayrollSheet}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all h-[36px]"
                >
                  {isRtl ? 'إنشاء مسير الرواتب' : 'Generate Payroll Sheet'}
                </button>
              </div>

              {isPayrollGenerated && (
                <div className="space-y-4">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="p-2 text-left">{isRtl ? 'الموظف' : 'Staff'}</th>
                          <th className="p-2 text-right">{isRtl ? 'الراتب الأساسي' : 'Base Pay'}</th>
                          <th className="p-2 text-center">{isRtl ? 'البدلات (اضافي)' : 'Allowances (+)'}</th>
                          <th className="p-2 text-center">{isRtl ? 'الاستقطاعات (-)' : 'Deductions (-)'}</th>
                          <th className="p-2 text-right">{isRtl ? 'صافي الراتب' : 'Net Salary'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {payrollSheet.map((item, idx) => (
                          <tr key={idx} className="text-slate-700 dark:text-slate-300 font-sans">
                            <td className="p-2">
                              <p className="font-bold">{item.employeeName}</p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[9px] text-slate-400">
                                <span className="font-mono">{item.employeeCode}</span>
                                <span>•</span>
                                <span>{isRtl ? `تأمينات (11%):` : `Ins (11%):`} <strong className="font-mono text-rose-500">-{item.socialInsuranceEmployee} EGP</strong></span>
                                <span>•</span>
                                <span>{isRtl ? `كسب عمل:` : `Tax:`} <strong className="font-mono text-rose-500">-{item.payrollTax} EGP</strong></span>
                                <span>•</span>
                                <span className="text-indigo-500">{isRtl ? `حصة الشركة (18.75%):` : `Employer Ins (18.75%):`} <strong className="font-mono">+{item.socialInsuranceEmployer} EGP</strong></span>
                              </div>
                            </td>
                            <td className="p-2 text-right font-mono font-bold">{item.baseSalary.toLocaleString()}</td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={item.allowances}
                                onChange={(e) => updateSheetItem(item.employeeId, 'allowances', Number(e.target.value))}
                                className="w-20 text-center border rounded px-1.5 py-0.5 font-mono dark:bg-slate-950 text-emerald-600 dark:border-slate-800"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={item.deductions}
                                onChange={(e) => updateSheetItem(item.employeeId, 'deductions', Number(e.target.value))}
                                className="w-20 text-center border rounded px-1.5 py-0.5 font-mono dark:bg-slate-950 text-rose-500 dark:border-slate-800"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-black text-emerald-600">{(item.netSalary).toLocaleString()} EGP</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-bold">{isRtl ? 'إجمالي مستحقات المسير المصروفة:' : 'Total Monthly HR Net Payroll:'}</span>
                    <span className="font-mono font-black text-emerald-600 text-sm">
                      {payrollSheet.reduce((sum, item) => sum + item.netSalary, 0).toLocaleString()} EGP
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProcessPayroll(false);
                        setIsPayrollGenerated(false);
                        setPayrollSheet([]);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={handlePostPayroll}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      {isRtl ? 'اعتماد وصرف الرواتب للبنك/العهد' : 'Post & Disburse Payroll'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
