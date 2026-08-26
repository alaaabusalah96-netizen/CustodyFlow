import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc 
} from "firebase/firestore";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert as adminCert, App as AdminApp } from "firebase-admin/app";
import { getFirestore as getFirestoreAdmin, FieldValue } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { runTenantMigrationUp, runTenantMigrationDown } from "./src/migrations/tenantMigration";
import { hashPassword, legacyHashPassword, legacySinglePassHashPassword, legacyStretchedHashPassword1000, getPepperByVersion, hashPasswordPBKDF2_210k, getLegacyHashDeprecationPolicy } from "./src/lib/server_hash";
import { 
  DEFAULT_COMPANIES, 
  DEFAULT_REGIONS, 
  DEFAULT_STATIONS, 
  DEFAULT_ORGANIZATION_UNITS, 
  DEFAULT_CATEGORIES, 
  DEFAULT_USERS, 
  DEFAULT_TRANSACTIONS, 
  DEFAULT_LOGS, 
  DEFAULT_CONFIG, 
  DEFAULT_PERMISSIONS, 
  DEFAULT_ROLES 
} from "./src/db/defaults";

function generateSecureTemporaryPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < 16; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

const firebaseConfig = {
  projectId: "custodyflow",
  appId: "1:88602135716:web:b77559202f5e9f233d6a31",
  apiKey: "AIzaSyA2I_2GIEfQhawBL2KhXyxD6CwTLJR-jFw",
  authDomain: "custodyflow.firebaseapp.com",
  storageBucket: "custodyflow.firebasestorage.app",
  messagingSenderId: "88602135716"
};

const firebaseApp = initializeApp(firebaseConfig);
const DATABASE_ID = "ai-studio-custodyflow-b2f42bf6-7a6a-43a4-9986-3d46405d5ebe";
const db = getFirestore(firebaseApp, DATABASE_ID);

// Initialize Firebase Admin SDK
function getAdminApp(): AdminApp {
  const existingApps = getAdminApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawServiceAccount) {
    try {
      let cleaned = rawServiceAccount.trim();
      if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
        cleaned = cleaned.slice(1, -1).trim();
      }
      if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
        try {
          const decoded = Buffer.from(cleaned, 'base64').toString('utf-8').trim();
          if (decoded.startsWith('{')) {
            cleaned = decoded;
          }
        } catch (_) {
          // Keep cleaned as is if base64 decode fails
        }
      }
      const serviceAccount = JSON.parse(cleaned);
      if (serviceAccount && typeof serviceAccount === 'object') {
        if (typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        return initializeAdminApp({
          credential: adminCert(serviceAccount)
        });
      }
    } catch (err) {
      console.error("Error initializing Firebase Admin with FIREBASE_SERVICE_ACCOUNT:", err);
    }
  }

  const appsAfter = getAdminApps();
  if (appsAfter.length > 0 && appsAfter[0]) {
    return appsAfter[0];
  }

  try {
    return initializeAdminApp({
      projectId: firebaseConfig.projectId
    });
  } catch (err) {
    const finalApps = getAdminApps();
    if (finalApps.length > 0 && finalApps[0]) {
      return finalApps[0];
    }
    throw err;
  }
}

const adminApp = getAdminApp();
const adminDb = getFirestoreAdmin(adminApp, DATABASE_ID);


import helmet from "helmet";

async function startServer() {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: false, // Allow AI Studio iframe preview and Vite development inline/eval scripts
    frameguard: false, // Allow embedding in AI Studio preview iframe
    crossOriginEmbedderPolicy: false
  }));
  const PORT = 3000;

  const isProductionLike = process.env.NODE_ENV === 'production' || process.env.STRICT_PROD_SECURITY === 'true';
  if (!process.env.APP_PEPPER) {
    if (isProductionLike) {
      console.error("CRITICAL SECURITY ERROR: APP_PEPPER environment variable is not set in a production/strict environment. Refusing to start.");
      process.exit(1);
    }
    console.warn("[Security Notice] APP_PEPPER is not set. Server will start in non-strict/dev mode with a fallback pepper — do NOT use this in production.");
  }

  // Trust first proxy in Cloud Run / Nginx container environment for rate limiter IP resolution
  app.set("trust proxy", 1);

  app.use(express.json());
  app.use(cookieParser());

  // Rate limiting for auth & OTP endpoints to prevent brute-force/DOS
  const otpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 requests per 15 minutes per IP
    message: {
      success: false,
      message: "تم تجاوز الحد الأقصى للطلبات من هذا الجهاز. يرجى المحاولة مرة أخرى بعد 15 دقيقة."
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const PLATFORM_OWNER_EMAIL = (process.env.PLATFORM_OWNER_EMAIL || "").toLowerCase().trim();

  async function isPlatformAdminUser(email?: string, userData?: any): Promise<boolean> {
    if (userData?.is_platform_owner === true || userData?.role === 'SystemAdmin') return true;
    const targetEmail = (email || userData?.email || '').toLowerCase().trim();
    if (!targetEmail) return false;
    if (PLATFORM_OWNER_EMAIL && targetEmail === PLATFORM_OWNER_EMAIL) return true;
    try {
      const snapshot = await adminDb.collection("users").where("email", "==", targetEmail).limit(1).get();
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return data?.is_platform_owner === true || data?.role === 'SystemAdmin';
      }
    } catch (err) {
      console.error("isPlatformAdminUser lookup error:", err);
    }
    return false;
  }

  // Middleware helper to verify Firebase ID token and user role
  async function verifyUserRole(req: express.Request, allowedRoles: string[]): Promise<{ authorized: boolean; statusCode: number; message: string; user?: any }> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { authorized: false, statusCode: 401, message: "Unauthorized: Missing authentication token / يلزم وجود رمز المصادقة." };
    }

    const idToken = authHeader.split("Bearer ")[1]?.trim();
    if (!idToken) {
      return { authorized: false, statusCode: 401, message: "Unauthorized: Invalid authentication token / رمز المصادقة غير صالح." };
    }

    try {
      const decodedToken = await getAdminAuth(adminApp).verifyIdToken(idToken);
      const uid = decodedToken.uid;

      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return { authorized: false, statusCode: 403, message: "Forbidden: User record not found / لا تملك صلاحية الوصول." };
      }

      const userData = userDoc.data();
      const userRole = userData?.role || "";
      const isPlatformOwner = await isPlatformAdminUser(userData?.email, userData);

      if (isPlatformOwner || allowedRoles.includes(userRole)) {
        return { authorized: true, statusCode: 200, message: "Authorized", user: userData };
      }

      return { authorized: false, statusCode: 403, message: "Forbidden: Insufficient privileges / تطلب صلاحية أعلى." };
    } catch (err: any) {
      console.error("Token verification failed:", err);
      return { authorized: false, statusCode: 401, message: "Unauthorized: Token verification failed / فشلت عملية المصادقة." };
    }
  }

  async function requireSystemAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const result = await verifyUserRole(req, ["SystemAdmin"]);
    if (!result.authorized) {
      return res.status(result.statusCode).json({ success: false, message: result.message });
    }
    (req as any).user = result.user;
    next();
  }

  async function requireAdminOrSystemAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const result = await verifyUserRole(req, ["SystemAdmin", "Admin"]);
    if (!result.authorized) {
      return res.status(result.statusCode).json({ success: false, message: result.message });
    }
    (req as any).user = result.user;
    next();
  }

  // API Route - Run Tenant Migration (UP)
  app.post("/api/migrations/up", requireSystemAdminAuth, async (req, res) => {
    try {
      console.log("Migration endpoint triggered [UP]");
      const result = await runTenantMigrationUp(db);
      return res.json(result);
    } catch (err: any) {
      console.error("Migration UP endpoint error:", err);
      return res.status(500).json({
        success: false,
        message: `Migration failed: ${err.message}`,
        details: {}
      });
    }
  });

  // API Route - Rollback Tenant Migration (DOWN)
  app.post("/api/migrations/down", requireSystemAdminAuth, async (req, res) => {
    try {
      console.log("Migration endpoint triggered [DOWN]");
      const result = await runTenantMigrationDown(db);
      return res.json(result);
    } catch (err: any) {
      console.error("Migration DOWN endpoint error:", err);
      return res.status(500).json({
        success: false,
        message: `Rollback failed: ${err.message}`,
        details: {}
      });
    }
  });


  // API Route - Platform Status (checks if any SystemAdmin/super_admin/platform_owner exists)
  app.get("/api/auth/platform-status", async (req, res) => {
    try {
      const sysAdminSnap = await adminDb.collection("users").where("role", "==", "SystemAdmin").limit(1).get();
      let hasOwner = !sysAdminSnap.empty;
      if (!hasOwner) {
        const superAdminSnap = await adminDb.collection("users").where("role", "==", "super_admin").limit(1).get();
        hasOwner = !superAdminSnap.empty;
      }
      if (!hasOwner) {
        const ownerSnap = await adminDb.collection("users").where("is_platform_owner", "==", true).limit(1).get();
        hasOwner = !ownerSnap.empty;
      }
      return res.json({ hasPlatformOwner: hasOwner });
    } catch (err: any) {
      console.error("Error checking platform status:", err);
      return res.status(500).json({ success: false, message: "Error checking platform status" });
    }
  });

  // API Route - First-Run Super Admin Setup
  app.post("/api/auth/bootstrap-platform-owner", otpRateLimiter, async (req, res) => {
    try {
      // 1. Live Firestore check: Reject if any Super Admin / SystemAdmin / Platform Owner exists
      const sysAdminSnap = await adminDb.collection("users").where("role", "==", "SystemAdmin").limit(1).get();
      let hasOwner = !sysAdminSnap.empty;
      if (!hasOwner) {
        const superAdminSnap = await adminDb.collection("users").where("role", "==", "super_admin").limit(1).get();
        hasOwner = !superAdminSnap.empty;
      }
      if (!hasOwner) {
        const ownerSnap = await adminDb.collection("users").where("is_platform_owner", "==", true).limit(1).get();
        hasOwner = !ownerSnap.empty;
      }

      if (hasOwner) {
        return res.status(403).json({
          success: false,
          message: "الحساب الرئيسي تم إعداده بالفعل / Platform owner already set up."
        });
      }

      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "يرجى إدخال البريد الإلكتروني وكلمة المرور." });
      }

      const emailLower = email.toLowerCase().trim();
      if (!process.env.PLATFORM_OWNER_EMAIL) {
        console.error("CRITICAL: PLATFORM_OWNER_EMAIL environment variable is not set. Refusing to bootstrap.");
        return res.status(500).json({ success: false, message: "Platform owner email is not configured on the server." });
      }
      const configuredOwnerEmail = process.env.PLATFORM_OWNER_EMAIL.toLowerCase().trim();

      // 2. Strict email match against PLATFORM_OWNER_EMAIL environment variable
      if (emailLower !== configuredOwnerEmail) {
        return res.status(400).json({
          success: false,
          message: "البريد الإلكتروني المكتوب لا يطابق بريد المدير الأساسي المعتمد في المنصة."
        });
      }

      // 3. Strict password strength validation (min 12 chars, letters + numbers)
      if (password.length < 12 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({
          success: false,
          message: "كلمة المرور يجب أن تتكون من 12 حرف على الأقل، وتحتوي على حروف وأرقام."
        });
      }

      // 4. Create or update user in Firebase Auth
      let authUser;
      try {
        authUser = await getAdminAuth(adminApp).getUserByEmail(emailLower);
        await getAdminAuth(adminApp).updateUser(authUser.uid, { password });
      } catch (e) {
        authUser = await getAdminAuth(adminApp).createUser({
          email: emailLower,
          password,
          displayName: "Super Admin",
        });
      }
      const userId = authUser.uid;

      // 5. Create user doc in 'users' collection
      const userDocData = {
        id: userId,
        email: emailLower,
        full_name: "Super Admin",
        role: "SystemAdmin",
        is_active: true,
        is_platform_owner: true,
        company_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        permissions: {
          create_expense: true, edit_expense: true, delete_expense: true,
          create_voucher: true, approve_voucher: true, reject_voucher: true,
          create_custody: true, edit_custody: true, replace_custody: true,
          view_reports: true, manage_users: true, manage_companies: true,
          manage_regions: true, manage_stations: true, manage_roles: true,
          manage_settings: true, settle_voucher: true,
        }
      };
      await adminDb.collection("users").doc(userId).set(userDocData);

      // 6. Hash password with PBKDF2 210,000 iterations and store in 'user_credentials' vault
      const salt = crypto.randomUUID();
      const pbkdf2Hash = hashPasswordPBKDF2_210k(password, salt, 2);
      await adminDb.collection("user_credentials").doc(userId).set({
        id: userId,
        company_id: 'platform',
        email: emailLower,
        passwordHash: pbkdf2Hash,
        salt,
        kdf: 'sha256_pbkdf2_210k',
        pepper_version: 2,
        updated_at: new Date().toISOString()
      });

      // 7. Issue custom token
      const customToken = await getAdminAuth(adminApp).createCustomToken(userId);

      return res.json({
        success: true,
        user: userDocData,
        customToken
      });
    } catch (err: any) {
      console.error("bootstrap-platform-owner error:", err);
      return res.status(500).json({ success: false, message: err?.message || "Error bootstrapping platform owner" });
    }
  });

  // API Route - Issue HttpOnly Session Cookie (Defense-in-depth against XSS)
  app.post("/api/auth/session", otpRateLimiter, async (req, res) => {
    try {
      let idToken = req.body?.idToken;
      if (!idToken) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          idToken = authHeader.substring(7);
        }
      }

      if (!idToken) {
        return res.status(401).json({ success: false, message: "ID Token is required" });
      }

      try {
        await getAdminAuth(adminApp).verifyIdToken(idToken);
      } catch (verifyErr) {
        return res.status(401).json({ success: false, message: "Invalid ID Token" });
      }

      const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
      const sessionCookie = await getAdminAuth(adminApp).createSessionCookie(idToken, { expiresIn });

      res.cookie('session', sessionCookie, {
        maxAge: expiresIn,
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/'
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error("Session creation error:", err);
      return res.status(500).json({ success: false, message: "Failed to create session" });
    }
  });

  // API Route - Revoke Session Cookie & Clear
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const sessionCookie = req.cookies?.session;
      if (sessionCookie) {
        try {
          const decodedClaims = await getAdminAuth(adminApp).verifySessionCookie(sessionCookie);
          if (decodedClaims?.uid) {
            await getAdminAuth(adminApp).revokeRefreshTokens(decodedClaims.uid);
          }
        } catch (_) {
          // Ignore invalid or expired session cookie
        }
      }
    } catch (err) {
      console.error("Logout session revocation error:", err);
    } finally {
      res.clearCookie('session', { path: '/' });
      return res.json({ success: true });
    }
  });

  // Helper for Authenticating requests via Bearer Token or Session Cookie
  async function authenticateSessionOrBearer(req: express.Request): Promise<{ authenticated: boolean; statusCode: number; message: string; user?: any }> {
    let uid: string | null = null;

    // 1. Check Bearer Token from Authorization Header first (explicit active client token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.substring(7).trim();
      if (idToken) {
        try {
          const decoded = await getAdminAuth(adminApp).verifyIdToken(idToken);
          uid = decoded.uid;
        } catch (_) {
          // Invalid Bearer token, fall back to session cookie
        }
      }
    }

    // 2. Check Session Cookie if Bearer Token is missing/invalid
    if (!uid) {
      const sessionCookie = req.cookies?.session;
      if (sessionCookie) {
        try {
          const decoded = await getAdminAuth(adminApp).verifySessionCookie(sessionCookie, true);
          uid = decoded.uid;
        } catch (_) {
          // Invalid or expired session cookie
        }
      }
    }

    if (!uid) {
      return { authenticated: false, statusCode: 401, message: "Unauthorized: Missing or invalid authentication token or session cookie." };
    }

    try {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return { authenticated: false, statusCode: 403, message: "Forbidden: Authenticated user record not found." };
      }

      const userData = userDoc.data();
      if (!userData || userData.is_active === false) {
        return { authenticated: false, statusCode: 403, message: "Forbidden: User account is inactive." };
      }

      return { authenticated: true, statusCode: 200, message: "Authorized", user: { ...userData, id: uid } };
    } catch (err: any) {
      console.error("Auth check error in authenticateSessionOrBearer:", err);
      return { authenticated: false, statusCode: 500, message: "Server error during authentication check." };
    }
  }

  // API Route - Unified Secure User Provisioning Endpoint (POST /api/admin/users)
  app.post("/api/admin/users", async (req, res) => {
    try {
      // 1. AuthN
      const authResult = await authenticateSessionOrBearer(req);
      if (!authResult.authenticated) {
        return res.status(authResult.statusCode).json({ success: false, message: authResult.message });
      }

      const creator = authResult.user;
      const isPlatformAdmin = await isPlatformAdminUser(creator.email, creator);

      // 2. AuthZ
      if (!isPlatformAdmin && creator.role !== "Admin") {
        return res.status(403).json({ success: false, message: "Forbidden: Insufficient privileges to manage users / غير مصرح لك بإدارة المستخدمين." });
      }

      const {
        email,
        full_name,
        role,
        company_id,
        region_id,
        station_id,
        org_unit_id,
        assigned_org_unit_ids,
        permissions,
        password,
        must_change_password
      } = req.body || {};

      // Determine effective password (manual if provided >= 8 chars, otherwise auto-generate >= 8 chars)
      let effectivePassword = "";
      if (password !== undefined && password !== null && typeof password === 'string' && password.trim() !== '') {
        const trimmed = password.trim();
        if (trimmed.length < 8) {
          return res.status(400).json({
            success: false,
            message: "كلمة المرور يجب أن لا تقل عن 8 أحرف / Password must be at least 8 characters."
          });
        }
        effectivePassword = trimmed;
      } else {
        effectivePassword = generateSecureTemporaryPassword();
      }

      // 3. Validation: Prevent creating SystemAdmin or setting is_platform_owner
      if (role === 'SystemAdmin' || role === 'super_admin' || req.body.is_platform_owner === true) {
        return res.status(403).json({ success: false, message: "لا يمكن إنشاء حساب مدير نظام من هذا المسار / Cannot create SystemAdmin or Platform Owner via this endpoint." });
      }

      // Required fields validation
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: "البريد الإلكتروني مطلوب / Email is required." });
      }
      if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
        return res.status(400).json({ success: false, message: "الاسم الكامل مطلوب / Full name is required." });
      }
      if (!role || typeof role !== 'string' || !role.trim()) {
        return res.status(400).json({ success: false, message: "الدور الوظيفي مطلوب / Role is required." });
      }

      const emailLower = email.toLowerCase().trim();

      // Company Admin Scope Check
      if (!isPlatformAdmin) {
        if (!company_id || company_id !== creator.company_id) {
          return res.status(403).json({ success: false, message: "غير مصرح لك بإضافة مستخدم لشركة أخرى / Admin cannot create user for another company." });
        }
      } else {
        if (!company_id || typeof company_id !== 'string' || !company_id.trim()) {
          return res.status(400).json({ success: false, message: "معرف الشركة مطلوب / company_id is required." });
        }
      }

      // Role-specific binding requirements
      if (role === 'Admin' && !company_id) {
        return res.status(400).json({ success: false, message: "معرف الشركة مطلوب لدور مدير الشركة / company_id is required for Admin." });
      }
      if (role === 'RegionalManager' && (!region_id || typeof region_id !== 'string' || !region_id.trim())) {
        return res.status(400).json({ success: false, message: "المنطقة مطلوبة لهذا الدور / region_id is required for RegionalManager." });
      }
      if (role === 'StationAdmin' && (!station_id || typeof station_id !== 'string' || !station_id.trim())) {
        return res.status(400).json({ success: false, message: "المحطة مطلوبة لهذا الدور / station_id is required for StationAdmin." });
      }

      // Region/Station belong to company check
      if (region_id) {
        const regDoc = await adminDb.collection("regions").doc(region_id).get();
        if (!regDoc.exists || regDoc.data()?.company_id !== company_id) {
          return res.status(400).json({ success: false, message: "المنطقة غير موجودة أو لا تنتمي للشركة المحجوزة / Region does not belong to company." });
        }
      }
      if (station_id) {
        const stDoc = await adminDb.collection("stations").doc(station_id).get();
        if (!stDoc.exists || stDoc.data()?.company_id !== company_id) {
          return res.status(400).json({ success: false, message: "المحطة غير موجودة أو لا تنتمي للشركة المحجوزة / Station does not belong to company." });
        }
      }

      // Unique email check in Firestore 'users' collection
      const existingUserSnap = await adminDb.collection("users").where("email", "==", emailLower).limit(1).get();
      if (!existingUserSnap.empty) {
        return res.status(400).json({ success: false, message: "البريد الإلكتروني مسجل بالفعل / Email already exists." });
      }

      // Unique email check in Firebase Auth
      let existingAuthUser = null;
      try {
        existingAuthUser = await getAdminAuth(adminApp).getUserByEmail(emailLower);
      } catch (_) {
        // Expected if user does not exist
      }
      if (existingAuthUser) {
        return res.status(400).json({ success: false, message: "البريد الإلكتروني مسجل بالفعل في نظام المصادقة / Email already exists in Auth system." });
      }

      // Create Firebase Auth user with effective password
      const authUser = await getAdminAuth(adminApp).createUser({
        email: emailLower,
        password: effectivePassword,
        displayName: full_name.trim()
      });
      const userId = authUser.uid;

      // Vault password in 'user_credentials' with PBKDF2 210,000 iterations
      const salt = crypto.randomUUID();
      const pbkdf2Hash = hashPasswordPBKDF2_210k(effectivePassword, salt, 2);
      await adminDb.collection("user_credentials").doc(userId).set({
        id: userId,
        company_id: company_id,
        email: emailLower,
        passwordHash: pbkdf2Hash,
        salt: salt,
        kdf: 'sha256_pbkdf2_210k',
        pepper_version: 2,
        updated_at: new Date().toISOString()
      });

      // Construct 'users' document WITHOUT plaintext password field
      const userDocData = {
        id: userId,
        email: emailLower,
        full_name: full_name.trim(),
        role: role.trim(),
        company_id: company_id,
        region_id: region_id || null,
        station_id: station_id || null,
        org_unit_id: org_unit_id || null,
        assigned_org_unit_ids: Array.isArray(assigned_org_unit_ids) ? assigned_org_unit_ids : [],
        permissions: permissions && typeof permissions === 'object' ? permissions : {},
        must_change_password: typeof must_change_password === 'boolean' ? must_change_password : true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await adminDb.collection("users").doc(userId).set(userDocData);

      // Audit Log
      try {
        await adminDb.collection("audit_logs").add({
          action: "user_provisioned",
          performed_by: creator.id || creator.email,
          performed_by_email: creator.email,
          target_user_id: userId,
          target_email: emailLower,
          company_id: company_id,
          timestamp: new Date().toISOString(),
          details: { role, full_name, region_id, station_id, org_unit_id }
        });
      } catch (auditErr) {
        console.warn("Audit log write failed during user creation:", auditErr);
      }

      return res.status(201).json({
        success: true,
        temporaryPassword: effectivePassword,
        user: userDocData
      });
    } catch (err: any) {
      console.error("Error creating user in /api/admin/users:", err);
      return res.status(500).json({ success: false, message: err?.message || "Internal server error creating user." });
    }
  });

  // API Route - Unified Secure User Update Endpoint (PATCH /api/admin/users/:id)
  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      const authResult = await authenticateSessionOrBearer(req);
      if (!authResult.authenticated) {
        return res.status(authResult.statusCode).json({ success: false, message: authResult.message });
      }

      const creator = authResult.user;
      const isPlatformAdmin = await isPlatformAdminUser(creator.email, creator);

      if (!isPlatformAdmin && creator.role !== "Admin") {
        return res.status(403).json({ success: false, message: "Forbidden: Insufficient privileges / غير مصرح لك بتحديث المستخدمين." });
      }

      const targetUserId = req.params.id;
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: "Target user ID is required." });
      }

      const targetDoc = await adminDb.collection("users").doc(targetUserId).get();
      if (!targetDoc.exists) {
        return res.status(404).json({ success: false, message: "المستخدم غير موجود / User not found." });
      }

      const targetData = targetDoc.data() || {};
      const isTargetPlatformAdmin = await isPlatformAdminUser(targetData.email, targetData);

      // SystemAdmin / Platform Owner protection
      if (isTargetPlatformAdmin && !isPlatformAdmin) {
        return res.status(403).json({ success: false, message: "غير مصرح لك بتعديل بيانات مدير النظام / Cannot modify SystemAdmin user." });
      }

      const {
        full_name,
        role,
        company_id,
        region_id,
        station_id,
        org_unit_id,
        assigned_org_unit_ids,
        permissions,
        is_active,
        must_change_password,
        password
      } = req.body || {};

      // Cannot promote to SystemAdmin via this endpoint
      if (role === 'SystemAdmin' || role === 'super_admin' || req.body.is_platform_owner === true) {
        return res.status(403).json({ success: false, message: "لا يمكن الترقية إلى مدير نظام عبر هذا المسار / Cannot promote to SystemAdmin via this endpoint." });
      }

      // Company Admin Scope Check
      if (!isPlatformAdmin) {
        if (targetData.company_id !== creator.company_id) {
          return res.status(403).json({ success: false, message: "غير مصرح لك بتعديل مستخدم ينتمي لشركة أخرى / Admin cannot edit user from another company." });
        }
        if (company_id !== undefined && company_id !== creator.company_id) {
          return res.status(403).json({ success: false, message: "غير مصرح لك بنقل مستخدم لشركة أخرى / Admin cannot move user to another company." });
        }
      }

      const effectiveCompanyId = company_id !== undefined ? company_id : targetData.company_id;
      const effectiveRole = role !== undefined ? role : targetData.role;
      const effectiveRegionId = region_id !== undefined ? region_id : targetData.region_id;
      const effectiveStationId = station_id !== undefined ? station_id : targetData.station_id;

      // Role-specific binding validation on effective values
      if (effectiveRole === 'RegionalManager' && !effectiveRegionId) {
        return res.status(400).json({ success: false, message: "المنطقة مطلوبة لهذا الدور / region_id is required for RegionalManager." });
      }
      if (effectiveRole === 'StationAdmin' && !effectiveStationId) {
        return res.status(400).json({ success: false, message: "المحطة مطلوبة لهذا الدور / station_id is required for StationAdmin." });
      }

      // Validate region/station belong to company if changed or set
      if (region_id) {
        const regDoc = await adminDb.collection("regions").doc(region_id).get();
        if (!regDoc.exists || regDoc.data()?.company_id !== effectiveCompanyId) {
          return res.status(400).json({ success: false, message: "المنطقة غير موجودة أو لا تنتمي للشركة / Region does not belong to company." });
        }
      }
      if (station_id) {
        const stDoc = await adminDb.collection("stations").doc(station_id).get();
        if (!stDoc.exists || stDoc.data()?.company_id !== effectiveCompanyId) {
          return res.status(400).json({ success: false, message: "المحطة غير موجودة أو لا تنتمي للشركة / Station does not belong to company." });
        }
      }

      // Password reset if password string provided
      if (password !== undefined && password !== null && password !== "") {
        if (typeof password !== 'string' || password.length < 12 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
          return res.status(400).json({
            success: false,
            message: "كلمة المرور يجب أن تتكون من 12 حرف على الأقل وتحتوي على حروف وأرقام / Password must be at least 12 characters long and contain letters and numbers."
          });
        }

        // Update password in Firebase Auth
        await getAdminAuth(adminApp).updateUser(targetUserId, { password });

        // Update vault
        const salt = crypto.randomUUID();
        const pbkdf2Hash = hashPasswordPBKDF2_210k(password, salt, 2);
        await adminDb.collection("user_credentials").doc(targetUserId).set({
          id: targetUserId,
          company_id: effectiveCompanyId,
          email: targetData.email,
          passwordHash: pbkdf2Hash,
          salt: salt,
          kdf: 'sha256_pbkdf2_210k',
          pepper_version: 2,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }

      // Build updates for users doc
      const updates: any = {
        updated_at: new Date().toISOString()
      };
      if (full_name !== undefined) updates.full_name = String(full_name).trim();
      if (role !== undefined) updates.role = String(role).trim();
      if (company_id !== undefined) updates.company_id = company_id;
      if (region_id !== undefined) updates.region_id = region_id;
      if (station_id !== undefined) updates.station_id = station_id;
      if (org_unit_id !== undefined) updates.org_unit_id = org_unit_id;
      if (assigned_org_unit_ids !== undefined) updates.assigned_org_unit_ids = Array.isArray(assigned_org_unit_ids) ? assigned_org_unit_ids : [];
      if (permissions !== undefined) updates.permissions = permissions;
      if (is_active !== undefined) updates.is_active = Boolean(is_active);
      if (must_change_password !== undefined) updates.must_change_password = Boolean(must_change_password);

      await adminDb.collection("users").doc(targetUserId).update(updates);

      const updatedDoc = await adminDb.collection("users").doc(targetUserId).get();
      const updatedUser = updatedDoc.data();

      // Audit Log
      try {
        await adminDb.collection("audit_logs").add({
          action: "user_updated",
          performed_by: creator.id || creator.email,
          performed_by_email: creator.email,
          target_user_id: targetUserId,
          target_email: targetData.email,
          company_id: effectiveCompanyId,
          timestamp: new Date().toISOString(),
          details: { updated_fields: Object.keys(updates), password_reset: Boolean(password) }
        });
      } catch (auditErr) {
        console.warn("Audit log write failed during user update:", auditErr);
      }

      return res.json({
        success: true,
        user: updatedUser
      });
    } catch (err: any) {
      console.error("Error updating user in /api/admin/users/:id:", err);
      return res.status(500).json({ success: false, message: err?.message || "Internal server error updating user." });
    }
  });

  // API Route - Unified Secure User Deletion Endpoint (DELETE /api/admin/users/:id)
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const authResult = await authenticateSessionOrBearer(req);
      if (!authResult.authenticated) {
        return res.status(authResult.statusCode).json({ success: false, message: authResult.message });
      }

      const creator = authResult.user;
      const isPlatformAdmin = await isPlatformAdminUser(creator.email, creator);

      if (!isPlatformAdmin && creator.role !== "Admin") {
        return res.status(403).json({ success: false, message: "Forbidden: Insufficient privileges to delete user / غير مصرح لك بحذف المستخدمين." });
      }

      const targetUserId = req.params.id;
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: "User ID parameter is required." });
      }

      if (targetUserId === creator.id) {
        return res.status(400).json({ success: false, message: "Cannot delete your own active session account / لا يمكن حذف حسابك الحالي." });
      }

      const userDocRef = adminDb.collection("users").doc(targetUserId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ success: false, message: "Target user not found." });
      }

      const targetData = userDoc.data() || {};
      const targetEmail = (targetData.email || "").toLowerCase().trim();

      // Authorization check: Company Admin can only delete users in their company
      if (!isPlatformAdmin && targetData.company_id !== creator.company_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete users outside your company." });
      }

      // 1. Delete/Disable Firebase Auth User
      try {
        const authClient = getAdminAuth(adminApp);
        if (authClient) {
          try {
            await authClient.deleteUser(targetUserId);
          } catch (authDeleteErr: any) {
            if (authDeleteErr?.code !== 'auth/user-not-found') {
              try {
                // If delete fails, attempt to disable
                await authClient.updateUser(targetUserId, { disabled: true });
              } catch (disableErr) {
                console.warn("Could not disable Firebase Auth user during deletion:", disableErr);
              }
            }
          }
        }
      } catch (authInitErr) {
        console.warn("Firebase Admin Auth unavailable during deletion:", authInitErr);
      }

      // 2. Delete / Invalidate Credentials Vault documents
      const credDocsToDelete: string[] = [targetUserId];
      if (targetEmail) credDocsToDelete.push(targetEmail);
      for (const credId of credDocsToDelete) {
        try {
          await adminDb.collection("user_credentials").doc(credId).delete();
        } catch (credErr) {
          console.warn(`Could not delete user_credentials doc ${credId}:`, credErr);
        }
      }

      // 3. Delete or Mark Deleted in users collection
      await userDocRef.delete();

      // 4. Audit Log
      try {
        await adminDb.collection("audit_logs").add({
          action: "user_deleted",
          performed_by: creator.id || creator.email,
          performed_by_email: creator.email,
          target_user_id: targetUserId,
          target_email: targetEmail,
          company_id: targetData.company_id || creator.company_id || "",
          timestamp: new Date().toISOString(),
          details: { deleted_user_name: targetData.full_name, role: targetData.role }
        });
      } catch (auditErr) {
        console.warn("Audit log write failed during user delete:", auditErr);
      }

      return res.json({
        success: true,
        message: "User and associated authentication credentials permanently deleted."
      });
    } catch (err: any) {
      console.error("Error deleting user in /api/admin/users/:id:", err);
      return res.status(500).json({ success: false, message: err?.message || "Internal server error deleting user." });
    }
  });

  // API Route - Server-side Credential Verification (Zero-Trust PBKDF2 210k)
  app.post("/api/auth/verify-credentials", otpRateLimiter, async (req, res) => {
    try {

      const rawEmail = req.body?.email;
      const rawPassword = req.body?.password;
      if (!rawEmail || !rawPassword) {
        return res.status(400).json({ success: false, message: "يرجى إدخال البريد الإلكتروني وكلمة المرور." });
      }

      const emailLower = String(rawEmail).toLowerCase().trim();
      const password = String(rawPassword).trim();
      if (!emailLower || !password) {
        return res.status(400).json({ success: false, message: "يرجى إدخال البريد الإلكتروني وكلمة المرور." });
      }

      // 1. Fetch user document from 'users' collection using Admin SDK
      const usersSnapshot = await adminDb.collection("users").where("email", "==", emailLower).get();

      if (usersSnapshot.empty) {
        return res.status(400).json({ success: false, message: "البريد الإلكتروني غير مسجل بالنظام." });
      }

      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;

      if (userData.is_active === false) {
        return res.status(400).json({ success: false, message: "هذا الحساب معطل حالياً. يرجى التواصل مع المسؤول." });
      }

      // 2. Fetch private credentials from 'user_credentials' vault using Admin SDK
      const credDoc = await adminDb.collection("user_credentials").doc(userId).get();

      let storedPasswordHash = '';
      let salt = userData.salt || emailLower;
      let kdf = 'legacy';
      let pepperVersion = 1;

      if (credDoc.exists) {
        const credData = credDoc.data();
        storedPasswordHash = credData?.passwordHash || credData?.password || '';
        salt = credData?.salt || salt;
        kdf = credData?.kdf || 'legacy';
        pepperVersion = typeof credData?.pepper_version === 'number' ? credData.pepper_version : 1;
      } else {
        // Fallback to legacy fields directly on user document
        storedPasswordHash = userData.password || '';
        pepperVersion = typeof userData.pepper_version === 'number' ? userData.pepper_version : 1;
      }

      const isPlatformAdmin = await isPlatformAdminUser(emailLower, userData);

      if (!storedPasswordHash) {
        if (!isPlatformAdmin) {
          return res.status(400).json({ success: false, message: "لم يتم تعيين كلمة مرور لهذا الحساب بعد." });
        }
      }

      // 3. Perform Password Comparisons across KDF iterations using stored pepper_version
      const pbkdf2Hash = hashPasswordPBKDF2_210k(password, salt, pepperVersion);
      const hash10k = hashPassword(password, salt, pepperVersion);
      const hash1k = legacyStretchedHashPassword1000(password, salt, pepperVersion);
      const hashSinglePass = legacySinglePassHashPassword(password, salt, pepperVersion);
      const hashOldEmailSalt = legacyHashPassword(password, emailLower);
      const hashLegacyUnsalted = legacyHashPassword(password);

      const isPBKDF2Match = storedPasswordHash !== '' && storedPasswordHash === pbkdf2Hash;
      const is10kMatch = storedPasswordHash !== '' && storedPasswordHash === hash10k;
      const is1kMatch = storedPasswordHash !== '' && storedPasswordHash === hash1k;
      const isSinglePassMatch = storedPasswordHash !== '' && storedPasswordHash === hashSinglePass;
      const isOldEmailSaltMatch = storedPasswordHash !== '' && storedPasswordHash === hashOldEmailSalt;
      const isLegacyUnsaltedMatch = storedPasswordHash !== '' && storedPasswordHash === hashLegacyUnsalted;
      const allowPlaintextFallback = false;
      const isPlainMatch = false;

      const isMatched = isPBKDF2Match || is10kMatch || is1kMatch || isSinglePassMatch || isOldEmailSaltMatch || isLegacyUnsaltedMatch || isPlainMatch;

      if (storedPasswordHash && !isMatched) {
        return res.status(400).json({ success: false, message: "كلمة المرور غير صحيحة." });
      }

      // Phase 4.1 Part 2: Evaluate Legacy Hash Deprecation & Sunset Enforcement Policy
      const deprecationPolicy = getLegacyHashDeprecationPolicy();
      const isLegacyOnlyMatch = !isPBKDF2Match && !is10kMatch && (is1kMatch || isSinglePassMatch || isOldEmailSaltMatch || isLegacyUnsaltedMatch || isPlainMatch || pepperVersion !== 2);
      if (isLegacyOnlyMatch && deprecationPolicy.enforceSunset) {
        return res.status(426).json({
          success: false,
          code: "LEGACY_HASH_SUNSET_EXPIRED",
          messageAr: deprecationPolicy.messageAr,
          messageEn: deprecationPolicy.messageEn,
          message: deprecationPolicy.messageAr
        });
      }
      if (isLegacyOnlyMatch) {
        console.log(`[LegacyHashDeprecationPolicy] Grace period active (${deprecationPolicy.announcementDate} -> ${deprecationPolicy.sunsetDate}): Auto-migrating legacy password hash to PBKDF2 210,000 iterations for userId: ${userId}`);
      }

      // 4. Auto-upgrade credential to PBKDF2 210,000 iterations & pepper_version: 2 in user_credentials vault
      // IMPORTANT: Never block a successful password match because company_id is missing.
      // Platform owners / SystemAdmins frequently have no company_id. Aborting here caused
      // "wrong password" on first login and success after close/reopen.
      if (!credDoc.exists || kdf !== 'sha256_pbkdf2_210k' || !isPBKDF2Match || pepperVersion !== 2) {
        if (!userData.company_id && !isPlatformAdmin) {
          console.warn(
            "[verify-credentials] Auto-upgrade skipped (no company_id) for non-platform userId:",
            userId,
            "email:",
            emailLower
          );
          // Still allow login with the already-verified password; do not return 422.
        } else {
          const newSalt = salt || crypto.randomUUID();
          const newPbkdf2Hash = hashPasswordPBKDF2_210k(password, newSalt, 2);
          const resolvedCompanyId = userData.company_id || (isPlatformAdmin ? 'platform' : '');

          await adminDb.collection("user_credentials").doc(userId).set({
            id: userId,
            company_id: resolvedCompanyId,
            email: emailLower,
            passwordHash: newPbkdf2Hash,
            salt: newSalt,
            kdf: 'sha256_pbkdf2_210k',
            pepper_version: 2,
            updated_at: new Date().toISOString()
          }, { merge: true });
        }

        // Strip password & salt from public user document in 'users' collection
        if (userData.password !== undefined || userData.salt !== undefined) {
          try {
            await adminDb.collection("users").doc(userId).update({
              password: FieldValue.delete(),
              salt: FieldValue.delete()
            });
          } catch (e) {
            console.warn("Could not delete plaintext password field from user doc:", e);
          }
        }
      }

      // Sanitize user object returned to client
      const { password: _, salt: __, ...publicUser } = userData;
      publicUser.id = userId;

      // Ensure permissions object is present and complete for the user's role
      const role = publicUser.role || 'ReconciliationUser';
      const isSystemAdminRole = role === 'SystemAdmin';
      const isAdminRole = role === 'Admin';
      const isRegionalRole = role === 'RegionalManager';
      const isStationRole = role === 'StationAdmin';
      const currentPerms = publicUser.permissions || {};
      publicUser.permissions = {
        create_expense: (isAdminRole || isSystemAdminRole) ? false : (currentPerms.create_expense ?? (isSystemAdminRole || isStationRole)),
        edit_expense: currentPerms.edit_expense ?? (isSystemAdminRole || isAdminRole || isStationRole),
        delete_expense: currentPerms.delete_expense ?? (isSystemAdminRole || isAdminRole),
        create_voucher: (isAdminRole || isSystemAdminRole) ? false : (currentPerms.create_voucher ?? (isSystemAdminRole || isStationRole)),
        approve_voucher: currentPerms.approve_voucher ?? (isSystemAdminRole || isAdminRole || isRegionalRole),
        reject_voucher: currentPerms.reject_voucher ?? (isSystemAdminRole || isAdminRole || isRegionalRole),
        create_custody: currentPerms.create_custody ?? (isSystemAdminRole || isAdminRole),
        edit_custody: currentPerms.edit_custody ?? (isSystemAdminRole || isAdminRole),
        replace_custody: currentPerms.replace_custody ?? (isSystemAdminRole || isAdminRole || isRegionalRole),
        view_reports: currentPerms.view_reports ?? true,
        manage_users: currentPerms.manage_users ?? (isSystemAdminRole || isAdminRole),
        manage_companies: currentPerms.manage_companies ?? isSystemAdminRole,
        manage_regions: currentPerms.manage_regions ?? (isSystemAdminRole || isAdminRole),
        manage_stations: currentPerms.manage_stations ?? (isSystemAdminRole || isAdminRole),
        manage_roles: currentPerms.manage_roles ?? (isSystemAdminRole || isAdminRole),
        manage_settings: currentPerms.manage_settings ?? (isSystemAdminRole || isAdminRole),
        settle_voucher: (isAdminRole || isSystemAdminRole) ? false : (currentPerms.settle_voucher ?? (isSystemAdminRole || isStationRole)),
      };

      let customToken: string | null = null;
      try {
        const adminAuth = getAdminAuth(getAdminApp());
        customToken = await adminAuth.createCustomToken(userId);
      } catch (tokenErr: any) {
        console.warn(
          "[verify-credentials] createCustomToken failed; continuing without customToken:",
          tokenErr?.message || tokenErr
        );
        customToken = null;
      }

      return res.json({
        success: true,
        user: publicUser,
        customToken,
        mustChangePassword: Boolean(publicUser.must_change_password)
      });
    } catch (err: any) {
      console.error("Error in verify-credentials endpoint:", err);
      return res.status(500).json({ success: false, message: "تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقًا." });
    }
  });

  // API Route - Server-side Forced Password Change Gate
  app.post("/api/auth/change-password", otpRateLimiter, async (req, res) => {
    try {
      const authResult = await authenticateSessionOrBearer(req);
      if (!authResult.authenticated) {
        return res.status(authResult.statusCode).json({ success: false, message: authResult.message });
      }

      const user = authResult.user;
      const uid = String(user.id || "").trim();
      if (!uid) {
        return res.status(403).json({ success: false, message: "Forbidden: Authenticated user ID could not be resolved." });
      }

      let { currentPassword, newPassword } = req.body || {};

      currentPassword = String(currentPassword ?? "").trim();
      if (typeof newPassword === 'string') {
        newPassword = newPassword.trim();
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "يرجى إدخال كلمة المرور الحالية وكلمة المرور الجديدة / Both current and new password are required." });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 12 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "كلمة المرور الجديدة يجب أن تتكون من 12 حرف على الأقل وتحتوي على حروف وأرقام / New password must be at least 12 characters and contain letters and numbers."
        });
      }

      // Verify current password against vault
      const credDoc = await adminDb.collection("user_credentials").doc(uid).get();
      const emailLower = String(user.email || '').toLowerCase().trim();

      let storedPasswordHash = '';
      let salt = user.salt || emailLower;
      let kdf = 'legacy';
      let pepperVersion = 2;

      if (credDoc.exists) {
        const credData = credDoc.data() || {};
        storedPasswordHash = credData.passwordHash || credData.password || '';
        salt = credData.salt || salt;
        kdf = credData.kdf || 'legacy';
        pepperVersion = typeof credData.pepper_version === 'number' ? credData.pepper_version : 2;
      } else {
        storedPasswordHash = user.password || '';
        pepperVersion = typeof user.pepper_version === 'number' ? user.pepper_version : 1;
      }

      // Perform Password Comparisons across KDF iterations using stored pepper_version
      const pbkdf2Hash = hashPasswordPBKDF2_210k(currentPassword, salt, pepperVersion);
      const hash10k = hashPassword(currentPassword, salt, pepperVersion);
      const hash1k = legacyStretchedHashPassword1000(currentPassword, salt, pepperVersion);
      const hashSinglePass = legacySinglePassHashPassword(currentPassword, salt, pepperVersion);
      const hashOldEmailSalt = legacyHashPassword(currentPassword, emailLower);
      const hashLegacyUnsalted = legacyHashPassword(currentPassword);

      const isPBKDF2Match = storedPasswordHash !== '' && storedPasswordHash === pbkdf2Hash;
      const is10kMatch = storedPasswordHash !== '' && storedPasswordHash === hash10k;
      const is1kMatch = storedPasswordHash !== '' && storedPasswordHash === hash1k;
      const isSinglePassMatch = storedPasswordHash !== '' && storedPasswordHash === hashSinglePass;
      const isOldEmailSaltMatch = storedPasswordHash !== '' && storedPasswordHash === hashOldEmailSalt;
      const isLegacyUnsaltedMatch = storedPasswordHash !== '' && storedPasswordHash === hashLegacyUnsalted;

      const isMatch = isPBKDF2Match || is10kMatch || is1kMatch || isSinglePassMatch || isOldEmailSaltMatch || isLegacyUnsaltedMatch;

      if (!isMatch) {
        return res.status(400).json({ success: false, message: "كلمة المرور الحالية غير صحيحة / Incorrect current password." });
      }

      // Update Firebase Auth user password
      try {
        await getAdminAuth(adminApp).updateUser(uid, { password: newPassword });
      } catch (authErr: any) {
        console.warn("Firebase Auth password update failed (non-blocking if local user):", authErr?.message);
      }

      // Re-hash new password with PBKDF2 210,000 iterations & vault it
      const newSalt = crypto.randomUUID();
      const newPbkdf2Hash = hashPasswordPBKDF2_210k(newPassword, newSalt, 2);
      await adminDb.collection("user_credentials").doc(uid).set({
        id: uid,
        company_id: user.company_id || 'platform',
        email: emailLower,
        passwordHash: newPbkdf2Hash,
        salt: newSalt,
        kdf: 'sha256_pbkdf2_210k',
        pepper_version: 2,
        updated_at: new Date().toISOString()
      }, { merge: true });

      // Update users collection document: set must_change_password = false & strip plaintext password/salt
      await adminDb.collection("users").doc(uid).update({
        must_change_password: false,
        password: FieldValue.delete(),
        salt: FieldValue.delete(),
        updated_at: new Date().toISOString()
      });

      const updatedDoc = await adminDb.collection("users").doc(uid).get();
      const updatedUserData = updatedDoc.data() || {};
      const { password: _, salt: __, ...publicUser } = updatedUserData;
      publicUser.id = uid;

      return res.json({
        success: true,
        message: "تم تغيير كلمة المرور بنجاح / Password changed successfully.",
        user: publicUser
      });
    } catch (err: any) {
      console.error("Error in /api/auth/change-password:", err);
      return res.status(500).json({ success: false, message: "حدث خطأ أثناء تغيير كلمة المرور / Server error changing password." });
    }
  });

  // API Route - Server-side Save User Credentials (PBKDF2 210k)
  app.post("/api/auth/save-credentials", requireAdminOrSystemAdminAuth, async (req, res) => {
    try {
      const { userId, companyId, email, password, salt } = req.body;
      if (!userId || !password) {
        return res.status(400).json({ success: false, message: "معلمات غير كافية لحفظ الاعتمادات." });
      }

      const requester = (req as any).user;
      const isSystemAdmin = requester?.role === 'SystemAdmin';
      const resolvedCompanyId = isSystemAdmin ? companyId : requester?.company_id;
      if (!resolvedCompanyId) {
        return res.status(422).json({
          success: false,
          message: "بيانات الشركة غير مكتملة / Missing or invalid company context for credentials."
        });
      }

      const emailLower = (email || '').toLowerCase().trim();
      const userSalt = salt || crypto.randomUUID();
      const newPbkdf2Hash = hashPasswordPBKDF2_210k(password, userSalt, 2);

      // Save strictly to user_credentials collection using Admin SDK
      await adminDb.collection("user_credentials").doc(userId).set({
        id: userId,
        company_id: resolvedCompanyId,
        email: emailLower,
        passwordHash: newPbkdf2Hash,
        salt: userSalt,
        kdf: 'sha256_pbkdf2_210k',
        pepper_version: 2,
        updated_at: new Date().toISOString()
      }, { merge: true });

      // Clean password/salt from public 'users' collection
      const userRef = adminDb.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await userRef.update({
          password: FieldValue.delete(),
          salt: FieldValue.delete()
        });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error in save-credentials endpoint:", err);
      return res.status(500).json({ success: false, message: "حدث خطأ أثناء حفظ الاعتمادات." });
    }
  });

  // API Route - Server-side Migrate Credential Vault ID (when legacy user ID -> Firebase Auth UID)
  app.post("/api/auth/migrate-credential-id", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.split("Bearer ")[1]?.trim();
      if (!idToken) {
        return res.status(401).json({ success: false, message: "Unauthorized token." });
      }
      const decodedToken = await getAdminAuth(adminApp).verifyIdToken(idToken);
      const { oldId, newId, email } = req.body;
      if (!oldId || !newId || decodedToken.uid !== newId) {
        return res.status(400).json({ success: false, message: "Invalid migration parameters or token mismatch." });
      }

      // Resolve requesting user's own email from decodedToken or by loading users/{newId} server-side
      let callerEmail = (decodedToken.email || "").toLowerCase().trim();
      if (!callerEmail) {
        const userDocSnap = await adminDb.collection("users").doc(newId).get();
        callerEmail = (userDocSnap.data()?.email || "").toLowerCase().trim();
      }
      if (!callerEmail) {
        return res.status(403).json({ success: false, message: "Caller email could not be resolved for authorization." });
      }

      const oldCredRef = adminDb.collection("user_credentials").doc(oldId);
      const oldCredDoc = await oldCredRef.get();
      if (oldCredDoc.exists) {
        const credData = oldCredDoc.data() || {};
        const oldEmail = (credData.email || "").toLowerCase().trim();
        // Check that oldId actually belongs to the same person making the request
        if (!oldEmail || oldEmail !== callerEmail) {
          return res.status(403).json({ success: false, message: "Forbidden: credential ownership mismatch." });
        }

        await adminDb.collection("user_credentials").doc(newId).set({
          ...credData,
          id: newId,
          email: callerEmail,
          updated_at: new Date().toISOString()
        }, { merge: true });
        if (oldId !== newId) {
          try {
            await oldCredRef.delete();
          } catch (delErr) {
            console.warn("Failed to delete legacy user_credentials doc:", delErr);
          }
        }
        return res.json({ success: true, message: "Credential vault migrated successfully." });
      }
      return res.json({ success: false, message: "No legacy credential found to migrate." });
    } catch (err: any) {
      console.error("Error migrating credential vault ID:", err);
      return res.status(500).json({ success: false, message: "Server error during credential migration." });
    }
  });

  // API Route - One-time repair for already orphaned user_credentials (requires SystemAdmin or manual confirmation)
  app.post("/api/auth/repair-orphaned-credentials", requireSystemAdminAuth, async (req, res) => {
    try {
      const { targetEmail, confirmPairing, manualOldId, manualNewId } = req.body || {};
      const usersSnap = await adminDb.collection("users").get();
      const credsSnap = await adminDb.collection("user_credentials").get();
      const userIds = new Set(usersSnap.docs.map(d => d.id));

      const orphanedDocs = credsSnap.docs.filter(d => !userIds.has(d.id));
      const repaired: string[] = [];
      const pendingConfirmation: any[] = [];

      for (const oldDoc of orphanedDocs) {
        const data = oldDoc.data() || {};
        const docEmail = (data.email || '').toLowerCase().trim();

        if (manualOldId && manualNewId && confirmPairing && oldDoc.id === manualOldId) {
          const resolvedEmail = (targetEmail || docEmail || '').toLowerCase().trim();
          if (!resolvedEmail) {
            pendingConfirmation.push({ oldId: oldDoc.id, reason: "No email field present on orphaned record or request; manual email confirmation required." });
            continue;
          }
          await adminDb.collection("user_credentials").doc(manualNewId).set({
            ...data,
            id: manualNewId,
            email: resolvedEmail,
            updated_at: new Date().toISOString()
          }, { merge: true });
          await oldDoc.ref.delete();
          repaired.push(`Manually paired ${oldDoc.id} -> ${manualNewId}`);
          continue;
        }

        if (docEmail) {
          const matchingUserDoc = usersSnap.docs.find(u => (u.data()?.email || '').toLowerCase().trim() === docEmail);
          if (matchingUserDoc) {
            await adminDb.collection("user_credentials").doc(matchingUserDoc.id).set({
              ...data,
              id: matchingUserDoc.id,
              email: docEmail,
              updated_at: new Date().toISOString()
            }, { merge: true });
            await oldDoc.ref.delete();
            repaired.push(`Auto-repaired by email ${docEmail}: ${oldDoc.id} -> ${matchingUserDoc.id}`);
          } else {
            pendingConfirmation.push({ oldId: oldDoc.id, email: docEmail });
          }
        } else {
          pendingConfirmation.push({ oldId: oldDoc.id, reason: "No email field present on orphaned record; manual confirmation required." });
        }
      }

      return res.json({
        success: true,
        repairedCount: repaired.length,
        repaired,
        pendingConfirmation
      });
    } catch (err: any) {
      console.error("Error in repair-orphaned-credentials:", err);
      return res.status(500).json({ success: false, message: "Error repairing orphaned credentials." });
    }
  });

  // API Route - Check Hash Migration Status (Phase 4.1 Deprecation Plan)
  // Queries user_credentials to report how many accounts are still on legacy hash formats (pepper_version 1 or 3) vs PBKDF2 210,000 (pepper_version 2)
  app.get("/api/auth/hash-migration-status", requireSystemAdminAuth, async (req, res) => {
    try {
      const credsSnap = await adminDb.collection("user_credentials").get();
      let legacyCount = 0;
      let pbkdf2Count = 0;
      let transientV2Count = 0;
      const details: { userId: string; pepperVersion: number; format: string }[] = [];

      credsSnap.docs.forEach(d => {
        const data = d.data() || {};
        const pVer = typeof data.pepper_version === 'number' ? data.pepper_version : 1;
        if (pVer === 1) {
          legacyCount++;
          details.push({ userId: d.id, pepperVersion: 1, format: "legacy_sha256" });
        } else if (pVer === 3) {
          transientV2Count++;
          details.push({ userId: d.id, pepperVersion: 3, format: "transient_regression_v2" });
        } else {
          pbkdf2Count++;
          details.push({ userId: d.id, pepperVersion: 2, format: "pbkdf2_210000" });
        }
      });

      const deprecationPolicy = getLegacyHashDeprecationPolicy();
      return res.json({
        success: true,
        totalCredentials: credsSnap.docs.length,
        legacyCount,
        transientV2Count,
        pbkdf2Count,
        details,
        deprecationPolicy,
        messageAr: `حالة التشفير: ${pbkdf2Count} حساب محدث (PBKDF2)، ${legacyCount + transientV2Count} حساب يحتاج هجرة تلقائية عند تسجيل الدخول. (انتهاء صلاحية التشفير القديم: ${deprecationPolicy.sunsetDate})`,
        messageEn: `Encryption status: ${pbkdf2Count} upgraded (PBKDF2), ${legacyCount + transientV2Count} pending auto-migration upon login. (Legacy Sunset Date: ${deprecationPolicy.sunsetDate})`
      });
    } catch (err: any) {
      console.error("Error in hash-migration-status:", err);
      return res.status(500).json({ success: false, message: "Error retrieving hash migration status." });
    }
  });

  // Helper: Server-side Firestore Seed Function with Admin SDK
  async function seedDatabaseIfEmptyServer(adminDbInstance: FirebaseFirestore.Firestore) {
    console.log('[Server Seed] Checking if Firestore requires initial seeding...');
    try {
      const metaDoc = await adminDbInstance.collection('system_meta').doc('seed_status_v7').get();
      const companiesSnap = await adminDbInstance.collection('companies').limit(1).get();

      if (metaDoc.exists && !companiesSnap.empty) {
        console.log('[Server Seed] Database is already initialized with v7 and has companies.');
        return { alreadySeeded: true };
      }

      console.log('[Server Seed] Database is empty or missing v7 marker. Starting server-side atomic seeding...');

      // 1. Seed companies
      const compBatch = adminDbInstance.batch();
      DEFAULT_COMPANIES.forEach(c => {
        compBatch.set(adminDbInstance.collection('companies').doc(c.id), c);
      });
      await compBatch.commit();
      console.log(`[Server Seed] Seeded ${DEFAULT_COMPANIES.length} companies.`);

      // 2. Seed regions
      const regBatch = adminDbInstance.batch();
      DEFAULT_REGIONS.forEach(r => {
        regBatch.set(adminDbInstance.collection('regions').doc(r.id), r);
      });
      await regBatch.commit();
      console.log(`[Server Seed] Seeded ${DEFAULT_REGIONS.length} regions.`);

      // 3. Seed stations
      const stnBatch = adminDbInstance.batch();
      DEFAULT_STATIONS.forEach(s => {
        stnBatch.set(adminDbInstance.collection('stations').doc(s.id), s);
      });
      await stnBatch.commit();
      console.log(`[Server Seed] Seeded ${DEFAULT_STATIONS.length} stations.`);

      // 4. Seed categories
      const catBatch = adminDbInstance.batch();
      DEFAULT_CATEGORIES.forEach(c => {
        catBatch.set(adminDbInstance.collection('categories').doc(c.id), c);
      });
      await catBatch.commit();
      console.log(`[Server Seed] Seeded ${DEFAULT_CATEGORIES.length} categories.`);

      // 5. Seed organization units
      const orgBatch = adminDbInstance.batch();
      DEFAULT_ORGANIZATION_UNITS.forEach(u => {
        orgBatch.set(adminDbInstance.collection('organization_units').doc(u.id), u);
      });
      await orgBatch.commit();
      console.log(`[Server Seed] Seeded ${DEFAULT_ORGANIZATION_UNITS.length} organization units.`);

      // 6. Seed users & user_credentials
      const userBatch = adminDbInstance.batch();
      DEFAULT_USERS.forEach(u => {
        const pwd = u.password || '123456';
        const salt = u.salt || u.email;
        const hashedPwd = hashPassword(pwd, salt, 2);
        const { password: _p, salt: _s, ...publicUser } = u;

        userBatch.set(adminDbInstance.collection('users').doc(u.id), {
          ...publicUser,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        userBatch.set(adminDbInstance.collection('user_credentials').doc(u.id), {
          id: u.id,
          company_id: u.company_id || '',
          email: u.email.toLowerCase().trim(),
          password: hashedPwd,
          salt: salt,
          pepper_version: 2,
          is_temporary: false,
          updated_at: new Date().toISOString()
        });
      });
      await userBatch.commit();
      console.log(`[Server Seed] Seeded ${DEFAULT_USERS.length} users and credentials.`);

      // 7. Seed config main
      await adminDbInstance.collection('config').doc('main').set({
        ...DEFAULT_CONFIG,
        updated_at: new Date().toISOString()
      });

      // 8. Seed permissions and roles
      const permBatch = adminDbInstance.batch();
      DEFAULT_PERMISSIONS.forEach(p => {
        permBatch.set(adminDbInstance.collection('Permissions').doc(p.id), p);
      });
      DEFAULT_ROLES.forEach(r => {
        permBatch.set(adminDbInstance.collection('Roles').doc(r.id), r);
      });
      await permBatch.commit();

      // 9. Seed logs and transactions
      const logBatch = adminDbInstance.batch();
      DEFAULT_LOGS.forEach(l => {
        logBatch.set(adminDbInstance.collection('logs').doc(l.id), l);
      });
      DEFAULT_TRANSACTIONS.forEach(t => {
        logBatch.set(adminDbInstance.collection('transactions').doc(t.id), t);
      });
      await logBatch.commit();

      // 10. Mark v7 seed status
      await adminDbInstance.collection('system_meta').doc('seed_status_v7').set({
        seeded: true,
        timestamp: new Date().toISOString(),
        seededBy: 'server_bootstrap',
        version: '7.0'
      });

      console.log('[Server Seed] Firestore seeding completed successfully.');
      return { success: true, seededCount: DEFAULT_COMPANIES.length };
    } catch (err: any) {
      console.error('[Server Seed] Error during seed:', err);
      throw err;
    }
  }

  // API Route - Auto seed endpoint (accessible by client on initial check or bootstrap)
  app.post("/api/seed/auto-seed", async (req, res) => {
    try {
      const result = await seedDatabaseIfEmptyServer(adminDb);
      return res.json({ success: true, result });
    } catch (err: any) {
      console.error("Error in /api/seed/auto-seed:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Run server seed on boot
  try {
    await seedDatabaseIfEmptyServer(adminDb);
  } catch (err) {
    console.error("Initial server boot seed error:", err);
  }



  // Serve static assets and handle Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
