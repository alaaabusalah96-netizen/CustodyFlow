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
import nodemailer from "nodemailer";
import { runTenantMigrationUp, runTenantMigrationDown } from "./src/migrations/tenantMigration";

const firebaseConfig = {
  projectId: "refined-garage-5nzsc",
  appId: "1:619920731471:web:caa4ea274d68cfff45293a",
  apiKey: "AIzaSyD_KQ7aA76ZGR-Z9zdhQBIZQIxHw-Hw5Vc",
  authDomain: "refined-garage-5nzsc.firebaseapp.com",
  storageBucket: "refined-garage-5nzsc.firebasestorage.app",
  messagingSenderId: "619920731471"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, "ai-studio-custodyflow-b2f42bf6-7a6a-43a4-9986-3d46405d5ebe");

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
      from: envFrom || `"CustodyFlow Security" <${envUser}>`
    };
  }

  // Fallback: Read from Firestore
  try {
    const configDocRef = doc(db, "system_config", "smtp");
    const configDoc = await getDoc(configDocRef);
    if (configDoc.exists()) {
      const data = configDoc.data();
      if (data.host && data.user && data.pass) {
        return {
          host: data.host,
          port: parseInt(data.port || "587"),
          user: data.user,
          pass: data.pass.trim().replace(/\s+/g, ''),
          from: data.from || `"CustodyFlow Security" <${data.user}>`
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
    ? "رمز تأكيد تسجيل الدخول - CustodyFlow" 
    : "رمز إعادة تعيين كلمة المرور - CustodyFlow";
  
  const text = isLogin
    ? `أهلاً بك، رمز تأكيد تسجيل الدخول الخاص بك هو: ${otp}. هذا الرمز صالح لمدة 15 دقيقة.`
    : `أهلاً بك، رمز إعادة تعيين كلمة المرور الخاص بك هو: ${otp}. هذا الرمز صالح لمدة 15 دقيقة.`;

  const html = `
    <div style="direction: rtl; text-align: right; font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #059669;">منصة CustodyFlow</h2>
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

  app.use(express.json());

  // API Route - Run Tenant Migration (UP)
  app.post("/api/migrations/up", async (req, res) => {
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
  app.post("/api/migrations/down", async (req, res) => {
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

  // API Route - Password Reset Request
  app.post("/api/auth/reset-password/request", async (req, res) => {
    try {
      const { email, securityPin } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = targetEmail === 'alaaabusalah96@gmail.com' || targetEmail === 'alaabusalah96@gmail.com';

      // 1. Verify that the email is the official platform admin strictly on the server
      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // 2. Fetch the registered admin user to verify their details
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", targetEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const userData = snapshot.docs[0].data();

      // 3. Verify security_pin strictly on the server
      const savedPin = userData.security_pin || '';
      if (savedPin === '' || !securityPin || securityPin.trim() !== savedPin.trim()) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // 4. Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

      // 5. Store OTP securely in Firestore
      const otpDocRef = doc(db, "password_reset_otps", targetEmail);
      await setDoc(otpDocRef, {
        email: targetEmail,
        code: otp,
        expiresAt
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
  app.post("/api/auth/reset-password/verify", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = targetEmail === 'alaaabusalah96@gmail.com' || targetEmail === 'alaabusalah96@gmail.com';

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const otpDocRef = doc(db, "password_reset_otps", targetEmail);
      const otpDoc = await getDoc(otpDocRef);

      if (!otpDoc.exists()) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      const otpData = otpDoc.data();
      if (otpData.code !== code.trim() || otpData.expiresAt < Date.now()) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error in reset-password/verify process");
      return res.status(500).json({ success: false, message: "تعذر تنفيذ الطلب." });
    }
  });

  // API Route - Password Reset Confirmation
  app.post("/api/auth/reset-password/confirm", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = targetEmail === 'alaaabusalah96@gmail.com' || targetEmail === 'alaabusalah96@gmail.com';

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // Verify OTP again for maximum security
      const otpDocRef = doc(db, "password_reset_otps", targetEmail);
      const otpDoc = await getDoc(otpDocRef);

      if (!otpDoc.exists()) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      const otpData = otpDoc.data();
      if (otpData.code !== code.trim() || otpData.expiresAt < Date.now()) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      // OTP matches! Update the password in Firestore for all documents matching the email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", targetEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const updatePromises = snapshot.docs.map(async (userDoc) => {
        await updateDoc(doc(db, "users", userDoc.id), {
          password: newPassword
        });
      });
      await Promise.all(updatePromises);

      // Clean up the used OTP
      await deleteDoc(otpDocRef);

      return res.json({ success: true, message: "تم تحديث كلمة المرور بنجاح." });
    } catch (error) {
      console.error("Error in reset-password/confirm process");
      return res.status(500).json({ success: false, message: "تعذر تنفيذ الطلب." });
    }
  });

  // API Route - Admin Login Request
  app.post("/api/auth/admin-login/request", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = targetEmail === 'alaaabusalah96@gmail.com' || targetEmail === 'alaabusalah96@gmail.com';

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      // Verify the stored password in Firestore
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", targetEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const userData = snapshot.docs[0].data();
      const storedPassword = userData.password || '';

      if (storedPassword !== '' && storedPassword !== password) {
        return res.status(400).json({ success: false, message: "كلمة المرور غير صحيحة لحساب أدمن المنصة." });
      }

      // Generate login OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;

      // Store securely
      const otpDocRef = doc(db, "admin_login_otps", targetEmail);
      await setDoc(otpDocRef, {
        email: targetEmail,
        code: otp,
        expiresAt
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
  app.post("/api/auth/admin-login/verify", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const targetEmail = email.toLowerCase().trim();
      const isPlatformAdmin = targetEmail === 'alaaabusalah96@gmail.com' || targetEmail === 'alaabusalah96@gmail.com';

      if (!isPlatformAdmin) {
        return res.status(400).json({ success: false, message: "تعذر تنفيذ الطلب." });
      }

      const otpDocRef = doc(db, "admin_login_otps", targetEmail);
      const otpDoc = await getDoc(otpDocRef);

      if (!otpDoc.exists()) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      const otpData = otpDoc.data();
      if (otpData.code !== code.trim() || otpData.expiresAt < Date.now()) {
        return res.status(400).json({ success: false, message: "كود التحقق غير صحيح أو منتهي الصلاحية." });
      }

      // Clean up the used OTP
      await deleteDoc(otpDocRef);

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
  app.post("/api/auth/smtp-config", async (req, res) => {
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
      const isPlatformAdmin = targetEmail === 'alaaabusalah96@gmail.com' || targetEmail === 'alaabusalah96@gmail.com';

      if (!isPlatformAdmin) {
        return res.status(403).json({ success: false, message: "هذا الإجراء متاح فقط لأدمن منصة CustodyFlow." });
      }

      // Verify credentials with Firestore users collection
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", targetEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "بيانات الأدمن غير مسجلة في النظام." });
      }

      const userData = snapshot.docs[0].data();
      const storedPassword = userData.password || '';
      const storedPin = userData.security_pin || '';

      if (storedPassword !== '' && storedPassword !== adminPassword) {
        return res.status(400).json({ success: false, message: "كلمة المرور غير صحيحة لحساب أدمن المنصة." });
      }

      if (storedPin !== '' && storedPin !== securityPin.trim()) {
        return res.status(400).json({ success: false, message: "كود الأمان PIN غير صحيح." });
      }

      // Save to Firestore with cleaned password (spaces removed)
      const cleanPass = smtpPass.trim().replace(/\s+/g, '');
      const configDocRef = doc(db, "system_config", "smtp");
      await setDoc(configDocRef, {
        host: smtpHost.trim(),
        port: parseInt(smtpPort),
        user: smtpUser.trim(),
        pass: cleanPass,
        from: `"CustodyFlow Security" <${smtpUser.trim()}>`,
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
  app.post("/api/auth/smtp-config/test", async (req, res) => {
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
        from: `"CustodyFlow Security Test" <${smtpUser.trim()}>`,
        to: smtpUser.trim(),
        subject: "رسالة تجريبية - CustodyFlow SMTP Test",
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
