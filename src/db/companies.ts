import { Company } from '../types';
import { dbSetDoc, dbDeleteDoc } from '../firebase';
import { StorageEngine } from './storage';
import { syncWriteWithOfflineFallback } from './offlineQueue';
import { DEFAULT_COMPANIES } from './defaults';
import { UsersModule } from './users';
import { LogsModule } from './logs';

export class CompaniesModule {
  static getCompanies(): Company[] {
    return StorageEngine.getStored<Company[]>('companies', DEFAULT_COMPANIES);
  }

  static saveCompanies(companies: Company[]): void {
    StorageEngine.setStored('companies', companies);
    companies.forEach(c => syncWriteWithOfflineFallback('companies', c.id, c).catch(() => {}));
  }

  static addCompany(name: string, custodyValue?: number): Company {
    const companies = CompaniesModule.getCompanies();
    const val = custodyValue ?? 0;
    const newCompany: Company = {
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // FIX: avoid id collisions under concurrent creation
      name,
      custody_value: val
    };
    companies.push(newCompany);
    CompaniesModule.saveCompanies(companies);
    
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Company', `Created new company: ${name}`);
    return newCompany;
  }

  static updateCompany(id: string, updates: Partial<Company>): void {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === id);
    if (idx !== -1) {
      companies[idx] = { ...companies[idx], ...updates };
      CompaniesModule.saveCompanies(companies);
      const user = UsersModule.getActiveUser();
      LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Company', `Modified company: ${companies[idx].name}`);
    }
  }

  static deleteCompany(id: string): void {
    const companies = CompaniesModule.getCompanies().filter(c => c.id !== id);
    CompaniesModule.saveCompanies(companies);
    syncWriteWithOfflineFallback('companies', id, null).catch(() => {});
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Company', `Deleted company ID: ${id}`);
  }

  static getSelectedCompanyId(): string {
    const resolveFromStorage = (): string => {
      const stored = StorageEngine.getStored<string>('selected_company_id', '');
      if (stored && stored !== 'undefined' && stored !== 'null') return stored;

      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('custody_selected_company_id');
        if (saved && saved !== 'undefined' && saved !== 'null') {
          try {
            const parsed = JSON.parse(saved);
            if (typeof parsed === 'string') return parsed;
          } catch {
            return saved;
          }
        }
      }
      return '';
    };

    const user = UsersModule.getActiveUser();
    if (!user) {
      return resolveFromStorage();
    }
    
    if (user.role !== 'SystemAdmin' && user.company_id) {
      return user.company_id;
    }
    
    return resolveFromStorage();
  }

  static setSelectedCompanyId(id: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('custody_selected_company_id', id);
    }
    StorageEngine.setStored('selected_company_id', id);
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Switch Company', `Viewing focus changed to company ID: ${id}`);
  }

  static toggleCompanyStatus(companyId: string, isActive: boolean): void {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      companies[idx] = { ...companies[idx], is_active: isActive };
      CompaniesModule.saveCompanies(companies);
      
      const activeUser = UsersModule.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      const statusStr = isActive ? 'Activated' : 'Suspended';
      LogsModule.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Toggle Company Status', `${statusStr} company ${companies[idx].name}`);
      LogsModule.logAudit('COMPANY_STATUS_TOGGLE', `Super Admin ${statusStr.toLowerCase()} company ${companies[idx].name}`, {
        company_id: companyId,
        company_name: companies[idx].name,
        is_active: isActive
      });
    }
  }

  static updateCompanySubscription(
    companyId: string,
    plan: Company['subscription_plan'],
    status: Company['subscription_status'],
    expiry: string
  ): void {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      companies[idx] = { 
        ...companies[idx], 
        subscription_plan: plan, 
        subscription_status: status, 
        subscription_expiry: expiry 
      };
      CompaniesModule.saveCompanies(companies);
      
      const activeUser = UsersModule.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      LogsModule.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Update Subscription', `Updated subscription for ${companies[idx].name} to ${plan} (${status})`);
      LogsModule.logAudit('COMPANY_SUBSCRIPTION_UPDATE', `Super Admin updated subscription for company ${companies[idx].name} to plan ${plan} with status ${status}`, {
        company_id: companyId,
        company_name: companies[idx].name,
        subscription_plan: plan,
        subscription_status: status,
        subscription_expiry: expiry
      });
    }
  }

  static setCompanyGroup(companyId: string, groupId: string | undefined): void {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      companies[idx] = { ...companies[idx], group_id: groupId };
      CompaniesModule.saveCompanies(companies);
      
      const user = UsersModule.getActiveUser();
      LogsModule.addLog(
        user?.id || 'system', 
        user?.full_name || 'System', 
        'Set Company Group', 
        `Associated company ${companies[idx].name} with business group ID: ${groupId || 'None'}`
      );
      LogsModule.logAudit('COMPANY_GROUP_ASSOCIATION', `Associated company ${companies[idx].name} with business group ID ${groupId || 'None'}`, {
        company_id: companyId,
        group_id: groupId
      });
    }
  }

  static markCompanyAsMerged(sourceCompanyId: string, targetCompanyId: string): void {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === sourceCompanyId);
    if (idx !== -1) {
      companies[idx] = { 
        ...companies[idx], 
        status_merge: 'MERGED', 
        merged_into_company_id: targetCompanyId 
      };
      CompaniesModule.saveCompanies(companies);
      
      const user = UsersModule.getActiveUser();
      LogsModule.addLog(
        user?.id || 'system', 
        user?.full_name || 'System', 
        'Merge Company', 
        `Marked company ${companies[idx].name} as MERGED into target company ID: ${targetCompanyId}`
      );
      LogsModule.logAudit('COMPANY_MERGED', `Marked company ${companies[idx].name} as merged into company ID ${targetCompanyId}`, {
        source_company_id: sourceCompanyId,
        target_company_id: targetCompanyId
      });
      
      // TODO: Future search and report screens must track merged_into_company_id for data consolidation
      // and redirect query visibility from sourceCompanyId to targetCompanyId per business requirements.
    }
  }
}

