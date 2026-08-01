import { AppUser, UserRole, UserPermissions, SystemPermission, SystemRole, SignupRequest, AccountCorrectionRequest } from '../types';
import { dbSetDoc, dbDeleteDoc, auth } from '../firebase';
import { StorageEngine } from './storage';
import { syncWriteWithOfflineFallback } from './offlineQueue';
import { DEFAULT_USERS, DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './defaults';
import { LogsModule } from './logs';
import { hashPassword, legacyStretchedHashPassword1000, legacySinglePassHashPassword, legacyHashPassword } from '../lib/hash';
import { OrganizationEngine } from './organizationEngine';

export class UsersModule {
  private static hasAutoPromotedInSession = false;

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
      const allowDefaultAdminPassword = process.env.STRICT_PROD_SECURITY !== 'true' || (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV);
      const password = (isPlatformAdminEmail && (!u.password || u.password.trim() === ''))
        ? (allowDefaultAdminPassword ? '123456' : '')
        : u.password;
      
      const currentRole = u.role;
      const currentIsActive = u.is_active ?? true;
      const currentIsOwner = u.is_platform_owner ?? false;
      const currentPassword = u.password || '';
      if (role !== currentRole || is_active !== currentIsActive || is_platform_owner !== currentIsOwner || (password || '') !== currentPassword) {
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
      StorageEngine.setStored('users', updated);
      if (!UsersModule.hasAutoPromotedInSession) {
        UsersModule.hasAutoPromotedInSession = true;
        setTimeout(async () => {
          try {
            await UsersModule.saveUsers(updated);
          } catch (e) {
            console.warn('Error auto-promoting user in database (deferred):', e);
            UsersModule.hasAutoPromotedInSession = false;
          }
        }, 300);
      }
    }
    return updated;
  }

  static getActiveUser(): AppUser | null {
    if (StorageEngine.cache['active_user'] !== undefined && StorageEngine.cache['active_user'] !== null) {
      const cached = StorageEngine.cache['active_user'];
      cached.permissions = UsersModule.enrichUserPermissions(cached.role, cached.permissions);
      return cached;
    }
    if (StorageEngine.cache['active_user'] === null) {
      return null;
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
      const enrichedUser: AppUser = {
        ...user,
        permissions: UsersModule.enrichUserPermissions(user.role, user.permissions)
      };
      StorageEngine.cache['active_user'] = enrichedUser;
      localStorage.setItem('custody_active_user', JSON.stringify(enrichedUser));
      LogsModule.addLog(enrichedUser.id, enrichedUser.full_name, 'Login Session', `User logged in with role ${enrichedUser.role}.`);
      LogsModule.logAudit('USER_LOGIN', `User ${enrichedUser.full_name} logged in with role ${enrichedUser.role}.`, {
        after: { id: enrichedUser.id, full_name: enrichedUser.full_name, email: enrichedUser.email, role: enrichedUser.role }
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

  static verifyUserPassword(email: string, passwordPlain: string): AppUser | null {
    const emailLower = email.toLowerCase().trim();
    const users = UsersModule.getUsers();
    const foundUser = users.find(u => u.email?.toLowerCase().trim() === emailLower);
    if (!foundUser) return null;

    const storedPassword = foundUser.password || '';
    const userSalt = foundUser.salt || emailLower;
    const hash10k = hashPassword(passwordPlain, userSalt);
    const hash1k = legacyStretchedHashPassword1000(passwordPlain, userSalt);
    const hashSingle = legacySinglePassHashPassword(passwordPlain, userSalt);
    const legacy = legacyHashPassword(passwordPlain, userSalt);

    if (
      storedPassword === hash10k ||
      storedPassword === hash1k ||
      storedPassword === hashSingle ||
      storedPassword === legacy ||
      storedPassword === passwordPlain
    ) {
      return foundUser;
    }
    return null;
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

    // 1. Always store to local StorageEngine first before any network/Firestore write attempts
    StorageEngine.setStored('users', enriched);

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
        console.warn(`[saveUsers] Warning: ${userSyncRes.error || `فشل حفظ بيانات المستخدم ${u.full_name || u.id} في قاعدة البيانات.`}`);
        return;
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
            console.warn(`[saveUsers] Warning: ${credsSyncRes.error || `فشل حفظ بيانات اعتماد المستخدم ${u.full_name || u.id} في قاعدة البيانات.`}`);
          }
        }
      }
    }

    const user = UsersModule.getActiveUser();
    LogsModule.addLog(user?.id || 'system', user?.full_name || 'System', 'Update Users', 'Modified user roles and system permission profiles.');
  }

  static getScopedUsers(): AppUser[] {
    const users = UsersModule.getUsers();
    const activeUser = UsersModule.getActiveUser();
    if (!activeUser) return [];
    
    const savedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('custody_selected_company_id') : null;
    const targetCompanyId = activeUser.role === 'SystemAdmin' 
      ? (savedCompanyId || activeUser.company_id || '')
      : activeUser.company_id;

    if (activeUser.role === 'SystemAdmin') {
      return users.filter(u => u.role === 'SystemAdmin' || (targetCompanyId ? u.company_id === targetCompanyId : true));
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

  /**
   * Validates per-organization-unit account headcount ceiling before signup request submission.
   * Enforces the rule that an organization unit cannot exceed its max_accounts_allowed (default 1, max 5).
   */
  static validateSignupRequestHeadcount(request: {
    org_unit_id?: string;
    station_id?: string;
    region_id?: string;
    company_id?: string;
    role?: string;
  }): {
    allowed: boolean;
    messageAr?: string;
    messageEn?: string;
    currentCount: number;
    maxAllowed: number;
    unit?: any;
  } {
    const unit = OrganizationEngine.resolveOrgUnitForEntity(request, request.company_id);

    if (!unit) {
      return { allowed: true, currentCount: 0, maxAllowed: 1 };
    }

    const headcount = OrganizationEngine.getUnitAccountHeadcount(unit.id);

    if (headcount.activeAccountsCount >= headcount.maxAllowed) {
      return {
        allowed: false,
        currentCount: headcount.activeAccountsCount,
        maxAllowed: headcount.maxAllowed,
        unit,
        messageAr: `عذراً، لقد وصلت هذه الوحدة التنظيمية ("${unit.nameAr || unit.name}") إلى الحد الأقصى المسموح به لعدد الحسابات (${headcount.maxAllowed}). يرجى الطلب من المسؤول في المستوى التنظيمي الأعلى رفع الحد أولاً.`,
        messageEn: `This organization unit ("${unit.nameEn || unit.name}") has reached its maximum allowed number of accounts (${headcount.maxAllowed}). Please ask the administrator at the organizational level above to increase the limit first.`
      };
    }

    return {
      allowed: true,
      currentCount: headcount.activeAccountsCount,
      maxAllowed: headcount.maxAllowed,
      unit
    };
  }

  static async saveSignupRequest(request: SignupRequest): Promise<void> {
    const requests = UsersModule.getSignupRequests();
    const isExisting = requests.some(r => r.id === request.id);
    if (!isExisting && request.status === 'Pending') {
      const validation = UsersModule.validateSignupRequestHeadcount(request);
      if (!validation.allowed) {
        throw new Error(validation.messageEn || 'Headcount limit reached for this organization unit.');
      }
    }

    // 1. Save locally first (local-first)
    const index = requests.findIndex(r => r.id === request.id);
    if (index > -1) {
      requests[index] = request;
    } else {
      requests.unshift(request);
    }
    StorageEngine.setStored('signup_requests', requests);

    // 2. Sync to Firestore without throwing on failure
    try {
      const syncRes = await syncWriteWithOfflineFallback('signup_requests', request.id, request);
      if (!syncRes.success) {
        console.warn(`[saveSignupRequest] Cloud sync deferred/warning: ${syncRes.error}`);
      }
    } catch (err: any) {
      console.warn('[saveSignupRequest] Firestore sync failed, saved locally:', err?.message || err);
    }
  }

  static async deleteSignupRequest(id: string): Promise<void> {
    // 1. Update local storage first (local-first)
    const requests = UsersModule.getSignupRequests();
    const filtered = requests.filter(r => r.id !== id);
    StorageEngine.setStored('signup_requests', filtered);

    // 2. Sync deletion to Firestore without throwing on failure
    try {
      const syncRes = await syncWriteWithOfflineFallback('signup_requests', id, null);
      if (!syncRes.success) {
        console.warn(`[deleteSignupRequest] Cloud delete deferred/warning: ${syncRes.error}`);
      }
    } catch (err: any) {
      console.warn('[deleteSignupRequest] Firestore delete failed, deleted locally:', err?.message || err);
    }
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

  static getAccountCorrectionRequests(): AccountCorrectionRequest[] {
    return StorageEngine.getStored<AccountCorrectionRequest[]>('account_correction_requests', []);
  }

  static async saveAccountCorrectionRequest(request: AccountCorrectionRequest): Promise<void> {
    const requests = UsersModule.getAccountCorrectionRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index > -1) {
      requests[index] = request;
    } else {
      requests.unshift(request);
    }
    StorageEngine.setStored('account_correction_requests', requests);

    try {
      const syncRes = await syncWriteWithOfflineFallback('account_correction_requests', request.id, request);
      if (!syncRes.success) {
        console.warn(`[saveAccountCorrectionRequest] Cloud sync deferred/warning: ${syncRes.error}`);
      }
    } catch (err: any) {
      console.warn('[saveAccountCorrectionRequest] Firestore sync failed, saved locally:', err?.message || err);
    }
  }

  static async deleteAccountCorrectionRequest(id: string): Promise<void> {
    const requests = UsersModule.getAccountCorrectionRequests();
    const filtered = requests.filter(r => r.id !== id);
    StorageEngine.setStored('account_correction_requests', filtered);

    try {
      const syncRes = await syncWriteWithOfflineFallback('account_correction_requests', id, null);
      if (!syncRes.success) {
        console.warn(`[deleteAccountCorrectionRequest] Cloud delete deferred/warning: ${syncRes.error}`);
      }
    } catch (err: any) {
      console.warn('[deleteAccountCorrectionRequest] Firestore delete failed, deleted locally:', err?.message || err);
    }
  }

  static async approveAccountCorrectionRequest(
    id: string,
    updates: {
      newEmail?: string;
      newFullName?: string;
      newPasswordPlain?: string;
      approvedBy?: string;
    }
  ): Promise<{ success: boolean; messageAr: string; messageEn: string }> {
    const requests = UsersModule.getAccountCorrectionRequests();
    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return { success: false, messageAr: 'طلب التعديل غير موجود', messageEn: 'Correction request not found' };
    }

    const request = requests[reqIndex];
    const users = UsersModule.getUsers();
    const userIndex = users.findIndex(u =>
      (request.targetUserId && u.id === request.targetUserId) ||
      (u.email && u.email.toLowerCase().trim() === request.targetEmail.toLowerCase().trim())
    );

    if (userIndex === -1) {
      return {
        success: false,
        messageAr: 'الحساب المستهدف غير موجود في قائمة المستخدمين',
        messageEn: 'Target account not found in active users list'
      };
    }

    const targetUser = { ...users[userIndex] };
    const oldEmail = targetUser.email;
    const oldName = targetUser.full_name;

    if (updates.newEmail && updates.newEmail.trim()) {
      targetUser.email = updates.newEmail.toLowerCase().trim();
    }
    if (updates.newFullName && updates.newFullName.trim()) {
      targetUser.full_name = updates.newFullName.trim();
    }
    if (updates.newPasswordPlain && updates.newPasswordPlain.trim()) {
      const salt = targetUser.salt || targetUser.email || oldEmail;
      const hashed = hashPassword(updates.newPasswordPlain, salt);
      targetUser.password = hashed;
      targetUser.salt = salt;
    }

    users[userIndex] = targetUser;
    await UsersModule.saveUsers(users);

    const updatedReq: AccountCorrectionRequest = {
      ...request,
      status: 'Approved',
      approved_at: new Date().toISOString(),
      approved_by: updates.approvedBy || 'Admin'
    };
    await UsersModule.saveAccountCorrectionRequest(updatedReq);

    LogsModule.logAudit(
      'APPROVE_ACCOUNT_CORRECTION',
      `Approved correction for user ${oldName} (${oldEmail}) -> ${targetUser.full_name} (${targetUser.email})`,
      {
        company_id: request.company_id,
        request_id: id,
        target_user_id: targetUser.id,
        old_email: oldEmail,
        new_email: targetUser.email,
        old_name: oldName,
        new_name: targetUser.full_name,
        password_reset: !!(updates.newPasswordPlain && updates.newPasswordPlain.trim())
      }
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }

    return {
      success: true,
      messageAr: 'تم اعتماد التعديل وتحديث بيانات الحساب بنجاح',
      messageEn: 'Account correction approved and user data updated successfully'
    };
  }

  static async rejectAccountCorrectionRequest(
    id: string,
    rejectionReason: string,
    rejectedBy?: string
  ): Promise<{ success: boolean; messageAr: string; messageEn: string }> {
    const requests = UsersModule.getAccountCorrectionRequests();
    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return { success: false, messageAr: 'طلب التعديل غير موجود', messageEn: 'Correction request not found' };
    }

    const request = requests[reqIndex];
    const updatedReq: AccountCorrectionRequest = {
      ...request,
      status: 'Rejected',
      rejection_reason: rejectionReason,
      approved_at: new Date().toISOString(),
      approved_by: rejectedBy || 'Admin'
    };
    await UsersModule.saveAccountCorrectionRequest(updatedReq);

    LogsModule.logAudit(
      'REJECT_ACCOUNT_CORRECTION',
      `Rejected correction request for user ${request.targetUserName} (${request.targetEmail}). Reason: ${rejectionReason}`,
      {
        company_id: request.company_id,
        request_id: id,
        target_email: request.targetEmail,
        rejection_reason: rejectionReason
      }
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }

    return {
      success: true,
      messageAr: 'تم رفض طلب تعديل الحساب',
      messageEn: 'Account correction request rejected'
    };
  }
}
