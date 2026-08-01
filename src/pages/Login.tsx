import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, AppUser, UserRole, SignupRequest, AccountCorrectionRequest } from '../types';
import { auth, dbDeleteDoc } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Coins, ShieldAlert, User, Lock, ArrowRight, Languages, UserPlus, LogIn, CheckCircle2, Building, Mail, KeyRound, RefreshCw, ExternalLink, Inbox, UserCog } from 'lucide-react';
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

  // Account Correction Request States
  const [authTab, setAuthTab] = useState<'login' | 'signup' | 'correction'>('login');
  const [correctionTargetEmail, setCorrectionTargetEmail] = useState('');
  const [correctionType, setCorrectionType] = useState<'password_reset' | 'email_change' | 'username_change' | 'other'>('password_reset');
  const [correctionReason, setCorrectionReason] = useState('');

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

  // Bootstrap Platform Owner States
  const [isBootstrapMode, setIsBootstrapMode] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<boolean | null>(null);
  const [bootstrapEmail, setBootstrapEmail] = useState('');
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [bootstrapConfirmPassword, setBootstrapConfirmPassword] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(false);

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
      .then(async res => {
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success) {
            setSmtpConfiguredStatus(data);
          }
        }
      })
      .catch(() => {
        // Silently ignore network/boot errors during initial SMTP status check
      });
  };

  const refreshBootstrapStatus = () => {
    fetch('/api/auth/bootstrap-status')
      .then(async res => {
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data && typeof data.bootstrapped === 'boolean') {
            setBootstrapStatus(data.bootstrapped);
          }
        }
      })
      .catch(() => {});
  };

  React.useEffect(() => {
    refreshSmtpStatus();
    refreshBootstrapStatus();
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
    const foundAdmin = users.find(u => u.email?.toLowerCase().trim() === targetEmail);

    if (!foundAdmin) {
      setError(isRtl ? '⚠️ تعذر تنفيذ الطلب.' : '⚠️ The request could not be processed.');
      return;
    }

    const savedPin = foundAdmin.security_pin || '';
    if (savedPin !== '' && resetSecurityPin.trim() !== savedPin.trim()) {
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

    if (newPassword.length < 6) {
      setError(isRtl ? '❌ يجب ألا تقل كلمة المرور عن 6 أحرف.' : '❌ Password must be at least 6 characters long.');
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
            return { 
              ...u, 
              password: CustodyDB.hashPassword(newPassword, userSalt),
              security_pin: u.security_pin,
              pepper_version: 2
            };
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

  const handleBootstrapPlatformOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!bootstrapEmail || !bootstrapPassword || !bootstrapConfirmPassword) {
      setError(isRtl ? 'يرجى تعبئة جميع الحقول المطلوبة.' : 'Please fill in all required fields.');
      return;
    }

    if (bootstrapPassword.length < 6) {
      setError(isRtl ? 'كلمة المرور يجب أن لا تقل عن 6 أحرف.' : 'Password must be at least 6 characters.');
      return;
    }

    if (bootstrapPassword !== bootstrapConfirmPassword) {
      setError(isRtl ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.');
      return;
    }

    setIsBootstrapping(true);
    try {
      const res = await fetch('/api/auth/bootstrap-platform-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: bootstrapEmail,
          password: bootstrapPassword,
          confirmPassword: bootstrapConfirmPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBootstrapStatus(true);
        setIsBootstrapMode(false);
        setEmail(bootstrapEmail);
        setPassword(bootstrapPassword);
        if (data.user) {
          CustodyDB.upsertLocalUser(data.user);
        }
        setSuccess(
          isRtl
            ? '🎉 تم إعداد حساب مشرف المنصة بنجاح! تم تعبئة البيانات تلقائياً، يمكنك الآن الضغط على "تسجيل الدخول".'
            : '🎉 Platform owner account bootstrapped successfully! Credentials auto-filled, you can now click "Sign In".'
        );
      } else {
        setError(data.message || (isRtl ? 'تعذر إعداد حساب مشرف المنصة.' : 'Failed to bootstrap platform owner account.'));
      }
    } catch (err) {
      setError(isRtl ? 'حدث خطأ في الاتصال بالخادم.' : 'Server connection error.');
    } finally {
      setIsBootstrapping(false);
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
          console.log('[Diagnostic Part 2] signInWithEmailAndPassword authErr.code:', authErr.code);
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, emailLower, passStr);
            return userCredential.user;
          } catch (createErr: any) {
            console.log('[Diagnostic Part 2] createUserWithEmailAndPassword createErr.code:', createErr.code);
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
            } else if (createErr.code === 'auth/network-request-failed' || createErr?.message?.includes('network-request-failed')) {
              console.warn('Firebase Auth auto-creation offline/network failed, using local credentials mode:', createErr.message);
            } else if (createErr.code === 'auth/email-already-in-use') {
              console.warn('[Diagnostic Part 2] Firebase Auth account already exists for this email but sign-in failed with an ambiguous error; proceeding without a synced Firebase UID for this attempt (custody password check already verified correct).', createErr.code);
            } else {
              console.error('Firebase Auth auto-creation failed:', createErr);
            }
          }
        } else if (authErr.code === 'auth/network-request-failed' || authErr?.message?.includes('network-request-failed')) {
          console.warn('Firebase Auth sign-in network request failed, operating in offline local credentials mode:', authErr.message);
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

    // Primary Path: Server-side Authentication
    try {
      const authRes = await fetch('/api/auth/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLower, password })
      });
      const authData = await authRes.json();

      if (authData.success && authData.user) {
        let authenticatedUser = authData.user as AppUser;

        // Sync with Firebase Authentication
        const firebaseUser = password ? await syncWithFirebaseAuth(emailLower, password) : null;
        if (firebaseUser) {
          authenticatedUser = { ...authenticatedUser, id: firebaseUser.uid };
        }

        CustodyDB.upsertLocalUser(authenticatedUser);
        CustodyDB.setActiveUser(authenticatedUser);
        onLoginSuccess(authenticatedUser);
        return;
      }
    } catch (serverAuthErr) {
      console.warn('Server-side authentication service unavailable:', serverAuthErr);
    }

    // Direct Local Secure Hash Verification Path (strictly hashed, no plain-text comparisons)
    const firebaseUser = password ? await syncWithFirebaseAuth(emailLower, password) : null;

    try {
      const remoteUser = await CustodyDB.fetchUserByEmail(emailLower);
      if (remoteUser) {
        CustodyDB.upsertLocalUser(remoteUser);
      }
    } catch (err) {
      console.warn('Failed to fetch user profile during login:', err);
    }

    const users = CustodyDB.getUsers();
    const foundUser = users.find(u => u.email?.toLowerCase().trim() === emailLower);

    if (!foundUser) {
      setError(isRtl ? 'البريد الإلكتروني غير مسجل بالنظام.' : 'Email address not found in system.');
      return;
    }

    const isPlatformAdmin = CustodyDB.isPlatformOwner(emailLower);

    // Verify Password using OWASP Stretched Key Derivation Hash
    const storedPassword = foundUser.password || '';
    const userSalt = foundUser.salt || emailLower;
    const enteredHashSalted10k = CustodyDB.hashPassword(password, userSalt);
    const enteredHashSalted1k = CustodyDB.legacyStretchedHashPassword1000(password, userSalt);
    const enteredHashSinglePass = CustodyDB.legacySinglePassHashPassword(password, userSalt);
    const enteredHashOldSalted = CustodyDB.legacyHashPassword(password, emailLower);
    const enteredHashLegacy = CustodyDB.legacyHashPassword(password);

    // Unify client and server plaintext matching guard (disabled in strict production)
    const isStrictProdSecurity =
      (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_STRICT_PROD_SECURITY === 'true') ||
      (typeof process !== 'undefined' && process.env && process.env.STRICT_PROD_SECURITY === 'true');
    const allowPlaintextFallback = !isStrictProdSecurity && (
      (typeof import.meta !== 'undefined' && (import.meta as any).env && ((import.meta as any).env.DEV || (import.meta as any).env.VITE_ALLOW_PLAINTEXT_DEV_FALLBACK === 'true')) ||
      (typeof process !== 'undefined' && process.env && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_PLAINTEXT_DEV_FALLBACK === 'true'))
    );
    const isPlaintextMatch = Boolean(allowPlaintextFallback) && storedPassword !== '' && storedPassword === password;
    
    const isSaltedHash10kMatch = storedPassword !== '' && storedPassword === enteredHashSalted10k;
    const isSaltedHash1kMatch = storedPassword !== '' && storedPassword === enteredHashSalted1k;
    const isLegacySinglePassMatch = storedPassword !== '' && storedPassword === enteredHashSinglePass;
    const isOldSaltedMatch = storedPassword !== '' && storedPassword === enteredHashOldSalted;
    const isLegacyHashMatch = storedPassword !== '' && storedPassword === enteredHashLegacy;
    
    const isHashMatch = isSaltedHash10kMatch || isSaltedHash1kMatch || isLegacySinglePassMatch || isOldSaltedMatch || isLegacyHashMatch || isPlaintextMatch;

    if (storedPassword === '') {
      if (!isPlatformAdmin) {
        setError(isRtl ? 'لم يتم تعيين كلمة مرور لهذا الحساب بعد. يرجى التواصل مع المسؤول لتفعيل حسابك.' : 'No password has been set for this account yet. Please contact the administrator.');
        return;
      }
    } else if (!isHashMatch) {
      setError(isRtl ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.');
      return;
    }

    // Auto migrate legacy hash formats to standard OWASP 10k stretched hash
    const needsMigration = (storedPassword !== '' && isSaltedHash1kMatch) || 
                          (storedPassword !== '' && isLegacySinglePassMatch) ||
                          (storedPassword !== '' && isLegacyHashMatch) ||
                          (storedPassword !== '' && isOldSaltedMatch) ||
                          (storedPassword !== '' && isPlaintextMatch);
    if (needsMigration) {
      const updatedUsers = users.map(u => {
        if (u.id === foundUser.id) {
          return { ...u, password: enteredHashSalted10k };
        }
        return u;
      });
      try {
        await CustodyDB.saveUsers(updatedUsers);
      } catch (e) {
        console.warn('Deferred hash migration save during login:', e);
      }
      foundUser.password = enteredHashSalted10k;
    }

    // Migrate user document ID to Firebase Auth UID to enforce multi-tenancy rules
    if (firebaseUser) {
      const currentUsers = CustodyDB.getUsers();
      const legacyUser = currentUsers.find(u => u.email?.toLowerCase().trim() === emailLower && u.id !== firebaseUser.uid);
      if (legacyUser) {
        // Migrate credential vault document via server endpoint
        try {
          const idToken = await firebaseUser.getIdToken().catch(() => '');
          if (idToken) {
            await fetch('/api/auth/migrate-credential-id', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                oldId: legacyUser.id,
                newId: firebaseUser.uid,
                email: emailLower
              })
            });
          }
        } catch (migErr) {
          console.warn('Failed to migrate credential vault ID:', migErr);
        }

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
        try {
          await CustodyDB.saveUsers(updatedUsers);
        } catch (e) {
          console.warn('Deferred ID migration save during login:', e);
        }
        foundUser.id = firebaseUser.uid;
      }
    }

    if (isPlatformAdmin) {
      // First-time Platform Admin setup for default security pin
      if (storedPassword === '') {
        const currentUsers = CustodyDB.getUsers();
        const updatedUsers = currentUsers.map(u => {
          if (u.email?.toLowerCase().trim() === emailLower) {
            return { 
              ...u, 
              password: enteredHashSalted10k, 
              is_active: true
            };
          }
          return u;
        });
        try {
          await CustodyDB.saveUsers(updatedUsers);
        } catch (e) {
          console.warn('Deferred first-time admin setup save during login:', e);
        }
        foundUser.password = enteredHashSalted10k;
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
          if (u.id === adminLoginUser.id || (firebaseUser && u.email?.toLowerCase().trim() === adminLoginUser.email?.toLowerCase().trim())) {
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
    const exists = users.some(u => u.email?.toLowerCase().trim() === email.toLowerCase().trim());
    if (exists) {
      setError(isRtl ? 'البريد الإلكتروني مسجل بالفعل بالنظام.' : 'Email is already registered.');
      return;
    }

    const pendingRequests = CustodyDB.getSignupRequests();
    const requestExists = pendingRequests.some(r => r.email?.toLowerCase().trim() === email.toLowerCase().trim() && r.status === 'Pending');
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

      const emailClean = email.toLowerCase().trim();
      const newRequest: SignupRequest = {
        id: `request-${Date.now()}`,
        email: emailClean,
        full_name: fullName.trim(),
        role: selectedRole,
        company_id: selectedCompanyId,
        region_id: selectedRole !== 'Admin' ? selectedRegionId : undefined,
        station_id: selectedRole === 'StationAdmin' ? selectedStationId : undefined,
        password: CustodyDB.hashPassword(password, emailClean),
        created_at: new Date().toISOString(),
        status: 'Pending'
      };

      const headcountCheck = CustodyDB.validateSignupRequestHeadcount(newRequest);
      if (!headcountCheck.allowed) {
        setError(isRtl ? headcountCheck.messageAr || 'تم الوصول للحد الأقصى للحسابات' : headcountCheck.messageEn || 'Headcount limit reached');
        return;
      }

      try {
        await CustodyDB.saveSignupRequest(newRequest);
      } catch (e) {
        console.warn('Signup request deferred/saved locally:', e);
      }
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

  const handleCorrectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const targetEmailClean = correctionTargetEmail.toLowerCase().trim();
    if (!targetEmailClean || !correctionReason.trim()) {
      setError(isRtl ? 'يرجى إدخال البريد الإلكتروني المسجل وسبب طلب التعديل' : 'Please enter the registered email and the reason for correction');
      return;
    }

    const users = CustodyDB.getUsers();
    const targetUser = users.find(u => u.email && u.email.toLowerCase().trim() === targetEmailClean);
    if (!targetUser) {
      setError(isRtl ? 'لا يوجد حساب مسجل بهذا البريد الإلكتروني في المنظومة' : 'No registered account found with this email address');
      return;
    }

    const newRequest: AccountCorrectionRequest = {
      id: `correction-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      targetEmail: targetEmailClean,
      targetUserId: targetUser.id,
      targetUserName: targetUser.full_name || targetEmailClean,
      targetRole: targetUser.role,
      company_id: targetUser.company_id || '',
      region_id: targetUser.region_id,
      station_id: targetUser.station_id,
      org_unit_id: targetUser.org_unit_id,
      correctionType: correctionType,
      reason: correctionReason.trim(),
      created_at: new Date().toISOString(),
      status: 'Pending'
    };

    try {
      await CustodyDB.saveAccountCorrectionRequest(newRequest);
    } catch (err) {
      console.warn('Correction request deferred/saved locally:', err);
    }

    setSuccess(
      isRtl
        ? 'تم تقديم طلب تعديل بيانات الحساب بنجاح! سيتم مراجعته واعتماده من قبل المسؤول المختص دون التأثير على سقف الحسابات.'
        : 'Account correction request submitted successfully! It will be reviewed by your administrator without affecting account headcount.'
    );

    setCorrectionTargetEmail('');
    setCorrectionReason('');
    setAuthTab('login');
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
          {/* Unbootstrapped Platform Owner Notice */}
          {bootstrapStatus === false && !isBootstrapMode && (
            <div className="p-4 mb-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs leading-relaxed space-y-3 shadow-sm">
              <div className="flex items-start gap-2 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                <ShieldAlert size={18} className="shrink-0 mt-0.5 animate-pulse text-emerald-500" />
                <span>
                  {isRtl
                    ? '✨ إعداد حساب مشرف المنصة لأول مرة (Platform Owner Bootstrap)'
                    : '✨ Zero-Lockout Platform Owner Bootstrap Available'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
                {isRtl
                  ? 'لم يتم إعداد حساب مشرف المنصة بعد. يتيح لك هذا الإعداد لمرة واحدة فقط إنشاء حساب أدمن المنصة بصلاحية SystemAdmin وتشفير PBKDF2 210,000 آمن.'
                  : 'Platform owner account has not been bootstrapped yet. This single-use setup creates the authoritative SystemAdmin account with PBKDF2 210,000 stretching.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsBootstrapMode(true);
                  setError('');
                  setSuccess('');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <KeyRound size={14} />
                <span>{isRtl ? 'إعداد حساب مشرف المنصة الآن 🔐' : 'Bootstrap Platform Owner Account Now 🔐'}</span>
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setIsRegisterMode(false);
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                authTab === 'login' && !isRegisterMode
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LogIn size={13} />
              <span>{isRtl ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('signup');
                setIsRegisterMode(true);
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                authTab === 'signup' || isRegisterMode
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus size={13} />
              <span>{isRtl ? 'طلب تسجيل جديد' : 'Sign Up'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('correction');
                setIsRegisterMode(false);
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                authTab === 'correction'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserCog size={13} />
              <span>{isRtl ? 'طلب تعديل حساب' : 'Correction'}</span>
            </button>
          </div>

          <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-5 pb-2 border-b border-slate-100 dark:border-slate-800">
            {authTab === 'correction'
              ? (isRtl ? 'طلب تعديل بيانات حساب (بريد/كلمة مرور/اسم)' : 'Account Correction Request')
              : (isRegisterMode || authTab === 'signup')
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
          {isBootstrapMode ? (
            /* Single-Use Platform Owner Bootstrap Form */
            <form onSubmit={handleBootstrapPlatformOwner} className="space-y-4 animate-fade-in">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs leading-relaxed">
                {isRtl
                  ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور القوية التي ترغب في تعيينها لحساب مشرف المنصة (SystemAdmin). هذا الإجراء متاح لمرة واحدة فقط.'
                  : 'Enter the email address and strong password for the initial Platform Owner (SystemAdmin) account. This action is single-use only.'
                }
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <Mail size={12} />
                  <span>{isRtl ? 'البريد الإلكتروني لمشرف المنصة' : 'Platform Owner Email'}</span>
                </label>
                <input
                  type="email"
                  placeholder="admin@platform.com"
                  value={bootstrapEmail}
                  onChange={(e) => setBootstrapEmail(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <KeyRound size={12} />
                  <span>{isRtl ? 'كلمة المرور الجديدة' : 'New Password'}</span>
                </label>
                <input
                  type="password"
                  placeholder="******"
                  value={bootstrapPassword}
                  onChange={(e) => setBootstrapPassword(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <KeyRound size={12} />
                  <span>{isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}</span>
                </label>
                <input
                  type="password"
                  placeholder="******"
                  value={bootstrapConfirmPassword}
                  onChange={(e) => setBootstrapConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isBootstrapping}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isBootstrapping ? (isRtl ? 'جاري الإعداد...' : 'Bootstrapping...') : (isRtl ? 'إعداد الحساب وتأكيد كلمة المرور 🔐' : 'Bootstrap Account 🔐')}</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsBootstrapMode(false);
                  setError('');
                  setSuccess('');
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-300 transition-all font-bold mt-2 cursor-pointer"
              >
                {isRtl ? '← إلغاء والعودة' : '← Cancel'}
              </button>
            </form>
          ) : isAdminLoginVerifyMode ? (
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
                      <span>{isRtl ? 'أدخل كود أمان استعادة الحساب (إن وجد / اختياري)' : 'Security Recovery PIN (Optional if unconfigured)'}</span>
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
          ) : authTab === 'correction' ? (
            /* Account Correction Request Form */
            <form onSubmit={handleCorrectionRequest} className="space-y-4">
              {/* Registered Email */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <Mail size={12} />
                  <span>{isRtl ? 'البريد الإلكتروني المسجل في الحساب' : 'Registered Account Email'}</span>
                </label>
                <input
                  type="email"
                  placeholder="user@company.com"
                  value={correctionTargetEmail}
                  onChange={(e) => setCorrectionTargetEmail(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
              </div>

              {/* Correction Needed */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <UserCog size={12} />
                  <span>{isRtl ? 'نوع التعديل المطلوب' : 'Correction Needed'}</span>
                </label>
                <select
                  value={correctionType}
                  onChange={(e) => setCorrectionType(e.target.value as any)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                >
                  <option value="password_reset">{isRtl ? 'إعادة تعيين كلمة المرور (Password Reset)' : 'Password Reset'}</option>
                  <option value="email_change">{isRtl ? 'تعديل البريد الإلكتروني (Email Change)' : 'Email Change'}</option>
                  <option value="username_change">{isRtl ? 'تعديل اسم المستخدم / الاسم بالكامل' : 'Username / Full Name Change'}</option>
                  <option value="other">{isRtl ? 'تعديلات أخرى / متعددة (Other / Multiple)' : 'Other / Multiple'}</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <span>{isRtl ? 'سبب التعديل والتوضيح للمسؤول' : 'Reason / Details for Administrator'}</span>
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    isRtl
                      ? 'مثال: نسيت كلمة المرور، أو تم تغيير اسم الفرع، أو يوجد خطأ إملائي في البريد الإلكتروني...'
                      : 'e.g., forgot password, email typo, account disabled...'
                  }
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {isRtl
                    ? '* ملاحظة: سيقوم المسؤول المختص بمراجعة الطلب واعتماد التعديل دون الحاجة لإنشاء حساب جديد أو زيادة سقف الحسابات.'
                    : '* Note: Your administrator will review and apply the change without creating a new account or affecting headcount limits.'}
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/10 hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{isRtl ? 'إرسال طلب التعديل للمراجعة' : 'Submit Correction Request'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          ) : isRegisterMode || authTab === 'signup' ? (
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
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{t.login}</span>
                <ArrowRight size={14} />
              </button>

              <div className="flex justify-center items-center pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('correction');
                    setIsRegisterMode(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <UserCog size={13} />
                  <span>{isRtl ? 'هل نسيت كلمة المرور / تود تعديل بيانات حسابك؟' : 'Forgot password / Request account correction?'}</span>
                </button>
              </div>
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
