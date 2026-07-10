import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch, 
  getDocs,
  query,
  limit
} from 'firebase/firestore';
import { AppUser, ExpenseCategory, Transaction, ActivityLog, CustodyConfig, Region, Station, Company, Expense, CashVoucher, TransactionHistory, Notification, AuditLog, SystemPermission, SystemRole, DeletedTransaction, SignupRequest } from './types';

const firebaseConfig = {
  projectId: "refined-garage-5nzsc",
  appId: "1:619920731471:web:caa4ea274d68cfff45293a",
  apiKey: "AIzaSyD_KQ7aA76ZGR-Z9zdhQBIZQIxHw-Hw5Vc",
  authDomain: "refined-garage-5nzsc.firebaseapp.com",
  storageBucket: "refined-garage-5nzsc.firebasestorage.app",
  messagingSenderId: "619920731471"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, "ai-studio-custodyflow-b2f42bf6-7a6a-43a4-9986-3d46405d5ebe");
export const auth = getAuth(app);

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

  // If this is a transient connection/offline issue, log a warning instead of throwing a hard error.
  const isTransient = errCode === 'unavailable' ||
                      errMsg.toLowerCase().includes('unavailable') || 
                      errMsg.toLowerCase().includes('could not reach') || 
                      errMsg.toLowerCase().includes('offline') || 
                      errMsg.toLowerCase().includes('connection failed') ||
                      errMsg.toLowerCase().includes('failed to connect') ||
                      errMsg.toLowerCase().includes('network');

  if (isTransient) {
    console.warn(`Firestore is operating in offline mode or experiencing transient connection issues during ${operationType} on ${path}:`, errMsg);
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
  try {
    // Check if seeded with v7 already
    let alreadySeededV7 = false;
    try {
      const snap = await getDocs(query(collection(db, 'system_meta'), limit(10)));
      snap.forEach(d => {
        if (d.id === 'seed_status_v7') {
          alreadySeededV7 = true;
        }
      });
    } catch (e) {
      console.warn('Error checking seed_status_v7:', e);
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

      // Seed users
      defaults.users.forEach(u => {
        batch.set(doc(db, 'users', u.id), u);
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
      
      // Force refresh of local state
      localStorage.clear();
      window.location.reload();
    } else {
      console.log('Database already seeded with v7. Skipping seed.');
    }
  } catch (error) {
    console.error('Error seeding Firebase:', error);
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
}

// Set up snapshot listeners to sync Firestore data to localStorage
export function setupFirebaseSync() {
  // Sync Companies
  onSnapshot(collection(db, 'companies'), (snapshot) => {
    const data: Company[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Company);
    });
    updateLocalAndNotify('companies', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'companies');
  });

  // Sync Regions
  onSnapshot(collection(db, 'regions'), (snapshot) => {
    const data: Region[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Region);
    });
    updateLocalAndNotify('regions', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'regions');
  });

  // Sync Stations
  onSnapshot(collection(db, 'stations'), (snapshot) => {
    const data: Station[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Station);
    });
    updateLocalAndNotify('stations', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'stations');
  });

  // Sync Categories
  onSnapshot(collection(db, 'categories'), (snapshot) => {
    const data: ExpenseCategory[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as ExpenseCategory);
    });
    updateLocalAndNotify('categories', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'categories');
  });

  // Sync Users
  onSnapshot(collection(db, 'users'), (snapshot) => {
    const data: AppUser[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as AppUser);
    });
    updateLocalAndNotify('users', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'users');
  });

  // Sync Transactions
  onSnapshot(collection(db, 'transactions'), (snapshot) => {
    const data: Transaction[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Transaction);
    });
    // Sort transactions by date/time
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('transactions', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'transactions');
  });

  // Sync Logs
  onSnapshot(collection(db, 'logs'), (snapshot) => {
    const data: ActivityLog[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as ActivityLog);
    });
    data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    updateLocalAndNotify('logs', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'logs');
  });

  // Sync Config
  onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
    if (snapshot.exists()) {
      updateLocalAndNotify('config', snapshot.data() as CustodyConfig);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'config/main');
  });

  // --- Sprint 2 Collections Sync ---
  
  // Sync Expenses
  onSnapshot(collection(db, 'Expenses'), (snapshot) => {
    const data: Expense[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Expense);
    });
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('Expenses', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'Expenses');
  });

  // Sync CashVouchers
  onSnapshot(collection(db, 'CashVouchers'), (snapshot) => {
    const data: CashVoucher[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as CashVoucher);
    });
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('CashVouchers', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'CashVouchers');
  });

  // Sync TransactionHistory
  onSnapshot(collection(db, 'TransactionHistory'), (snapshot) => {
    const data: TransactionHistory[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as TransactionHistory);
    });
    data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    updateLocalAndNotify('TransactionHistory', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'TransactionHistory');
  });

  // Sync Notifications
  onSnapshot(collection(db, 'Notifications'), (snapshot) => {
    const data: Notification[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Notification);
    });
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    updateLocalAndNotify('Notifications', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'Notifications');
  });

  // Sync AuditLogs
  onSnapshot(collection(db, 'AuditLogs'), (snapshot) => {
    const data: AuditLog[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as AuditLog);
    });
    data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    updateLocalAndNotify('AuditLogs', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'AuditLogs');
  });

  // Sync Permissions
  onSnapshot(collection(db, 'Permissions'), (snapshot) => {
    const data: SystemPermission[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as SystemPermission);
    });
    updateLocalAndNotify('Permissions', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'Permissions');
  });

  // Sync Roles
  onSnapshot(collection(db, 'Roles'), (snapshot) => {
    const data: SystemRole[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as SystemRole);
    });
    updateLocalAndNotify('Roles', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'Roles');
  });

  // Sync Deleted Transactions
  onSnapshot(collection(db, 'deleted_transactions'), (snapshot) => {
    const data: DeletedTransaction[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as DeletedTransaction);
    });
    data.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    updateLocalAndNotify('deleted_transactions', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'deleted_transactions');
  });

  // Sync Company Sequences
  onSnapshot(collection(db, 'company_sequences'), (snapshot) => {
    const data: any[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data());
    });
    updateLocalAndNotify('company_sequences', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'company_sequences');
  });

  // Sync SignupRequests
  onSnapshot(collection(db, 'signup_requests'), (snapshot) => {
    const data: SignupRequest[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as SignupRequest);
    });
    updateLocalAndNotify('signup_requests', data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'signup_requests');
  });
}

function updateLocalAndNotify(key: string, data: any) {
  const localKey = `custody_${key}`;
  const currentStr = localStorage.getItem(localKey);
  const nextStr = JSON.stringify(data);
  if (currentStr !== nextStr) {
    localStorage.setItem(localKey, nextStr);
    window.dispatchEvent(new Event('custody_db_updated'));
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
