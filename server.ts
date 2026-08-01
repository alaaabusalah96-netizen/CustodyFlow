import express from "express";
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
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { runTenantMigrationUp, runTenantMigrationDown } from "./src/migrations/tenantMigration";
import { hashPassword, legacyHashPassword, legacySinglePassHashPassword, legacyStretchedHashPassword1000, getPepperByVersion, hashPasswordPBKDF2_210k } from "./src/lib/server_hash";

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

async function getSmtpConfig() {
  const envHost = process.env.SMTP_HOST;
  const envPort = process.env.SMTP_PORT;
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASS;
  const envFrom = process.env.SMTP_FROM;

  if (envHost && envUser && envPass) {
    return {
      host: envHost,
      port: parseInt(envPort || "587"),
      user: envUser,
      pass: envPass,
      from: envFrom || `"KEMIT ERP Security" <${envUser}>`
    };
  }

  // Fallback: Read from Firestore using Admin SDK
  try {
    const configDoc = await adminDb.collection("system_config").doc("smtp").get();
    if (configDoc.exists) {
      const data = configDoc.data();
      if (data && data.host && data.user && data.pass) {
        return {
          host: data.host,
          port: parseInt(data.port || "587"),
          user: data.user,
          pass: data.pass.trim().replace(/\s+/g, ''),
          from: data.from || `"KEMIT ERP Security" <${data.user}>`
        };
      }
    }
  } catch (err) {
    console.error("Error reading SMTP config from Firestore:", err);
  }

  return null;
}

async function sendOtpEmail(email: string, otp: string, isLogin: boolean = false) {
  const config = await getSmtpConfig();
  if (!config) {
    console.warn("SMTP credentials are not configured. Email could not be dispatched. Configure SMTP_HOST, SMTP_USER, SMTP_PASS or save config in Firestore.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  const subject = isLogin 
    ? "رمز تأكيد تسجيل الدخول - KEMIT ERP" 
    : "رمز إعادة تعيين كلمة المرور - KEMIT ERP";
  
  const text = isLogin
    ? `أهلاً بك، رمز تأكيد تسجيل الدخول الخاص بك هو: ${otp}. هذا الرمز صالح لمدة 15 دقيقة.`
    : `أهلاً بك، رمز إعادة تعيين كلمة المرور الخاص بك هو: ${otp}. هذا الرمز صالح لمدة 15 دقيقة.`;

  const html = `
    <div style="direction: rtl; text-align: right; font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #059669;">منصة KEMIT ERP</h2>
      <p style="font-size: 14px; color: #334155;">أهلاً بك،</p>
      <p style="font-size: 14px; color: #334155;">
        ${isLogin 
          ? "تلقينا طلباً لتأكيد تسجيل الدخول إلى حساب أدمن المنصة." 
          : "تلقينا طلباً لإعادة تعيين كلمة المرور لحساب أدمن المنصة."}
      </p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0; border: 1px solid #cbd5e1;">
        <span style="font-size: 12px; color: #64748b; display: block; margin-bottom: 5px;">رمز التحقق الخاص بك (OTP)</span>
        <strong style="font-size: 28px; letter-spacing: 4px; color: #059669; font-family: monospace;">${otp}</strong>
      </div>
      <p style="font-size: 12px; color: #64748b;">هذا الرمز صالح لمدة 15 دقيقة فقط للاستخدام لمرة واحدة.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8;">هذا البريد تم إرساله تلقائياً، يرجى عدم الرد عليه.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: config.from,
      to: email,
      subject,
      text,
      html
    });
    console.log(`OTP email sent successfully to target address.`);
  } catch (err: any) {
    console.error("Error sending email via nodemailer:", err);
    if (err && err.message && (err.message.includes("535") || err.message.includes("Username and Password not accepted"))) {
      console.warn("\n💡 تلميح أمان واستكشاف الأخطاء (SMTP Security Tip):\n" +
        "إذا كنت تستخدم بريد Gmail لإرسال الرسائل (smtp.gmail.com)، يرجى التأكد من:\n" +
        "1. تفعيل التحقق بخطوتين (2-Step Verification) in Google account.\n" +
        "2. إنشاء 'كلمة مرور تطبيق' (App Password) مخصصة من إعدادات حساب Google واستخدامها بدلاً من كلمة المرور العادية للحساب.\n");
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  if (!process.env.APP_PEPPER) {
    console.error("CRITICAL SECURITY NOTICE: APP_PEPPER environment variable is not set. Authentication routes (/api/auth/*) will fail-loud until APP_PEPPER is configured.");
  }

  // Trust first proxy in Cloud Run / Nginx container environment for rate limiter IP resolution
  app.set("trust proxy", 1);

  app.use(express.json());

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
      const allowPlaintextFallback = process.env.STRICT_PROD_SECURITY !== 'true' || process.env.ALLOW_PLAINTEXT_DEV_FALLBACK === 'true';
      const isPlainMatch = allowPlaintextFallback && storedPasswordHash !== '' && storedPasswordHash === password;

      const isMatched = isPBKDF2Match || is10kMatch || is1kMatch || isSinglePassMatch || isOldEmailSaltMatch || isLegacyUnsaltedMatch || isPlainMatch;

      if (storedPasswordHash && !isMatched) {
        return res.status(400).json({ success: false, message: "كلمة المرور غير صحيحة." });
      }

      // 4. Auto-upgrade credential to PBKDF2 210,000 iterations & pepper_version: 2 in user_credentials vault
      if (!credDoc.exists || kdf !== 'sha256_pbkdf2_210k' || !isPBKDF2Match || pepperVersion !== 2) {
        const newSalt = salt || crypto.randomUUID();
        const newPbkdf2Hash = hashPasswordPBKDF2_210k(password, newSalt, 2);

        await adminDb.collection("user_credentials").doc(userId).set({
          id: userId,
          company_id: userData.company_id || 'comp-1',
          email: emailLower,
          passwordHash: newPbkdf2Hash,
          salt: newSalt,
          kdf: 'sha256_pbkdf2_210k',
          pepper_version: 2,
          updated_at: new Date().toISOString()
        }, { merge: true });

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

      const emailLower = (email || '').toLowerCase().trim();
      const userSalt = salt || crypto.randomUUID();
      const newPbkdf2Hash = hashPasswordPBKDF2_210k(password, userSalt, 2);

      // Save strictly to user_credentials collection using Admin SDK
      await adminDb.collection("user_credentials").doc(userId).set({
        id: userId,
        company_id: companyId || 'comp-1',
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

  // API Route - Password Reset Request
  app.post("/api/auth/reset-password/request", otpRateLimiter, async (req, res) => {
    try {
      const { email, securityPin } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = await isPlatformAdminUser(targetEmail);

      // 1. Verify that the email is the official platform admin strictly on the server
      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // 2. Fetch the registered admin user to verify their details using Admin SDK
      const snapshot = await adminDb.collection("users").where("email", "==", targetEmail).get();

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const userData = snapshot.docs[0].data();

      // 3. Verify security_pin strictly on the server ONLY if configured; allow direct OTP request if unconfigured/empty
      const savedPin = userData.security_pin || '';
      if (savedPin !== '' && (!securityPin || securityPin.trim() !== savedPin.trim())) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // 4. Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

      // 5. Store OTP securely in Firestore using Admin SDK
      await adminDb.collection("password_reset_otps").doc(targetEmail).set({
        email: targetEmail,
        code: otp,
        expiresAt,
        attempts: 0
      });

      // 6. Send OTP to the real email address only
      await sendOtpEmail(targetEmail, otp, false);

      // 7. Return the strict requested success message (Do not include OTP in response or log!)
      return res.json({
        success: true,
        message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني."
      });
    } catch (error) {
      console.error("Error in reset-password/request process");
      return res.status(500).json({ success: false, message: "تعذر تنفيذ الطلب." });
    }
  });

  // API Route - Password Reset OTP Verification
  app.post("/api/auth/reset-password/verify", otpRateLimiter, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = await isPlatformAdminUser(targetEmail);

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const otpDoc = await adminDb.collection("password_reset_otps").doc(targetEmail).get();

      if (!otpDoc.exists) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      const otpData = otpDoc.data();
      if (!otpData) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }
      const attempts = otpData.attempts || 0;

      if (attempts >= 5) {
        await adminDb.collection("password_reset_otps").doc(targetEmail).delete();
        return res.status(400).json({ success: false, message: "تم تجاوز الحد الأقصى للمحاولات المقبولة. تم إبطال الرمز، يرجى طلب رمز جديد." });
      }

      if (otpData.expiresAt < Date.now()) {
        await adminDb.collection("password_reset_otps").doc(targetEmail).delete();
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      if (otpData.code !== code.trim()) {
        const newAttempts = attempts + 1;
        if (newAttempts >= 5) {
          await adminDb.collection("password_reset_otps").doc(targetEmail).delete();
          return res.status(400).json({ success: false, message: "تم تجاوز الحد الأقصى للمحاولات المقبولة. تم إبطال الرمز، يرجى طلب رمز جديد." });
        } else {
          await adminDb.collection("password_reset_otps").doc(targetEmail).update({ attempts: newAttempts });
          return res.status(400).json({ success: false, message: `كود التحقق غير صحيح. المحاولات المتبقية: ${5 - newAttempts}` });
        }
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error in reset-password/verify process");
      return res.status(500).json({ success: false, message: "تعذر تنفيذ الطلب." });
    }
  });

  // API Route - Password Reset Confirmation
  app.post("/api/auth/reset-password/confirm", otpRateLimiter, async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = await isPlatformAdminUser(targetEmail);

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // Verify OTP again for maximum security using Admin SDK
      const otpDoc = await adminDb.collection("password_reset_otps").doc(targetEmail).get();

      if (!otpDoc.exists) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      const otpData = otpDoc.data();
      if (!otpData) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }
      const attempts = otpData.attempts || 0;

      if (attempts >= 5) {
        await adminDb.collection("password_reset_otps").doc(targetEmail).delete();
        return res.status(400).json({ success: false, message: "تم تجاوز الحد الأقصى للمحاولات المقبولة. تم إبطال الرمز، يرجى طلب رمز جديد." });
      }

      if (otpData.expiresAt < Date.now()) {
        await adminDb.collection("password_reset_otps").doc(targetEmail).delete();
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      if (otpData.code !== code.trim()) {
        const newAttempts = attempts + 1;
        if (newAttempts >= 5) {
          await adminDb.collection("password_reset_otps").doc(targetEmail).delete();
          return res.status(400).json({ success: false, message: "تم تجاوز الحد الأقصى للمحاولات المقبولة. تم إبطال الرمز، يرجى طلب رمز جديد." });
        } else {
          await adminDb.collection("password_reset_otps").doc(targetEmail).update({ attempts: newAttempts });
          return res.status(400).json({ success: false, message: `كود التحقق غير صحيح. المحاولات المتبقية: ${5 - newAttempts}` });
        }
      }

      // OTP matches! Update the password in Firestore for all documents matching the email using Admin SDK
      const snapshot = await adminDb.collection("users").where("email", "==", targetEmail).get();

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const hashedPassword = hashPassword(newPassword, targetEmail, 2);
      const updatePromises = snapshot.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        const userSalt = targetEmail;
        const pbkdf2Hash = hashPasswordPBKDF2_210k(newPassword, userSalt, 2);

        await adminDb.collection("users").doc(userId).update({
          password: hashedPassword,
          pepper_version: 2
        });

        await adminDb.collection("user_credentials").doc(userId).set({
          id: userId,
          passwordHash: pbkdf2Hash,
          salt: userSalt,
          kdf: 'sha256_pbkdf2_210k',
          pepper_version: 2,
          updated_at: new Date().toISOString()
        }, { merge: true });
      });
      await Promise.all(updatePromises);

      // Clean up the used OTP using Admin SDK
      await adminDb.collection("password_reset_otps").doc(targetEmail).delete();

      return res.json({ success: true, message: "تم تحديث كلمة المرور بنجاح." });
    } catch (error) {
      console.error("Error in reset-password/confirm process");
      return res.status(500).json({ success: false, message: "تعذر تنفيذ الطلب." });
    }
  });

  // Helper: check whether platform admin has already been bootstrapped
  async function isPlatformAdminBootstrapped(): Promise<boolean> {
    try {
      const docSnap = await adminDb.collection("system_config").doc("bootstrap").get();
      if (docSnap.exists && docSnap.data()?.bootstrapped === true) {
        return true;
      }
    } catch (err) {
      console.error("Error checking bootstrap status:", err);
      throw err;
    }
    return false;
  }

  // GET bootstrap status check (lightweight status endpoint)
  app.get("/api/auth/bootstrap-platform-owner", async (req, res) => {
    try {
      const bootstrapped = await isPlatformAdminBootstrapped();
      return res.json({ success: true, bootstrapped });
    } catch (error) {
      console.error("Error in GET bootstrap-platform-owner:", error);
      return res.status(500).json({ success: false, message: "تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقًا." });
    }
  });

  app.get("/api/auth/bootstrap-status", async (req, res) => {
    try {
      const bootstrapped = await isPlatformAdminBootstrapped();
      return res.json({ success: true, bootstrapped });
    } catch (error) {
      console.error("Error in GET bootstrap-status:", error);
      return res.status(500).json({ success: false, message: "تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقًا." });
    }
  });

  // API Route - Dedicated Single-Use Platform Owner Zero-Lockout Bootstrap
  app.post("/api/auth/bootstrap-platform-owner", otpRateLimiter, async (req, res) => {
    try {
      // 1. Verify no platform-admin credential already bootstrapped
      if (await isPlatformAdminBootstrapped()) {
        return res.status(403).json({
          success: false,
          message: "تم إعداد مشرف المنصة مسبقاً (Already Bootstrapped). لا يمكن إعادة الإعداد."
        });
      }

      const { email, password, confirmPassword } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "يرجى إدخال البريد الإلكتروني وكلمة المرور." });
      }

      const targetEmail = email.toLowerCase().trim();
      if (!PLATFORM_OWNER_EMAIL || targetEmail !== PLATFORM_OWNER_EMAIL) {
        return res.status(403).json({
          success: false,
          message: "غير مسموح بإعداد هذا الحساب كمشرف للمنصة. البريد الإلكتروني غير مطابق للمالك المُعرَّف مسبقًا."
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "كلمة المرور يجب أن لا تقل عن 6 أحرف." });
      }

      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ success: false, message: "كلمات المرور غير متطابقة." });
      }

      // 2. Re-check bootstrap status before write to prevent race conditions
      if (await isPlatformAdminBootstrapped()) {
        return res.status(403).json({
          success: false,
          message: "تم إعداد مشرف المنصة مسبقاً (Already Bootstrapped). لا يمكن إعادة الإعداد."
        });
      }

      // 3. Look for existing user or create new SystemAdmin user doc
      const snapshot = await adminDb.collection("users").where("email", "==", targetEmail).limit(1).get();
      let userId: string;
      let userData: any;

      if (!snapshot.empty) {
        userId = snapshot.docs[0].id;
        userData = {
          ...snapshot.docs[0].data(),
          id: userId,
          role: "SystemAdmin",
          is_platform_owner: true,
          is_active: true
        };
        delete userData.password;
        delete userData.salt;
        await adminDb.collection("users").doc(userId).update({
          role: "SystemAdmin",
          is_platform_owner: true,
          is_active: true,
          password: FieldValue.delete(),
          salt: FieldValue.delete()
        });
      } else {
        userId = `user-sysadmin-${Date.now()}`;
        userData = {
          id: userId,
          email: targetEmail,
          full_name: "Platform Owner",
          role: "SystemAdmin",
          is_active: true,
          is_platform_owner: true,
          created_at: new Date().toISOString()
        };
        await adminDb.collection("users").doc(userId).set(userData);
      }

      // 4. Hash password with PBKDF2 210,000 iterations & store strictly in user_credentials vault
      const userSalt = crypto.randomUUID();
      const pbkdf2Hash = hashPasswordPBKDF2_210k(password, userSalt, 2);

      const credObj = {
        id: userId,
        email: targetEmail,
        passwordHash: pbkdf2Hash,
        salt: userSalt,
        kdf: 'sha256_pbkdf2_210k',
        pepper_version: 2,
        updated_at: new Date().toISOString()
      };

      await adminDb.collection("user_credentials").doc(userId).set(credObj, { merge: false });

      // 5. Permanently mark bootstrap as complete
      await adminDb.collection("system_config").doc("bootstrap").set({
        bootstrapped: true,
        bootstrapped_at: new Date().toISOString(),
        bootstrapped_email: targetEmail
      });

      return res.json({
        success: true,
        message: "تم إعداد حساب مشرف المنصة بنجاح.",
        user: {
          ...userData,
          password: password,
          salt: userSalt
        }
      });
    } catch (error) {
      console.error("Error in bootstrap-platform-owner process:", error);
      return res.status(500).json({ success: false, message: "تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقًا." });
    }
  });

  // API Route - Admin Login Request
  app.post("/api/auth/admin-login/request", otpRateLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = await isPlatformAdminUser(targetEmail);

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // Verify the stored password in Firestore using Admin SDK
      const snapshot = await adminDb.collection("users").where("email", "==", targetEmail).get();

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const userData = snapshot.docs[0].data();
      const storedPassword = userData.password || '';
      const pepperVersion = typeof userData.pepper_version === 'number' ? userData.pepper_version : 1;

      const enteredHashSalted = hashPassword(password, targetEmail, pepperVersion);
      const enteredHashLegacy = hashPassword(password, '', pepperVersion);
      const allowPlaintextFallback = process.env.STRICT_PROD_SECURITY !== 'true' || process.env.ALLOW_PLAINTEXT_DEV_FALLBACK === 'true';
      const isPlainMatch = allowPlaintextFallback && storedPassword !== '' && storedPassword === password;
      const isLegacyHashMatch = storedPassword !== '' && storedPassword === enteredHashLegacy;
      const isSaltedHashMatch = storedPassword !== '' && storedPassword === enteredHashSalted;
      const isMatch = isPlainMatch || isLegacyHashMatch || isSaltedHashMatch;

      if (storedPassword !== '' && !isMatch) {
        return res.status(400).json({ success: false, message: "كلمة المرور غير صحيحة لحساب أدمن المنصة." });
      }

      // Auto migrate legacy password to secure salted hash on Firestore using Admin SDK
      if (storedPassword !== '' && (isPlainMatch || isLegacyHashMatch || pepperVersion !== 2)) {
        try {
          const newHash = hashPassword(password, targetEmail, 2);
          await adminDb.collection("users").doc(snapshot.docs[0].id).update({
            password: newHash,
            pepper_version: 2
          });
        } catch (migErr) {
          console.warn("Failed to auto-migrate platform admin password on login request:", migErr);
        }
      }

      // Generate login OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;

      // Store securely using Admin SDK
      await adminDb.collection("admin_login_otps").doc(targetEmail).set({
        email: targetEmail,
        code: otp,
        expiresAt,
        attempts: 0
      });

      // Send to real email
      await sendOtpEmail(targetEmail, otp, true);

      return res.json({ success: true, message: "تم إرسال رمز تأكيد الدخول إلى بريدك الإلكتروني." });
    } catch (error) {
      console.error("Error in admin-login/request process");
      return res.status(500).json({ success: false, message: "تعذر تنفيذ الطلب." });
    }
  });

  // API Route - Admin Login OTP Verification
  app.post("/api/auth/admin-login/verify", otpRateLimiter, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = await isPlatformAdminUser(targetEmail);

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const otpDoc = await adminDb.collection("admin_login_otps").doc(targetEmail).get();

      if (!otpDoc.exists) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      const otpData = otpDoc.data();
      if (!otpData) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }
      const attempts = otpData.attempts || 0;

      if (attempts >= 5) {
        await adminDb.collection("admin_login_otps").doc(targetEmail).delete();
        return res.status(400).json({ success: false, message: "تم تجاوز الحد الأقصى للمحاولات المقبولة. تم إبطال الرمز، يرجى طلب رمز جديد." });
      }

      if (otpData.expiresAt < Date.now()) {
        await adminDb.collection("admin_login_otps").doc(targetEmail).delete();
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      if (otpData.code !== code.trim()) {
        const newAttempts = attempts + 1;
        if (newAttempts >= 5) {
          await adminDb.collection("admin_login_otps").doc(targetEmail).delete();
          return res.status(400).json({ success: false, message: "تم تجاوز الحد الأقصى للمحاولات المقبولة. تم إبطال الرمز، يرجى طلب رمز جديد." });
        } else {
          await adminDb.collection("admin_login_otps").doc(targetEmail).update({ attempts: newAttempts });
          return res.status(400).json({ success: false, message: `كود التحقق غير صحيح. المحاولات المتبقية: ${5 - newAttempts}` });
        }
      }

      // Clean up the used OTP using Admin SDK
      await adminDb.collection("admin_login_otps").doc(targetEmail).delete();

      return res.json({ success: true });
    } catch (error) {
      console.error("Error in admin-login/verify process");
      return res.status(500).json({ success: false, message: "تعذر تنفيذ الطلب." });
    }
  });

  // GET SMTP config status
  app.get("/api/auth/smtp-config", async (req, res) => {
    try {
      const config = await getSmtpConfig();
      if (config) {
        // Mask the user email for security
        const parts = config.user.split("@");
        const maskedUser = parts.length === 2 
          ? `${parts[0].substring(0, Math.min(3, parts[0].length))}***@${parts[1]}` 
          : "***";
        return res.json({
          success: true,
          configured: true,
          host: config.host,
          user: maskedUser
        });
      }
      return res.json({
        success: true,
        configured: false
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "تعذر الحصول على حالة SMTP." });
    }
  });

  // POST save SMTP config
  app.post("/api/auth/smtp-config", requireAdminOrSystemAdminAuth, async (req, res) => {
    try {
      const { 
        adminEmail, 
        adminPassword, 
        securityPin, 
        smtpHost, 
        smtpPort, 
        smtpUser, 
        smtpPass 
      } = req.body;

      if (!adminEmail || !adminPassword || !securityPin || !smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة لإتمام عملية الحفظ." });
      }

      const targetEmail = adminEmail.toLowerCase().trim();
      const isPlatformAdmin = await isPlatformAdminUser(targetEmail);

      if (!isPlatformAdmin) {
        return res.status(403).json({ success: false, message: "هذا الإجراء متاح فقط لأدمن منصة KEMIT ERP." });
      }

      // Verify credentials with Firestore users collection using Admin SDK
      const snapshot = await adminDb.collection("users").where("email", "==", targetEmail).get();

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "بيانات الأدمن غير مسجلة في النظام." });
      }

      const userData = snapshot.docs[0].data();
      const storedPassword = userData.password || '';
      const storedPin = userData.security_pin || '';
      const pepperVersion = typeof userData.pepper_version === 'number' ? userData.pepper_version : 1;

      const enteredHashSalted = hashPassword(adminPassword, targetEmail, pepperVersion);
      const enteredHashLegacy = hashPassword(adminPassword, '', pepperVersion);
      const allowPlaintextFallback = process.env.STRICT_PROD_SECURITY !== 'true' || process.env.ALLOW_PLAINTEXT_DEV_FALLBACK === 'true';
      const isPlainMatch = allowPlaintextFallback && storedPassword !== '' && storedPassword === adminPassword;
      const isLegacyHashMatch = storedPassword !== '' && storedPassword === enteredHashLegacy;
      const isSaltedHashMatch = storedPassword !== '' && storedPassword === enteredHashSalted;
      const isMatch = isPlainMatch || isLegacyHashMatch || isSaltedHashMatch;

      if (storedPassword !== '' && !isMatch) {
        return res.status(400).json({ success: false, message: "كلمة المرور غير صحيحة لحساب أدمن المنصة." });
      }

      // Auto migrate legacy password to secure salted hash on Firestore using Admin SDK
      if (storedPassword !== '' && (isPlainMatch || isLegacyHashMatch || pepperVersion !== 2)) {
        try {
          const newHash = hashPassword(adminPassword, targetEmail, 2);
          await adminDb.collection("users").doc(snapshot.docs[0].id).update({
            password: newHash,
            pepper_version: 2
          });
        } catch (migErr) {
          console.warn("Failed to auto-migrate platform admin password on SMTP save:", migErr);
        }
      }

      if (storedPin !== '' && storedPin !== securityPin.trim()) {
        return res.status(400).json({ success: false, message: "كود الأمان PIN غير صحيح." });
      }

      // Save to Firestore with cleaned password (spaces removed) using Admin SDK
      const cleanPass = smtpPass.trim().replace(/\s+/g, '');
      await adminDb.collection("system_config").doc("smtp").set({
        host: smtpHost.trim(),
        port: parseInt(smtpPort),
        user: smtpUser.trim(),
        pass: cleanPass,
        from: `"KEMIT ERP Security" <${smtpUser.trim()}>`,
        updatedAt: Date.now()
      });

      return res.json({ 
        success: true, 
        message: "تم حفظ إعدادات البريد الإلكتروني (SMTP) بنجاح والاتصال آمن." 
      });
    } catch (error) {
      console.error("Error saving SMTP config:", error);
      return res.status(500).json({ success: false, message: "حدث خطأ أثناء حفظ الإعدادات." });
    }
  });

  // POST test SMTP connection
  app.post("/api/auth/smtp-config/test", requireAdminOrSystemAdminAuth, async (req, res) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return res.status(400).json({ success: false, message: "جميع حقول خادم SMTP مطلوبة للاختبار." });
      }

      const cleanPass = smtpPass.trim().replace(/\s+/g, '');
      const portNum = parseInt(smtpPort);

      const transporter = nodemailer.createTransport({
        host: smtpHost.trim(),
        port: portNum,
        secure: portNum === 465,
        auth: {
          user: smtpUser.trim(),
          pass: cleanPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000
      });

      // Try verifying the connection
      await transporter.verify();

      // Send actual test mail to the user
      await transporter.sendMail({
        from: `"KEMIT ERP Security Test" <${smtpUser.trim()}>`,
        to: smtpUser.trim(),
        subject: "رسالة تجريبية - KEMIT ERP SMTP Test",
        text: "إذا كنت تقرأ هذه الرسالة، فهذا يعني أن إعدادات خادم البريد (SMTP) الخاصة بك تعمل بشكل صحيح تماماً! تهانينا 🎉",
        html: `
          <div style="direction: rtl; text-align: right; font-family: sans-serif; padding: 20px; border: 1px solid #059669; border-radius: 8px;">
            <h2 style="color: #059669;">تهانينا! 🎉</h2>
            <p style="font-size: 14px; color: #334155;">خادم البريد الإلكتروني الخاص بك يعمل بشكل ممتاز والاتصال آمن.</p>
            <p style="font-size: 13px; color: #64748b;">تم إرسال هذه الرسالة كاختبار لتأكيد صلاحية كلمة المرور والمنفذ.</p>
          </div>
        `
      });

      return res.json({
        success: true,
        message: "تم اختبار الاتصال وإرسال بريد تجريبي بنجاح! يرجى مراجعة بريدك الإلكتروني للتأكد."
      });
    } catch (error: any) {
      console.error("Error testing SMTP connection:", error);
      let errMsg = error.message || "حدث خطأ غير معروف.";
      if (errMsg.includes("535") || errMsg.includes("Username and Password not accepted")) {
        errMsg = "فشل تسجيل الدخول (535): اسم المستخدم أو كلمة مرور التطبيق غير صحيحة. يرجى مراجعة الـ App Password ذو الـ 16 حرفاً وتأكيد خلوه من الأخطاء.";
      } else if (errMsg.includes("ETIMEDOUT") || errMsg.includes("TIMEOUT")) {
        errMsg = "انتهت مهلة الاتصال بالخادم. يرجى التحقق من الخادم والمنفذ (Port) والاتصال بالشبكة.";
      } else if (errMsg.includes("ECONNREFUSED")) {
        errMsg = "تم رفض الاتصال من الخادم. يرجى التحقق من صحة عنوان الخادم والمنفذ.";
      }
      return res.status(500).json({
        success: false,
        message: `فشل الاختبار: ${errMsg}`
      });
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
