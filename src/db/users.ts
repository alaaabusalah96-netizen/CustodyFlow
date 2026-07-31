import { AppUser, UserRole, UserPermissions, SystemPermission, SystemRole, SignupRequest } from '../types';
import { dbSetDoc, dbDeleteDoc, auth } from '../firebase';
import { StorageEngine } from './storage';
import { syncWriteWithOfflineFallback } from './offlineQueue';
import { DEFAULT_USERS, DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './defaults';
import { LogsModule } from './logs';
import { hashPassword } from '../lib/hash';

export class UsersModule {
  static isPlatformOwner(email?: string | null): boolean {
    if (!email || typeof email !== 'string') return false;
    const cleaned = email.toLowerCase().trim();

    // 1. Check DEFAULT_USERS first for any built-in platform owner or SystemAdmin record
    const isDefaultAdmin = DEFAULT_USERS.some(u => 
      (u.is_platform_owner === true || u.role === 'SystemAdmin') && 
      u.email && 
      u.email.toLowerCase().trim() === cleaned
    );
    if (isDefaultAdmin) {
      return true;
    }

    // 2. Check local storage / memory cached users
    const users = StorageEngine.getStored<AppUser[]>('users', []);
    if (users && users.length > 0) {
      const match = users.find(u => u.email && u.email.toLowerCase().trim() === cleaned);
      if (match) {
        return match.is_platform_owner === true || match.role === 'SystemAdmin';
      }
    }

    return false;
  }

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
    
    // Safety fallback: Ensure any DEFAULT_USERS (especially SystemAdmins/Platform Owners) are present and have default passwords if missing
    let hasAddedMissingAdmin = false;
    
    DEFAULT_USERS.forEach(defUser => {
      const existingIdx = users.findIndex(u => u.email && defUser.email && u.email.toLowerCase().trim() === defUser.email.toLowerCase().trim());
      if (existingIdx === -1) {
        users = [...users, defUser];
        hasAddedMissingAdmin = true;
      } else if (!users[existingIdx].password && defUser.password) {
        const updatedUser = { ...users[existingIdx], password: defUser.password };
        const newUsers = [...users];
        newUsers[existingIdx] = updatedUser;
        users = newUsers;
        hasAddedMissingAdmin = true;
      }
    });

    if (hasAddedMissingAdmin) {
      StorageEngine.setStored('users', users);
    }

    let changed = false;
    const updated = users.map(u => {
      const isPlatformAdminEmail = u.email && UsersModule.isPlatformOwner(u.email);
      const role = isPlatformAdminEmail ? ('SystemAdmin' as const) : u.role;
      const is_active = isPlatformAdminEmail ? true : (u.is_active ?? true);
      const is_platform_owner = isPlatformAdminEmail ? true : (u.is_platform_owner ?? false);
      const password = (isPlatformAdminEmail && (!u.password || u.password.trim() === '')) ? '123456' : u.password;
      
      if (role !== u.role || is_active !== u.is_active || is_platform_owner !== u.is_platform_owner || password !== u.password) {
        changed = true;
      }
      return {
        ...u,
        role,
        is_active,
        is_platform_owner,
        password,
        permissions: UsersModule.enrichUserPermissions(role, u.permissions)
      };
    });

    if (changed) {
      setTimeout(async () => {
        try {
          await UsersModule.saveUsers(updated);
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
    let userStr: string | null = null;
    try {
      if (typeof localStorage !== 'undefined') {
        userStr = localStorage.getItem('custody_active_user');
      }
    } catch {
      userStr = null;
    }
    if (!userStr) {
      StorageEngine.cache['active_user'] = null;
      return null;
    }
    const parsed = JSON.parse(userStr);
    if (parsed) {
      const isPlatformAdminEmail = parsed.email && UsersModule.isPlatformOwner(parsed.email);
      if (isPlatformAdminEmail && (parsed.role !== 'SystemAdmin' || !parsed.is_active || !parsed.is_platform_owner)) {
        const updated = {
          ...parsed,
          role: 'SystemAdmin' as const,
          is_active: true,
          is_platform_owner: true,
          permissions: UsersModule.enrichUserPermissions('SystemAdmin')
        };
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('custody_active_user', JSON.stringify(updated));
          }
        } catch {
          // ignore quota error in tests
        }
        StorageEngine.cache['active_user'] = updated;
        return updated;
      }
      parsed.permissions = UsersModule.enrichUserPermissions(parsed.role, parsed.permissions);
      if (isPlatformAdminEmail) {
        parsed.is_platform_owner = true;
      }
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

  static async saveUsers(users: AppUser[]): Promise<void> {
    const existing = StorageEngine.getStored<AppUser[]>('users', []);
    const enriched = users.map(u => {
      let pwd = u.password || '';
      const oldUser = existing.find(ex => ex.id === u.id);
      if (pwd === 'REDACTED' && oldUser) {
        pwd = oldUser.password || '';
      }
      const salt = u.salt || oldUser?.salt || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : u.email);
      const isHashed = /^[0-9a-f]{64}$/i.test(pwd);
      if (pwd && pwd !== 'REDACTED' && !isHashed) {
        pwd = hashPassword(pwd, salt);
      }
      return {
        ...u,
        salt,
        password: pwd,
        permissions: UsersModule.enrichUserPermissions(u.role, u.permissions)
      };
    });

    // Highly Optimized: Identify and isolate only users that actually changed or are new
    const changedUsers = enriched.filter(u => {
      const old = existing.find(ex => ex.id === u.id);
      if (!old) return true; // New user
      return JSON.stringify(old) !== JSON.stringify(u); // Diff check
    });

    // Strictly write only sanitized user profiles to 'users' and private credentials to 'user_credentials'
    for (const u of changedUsers) {
      // 1. Write public profile to 'users' collection WITHOUT password or salt
      const { password, salt, ...publicUser } = u;
      const userSyncRes = await syncWriteWithOfflineFallback('users', u.id, publicUser);
      if (!userSyncRes.success) {
        throw new Error(userSyncRes.error || `فشل حفظ بيانات المستخدم ${u.full_name || u.id} في قاعدة البيانات.`);
      }

      // 2. Write private authentication credentials to restricted 'user_credentials' vault via Server Admin API or direct sync
      if (password && password !== 'REDACTED') {
        let credsSaved = false;
        if (typeof window !== 'undefined' && window.location) {
          try {
            const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            const resp = await fetch('/api/auth/save-credentials', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                userId: u.id,
                companyId: u.company_id,
                email: u.email,
                password: password,
                salt: salt
              })
            });
            if (resp.ok) {
              credsSaved = true;
            }
          } catch (apiErr) {
            // Fallback to direct sync
          }
        }
        if (!credsSaved) {
          const credsSyncRes = await syncWriteWithOfflineFallback('user_credentials', u.id, {
            id: u.id,
            company_id: u.company_id,
            email: u.email,
            password: password,
            salt: salt,
            pepper_version: 2,
            updated_at: new Date().toISOString()
          });
          if (!credsSyncRes.success) {
            throw new Error(credsSyncRes.error || `فشل حفظ بيانات اعتماد المستخدم ${u.full_name || u.id} في قاعدة البيانات.`);
          }
        }
      }
    }

    StorageEngine.setStored('users', enriched);

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Users', 'Modified user roles and system permission profiles.');
  }

  static getScopedUsers(): AppUser[] {
    const users = UsersModule.getUsers();
    const activeUser = UsersModule.getActiveUser();
    if (!activeUser) return [];
    
    const savedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('custody_selected_company_id') : null;
    const targetCompanyId = activeUser.role === 'SystemAdmin' 
      ? (savedCompanyId || 'comp-1')
      : activeUser.company_id;

    if (activeUser.role === 'SystemAdmin') {
      return users.filter(u => u.role === 'SystemAdmin' || u.company_id === targetCompanyId);
    }
    
    let filtered = users.filter(u => u.company_id === activeUser.company_id);
    
    if (activeUser.role === 'RegionalManager') {
      if (activeUser.region_id) {
        const stations = StorageEngine.getStored<any[]>('stations', []);
        const regionStationIds = stations.filter(s => s.region_id === activeUser.region_id).map(s => s.id);
        filtered = filtered.filter(u => u.region_id === activeUser.region_id || (u.station_id && regionStationIds.includes(u.station_id)) || u.id === activeUser.id);
      }
    } else if (activeUser.role === 'StationAdmin') {
      if (activeUser.station_id) {
        filtered = filtered.filter(u => u.station_id === activeUser.station_id || u.id === activeUser.id);
      } else {
        filtered = filtered.filter(u => u.id === activeUser.id);
      }
    }
    
    return filtered;
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

  static async resetUserPassword(userId: string, newPasswordPlain: string): Promise<void> {
    const users = UsersModule.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      const targetUser = users[idx];
      const salt = targetUser.salt || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : targetUser.email);
      const hashed = hashPassword(newPasswordPlain, salt);
      users[idx] = { ...users[idx], salt, password: hashed };
      await UsersModule.saveUsers(users);
      
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

  static async savePermission(permission: SystemPermission): Promise<void> {
    const syncRes = await syncWriteWithOfflineFallback('Permissions', permission.id, permission);
    if (!syncRes.success) {
      throw new Error(syncRes.error || `فشل حفظ الصلاحيات في قاعدة البيانات.`);
    }
    const permissions = UsersModule.getPermissions();
    const index = permissions.findIndex(p => p.id === permission.id);
    if (index > -1) {
      permissions[index] = permission;
    } else {
      permissions.push(permission);
    }
    StorageEngine.setStored('Permissions', permissions);
  }

  static getRoles(): SystemRole[] {
    return StorageEngine.getStored<SystemRole[]>('Roles', DEFAULT_ROLES);
  }

  static async saveRole(role: SystemRole): Promise<void> {
    const syncRes = await syncWriteWithOfflineFallback('Roles', role.id, role);
    if (!syncRes.success) {
      throw new Error(syncRes.error || `فشل حفظ الدور في قاعدة البيانات.`);
    }
    const roles = UsersModule.getRoles();
    const index = roles.findIndex(r => r.id === role.id);
    if (index > -1) {
      roles[index] = role;
    } else {
      roles.push(role);
    }
    StorageEngine.setStored('Roles', roles);
  }

  static getSignupRequests(): SignupRequest[] {
    return StorageEngine.getStored<SignupRequest[]>('signup_requests', []);
  }

  static async saveSignupRequest(request: SignupRequest): Promise<void> {
    const syncRes = await syncWriteWithOfflineFallback('signup_requests', request.id, request);
    if (!syncRes.success) {
      throw new Error(syncRes.error || `فشل حفظ طلب التسجيل في قاعدة البيانات.`);
    }
    const requests = UsersModule.getSignupRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index > -1) {
      requests[index] = request;
    } else {
      requests.unshift(request);
    }
    StorageEngine.setStored('signup_requests', requests);
  }

  static async deleteSignupRequest(id: string): Promise<void> {
    const syncRes = await syncWriteWithOfflineFallback('signup_requests', id, null);
    if (!syncRes.success) {
      throw new Error(syncRes.error || `فشل حذف طلب التسجيل من قاعدة البيانات.`);
    }
    const requests = UsersModule.getSignupRequests();
    const filtered = requests.filter(r => r.id !== id);
    StorageEngine.setStored('signup_requests', filtered);
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
