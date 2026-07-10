import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { runTenantMigrationUp } from './tenantMigration';

const firebaseConfig = {
  projectId: "refined-garage-5nzsc",
  appId: "1:619920731471:web:caa4ea274d68cfff45293a",
  apiKey: "AIzaSyD_KQ7aA76ZGR-Z9zdhQBIZQIxHw-Hw5Vc",
  authDomain: "refined-garage-5nzsc.firebaseapp.com",
  storageBucket: "refined-garage-5nzsc.firebasestorage.app",
  messagingSenderId: "619920731471"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-custodyflow-b2f42bf6-7a6a-43a4-9986-3d46405d5ebe");

async function main() {
  console.log('Running migration from command line...');
  try {
    const result = await runTenantMigrationUp(db);
    console.log('Migration Result:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
  }
}

main();
