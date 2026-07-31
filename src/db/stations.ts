import { Region, Station } from '../types';
import { dbSetDoc, dbDeleteDoc } from '../firebase';
import { StorageEngine } from './storage';
import { DEFAULT_REGIONS, DEFAULT_STATIONS } from './defaults';
import { UsersModule } from './users';
import { LogsModule } from './logs';
import { CompaniesModule } from './companies';
import { OrganizationScopeEngine } from './organizationScopeEngine';
import { OrganizationEngine } from './organizationEngine';
import { OrganizationUnit } from '../types/organization';

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

  static saveRegions(regions: Region[]): void {
    StorageEngine.setStored('regions', regions);
    regions.forEach(r => dbSetDoc('regions', r.id, r));
  }

  static addRegion(name: string, code?: string, companyId?: string): Region {
    const regions = StationsModule.getRegions();
    const compId = companyId || CompaniesModule.getSelectedCompanyId();
    if (!compId || compId.trim() === '') {
      throw new Error('يجب اختيار شركة قبل الحفظ. / Please select a company before saving.');
    }
    const regId = `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const org_unit_id = `org-unit-region-${regId}`;

    const newReg: Region = {
      id: regId,
      name,
      code: code || '',
      company_id: compId,
      org_unit_id
    };
    regions.push(newReg);
    StationsModule.saveRegions(regions);

    // Compatibility sync: mirror creation into Organization Engine
    try {
      const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
      const parentUnit = units.find(u => u.id === `org-unit-company-${compId}` || (u.companyId === compId && u.typeId === 'out-company'));

      OrganizationEngine.addUnit({
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
    } catch (err) {
      console.warn('Region compatibility sync to OrganizationUnit failed:', err);
    }

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Region', `Created region: ${name}`);
    return newReg;
  }

  static updateRegion(id: string, updates: Partial<Region>): void {
    const regions = StationsModule.getRegions();
    const idx = regions.findIndex(r => r.id === id);
    if (idx !== -1) {
      regions[idx] = { ...regions[idx], ...updates };
      StationsModule.saveRegions(regions);

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
      LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Region', `Modified region: ${regions[idx].name}`);
    }
  }

  static deleteRegion(id: string): void {
    const regions = StationsModule.getRegions().filter(r => r.id !== id);
    StationsModule.saveRegions(regions);
    dbDeleteDoc('regions', id);

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

  static saveStations(stations: Station[]): void {
    StorageEngine.setStored('stations', stations);
    stations.forEach(s => dbSetDoc('stations', s.id, s));
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Stations', 'Modified available cash custody stations configuration.');
  }

  static addStation(name: string, code: string, custodyAmount: number, regionId?: string, companyId?: string): Station {
    const stations = StationsModule.getStations();
    const compId = companyId || CompaniesModule.getSelectedCompanyId();
    if (!compId || compId.trim() === '') {
      throw new Error('يجب اختيار شركة قبل الحفظ. / Please select a company before saving.');
    }
    const stnId = `stn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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
    stations.push(newStn);
    StationsModule.saveStations(stations);

    // Compatibility sync: mirror creation into Organization Engine
    try {
      let parentUnitId = `org-unit-company-${compId}`;
      if (regionId) {
        const units = StorageEngine.getStored<OrganizationUnit[]>('organization_units', []);
        const regUnit = units.find(u => u.id === `org-unit-region-${regionId}` || (u.metadata && u.metadata.legacyRegionId === regionId));
        if (regUnit) parentUnitId = regUnit.id;
      }

      OrganizationEngine.addUnit({
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
    } catch (err) {
      console.warn('Station compatibility sync to OrganizationUnit failed:', err);
    }

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Add Station', `Created station: ${name} with custody ${custodyAmount} EGP`);
    LogsModule.logAudit('CREATE_STATION', `Created station ${name} (${code}) with custody ${custodyAmount} EGP.`, {
      after: newStn
    });
    return newStn;
  }

  static updateStation(id: string, updates: Partial<Station>): void {
    const stations = StationsModule.getStations();
    const idx = stations.findIndex(s => s.id === id);
    if (idx !== -1) {
      const before = { ...stations[idx] };
      const after = { ...stations[idx], ...updates };
      stations[idx] = after;
      StationsModule.saveStations(stations);

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
          companies[compIdx] = updatedCompany;
          CompaniesModule.saveCompanies(companies);
          dbSetDoc('companies', compId, updatedCompany);
        }
      }

      const user = UsersModule.getActiveUser();
      LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Station', `Modified station: ${stations[idx].station_name}`);
      LogsModule.logAudit('UPDATE_STATION', `Updated station ${before.station_name} (${before.station_code}).`, {
        before,
        after
      });
    }
  }

  static deleteStation(id: string): void {
    const before = StationsModule.getStations().find(s => s.id === id);
    const stations = StationsModule.getStations().filter(s => s.id !== id);
    StationsModule.saveStations(stations);
    dbDeleteDoc('stations', id);

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
  }
}
