import { AppUser, UserRole, UserPermissions, SystemPermission, SystemRole, SignupRequest } from '../types';
import { dbSetDoc, dbDeleteDoc } from '../firebase';
import { StorageEngine } from './storage';
import { DEFAULT_USERS, DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './defaults';
import { LogsModule } from './logs';

export function hashPassword(password: string): string {
  if (!password) return '';
  function rotateRight(n: number, x: number) {
    return (x >>> n) | (x << (32 - n));
  }
  const words: number[] = [];
  const asciiBitLength = password.length * 8;
  
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const wordsCount = ((asciiBitLength + 64 >> 9) << 4) + 16;
  for (let i = 0; i < wordsCount; i++) words[i] = 0;
  for (let i = 0; i < password.length; i++) {
    words[i >> 2] |= (password.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[wordsCount - 1] = asciiBitLength;

  for (let i = 0; i < words.length; i += 16) {
    const w = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j];
    for (let j = 16; j < 64; j++) {
      const s0 = rotateRight(7, w[j - 15]) ^ rotateRight(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      const s1 = rotateRight(17, w[j - 2]) ^ rotateRight(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rotateRight(6, e) ^ rotateRight(11, e) ^ rotateRight(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rotateRight(2, a) ^ rotateRight(13, a) ^ rotateRight(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const hashWords = [h0, h1, h2, h3, h4, h5, h6, h7];
  const result: string[] = [];
  for (let i = 0; i < 8; i++) {
    const word = hashWords[i];
    const hex = (word >>> 0).toString(16);
    result.push(('00000000' + hex).slice(-8));
  }
  return result.join('');
}

export class UsersModule {
  static enrichUserPermissions(role: UserRole, currentPerms?: Partial<UserPermissions>): UserPermissions {
    const isSystemAdmin = role === 'SystemAdmin';
    const isAdmin = role === 'Admin';
    const isRegional = role === 'RegionalManager';
    const isStation = role === 'StationAdmin';

    return {
      create_expense: (isAdmin || isSystemAdmin) ? false : (currentPerms?.create_expense ?? (isSystemAdmin || isStation)),
      edit_expense: currentPerms?.edit_expense ?? (isSystemAdmin || isAdmin || isStation),
      delete_expense: currentPerms?.delete_expense ?? (isSystemAdmin || isAdmin),
      create_voucher: (isAdmin || isSystemAdmin) ? false : (currentPerms?.create_voucher ?? (isSystemAdmin || isStation)),
      approve_voucher: currentPerms?.approve_voucher ?? (isSystemAdmin || isAdmin || isRegional),
      reject_voucher: currentPerms?.reject_voucher ?? (isSystemAdmin || isAdmin || isRegional),
      create_custody: currentPerms?.create_custody ?? (isSystemAdmin || isAdmin),
      edit_custody: currentPerms?.edit_custody ?? (isSystemAdmin || isAdmin),
      replace_custody: currentPerms?.replace_custody ?? (isSystemAdmin || isAdmin || isRegional),
      view_reports: currentPerms?.view_reports ?? true,
      manage_users: currentPerms?.manage_users ?? (isSystemAdmin || isAdmin),
      manage_companies: currentPerms?.manage_companies ?? isSystemAdmin,
      manage_regions: currentPerms?.manage_regions ?? (isSystemAdmin || isAdmin),
      manage_stations: currentPerms?.manage_stations ?? (isSystemAdmin || isAdmin),
      manage_roles: currentPerms?.manage_roles ?? (isSystemAdmin || isAdmin),
      manage_settings: currentPerms?.manage_settings ?? (isSystemAdmin || isAdmin),
      settle_voucher: (isAdmin || isSystemAdmin) ? false : (currentPerms?.settle_voucher ?? (isSystemAdmin || isStation)),
    };
  }

  static getUsers(): AppUser[] {
    let users = StorageEngine.getStored<AppUser[]>('users', DEFAULT_USERS);
    
    // Safety fallback: Ensure any SystemAdmin from DEFAULT_USERS is never missing from the returned list
    const adminEmails = ['alaaabusalah96@gmail.com', 'alaabusalah96@gmail.com'];
    const defaultAdmins = DEFAULT_USERS.filter(u => u.email && adminEmails.includes(u.email.toLowerCase().trim()));
    let hasAddedMissingAdmin = false;
    
    defaultAdmins.forEach(defAdmin => {
      const exists = users.some(u => u.email && u.email.toLowerCase().trim() === defAdmin.email.toLowerCase().trim());
      if (!exists) {
        users = [...users, defAdmin];
        hasAddedMissingAdmin = true;
      }
    });

    if (hasAddedMissingAdmin) {
      StorageEngine.setStored('users', users);
    }

    let changed = false;
    const updated = users.map(u => {
      const isPlatformAdminEmail = u.email && (
        u.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || 
        u.email.toLowerCase().trim() === 'alaabusalah96@gmail.com'
      );
      const role = isPlatformAdminEmail ? ('SystemAdmin' as const) : u.role;
      const is_active = isPlatformAdminEmail ? true : (u.is_active ?? true);
      
      if (role !== u.role || is_active !== u.is_active) {
        changed = true;
      }
      return {
        ...u,
        role,
        is_active,
        permissions: UsersModule.enrichUserPermissions(role, u.permissions)
      };
    });

    if (changed) {
      setTimeout(() => {
        try {
          UsersModule.saveUsers(updated);
        } catch (e) {
          console.error('Error auto-promoting user in database:', e);
        }
      }, 100);
    }
    return updated;
  }

  static getActiveUser(): AppUser | null {
    if (StorageEngine.cache['active_user'] !== undefined) {
      return StorageEngine.cache['active_user'];
    }
    const userStr = localStorage.getItem('custody_active_user');
    if (!userStr) {
      StorageEngine.cache['active_user'] = null;
      return null;
    }
    const parsed = JSON.parse(userStr);
    if (parsed) {
      const isPlatformAdminEmail = parsed.email && (
        parsed.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || 
        parsed.email.toLowerCase().trim() === 'alaabusalah96@gmail.com'
      );
      if (isPlatformAdminEmail && (parsed.role !== 'SystemAdmin' || !parsed.is_active)) {
        const updated = {
          ...parsed,
          role: 'SystemAdmin' as const,
          is_active: true,
          permissions: UsersModule.enrichUserPermissions('SystemAdmin')
        };
        localStorage.setItem('custody_active_user', JSON.stringify(updated));
        StorageEngine.cache['active_user'] = updated;
        return updated;
      }
      parsed.permissions = UsersModule.enrichUserPermissions(parsed.role, parsed.permissions);
      StorageEngine.cache['active_user'] = parsed;
      return parsed as AppUser;
    }
    StorageEngine.cache['active_user'] = null;
    return null;
  }

  static setActiveUser(user: AppUser | null): void {
    if (user) {
      StorageEngine.cache['active_user'] = user;
      localStorage.setItem('custody_active_user', JSON.stringify(user));
      LogsModule.addLog(user.id, user.full_name, 'Login Session', `User logged in with role ${user.role}.`);
      LogsModule.logAudit('USER_LOGIN', `User ${user.full_name} logged in with role ${user.role}.`, {
        after: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
      });
    } else {
      const current = UsersModule.getActiveUser();
      if (current) {
        LogsModule.addLog(current.id, current.full_name, 'Logout Session', 'User signed out of system.');
        LogsModule.logAudit('USER_LOGOUT', `User ${current.full_name} logged out of the system.`, {
          before: { id: current.id, full_name: current.full_name, email: current.email, role: current.role }
        });
      }
      StorageEngine.cache['active_user'] = null;
      localStorage.removeItem('custody_active_user');
    }
  }

  static saveUsers(users: AppUser[]): void {
    const enriched = users.map(u => {
      let pwd = u.password || '';
      const isHashed = /^[0-9a-f]{64}$/i.test(pwd);
      if (pwd && !isHashed) {
        pwd = hashPassword(pwd);
      }
      return {
        ...u,
        password: pwd,
        permissions: UsersModule.enrichUserPermissions(u.role, u.permissions)
      };
    });
    StorageEngine.setStored('users', enriched);
    enriched.forEach(u => dbSetDoc('users', u.id, u));
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Users', 'Modified user roles and system permission profiles.');
  }

  static getScopedUsers(): AppUser[] {
    const users = UsersModule.getUsers();
    const activeUser = UsersModule.getActiveUser();
    if (!activeUser) return users;
    
    const savedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('custody_selected_company_id') : null;
    const targetCompanyId = activeUser.role !== 'SystemAdmin' && activeUser.company_id ? activeUser.company_id : (savedCompanyId || 'comp-1');

    if (activeUser.role === 'SystemAdmin') {
      return users.filter(u => u.role === 'SystemAdmin' || u.company_id === targetCompanyId);
    }
    return users.filter(u => u.company_id === activeUser.company_id);
  }

  static impersonateUser(targetUser: AppUser, reason?: string): void {
    const activeUser = UsersModule.getActiveUser();
    if (!activeUser || (activeUser.role !== 'SystemAdmin' && !activeUser.impersonator)) {
      throw new Error('Only a SystemAdmin can impersonate users.');
    }
    
    const superAdmin = activeUser.impersonator || activeUser;
    const companies = StorageEngine.getStored<any[]>('companies', []);
    const company = companies.find(c => c.id === targetUser.company_id);
    const companyName = company ? company.name : 'Unknown';

    const impersonatedUser: AppUser = {
      ...targetUser,
      impersonator: superAdmin
    };

    localStorage.setItem('custody_active_user', JSON.stringify(impersonatedUser));

    LogsModule.addLog(superAdmin.id, superAdmin.full_name, 'Impersonation Start', `Super Admin began impersonating ${targetUser.full_name} (${companyName})`);
    LogsModule.logAudit('IMPERSONATION_START', `Super Admin ${superAdmin.full_name} entered technical support session as ${targetUser.full_name} (${companyName})`, {
      impersonator_id: superAdmin.id,
      impersonator_name: superAdmin.full_name,
      company_id: targetUser.company_id || 'none',
      company_name: companyName,
      target_user_id: targetUser.id,
      target_user_name: targetUser.full_name,
      reason: reason || 'Technical Support / الدعم الفني',
      login_time: new Date().toISOString()
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  }

  static exitImpersonation(): void {
    const activeUser = UsersModule.getActiveUser();
    if (!activeUser || !activeUser.impersonator) {
      throw new Error('No active impersonation session found.');
    }

    const superAdmin = activeUser.impersonator;
    const companies = StorageEngine.getStored<any[]>('companies', []);
    const company = companies.find(c => c.id === activeUser.company_id);
    const companyName = company ? company.name : 'Unknown';

    localStorage.setItem('custody_active_user', JSON.stringify(superAdmin));

    LogsModule.addLog(superAdmin.id, superAdmin.full_name, 'Impersonation End', `Super Admin ended impersonating ${activeUser.full_name}`);
    LogsModule.logAudit('IMPERSONATION_END', `Super Admin ${superAdmin.full_name} exited technical support session for ${activeUser.full_name} (${companyName})`, {
      impersonator_id: superAdmin.id,
      impersonator_name: superAdmin.full_name,
      company_id: activeUser.company_id || 'none',
      company_name: companyName,
      target_user_id: activeUser.id,
      target_user_name: activeUser.full_name,
      logout_time: new Date().toISOString()
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  }

  static resetUserPassword(userId: string, newPasswordPlain: string): void {
    const users = UsersModule.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      const hashed = hashPassword(newPasswordPlain);
      users[idx] = { ...users[idx], password: hashed };
      UsersModule.saveUsers(users);
      
      const activeUser = UsersModule.getActiveUser();
      const superAdmin = activeUser?.impersonator || activeUser;
      LogsModule.addLog(superAdmin?.id || 'system', superAdmin?.full_name || 'System', 'Reset Password', `Reset password for user ${users[idx].full_name}`);
      LogsModule.logAudit('PASSWORD_RESET', `Super Admin reset password for ${users[idx].full_name}`, {
        target_user_id: userId,
        target_user_name: users[idx].full_name
      });
    }
  }

  static getPermissions(): SystemPermission[] {
    return StorageEngine.getStored<SystemPermission[]>('Permissions', DEFAULT_PERMISSIONS);
  }

  static savePermission(permission: SystemPermission): void {
    const permissions = UsersModule.getPermissions();
    const index = permissions.findIndex(p => p.id === permission.id);
    if (index > -1) {
      permissions[index] = permission;
    } else {
      permissions.push(permission);
    }
    StorageEngine.setStored('Permissions', permissions);
    dbSetDoc('Permissions', permission.id, permission);
  }

  static getRoles(): SystemRole[] {
    return StorageEngine.getStored<SystemRole[]>('Roles', DEFAULT_ROLES);
  }

  static saveRole(role: SystemRole): void {
    const roles = UsersModule.getRoles();
    const index = roles.findIndex(r => r.id === role.id);
    if (index > -1) {
      roles[index] = role;
    } else {
      roles.push(role);
    }
    StorageEngine.setStored('Roles', roles);
    dbSetDoc('Roles', role.id, role);
  }

  static getSignupRequests(): SignupRequest[] {
    return StorageEngine.getStored<SignupRequest[]>('signup_requests', []);
  }

  static saveSignupRequest(request: SignupRequest): void {
    const requests = UsersModule.getSignupRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index > -1) {
      requests[index] = request;
    } else {
      requests.unshift(request);
    }
    StorageEngine.setStored('signup_requests', requests);
    dbSetDoc('signup_requests', request.id, request);
  }

  static deleteSignupRequest(id: string): void {
    const requests = UsersModule.getSignupRequests();
    const filtered = requests.filter(r => r.id !== id);
    StorageEngine.setStored('signup_requests', filtered);
    dbDeleteDoc('signup_requests', id);
  }

  static upsertLocalUser(user: AppUser): void {
    const users = StorageEngine.getStored<AppUser[]>('users', DEFAULT_USERS);
    const index = users.findIndex(u => u.id === user.id || (u.email && user.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
    
    const enrichedUser = {
      ...user,
      permissions: UsersModule.enrichUserPermissions(user.role, user.permissions)
    };

    let updated: AppUser[];
    if (index > -1) {
      updated = [...users];
      updated[index] = { ...updated[index], ...enrichedUser };
    } else {
      updated = [...users, enrichedUser];
    }
    
    StorageEngine.setStored('users', updated);
  }
}
