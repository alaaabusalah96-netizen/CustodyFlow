import { StorageEngine } from '../../db/storage';
import { dbSetDoc } from '../../firebase';
import { DocumentNumberEngine } from '../../db/documentNumberEngine';
import { CostCenterEngine } from '../../db/costCenterEngine';
import { OrganizationEngine } from '../../db/organizationEngine';
import { AccountingBusinessEngine } from './accounting_engine';
import { 
  Vehicle, 
  MaintenanceLog, 
  FuelLog, 
  VehicleType, 
  VehicleStatus, 
  Trip, 
  TripStatus, 
  TripStop, 
  TripLocation,
  TripStopStatus,
  VehicleLocation
} from '../../types/fleet';

export class FleetBusinessEngine {
  /**
   * Retrieves trips filtered by company
   */
  public static getTripsByCompany(companyId: string): Trip[] {
    const all = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    return all.filter(t => t.company_id === companyId);
  }

  /**
   * Creates a new trip in DRAFT status with task-oriented multi-point stops
   */
  public static async createTrip(
    companyId: string,
    creatorId: string,
    data: {
      vehicle_id: string;
      driver_id: string;
      stops: Array<{
        id?: string;
        sequence?: number;
        taskTitle?: string;
        notes?: string;
        location: TripLocation;
        status?: TripStopStatus;
        startLocation?: TripLocation;
        arrivedLocation?: TripLocation;
        startedAt?: string;
        arrivedAt?: string;
        completedAt?: string;
      }>;
      tripType: string;
      scheduledAt: string;
      notes?: string;
      org_unit_id?: string;
    }
  ): Promise<Trip> {
    if (!data.stops || data.stops.length < 2) {
      throw new Error('Trip must contain at least 2 stops');
    }

    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);

    const stops: TripStop[] = data.stops.map((stop, idx) => ({
      id: stop.id || `stop-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
      sequence: idx + 1,
      taskTitle: stop.taskTitle || undefined,
      notes: stop.notes || '',
      location: {
        org_unit_id: stop.location.org_unit_id || undefined,
        label: stop.location.label || '',
        lat: typeof stop.location.lat === 'number' ? stop.location.lat : undefined,
        lng: typeof stop.location.lng === 'number' ? stop.location.lng : undefined,
        accuracy: typeof stop.location.accuracy === 'number' ? stop.location.accuracy : undefined,
        timestamp: stop.location.timestamp
      },
      status: stop.status || 'PENDING',
      startLocation: stop.startLocation,
      arrivedLocation: stop.arrivedLocation,
      startedAt: stop.startedAt,
      arrivedAt: stop.arrivedAt,
      completedAt: stop.completedAt
    }));

    const newTrip: Trip = {
      id: `trip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      org_unit_id: data.org_unit_id || stops[0]?.location.org_unit_id || undefined,
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      stops,
      tripType: data.tripType,
      status: 'DRAFT',
      scheduledAt: data.scheduledAt,
      notes: data.notes || '',
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
    };

    const updated = [...allTrips, newTrip];
    StorageEngine.setStored('fleet_trips_items', updated);
    await dbSetDoc('fleet_trips_items', newTrip.id, newTrip);

    return newTrip;
  }

  /**
   * Driver begins trip: captures start GPS location, marks status DISPATCHED,
   * records start timestamp and updates vehicle's last known location.
   */
  public static async startTrip(
    companyId: string,
    operatorId: string,
    tripId: string,
    coords: {
      lat: number;
      lng: number;
      accuracy?: number;
      label?: string;
    }
  ): Promise<Trip> {
    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const tripIndex = allTrips.findIndex(t => t.id === tripId && t.company_id === companyId);
    if (tripIndex === -1) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const trip = allTrips[tripIndex];
    const now = new Date().toISOString();

    const startLoc: TripLocation = {
      label: coords.label || 'نقطة انطلاق الرحلة (GPS)',
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      timestamp: now
    };

    // Update first stop start details if pending
    const updatedStops = trip.stops.map((stop, idx) => {
      if (idx === 0) {
        return {
          ...stop,
          startLocation: startLoc,
          startedAt: stop.startedAt || now,
          status: (stop.status === 'PENDING' ? 'IN_PROGRESS' : stop.status) as TripStopStatus
        };
      }
      return stop;
    });

    const updatedTrip: Trip = {
      ...trip,
      status: 'DISPATCHED',
      startedAt: now,
      dispatchedAt: trip.dispatchedAt || now,
      startLocation: startLoc,
      stops: updatedStops
    };

    allTrips[tripIndex] = updatedTrip;
    StorageEngine.setStored('fleet_trips_items', allTrips);
    await dbSetDoc('fleet_trips_items', updatedTrip.id, updatedTrip);

    // Update vehicle's last known location and status to DISPATCHED
    await this.updateVehicleLocationAndStatus(
      companyId,
      trip.vehicle_id,
      {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        updatedAt: now,
        label: coords.label || 'نقطة انطلاق الرحلة'
      },
      'DISPATCHED'
    );

    return updatedTrip;
  }

  /**
   * Driver arrives at task stop: captures destination GPS location,
   * updates stop status to ARRIVED, records arrived timestamp and updates vehicle location.
   */
  public static async recordStopArrival(
    companyId: string,
    operatorId: string,
    tripId: string,
    stopId: string,
    coords: {
      lat: number;
      lng: number;
      accuracy?: number;
      label?: string;
    }
  ): Promise<{ trip: Trip; stop: TripStop }> {
    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const tripIndex = allTrips.findIndex(t => t.id === tripId && t.company_id === companyId);
    if (tripIndex === -1) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const trip = allTrips[tripIndex];
    const now = new Date().toISOString();

    let targetStop: TripStop | null = null;

    const updatedStops = trip.stops.map(stop => {
      if (stop.id === stopId) {
        const arrivalLoc: TripLocation = {
          org_unit_id: stop.location.org_unit_id,
          label: coords.label || stop.location.label || stop.taskTitle || 'موقع المهمة (GPS)',
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          timestamp: now
        };

        const updatedStop: TripStop = {
          ...stop,
          status: 'ARRIVED',
          arrivedAt: now,
          arrivedLocation: arrivalLoc,
          location: {
            ...stop.location,
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy,
            label: stop.location.label || arrivalLoc.label
          }
        };
        targetStop = updatedStop;
        return updatedStop;
      }
      return stop;
    });

    if (!targetStop) {
      throw new Error(`Stop ${stopId} not found in trip ${tripId}`);
    }

    const updatedTrip: Trip = {
      ...trip,
      stops: updatedStops
    };

    allTrips[tripIndex] = updatedTrip;
    StorageEngine.setStored('fleet_trips_items', allTrips);
    await dbSetDoc('fleet_trips_items', updatedTrip.id, updatedTrip);

    // Update vehicle's last known location
    const stopObj = targetStop as TripStop;
    await this.updateVehicleLocationAndStatus(
      companyId,
      trip.vehicle_id,
      {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        updatedAt: now,
        label: stopObj.taskTitle || stopObj.location.label || 'موقع تنفيذ المهمة'
      }
    );

    return { trip: updatedTrip, stop: targetStop };
  }

  /**
   * Driver ends trip: sets status COMPLETED, records completion timestamp,
   * and resets vehicle status to ACTIVE.
   */
  public static async completeTrip(
    companyId: string,
    operatorId: string,
    tripId: string,
    coords?: {
      lat: number;
      lng: number;
      accuracy?: number;
      label?: string;
    }
  ): Promise<Trip> {
    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const tripIndex = allTrips.findIndex(t => t.id === tripId && t.company_id === companyId);
    if (tripIndex === -1) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const trip = allTrips[tripIndex];
    const now = new Date().toISOString();

    const updatedTrip: Trip = {
      ...trip,
      status: 'COMPLETED',
      completedAt: now
    };

    allTrips[tripIndex] = updatedTrip;
    StorageEngine.setStored('fleet_trips_items', allTrips);
    await dbSetDoc('fleet_trips_items', updatedTrip.id, updatedTrip);

    // Reset vehicle status to ACTIVE
    const locUpdate: VehicleLocation | undefined = coords ? {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      updatedAt: now,
      label: coords.label || 'نهاية الرحلة'
    } : undefined;

    await this.updateVehicleLocationAndStatus(
      companyId,
      trip.vehicle_id,
      locUpdate,
      'ACTIVE'
    );

    return updatedTrip;
  }

  /**
   * Helper to update vehicle's last known location and optional status
   */
  public static async updateVehicleLocationAndStatus(
    companyId: string,
    vehicleId: string,
    location?: VehicleLocation,
    status?: VehicleStatus
  ): Promise<Vehicle | null> {
    const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const vIndex = allVehicles.findIndex(v => v.id === vehicleId && v.company_id === companyId);
    if (vIndex === -1) return null;

    const current = allVehicles[vIndex];
    const updated: Vehicle = {
      ...current,
      status: status || current.status,
      last_known_location: location || current.last_known_location
    };

    allVehicles[vIndex] = updated;
    StorageEngine.setStored('fleet_vehicles_items', allVehicles);
    await dbSetDoc('fleet_vehicles_items', updated.id, updated);

    return updated;
  }

  /**
   * Haversine formula to compute great-circle distance between two GPS coordinates in Kilometers
   */
  public static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.round(d * 100) / 100;
  }

  /**
   * Reassigns an active/draft trip from one vehicle to a replacement vehicle
   */
  public static async reassignTripVehicle(
    companyId: string,
    operatorId: string,
    tripId: string,
    newVehicleId: string,
    newDriverId?: string,
    reason?: string
  ): Promise<Trip> {
    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const tripIndex = allTrips.findIndex(t => t.id === tripId && t.company_id === companyId);
    if (tripIndex === -1) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const trip = allTrips[tripIndex];
    const oldVehicleId = trip.vehicle_id;

    // Find new vehicle to deduce driver if not provided
    const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const newVeh = allVehicles.find(v => v.id === newVehicleId && v.company_id === companyId);
    if (!newVeh) {
      throw new Error(`Target vehicle ${newVehicleId} not found`);
    }

    const updatedTrip: Trip = {
      ...trip,
      vehicle_id: newVehicleId,
      driver_id: newDriverId || trip.driver_id,
      reassignedFromVehicleId: oldVehicleId,
      reassignedAt: new Date().toISOString(),
      reassignReason: reason || 'إعادة توزيع بسبب تعطل المركبة الأصلية'
    };

    allTrips[tripIndex] = updatedTrip;
    StorageEngine.setStored('fleet_trips_items', allTrips);
    await dbSetDoc('fleet_trips_items', updatedTrip.id, updatedTrip);

    return updatedTrip;
  }

  /**
   * Retrieves open/active trips assigned to a specific vehicle
   */
  public static getOpenTripsForVehicle(companyId: string, vehicleId: string): Trip[] {
    const trips = this.getTripsByCompany(companyId);
    return trips.filter(t => 
      t.vehicle_id === vehicleId && 
      ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'IN_PROGRESS'].includes(t.status)
    );
  }

  /**
   * Suggests the nearest available vehicles to a target location (e.g. broken vehicle or task coordinates)
   * to minimize travel time and diesel consumption.
   */
  public static suggestNearestVehiclesForTasks(
    companyId: string,
    targetCoords: { lat: number; lng: number },
    excludeVehicleId?: string
  ): Array<{ vehicle: Vehicle; distanceKm: number; lastLocationLabel?: string }> {
    const allVehicles = this.getVehiclesByOrgUnit(companyId);
    
    // Candidates: ACTIVE or DISPATCHED vehicles (not OUT_OF_SERVICE or BREAKDOWN)
    const available = allVehicles.filter(v => 
      v.id !== excludeVehicleId && 
      !['BREAKDOWN', 'OUT_OF_SERVICE', 'MAINTENANCE', 'INACTIVE'].includes(v.status)
    );

    const candidatesWithDistance = available.map(v => {
      if (v.last_known_location && typeof v.last_known_location.lat === 'number' && typeof v.last_known_location.lng === 'number') {
        const dist = this.calculateDistanceKm(
          v.last_known_location.lat,
          v.last_known_location.lng,
          targetCoords.lat,
          targetCoords.lng
        );
        return {
          vehicle: v,
          distanceKm: dist,
          lastLocationLabel: v.last_known_location.label || `${v.last_known_location.lat.toFixed(3)}, ${v.last_known_location.lng.toFixed(3)}`
        };
      }
      // If no GPS coords known yet, assign large distance
      return {
        vehicle: v,
        distanceKm: 99999,
        lastLocationLabel: 'الموقع غير مسجل بعد'
      };
    });

    // Sort by shortest distance first
    candidatesWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return candidatesWithDistance;
  }

  /**
   * Updates a vehicle's status (e.g. BREAKDOWN, MAINTENANCE, ACTIVE)
   * and returns open trips affected if out of service.
   */
  public static async updateVehicleStatus(
    companyId: string,
    operatorId: string,
    vehicleId: string,
    status: VehicleStatus,
    notes?: string
  ): Promise<{ vehicle: Vehicle; affectedTrips: Trip[] }> {
    const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const vIndex = allVehicles.findIndex(v => v.id === vehicleId && v.company_id === companyId);
    if (vIndex === -1) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const current = allVehicles[vIndex];
    const updated: Vehicle = {
      ...current,
      status
    };

    allVehicles[vIndex] = updated;
    StorageEngine.setStored('fleet_vehicles_items', allVehicles);
    await dbSetDoc('fleet_vehicles_items', updated.id, updated);

    const isOutOfService = ['BREAKDOWN', 'OUT_OF_SERVICE', 'MAINTENANCE', 'INACTIVE'].includes(status);
    const affectedTrips = isOutOfService ? this.getOpenTripsForVehicle(companyId, vehicleId) : [];

    return { vehicle: updated, affectedTrips };
  }

  /**
   * Retrieves vehicles filtered by company and optional organization unit subtree
   */
  public static getVehiclesByOrgUnit(companyId: string, org_unit_id?: string): Vehicle[] {
    const all = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const companyVehicles = all.filter(v => v.company_id === companyId);

    if (!org_unit_id || org_unit_id === 'ALL') {
      return companyVehicles;
    }

    const validSubtreeIds = new Set(OrganizationEngine.getSubtreeUnitIds(org_unit_id, companyId));
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
        org_unit_id: targetOrgUnit
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
