import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, AppUser, UserRole, SignupRequest } from '../types';
import { auth, dbDeleteDoc } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Coins, ShieldAlert, User, Lock, ArrowRight, Languages, UserPlus, LogIn, CheckCircle2, Building, Mail, KeyRound, RefreshCw, ExternalLink, Inbox } from 'lucide-react';
import SMTPConfigModal from '../components/SMTPConfigModal';
import kemitLogo from '../assets/images/kemit_logo_1784280480891.jpg';

interface LoginProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  onLoginSuccess: (user: AppUser) => void;
}

export default function Login({
  language,
  setLanguage,
  theme,
  onLoginSuccess
}: LoginProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('StationAdmin');
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedStationId, setSelectedStationId] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password Reset States
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [generatedCode, setGeneratedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showMailboxSimulator, setShowMailboxSimulator] = useState(false);

  // Admin Login Verification States
  const [isAdminLoginVerifyMode, setIsAdminLoginVerifyMode] = useState(false);
  const [adminLoginOtp, setAdminLoginOtp] = useState('');
  const [adminLoginEnteredPassword, setAdminLoginEnteredPassword] = useState('');
  const [adminLoginUser, setAdminLoginUser] = useState<AppUser | null>(null);
  const [adminSelectedSecurityPin, setAdminSelectedSecurityPin] = useState('');
  const [resetSecurityPin, setResetSecurityPin] = useState('');

  // SMTP Configuration States
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [smtpConfiguredStatus, setSmtpConfiguredStatus] = useState<{ configured: boolean; host?: string; user?: string } | null>(null);

  // Firebase Auth Warning State
  const [showFirebaseAuthWarning, setShowFirebaseAuthWarning] = useState(false);

  React.useEffect(() => {
    const handleWarning = () => {
      setShowFirebaseAuthWarning(true);
    };
    window.addEventListener('firebase_auth_provider_disabled', handleWarning);
    if ((window as any).__firebase_auth_provider_disabled) {
      setShowFirebaseAuthWarning(true);
    }
    return () => {
      window.removeEventListener('firebase_auth_provider_disabled', handleWarning);
    };
  }, []);

  const refreshSmtpStatus = () => {
    fetch('/api/auth/smtp-config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSmtpConfiguredStatus(data);
        }
      })
      .catch(err => console.error("Error fetching SMTP status:", err));
  };

  React.useEffect(() => {
    refreshSmtpStatus();
  }, [showSmtpModal]);

  const companies = CustodyDB.getCompanies();
  const activeCompanies = companies.filter(c => c.is_active !== false && c.subscription_status === 'active');
  const filteredRegions = CustodyDB.getRegions().filter(r => r.company_id === selectedCompanyId);
  const filteredStations = CustodyDB.getStations().filter(s => s.region_id === selectedRegionId);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const targetEmail = resetEmail.toLowerCase().trim();
    const isPlatformAdmin = CustodyDB.isPlatformOwner(targetEmail);

    if (!isPlatformAdmin) {
      setError(isRtl 
        ? '⚠️ تعذر تنفيذ الطلب.' 
        : '⚠️ The request could not be processed.'
      );
      return;
    }

    const users = CustodyDB.getUsers();
    const foundAdmin = users.find(u => u.email.toLowerCase().trim() === targetEmail);

    if (!foundAdmin) {
      setError(isRtl ? '⚠️ تعذر تنفيذ الطلب.' : '⚠️ The request could not be processed.');
      return;
    }

    const savedPin = foundAdmin.security_pin || '';
    if (savedPin === '') {
      setError(isRtl 
        ? '⚠️ لم يتم تهيئة كود أمان استعادة الحساب بعد لحساب أدمن المنصة. يرجى تسجيل الدخول أولاً لتهيئة الحساب.'
        : '⚠️ No security recovery PIN has been configured yet for this Admin account. Please log in first.'
      );
      return;
    }

    if (resetSecurityPin.trim() !== savedPin.trim()) {
      setError(isRtl 
        ? '⚠️ تعذر تنفيذ الطلب.'
        : '⚠️ The request could not be processed.'
      );
      return;
    }

    setIsSendingEmail(true);

    try {
      const res = await fetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, securityPin: resetSecurityPin })
      });
      const data = await res.json();
      setIsSendingEmail(false);

      if (data.success) {
        setResetStep(2);
        setSuccess(isRtl 
          ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.' 
          : 'Verification code sent to your email.'
        );
      } else {
        setError(data.message || (isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.'));
      }
    } catch (err) {
      setIsSendingEmail(false);
      setError(isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/reset-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code: resetCode })
      });
      const data = await res.json();

      if (data.success) {
        setResetStep(3);
        setSuccess(isRtl ? '✅ تم التحقق من هويتك بنجاح! يرجى إدخال كلمة المرور الجديدة لحساب أدمن المنصة.' : '✅ Identity verified! Please enter your new Platform Admin password.');
      } else {
        setError(data.message || (isRtl ? '❌ كود التحقق غير صحيح أو منتهي الصلاحية.' : '❌ Incorrect verification code.'));
      }
    } catch (err) {
      setError(isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.');
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 4) {
      setError(isRtl ? '❌ يجب ألا تقل كلمة المرور عن 4 أحرف.' : '❌ Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(isRtl ? '❌ كلمات المرور غير متطابقة.' : '❌ Passwords do not match.');
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword })
      });
      const data = await res.json();

      if (data.success) {
        // Update password in local CustodyDB for local cache sync
        const users = CustodyDB.getUsers();
        const updatedUsers = users.map(u => {
          const isPlatformAdmin = u.email && CustodyDB.isPlatformOwner(u.email);
          if (isPlatformAdmin) {
            const userSalt = u.salt || u.email;
            return { ...u, password: CustodyDB.hashPassword(newPassword, userSalt) };
          }
          return u;
        });

        await CustodyDB.saveUsers(updatedUsers);

        // Save success state and reset
        setIsResetMode(false);
        setEmail(resetEmail); // Autofill email for convenience
        setPassword('');
        setSuccess(isRtl 
          ? '🎉 تم تحديث كلمة مرور أدمن المنصة بنجاح! يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.' 
          : '🎉 Platform Admin password updated successfully! You can now log in with your new password.'
        );
      } else {
        setError(data.message || (isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.'));
      }
    } catch (err) {
      setError(isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.');
    }
  };

  const syncWithFirebaseAuth = async (emailStr: string, passStr: string): Promise<any> => {
    try {
      const emailLower = emailStr.trim().toLowerCase();
      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailLower, passStr);
        return userCredential.user;
      } catch (authErr: any) {
        if (authErr.code === 'auth/operation-not-allowed') {
          console.warn(
            'Firebase Auth: Email/Password sign-in provider is not enabled in your Firebase project. ' +
            'Please go to the Firebase Console, navigate to Authentication -> Sign-in method, ' +
            'and enable the "Email/Password" sign-in method.'
          );
          if (typeof window !== 'undefined') {
            (window as any).__firebase_auth_provider_disabled = true;
            window.dispatchEvent(new CustomEvent('firebase_auth_provider_disabled'));
          }
          return null;
        }

        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/invalid-email') {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, emailLower, passStr);
            return userCredential.user;
          } catch (createErr: any) {
            if (createErr.code === 'auth/operation-not-allowed') {
              console.warn(
                'Firebase Auth: Email/Password sign-in provider is not enabled in your Firebase project. ' +
                'Please go to the Firebase Console, navigate to Authentication -> Sign-in method, ' +
                'and enable the "Email/Password" sign-in method.'
              );
              if (typeof window !== 'undefined') {
                (window as any).__firebase_auth_provider_disabled = true;
                window.dispatchEvent(new CustomEvent('firebase_auth_provider_disabled'));
              }
            } else {
              console.error('Firebase Auth auto-creation failed:', createErr);
            }
          }
        } else {
          console.error('Firebase Auth signin error:', authErr);
        }
      }
    } catch (err) {
      console.warn('Firebase Auth synchronization failed:', err);
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const emailLower = email.toLowerCase().trim();

    // Feature Flag for Phase 1 Server-side Authentication Remediation (Rollback Protection)
    const USE_SERVER_AUTH = true;

    if (USE_SERVER_AUTH) {
      try {
        const authRes = await fetch('/api/auth/verify-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailLower, password })
        });
        const authData = await authRes.json();

        if (!authData.success) {
          setError(authData.message || (isRtl ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.'));
          return;
        }

        let authenticatedUser = authData.user as AppUser;

        // Sync with Firebase Authentication (Chicken-and-Egg solution)
        const firebaseUser = password ? await syncWithFirebaseAuth(emailLower, password) : null;
        if (firebaseUser) {
          authenticatedUser = { ...authenticatedUser, id: firebaseUser.uid };
        }

        // Upsert sanitized user profile to local state and activate session
        CustodyDB.upsertLocalUser(authenticatedUser);
        CustodyDB.setActiveUser(authenticatedUser);
        onLoginSuccess(authenticatedUser);
        return;
      } catch (serverAuthErr) {
        console.warn('Server-side authentication endpoint error, proceeding with local fallback:', serverAuthErr);
      }
    }

    // --- Legacy Client-side Fallback Verification (Rollback Path) ---
    // Sync with Firebase Authentication first (Chicken-and-Egg solution)
    const firebaseUser = password ? await syncWithFirebaseAuth(emailLower, password) : null;

    // Now, after authentication, fetch user from Firestore securely
    try {
      const remoteUser = await CustodyDB.fetchUserByEmail(emailLower);
      if (remoteUser) {
        CustodyDB.upsertLocalUser(remoteUser);
      }
    } catch (err) {
      console.warn('Failed to fetch user from Firestore during login:', err);
    }

    const users = CustodyDB.getUsers();
    const foundUser = users.find(u => u.email.toLowerCase().trim() === emailLower);

    if (!foundUser) {
      setError(isRtl ? 'البريد الإلكتروني غير مسجل بالنظام.' : 'Email address not found in system.');
      return;
    }

    const isPlatformAdmin = CustodyDB.isPlatformOwner(emailLower);

    // Verify Password (Plain Text, OWASP 10k Stretched Hash, 1k Stretched Hash, Single-Pass Hash, or Old Unsalted Hash)
    const storedPassword = foundUser.password || '';
    const userSalt = foundUser.salt || emailLower;
    const enteredHashSalted10k = CustodyDB.hashPassword(password, userSalt);
    const enteredHashSalted1k = CustodyDB.legacyStretchedHashPassword1000(password, userSalt);
    const enteredHashSinglePass = CustodyDB.legacySinglePassHashPassword(password, userSalt);
    const enteredHashOldSalted = CustodyDB.legacyHashPassword(password, emailLower); // old email-only salt
    const enteredHashLegacy = CustodyDB.legacyHashPassword(password); // old unsalted fallback
    
    const isPlainMatch = storedPassword !== '' && storedPassword === password;
    const isSaltedHash10kMatch = storedPassword !== '' && storedPassword === enteredHashSalted10k;
    const isSaltedHash1kMatch = storedPassword !== '' && storedPassword === enteredHashSalted1k;
    const isLegacySinglePassMatch = storedPassword !== '' && storedPassword === enteredHashSinglePass;
    const isOldSaltedMatch = storedPassword !== '' && storedPassword === enteredHashOldSalted;
    const isLegacyHashMatch = storedPassword !== '' && storedPassword === enteredHashLegacy;
    
    const isHashMatch = isSaltedHash10kMatch || isSaltedHash1kMatch || isLegacySinglePassMatch || isOldSaltedMatch || isLegacyHashMatch;

    if (storedPassword === '') {
      if (!isPlatformAdmin) {
        setError(isRtl ? 'لم يتم تعيين كلمة مرور لهذا الحساب بعد. يرجى التواصل مع المسؤول لتفعيل حسابك.' : 'No password has been set for this account yet. Please contact the administrator.');
        return;
      }
    } else if (!isPlainMatch && !isHashMatch) {
      setError(isRtl ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.');
      return;
    }

    // Auto migrate legacy plain-text, old 1k stretched, single-pass, or unsalted hash to OWASP 10k stretched hash
    const needsMigration = (storedPassword !== '' && isPlainMatch) || 
                          (storedPassword !== '' && isSaltedHash1kMatch) ||
                          (storedPassword !== '' && isLegacySinglePassMatch) ||
                          (storedPassword !== '' && isLegacyHashMatch) ||
                          (storedPassword !== '' && isOldSaltedMatch);
    if (needsMigration) {
      const updatedUsers = users.map(u => {
        if (u.id === foundUser.id) {
          return { ...u, password: enteredHashSalted10k };
        }
        return u;
      });
      await CustodyDB.saveUsers(updatedUsers);
      foundUser.password = enteredHashSalted10k;
    }

    // Migrate user document ID to Firebase Auth UID to enforce multi-tenancy rules
    if (firebaseUser) {
      const currentUsers = CustodyDB.getUsers();
      const legacyUser = currentUsers.find(u => u.email.toLowerCase().trim() === emailLower && u.id !== firebaseUser.uid);
      if (legacyUser) {
        // Delete legacy doc from Firestore
        try {
          await dbDeleteDoc('users', legacyUser.id);
        } catch (delErr) {
          console.warn('Failed to delete legacy user document:', delErr);
        }

        // Save under new Firebase uid
        const updatedUsers = currentUsers.map(u => {
          if (u.id === legacyUser.id) {
            return { ...u, id: firebaseUser.uid, password: enteredHashSalted10k };
          }
          return u;
        });
        await CustodyDB.saveUsers(updatedUsers);
        foundUser.id = firebaseUser.uid;
      }
    }

    if (isPlatformAdmin) {
      // First-time Platform Admin setup for default security pin
      if (storedPassword === '') {
        const currentUsers = CustodyDB.getUsers();
        const updatedUsers = currentUsers.map(u => {
          if (u.email.toLowerCase().trim() === emailLower) {
            return { 
              ...u, 
              password: enteredHashSalted10k, 
              is_active: true,
              security_pin: '1234'
            };
          }
          return u;
        });
        await CustodyDB.saveUsers(updatedUsers);
        foundUser.password = enteredHashSalted10k;
        foundUser.security_pin = '1234';
      }

      foundUser.is_active = true;
      CustodyDB.setActiveUser(foundUser);
      onLoginSuccess(foundUser);
      return;
    }

    // Check activation
    if (!foundUser.is_active) {
      setError(isRtl ? 'حسابك معلق ومسجل بالنظام، لكنه بانتظار موافقة وتفعيل أدمن المنصة.' : 'Your account is registered but pending activation by the Platform Admin.');
      return;
    }

    CustodyDB.setActiveUser(foundUser);
    onLoginSuccess(foundUser);
  };

  const handleVerifyAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!adminLoginUser) return;

    try {
      const res = await fetch('/api/auth/admin-login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminLoginUser.email, code: adminLoginOtp })
      });
      const data = await res.json();

      if (data.success) {
        const isFirstTime = !adminLoginUser.password || adminLoginUser.password === '';

        if (isFirstTime) {
          const pin = adminSelectedSecurityPin.trim();
          if (pin.length < 4 || pin.length > 6) {
            setError(isRtl 
              ? '❌ يرجى اختيار كود أمان استعادة حساب يتكون من 4 إلى 6 أرقام.' 
              : '❌ Please choose a security PIN between 4 and 6 digits.'
            );
            return;
          }
        }

        // Save the typed password to the database (removes default password completely)
        const adminSalt = adminLoginUser.salt || adminLoginUser.email;
        const hashedEntered = CustodyDB.hashPassword(adminLoginEnteredPassword, adminSalt);
        const users = CustodyDB.getUsers();
        
        // Sync with Firebase Auth
        const firebaseUser = await syncWithFirebaseAuth(adminLoginUser.email, adminLoginEnteredPassword);
        const targetId = firebaseUser ? firebaseUser.uid : adminLoginUser.id;
        
        // Delete old user document if ID changed
        if (firebaseUser && adminLoginUser.id !== firebaseUser.uid) {
          try {
            await dbDeleteDoc('users', adminLoginUser.id);
          } catch (delErr) {
            console.warn('Failed to delete legacy user document in admin verification:', delErr);
          }
        }

        const updatedUsers = users.map(u => {
          if (u.id === adminLoginUser.id || (firebaseUser && u.email.toLowerCase().trim() === adminLoginUser.email.toLowerCase().trim())) {
            return { 
              ...u, 
              id: targetId,
              password: hashedEntered,
              security_pin: isFirstTime ? adminSelectedSecurityPin.trim() : u.security_pin
            };
          }
          return u;
        });
        await CustodyDB.saveUsers(updatedUsers);

        const finalUser = { 
          ...adminLoginUser, 
          id: targetId,
          password: hashedEntered,
          security_pin: isFirstTime ? adminSelectedSecurityPin.trim() : adminLoginUser.security_pin
        };
        
        CustodyDB.setActiveUser(finalUser);
        setIsAdminLoginVerifyMode(false);
        onLoginSuccess(finalUser);
      } else {
        setError(data.message || (isRtl ? '❌ كود التحقق المدخل غير صحيح.' : '❌ Incorrect verification code.'));
      }
    } catch (err) {
      setError(isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError(isRtl ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill all required fields.');
      return;
    }

    const isPlatformAdmin = CustodyDB.isPlatformOwner(email);

    if (!isPlatformAdmin && !selectedCompanyId) {
      setError(isRtl ? 'يرجى اختيار الشركة التابع لها.' : 'Please select your company.');
      return;
    }

    const users = CustodyDB.getUsers();
    const exists = users.some(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (exists) {
      setError(isRtl ? 'البريد الإلكتروني مسجل بالفعل بالنظام.' : 'Email is already registered.');
      return;
    }

    const pendingRequests = CustodyDB.getSignupRequests();
    const requestExists = pendingRequests.some(r => r.email.toLowerCase().trim() === email.toLowerCase().trim() && r.status === 'Pending');
    if (requestExists) {
      setError(isRtl ? 'البريد الإلكتروني لديه طلب تسجيل معلق بالفعل.' : 'Email already has a pending registration request.');
      return;
    }

    if (isPlatformAdmin) {
      const newUser: AppUser = {
        id: `user-${Date.now()}`,
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        role: 'SystemAdmin',
        permissions: CustodyDB.enrichUserPermissions('SystemAdmin'),
        is_active: true,
        password: password
      };

      await CustodyDB.saveUsers([...users, newUser]);
      setSuccess(isRtl ? 'تم تفعيل حساب أدمن المنصة تلقائياً! يرجى تسجيل الدخول الآن.' : 'Platform Admin activated automatically! Please sign in.');
    } else {
      if (selectedRole !== 'Admin' && !selectedRegionId) {
        setError(isRtl ? 'يرجى اختيار المنطقة.' : 'Please select your region.');
        return;
      }
      if (selectedRole === 'StationAdmin' && !selectedStationId) {
        setError(isRtl ? 'يرجى اختيار الفرع / المحطة.' : 'Please select your branch/station.');
        return;
      }

      const newRequest: SignupRequest = {
        id: `request-${Date.now()}`,
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        role: selectedRole,
        company_id: selectedCompanyId,
        region_id: selectedRole !== 'Admin' ? selectedRegionId : undefined,
        station_id: selectedRole === 'StationAdmin' ? selectedStationId : undefined,
        password: password,
        created_at: new Date().toISOString(),
        status: 'Pending'
      };

      CustodyDB.saveSignupRequest(newRequest);
      setSuccess(isRtl 
        ? 'تم تقديم طلب التسجيل بنجاح! بانتظار موافقة المسؤول لتفعيل الحساب.' 
        : 'Registration request submitted successfully! Pending approval to activate your account.'
      );
    }

    // Reset fields
    setFullName('');
    setEmail('');
    setPassword('');
    setSelectedRegionId('');
    setSelectedStationId('');
    setIsRegisterMode(false);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <div 
      id="login-page-root"
      className={`min-h-screen flex flex-col justify-between items-center px-4 py-8 transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Floating Language Switcher in Login view */}
      <div className="w-full max-w-4xl flex justify-end">
        <button
          onClick={toggleLanguage}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm'
          }`}
        >
          <Languages size={14} />
          <span>{t.langSwitch}</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md my-auto">
        {/* Brand logo header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden bg-white shadow-md border border-slate-100 dark:border-slate-800 mb-4">
            <img src={kemitLogo} alt="KEMIT ERP Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">
            {t.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono font-bold">
            {isRtl ? 'منظومة إدارة العهد والمدفوعات النقدية الذكية' : 'Digital Cash Custody Hub & Reconciliation'}
          </p>
        </div>

        {/* Card Frame */}
        <div className={`p-6 rounded-3xl border shadow-xl ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-slate-100'
        }`}>
          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
            <button
              onClick={() => {
                setIsRegisterMode(false);
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                !isRegisterMode 
                  ? 'bg-emerald-600 text-white shadow' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LogIn size={14} />
              <span>{isRtl ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
            <button
              onClick={() => {
                setIsRegisterMode(true);
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                isRegisterMode 
                  ? 'bg-emerald-600 text-white shadow' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus size={14} />
              <span>{isRtl ? 'طلب تسجيل جديد' : 'Sign Up'}</span>
            </button>
          </div>

          <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-5 pb-2 border-b border-slate-100 dark:border-slate-800">
            {isRegisterMode 
              ? (isRtl ? 'إنشاء ملف مالي جديد بالمنظومة' : 'Request Security Profile Credentials') 
              : t.loginTitle
            }
          </h3>

          {/* Success notice */}
          {success && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-start gap-2">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Firebase Auth Provider Warning */}
          {showFirebaseAuthWarning && (
            <div className="p-4 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs leading-relaxed space-y-2">
              <div className="flex items-start gap-2 font-bold text-amber-500">
                <ShieldAlert size={16} className="shrink-0 mt-0.5 animate-pulse" />
                <span>
                  {isRtl 
                    ? 'تنبيه: مزود تسجيل الدخول بالبريد الإلكتروني معطل في منصة Firebase'
                    : 'Notice: Email/Password Sign-In Provider is Disabled in Firebase'}
                </span>
              </div>
              <p>
                {isRtl
                  ? 'يرجى تفعيل خيار تسجيل الدخول (Email/Password) في كونسول Firebase الخاص بك لضمان المزامنة السحابية الكاملة:'
                  : 'To enable full cloud synchronization, please enable the Email/Password sign-in method in your Firebase Console:'}
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <li>
                  {isRtl ? 'افتح كونسول Firebase للمشروع.' : 'Open your Firebase project console.'}
                </li>
                <li>
                  {isRtl ? 'انتقل إلى قسم Authentication ثم Sign-in method.' : 'Go to Authentication > Sign-in method.'}
                </li>
                <li>
                  {isRtl ? 'اضغط على "إضافة مزود جديد" (Add new provider) واختر "Email/Password".' : 'Click "Add new provider" and select "Email/Password".'}
                </li>
                <li>
                  {isRtl ? 'قم بتمكينه (Enable) وحفظ التغييرات.' : 'Toggle "Enable" and click Save.'}
                </li>
              </ol>
              <div className="pt-1.5 border-t border-amber-500/10 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>{isRtl ? 'المنظومة تعمل الآن بوضع البيانات المحلية المؤقتة.' : 'Running with local offline-first credentials.'}</span>
                <a 
                  href="https://console.firebase.google.com/project/refined-garage-5nzsc/authentication/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 inline-flex items-center gap-0.5 underline decoration-dotted"
                >
                  <span>Console</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}

          {/* Forms */}
          {isAdminLoginVerifyMode ? (
            /* Admin Login 2FA OTP Form */
            <form onSubmit={handleVerifyAdminLogin} className="space-y-4 animate-fade-in">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs leading-relaxed">
                {isRtl 
                  ? 'يرجى مراجعة بريدك الإلكتروني لإدخال كود التحقق السري والولوج إلى حسابك بأمان.'
                  : 'Please check your email to enter the security verification code and sign in safely.'
                }
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <KeyRound size={12} />
                  <span>{isRtl ? 'أدخل كود التحقق السري المكون من 6 أرقام' : 'Enter 6-digit Security Code'}</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={adminLoginOtp}
                  onChange={(e) => setAdminLoginOtp(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:bg-slate-800 dark:border-slate-700 text-slate-100 bg-white border-slate-200"
                  required
                />
              </div>

              {adminLoginUser && (!adminLoginUser.password || adminLoginUser.password === '') && (
                <div className="animate-fade-in p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2.5">
                  <label className="block text-[11px] font-bold text-amber-500 uppercase flex items-center gap-1">
                    <KeyRound size={12} className="animate-pulse" />
                    <span>{isRtl ? 'اختر كود أمان استعادة الحساب (4 إلى 6 أرقام)' : 'Choose Account Recovery PIN (4-6 digits)'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="e.g. 1996"
                    value={adminSelectedSecurityPin}
                    onChange={(e) => setAdminSelectedSecurityPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2.5 rounded-xl border text-center font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:bg-slate-800 dark:border-slate-700 text-slate-100 bg-white border-slate-200"
                    required
                  />
                  <p className="text-[10px] text-slate-400 leading-normal">
                    {isRtl 
                      ? '⚠️ هام جداً: هذا الكود سري للغاية وسيُطلب منك في حال نسيت كلمة المرور وتريد استعادتها. احفظه جيداً!' 
                      : '⚠️ Critical: This secret PIN will be required to verify your identity if you ever need to reset your password. Keep it safe!'}
                  </p>
                </div>
              )}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{isRtl ? 'تأكيد الدخول الآمن 🔑' : 'Confirm Secure Login 🔑'}</span>
                <ArrowRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAdminLoginVerifyMode(false);
                  setError('');
                  setSuccess('');
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-300 transition-all font-bold mt-2 cursor-pointer"
              >
                {isRtl ? '← إلغاء والعودة لصفحة الدخول' : '← Cancel and go back to Login'}
              </button>
            </form>
          ) : isResetMode ? (
            /* Reset Password Wizard Form */
            <div className="space-y-4">
              {resetStep === 1 && (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs leading-relaxed">
                    {isRtl 
                      ? 'لأسباب أمنية صارمة، يسمح لأدمن المنصة فقط بإعادة تعيين كلمة مرور حسابه عبر البريد الإلكتروني.' 
                      : 'For strict security reasons, only the Platform Admin can request password changes via email.'
                    }
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Mail size={12} />
                      <span>{isRtl ? 'البريد الإلكتروني لأدمن المنصة' : 'Platform Admin Email Address'}</span>
                    </label>
                    <input
                      type="email"
                      placeholder="alaaabusalah96@gmail.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <KeyRound size={12} />
                      <span>{isRtl ? 'أدخل كود أمان استعادة الحساب' : 'Enter Account Recovery Security PIN'}</span>
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="••••"
                      value={resetSecurityPin}
                      onChange={(e) => setResetSecurityPin(e.target.value.replace(/\D/g, ''))}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingEmail}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSendingEmail ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{isRtl ? 'جاري التحقق وإرسال الكود...' : 'Verifying and sending token...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isRtl ? 'إرسال كود التحقق السري للإيميل 📧' : 'Send Security Verification Code 📧'}</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {resetStep === 2 && (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs leading-relaxed">
                    {isRtl 
                      ? 'تم إرسال رسالة بريد إلكتروني بها كود التحقق الأمني السري إلى حسابك. يرجى مراجعة علبة الوارد في بريدك الإلكتروني ونسخ الكود هنا.' 
                      : 'A secure email containing the verification code has been sent to your email. Please check your inbox and enter the code below.'
                    }
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <KeyRound size={12} />
                      <span>{isRtl ? 'أدخل كود التحقق السري (6 أرقام)' : 'Security Verification Code (6 digits)'}</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:bg-slate-800 dark:border-slate-700 text-slate-100 bg-white border-slate-200"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{isRtl ? 'تأكيد الرمز والتحقق من الهوية' : 'Verify Code & Proceed'}</span>
                    <ArrowRight size={14} />
                  </button>
                </form>
              )}

              {resetStep === 3 && (
                <form onSubmit={handleSaveNewPassword} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Lock size={12} />
                      <span>{isRtl ? 'كلمة المرور الجديدة لأدمن المنصة' : 'New Platform Admin Password'}</span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Lock size={12} />
                      <span>{isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{isRtl ? 'حفظ كلمة المرور الجديدة وتحديث النظام 💾' : 'Save New Password & Sync 💾'}</span>
                    <ArrowRight size={14} />
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setError('');
                  setSuccess('');
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-300 transition-all font-bold mt-2 cursor-pointer"
              >
                {isRtl ? '← إلغاء والعودة لصفحة الدخول' : '← Cancel and go back to Login'}
              </button>
            </div>
          ) : isRegisterMode ? (
            /* Registration Request Form */
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <User size={12} />
                  <span>{isRtl ? 'الاسم بالكامل' : 'Full Name'}</span>
                </label>
                <input
                  type="text"
                  placeholder={isRtl ? 'الاسم الثلاثي أو رباعي للموظف' : 'Full Name'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <User size={12} />
                  <span>{t.email}</span>
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <Lock size={12} />
                  <span>{t.password}</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Conditionally hide company and role for system owner */}
              {!CustodyDB.isPlatformOwner(email) && (
                <>
                  {/* Company selection */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Building size={12} />
                      <span>{isRtl ? 'الشركة التابع لها' : 'Select Company'}</span>
                    </label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => {
                        setSelectedCompanyId(e.target.value);
                        setSelectedRegionId('');
                        setSelectedStationId('');
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                      }`}
                      required
                    >
                      <option value="">{isRtl ? 'اختر الشركة...' : 'Select Company...'}</option>
                      {activeCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role requested */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Lock size={12} />
                      <span>{isRtl ? 'الدور الوظيفي المطلوب' : 'Requested Role'}</span>
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => {
                        setSelectedRole(e.target.value as UserRole);
                        setSelectedRegionId('');
                        setSelectedStationId('');
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                      }`}
                      required
                    >
                      <option value="Admin">{isRtl ? 'أدمن شركة (Company Admin)' : 'Company Admin'}</option>
                      <option value="RegionalManager">{isRtl ? 'مدير منطقة (Regional Manager)' : 'Regional Manager'}</option>
                      <option value="StationAdmin">{isRtl ? 'مدير محطة / فرع (Station Manager)' : 'Station Manager / Cashier'}</option>
                    </select>
                  </div>

                  {/* Region selection (for RegionalManager or StationAdmin) */}
                  {selectedCompanyId && (selectedRole === 'RegionalManager' || selectedRole === 'StationAdmin') && (
                    <div className="animate-fade-in">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                        <Building size={12} />
                        <span>{isRtl ? 'المنطقة التابع لها' : 'Select Region'}</span>
                      </label>
                      <select
                        value={selectedRegionId}
                        onChange={(e) => {
                          setSelectedRegionId(e.target.value);
                          setSelectedStationId('');
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                        }`}
                        required
                      >
                        <option value="">{isRtl ? 'اختر المنطقة...' : 'Select Region...'}</option>
                        {filteredRegions.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Station selection (only for StationAdmin) */}
                  {selectedRegionId && selectedRole === 'StationAdmin' && (
                    <div className="animate-fade-in">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                        <Building size={12} />
                        <span>{isRtl ? 'الفرع / المحطة' : 'Select Station/Branch'}</span>
                      </label>
                      <select
                        value={selectedStationId}
                        onChange={(e) => setSelectedStationId(e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                        }`}
                        required
                      >
                        <option value="">{isRtl ? 'اختر الفرع / المحطة...' : 'Select Station/Branch...'}</option>
                        {filteredStations.map(s => (
                          <option key={s.id} value={s.id}>{s.station_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Submit Registration */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>{isRtl ? 'تقديم طلب التسجيل للفرع' : 'Submit Registration Request'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            /* Log In Form */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <User size={12} />
                  <span>{t.email}</span>
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Lock size={12} />
                    <span>{t.password}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setResetEmail(email || 'alaaabusalah96@gmail.com');
                      setResetStep(1);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-[11px] text-emerald-600 hover:text-emerald-500 font-bold transition-all cursor-pointer"
                  >
                    {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Sign-in trigger */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>{t.login}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* SMTP Configuration Button & Status */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSmtpModal(true)}
          className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            theme === 'dark' 
              ? 'bg-indigo-950/40 hover:bg-[#1e1b4b]/80 border-indigo-500/20 text-indigo-300' 
              : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100 text-indigo-700'
          }`}
        >
          <Mail size={12} />
          <span>{isRtl ? 'إعدادات خادم البريد الإلكتروني SMTP 📬' : 'Configure SMTP Email Server 📬'}</span>
        </button>

        {smtpConfiguredStatus && smtpConfiguredStatus.configured ? (
          <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {isRtl 
              ? `البريد مفعّل: ${smtpConfiguredStatus.user} (${smtpConfiguredStatus.host})` 
              : `SMTP Active: ${smtpConfiguredStatus.user} (${smtpConfiguredStatus.host})`}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-amber-500 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {isRtl ? 'تنبيه: لم يتم تكوين إعدادات البريد SMTP بعد' : 'Warning: SMTP Mailer is not configured yet'}
          </span>
        )}
      </div>

      {/* SMTP Configuration Modal */}
      <SMTPConfigModal
        isOpen={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
        theme={theme}
        isRtl={isRtl}
        onConfigUpdated={refreshSmtpStatus}
      />

      {/* Footer copyright */}
      <div className="text-[10px] font-mono text-slate-400 mt-6">
        &copy; 2026 {t.title} ERP. {t.allRightsReserved}
      </div>
    </div>
  );
}
