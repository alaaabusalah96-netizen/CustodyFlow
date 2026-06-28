-- ==========================================================
-- Cash Custody Management System - PostgreSQL Schema & Supabase RLS
-- ==========================================================

-- Enable UUID extension if not already present
create extension if not exists "uuid-ossp";

-- 1. EXPENSE CATEGORIES TABLE
create table public.expense_categories (
    id uuid default gen_random_uuid() primary key,
    name_en varchar(100) not null,
    name_ar varchar(100) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for expense_categories
alter table public.expense_categories enable row level security;

-- 2. USERS TABLE (Linked to Supabase Auth)
create table public.users (
    id uuid references auth.users(id) on delete cascade primary key,
    email varchar(255) not null unique,
    full_name varchar(255) not null,
    role varchar(50) default 'Regular'::character varying not null check (role in ('Admin', 'Regular')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for users
alter table public.users enable row level security;

-- 3. TRANSACTIONS TABLE
create table public.transactions (
    id uuid default gen_random_uuid() primary key,
    transaction_no varchar(50) not null unique,
    date date not null default current_date,
    description text not null,
    category_id uuid references public.expense_categories(id) on delete set null,
    amount decimal(15, 2) not null check (amount > 0),
    notes text,
    status varchar(50) default 'Pending'::character varying not null check (status in ('Pending', 'Under Settlement')),
    voucher_no varchar(100),
    voucher_date date,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for transactions
alter table public.transactions enable row level security;

-- 4. ACTIVITY LOGS TABLE (Audit trail)
create table public.activity_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete set null,
    action varchar(255) not null,
    details text not null,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for activity_logs
alter table public.activity_logs enable row level security;

-- 5. CONFIGURATION TABLE (Custody Value, Company Name)
create table public.custody_config (
    id integer primary key default 1 check (id = 1),
    company_name varchar(255) not null default 'Global ERP Corp',
    custody_value decimal(15, 2) not null default 32000.00 check (custody_value >= 0),
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for custody_config
alter table public.custody_config enable row level security;


-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

-- Expense Categories Policies
create policy "Allow all authenticated users to read categories" 
on public.expense_categories for select 
using (auth.role() = 'authenticated');

create policy "Allow admins to modify categories" 
on public.expense_categories for all 
using (
    exists (
        select 1 from public.users 
        where users.id = auth.uid() and users.role = 'Admin'
    )
);

-- Users Policies
create policy "Allow users to read all profiles" 
on public.users for select 
using (auth.role() = 'authenticated');

create policy "Allow admins to manage users" 
on public.users for all 
using (
    exists (
        select 1 from public.users 
        where users.id = auth.uid() and users.role = 'Admin'
    )
);

-- Transactions Policies
create policy "Allow authenticated users to read transactions" 
on public.transactions for select 
using (auth.role() = 'authenticated');

create policy "Allow authenticated users to create transactions" 
on public.transactions for insert 
with check (auth.role() = 'authenticated');

create policy "Allow owners or admins to update transactions" 
on public.transactions for update 
using (
    auth.uid() = created_by or 
    exists (
        select 1 from public.users 
        where users.id = auth.uid() and users.role = 'Admin'
    )
);

create policy "Allow admins to delete transactions" 
on public.transactions for delete 
using (
    exists (
        select 1 from public.users 
        where users.id = auth.uid() and users.role = 'Admin'
    )
);

-- Activity Logs Policies
create policy "Allow authenticated users to view logs" 
on public.activity_logs for select 
using (auth.role() = 'authenticated');

create policy "Allow server or admins to write logs" 
on public.activity_logs for insert 
with check (auth.role() = 'authenticated');

-- Custody Config Policies
create policy "Allow authenticated users to view config" 
on public.custody_config for select 
using (auth.role() = 'authenticated');

create policy "Allow admins to manage config" 
on public.custody_config for all 
using (
    exists (
        select 1 from public.users 
        where users.id = auth.uid() and users.role = 'Admin'
    )
);


-- ==========================================================
-- SEED DATA
-- ==========================================================

-- Insert default categories
insert into public.expense_categories (name_en, name_ar) values
('Office Supplies', 'أدوات مكتبية ومستلزمات'),
('Transport & Travel', 'انتقالات ومصاريف سفر'),
('Hospitality & Food', 'ضيافة ومأكولات'),
('Maintenance & Repairs', 'صيانة وإصلاحات'),
('Utilities & Internet', 'مرافق وإنترنت'),
('Miscellaneous', 'مصاريف نثرية أخرى');

-- Insert initial configuration
insert into public.custody_config (id, company_name, custody_value)
values (1, 'Al-Futtaim Trading Co.', 32000.00)
on conflict (id) do nothing;


-- ==========================================================
-- REGIONS & STATIONS INTEGRATION (MULTI-STATION EXTENSION)
-- ==========================================================

-- 6. REGIONS TABLE
create table public.regions (
    id uuid default gen_random_uuid() primary key,
    name varchar(100) not null,
    code varchar(50) not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for regions
alter table public.regions enable row level security;

-- 7. STATIONS TABLE
create table public.stations (
    id uuid default gen_random_uuid() primary key,
    region_id uuid references public.regions(id) on delete cascade not null,
    station_name varchar(255) not null,
    station_code varchar(50) not null unique,
    custody_amount decimal(15, 2) not null check (custody_amount >= 0) default 32000.00,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for stations
alter table public.stations enable row level security;

-- UPDATE USERS AND TRANSACTIONS SCHEMAS
alter table public.users add column station_id uuid references public.stations(id) on delete set null;
alter table public.users add column region_id uuid references public.regions(id) on delete set null;

alter table public.transactions add column station_id uuid references public.stations(id) on delete set null;

-- ==========================================================
-- MULTI-STATION RLS POLICIES
-- ==========================================================

-- Regions Policies
create policy "Allow authenticated users to read regions"
on public.regions for select
using (auth.role() = 'authenticated');

create policy "Allow System Admins full access to regions"
on public.regions for all
using (
    exists (
        select 1 from public.users
        where users.id = auth.uid() and users.role = 'Admin'
    )
);

-- Stations Policies
create policy "Allow authenticated users to read stations"
on public.stations for select
using (
    -- System Admin can read all stations
    exists (select 1 from public.users where users.id = auth.uid() and users.role = 'Admin') or
    -- Regional Manager can read stations in their region
    exists (select 1 from public.users where users.id = auth.uid() and users.role = 'RegionalManager' and stations.region_id = users.region_id) or
    -- Station Admin can only read their own station
    exists (select 1 from public.users where users.id = auth.uid() and (users.role = 'StationAdmin' or users.role = 'Regular') and stations.id = users.station_id)
);

create policy "Allow System Admins full access to stations"
on public.stations for all
using (
    exists (
        select 1 from public.users
        where users.id = auth.uid() and users.role = 'Admin'
    )
);

-- Update Transactions policies to enforce RBAC
-- (System Admin has full access, Regional Manager has view-only for their stations, Station Admin can view/insert/update their station)
drop policy "Allow authenticated users to read transactions" on public.transactions;
create policy "Enforce RBAC for reading transactions"
on public.transactions for select
using (
    -- System Admin full read
    exists (select 1 from public.users where users.id = auth.uid() and users.role = 'Admin') or
    -- Regional Manager reads transactions from stations in their region
    exists (
        select 1 from public.users u 
        join public.stations s on s.id = transactions.station_id 
        where u.id = auth.uid() and u.role = 'RegionalManager' and s.region_id = u.region_id
    ) or
    -- Station Admin reads their own station's transactions
    exists (
        select 1 from public.users u
        where u.id = auth.uid() and (u.role = 'StationAdmin' or u.role = 'Regular') and transactions.station_id = u.station_id
    )
);

-- SEED DATA FOR STATIONS AND REGIONS
insert into public.regions (id, name, code) values
('c8e5b61b-97bc-40d6-9566-b25866b1a293', 'Cairo Region', 'REG-CAI'),
('d5d7e5d8-c70e-4340-9a99-b1338dfd7d2a', 'Alexandria Region', 'REG-ALX')
on conflict do nothing;

insert into public.stations (id, region_id, station_name, station_code, custody_amount, is_active) values
('f24a1bfa-89df-4a6f-bd3c-e53b827df4ae', 'c8e5b61b-97bc-40d6-9566-b25866b1a293', 'New Cairo Hub', 'STN-NC', 30000.00, true),
('e9b0689b-81cc-4299-8d76-e3d16279f1df', 'c8e5b61b-97bc-40d6-9566-b25866b1a293', 'Maadi Branch', 'STN-MD', 20000.00, true),
('a281ff92-383c-4dfb-9db3-7033cb7cf5b2', 'd5d7e5d8-c70e-4340-9a99-b1338dfd7d2a', 'Alex Port Terminal', 'STN-AP', 25000.00, true)
on conflict do nothing;

