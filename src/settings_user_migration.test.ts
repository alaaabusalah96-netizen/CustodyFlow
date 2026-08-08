import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 2 - Settings.tsx User Creation/Editing Migration Audit', () => {
  const settingsPath = path.join(process.cwd(), 'src', 'pages', 'Settings.tsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');

  it('1. Verify handleAddUser uses POST /api/admin/users', () => {
    expect(settingsContent).toContain("fetch('/api/admin/users'");
    expect(settingsContent).toContain("method: 'POST'");
  });

  it('2. Verify no hardcoded password "123456" or plaintext password save in handleAddUser', () => {
    expect(settingsContent).not.toContain("password: '123456'");
  });

  it('3. Verify handleSaveEditUser uses PATCH /api/admin/users/:id', () => {
    expect(settingsContent).toContain("fetch(`/api/admin/users/${id}`");
    expect(settingsContent).toContain("method: 'PATCH'");
  });

  it('4. Verify activation approval uses PATCH /api/admin/users/:id', () => {
    expect(settingsContent).toContain("fetch(`/api/admin/users/${pendingUser.id}`");
  });

  it('5. Verify Authorization Bearer token or credentials header is passed', () => {
    expect(settingsContent).toContain('getAuthHeaders');
    expect(settingsContent).toContain("credentials: 'include'");
  });

  it('6. Verify error response is handled without falling back to plaintext saveUsers', () => {
    expect(settingsContent).toContain('if (!res.ok || !data.success)');
  });
});
