import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { 
  initializeFirestore, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  onSnapshot as rawOnSnapshot, 
  writeBatch, 
  getDocs,
  getDoc,
  query,
  limit,
  where,
  startAfter,
  orderBy
} from 'firebase/firestore';
import { AppUser, ExpenseCategory, Transaction, ActivityLog, CustodyConfig, Region, Station, Company, Expense, CashVoucher, TransactionHistory, Notification, AuditLog, SystemPermission, SystemRole, DeletedTransaction, SignupRequest } from './types';
import { hashPassword } from './lib/hash';

const firebaseConfig = {
  apiKey: "AIzaSyA2I_2GIEfQhawBL2KhXyxD6CwTLJR-jFw",
  authDomain: "custodyflow.firebaseapp.com",
  projectId: "custodyflow",
  storageBucket: "custodyflow.firebasestorage.app",
  messagingSenderId: "88602135716",
  appId: "1:88602135716:web:b77559202f5e9f233d6a31",
  measurementId: "G-4W5S4CETH1"
};

const app = initializeApp(firebaseConfig);
const isSandboxProject = firebaseConfig.projectId === "refined-garage-5nzsc" || firebaseConfig.projectId === "custodyflow";
export const db = isSandboxProject
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-custodyflow-b2f42bf6-7a6a-43a4-9986-3d46405d5ebe")
  : initializeFirestore(app, { experimentalForceLongPolling: true });
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;

  // If this is a transient connection/offline issue or permission-denied error, log a warning instead of throwing a hard error.
  const isTransient = errCode === 'unavailable' ||
                      errCode === 'permission-denied' ||
                      errCode === 'unauthenticated' ||
                      errMsg.toLowerCase().includes('unavailable') || 
                      errMsg.toLowerCase().includes('permission-denied') || 
                      errMsg.toLowerCase().includes('permission denied') || 
                      errMsg.toLowerCase().includes('unauthenticated') || 
                      errMsg.toLowerCase().includes('could not reach') || 
                      errMsg.toLowerCase().includes('offline') || 
                      errMsg.toLowerCase().includes('connection failed') ||
                      errMsg.toLowerCase().includes('failed to connect') ||
                      errMsg.toLowerCase().includes('network') ||
                      operationType === OperationType.GET; // Never throw a fatal crash on read queries

  if (isTransient) {
    console.warn(`Firestore is operating in offline/permissive mode or experiencing transient issues during ${operationType} on ${path}:`, errMsg);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Global counters for collection snapshot tracking
const snapshotCounters: Record<string, number> = {};

// Custom onSnapshot wrapper to inject debug logs 6 and 7 automatically
export function onSnapshot(
  reference: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  let key = 'unknown';
  try {
    if (reference) {
      if (typeof reference.path === 'string') {
        key = reference.path;
      } else if (reference._query && reference._query.path) {
        key = reference._query.path.segments?.join('/') || 'query';
      } else if (reference.type === 'query' || reference.type === 'collection') {
        key = reference.path || 'query';
      } else {
        key = reference.constructor?.name || 'query';
      }
    }
  } catch (e) {
    key = 'error_extracting_path';
  }

  const wrappedOnNext = (snapshot: any) => {
    snapshotCounters[key] = (snapshotCounters[key] || 0) + 1;
    if (snapshotCounters[key] === 1) {
      console.log(`[DEBUG_LOG] 6. FIRST snapshot for collection: ${key}`);
    }
    const size = typeof snapshot.size === 'number' 
      ? snapshot.size 
      : (typeof snapshot.exists === 'function' && snapshot.exists() ? 1 : 0);
    console.log(`[DEBUG_LOG] 7. Incoming Firestore elements count for [${key}]:`, size);
    
    onNext(snapshot);
  };

  return rawOnSnapshot(reference, wrappedOnNext, onError);
}

// Seed status document helper
const SEED_DOC_PATH = 'system_meta/seed_status_v5';

// Helper to check if database needs seeding, and seed it if so
export async function seedDatabaseIfEmpty(defaults: {
  companies: Company[];
  regions: Region[];
  stations: Station[];
  categories: ExpenseCategory[];
  users: AppUser[];
  transactions: Transaction[];
  logs: ActivityLog[];
  config: CustodyConfig;
  expenses?: Expense[];
  cashVouchers?: CashVoucher[];
  transactionHistory?: TransactionHistory[];
  notifications?: Notification[];
  auditLogs?: AuditLog[];
  permissions?: SystemPermission[];
  roles?: SystemRole[];
}) {
  console.log('[DEBUG_LOG] 3. Before executing seedDatabaseIfEmpty');
  try {
    // Check if seeded with v7 already
    let alreadySeededV7 = false;
    let checkSuccess = false;
    try {
      console.log('[DEBUG_LOG] 1. Before reading system_meta collection');
      const snap = await getDocs(query(collection(db, 'system_meta'), limit(10)));
      snap.forEach(d => {
        if (d.id === 'seed_status_v7') {
          alreadySeededV7 = true;
        }
      });
      checkSuccess = true;
      console.log('[DEBUG_LOG] 2. After reading system_meta. Doc count:', snap.size, 'alreadySeededV7:', alreadySeededV7, 'docs:', snap.docs.map(d => ({id: d.id, data: d.data()})));
    } catch (e) {
      console.warn('Error checking seed_status_v7:', e);
    }

    if (!checkSuccess) {
      console.log('Skipping seeding: Unable to verify seed status (likely guest user, offline, or lacking permissions).');
      return;
    }

    if (!alreadySeededV7) {
      console.log('Force-clearing old database and seeding v7...');

      const collectionsToClear = [
        'companies', 'regions', 'stations', 'users', 'transactions', 'logs',
        'Expenses', 'CashVouchers', 'TransactionHistory', 'Notifications', 
        'AuditLogs', 'Permissions', 'Roles', 'deleted_transactions', 'company_sequences'
      ];

      for (const colName of collectionsToClear) {
        try {
          const snap = await getDocs(collection(db, colName));
          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => {
              batch.delete(doc(db, colName, d.id));
            });
            await batch.commit();
          }
        } catch (err) {
          console.error(`Error clearing collection ${colName}:`, err);
        }
      }

      // First batch for primary seed data
      const batch = writeBatch(db);

      // Seed companies
      defaults.companies.forEach(c => {
        batch.set(doc(db, 'companies', c.id), c);
      });

      // Seed regions
      defaults.regions.forEach(r => {
        batch.set(doc(db, 'regions', r.id), r);
      });

      // Seed categories
      defaults.categories.forEach(c => {
        batch.set(doc(db, 'categories', c.id), c);
      });

      // Seed users (with salted hashed passwords)
      defaults.users.forEach(u => {
        let pwd = u.password || '';
        if (pwd && !/^[0-9a-f]{64}$/i.test(pwd)) {
          pwd = hashPassword(pwd, u.email);
        }
        batch.set(doc(db, 'users', u.id), { ...u, password: pwd });
      });

      // Seed logs
      defaults.logs.forEach(l => {
        batch.set(doc(db, 'logs', l.id), l);
      });

      // Seed config
      batch.set(doc(db, 'config', 'main'), defaults.config);

      // Seed permissions & roles
      if (defaults.permissions) {
        defaults.permissions.forEach(p => batch.set(doc(db, 'Permissions', p.id), p));
      }
      if (defaults.roles) {
        defaults.roles.forEach(r => batch.set(doc(db, 'Roles', r.id), r));
      }

      await batch.commit();

      // Seed transactions in a separate batch since there are many generated transactions
      // To avoid the 500 writes limit per batch, we chunk them by 100
      const txs = defaults.transactions;
      const CHUNK_SIZE = 100;
      for (let i = 0; i < txs.length; i += CHUNK_SIZE) {
        const txsBatch = writeBatch(db);
        const chunk = txs.slice(i, i + CHUNK_SIZE);
        chunk.forEach(t => {
          txsBatch.set(doc(db, 'transactions', t.id), t);
        });
        await txsBatch.commit();
      }

      // Seed stations in separate batches because there are 105 stations!
      // Write batches can have up to 500 items, but keeping it tidy
      const stationsBatch = writeBatch(db);
      defaults.stations.forEach(s => {
        stationsBatch.set(doc(db, 'stations', s.id), s);
      });
      await stationsBatch.commit();

      // Mark v7 status as the absolute final step, locking the database under specific rules
      const finalBatch = writeBatch(db);
      finalBatch.set(doc(db, 'system_meta', 'seed_status_v7'), { seeded: true, timestamp: new Date().toISOString() });
      await finalBatch.commit();

      console.log('Seeding v7 completed successfully.');
      console.log('[DEBUG_LOG] 4. After completing seedDatabaseIfEmpty (New seed performed)');
      
      // Force refresh of local state
      localStorage.clear();
      window.location.reload();
    } else {
      console.log('Database already seeded with v7. Skipping seed.');
      console.log('[DEBUG_LOG] 4. After seedDatabaseIfEmpty (Database already seeded with v7, skipping)');
    }
  } catch (error) {
    console.error('Error seeding Firebase:', error);
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
}

// Active snapshot unsubscribe functions to prevent memory/performance leaks
let activeUnsubscribes: (() => void)[] = [];

export function clearActiveUnsubscribes() {
  activeUnsubscribes.forEach(unsub => {
    try {
      unsub();
    } catch (e) {
      console.warn('Error unsubscribing:', e);
    }
  });
  activeUnsubscribes = [];
}

function rebuildListeners(activeUser: AppUser | null, companyId: string) {
  console.log('[DEBUG_LOG] 5. Before running rebuildListeners(). ActiveUser ID:', activeUser?.id, 'Company ID:', companyId);
  clearActiveUnsubscribes();

  console.log(`Rebuilding Firestore listeners. Active user: ${activeUser?.email || 'Guest'}, Selected company: ${companyId}`);

  // 1. Sync Companies (SaaS Multi-tenant / Scoped)
  const qCompanies = activeUser && activeUser.role === 'SystemAdmin'
    ? query(collection(db, 'companies'), limit(100))
    : query(collection(db, 'companies'), where('id', '==', companyId));

  const unsubCompanies = onSnapshot(qCompanies, (snapshot) => {
    const data: Company[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Company);
    });
    updateLocalAndNotify('companies', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'companies');
  });
  activeUnsubscribes.push(unsubCompanies);

  // 2. Sync Config main
  const unsubConfig = onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
    if (snapshot.exists()) {
      updateLocalAndNotify('config', snapshot.data() as CustodyConfig);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'config/main');
  });
  activeUnsubscribes.push(unsubConfig);

  // 3. Sync Categories (standard and small static set, cached)
  const unsubCategories = onSnapshot(query(collection(db, 'categories'), limit(100)), (snapshot) => {
    const data: ExpenseCategory[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as ExpenseCategory);
    });
    updateLocalAndNotify('categories', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'categories');
  });
  activeUnsubscribes.push(unsubCategories);

  // If no active user, do not load transactional collections to protect performance
  if (!activeUser) {
    return;
  }

  // 4. Sync Regions (Scoped to current company)
  const qRegions = query(collection(db, 'regions'), where('company_id', '==', companyId));
  const unsubRegions = onSnapshot(qRegions, (snapshot) => {
    const data: Region[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Region);
    });
    updateLocalAndNotify('regions', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'regions');
  });
  activeUnsubscribes.push(unsubRegions);

  // 5. Sync Stations (Scoped to current company)
  const qStations = query(collection(db, 'stations'), where('company_id', '==', companyId));
  const unsubStations = onSnapshot(qStations, (snapshot) => {
    const data: Station[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Station);
    });
    updateLocalAndNotify('stations', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'stations');
  });
  activeUnsubscribes.push(unsubStations);

  // 6. Sync Users (Scoped to current company)
  const qUsers = activeUser.role === 'SystemAdmin'
    ? query(collection(db, 'users'), limit(200))
    : query(collection(db, 'users'), where('company_id', '==', companyId));
  const unsubUsers = onSnapshot(qUsers, (snapshot) => {
    const data: AppUser[] = [];
    snapshot.forEach(doc => {
      const u = doc.data() as AppUser;
      // Redact coworker password hashes to prevent reading coworker hashes (SEC-05)
      if (u.id !== activeUser.id && activeUser.role !== 'SystemAdmin') {
        if (u.password) {
          u.password = 'REDACTED';
        }
      }
      data.push(u);
    });

    // Crucial: preserve any existing SystemAdmin users in local cache to prevent them from being wiped out by company-scoped sync!
    try {
      const existingStr = localStorage.getItem('custody_users');
      if (existingStr) {
        const existingUsers = JSON.parse(existingStr) as AppUser[];
        const systemAdmins = existingUsers.filter(u => u.role === 'SystemAdmin');
        systemAdmins.forEach(admin => {
          if (!data.some(u => u.id === admin.id || (u.email && admin.email && u.email.toLowerCase().trim() === admin.email.toLowerCase().trim()))) {
            data.push(admin);
          }
        });
      }
    } catch (e) {
      console.warn('Error preserving SystemAdmin users in snapshot sync:', e);
    }

    updateLocalAndNotify('users', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'users');
  });
  activeUnsubscribes.push(unsubUsers);

  // 7. Sync Transactions with limit (Smart Cache: 150 items max)
  const isStationAdmin = activeUser.role === 'StationAdmin';
  const qTransactions = isStationAdmin && activeUser.station_id
    ? query(collection(db, 'transactions'), where('company_id', '==', companyId), where('station_id', '==', activeUser.station_id), limit(150))
    : query(collection(db, 'transactions'), where('company_id', '==', companyId), limit(150));
  const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
    const data: Transaction[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Transaction);
    });
    // Sort in-memory to prevent requiring composite indices in Firestore
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('transactions', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'transactions');
  });
  activeUnsubscribes.push(unsubTransactions);

  // 8. Sync Logs with limit (Smart Cache: 100 items max)
  const qLogs = query(collection(db, 'logs'), where('company_id', '==', companyId), limit(100));
  const unsubLogs = onSnapshot(qLogs, (snapshot) => {
    const data: ActivityLog[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as ActivityLog);
    });
    data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    updateLocalAndNotify('logs', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'logs');
  });
  activeUnsubscribes.push(unsubLogs);

  // 9. Sync Expenses with limit (Smart Cache: 150 items max)
  const qExpenses = isStationAdmin && activeUser.station_id
    ? query(collection(db, 'Expenses'), where('company_id', '==', companyId), where('station_id', '==', activeUser.station_id), limit(150))
    : query(collection(db, 'Expenses'), where('company_id', '==', companyId), limit(150));
  const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
    const data: Expense[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Expense);
    });
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('Expenses', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'Expenses');
  });
  activeUnsubscribes.push(unsubExpenses);

  // 10. Sync CashVouchers with limit (Smart Cache: 150 items max)
  const qVouchers = isStationAdmin && activeUser.station_id
    ? query(collection(db, 'CashVouchers'), where('company_id', '==', companyId), where('station_id', '==', activeUser.station_id), limit(150))
    : query(collection(db, 'CashVouchers'), where('company_id', '==', companyId), limit(150));
  const unsubVouchers = onSnapshot(qVouchers, (snapshot) => {
    const data: CashVoucher[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as CashVoucher);
    });
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('CashVouchers', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'CashVouchers');
  });
  activeUnsubscribes.push(unsubVouchers);

  // 11. Sync TransactionHistory with limit (Smart Cache: 150 items max)
  const qHistory = query(collection(db, 'TransactionHistory'), where('company_id', '==', companyId), limit(150));
  const unsubHistory = onSnapshot(qHistory, (snapshot) => {
    const data: TransactionHistory[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as TransactionHistory);
    });
    data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    updateLocalAndNotify('TransactionHistory', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'TransactionHistory');
  });
  activeUnsubscribes.push(unsubHistory);

  // 12. Sync Notifications with limit (Smart Cache: 50 items max)
  const qNotifications = query(collection(db, 'Notifications'), where('company_id', '==', companyId), limit(50));
  const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
    const data: Notification[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Notification);
    });
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('Notifications', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'Notifications');
  });
  activeUnsubscribes.push(unsubNotifications);

  // 13. Sync AuditLogs with limit (Smart Cache: 100 items max)
  if (activeUser.role === 'SystemAdmin' || activeUser.role === 'Admin') {
    const qAudit = query(collection(db, 'AuditLogs'), where('company_id', '==', companyId), limit(100));
    const unsubAudit = onSnapshot(qAudit, (snapshot) => {
      const data: AuditLog[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as AuditLog);
      });
      data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      updateLocalAndNotify('AuditLogs', data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'AuditLogs');
    });
    activeUnsubscribes.push(unsubAudit);
  }

  // 14. Sync Deleted Transactions with limit (Smart Cache: 100 items max)
  const qDeleted = query(collection(db, 'deleted_transactions'), where('company_id', '==', companyId), limit(100));
  const unsubDeleted = onSnapshot(qDeleted, (snapshot) => {
    const data: DeletedTransaction[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as DeletedTransaction);
    });
    data.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    updateLocalAndNotify('deleted_transactions', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'deleted_transactions');
  });
  activeUnsubscribes.push(unsubDeleted);

  // 15. Sync Company Sequences
  const qSequences = query(collection(db, 'company_sequences'), where('company_id', '==', companyId));
  const unsubSequences = onSnapshot(qSequences, (snapshot) => {
    const data: any[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data());
    });
    updateLocalAndNotify('company_sequences', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'company_sequences');
  });
  activeUnsubscribes.push(unsubSequences);

  // 16. Sync Signup Requests
  if (activeUser.role === 'SystemAdmin' || activeUser.role === 'Admin') {
    const qSignup = activeUser.role === 'SystemAdmin'
      ? query(collection(db, 'signup_requests'), limit(50))
      : query(collection(db, 'signup_requests'), where('company_id', '==', companyId), limit(50));
    const unsubSignup = onSnapshot(qSignup, (snapshot) => {
      const data: SignupRequest[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as SignupRequest);
      });
      updateLocalAndNotify('signup_requests', data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'signup_requests');
    });
    activeUnsubscribes.push(unsubSignup);
  }
}

// Track last synced state to prevent infinite listener recreation loop
let lastActiveUserId: string | null = null;
let lastActiveUserRole: string | null = null;
let lastStationId: string | null = null;
let lastCompanyId: string | null = null;
let isFirstSync = true;

// Set up snapshot listeners to sync Firestore data dynamically
export function setupFirebaseSync() {
  const handleUserOrCompanyChange = () => {
    try {
      const activeUserStr = localStorage.getItem('custody_active_user');
      const activeUser = activeUserStr ? JSON.parse(activeUserStr) : null;
      
      const selectedCompanyId = localStorage.getItem('custody_selected_company_id') || (activeUser ? activeUser.company_id : 'comp-1') || 'comp-1';
      
      const currentUserId = activeUser ? activeUser.id : null;
      const currentUserRole = activeUser ? activeUser.role : null;
      const currentStationId = activeUser ? activeUser.station_id : null;
      
      if (
        !isFirstSync &&
        currentUserId === lastActiveUserId &&
        currentUserRole === lastActiveUserRole &&
        currentStationId === lastStationId &&
        selectedCompanyId === lastCompanyId
      ) {
        // Session context unchanged, do not rebuild listeners
        return;
      }
      
      lastActiveUserId = currentUserId;
      lastActiveUserRole = currentUserRole;
      lastStationId = currentStationId;
      lastCompanyId = selectedCompanyId;
      isFirstSync = false;
      
      rebuildListeners(activeUser, selectedCompanyId);
    } catch (err) {
      console.error('Error handling user or company change in sync:', err);
    }
  };

  // Run immediately on boot
  handleUserOrCompanyChange();

  // Listen for changes across components or browser storage to dynamically rebuild listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('custody_db_updated', handleUserOrCompanyChange);
    window.addEventListener('storage', handleUserOrCompanyChange);
  }
}

// Expose a generic, highly optimized pagination fetcher from Firestore to support on-demand paging beyond the cache
export async function dbFetchPaginated<T>(
  collectionName: string,
  companyId: string,
  limitVal: number,
  lastDocId?: string
): Promise<{ data: T[]; lastDocId?: string; hasMore: boolean }> {
  try {
    let q = query(
      collection(db, collectionName),
      where('company_id', '==', companyId),
      limit(limitVal)
    );
    
    if (lastDocId) {
      const docSnap = await getDoc(doc(db, collectionName, lastDocId));
      if (docSnap.exists()) {
        q = query(q, startAfter(docSnap));
      }
    }
    
    const snapshot = await getDocs(q);
    const data: T[] = [];
    snapshot.forEach(doc => {
      data.push({ ...doc.data(), id: doc.id } as any);
    });
    
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    
    return {
      data,
      lastDocId: lastVisible ? lastVisible.id : undefined,
      hasMore: snapshot.docs.length === limitVal
    };
  } catch (error) {
    console.error(`Error fetching paginated collection ${collectionName}:`, error);
    return { data: [], hasMore: false };
  }
}

function updateLocalAndNotify(key: string, data: any) {
  const localKey = `custody_${key}`;
  const currentStr = localStorage.getItem(localKey);
  
  // 8. Print count of elements in LocalStorage before updating
  let countBefore = 0;
  if (currentStr) {
    try {
      const parsed = JSON.parse(currentStr);
      countBefore = Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0);
    } catch (e) {}
  }
  console.log(`[DEBUG_LOG] 8. Elements in LocalStorage [${key}] before update:`, countBefore);

  const nextStr = JSON.stringify(data);
  if (currentStr !== nextStr) {
    try {
      localStorage.setItem(localKey, nextStr);
    } catch (error: any) {
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || (error.code && error.code === 22)) {
        console.warn('LocalStorage quota exceeded! Cleaning up non-essential keys to free space...');
        // Clear non-essential large collections to free space
        const nonEssentialKeys = [
          'custody_logs',
          'custody_AuditLogs',
          'custody_TransactionHistory',
          'custody_Notifications',
          'custody_activity_logs'
        ];
        nonEssentialKeys.forEach(k => {
          try {
            localStorage.removeItem(k);
          } catch (e) {}
        });
        
        // Try setting the item again
        try {
          localStorage.setItem(localKey, nextStr);
          console.log('Successfully saved to LocalStorage after cleanup.');
        } catch (retryError) {
          console.error('Failed to save to LocalStorage even after cleanup:', retryError);
        }
      } else {
        console.error('Error saving to LocalStorage:', error);
      }
    }
    
    // 9. Print count of elements after updateLocalAndNotify()
    let countAfter = 0;
    try {
      const parsed = JSON.parse(nextStr);
      countAfter = Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0);
    } catch (e) {}
    console.log(`[DEBUG_LOG] 9. Elements in LocalStorage [${key}] after updateLocalAndNotify():`, countAfter);

    window.dispatchEvent(new Event('custody_db_updated'));
  } else {
    console.log(`[DEBUG_LOG] 9. No change in LocalStorage [${key}]. Remained at:`, countBefore);
  }
}

// Helper to recursively remove undefined values from objects before saving to Firestore
function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const clean: any = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = cleanUndefined(val);
      }
    });
    return clean;
  }
  return obj;
}

// Sync changes back to Firebase when writing locally
export async function dbSetDoc(collectionName: string, docId: string, data: any) {
  try {
    const cleanData = cleanUndefined(data);
    await setDoc(doc(db, collectionName, docId), cleanData);
  } catch (error) {
    console.error(`Error saving document to Firestore (${collectionName}/${docId}):`, error);
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${docId}`);
  }
}

export async function dbDeleteDoc(collectionName: string, docId: string) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    console.error(`Error deleting document from Firestore (${collectionName}/${docId}):`, error);
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${docId}`);
  }
}

export async function dbFetchUserByEmail(email: string): Promise<AppUser | null> {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as AppUser;
    }
  } catch (error) {
    console.warn(`Error fetching user by email from Firestore:`, error);
  }
  return null;
}

export async function fetchTransactionsOnDemand(
  companyId: string, 
  pageSize: number = 20, 
  lastDoc: any = null
) {
  let q = query(
    collection(db, 'transactions'),
    where('company_id', '==', companyId),
    orderBy('created_at', 'desc'),
    limit(pageSize)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const querySnapshot = await getDocs(q);
  const data = querySnapshot.docs.map(doc => doc.data());
  return {
    data,
    lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1]
  };
}
