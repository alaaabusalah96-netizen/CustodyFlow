import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Dead-Auth Cleanup & AUTH_BYPASS Verification', () => {
  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  const loginCode = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf-8');

  it('1. server.ts no longer contains legacy bootstrap or reset-password endpoints', () => {
    expect(serverCode).not.toContain('/api/auth/bootstrap-platform-owner');
    expect(serverCode).not.toContain('/api/auth/bootstrap-status');
    expect(serverCode).not.toContain('/api/auth/reset-password/request');
    expect(serverCode).not.toContain('/api/auth/reset-password/verify');
    expect(serverCode).not.toContain('/api/auth/reset-password/confirm');
  });

  it('2. server.ts provides /api/dev/wipe-auth-data endpoint for cleaning legacy auth collections', () => {
    expect(serverCode).toContain('/api/dev/wipe-auth-data');
    expect(serverCode).toContain('X-Wipe-Token');
    expect(serverCode).toContain('WIPE_AUTH_DATA');
  });

  it('3. Login.tsx supports minimal AUTH_BYPASS spinner and dev user session', () => {
    expect(loginCode).toContain('__AUTH_BYPASS__');
    expect(loginCode).toContain('dev-bypass-user');
    expect(loginCode).toContain('animate-spin');
  });

  it('4. Login.tsx shows neutral rebuild message when bypass is not active', () => {
    expect(loginCode).toContain('نظام الدخول قيد إعادة البناء');
    expect(loginCode).toContain('Auth will be rebuilt later');
  });

  it('5. Login.tsx does not contain legacy bootstrap or signup forms', () => {
    expect(loginCode).not.toContain('bootstrapEmail');
    expect(loginCode).not.toContain('isRegisterMode');
    expect(loginCode).not.toContain('isResetMode');
  });
});
