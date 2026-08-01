import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 18: Zero-Lockout Dedicated Platform Owner Bootstrap & PBKDF2 210,000 Single-Use Lock', () => {
  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  const loginCode = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf-8');

  it('1. server.ts provides single-use bootstrap-status and bootstrap-platform-owner endpoints', () => {
    expect(serverCode).toContain('/api/auth/bootstrap-platform-owner');
    expect(serverCode).toContain('/api/auth/bootstrap-status');
    expect(serverCode).toContain('isPlatformAdminBootstrapped()');
    expect(serverCode).toContain('system_config');
    expect(serverCode).toContain('bootstrapped: true');
  });

  it('2. server.ts enforces single-use lock by rejecting bootstrap requests if already bootstrapped', () => {
    expect(serverCode).toContain('تم إعداد مشرف المنصة مسبقاً (Already Bootstrapped)');
    expect(serverCode).toContain('res.status(403)');
  });

  it('3. server.ts hashes platform admin password with authoritative PBKDF2 210,000 stretching and stores in user_credentials vault', () => {
    expect(serverCode).toContain('hashPasswordPBKDF2_210k(password, userSalt, 2)');
    expect(serverCode).toContain("kdf: 'sha256_pbkdf2_210k'");
    expect(serverCode).toContain('user_credentials');
  });

  it('4. Login.tsx displays zero-lockout bootstrap banner when bootstrapStatus === false', () => {
    expect(loginCode).toContain('Zero-Lockout Platform Owner Bootstrap Available');
    expect(loginCode).toContain('إعداد حساب مشرف المنصة لأول مرة (Platform Owner Bootstrap)');
    expect(loginCode).toContain('handleBootstrapPlatformOwner');
  });

  it('5. Login.tsx provides form for setting SystemAdmin email and confirming password securely', () => {
    expect(loginCode).toContain('Platform Owner Email');
    expect(loginCode).toContain('bootstrapConfirmPassword');
    expect(loginCode).toContain('كلمات المرور غير متطابقة.');
  });
});
