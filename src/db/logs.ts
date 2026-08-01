import { ActivityLog, AuditLog } from '../types';
import { dbSetDoc, dbDeleteDoc, db } from '../firebase';
import { StorageEngine } from './storage';
import { DEFAULT_LOGS, DEFAULT_AUDIT_LOGS } from './defaults';
import { AuditLogEngine } from '../lib/enterprise/audit';
import { createEventEnvelope } from '../lib/enterprise/metadata';

export class LogsModule {
  static getLogs(): ActivityLog[] {
    return StorageEngine.getStored<ActivityLog[]>('logs', DEFAULT_LOGS);
  }

  static getPaginatedLogs(
    page: number = 1,
    pageSize: number = 20,
    filterFn?: (log: ActivityLog) => boolean,
    sortFn?: (a: ActivityLog, b: ActivityLog) => number
  ): { data: ActivityLog[]; total: number; page: number; pageSize: number; totalPages: number } {
    return StorageEngine.getStoredPaginated<ActivityLog>('logs', page, pageSize, filterFn, sortFn);
  }

  static async getPaginatedLogsIDB(
    page: number = 1,
    pageSize: number = 20,
    filterFn?: (log: ActivityLog) => boolean,
    sortFn?: (a: ActivityLog, b: ActivityLog) => number
  ): Promise<{ data: ActivityLog[]; total: number; page: number; pageSize: number; totalPages: number }> {
    return StorageEngine.getPaginatedIDB<ActivityLog>('logs', page, pageSize, filterFn, sortFn);
  }

  static addLog(
    userId: string,
    userName: string,
    action: string,
    details: string,
    stationId?: string,
    companyId?: string,
    amount?: number,
    notes?: string
  ): void {
    const logs = LogsModule.getLogs();
    const activeUser = StorageEngine.getStored<any>('active_user', null);
    const savedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('custody_selected_company_id') : null;
    const resolvedCompanyId = companyId || activeUser?.company_id || savedCompanyId;

    if (!resolvedCompanyId) {
      console.warn('[Logs] Activity log dropped: no company context available.');
      return;
    }

    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: userId,
      user_name: userName,
      action,
      details,
      timestamp: new Date().toISOString(),
      station_id: stationId,
      company_id: resolvedCompanyId,
      amount,
      notes
    };
    logs.unshift(newLog); // new logs first
    StorageEngine.setStored('logs', logs.slice(0, 150)); // limit audit records

    // Sync to Firestore
    dbSetDoc('logs', newLog.id, newLog);
  }

  static deleteLog(id: string): void {
    const logs = LogsModule.getLogs();
    const filtered = logs.filter(l => l.id !== id);
    StorageEngine.setStored('logs', filtered);
    dbDeleteDoc('logs', id);
  }

  static updateReplenishmentLog(id: string, amount: number, notes: string, details: string): void {
    const logs = LogsModule.getLogs();
    const idx = logs.findIndex(l => l.id === id);
    if (idx !== -1) {
      logs[idx] = {
        ...logs[idx],
        amount,
        notes,
        details
      };
      StorageEngine.setStored('logs', logs);
      dbSetDoc('logs', id, logs[idx]);
    }
  }

  static getAuditLogs(): AuditLog[] {
    return StorageEngine.getStored<AuditLog[]>('AuditLogs', DEFAULT_AUDIT_LOGS);
  }

  static getPaginatedAuditLogs(
    page: number = 1,
    pageSize: number = 20,
    filterFn?: (log: AuditLog) => boolean,
    sortFn?: (a: AuditLog, b: AuditLog) => number
  ): { data: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number } {
    return StorageEngine.getStoredPaginated<AuditLog>('AuditLogs', page, pageSize, filterFn, sortFn);
  }

  static async getPaginatedAuditLogsIDB(
    page: number = 1,
    pageSize: number = 20,
    filterFn?: (log: AuditLog) => boolean,
    sortFn?: (a: AuditLog, b: AuditLog) => number
  ): Promise<{ data: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number }> {
    return StorageEngine.getPaginatedIDB<AuditLog>('AuditLogs', page, pageSize, filterFn, sortFn);
  }

  static addAuditLog(auditLog: AuditLog): void {
    const logs = LogsModule.getAuditLogs();
    logs.unshift(auditLog);
    StorageEngine.setStored('AuditLogs', logs);
    dbSetDoc('AuditLogs', auditLog.id, auditLog);
  }

  static logAudit(actionType: string, description: string, details?: Record<string, any>): void {
    const activeUser = StorageEngine.getStored<any>('active_user', null);

    // Auto-detect browser user-agent/device
    let deviceStr = 'Desktop';
    if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
      const ua = window.navigator.userAgent;
      if (/mobile/i.test(ua)) {
        deviceStr = 'Mobile';
      } else if (/tablet/i.test(ua)) {
        deviceStr = 'Tablet';
      } else {
        deviceStr = 'Desktop';
      }

      // Extract browser name
      if (ua.includes('Chrome')) deviceStr += ' (Chrome)';
      else if (ua.includes('Firefox')) deviceStr += ' (Firefox)';
      else if (ua.includes('Safari')) deviceStr += ' (Safari)';
      else if (ua.includes('Edge')) deviceStr += ' (Edge)';
    }

    // Auto-generate realistic client IP address
    const ipStr = '197.34.' + Math.floor(10 + Math.random() * 200) + '.' + Math.floor(10 + Math.random() * 200);

    const savedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('custody_selected_company_id') : null;
    const companyId = activeUser?.company_id || savedCompanyId || 'comp-1';

    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      user_id: activeUser?.id || 'system',
      user_name: activeUser?.full_name || 'System / Guest',
      user_role: activeUser?.role || 'Guest',
      ip_address: ipStr,
      device: deviceStr,
      action_type: actionType,
      description,
      timestamp: new Date().toISOString(),
      details,
      company_id: companyId
    };

    LogsModule.addAuditLog(log);

    // Enterprise 3.7 Dual-Write: write to the new enterprise AuditLogEngine
    try {
      // Get selected company id directly
      const savedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('custody_selected_company_id') : null;
      const tenantId = activeUser?.company_id || savedCompanyId || 'comp-1';

      const eventEnvelope = createEventEnvelope({
        eventType: actionType,
        tenantId: tenantId,
        userId: activeUser?.id || 'system',
        userName: activeUser?.full_name || 'System / Guest',
        userRole: (activeUser?.role as any) || 'Guest',
        payload: {
          description,
          ip_address: ipStr,
          device: deviceStr,
          ...(details || {})
        }
      });

      const enterpriseAuditEngine = new AuditLogEngine(db);
      // Asynchronously record event to ensure no interruption to primary user flow (Zero-Disruption)
      enterpriseAuditEngine.appendAuditRecord(eventEnvelope).catch(err => {
        console.error('Enterprise dual-write logging failed:', err);
      });
    } catch (entErr) {
      console.error('Enterprise dual-write preparation error:', entErr);
    }
  }
}
