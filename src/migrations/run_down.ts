import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { runTenantMigrationDown } from './tenantMigration';

const firebaseConfig = {
  projectId: "custodyflow",
  appId: "1:88602135716:web:b77559202f5e9f233d6a31",
  apiKey: "AIzaSyA2I_2GIEfQhawBL2KhXyxD6CwTLJR-jFw",
  authDomain: "custodyflow.firebaseapp.com",
  storageBucket: "custodyflow.firebasestorage.app",
  messagingSenderId: "88602135716"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-custodyflow-b2f42bf6-7a6a-43a4-9986-3d46405d5ebe");

async function main() {
  console.log('Running rollback (down) migration from command line...');
  try {
    const result = await runTenantMigrationDown(db);
    console.log('Rollback Result:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error('Fatal Rollback Error:', err);
    process.exit(1);
  }
}

main();
