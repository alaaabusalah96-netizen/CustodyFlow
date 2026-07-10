import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, AppUser, UserRole, SignupRequest } from '../types';
import { Coins, ShieldAlert, User, Lock, ArrowRight, Languages, UserPlus, LogIn, CheckCircle2, Building, Mail, KeyRound, RefreshCw, ExternalLink, Inbox } from 'lucide-react';

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
  const [smtpAdminEmail, setSmtpAdminEmail] = useState('alaaabusalah96@gmail.com');
  const [smtpAdminPassword, setSmtpAdminPassword] = useState('');
  const [smtpSecurityPin, setSmtpSecurityPin] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpConfiguredStatus, setSmtpConfiguredStatus] = useState<{ configured: boolean; host?: string; user?: string } | null>(null);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  React.useEffect(() => {
    fetch('/api/auth/smtp-config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSmtpConfiguredStatus(data);
        }
      })
      .catch(err => console.error("Error fetching SMTP status:", err));
  }, [showSmtpModal]);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setIsSavingSmtp(true);

    try {
      const res = await fetch('/api/auth/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: smtpAdminEmail,
          adminPassword: smtpAdminPassword,
          securityPin: smtpSecurityPin,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass
        })
      });
      const data = await res.json();
      setIsSavingSmtp(false);

      if (data.success) {
        setModalSuccess(data.message || (isRtl ? 'تم حفظ الإعدادات بنجاح!' : 'SMTP settings saved successfully!'));
        // Clear sensitive inputs
        setSmtpAdminPassword('');
        setSmtpSecurityPin('');
        
        // Refresh status
        fetch('/api/auth/smtp-config')
          .then(r => r.json())
          .then(statusData => {
            if (statusData.success) {
              setSmtpConfiguredStatus(statusData);
            }
          });
      } else {
        setModalError(data.message || (isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.'));
      }
    } catch (err) {
      setIsSavingSmtp(false);
      setModalError(isRtl ? 'تعذر تنفيذ الطلب.' : 'The request could not be processed.');
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      setModalError(isRtl ? 'يرجى ملء جميع حقول SMTP أولاً لاختبار الاتصال.' : 'Please fill all SMTP fields first to test the connection.');
      return;
    }

    setModalError('');
    setModalSuccess('');
    setIsTestingSmtp(true);

    try {
      const res = await fetch('/api/auth/smtp-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass
        })
      });
      const data = await res.json();
      setIsTestingSmtp(false);

      if (data.success) {
        setModalSuccess(data.message || (isRtl ? 'تم إرسال البريد التجريبي بنجاح!' : 'Test email sent successfully!'));
      } else {
        setModalError(data.message || (isRtl ? 'فشل اختبار الاتصال.' : 'Connection test failed.'));
      }
    } catch (err) {
      setIsTestingSmtp(false);
      setModalError(isRtl ? 'تعذر الاتصال بالخادم للاختبار.' : 'Could not reach server for connection test.');
    }
  };

  const companies = CustodyDB.getCompanies();
  const activeCompanies = companies.filter(c => c.is_active !== false && c.subscription_status === 'active');
  const filteredRegions = CustodyDB.getRegions().filter(r => r.company_id === selectedCompanyId);
  const filteredStations = CustodyDB.getStations().filter(s => s.region_id === selectedRegionId);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const targetEmail = resetEmail.toLowerCase().trim();
    const isPlatformAdmin = targetEmail === 'alaaabusalah96@gmail.com' || targetEmail === 'alaabusalah96@gmail.com';

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
          const isPlatformAdmin = u.email && (
            u.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || 
            u.email.toLowerCase().trim() === 'alaabusalah96@gmail.com'
          );
          if (isPlatformAdmin) {
            return { ...u, password: newPassword };
          }
          return u;
        });

        CustodyDB.saveUsers(updatedUsers);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const users = CustodyDB.getUsers();
    const foundUser = users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());

    if (!foundUser) {
      setError(isRtl ? 'البريد الإلكتروني غير مسجل بالنظام.' : 'Email address not found in system.');
      return;
    }

    const isPlatformAdmin = foundUser.email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || foundUser.email.toLowerCase().trim() === 'alaabusalah96@gmail.com';

    if (isPlatformAdmin) {
      const storedPassword = foundUser.password || '';
      
      // If a password is already registered/saved, we must validate it first!
      if (storedPassword !== '' && storedPassword !== password) {
        setError(isRtl ? 'كلمة المرور غير صحيحة لحساب أدمن المنصة.' : 'Incorrect password for Platform Admin.');
        return;
      }

      // First-time Platform Admin login - set password and default security pin
      if (storedPassword === '') {
        const usersList = CustodyDB.getUsers();
        const updatedUsers = usersList.map(u => {
          if (u.email.toLowerCase().trim() === foundUser.email.toLowerCase().trim()) {
            return { 
              ...u, 
              password: password, 
              is_active: true,
              security_pin: '1234' // Default recovery security pin for admin if first time
            };
          }
          return u;
        });
        CustodyDB.saveUsers(updatedUsers);
        foundUser.password = password;
        foundUser.security_pin = '1234';
      }

      foundUser.is_active = true;
      CustodyDB.setActiveUser(foundUser);
      onLoginSuccess(foundUser);
      return;
    }

    // Normal user password verification
    const userPassword = foundUser.password || '123456';
    if (userPassword !== password) {
      setError(isRtl ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.');
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
        const users = CustodyDB.getUsers();
        const updatedUsers = users.map(u => {
          if (u.id === adminLoginUser.id) {
            return { 
              ...u, 
              password: adminLoginEnteredPassword,
              security_pin: isFirstTime ? adminSelectedSecurityPin.trim() : u.security_pin
            };
          }
          return u;
        });
        CustodyDB.saveUsers(updatedUsers);

        const finalUser = { 
          ...adminLoginUser, 
          password: adminLoginEnteredPassword,
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError(isRtl ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill all required fields.');
      return;
    }

    const isPlatformAdmin = email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || email.toLowerCase().trim() === 'alaabusalah96@gmail.com';

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

      CustodyDB.saveUsers([...users, newUser]);
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-3 animate-pulse">
            <Coins className="h-6 w-6" />
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

              {/* Conditionally hide company and role for alaaabusalah96@gmail.com which is the system owner */}
              {!(email.toLowerCase().trim() === 'alaaabusalah96@gmail.com' || email.toLowerCase().trim() === 'alaabusalah96@gmail.com') && (
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
      {showSmtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 ${
            theme === 'dark' ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-start border-b border-indigo-500/10 pb-4 mb-4">
              <div className="text-right flex-1" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                <h3 className="text-sm font-black flex items-center gap-2 text-indigo-500 justify-start">
                  <Mail size={16} />
                  <span>{isRtl ? 'إعدادات خادم البريد السري (SMTP)' : 'SMTP Private Mailer Settings'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {isRtl 
                    ? 'قم بإدخال بيانات حساب Gmail الخاص بك وكلمة مرور التطبيق ذات الـ 16 حرفاً لتفعيل إرسال أكواد الـ OTP تلقائياً.' 
                    : 'Input your Gmail account details and the 16-character App Password to authorize secure OTP dispatch.'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowSmtpModal(false);
                  setModalError('');
                  setModalSuccess('');
                }}
                className="text-slate-400 hover:text-red-500 font-bold transition-all text-sm px-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Internal Alerts */}
            {modalSuccess && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-start gap-2 text-right" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {modalError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-start gap-2 text-right" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSmtp} className="space-y-4 text-right" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              {/* Part 1: Admin Authorization */}
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-right">
                <span className="text-[10px] font-bold text-indigo-400 block mb-2">
                  🔐 {isRtl ? 'تأكيد هوية أدمن المنصة لإجراء التغيير' : 'Verify Platform Admin Identity'}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">{isRtl ? 'بريد الأدمن' : 'Admin Email'}</label>
                    <input 
                      type="email" 
                      value={smtpAdminEmail}
                      onChange={(e) => setSmtpAdminEmail(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">{isRtl ? 'كلمة المرور' : 'Password'}</label>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={smtpAdminPassword}
                      onChange={(e) => setSmtpAdminPassword(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                      }`}
                      required
                    />
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <label className="block text-[10px] text-slate-400 mb-1">{isRtl ? 'كود أمان استعادة حساب أدمن المنصة (Security PIN)' : 'Security PIN'}</label>
                  <input 
                    type="password" 
                    placeholder="e.g. 1234"
                    value={smtpSecurityPin}
                    onChange={(e) => setSmtpSecurityPin(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                      theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Part 2: SMTP server details */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  📬 {isRtl ? 'تكوين خادم SMTP وبوابة الإرسال' : 'SMTP Server Credentials'}
                </span>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1">{isRtl ? 'خادم SMTP' : 'SMTP Host'}</label>
                    <input 
                      type="text" 
                      placeholder="smtp.gmail.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">{isRtl ? 'المنفذ (Port)' : 'Port'}</label>
                    <input 
                      type="text" 
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                      }`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">{isRtl ? 'عنوان بريد المُرسِل (Gmail Email Address)' : 'Sender Email Address'}</label>
                  <input 
                    type="email" 
                    placeholder="your-email@gmail.com"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono focus:outline-none ${
                      theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] text-slate-400">{isRtl ? 'رمز مرور التطبيق ذو الـ 16 حرفاً (Gmail App Password)' : 'Gmail App Password (16 chars)'}</label>
                    <a 
                      href="https://myaccount.google.com/apppasswords" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>{isRtl ? 'صفحة كلمات مرور التطبيق' : 'App Passwords page'}</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <input 
                    type="password" 
                    placeholder="abcd efgh ijkl mnop"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono tracking-widest text-center focus:outline-none ${
                      theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                    required
                  />
                  <p className="text-[10px] text-amber-500 mt-1 leading-relaxed">
                    💡 {isRtl 
                      ? 'أدخل الرمز المكون من 16 حرفاً الذي حصلت عليه من حساب جوجل بدون مسافات، وتأكد من تفعيل ميزة التحقق بخطوتين.' 
                      : 'Provide the 16-character code from Google settings without spaces, and ensure 2-Step Verification is enabled on your account.'}
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isTestingSmtp || isSavingSmtp}
                    onClick={handleTestSmtp}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/20 text-amber-300' 
                        : 'bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800'
                    }`}
                  >
                    {isTestingSmtp ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>{isRtl ? 'جاري إرسال البريد التجريبي...' : 'Sending Test...'}</span>
                      </>
                    ) : (
                      <>
                        <Mail size={12} />
                        <span>{isRtl ? 'إرسال بريد تجريبي ✉️' : 'Send Test Email ✉️'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingSmtp || isTestingSmtp}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingSmtp ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>{isRtl ? 'جاري الحفظ...' : 'Saving...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={12} />
                        <span>{isRtl ? 'حفظ إعدادات الخادم 💾' : 'Save Config 💾'}</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowSmtpModal(false);
                    setModalError('');
                    setModalSuccess('');
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all border ${
                    theme === 'dark' 
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' 
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  {isRtl ? 'إغلاق النافذة' : 'Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <div className="text-[10px] font-mono text-slate-400 mt-6">
        &copy; 2026 {t.title} ERP. {t.allRightsReserved}
      </div>
    </div>
  );
}
