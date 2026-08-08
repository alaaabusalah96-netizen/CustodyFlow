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

  // API Route - Server-side Credential Verification (Zero-Trust PBKDF2 210k)
  app.post("/api/auth/verify-credentials", otpRateLimiter, async (req, res) => {
    try {

      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "يرجى إدخال البريد الإلكتروني وكلمة المرور." });
      }

      const emailLower = email.toLowerCase().trim();

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
        customToken
      });
    } catch (err: any) {
      console.error("Error in verify-credentials endpoint:", err);
      return res.status(500).json({ success: false, message: "تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقًا." });
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
