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

  static async saveCompanies(companies: Company[]): Promise<{ success: boolean; error?: string }> {
    const existing = StorageEngine.getStored<Company[]>('companies', []);
    const changedCompanies = companies.filter(c => {
      const old = existing.find(ex => ex.id === c.id);
      if (!old) return true;
      return JSON.stringify(old) !== JSON.stringify(c);
    });

    for (const c of changedCompanies) {
      const res = await syncWriteWithOfflineFallback('companies', c.id, c);
      if (!res.success) {
        const errorMsg = res.error || `فشل حفظ بيانات الشركة ${c.name || c.id} في قاعدة البيانات.`;
        console.warn(`[saveCompanies] Warning: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }

    StorageEngine.setStored('companies', companies);
    return { success: true };
  }

  static async addCompany(name: string, custodyValue?: number): Promise<Company | null> {
    const companies = CompaniesModule.getCompanies();
    const val = custodyValue ?? 0;
    const newCompany: Company = {
      id: crypto.randomUUID(),
      name,
      custody_value: val
    };
    const updated = [...companies, newCompany];
    const res = await CompaniesModule.saveCompanies(updated);
    if (!res.success) {
      return null;
    }
    
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Company', `Created new company: ${name}`);
    return newCompany;
  }

  static async updateCompany(id: string, updates: Partial<Company>): Promise<{ success: boolean; error?: string }> {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === id);
    if (idx !== -1) {
      const updated = [...companies];
      updated[idx] = { ...updated[idx], ...updates };
      const res = await CompaniesModule.saveCompanies(updated);
      if (!res.success) {
        return res;
      }
      const user = UsersModule.getActiveUser();
      LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Company', `Modified company: ${updated[idx].name}`);
      return { success: true };
    }
    return { success: false, error: 'Company not found' };
  }

  static async deleteCompany(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await syncWriteWithOfflineFallback('companies', id, null);
    if (!res.success) {
      console.warn(`[deleteCompany] Warning: ${res.error}`);
      return { success: false, error: res.error };
    }
    const companies = CompaniesModule.getCompanies().filter(c => c.id !== id);
    StorageEngine.setStored('companies', companies);
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Company', `Deleted company ID: ${id}`);
    return { success: true };
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

  static async toggleCompanyStatus(companyId: string, isActive: boolean): Promise<void> {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      const updated = [...companies];
      updated[idx] = { ...updated[idx], is_active: isActive };
      const res = await CompaniesModule.saveCompanies(updated);
      if (!res.success) return;
      
      const activeUser = UsersModule.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      const statusStr = isActive ? 'Activated' : 'Suspended';
      LogsModule.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Toggle Company Status', `${statusStr} company ${updated[idx].name}`);
      LogsModule.logAudit('COMPANY_STATUS_TOGGLE', `Super Admin ${statusStr.toLowerCase()} company ${updated[idx].name}`, {
        company_id: companyId,
        company_name: updated[idx].name,
        is_active: isActive
      });
    }
  }

  static async updateCompanySubscription(
    companyId: string,
    plan: Company['subscription_plan'],
    status: Company['subscription_status'],
    expiry: string
  ): Promise<void> {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      const updated = [...companies];
      updated[idx] = { 
        ...updated[idx], 
        subscription_plan: plan, 
        subscription_status: status, 
        subscription_expiry: expiry 
      };
      const res = await CompaniesModule.saveCompanies(updated);
      if (!res.success) return;
      
      const activeUser = UsersModule.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      LogsModule.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Update Subscription', `Updated subscription for ${updated[idx].name} to ${plan} (${status})`);
      LogsModule.logAudit('COMPANY_SUBSCRIPTION_UPDATE', `Super Admin updated subscription for company ${updated[idx].name} to plan ${plan} with status ${status}`, {
        company_id: companyId,
        company_name: updated[idx].name,
        subscription_plan: plan,
        subscription_status: status,
        subscription_expiry: expiry
      });
    }
  }

  static async setCompanyGroup(companyId: string, groupId: string | undefined): Promise<void> {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      const updated = [...companies];
      updated[idx] = { ...updated[idx], group_id: groupId };
      const res = await CompaniesModule.saveCompanies(updated);
      if (!res.success) return;
      
      const user = UsersModule.getActiveUser();
      LogsModule.addLog(
        user?.id || 'system', 
        user?.full_name || 'System', 
        'Set Company Group', 
        `Associated company ${updated[idx].name} with business group ID: ${groupId || 'None'}`
      );
      LogsModule.logAudit('COMPANY_GROUP_ASSOCIATION', `Associated company ${updated[idx].name} with business group ID ${groupId || 'None'}`, {
        company_id: companyId,
        group_id: groupId
      });
    }
  }

  static async markCompanyAsMerged(sourceCompanyId: string, targetCompanyId: string): Promise<void> {
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === sourceCompanyId);
    if (idx !== -1) {
      const updated = [...companies];
      updated[idx] = { 
        ...updated[idx], 
        status_merge: 'MERGED', 
        merged_into_company_id: targetCompanyId 
      };
      const res = await CompaniesModule.saveCompanies(updated);
      if (!res.success) return;
      
      const user = UsersModule.getActiveUser();
      LogsModule.addLog(
        user?.id || 'system', 
        user?.full_name || 'System', 
        'Merge Company', 
        `Marked company ${updated[idx].name} as MERGED into target company ID: ${targetCompanyId}`
      );
      LogsModule.logAudit('COMPANY_MERGED', `Marked company ${updated[idx].name} as merged into company ID ${targetCompanyId}`, {
        source_company_id: sourceCompanyId,
        target_company_id: targetCompanyId
      });
      
      // TODO: Future search and report screens must track merged_into_company_id for data consolidation
      // and redirect query visibility from sourceCompanyId to targetCompanyId per business requirements.
    }
  }
}

