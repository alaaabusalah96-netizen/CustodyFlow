import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Part 2: Repeat-Login-Failure Diagnostic Audit', () => {
  it('1. Confirms the unchanged unsafe invalid-credential auto-create branch in Login.tsx', () => {
    const loginTsxPath = path.join(process.cwd(), 'src/pages/Login.tsx');
    const content = fs.readFileSync(loginTsxPath, 'utf8');
    
    // Check that auth/invalid-credential still triggers createUserWithEmailAndPassword
    expect(content).toContain("if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/invalid-email')");
    expect(content).toContain('[Diagnostic Part 2] signInWithEmailAndPassword authErr.code:');
    expect(content).toContain('[Diagnostic Part 2] createUserWithEmailAndPassword createErr.code:');
  });

  it('2. Verifies saveUsers calls in handleLogin and identifies the unwrapped call that can leave migration partially applied', () => {
    const loginTsxPath = path.join(process.cwd(), 'src/pages/Login.tsx');
    const content = fs.readFileSync(loginTsxPath, 'utf8');

    // Verify that migrate-credential-id endpoint call is wrapped in try/catch
    expect(content).toContain("await fetch('/api/auth/migrate-credential-id'");
    
    // Verify that dbDeleteDoc('users', legacyUser.id) is wrapped in try/catch
    expect(content).toContain("await dbDeleteDoc('users', legacyUser.id);");

    // Locate the unwrapped saveUsers call after ID migration
    const saveUsersLines = content.split('\n')
      .map((line, idx) => ({ idx: idx + 1, line: line.trim() }))
      .filter(entry => entry.line.includes('await CustodyDB.saveUsers('));

    expect(saveUsersLines.length).toBeGreaterThanOrEqual(2);

    // One of the calls is around line 436 (after ID migration) and is not inside its own try/catch block
    const idMigrationSaveCall = saveUsersLines.find(l => l.idx > 420 && l.idx < 520);
    expect(idMigrationSaveCall).toBeDefined();
  });
});
