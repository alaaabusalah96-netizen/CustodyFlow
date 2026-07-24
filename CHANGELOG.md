# KEMIT ERP Development Change Log

All major architectural changes across the 24-phase modernization plan are recorded here in append-only format.

---

## Phase 1: Credential Security Remediation
**Date/Time:** 2026-07-23 00:50:00 UTC
**Files Changed:**
- `CHANGELOG.md` (Created)
- `firestore.rules`
- `server.ts`
- `src/pages/Login.tsx`
- `src/db/users.ts`

**Summary:**
Remediated credential security vulnerability by moving sensitive user password hashes and salts out of the publicly readable `users` collection into a strict Zero-Trust `user_credentials` vault. Client-side direct read/write access to `user_credentials` is denied in `firestore.rules` (`allow read, write: if false`). Implemented server-side authentication endpoint `/api/auth/verify-credentials` in `server.ts` using Firebase Admin SDK and Node's native `crypto.pbkdf2Sync` (PBKDF2 HMAC-SHA256 with OWASP 2023 recommended 210,000 iterations). Added auto-migration path upgrading legacy client hashes to 210k PBKDF2 server hashes on successful login. Retained client-side comparison behind `USE_SERVER_AUTH` feature flag for rollback protection.

**Test & Validation Result:**
Pass - Server build compiled successfully (`compile_applet`), linter passed (`lint_applet`), `user_credentials` collection rules verified deny-all for client SDKs, password auto-upgrades verified.

---

## Phase 2: Enterprise Organization Engine
**Date/Time:** 2026-07-23 01:16:00 UTC
**Files Changed:**
- `src/types/organization.ts` (Created)
- `src/db/organizationEngine.ts` (Created)
- `src/organization_engine.test.ts` (Created)
- `firestore.rules`
- `src/db/users.ts`
- `src/db/storage.ts`
- `CHANGELOG.md`

**Summary:**
Created the dynamic Organization Engine supporting flexible, unlimited multi-tenant organization structures without modifying code for different customer business structures. Defined interfaces and collections for `organization_units`, `organization_unit_types`, and `organization_paths`. Pre-seeded 10 standard unit types (Company, Holding, Sector, Region, Branch, Station, Department, Farm, Factory, Work Unit). Built automatic materialized path calculation (`/root/child/grandchild`), depth tracking, ancestor tracking, reparenting subtree recalculation, and child deletion protection in `OrganizationEngine`. Added Firestore security rules for `organization_units`, `organization_unit_types`, and `organization_paths`.

**Test & Validation Result:**
Pass - 39/39 tests passing across 4 test suites (`npm test`). Build compiled cleanly (`compile_applet`). All Firebase operations targeted `custodyflow` project only (`projectId: custodyflow`).

---

## Phase 3: Organization Templates
**Date/Time:** 2026-07-23 01:24:00 UTC
**Files Changed:**
- `src/types/organization.ts`
- `src/db/organizationEngine.ts`
- `firestore.rules`
- `src/organization_engine.test.ts`
- `CHANGELOG.md`

**Summary:**
Added predefined industry Organization Templates in `OrganizationEngine` covering 9 standard industry domains: Trading, Manufacturing, Poultry, Construction, Healthcare, Retail, Restaurants, Holding Company, and Educational. Implemented interfaces `OrganizationTemplate` and `OrganizationTemplateUnitSpec` in `src/types/organization.ts`. Built `addCustomTemplate` allowing administrators to construct custom templates, and `applyTemplateToCompany` to instantiate all hierarchical organization units, codes, names, and materialized paths automatically for any company. Added Firestore rules for `organization_templates`.

**Test & Validation Result:**
Pass - 42/42 tests passing across 4 test suites (`npm test`). Server build compiled cleanly (`compile_applet`). All Firebase operations targeted `custodyflow` project only (`projectId: custodyflow`).

---

## Phase 4: Dynamic Organization Builder
**Date/Time:** 2026-07-23 01:27:00 UTC
**Files Changed:**
- `src/types/organization.ts`
- `src/db/organizationEngine.ts`
- `src/organization_engine.test.ts`
- `CHANGELOG.md`

**Summary:**
Implemented Phase 4 Dynamic Organization Builder enabling arbitrary, unlimited hierarchy depth without requiring code modifications for any business model (e.g. Holding -> Company -> Sector -> Region -> Station -> Farm -> Shift, or Company -> Factory -> Line -> Shift). Added `OrganizationTreeNode` interface and `buildTree()` recursive builder method for nested UI component rendering. Built `getTreeFlatView()` generating indented depth-aware views. Implemented `moveUnit()` for dynamic reparenting with cycle validation (preventing reparenting under descendants). Added `validateHierarchyTree()` auditing tools checking for orphan nodes, cycle dependencies, and path levels, plus `getMaxHierarchyDepth()` and `getUnitsAtLevel()`.

**Test & Validation Result:**
Pass - 46/46 tests passing across 4 test suites (`npm test`). Server build compiled cleanly (`compile_applet`). All Firebase operations targeted `custodyflow` project only (`projectId: custodyflow`).

---

## Phase 5: Warehouse Hierarchy Engine
**Date/Time:** 2026-07-23 01:33:00 UTC
**Files Changed:**
- `src/types/inventory.ts`
- `src/db/warehouseHierarchyEngine.ts`
- `src/db/inventory.ts`
- `firestore.rules`
- `src/warehouse_hierarchy.test.ts`
- `CHANGELOG.md`

**Summary:**
Implemented Phase 5 Warehouse Hierarchy Engine transforming warehouses into a multi-level hierarchical structure. Created `WarehouseType` supporting 9 predefined standard warehouse types (Main, Sub, Production, Raw Material, Finished Goods, Returns, Damaged/Scrap, Transit, Spare Parts) plus unlimited company-specific custom warehouse types. Extended `Warehouse` interface with `parent_id`, `type_id`, `type_code`, `org_unit_id`, `path`, `level`, and `metadata`. Built `WarehouseHierarchyEngine` providing `addWarehouseType`, `computePathAndLevel`, `addWarehouse`, `updateWarehouse`, `moveWarehouse` (with cycle prevention), `buildWarehouseTree` (nested tree builder), `getWarehouseInclusiveStock` (stock rollup across main warehouse and all descendant sub-warehouses), and `validateWarehouseHierarchy` audit tool. Updated Firestore security rules for `/warehouse_types/{id}`.

**Test & Validation Result:**
Pass - 53/53 tests passing across 5 test suites (`npm test`). Server build compiled cleanly (`compile_applet`). All Firebase operations targeted `custodyflow` project only (`projectId: custodyflow`).

---

## Phase 6: Dynamic Warehouse Templates
**Date/Time:** 2026-07-23 01:36:00 UTC
**Files Changed:**
+- `src/types/inventory.ts`
+- `src/db/warehouseTemplateEngine.ts`
+- `firestore.rules`
+- `src/warehouse_templates.test.ts`
+- `CHANGELOG.md`

**Summary:**
Implemented Phase 6 Dynamic Warehouse Templates supporting industry-tailored warehouse layouts: Factory Template (Main, Raw Materials, Production Line, Finished Goods, Quality/Quarantine Returns, Scrap/Damaged, Spare Parts), Trading Template (Central Hub, Wholesale Reserve, Transit, Customer Returns, Damaged), Retail Template (Main Store, Showroom Display, Backroom Reserve, Store Returns), Restaurant Template (Central Kitchen Commissary, Freezers & Cold Storage, Prep Kitchen Line, Dry Goods, Food Waste), Poultry & Farm Agriculture Template (Farm Compound, Feed Silo, Vet & Meds, Packing & Output, Mortality), and Custom Flexible Template. Added `WarehouseTemplate` and `WarehouseTemplateNode` interfaces, `addWarehouseTemplate()`, and `instantiateWarehouseTemplate()` which recursively generates concrete hierarchical warehouses linked to Organization Units with customized code and name prefixes. Added Firestore security rules for `/warehouse_templates/{id}`.

**Test & Validation Result:**
Pass - 58/58 tests passing across 6 test suites (`npm test`). Server build compiled cleanly (`compile_applet`). All Firebase operations targeted `custodyflow` project only (`projectId: custodyflow`).

---

## Phase 7: Permission Scope Engine
**Date/Time:** 2026-07-24 07:25:00 UTC
**Files Changed:**
- `src/types.ts`
- `src/types/enterprise.ts`
- `src/db/organizationScopeEngine.ts`
- `src/db/organizationEngine.ts`
- `src/db/stations.ts`
- `src/permission_scope.test.ts`
- `CHANGELOG.md`

**Summary:**
Implemented Phase 7 Permission Scope Engine replacing fixed Region Scope with dynamic, tree-inheriting Organization Scope. Extended `AppUser` and `PermissionContext` with `org_unit_id` and `assigned_org_unit_ids`. Created `OrganizationScopeEngine` in `src/db/organizationScopeEngine.ts` providing:
1. `getAccessibleOrgUnitIds()`: Calculates all accessible organization unit IDs with automatic tree inheritance down the organization hierarchy (assigning a user to a parent unit like a Region or Sector grants automatic access to all child branches, stations, and departments via path matching and tree descendants).
2. `isOrgUnitInScope()` & `isTargetInUserScope()`: Evaluates scope access for records linked to `org_unit_id`, `region_id`, or `station_id` with backward compatibility fallback for legacy structures.
3. `filterByOrganizationScope()`: Filters query result arrays according to user organization scope.
4. `hasScopedPermission()`: Integrates enterprise RBAC permission checks with tree organization scope.
Added `OrganizationEngine` compatibility aliases (`getOrganizationUnits`, `addOrganizationUnit`, `getDescendantUnits`). Integrated Organization Scope checks into `StationsModule`. Created comprehensive unit test suite in `src/permission_scope.test.ts`.

**Test & Validation Result:**
Pass - 62/62 tests passing across 7 test suites (`npm test`). Applet build succeeded cleanly (`compile_applet`). All Firebase operations targeted `custodyflow` project only (`projectId: custodyflow`).



