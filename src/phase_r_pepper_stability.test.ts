import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  hashPasswordPBKDF2_210k,
  getActiveServerPepper,
  getPepperByVersion,
  LEGACY_EXPOSED_PEPPER,
  TRANSIENT_EXPOSED_PEPPER_V2
} from './lib/server_hash';

describe('Phase R: APP_PEPPER Persistence & Stability Across Server Restarts/Redeploys', () => {
  it('1. Verifies that fallback pepper is a fixed, deterministic string constant across calls and restarts', () => {
    const originalPepper = process.env.APP_PEPPER;
    const originalStrict = process.env.STRICT_PROD_SECURITY;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.APP_PEPPER;
    delete process.env.STRICT_PROD_SECURITY;
    process.env.NODE_ENV = 'development';

    try {
      const call1 = getActiveServerPepper();
      const call2 = getActiveServerPepper();
      expect(call1).toBe('CustodyFlowActivePepper2026_SecureDefault_v2_KeyDerivation');
      expect(call2).toBe('CustodyFlowActivePepper2026_SecureDefault_v2_KeyDerivation');
      expect(call1).toBe(call2);
    } finally {
      process.env.APP_PEPPER = originalPepper;
      process.env.STRICT_PROD_SECURITY = originalStrict;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('2. Simulates user created in Deployment A and verified in Deployment B (both with stable fallback pepper)', () => {
    const originalPepper = process.env.APP_PEPPER;
    const originalStrict = process.env.STRICT_PROD_SECURITY;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.APP_PEPPER;
    delete process.env.STRICT_PROD_SECURITY;
    process.env.NODE_ENV = 'development';

    try {
      const plainPassword = 'TemporaryUserSecret2026!';
      const salt = crypto.randomUUID();
      const pepperVersion = 2;

      // Deployment A: hash generated on user creation
      const hashDeploymentA = hashPasswordPBKDF2_210k(plainPassword, salt, pepperVersion);

      // Simulate Server Restart / Container Redeploy (re-reading fallback pepper)
      const pepperDeploymentB = getPepperByVersion(pepperVersion);
      expect(pepperDeploymentB).toBe('CustodyFlowActivePepper2026_SecureDefault_v2_KeyDerivation');

      // Deployment B: user enters same password on first login / change password
      const hashDeploymentB = hashPasswordPBKDF2_210k(plainPassword, salt, pepperVersion);

      expect(hashDeploymentA).toBe(hashDeploymentB);
    } finally {
      process.env.APP_PEPPER = originalPepper;
      process.env.STRICT_PROD_SECURITY = originalStrict;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('3. Simulates user created with persistent custom APP_PEPPER environment variable across restarts', () => {
    const customPepperSecret = 'KemitSecureProductionPepper_CustomSecret_9876543210';
    process.env.APP_PEPPER = customPepperSecret;

    try {
      const plainPassword = 'AdminProvidedSecret123!';
      const salt = crypto.randomUUID();
      const pepperVersion = 2;

      // Hash with active secret
      const hash1 = hashPasswordPBKDF2_210k(plainPassword, salt, pepperVersion);

      // Server restart with same environment variable
      const activePepperAfterRestart = getActiveServerPepper();
      expect(activePepperAfterRestart).toBe(customPepperSecret);

      const hash2 = hashPasswordPBKDF2_210k(plainPassword, salt, pepperVersion);
      expect(hash1).toBe(hash2);
    } finally {
      delete process.env.APP_PEPPER;
    }
  });

  it('4. Confirms legacy version routing (version 1 -> legacy, version 3 -> transient, version 2 -> active/fallback)', () => {
    const originalPepper = process.env.APP_PEPPER;
    const originalStrict = process.env.STRICT_PROD_SECURITY;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.APP_PEPPER;
    delete process.env.STRICT_PROD_SECURITY;
    process.env.NODE_ENV = 'development';

    try {
      expect(getPepperByVersion(1)).toBe(LEGACY_EXPOSED_PEPPER);
      expect(getPepperByVersion(3)).toBe(TRANSIENT_EXPOSED_PEPPER_V2);
      expect(getPepperByVersion(2)).toBe('CustodyFlowActivePepper2026_SecureDefault_v2_KeyDerivation');
    } finally {
      process.env.APP_PEPPER = originalPepper;
      process.env.STRICT_PROD_SECURITY = originalStrict;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
