export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | 'DISPATCHED' | 'BREAKDOWN' | 'OUT_OF_SERVICE';
export type VehicleType = 'TRUCK' | 'VAN' | 'CAR' | 'MOTORCYCLE' | 'PICKUP' | 'HEAVY_EQUIPMENT';

export interface VehicleLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: string;
  label?: string;
}

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
  last_known_location?: VehicleLocation;
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
  | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'POSTPONED' | 'SUSPENDED_BREAKDOWN';

export type TripStopStatus = 'PENDING' | 'IN_PROGRESS' | 'ARRIVED' | 'COMPLETED' | 'SKIPPED';

export interface TripLocation {
  org_unit_id?: string;
  label: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  timestamp?: string;
}

export interface LearnedLocationHistoryEntry {
  label: string;
  lat: number;
  lng: number;
  accuracy?: number;
  visitedAt: string;
  tripId?: string;
}

export interface LearnedTaskLocation {
  id: string;
  company_id: string;
  org_unit_id: string; // Region or Org Unit mandatory to prevent cross-region collisions
  task_type: string;   // Normalized task name (e.g. "بوسطة", "تغيير اسطوانات غاز", "صيانة")
  label: string;
  lat: number;
  lng: number;
  accuracy?: number;
  visitCount: number;
  lastVisitedAt: string;
  history?: LearnedLocationHistoryEntry[];
}

export interface TripChatMessage {
  id: string;
  trip_id: string;
  company_id: string;
  sender_id: string;
  sender_name: string;
  sender_role?: 'DRIVER' | 'SUPERVISOR' | 'ADMIN';
  message: string;
  created_at: string;
}

export type BreakdownDecisionType = 'REASSIGN' | 'POSTPONE' | 'SUSPEND';

export interface BreakdownDecisionLog {
  id: string;
  decision: BreakdownDecisionType;
  stopId?: string; // If decision is per individual task/stop
  stopTaskTitle?: string;
  fromVehicleId: string;
  toVehicleId?: string;
  toDriverId?: string;
  reason: string;
  postponedUntil?: string;
  operatorId: string;
  timestamp: string;
}

export interface TripStop {
  id: string;
  sequence: number;
  taskTitle?: string; // e.g. "بوسطة", "تغيير اسطوانات غاز", "صيانة", "استلام/تسليم"
  notes?: string;
  location: TripLocation;
  status: TripStopStatus;
  startLocation?: TripLocation;
  arrivedLocation?: TripLocation;
  reassignedToTripId?: string;
  reassignedToVehicleId?: string;
  reassignedToDriverId?: string;
  postponedUntil?: string;
  postponeReason?: string;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
}

export interface Trip {
  id: string;
  company_id: string;
  org_unit_id?: string;
  vehicle_id: string;
  driver_id: string;
  stops: TripStop[];
  tripType: string;
  isEmergency?: boolean;
  status: TripStatus;
  scheduledAt: string;
  startedAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
  startLocation?: TripLocation;
  notes?: string;
  reassignedFromVehicleId?: string;
  reassignedAt?: string;
  reassignReason?: string;
  postponedUntil?: string;
  postponeReason?: string;
  breakdownDecisions?: BreakdownDecisionLog[];
  createdBy: string;
  createdAt: string;
}

export type VehicleConstraintMode = 'BLOCK_SPECIFIC_LOCATIONS' | 'EXTERNAL_ONLY';

export interface VehicleConstraintRule {
  id: string;
  company_id: string;
  vehicle_id: string;
  mode: VehicleConstraintMode;
  blocked_org_unit_ids?: string[];
  reason?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface TripBreadcrumbPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: string;
}

export interface TripBreadcrumbTrack {
  id: string;
  company_id: string;
  trip_id: string;
  vehicle_id: string;
  driver_id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED';
  is_active?: boolean;
  points: TripBreadcrumbPoint[];
  last_point?: TripBreadcrumbPoint;
  started_at: string;
  ended_at?: string;
  updated_at: string;
  total_distance_km: number;
}

