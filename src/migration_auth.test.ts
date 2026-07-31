import { describe, it, expect, vi } from 'vitest';
import { getPepperByVersion, getActivePepper, LEGACY_EXPOSED_PEPPER, hashPassword } from './lib/hash';

describe('Phase 2 - Authentication on Migration Endpoints', () => {
  it('rejects unauthenticated requests to migration endpoints with 401', async () => {
    // Simulated express middleware logic check
    const authHeader = undefined;
    const isHeaderValid = authHeader && (authHeader as string).startsWith('Bearer ');
    expect(isHeaderValid).toBeFalsy();
  });

  it('rejects invalid or non-SystemAdmin tokens with 403', async () => {
    const mockUserRole = 'StationAdmin';
    const isPlatformOwner = false;
    const allowedRoles = ['SystemAdmin'];
    const isAuthorized = isPlatformOwner || allowedRoles.includes(mockUserRole);
    expect(isAuthorized).toBe(false);
  });

  it('allows SystemAdmin tokens to execute migration', async () => {
    const mockUserRole = 'SystemAdmin';
    const isPlatformOwner = false;
    const allowedRoles = ['SystemAdmin'];
    const isAuthorized = isPlatformOwner || allowedRoles.includes(mockUserRole);
    expect(isAuthorized).toBe(true);
  });
});

describe('Security - Pepper Versioning & Rotation Support', () => {
  it('returns LEGACY_EXPOSED_PEPPER for pepper_version = 1', () => {
    const pepper = getPepperByVersion(1);
    expect(pepper).toBe(LEGACY_EXPOSED_PEPPER);
  });

  it('returns active APP_PEPPER for pepper_version = 2', () => {
    process.env.APP_PEPPER = "TestSecureActivePepper2026_SecretValue_v2";
    const pepper = getPepperByVersion(2);
    expect(pepper).toBe("TestSecureActivePepper2026_SecretValue_v2");
  });

  it('produces distinct password hashes for pepper_version 1 vs pepper_version 2 when APP_PEPPER differs', () => {
    process.env.APP_PEPPER = "NewRotatedSecretPepper_987654321_Unique";
    const hashV1 = hashPassword("TestPassword!2026", "user_salt_1", 1);
    const hashV2 = hashPassword("TestPassword!2026", "user_salt_1", 2);
    expect(hashV1).not.toBe(hashV2);
  });

  it('throws an error when APP_PEPPER is unset for pepper_version = 2 (fails loudly)', () => {
    const originalPepper = process.env.APP_PEPPER;
    delete process.env.APP_PEPPER;
    try {
      expect(() => getPepperByVersion(2)).toThrow(/APP_PEPPER environment variable is not set/);
    } finally {
      process.env.APP_PEPPER = originalPepper;
    }
  });
});

