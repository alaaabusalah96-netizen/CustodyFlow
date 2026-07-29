import { StorageEngine } from '../../db/storage';
import { dbSetDoc } from '../../firebase';
import { DocumentNumberEngine } from '../../db/documentNumberEngine';
import { CostCenterEngine } from '../../db/costCenterEngine';
import { OrganizationEngine } from '../../db/organizationEngine';
import { AccountingBusinessEngine } from './accounting_engine';
import { Vehicle, MaintenanceLog, FuelLog, VehicleType, VehicleStatus } from '../../types/fleet';

export class FleetBusinessEngine {
  /**
   * Retrieves vehicles filtered by company and optional organization unit subtree
   */
  public static getVehiclesByOrgUnit(companyId: string, orgUnitId?: string): Vehicle[] {
    const all = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const companyVehicles = all.filter(v => v.company_id === companyId);

    if (!orgUnitId || orgUnitId === 'ALL') {
      return companyVehicles;
    }

    const validSubtreeIds = new Set(OrganizationEngine.getSubtreeUnitIds(orgUnitId, companyId));
    return companyVehicles.filter(v => v.org_unit_id && validSubtreeIds.has(v.org_unit_id));
  }

  /**
   * Registers a new vehicle in the fleet with automatic sequence numbering and cost center resolution
   */
  public static async createVehicle(
    companyId: string,
    data: {
      plateNumber: string;
      make: string;
      model: string;
      year: number;
      type: VehicleType;
      driverName?: string;
      odometerReading: number;
      fuelCapacity: number;
      org_unit_id?: string;
      cost_center_id?: string;
    }
  ): Promise<Vehicle> {
    const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const targetOrgUnit = data.org_unit_id || undefined;

    let targetCostCenter = data.cost_center_id;
    if (!targetCostCenter && targetOrgUnit) {
      const cc = await CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    // Code generation
    let code = '';
    try {
      const genResult = await DocumentNumberEngine.generateNextNumberAsync({
        companyId,
        documentType: 'FLEET',
        orgUnitId: targetOrgUnit
      });
      code = genResult.documentNumber;
    } catch {
      const nextNo = 101 + allVehicles.filter(v => v.company_id === companyId).length;
      code = `FLT-${nextNo}`;
    }

    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      org_unit_id: targetOrgUnit,
      cost_center_id: targetCostCenter,
      code,
      plateNumber: data.plateNumber,
      make: data.make,
      model: data.model,
      year: Number(data.year),
      type: data.type,
      status: 'ACTIVE',
      driverName: data.driverName || '',
      odometerReading: Number(data.odometerReading) || 0,
      fuelCapacity: Number(data.fuelCapacity) || 50,
      createdAt: new Date().toISOString()
    };

    const updated = [...allVehicles, newVehicle];
    StorageEngine.setStored('fleet_vehicles_items', updated);
    await dbSetDoc('fleet_vehicles_items', newVehicle.id, newVehicle);

    return newVehicle;
  }

  /**
   * Logs a vehicle maintenance service, updates odometer, and posts GL expense
   */
  public static async logMaintenance(
    companyId: string,
    operatorId: string,
    data: {
      vehicle_id: string;
      maintenanceDate: string;
      type: 'ROUTINE' | 'REPAIR' | 'OIL_CHANGE' | 'TIRES' | 'INSPECTION';
      description: string;
      cost: number;
      providerName?: string;
      odometerAtService: number;
      org_unit_id?: string;
      cost_center_id?: string;
    }
  ): Promise<MaintenanceLog> {
    const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const vehicle = allVehicles.find(v => v.id === data.vehicle_id);

    const targetOrgUnit = data.org_unit_id || vehicle?.org_unit_id || undefined;
    let targetCostCenter = data.cost_center_id || vehicle?.cost_center_id;

    if (!targetCostCenter && targetOrgUnit) {
      const cc = await CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    const log: MaintenanceLog = {
      id: `maint-${Date.now()}`,
      company_id: companyId,
      vehicle_id: data.vehicle_id,
      org_unit_id: targetOrgUnit,
      cost_center_id: targetCostCenter,
      maintenanceDate: data.maintenanceDate,
      type: data.type,
      description: data.description,
      cost: Number(data.cost),
      providerName: data.providerName || '',
      odometerAtService: Number(data.odometerAtService),
      createdAt: new Date().toISOString()
    };

    const logs = StorageEngine.getStored<MaintenanceLog[]>('fleet_maintenance_logs', []);
    StorageEngine.setStored('fleet_maintenance_logs', [...logs, log]);
    await dbSetDoc('fleet_maintenance_logs', log.id, log);

    // Update vehicle odometer if higher
    if (vehicle && Number(data.odometerAtService) > vehicle.odometerReading) {
      const updatedVehicles = allVehicles.map(v => v.id === vehicle.id ? { ...v, odometerReading: Number(data.odometerAtService) } : v);
      StorageEngine.setStored('fleet_vehicles_items', updatedVehicles);
      await dbSetDoc('fleet_vehicles_items', vehicle.id, { ...vehicle, odometerReading: Number(data.odometerAtService) });
    }

    // Post GL Double-Entry for Maintenance Expense (510301)
    if (log.cost > 0) {
      try {
        await AccountingBusinessEngine.postOperationalDoubleEntry(
          companyId,
          operatorId,
          `FLT-MAINT-${Date.now()}`,
          `مصاريف صيانة مركبة أسطول (${vehicle?.plateNumber || data.vehicle_id}): ${data.description}`,
          `Fleet vehicle maintenance cost (${vehicle?.plateNumber || data.vehicle_id}): ${data.description}`,
          [
            { accountCode: '510301', debit: log.cost, credit: 0, notes: `صيانة مركبات الأسطول - ${vehicle?.code}` },
            { accountCode: '110101', debit: 0, credit: log.cost, notes: `سداد مصاريف صيانة من الخزينة` }
          ],
          {
            org_unit_id: targetOrgUnit,
            cost_center_id: targetCostCenter
          }
        );
      } catch (err) {
        console.error('Fleet maintenance GL post error:', err);
      }
    }

    return log;
  }

  /**
   * Logs fuel refill for a vehicle and posts GL fuel expense
   */
  public static async logFuel(
    companyId: string,
    operatorId: string,
    data: {
      vehicle_id: string;
      logDate: string;
      liters: number;
      costPerLiter: number;
      odometerReading: number;
      org_unit_id?: string;
      cost_center_id?: string;
    }
  ): Promise<FuelLog> {
    const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const vehicle = allVehicles.find(v => v.id === data.vehicle_id);

    const targetOrgUnit = data.org_unit_id || vehicle?.org_unit_id || undefined;
    let targetCostCenter = data.cost_center_id || vehicle?.cost_center_id;

    if (!targetCostCenter && targetOrgUnit) {
      const cc = await CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    const totalCost = Number(data.liters) * Number(data.costPerLiter);

    const log: FuelLog = {
      id: `fuel-${Date.now()}`,
      company_id: companyId,
      vehicle_id: data.vehicle_id,
      org_unit_id: targetOrgUnit,
      cost_center_id: targetCostCenter,
      logDate: data.logDate,
      liters: Number(data.liters),
      costPerLiter: Number(data.costPerLiter),
      totalCost,
      odometerReading: Number(data.odometerReading),
      createdAt: new Date().toISOString()
    };

    const logs = StorageEngine.getStored<FuelLog[]>('fleet_fuel_logs', []);
    StorageEngine.setStored('fleet_fuel_logs', [...logs, log]);
    await dbSetDoc('fleet_fuel_logs', log.id, log);

    // Update vehicle odometer
    if (vehicle && Number(data.odometerReading) > vehicle.odometerReading) {
      const updatedVehicles = allVehicles.map(v => v.id === vehicle.id ? { ...v, odometerReading: Number(data.odometerReading) } : v);
      StorageEngine.setStored('fleet_vehicles_items', updatedVehicles);
      await dbSetDoc('fleet_vehicles_items', vehicle.id, { ...vehicle, odometerReading: Number(data.odometerReading) });
    }

    // Post GL Double-Entry for Fuel Expense (510302)
    if (totalCost > 0) {
      try {
        await AccountingBusinessEngine.postOperationalDoubleEntry(
          companyId,
          operatorId,
          `FLT-FUEL-${Date.now()}`,
          `مصاريف وقود مركبة أسطول (${vehicle?.plateNumber || data.vehicle_id}): ${data.liters} لتر`,
          `Fleet vehicle fuel expense (${vehicle?.plateNumber || data.vehicle_id}): ${data.liters} L`,
          [
            { accountCode: '510302', debit: totalCost, credit: 0, notes: `وقود ومحروقات أسطول - ${vehicle?.code}` },
            { accountCode: '110101', debit: 0, credit: totalCost, notes: `سداد وقود من الخزينة` }
          ],
          {
            org_unit_id: targetOrgUnit,
            cost_center_id: targetCostCenter
          }
        );
      } catch (err) {
        console.error('Fleet fuel GL post error:', err);
      }
    }

    return log;
  }
}
