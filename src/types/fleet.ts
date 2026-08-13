export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | 'DISPATCHED';
export type VehicleType = 'TRUCK' | 'VAN' | 'CAR' | 'MOTORCYCLE' | 'PICKUP' | 'HEAVY_EQUIPMENT';

export interface Vehicle {
  id: string;
  company_id: string;
  org_unit_id?: string;
  cost_center_id?: string;
  code: string; // e.g. FLT-001
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  driverName?: string;
  odometerReading: number; // in KM
  fuelCapacity: number; // in Liters
  assignedOrgUnitName?: string;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  company_id: string;
  vehicle_id: string;
  org_unit_id?: string;
  cost_center_id?: string;
  maintenanceDate: string;
  type: 'ROUTINE' | 'REPAIR' | 'OIL_CHANGE' | 'TIRES' | 'INSPECTION';
  description: string;
  cost: number;
  providerName?: string;
  odometerAtService: number;
  createdAt: string;
}

export interface FuelLog {
  id: string;
  company_id: string;
  vehicle_id: string;
  org_unit_id?: string;
  cost_center_id?: string;
  logDate: string;
  liters: number;
  costPerLiter: number;
  totalCost: number;
  odometerReading: number;
  createdAt: string;
}

export type TripStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' 
  | 'DISPATCHED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export interface Trip {
  id: string;
  company_id: string;
  org_unit_id?: string;
  vehicle_id: string;
  driver_id: string;
  from_org_unit_id: string;
  to_org_unit_id: string;
  tripType: string;
  status: TripStatus;
  scheduledAt: string;
  dispatchedAt?: string;
  completedAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

