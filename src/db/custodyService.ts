import { Station, Company } from '../types';
import { StorageEngine } from './storage';
import { StationsModule } from './stations';
import { CompaniesModule } from './companies';
import { dbSetDoc } from '../firebase';

export class CustodyService {
  static updateStationCustody(stationId: string, amountChange: number): Station | null {
    if (!stationId) return null;
    const stations = StationsModule.getStations();
    const idx = stations.findIndex(s => s.id === stationId);
    if (idx !== -1) {
      const currentAmount = stations[idx].custody_amount || 0;
      const updated = {
        ...stations[idx],
        custody_amount: currentAmount + amountChange
      };
      stations[idx] = updated;
      StationsModule.saveStations(stations);
      dbSetDoc('stations', stationId, updated);
      return updated;
    }
    return null;
  }

  static updateCompanyCustody(companyId: string, amountChange: number): Company | null {
    if (!companyId) return null;
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      const currentVal = companies[idx].custody_value || 0;
      const updated = {
        ...companies[idx],
        custody_value: currentVal + amountChange
      };
      companies[idx] = updated;
      CompaniesModule.saveCompanies(companies);
      dbSetDoc('companies', companyId, updated);
      return updated;
    }
    return null;
  }

  static applySettlement(stationId: string, companyId: string, amount: number): void {
    CustodyService.updateStationCustody(stationId, -amount);
    CustodyService.updateCompanyCustody(companyId, -amount);
  }

  static rollbackSettlement(stationId: string, companyId: string, amount: number): void {
    CustodyService.updateStationCustody(stationId, amount);
    CustodyService.updateCompanyCustody(companyId, amount);
  }

  static restoreSettlement(stationId: string, companyId: string, amount: number): void {
    // Restoration of a deleted settled expense means we re-deduct it from the active custody
    CustodyService.updateStationCustody(stationId, -amount);
    CustodyService.updateCompanyCustody(companyId, -amount);
  }
}
