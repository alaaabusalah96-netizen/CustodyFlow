import { Region, Station } from '../types';
import { StorageEngine } from './storage';
import { syncWriteWithOfflineFallback } from './offlineQueue';
import { DEFAULT_REGIONS, DEFAULT_STATIONS } from './defaults';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { CompaniesModule } from './companies';
import { OrganizationScopeEngine } from './organizationScopeEngine';
import { OrganizationEngine } from './organizationEngine';
import { OrganizationUnit } from '../types/organization';
import { requireCompanyId } from './companyGuard';

export class StationsModule {
  // Regions
  static getRegions(): Region[] {
    return StorageEngine.getStored<Region[]>('regions', DEFAULT_REGIONS);
  }

  static getScopedRegions(): Region[] {
    const regions = StationsModule.getRegions();
    const user = UsersModule.getActiveUser();
    if (!user) return [];

    if (user.role === 'SystemAdmin') {
      const targetCompanyId = CompaniesModule.getSelectedCompanyId();
      return regions.filter(r => r.company_id === targetCompanyId);
    }

    const userCompanyId = user.company_id;
    let filtered = regions.filter(r => r.company_id === userCompanyId);

    // Organization Scope evaluation with tree inheritance
    if (user.org_unit_id || (user.assigned_org_unit_ids && user.assigned_org_unit_ids.length > 0)) {
      return OrganizationScopeEngine.filterByOrganizationScope(filtered, user);
    }

    if (user.role === 'RegionalManager') {
      if (user.region_id) {
        filtered = filtered.filter(r => r.id === user.region_id);
      }
    } else if (user.role === 'StationAdmin') {
      if (user.station_id) {
        const stations = StationsModule.getStations();
        const station = stations.find(s => s.id === user.station_id);
        if (station && station.region_id) {
          filtered = filtered.filter(r => r.id === station.region_id);
        } else {
          return [];
        }
      } else {
        return [];
      }
    }

    return filtered;
  }

  static async saveRegions(regions: Region[]): Promise<{ success: boolean; error?: string }> {
    const existing = StorageEngine.getStored<Region[]>('regions', []);
    const changedRegions = regions.filter(r => {
      const old = existing.find(ex => ex.id === r.id);
      if (!old) return true;
      return JSON.stringify(old) !== JSON.stringify(r);
    });

    for (const r of changedRegions) {
      const res = await syncWriteWithOfflineFallback('regions', r.id, r);
      if (!res.success) {
        const errorMsg = res.error || `فشل حفظ بيانات المنطقة ${r.name || r.id} في قاعدة البيانات.`;
        console.warn(`[saveRegions] Warning: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }

    StorageEngine.setStored('regions', regions);
    return { success: true };
  }

  static async addRegion(name: string, code?: string, companyId?: string): Promise<Region | null> {
    const compId = requireCompanyId(companyId || CompaniesModule.getSelectedCompanyId());
    const regions = StationsModule.getRegions();
    const regId = crypto.randomUUID();
    const org_unit_id = `org-unit-region-${regId}`;

    const newReg: Region = {
      id: regId,
      name,
      code: code || '',
      company_id: compId,
      org_unit_id
    };
    let createdUnitId: string | null = null;
    // Compatibility sync: mirror creation into Organization Engine
    try {
      const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
      const parentUnit = units.find(u => u.id === `org-unit-company-${compId}` || (u.companyId === compId && u.typeId === 'out-company'));

      const createdUnit = await OrganizationEngine.addUnit({
        companyId: compId,
        parentId: parentUnit?.id || null,
        typeId: 'out-region',
        code: code || `REG-${regId}`,
        name: name,
        nameAr: name,
        nameEn: name,
        metadata: { legacyRegionId: regId },
        isActive: true
      });
      if (createdUnit?.id) {
        createdUnitId = createdUnit.id;
      }
    } catch (err) {
      console.warn('Region compatibility sync to OrganizationUnit failed:', err);
    }

    if (createdUnitId) {
      newReg.org_unit_id = createdUnitId;
    }

    const updated = [...regions, newReg];
    const res = await StationsModule.saveRegions(updated);
    if (!res.success) {
      return null;
    }

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Region', `Created region: ${name}`);
    return newReg;
  }

  static async updateRegion(id: string, updates: Partial<Region>): Promise<{ success: boolean; error?: string }> {
    const regions = StationsModule.getRegions();
    const idx = regions.findIndex(r => r.id === id);
    if (idx !== -1) {
      const updated = [...regions];
      updated[idx] = { ...updated[idx], ...updates };
      const res = await StationsModule.saveRegions(updated);
      if (!res.success) {
        return res;
      }

      // Compatibility sync: update corresponding OrganizationUnit
      try {
        const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
        const matchedUnit = units.find(u => u.id === `org-unit-region-${id}` || (u.metadata && u.metadata.legacyRegionId === id));
        if (matchedUnit) {
          OrganizationEngine.updateUnit(matchedUnit.id, {
            name: updates.name || matchedUnit.name,
            nameAr: updates.name || matchedUnit.nameAr,
            nameEn: updates.name || matchedUnit.nameEn,
            code: updates.code !== undefined ? updates.code : matchedUnit.code
          });
        }
      } catch (err) {
        console.warn('Region compatibility sync update failed:', err);
      }

      const user = UsersModule.getActiveUser();
      LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Region', `Modified region: ${updated[idx].name}`);
      return { success: true };
    }
    return { success: false, error: 'Region not found' };
  }

  static async deleteRegion(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await syncWriteWithOfflineFallback('regions', id, null);
    if (!res.success) {
      console.warn(`[deleteRegion] Warning: ${res.error}`);
      return { success: false, error: res.error };
    }
    const regions = StationsModule.getRegions().filter(r => r.id !== id);
    StorageEngine.setStored('regions', regions);

    // Compatibility sync: delete corresponding OrganizationUnit
    try {
      const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
      const matchedUnit = units.find(u => u.id === `org-unit-region-${id}` || (u.metadata && u.metadata.legacyRegionId === id));
      if (matchedUnit) {
        OrganizationEngine.deleteUnit(matchedUnit.id);
      }
    } catch (err) {
      console.warn('Region compatibility sync delete failed:', err);
    }

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Region', `Deleted region ID: ${id}`);
    return { success: true };
  }

  // Stations
  static getStations(): Station[] {
    return StorageEngine.getStored<Station[]>('stations', DEFAULT_STATIONS);
  }

  static getScopedStations(): Station[] {
    const stations = StationsModule.getStations();
    const user = UsersModule.getActiveUser();
    if (!user) return [];

    if (user.role === 'SystemAdmin') {
      const targetCompanyId = CompaniesModule.getSelectedCompanyId();
      return stations.filter(s => s.company_id === targetCompanyId);
    }

    const userCompanyId = user.company_id;
    let filtered = stations.filter(s => s.company_id === userCompanyId);

    // Organization Scope evaluation with tree inheritance
    if (user.org_unit_id || (user.assigned_org_unit_ids && user.assigned_org_unit_ids.length > 0)) {
      return OrganizationScopeEngine.filterByOrganizationScope(filtered, user);
    }

    if (user.role === 'RegionalManager') {
      if (user.region_id) {
        filtered = filtered.filter(s => s.region_id === user.region_id);
      }
    } else if (user.role === 'StationAdmin') {
      if (user.station_id) {
        filtered = filtered.filter(s => s.id === user.station_id);
      } else {
        return [];
      }
    }

    return filtered;
  }

  static async saveStations(stations: Station[]): Promise<{ success: boolean; error?: string }> {
    const existing = StorageEngine.getStored<Station[]>('stations', []);
    const changedStations = stations.filter(s => {
      const old = existing.find(ex => ex.id === s.id);
      if (!old) return true;
      return JSON.stringify(old) !== JSON.stringify(s);
    });

    for (const s of changedStations) {
      const res = await syncWriteWithOfflineFallback('stations', s.id, s);
      if (!res.success) {
        const errorMsg = res.error || `فشل حفظ بيانات المحطة ${s.station_name || s.id} في قاعدة البيانات.`;
        console.warn(`[saveStations] Warning: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }

    StorageEngine.setStored('stations', stations);
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Stations', 'Modified available cash custody stations configuration.');
    return { success: true };
  }

  static async addStation(name: string, code: string, custodyAmount: number, regionId?: string, companyId?: string): Promise<Station | null> {
    const compId = requireCompanyId(companyId || CompaniesModule.getSelectedCompanyId());
    const stations = StationsModule.getStations();
    const stnId = crypto.randomUUID();
    const org_unit_id = `org-unit-station-${stnId}`;

    const newStn: Station = {
      id: stnId,
      station_name: name,
      station_code: code,
      custody_amount: custodyAmount,
      is_active: true,
      region_id: regionId || undefined,
      company_id: compId,
      org_unit_id
    };
    let createdUnitId: string | null = null;
    // Compatibility sync: mirror creation into Organization Engine
    try {
      let parentUnitId = `org-unit-company-${compId}`;
      if (regionId) {
        const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
        const regUnit = units.find(u => u.id === `org-unit-region-${regionId}` || (u.metadata && u.metadata.legacyRegionId === regionId));
        if (regUnit) parentUnitId = regUnit.id;
      }

      const createdUnit = await OrganizationEngine.addUnit({
        companyId: compId,
        parentId: parentUnitId,
        typeId: 'out-station',
        code: code || `STN-${stnId}`,
        name: name,
        nameAr: name,
        nameEn: name,
        metadata: { legacyStationId: stnId, custodyAmount },
        isActive: true
      });
      if (createdUnit?.id) {
        createdUnitId = createdUnit.id;
      }
    } catch (err) {
      console.warn('Station compatibility sync to OrganizationUnit failed:', err);
    }

    if (createdUnitId) {
      newStn.org_unit_id = createdUnitId;
    }

    const updated = [...stations, newStn];
    const res = await StationsModule.saveStations(updated);
    if (!res.success) {
      return null;
    }

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Station', `Created station: ${name} with custody ${custodyAmount} EGP`);
    LogsModule.logAudit('CREATE_STATION', `Created station ${name} (${code}) with custody ${custodyAmount} EGP.`, {
      after: newStn
    });
    return newStn;
  }

  static async updateStation(id: string, updates: Partial<Station>): Promise<{ success: boolean; error?: string }> {
    const stations = StationsModule.getStations();
    const idx = stations.findIndex(s => s.id === id);
    if (idx !== -1) {
      const before = { ...stations[idx] };
      const after = { ...stations[idx], ...updates };
      const updated = [...stations];
      updated[idx] = after;
      const res = await StationsModule.saveStations(updated);
      if (!res.success) {
        return res;
      }

      // Compatibility sync: update corresponding OrganizationUnit
      try {
        const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
        const matchedUnit = units.find(u => u.id === `org-unit-station-${id}` || (u.metadata && u.metadata.legacyStationId === id));
        if (matchedUnit) {
          OrganizationEngine.updateUnit(matchedUnit.id, {
            name: updates.station_name || matchedUnit.name,
            nameAr: updates.station_name || matchedUnit.nameAr,
            nameEn: updates.station_name || matchedUnit.nameEn,
            code: updates.station_code !== undefined ? updates.station_code : matchedUnit.code,
            metadata: {
              ...matchedUnit.metadata,
              custodyAmount: updates.custody_amount !== undefined ? updates.custody_amount : matchedUnit.metadata?.custodyAmount
            }
          });
        }
      } catch (err) {
        console.warn('Station compatibility sync update failed:', err);
      }

      // If custody_amount changed, propagate difference to company's custody_value
      if (updates.custody_amount !== undefined && updates.custody_amount !== before.custody_amount) {
        const diff = updates.custody_amount - before.custody_amount;
        const compId = before.company_id || CompaniesModule.getSelectedCompanyId();
        const companies = CompaniesModule.getCompanies();
        const compIdx = companies.findIndex(c => c.id === compId);
        if (compIdx !== -1) {
          const updatedCompany = {
            ...companies[compIdx],
            custody_value: (companies[compIdx].custody_value || 0) + diff
          };
          const compList = [...companies];
          compList[compIdx] = updatedCompany;
          await CompaniesModule.saveCompanies(compList);
        }
      }

      const user = UsersModule.getActiveUser();
      LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Station', `Modified station: ${updated[idx].station_name}`);
      LogsModule.logAudit('UPDATE_STATION', `Updated station ${before.station_name} (${before.station_code}).`, {
        before,
        after
      });
      return { success: true };
    }
    return { success: false, error: 'Station not found' };
  }

  static async deleteStation(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await syncWriteWithOfflineFallback('stations', id, null);
    if (!res.success) {
      console.warn(`[deleteStation] Warning: ${res.error}`);
      return { success: false, error: res.error };
    }
    const before = StationsModule.getStations().find(s => s.id === id);
    const stations = StationsModule.getStations().filter(s => s.id !== id);
    StorageEngine.setStored('stations', stations);

    // Compatibility sync: delete corresponding OrganizationUnit
    try {
      const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
      const matchedUnit = units.find(u => u.id === `org-unit-station-${id}` || (u.metadata && u.metadata.legacyStationId === id));
      if (matchedUnit) {
        OrganizationEngine.deleteUnit(matchedUnit.id);
      }
    } catch (err) {
      console.warn('Station compatibility sync delete failed:', err);
    }

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Delete Station', `Deleted station ID: ${id}`);
    if (before) {
      LogsModule.logAudit('DELETE_STATION', `Deleted station ${before.station_name} (${before.station_code}).`, {
        before
      });
    }
    return { success: true };
  }
}
