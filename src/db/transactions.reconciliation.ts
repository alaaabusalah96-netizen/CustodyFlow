import { CompaniesModule } from './companies';
import { StationsModule } from './stations';
import { StorageEngine } from './storage';
import { UsersModule } from './users';
import { DEFAULT_TRANSACTIONS } from './defaults';

export class TransactionsReconciliationModule {
  static getReconciliation(stationId?: string, regionId?: string) {
    const targetCompanyId = CompaniesModule.getSelectedCompanyId();
    const stations = StationsModule.getStations().filter(s => s.company_id === targetCompanyId);
    const transactions = StorageEngine.getStored<any[]>('transactions', DEFAULT_TRANSACTIONS).filter(t => t.company_id === targetCompanyId);
    const user = UsersModule.getActiveUser();

    let targetStationIds: string[] = [];
    let custodyValue = 0;

    if (stationId) {
      targetStationIds = [stationId];
      const st = stations.find(s => s.id === stationId);
      custodyValue = st ? st.custody_amount : 0;
    } else if (regionId) {
      const regionStations = stations.filter(s => {
        if (regionId === 'none' || regionId === 'unassigned') {
          return !s.region_id || s.region_id === '' || s.region_id === 'none' || s.region_id === 'unassigned';
        }
        return s.region_id === regionId;
      });
      targetStationIds = regionStations.map(s => s.id);
      custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
    } else if (user) {
      if (user.role === 'Admin' || user.role === 'SystemAdmin') {
        targetStationIds = stations.map(s => s.id);
        custodyValue = stations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else if (user.role === 'RegionalManager') {
        const regionStations = stations.filter(s => {
          if (!user.region_id || user.region_id === 'none' || user.region_id === '') {
            return !s.region_id || s.region_id === '' || s.region_id === 'none';
          }
          return s.region_id === user.region_id;
        });
        targetStationIds = regionStations.map(s => s.id);
        custodyValue = regionStations.reduce((sum, s) => sum + s.custody_amount, 0);
      } else {
        const userStationId = user.station_id || 'stn-1-1-1';
        targetStationIds = [userStationId];
        const st = stations.find(s => s.id === userStationId);
        custodyValue = st ? st.custody_amount : 0;
      }
    } else {
      targetStationIds = [stations[0]?.id || 'stn-1-1-1'];
      const st = stations.find(s => s.id === (stations[0]?.id || 'stn-1-1-1'));
      custodyValue = st ? st.custody_amount : 0;
    }

    const filteredTxs = transactions.filter(t => t.station_id && targetStationIds.includes(t.station_id));

    const pendingTotal = filteredTxs
      .filter(t => t.status === 'Pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const underSettlementTotal = filteredTxs
      .filter(t => t.status === 'Under Settlement')
      .reduce((sum, t) => sum + t.amount, 0);

    const settledTotal = filteredTxs
      .filter(t => t.status === 'Settled')
      .reduce((sum, t) => sum + t.amount, 0);

    // Unified Cash Available calculation matching CashReconciliation.tsx:
    // Remaining liquid cash = custodyValue - underSettlementTotal - pendingTotal
    const cashAvailable = custodyValue - underSettlementTotal - pendingTotal;

    const pendingCount = filteredTxs.filter(t => t.status === 'Pending').length;
    const underSettlementCount = filteredTxs.filter(t => t.status === 'Under Settlement').length;
    const settledCount = filteredTxs.filter(t => t.status === 'Settled').length;

    const originalCustodyValue = custodyValue + settledTotal;
    const adjustedCustodyValue = custodyValue;

    return {
      custodyValue: adjustedCustodyValue,
      originalCustodyValue,
      cashAvailable,
      pendingTotal,
      underSettlementTotal,
      settledTotal,
      pendingCount,
      underSettlementCount,
      settledCount
    };
  }

  static getStationDeductedCustody(stationId: string): number {
    const stations = StationsModule.getStations();
    const st = stations.find(s => s.id === stationId);
    if (!st) return 0;
    return st.custody_amount;
  }

  static getCompanyDeductedCustody(companyId: string): number {
    const companies = CompaniesModule.getCompanies();
    const comp = companies.find(c => c.id === companyId);
    if (!comp) return 0;
    return comp.custody_value || 0;
  }
}
