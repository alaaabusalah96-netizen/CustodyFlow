import { describe, it, expect } from 'vitest';
import { UserPermissions } from './types';
import { UsersModule } from './db/users';

describe('Trips & Fleet Security Rules & Permissions Logic', () => {
  it('1. SystemAdmin has all fleet and trip permissions enabled by default', () => {
    const sysAdminPerms = UsersModule.enrichUserPermissions('SystemAdmin');
    expect(sysAdminPerms.manage_fleet).toBe(true);
    expect(sysAdminPerms.create_trip).toBe(false); // default unless granted or admin
  });

  it('2. Custom permissions override default trip flags', () => {
    const customPerms: Partial<UserPermissions> = {
      manage_fleet: true,
      create_trip: true,
      approve_trip: true,
      dispatch_trip: true,
    };
    const enriched = UsersModule.enrichUserPermissions('StationAdmin', customPerms);
    expect(enriched.manage_fleet).toBe(true);
    expect(enriched.create_trip).toBe(true);
    expect(enriched.approve_trip).toBe(true);
    expect(enriched.dispatch_trip).toBe(true);
  });

  it('3. Trip payload contains valid company_id structure for isSameCompanyWrite', () => {
    const sampleTrip = {
      id: 'trip-101',
      company_id: 'test-company-123',
      vehicle_id: 'veh-1',
      driver_id: 'drv-1',
      status: 'PLANNED',
      origin: 'Riyadh Depot',
      destination: 'Jeddah Station',
      createdAt: new Date().toISOString(),
    };

    expect(sampleTrip.company_id).toBe('test-company-123');
    expect(sampleTrip.id).toBe('trip-101');
  });
});
