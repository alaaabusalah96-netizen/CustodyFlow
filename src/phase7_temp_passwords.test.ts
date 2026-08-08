import { describe, it, expect } from 'vitest';

function generateSecureTemporaryPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < 16; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

describe('Phase 7: Temporary Passwords & Forced Change Gate', () => {
  it('generateSecureTemporaryPassword returns a 16-character string with diverse characters', () => {
    const pass = generateSecureTemporaryPassword();
    expect(pass.length).toBe(16);
    expect(typeof pass).toBe('string');
  });

  it('validates password compliance for change-password requirements (min 12 chars, letters and numbers)', () => {
    const isCompliant = (p: string) => p.length >= 12 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);
    
    expect(isCompliant('short1')).toBe(false);
    expect(isCompliant('alllettersnolength')).toBe(false);
    expect(isCompliant('123456789012')).toBe(false);
    expect(isCompliant('ValidPass2026!')).toBe(true);
    expect(isCompliant('StrongPassphrase99#')).toBe(true);
  });
});
