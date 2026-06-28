# Cash Custody Management System - Deployment & ERP Architecture Guide

This standalone ERP Cash Custody Management System is built using a secure, responsive full-stack architecture. Out of the box, it runs a high-fidelity PostgreSQL and session simulator over local persistent storage, allowing immediate previewing, offline usage, and direct client validation. 

To deploy this in production with a live **Supabase + PostgreSQL** backend, follow this comprehensive enterprise architectural guide.

---

## 📁 1. Project Folder Structure

The application is structured following modern React/Vite modularity, separating models, db clients, layout frameworks, and view controllers:

```text
├── /supabase_schema.sql     # PostgreSQL normalized DDL tables, seed data & RLS Policies
├── /DEPLOYMENT.md           # This comprehensive guide
├── /metadata.json           # Application title, permissions, and major capabilities
├── /package.json            # NPM scripts, dependencies, and devDependencies
├── /vite.config.ts          # Vite bundler options (Tailwind CSS configuration)
├── /src
│   ├── main.tsx             # DOM entry point
│   ├── index.css            # Global stylesheet with Tailwind CSS definitions
│   ├── types.ts             # Global TypeScript types, interfaces, and bilingual dictionaries
│   ├── db.ts                # Relational local storage database manager & audit trigger logger
│   ├── App.tsx              # Main controller state, authentication gates, and sub-view dispatcher
│   ├── components
│   │   └── Layout.tsx       # Master layout frame ( bilinguality, dark mode, responsive sidebar)
│   └── pages
│       ├── Login.tsx        # secure portal login & mock profile testing tiles
│       ├── Dashboard.tsx    # KPI dashboards, and category spend charts (Recharts)
│       ├── NewExpense.tsx   # expense logger with inline validations
│       ├── PendingTransactions.tsx # outstanding pending expense table, edits, and deletions
│       ├── CashPaymentVoucher.tsx # settlement linker of vouchers
│       ├── UnderSettlement.tsx # history archive of settled items and settlement rollback
│       ├── CashReconciliation.tsx # cash verification equation sheets & print sign-offs
│       ├── Reports.tsx      # multi-report logs generator with dynamic CSV exports
│       └── Settings.tsx     # company settings, bilingual categories, and role gates
```

---

## 🗄️ 2. Supabase & PostgreSQL Database Setup

The application uses **PostgreSQL** with Row Level Security (RLS) constraints. All schemas are defined in `/supabase_schema.sql`.

### Step 2.1: Run DDL Scripts in Supabase
1. Go to your [Supabase Dashboard](https://supabase.com) and create a new project.
2. Navigate to the **SQL Editor** tab from the left sidebar.
3. Click **New Query** and paste the entire contents of the `/supabase_schema.sql` file.
4. Click **Run** (or press `Ctrl + Enter`). This will:
   - Create tables: `expense_categories`, `users`, `transactions`, `activity_logs`, and `custody_config`.
   - Setup foreign keys, unique indices, and automatic check constraints.
   - Activate Row Level Security (RLS) policies.
   - Insert bilingual seed categories and default company configurations.

### Step 2.2: Enable Authentication
1. Go to **Authentication** ➔ **Providers** and make sure **Email / Password** is enabled.
2. (Optional) Turn off *Confirm Email* if you want users to log in immediately upon manual admin registration.

---

## 🌐 3. Connecting React to Live Supabase Backend

Once the database is initialized, replace the simulated db manager in `src/db.ts` with the official `@supabase/supabase-js` client SDK to pull live Postgres entries.

### Step 3.1: Install Supabase Client Package
```bash
npm install @supabase/supabase-js
```

### Step 3.2: Configure Environment Variables
Create a `.env` file at your project root:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anonymous-key-here
```

### Step 3.3: Replace client code in `src/db.ts`
Initialize and export the official Supabase client:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

You can then map standard table actions to simple async calls:
```typescript
// Example Live Fetch
const { data, error } = await supabase
  .from('transactions')
  .select('*, expense_categories(*)')
  .eq('status', 'Pending');
```

---

## 🚀 4. Production Vercel / Cloud Run Deployment

The system compiles into optimized static web pages. It is lightweight and can be hosted on serverless clouds.

### Option A: Vercel Deployment (Recommended)
1. Install the Vercel CLI or link your repository to **GitHub**.
2. Run the following command or connect through the Vercel Dashboard:
   ```bash
   vercel
   ```
3. Set your **Framework Preset** to `Vite`.
4. Enter your environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
5. Click **Deploy**. Your app is live under an SSL-secured custom URL!

### Option B: Local Production Run
To build and preview locally:
```bash
# Compile and build assets inside the /dist folder
npm run build

# Boot local static server
npm run preview
```

---

## 🛡️ 5. Key Business Workflows Enforced

1. **Transaction Auto-Numbering**: Transaction numbers increment predictably (`TX-2026-0001`, `TX-2026-0002` etc.) ensuring audit traceability.
2. **Two-State Rigidity**: Expenses start as `Pending` and transition to `Under Settlement` ONLY after a `Voucher Number` and `Voucher Date` is provided. No intermediate or unvouched transitions are possible.
3. **Admin Security Gate**: Only users flagged with `role: 'Admin'` can access the Settings panel, change the base Custody Amount, or delete transactions. Cashiers have restricted scopes.
4. **Failsafe Mathematics**: Available Liquid Cash balances are dynamically recalculated in real-time on every query using the verified equation:
   $$\text{Cash Available} = \text{Custody Value} - \text{Pending Total} - \text{Under Settlement Total}$$
