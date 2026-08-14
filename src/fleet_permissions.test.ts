import { describe, it, expect } from 'vitest';
import { UsersModule } from './db/users';

describe('Fleet Permissions Enrichening', () => {
  it('should return manage_fleet: true for SystemAdmin by default', () => {
    const perms = UsersModule.enrichUserPermissions('SystemAdmin');
    expect(perms.manage_fleet).toBe(true);
    expect(perms.create_trip).toBe(false);
    expect(perms.approve_trip).toBe(false);
    expect(perms.dispatch_trip).toBe(false);
  });

  it('should return manage_fleet: false and create_trip: false for StationAdmin without currentPerms', () => {
    const perms = UsersModule.enrichUserPermissions('StationAdmin');
    expect(perms.manage_fleet).toBe(false);
    expect(perms.create_trip).toBe(false);
    expect(perms.approve_trip).toBe(false);
    expect(perms.dispatch_trip).toBe(false);
  });

  it('should preserve explicit currentPerms like create_trip: true even for StationAdmin role', () => {
    const perms = UsersModule.enrichUserPermissions('StationAdmin', {
      create_trip: true,
      manage_fleet: true
    });
    expect(perms.create_trip).toBe(true);
    expect(perms.manage_fleet).toBe(true);
    expect(perms.approve_trip).toBe(false);
  });

  it('should return manage_fleet: true for Admin role by default, and false for other roles like StationAdmin or RegionalManager', () => {
    const adminPerms = UsersModule.enrichUserPermissions('Admin');
    expect(adminPerms.manage_fleet).toBe(true);

    const stationPerms = UsersModule.enrichUserPermissions('StationAdmin');
    expect(stationPerms.manage_fleet).toBe(false);

    const regionalPerms = UsersModule.enrichUserPermissions('RegionalManager');
    expect(regionalPerms.manage_fleet).toBe(false);
  });
});
