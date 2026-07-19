import { Station, Company } from '../types';
import { StorageEngine } from './storage';
import { StationsModule } from './stations';
import { CompaniesModule } from './companies';
import { db } from '../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export class CustodyService {
  static async updateStationCustodyAtomic(stationId: string, amountChange: number): Promise<void> {
    if (!stationId) return;
    
    // 1. تحديث الرصيد على مستوى خادم Firestore ذرياً ودون تصادم
    const stationRef = doc(db, 'stations', stationId);
    await updateDoc(stationRef, {
      custody_amount: increment(amountChange)
    });
    
    // 2. تحديث التخزين المحلي فقط لتأكيد الرؤية البصرية للمستخدم الحالي
    const stations = StationsModule.getStations();
    const idx = stations.findIndex(s => s.id === stationId);
    if (idx !== -1) {
      stations[idx].custody_amount = (stations[idx].custody_amount || 0) + amountChange;
      StationsModule.saveStations(stations);
    }
  }

  static async updateCompanyCustodyAtomic(companyId: string, amountChange: number): Promise<void> {
    if (!companyId) return;
    
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      custody_value: increment(amountChange)
    });
    
    const companies = CompaniesModule.getCompanies();
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx !== -1) {
      companies[idx].custody_value = (companies[idx].custody_value || 0) + amountChange;
      CompaniesModule.saveCompanies(companies);
    }
  }

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
      
      // FIX: Atomic increment on Firestore
      CustodyService.updateStationCustodyAtomic(stationId, amountChange).catch(err => {
        console.error('Failed to update station custody atomically:', err);
      });
      
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
      
      // FIX: Atomic increment on Firestore
      CustodyService.updateCompanyCustodyAtomic(companyId, amountChange).catch(err => {
        console.error('Failed to update company custody atomically:', err);
      });
      
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
