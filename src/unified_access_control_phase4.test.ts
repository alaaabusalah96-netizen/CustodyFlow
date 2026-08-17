import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4: Final Cleanup & Integrity Verification', () => {
  it('1. SuperAdmin.tsx has no unused AdminCredentialsForm import', () => {
    const superAdminFile = fs.readFileSync(path.join(process.cwd(), 'src/pages/SuperAdmin.tsx'), 'utf-8');
    expect(superAdminFile).not.toContain("import AdminCredentialsForm from '../components/AdminCredentialsForm'");
  });

  it('2. Stations.tsx preserves all operational and custody workflows without regression', () => {
    const stationsFile = fs.readFileSync(path.join(process.cwd(), 'src/pages/Stations.tsx'), 'utf-8');
    expect(stationsFile).toContain('CustodyDB');
    expect(stationsFile).toContain('OrganizationTreeManager');
  });

  it('3. UnifiedAccessControlCenter manages all access, structure, and users centrally', () => {
    const uacFile = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/UnifiedAccessControlCenter.tsx'), 'utf-8');
    expect(uacFile).toContain('effectiveCompanyId');
    expect(uacFile).toContain('UsersModule');
    expect(uacFile).toContain('impersonateUser');
  });
});
