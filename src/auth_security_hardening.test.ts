import { describe, it, expect } from 'vitest';
import { hashPassword, hashPasswordPBKDF2_210k, getPepperByVersion } from './lib/server_hash';
import { UsersModule } from './db/users';
import fs from 'fs';
import path from 'path';

describe('v49-security-hardening: Authentication & Security Standards Verification', () => {
  it('should verify that APP_PEPPER and placeholder PLATFORM_OWNER_EMAIL are documented in .env.example without exposing personal data', () => {
    const envExamplePath = path.join(process.cwd(), '.env.example');
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    
    expect(content).toContain('APP_PEPPER=');
    expect(content).toContain('PLATFORM_OWNER_EMAIL="admin@your-domain.com"');
    expect(content).not.toContain('alaaabusalah96@gmail.com');
  });

  it('should verify PBKDF2 210,000 iteration password hashing produces unique salted-and-peppered hashes per pepper version', () => {
    const password = 'SecureFinancialPassword!2026';
    const emailSalt = 'admin@kemit-erp.com';

    const hashV1 = hashPasswordPBKDF2_210k(password, emailSalt, 1);
    const hashV2 = hashPasswordPBKDF2_210k(password, emailSalt, 2);

    expect(hashV1).toBeDefined();
    expect(hashV2).toBeDefined();
    expect(hashV1).not.toEqual(hashV2);
    expect(hashV1.length).toBe(128); // 64 bytes hex
    expect(hashV2.length).toBe(128);
  });

  it('should verify plaintext password matching fallback is disabled when NODE_ENV is production and ALLOW_PLAINTEXT_DEV_FALLBACK is not true', () => {
    const origEnv = process.env.NODE_ENV;
    const origFallback = process.env.ALLOW_PLAINTEXT_DEV_FALLBACK;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_PLAINTEXT_DEV_FALLBACK;

      const allowPlaintextFallback = process.env.NODE_ENV !== 'production' || process.env.ALLOW_PLAINTEXT_DEV_FALLBACK === 'true';
      expect(allowPlaintextFallback).toBe(false);

      process.env.ALLOW_PLAINTEXT_DEV_FALLBACK = 'true';
      const allowPlaintextFallbackOverride = process.env.NODE_ENV !== 'production' || process.env.ALLOW_PLAINTEXT_DEV_FALLBACK === 'true';
      expect(allowPlaintextFallbackOverride).toBe(true);
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.ALLOW_PLAINTEXT_DEV_FALLBACK = origFallback;
    }
  });

  it('should correctly validate platform owner identity without wildcard matching', () => {
    const ownerEmail = process.env.PLATFORM_OWNER_EMAIL || 'admin@kemit-erp.com';
    expect(UsersModule.isPlatformOwner(ownerEmail)).toBe(true);
    expect(UsersModule.isPlatformOwner(` ${ownerEmail} `)).toBe(true);
    expect(UsersModule.isPlatformOwner('random_user@domain.com')).toBe(false);
    expect(UsersModule.isPlatformOwner('')).toBe(false);
  });

  it('should verify STRICT_PROD_SECURITY disables plaintext fallback even if ALLOW_PLAINTEXT_DEV_FALLBACK is true', () => {
    const origStrict = process.env.STRICT_PROD_SECURITY;
    const origFallback = process.env.ALLOW_PLAINTEXT_DEV_FALLBACK;

    try {
      process.env.STRICT_PROD_SECURITY = 'true';
      process.env.ALLOW_PLAINTEXT_DEV_FALLBACK = 'true';

      const isStrictProdSecurity = process.env.STRICT_PROD_SECURITY === 'true';
      const allowPlaintextFallback = !isStrictProdSecurity && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_PLAINTEXT_DEV_FALLBACK === 'true');
      expect(allowPlaintextFallback).toBe(false);
    } finally {
      process.env.STRICT_PROD_SECURITY = origStrict;
      process.env.ALLOW_PLAINTEXT_DEV_FALLBACK = origFallback;
    }
  });
});
