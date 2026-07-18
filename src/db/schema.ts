import { pgTable, text, real, boolean, jsonb } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  custodyValue: real('custody_value'),
  isActive: boolean('is_active'),
  subscriptionStatus: text('subscription_status'),
  subscriptionExpiry: text('subscription_expiry'),
  subscriptionPlan: text('subscription_plan'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
  modules: jsonb('modules'),
  groupId: text('group_id'),
  statusMerge: text('status_merge'),
  mergedIntoCompanyId: text('merged_into_company_id'),
  useCustomTemplate: boolean('use_custom_template'),
  customTemplateImage: text('custom_template_image'),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull(),
  permissions: jsonb('permissions').notNull(),
  stationId: text('station_id'),
  regionId: text('region_id'),
  companyId: text('company_id'),
  isActive: boolean('is_active'),
  password: text('password'),
  securityPin: text('security_pin'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
});

export const regions = pgTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  companyId: text('company_id'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
});

export const stations = pgTable('stations', {
  id: text('id').primaryKey(),
  regionId: text('region_id'),
  stationName: text('station_name').notNull(),
  stationCode: text('station_code').notNull(),
  custodyAmount: real('custody_amount').notNull(),
  isActive: boolean('is_active').notNull(),
  companyId: text('company_id'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
});

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  transactionNo: text('transaction_no').notNull(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  categoryId: text('category_id'),
  amount: real('amount').notNull(),
  items: jsonb('items'),
  amountInWords: jsonb('amount_in_words'),
  notes: text('notes'),
  status: text('status').notNull(),
  voucherNo: text('voucher_no'),
  voucherDate: text('voucher_date'),
  invoiceNo: text('invoice_no'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  stationId: text('station_id'),
  companyId: text('company_id'),
  attachments: jsonb('attachments'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
});

export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  timestamp: text('timestamp').notNull(),
  stationId: text('station_id'),
  companyId: text('company_id'),
  amount: real('amount'),
  notes: text('notes'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  stationName: text('station_name'),
  regionName: text('region_name'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  device: text('device'),
  actionType: text('action_type').notNull(),
  description: text('description').notNull(),
  timestamp: text('timestamp').notNull(),
  details: jsonb('details'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
  companyId: text('company_id'),
});

export const systemPermissions = pgTable('system_permissions', {
  id: text('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  descriptionEn: text('description_en').notNull(),
  descriptionAr: text('description_ar').notNull(),
  category: text('category').notNull(),
});

export const systemRoles = pgTable('system_roles', {
  id: text('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  permissions: jsonb('permissions').notNull(),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const deletedTransactions = pgTable('deleted_transactions', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull(),
  transactionNo: text('transaction_no').notNull(),
  transactionData: jsonb('transaction_data').notNull(),
  transactionType: text('transaction_type').notNull(),
  amount: real('amount').notNull(),
  createdByName: text('created_by_name').notNull(),
  deletedByName: text('deleted_by_name').notNull(),
  deletedByRole: text('deleted_by_role').notNull(),
  deletedAt: text('deleted_at').notNull(),
  deleteReason: text('delete_reason').notNull(),
  stationName: text('station_name').notNull(),
  regionName: text('region_name').notNull(),
  branch: text('branch'),
  companyId: text('company_id').notNull(),
  description: text('description'),
  originalStatus: text('original_status'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
});

export const signupRequests = pgTable('signup_requests', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull(),
  companyId: text('company_id').notNull(),
  regionId: text('region_id'),
  stationId: text('station_id'),
  password: text('password'),
  createdAt: text('created_at').notNull(),
  status: text('status').notNull(),
  rejectionReason: text('rejection_reason'),
  tenantId: text('tenant_id'),
  organizationId: text('organization_id'),
});
