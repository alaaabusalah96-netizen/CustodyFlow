import { BusinessGroup } from '../types';
import { dbSetDoc } from '../firebase';
import { StorageEngine } from './storage';
import { syncWriteWithOfflineFallback } from './offlineQueue';
import { UsersModule } from './users';
import { LogsModule } from './logs';

export class BusinessGroupsModule {
  static getGroups(): BusinessGroup[] {
    return StorageEngine.getStored<BusinessGroup[]>('business_groups', []);
  }

  static saveGroups(groups: BusinessGroup[]): void {
    StorageEngine.setStored('business_groups', groups);
    groups.forEach(g => syncWriteWithOfflineFallback('business_groups', g.id, g).catch(() => {}));
  }

  static addGroup(code: string, nameAr: string, nameEn: string): BusinessGroup {
    const groups = BusinessGroupsModule.getGroups();
    const newGroup: BusinessGroup = {
      id: `bg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // FIX: avoid id collisions under concurrent creation
      code,
      nameAr,
      nameEn,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    groups.push(newGroup);
    BusinessGroupsModule.saveGroups(groups);
    
    const user = UsersModule.getActiveUser();
    LogsModule.addLog(
      user?.id || 'system', 
      user?.full_name || 'System', 
      'Add Business Group', 
      `Created new business group: ${nameEn} (${code})`
    );
    LogsModule.logAudit('BUSINESS_GROUP_CREATE', `User created business group ${nameEn} with code ${code}`, {
      group_id: newGroup.id,
      code,
      nameAr,
      nameEn
    });
    return newGroup;
  }

  static updateGroup(id: string, updates: Partial<BusinessGroup>): void {
    const groups = BusinessGroupsModule.getGroups();
    const idx = groups.findIndex(g => g.id === id);
    if (idx !== -1) {
      const original = groups[idx];
      groups[idx] = { 
        ...original, 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      BusinessGroupsModule.saveGroups(groups);
      
      const user = UsersModule.getActiveUser();
      LogsModule.addLog(
        user?.id || 'system', 
        user?.full_name || 'System', 
        'Update Business Group', 
        `Modified business group: ${groups[idx].nameEn}`
      );
      LogsModule.logAudit('BUSINESS_GROUP_UPDATE', `User updated business group ${groups[idx].nameEn}`, {
        group_id: id,
        updates
      });
    }
  }

  static toggleGroupStatus(groupId: string, isActive: boolean): void {
    const groups = BusinessGroupsModule.getGroups();
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx !== -1) {
      const newStatus: BusinessGroup['status'] = isActive ? 'ACTIVE' : 'INACTIVE';
      groups[idx] = { 
        ...groups[idx], 
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      BusinessGroupsModule.saveGroups(groups);
      
      const activeUser = UsersModule.getActiveUser();
      const operator = activeUser?.impersonator || activeUser;
      const statusStr = isActive ? 'Activated' : 'Suspended';
      LogsModule.addLog(
        operator?.id || 'system', 
        operator?.full_name || 'System', 
        'Toggle Business Group Status', 
        `${statusStr} business group ${groups[idx].nameEn}`
      );
      LogsModule.logAudit('BUSINESS_GROUP_STATUS_TOGGLE', `User changed business group ${groups[idx].nameEn} status to ${newStatus}`, {
        group_id: groupId,
        nameEn: groups[idx].nameEn,
        status: newStatus
      });
    }
  }
}
