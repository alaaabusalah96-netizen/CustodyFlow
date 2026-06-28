import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
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
import { AppUser, ExpenseCategory, Transaction, ActivityLog, CustodyConfig, Region, Station, Company } from './types';

const firebaseConfig = {
  projectId: "refined-garage-5nzsc",
  appId: "1:619920731471:web:caa4ea274d68cfff45293a",
  apiKey: "AIzaSyD_KQ7aA76ZGR-Z9zdhQBIZQIxHw-Hw5Vc",
  authDomain: "refined-garage-5nzsc.firebaseapp.com",
  storageBucket: "refined-garage-5nzsc.firebasestorage.app",
  messagingSenderId: "619920731471"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-custodyflow-b2f42bf6-7a6a-43a4-9986-3d46405d5ebe");

// Seed status document helper
const SEED_DOC_PATH = 'system_meta/seed_status';

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
}) {
  try {
    const tempCheck = await getDocs(query(collection(db, 'regions'), limit(1)));
    if (tempCheck.empty) {
      console.log('Firestore is empty. Seeding defaults...');
      const batch = writeBatch(db);

      // Seed companies
      defaults.companies.forEach(c => {
        batch.set(doc(db, 'companies', c.id), c);
      });

      // Seed regions
      defaults.regions.forEach(r => {
        batch.set(doc(db, 'regions', r.id), r);
      });

      // Seed stations
      defaults.stations.forEach(s => {
        batch.set(doc(db, 'stations', s.id), s);
      });

      // Seed categories
      defaults.categories.forEach(c => {
        batch.set(doc(db, 'categories', c.id), c);
      });

      // Seed users
      defaults.users.forEach(u => {
        batch.set(doc(db, 'users', u.id), u);
      });

      // Seed transactions
      defaults.transactions.forEach(t => {
        batch.set(doc(db, 'transactions', t.id), t);
      });

      // Seed logs
      defaults.logs.forEach(l => {
        batch.set(doc(db, 'logs', l.id), l);
      });

      // Seed config
      batch.set(doc(db, 'config', 'main'), defaults.config);

      // Seed meta status
      batch.set(doc(db, SEED_DOC_PATH), { seeded: true, timestamp: new Date().toISOString() });

      await batch.commit();
      console.log('Seeding defaults complete.');
    } else {
      console.log('Firestore regions exist. Skipping seed.');
    }
  } catch (error) {
    console.error('Error seeding Firebase:', error);
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
  });

  // Sync Regions
  onSnapshot(collection(db, 'regions'), (snapshot) => {
    const data: Region[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Region);
    });
    updateLocalAndNotify('regions', data);
  });

  // Sync Stations
  onSnapshot(collection(db, 'stations'), (snapshot) => {
    const data: Station[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as Station);
    });
    updateLocalAndNotify('stations', data);
  });

  // Sync Categories
  onSnapshot(collection(db, 'categories'), (snapshot) => {
    const data: ExpenseCategory[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as ExpenseCategory);
    });
    updateLocalAndNotify('categories', data);
  });

  // Sync Users
  onSnapshot(collection(db, 'users'), (snapshot) => {
    const data: AppUser[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as AppUser);
    });
    updateLocalAndNotify('users', data);
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
  });

  // Sync Logs
  onSnapshot(collection(db, 'logs'), (snapshot) => {
    const data: ActivityLog[] = [];
    snapshot.forEach(doc => {
      data.push(doc.data() as ActivityLog);
    });
    data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    updateLocalAndNotify('logs', data);
  });

  // Sync Config
  onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
    if (snapshot.exists()) {
      updateLocalAndNotify('config', snapshot.data() as CustodyConfig);
    }
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
  }
}

export async function dbDeleteDoc(collectionName: string, docId: string) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    console.error(`Error deleting document from Firestore (${collectionName}/${docId}):`, error);
  }
}
