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
  VehicleLocation,
  LearnedTaskLocation,
  LearnedLocationHistoryEntry,
  BreakdownDecisionType,
  BreakdownDecisionLog,
  TripChatMessage,
  VehicleConstraintMode,
  VehicleConstraintRule,
  TripBreadcrumbPoint,
  TripBreadcrumbTrack
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

    // Validate stops against active vehicle access constraints
    const activeConstraints = this.getActiveVehicleConstraints(companyId, data.vehicle_id);
    if (activeConstraints.length > 0) {
      const orgUnits = OrganizationEngine.getUnits(companyId);
      for (const rule of activeConstraints) {
        if (rule.mode === 'EXTERNAL_ONLY') {
          for (const stop of data.stops) {
            if (stop.location && stop.location.org_unit_id && stop.location.org_unit_id.trim() !== '') {
              const matchedUnit = orgUnits.find(u => u.id === stop.location.org_unit_id);
              const unitName = matchedUnit ? `${matchedUnit.name} (${matchedUnit.code})` : (stop.location.label || stop.location.org_unit_id);
              throw new Error(`لا يمكن تعيين المركبة لهذا المشوار: المركبة محددة للمهام والمواقع الخارجية فقط وممنوعة من زيارة الفروع والوحدات المسجلة (${unitName})`);
            }
          }
        } else if (rule.mode === 'BLOCK_SPECIFIC_LOCATIONS') {
          const blockedIds = rule.blocked_org_unit_ids || [];
          for (const stop of data.stops) {
            if (stop.location && stop.location.org_unit_id && blockedIds.includes(stop.location.org_unit_id)) {
              const matchedUnit = orgUnits.find(u => u.id === stop.location.org_unit_id);
              const unitName = matchedUnit ? `${matchedUnit.name} (${matchedUnit.code})` : (stop.location.label || stop.location.org_unit_id);
              throw new Error(`لا يمكن إنشاء المشوار: المركبة ممنوعة من التوجه إلى الموقع المحدد (${unitName}) بموجب قيود الوصول الجغرافي النشطة`);
            }
          }
        }
      }
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

    // Auto-learn task location with key: company_id + org_unit_id + task_type
    const taskTypeToLearn = stopObj.taskTitle || stopObj.location.label;
    const orgUnitToLearn = stopObj.location.org_unit_id || trip.org_unit_id;
    if (orgUnitToLearn && taskTypeToLearn && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      try {
        await this.recordLearnedLocation(
          companyId,
          orgUnitToLearn,
          taskTypeToLearn,
          {
            label: coords.label || stopObj.location.label || taskTypeToLearn,
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy,
            tripId: trip.id
          }
        );
      } catch (err) {
        console.error('Failed to record learned task location:', err);
      }
    }

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

    // End active breadcrumb tracking track
    try {
      await this.endTripTrack(companyId, tripId, 'COMPLETED');
    } catch (err) {
      console.warn('Failed to end trip tracking log on completeTrip:', err);
    }

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
      code?: string;
      plateNumber: string;
      make?: string;
      model?: string;
      year?: number;
      type: VehicleType;
      status?: VehicleStatus;
      driverName?: string;
      odometerReading?: number;
      fuelCapacity?: number;
      org_unit_id?: string;
      cost_center_id?: string;
    }
  ): Promise<Vehicle> {
    if (!data.plateNumber || !data.plateNumber.trim()) {
      throw new Error('Plate number is required');
    }
    if (!data.type) {
      throw new Error('Vehicle type is required');
    }
    if (!data.driverName || !data.driverName.trim()) {
      throw new Error('Driver name is required');
    }

    const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
    const targetOrgUnit = data.org_unit_id || undefined;

    let targetCostCenter = data.cost_center_id;
    if (!targetCostCenter && targetOrgUnit) {
      const cc = await CostCenterEngine.resolveCostCenterForOrgUnit(targetOrgUnit, companyId);
      if (cc) targetCostCenter = cc.id;
    }

    // Code generation
    let code = data.code?.trim() || '';
    if (!code) {
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
    }

    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      org_unit_id: targetOrgUnit,
      cost_center_id: targetCostCenter,
      code,
      plateNumber: data.plateNumber.trim(),
      make: data.make?.trim() || '',
      model: data.model?.trim() || '',
      year: Number(data.year) || new Date().getFullYear(),
      type: data.type,
      status: data.status || 'ACTIVE',
      driverName: data.driverName?.trim() || '',
      odometerReading: Number(data.odometerReading) || 0,
      fuelCapacity: Number(data.fuelCapacity) || 0,
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

  /**
   * Normalizes a task title or type for consistent multi-tenant indexing
   */
  public static normalizeTaskType(task: string): string {
    if (!task) return '';
    return task
      .trim()
      .toLowerCase()
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Retrieves all learned task locations for a company, optionally filtered by org_unit_id / task_type
   */
  public static getLearnedLocations(
    companyId: string,
    org_unit_id?: string,
    task_type?: string
  ): LearnedTaskLocation[] {
    const all = StorageEngine.getStored<LearnedTaskLocation[]>('fleet_learned_locations_items', []);
    let filtered = all.filter(l => l.company_id === companyId);

    if (org_unit_id && org_unit_id !== 'ALL') {
      filtered = filtered.filter(l => l.org_unit_id === org_unit_id);
    }

    if (task_type) {
      const norm = this.normalizeTaskType(task_type);
      filtered = filtered.filter(l => this.normalizeTaskType(l.task_type) === norm);
    }

    return filtered;
  }

  /**
   * Suggests top 2-3 past known locations for a given task type strictly within the specific org unit / region.
   * Never mixes locations across different regions or companies!
   */
  public static getSuggestedLocationsForTask(
    companyId: string,
    org_unit_id: string,
    task_type: string
  ): LearnedLocationHistoryEntry[] {
    if (!companyId || !org_unit_id || !task_type) {
      return [];
    }

    const norm = this.normalizeTaskType(task_type);
    if (!norm) return [];

    const all = StorageEngine.getStored<LearnedTaskLocation[]>('fleet_learned_locations_items', []);
    const match = all.find(
      l => l.company_id === companyId && 
           l.org_unit_id === org_unit_id && 
           this.normalizeTaskType(l.task_type) === norm
    );

    if (!match) return [];

    const candidates: LearnedLocationHistoryEntry[] = [];
    
    // Add primary current location
    candidates.push({
      label: match.label,
      lat: match.lat,
      lng: match.lng,
      accuracy: match.accuracy,
      visitedAt: match.lastVisitedAt
    });

    // Add unique past historical points (up to 3 total)
    if (match.history && Array.isArray(match.history)) {
      for (const h of match.history) {
        if (candidates.length >= 3) break;
        const exists = candidates.some(c => 
          Math.abs(c.lat - h.lat) < 0.0001 && Math.abs(c.lng - h.lng) < 0.0001
        );
        if (!exists) {
          candidates.push(h);
        }
      }
    }

    return candidates.slice(0, 3);
  }

  /**
   * Records or updates a learned location reference keyed by (company_id + org_unit_id + task_type)
   */
  public static async recordLearnedLocation(
    companyId: string,
    org_unit_id: string,
    task_type: string,
    location: {
      label: string;
      lat: number;
      lng: number;
      accuracy?: number;
      tripId?: string;
    }
  ): Promise<LearnedTaskLocation | null> {
    if (!companyId || !org_unit_id || !task_type || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return null;
    }

    const norm = this.normalizeTaskType(task_type);
    if (!norm) return null;

    const all = StorageEngine.getStored<LearnedTaskLocation[]>('fleet_learned_locations_items', []);
    const now = new Date().toISOString();
    const existingIndex = all.findIndex(
      l => l.company_id === companyId && 
           l.org_unit_id === org_unit_id && 
           this.normalizeTaskType(l.task_type) === norm
    );

    let resultEntry: LearnedTaskLocation;

    if (existingIndex >= 0) {
      const current = all[existingIndex];
      const prevHistory = current.history || [];
      
      const newHistoryEntry: LearnedLocationHistoryEntry = {
        label: location.label || current.label,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        visitedAt: now,
        tripId: location.tripId
      };

      const updatedHistory = [newHistoryEntry, ...prevHistory.filter(h => 
        !(Math.abs(h.lat - location.lat) < 0.0001 && Math.abs(h.lng - location.lng) < 0.0001)
      )].slice(0, 10);

      resultEntry = {
        ...current,
        label: location.label || current.label,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        visitCount: (current.visitCount || 1) + 1,
        lastVisitedAt: now,
        history: updatedHistory
      };

      all[existingIndex] = resultEntry;
    } else {
      resultEntry = {
        id: `lloc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        company_id: companyId,
        org_unit_id: org_unit_id,
        task_type: task_type.trim(),
        label: location.label || task_type.trim(),
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        visitCount: 1,
        lastVisitedAt: now,
        history: [{
          label: location.label || task_type.trim(),
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          visitedAt: now,
          tripId: location.tripId
        }]
      };
      all.push(resultEntry);
    }

    StorageEngine.setStored('fleet_learned_locations_items', all);
    await dbSetDoc('fleet_learned_locations_items', resultEntry.id, resultEntry);

    return resultEntry;
  }

  /**
   * Fast creation of an Internal Emergency Trip directly from the Fleet system.
   * Completely self-contained with no external chat/messaging dependencies.
   */
  public static async createEmergencyTrip(
    companyId: string,
    creatorId: string,
    data: {
      vehicle_id: string;
      driver_id: string;
      task_type: string; // e.g. "نقل عاجل", "تغيير اسطوانات غاز طارئ", "صيانة طارئة"
      org_unit_id: string;
      notes?: string;
      startLocationLabel?: string;
      startLat?: number;
      startLng?: number;
      destinationLabel?: string;
      destLat?: number;
      destLng?: number;
    }
  ): Promise<Trip> {
    const now = new Date().toISOString();

    const startStop: TripStop = {
      id: `stop-${Date.now()}-1`,
      sequence: 1,
      taskTitle: 'نقطة الانطلاق (مشوار طارئ)',
      location: {
        org_unit_id: data.org_unit_id,
        label: data.startLocationLabel || 'نقطة الانطلاق',
        lat: data.startLat,
        lng: data.startLng
      },
      status: 'PENDING'
    };

    const destStop: TripStop = {
      id: `stop-${Date.now()}-2`,
      sequence: 2,
      taskTitle: data.task_type,
      notes: data.notes || '',
      location: {
        org_unit_id: data.org_unit_id,
        label: data.destinationLabel || data.task_type,
        lat: data.destLat,
        lng: data.destLng
      },
      status: 'PENDING'
    };

    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const emergencyTrip: Trip = {
      id: `trip-emg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      org_unit_id: data.org_unit_id,
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      stops: [startStop, destStop],
      tripType: `مشوار طارئ - ${data.task_type}`,
      isEmergency: true,
      status: 'DRAFT',
      scheduledAt: now,
      notes: data.notes || 'مشوار طارئ داخلي',
      createdBy: creatorId,
      createdAt: now
    };

    const updated = [...allTrips, emergencyTrip];
    StorageEngine.setStored('fleet_trips_items', updated);
    await dbSetDoc('fleet_trips_items', emergencyTrip.id, emergencyTrip);

    return emergencyTrip;
  }

  /**
   * Executes a supervisor decision on an open trip affected by vehicle breakdown:
   * 1. REASSIGN: Reassigns to another vehicle & driver with distance optimization.
   * 2. POSTPONE: Delays the trip to a future date/time with a recorded reason.
   * 3. SUSPEND: Leaves the trip pending under breakdown status for later resolution.
   */
  public static async executeBreakdownDecision(
    companyId: string,
    operatorId: string,
    data: {
      tripId: string;
      decision: BreakdownDecisionType;
      fromVehicleId: string;
      toVehicleId?: string;
      toDriverId?: string;
      reason: string;
      postponedUntil?: string;
    }
  ): Promise<Trip> {
    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const tripIndex = allTrips.findIndex(t => t.id === data.tripId && t.company_id === companyId);
    if (tripIndex === -1) {
      throw new Error(`Trip ${data.tripId} not found`);
    }

    const trip = allTrips[tripIndex];
    const now = new Date().toISOString();

    const decisionLog: BreakdownDecisionLog = {
      id: `bd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      decision: data.decision,
      fromVehicleId: data.fromVehicleId,
      toVehicleId: data.toVehicleId,
      toDriverId: data.toDriverId,
      reason: data.reason || 'قرار عطل تشغيلي',
      postponedUntil: data.postponedUntil,
      operatorId,
      timestamp: now
    };

    const existingLogs = trip.breakdownDecisions || [];
    let updatedTrip: Trip;

    if (data.decision === 'REASSIGN') {
      if (!data.toVehicleId) {
        throw new Error('Target vehicle is required for REASSIGN decision');
      }

      // Check if target vehicle has a driver if toDriverId not explicitly passed
      const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
      const targetVeh = allVehicles.find(v => v.id === data.toVehicleId && v.company_id === companyId);

      updatedTrip = {
        ...trip,
        vehicle_id: data.toVehicleId,
        driver_id: data.toDriverId || targetVeh?.driverName || trip.driver_id,
        reassignedFromVehicleId: data.fromVehicleId,
        reassignedAt: now,
        reassignReason: data.reason || 'إعادة توزيع بعد تعطل المركبة الأصلية',
        breakdownDecisions: [...existingLogs, decisionLog]
      };
    } else if (data.decision === 'POSTPONE') {
      updatedTrip = {
        ...trip,
        status: 'POSTPONED',
        postponeReason: data.reason,
        postponedUntil: data.postponedUntil,
        breakdownDecisions: [...existingLogs, decisionLog]
      };
    } else {
      // SUSPEND
      updatedTrip = {
        ...trip,
        status: 'SUSPENDED_BREAKDOWN',
        reassignReason: data.reason,
        breakdownDecisions: [...existingLogs, decisionLog]
      };
    }

    allTrips[tripIndex] = updatedTrip;
    StorageEngine.setStored('fleet_trips_items', allTrips);
    await dbSetDoc('fleet_trips_items', updatedTrip.id, updatedTrip);

    if (data.decision === 'POSTPONE' || data.decision === 'SUSPEND') {
      try {
        await this.endTripTrack(companyId, data.tripId, 'SUSPENDED');
      } catch (err) {
        console.warn('Failed to suspend trip tracking track:', err);
      }
    }

    return updatedTrip;
  }

  /**
   * Executes a supervisor decision on an INDIVIDUAL task/stop inside an affected trip:
   * 1. REASSIGN: Moves the individual stop to another active trip or creates a dedicated transfer trip.
   * 2. POSTPONE: Sets postponement datetime on the stop and records audit note.
   * 3. SUSPEND: Flags stop as pending without blocking the overall vehicle resolution.
   */
  public static async executeIndividualStopDecision(
    companyId: string,
    operatorId: string,
    data: {
      tripId: string;
      stopId: string;
      decision: BreakdownDecisionType;
      fromVehicleId: string;
      toVehicleId?: string;
      toDriverId?: string;
      reason: string;
      postponedUntil?: string;
    }
  ): Promise<{ sourceTrip: Trip; targetTrip?: Trip }> {
    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const sourceIndex = allTrips.findIndex(t => t.id === data.tripId && t.company_id === companyId);
    if (sourceIndex === -1) {
      throw new Error(`Trip ${data.tripId} not found`);
    }

    const sourceTrip = allTrips[sourceIndex];
    const stopIndex = sourceTrip.stops.findIndex(s => s.id === data.stopId);
    if (stopIndex === -1) {
      throw new Error(`Stop ${data.stopId} not found in trip ${data.tripId}`);
    }

    const targetStop = sourceTrip.stops[stopIndex];
    const now = new Date().toISOString();

    const decisionLog: BreakdownDecisionLog = {
      id: `bd-stop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      decision: data.decision,
      stopId: data.stopId,
      stopTaskTitle: targetStop.taskTitle || targetStop.location.label,
      fromVehicleId: data.fromVehicleId,
      toVehicleId: data.toVehicleId,
      toDriverId: data.toDriverId,
      reason: data.reason || 'قرار عطل تشغيلي لمهمة فردية',
      postponedUntil: data.postponedUntil,
      operatorId,
      timestamp: now
    };

    let targetTrip: Trip | undefined;

    if (data.decision === 'REASSIGN') {
      if (!data.toVehicleId) {
        throw new Error('Target vehicle is required for task reassignment');
      }

      const allVehicles = StorageEngine.getStored<Vehicle[]>('fleet_vehicles_items', []);
      const targetVeh = allVehicles.find(v => v.id === data.toVehicleId && v.company_id === companyId);
      const targetDriver = data.toDriverId || targetVeh?.driverName || sourceTrip.driver_id;

      // Find an open/in-progress trip for this target vehicle, or create a transfer trip
      const existingTargetTripIndex = allTrips.findIndex(
        t => t.company_id === companyId && 
             t.vehicle_id === data.toVehicleId && 
             ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'IN_PROGRESS'].includes(t.status)
      );

      if (existingTargetTripIndex >= 0) {
        const existing = allTrips[existingTargetTripIndex];
        const newStop: TripStop = {
          ...targetStop,
          id: `stop-reassigned-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          sequence: existing.stops.length + 1,
          notes: `${targetStop.notes || ''} [مهمة محولة من المركبة ${data.fromVehicleId}]`.trim(),
          status: 'PENDING'
        };

        targetTrip = {
          ...existing,
          stops: [...existing.stops, newStop],
          breakdownDecisions: [...(existing.breakdownDecisions || []), decisionLog]
        };
        allTrips[existingTargetTripIndex] = targetTrip;
      } else {
        // Create new transfer trip for the target vehicle
        const startStop: TripStop = {
          id: `stop-transfer-start-${Date.now()}`,
          sequence: 1,
          taskTitle: 'نقطة الانطلاق (تحويل مهمة)',
          location: {
            org_unit_id: targetStop.location.org_unit_id || sourceTrip.org_unit_id,
            label: 'نقطة الانطلاق للمهمة المحولة',
            lat: sourceTrip.startLocation?.lat,
            lng: sourceTrip.startLocation?.lng
          },
          status: 'PENDING'
        };

        const destStop: TripStop = {
          ...targetStop,
          id: `stop-transferred-${Date.now()}`,
          sequence: 2,
          notes: `${targetStop.notes || ''} [مهمة محولة من المركبة ${data.fromVehicleId}]`.trim(),
          status: 'PENDING'
        };

        targetTrip = {
          id: `trip-reassigned-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          company_id: companyId,
          org_unit_id: targetStop.location.org_unit_id || sourceTrip.org_unit_id,
          vehicle_id: data.toVehicleId,
          driver_id: targetDriver,
          stops: [startStop, destStop],
          tripType: `تحويل مهمة: ${targetStop.taskTitle || targetStop.location.label}`,
          status: 'DRAFT',
          scheduledAt: now,
          notes: `تحويل مهمة فردية بعد عطل المركبة الأصلية: ${data.reason}`,
          reassignedFromVehicleId: data.fromVehicleId,
          reassignedAt: now,
          reassignReason: data.reason,
          breakdownDecisions: [decisionLog],
          createdBy: operatorId,
          createdAt: now
        };
        allTrips.push(targetTrip);
      }

      // Mark the original stop as skipped/reassigned in the source trip
      const updatedSourceStops = [...sourceTrip.stops];
      updatedSourceStops[stopIndex] = {
        ...targetStop,
        status: 'SKIPPED',
        reassignedToTripId: targetTrip.id,
        reassignedToVehicleId: data.toVehicleId,
        reassignedToDriverId: targetDriver,
        notes: `${targetStop.notes || ''} [تم تحويل المهمة إلى ${data.toVehicleId} - السائق: ${targetDriver}]`.trim()
      };

      // Check if all non-start stops in source trip are completed or skipped
      const pendingRemaining = updatedSourceStops.filter(s => s.sequence > 1 && !['COMPLETED', 'SKIPPED'].includes(s.status));
      const sourceStatus = pendingRemaining.length === 0 ? 'COMPLETED' : sourceTrip.status;

      sourceTrip.stops = updatedSourceStops;
      sourceTrip.status = sourceStatus;
      sourceTrip.breakdownDecisions = [...(sourceTrip.breakdownDecisions || []), decisionLog];

    } else if (data.decision === 'POSTPONE') {
      const updatedSourceStops = [...sourceTrip.stops];
      updatedSourceStops[stopIndex] = {
        ...targetStop,
        status: 'PENDING',
        postponedUntil: data.postponedUntil,
        postponeReason: data.reason,
        notes: `${targetStop.notes || ''} [مؤجلة إلى: ${data.postponedUntil}]`.trim()
      };
      sourceTrip.stops = updatedSourceStops;
      sourceTrip.breakdownDecisions = [...(sourceTrip.breakdownDecisions || []), decisionLog];

    } else {
      // SUSPEND
      const updatedSourceStops = [...sourceTrip.stops];
      updatedSourceStops[stopIndex] = {
        ...targetStop,
        status: 'PENDING',
        notes: `${targetStop.notes || ''} [معلقة لعطل بالمركبة]`.trim()
      };
      sourceTrip.stops = updatedSourceStops;
      sourceTrip.breakdownDecisions = [...(sourceTrip.breakdownDecisions || []), decisionLog];
    }

    allTrips[sourceIndex] = sourceTrip;
    StorageEngine.setStored('fleet_trips_items', allTrips);
    await dbSetDoc('fleet_trips_items', sourceTrip.id, sourceTrip);
    if (targetTrip) {
      await dbSetDoc('fleet_trips_items', targetTrip.id, targetTrip);
    }

    return { sourceTrip, targetTrip };
  }

  /**
   * Retrieves trips assigned specifically to a driver
   */
  public static getTripsForDriver(companyId: string, driverIdOrName: string): Trip[] {
    const all = this.getTripsByCompany(companyId);
    if (!driverIdOrName) return [];
    const norm = driverIdOrName.trim().toLowerCase();
    return all.filter(t => 
      (t.driver_id && t.driver_id.toLowerCase() === norm) ||
      (t.driver_id && t.driver_id.includes(driverIdOrName))
    );
  }

  /**
   * Retrieves all chat messages for a specific trip
   */
  public static getTripChatMessages(companyId: string, tripId: string): TripChatMessage[] {
    if (!companyId || !tripId) return [];
    const all = StorageEngine.getStored<TripChatMessage[]>('fleet_trip_chat_messages', []);
    return all
      .filter(m => m.company_id === companyId && m.trip_id === tripId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  /**
   * Sends a message to a trip operational chat
   */
  public static async sendTripChatMessage(
    companyId: string,
    tripId: string,
    sender: { id: string; name: string; role?: 'DRIVER' | 'SUPERVISOR' | 'ADMIN' },
    messageText: string
  ): Promise<TripChatMessage> {
    if (!messageText.trim()) {
      throw new Error('Message cannot be empty');
    }

    const all = StorageEngine.getStored<TripChatMessage[]>('fleet_trip_chat_messages', []);
    const newMsg: TripChatMessage = {
      id: `tmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      trip_id: tripId,
      company_id: companyId,
      sender_id: sender.id,
      sender_name: sender.name,
      sender_role: sender.role || 'SUPERVISOR',
      message: messageText.trim(),
      created_at: new Date().toISOString()
    };

    const updated = [...all, newMsg];
    StorageEngine.setStored('fleet_trip_chat_messages', updated);
    await dbSetDoc('fleet_trip_chat_messages', newMsg.id, newMsg);

    return newMsg;
  }

  /**
   * Retrieves all vehicle constraint rules for a company
   */
  public static getVehicleConstraints(companyId: string): VehicleConstraintRule[] {
    const all = StorageEngine.getStored<VehicleConstraintRule[]>('fleet_vehicle_constraints', []);
    return all.filter(c => c.company_id === companyId);
  }

  /**
   * Retrieves active vehicle constraint rules for a company, optionally filtered by vehicleId
   */
  public static getActiveVehicleConstraints(companyId: string, vehicleId?: string): VehicleConstraintRule[] {
    const all = this.getVehicleConstraints(companyId);
    return all.filter(c => c.is_active && (!vehicleId || c.vehicle_id === vehicleId));
  }

  /**
   * Creates or updates a vehicle access constraint rule
   */
  public static async saveVehicleConstraint(
    companyId: string,
    creatorId: string,
    data: {
      id?: string;
      vehicle_id: string;
      mode: VehicleConstraintMode;
      blocked_org_unit_ids?: string[];
      reason?: string;
      is_active?: boolean;
    }
  ): Promise<VehicleConstraintRule> {
    if (!data.vehicle_id) {
      throw new Error('Vehicle ID is required');
    }
    if (data.mode === 'BLOCK_SPECIFIC_LOCATIONS' && (!data.blocked_org_unit_ids || data.blocked_org_unit_ids.length === 0)) {
      throw new Error('Please select at least one location to block');
    }

    const all = StorageEngine.getStored<VehicleConstraintRule[]>('fleet_vehicle_constraints', []);
    const now = new Date().toISOString();

    if (data.id) {
      const idx = all.findIndex(c => c.id === data.id && c.company_id === companyId);
      if (idx !== -1) {
        const updatedRule: VehicleConstraintRule = {
          ...all[idx],
          vehicle_id: data.vehicle_id,
          mode: data.mode,
          blocked_org_unit_ids: data.mode === 'BLOCK_SPECIFIC_LOCATIONS' ? (data.blocked_org_unit_ids || []) : [],
          reason: data.reason || '',
          is_active: data.is_active !== undefined ? data.is_active : all[idx].is_active,
        };
        all[idx] = updatedRule;
        StorageEngine.setStored('fleet_vehicle_constraints', all);
        await dbSetDoc('fleet_vehicle_constraints', updatedRule.id, updatedRule);
        return updatedRule;
      }
    }

    const newRule: VehicleConstraintRule = {
      id: `vconst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      vehicle_id: data.vehicle_id,
      mode: data.mode,
      blocked_org_unit_ids: data.mode === 'BLOCK_SPECIFIC_LOCATIONS' ? (data.blocked_org_unit_ids || []) : [],
      reason: data.reason || '',
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: creatorId,
      created_at: now
    };

    const updated = [...all, newRule];
    StorageEngine.setStored('fleet_vehicle_constraints', updated);
    await dbSetDoc('fleet_vehicle_constraints', newRule.id, newRule);
    return newRule;
  }

  /**
   * Toggles active status of a vehicle constraint rule
   */
  public static async toggleVehicleConstraint(
    companyId: string,
    constraintId: string,
    isActive: boolean
  ): Promise<VehicleConstraintRule> {
    const all = StorageEngine.getStored<VehicleConstraintRule[]>('fleet_vehicle_constraints', []);
    const idx = all.findIndex(c => c.id === constraintId && c.company_id === companyId);
    if (idx === -1) {
      throw new Error(`Vehicle constraint ${constraintId} not found`);
    }

    const updatedRule: VehicleConstraintRule = {
      ...all[idx],
      is_active: isActive
    };

    all[idx] = updatedRule;
    StorageEngine.setStored('fleet_vehicle_constraints', all);
    await dbSetDoc('fleet_vehicle_constraints', updatedRule.id, updatedRule);
    return updatedRule;
  }

  /**
   * Deletes a vehicle constraint rule
   */
  public static async deleteVehicleConstraint(companyId: string, constraintId: string): Promise<void> {
    const all = StorageEngine.getStored<VehicleConstraintRule[]>('fleet_vehicle_constraints', []);
    const filtered = all.filter(c => !(c.id === constraintId && c.company_id === companyId));
    StorageEngine.setStored('fleet_vehicle_constraints', filtered);
  }

  /**
   * Retrieves all breadcrumb tracks for a company
   */
  public static getTracksByCompany(companyId: string): TripBreadcrumbTrack[] {
    const all = StorageEngine.getStored<TripBreadcrumbTrack[]>('fleet_trip_tracks', []);
    return all.filter(t => t.company_id === companyId);
  }

  /**
   * Retrieves a specific trip's breadcrumb track
   */
  public static getTripTrack(companyId: string, tripId: string): TripBreadcrumbTrack | null {
    const all = StorageEngine.getStored<TripBreadcrumbTrack[]>('fleet_trip_tracks', []);
    return all.find(t => t.trip_id === tripId && t.company_id === companyId) || null;
  }

  /**
   * Records a near real-time breadcrumb point for an active trip with strict throttling and validation.
   * Throttling: Enforces minimum interval in seconds (default 30s) between recorded points.
   * Scope: Strictly restricted to active trips (DISPATCHED or IN_PROGRESS).
   */
  public static async recordTripBreadcrumbPoint(
    companyId: string,
    tripId: string,
    vehicleId: string,
    driverId: string,
    point: {
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number | null;
      heading?: number | null;
      timestamp?: string;
    },
    minIntervalSeconds: number = 30
  ): Promise<{ recorded: boolean; track?: TripBreadcrumbTrack; reason?: string }> {
    if (!companyId || !tripId || !vehicleId || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      return { recorded: false, reason: 'Invalid tracking payload' };
    }

    // Verify trip exists and is strictly active
    const allTrips = StorageEngine.getStored<Trip[]>('fleet_trips_items', []);
    const trip = allTrips.find(t => t.id === tripId && t.company_id === companyId);
    if (!trip) {
      return { recorded: false, reason: 'Trip not found' };
    }

    if (trip.status !== 'DISPATCHED' && trip.status !== 'IN_PROGRESS') {
      return { recorded: false, reason: `Trip is not in active state (current: ${trip.status})` };
    }

    const allTracks = StorageEngine.getStored<TripBreadcrumbTrack[]>('fleet_trip_tracks', []);
    let trackIndex = allTracks.findIndex(t => t.trip_id === tripId && t.company_id === companyId);
    const nowIso = point.timestamp || new Date().toISOString();
    const nowTime = new Date(nowIso).getTime();

    let track: TripBreadcrumbTrack;

    if (trackIndex >= 0) {
      track = allTracks[trackIndex];
      // Check if track was ended
      if (track.status !== 'ACTIVE' || track.is_active === false) {
        return { recorded: false, reason: 'Trip track is no longer active', track };
      }
      // Check throttling against last recorded point
      if (track.last_point && track.last_point.timestamp) {
        const lastTime = new Date(track.last_point.timestamp).getTime();
        const diffSeconds = (nowTime - lastTime) / 1000;
        if (diffSeconds < minIntervalSeconds) {
          return { 
            recorded: false, 
            reason: `Throttled: only ${diffSeconds.toFixed(1)}s elapsed since last recorded point (min: ${minIntervalSeconds}s)`,
            track 
          };
        }
      }
    } else {
      // Initialize new breadcrumb track for this trip
      track = {
        id: `track-${tripId}`,
        company_id: companyId,
        trip_id: tripId,
        vehicle_id: vehicleId,
        driver_id: driverId,
        status: 'ACTIVE',
        is_active: true,
        points: [],
        started_at: nowIso,
        updated_at: nowIso,
        total_distance_km: 0
      };
      allTracks.push(track);
      trackIndex = allTracks.length - 1;
    }

    // Prepare point
    const newPoint: TripBreadcrumbPoint = {
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracy,
      speed: point.speed ?? null,
      heading: point.heading ?? null,
      timestamp: nowIso
    };

    // Calculate distance delta if there is a previous point
    let distanceDeltaKm = 0;
    if (track.last_point && typeof track.last_point.lat === 'number' && typeof track.last_point.lng === 'number') {
      distanceDeltaKm = this.calculateDistanceKm(
        track.last_point.lat,
        track.last_point.lng,
        newPoint.lat,
        newPoint.lng
      );
    }

    const updatedPoints = [...track.points, newPoint];
    const updatedTotalKm = Math.round(((track.total_distance_km || 0) + distanceDeltaKm) * 100) / 100;

    const updatedTrack: TripBreadcrumbTrack = {
      ...track,
      status: 'ACTIVE',
      is_active: true,
      points: updatedPoints,
      last_point: newPoint,
      updated_at: nowIso,
      total_distance_km: updatedTotalKm
    };

    allTracks[trackIndex] = updatedTrack;
    StorageEngine.setStored('fleet_trip_tracks', allTracks);
    await dbSetDoc('fleet_trip_tracks', updatedTrack.id, updatedTrack);

    // Update vehicle's last known location for quick list display
    try {
      await this.updateVehicleLocationAndStatus(
        companyId,
        vehicleId,
        {
          lat: newPoint.lat,
          lng: newPoint.lng,
          accuracy: newPoint.accuracy,
          updatedAt: nowIso,
          label: 'تتبع مباشر (أثناء المشوار)'
        }
      );
    } catch (err) {
      console.warn('Failed to update vehicle last known location on breadcrumb:', err);
    }

    return { recorded: true, track: updatedTrack };
  }

  /**
   * Finalizes or suspends a trip's breadcrumb tracking log
   */
  public static async endTripTrack(
    companyId: string,
    tripId: string,
    finalStatus: 'COMPLETED' | 'SUSPENDED' | 'CANCELLED' = 'COMPLETED'
  ): Promise<TripBreadcrumbTrack | null> {
    const allTracks = StorageEngine.getStored<TripBreadcrumbTrack[]>('fleet_trip_tracks', []);
    const trackIndex = allTracks.findIndex(t => t.trip_id === tripId && t.company_id === companyId);
    if (trackIndex === -1) return null;

    const current = allTracks[trackIndex];
    const nowIso = new Date().toISOString();
    const updated: TripBreadcrumbTrack = {
      ...current,
      status: finalStatus,
      is_active: false,
      ended_at: nowIso,
      updated_at: nowIso
    };

    allTracks[trackIndex] = updated;
    StorageEngine.setStored('fleet_trip_tracks', allTracks);
    await dbSetDoc('fleet_trip_tracks', updated.id, updated);
    return updated;
  }

  /**
   * Cancels a trip and stops live tracking
   */
  public static async cancelTrip(
    companyId: string,
    operatorId: string,
    tripId: string,
    reason?: string
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
      status: 'CANCELLED',
      postponeReason: reason || 'إلغاء المشوار'
    };

    allTrips[tripIndex] = updatedTrip;
    StorageEngine.setStored('fleet_trips_items', allTrips);
    await dbSetDoc('fleet_trips_items', updatedTrip.id, updatedTrip);

    // Reset vehicle status to ACTIVE if it was dispatched
    await this.updateVehicleLocationAndStatus(
      companyId,
      trip.vehicle_id,
      undefined,
      'ACTIVE'
    );

    // End tracking
    await this.endTripTrack(companyId, tripId, 'CANCELLED');

    return updatedTrip;
  }
}

