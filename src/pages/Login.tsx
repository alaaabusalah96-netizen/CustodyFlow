import React, { useState } from 'react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, AppUser } from '../types';
import { Coins, ShieldAlert, KeyRound, User, Lock, ArrowRight, Languages } from 'lucide-react';

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Attempt to match pre-seeded user database records
    const users = CustodyDB.getUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (foundUser) {
      // Allow any password in simulation mode to keep testing smooth
      CustodyDB.setActiveUser(foundUser);
      onLoginSuccess(foundUser);
    } else {
      setError(isRtl ? 'البريد الإلكتروني غير مسجل بقاعدة البيانات.' : 'Email address not recognized in corporate registry.');
    }
  };

  // One-click quick login for testing
  const handleQuickLogin = (role: 'SystemAdmin' | 'Admin' | 'RegionalManager' | 'StationAdmin', email?: string) => {
    const users = CustodyDB.getUsers();
    let targetedUser = email ? users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) : users.find(u => u.role === role);
    if (targetedUser) {
      CustodyDB.setActiveUser(targetedUser);
      onLoginSuccess(targetedUser);
    }
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
            {t.loginSubtitle}
          </p>
        </div>

        {/* Card Frame */}
        <div className={`p-6 rounded-3xl border shadow-xl ${
          theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200 shadow-slate-100'
        }`}>
          <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-5 pb-2 border-b border-slate-100 dark:border-slate-800">
            {t.loginTitle}
          </h3>

          {/* Error notice */}
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
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

            {/* Sign-in trigger */}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg flex items-center justify-center gap-1.5"
            >
              <span>{t.login}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Quick Pre-configured options layout (Friction-free setup) */}
          <div className="mt-6 border-t pt-4 border-slate-100 dark:border-slate-800">
            <span className="block text-[10px] text-slate-400 font-bold uppercase mb-3 text-center">
              💡 {isRtl ? 'تجربة سريعة لمختلف الصلاحيات والشركات' : 'Quick multi-role & multi-company simulation'} 💡
            </span>

            <div className="grid gap-2 grid-cols-2">
              {/* System Owner */}
              <button
                type="button"
                onClick={() => handleQuickLogin('SystemAdmin')}
                className={`p-2 rounded-xl border text-center transition-all hover:scale-[1.01] col-span-2 ${
                  theme === 'dark' 
                    ? 'bg-indigo-950/40 border-indigo-500/40 hover:bg-indigo-950/60' 
                    : 'bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10'
                }`}
              >
                <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  👑 {isRtl ? 'أدمن منصة (أنا)' : 'Platform Admin (Me)'}
                </span>
                <span className="block text-[8px] text-slate-400 font-mono mt-0.5">
                  Full multi-company control
                </span>
              </button>

              {/* Futtaim Admin */}
              <button
                type="button"
                onClick={() => handleQuickLogin('Admin', 'ahmed@futtaim.com')}
                className={`p-1.5 rounded-xl border text-center transition-all hover:scale-[1.01] ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-rose-500/30 hover:bg-slate-700' 
                    : 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
                }`}
              >
                <span className="block text-[10px] font-bold text-rose-600 dark:text-rose-400 truncate">
                  {isRtl ? 'أحمد (ادمن الشركة الفطيم)' : 'Ahmed (Futtaim Company Admin)'}
                </span>
                <span className="block text-[8px] text-slate-400 font-mono mt-0.5">
                  Company Admin
                </span>
              </button>

              {/* Futtaim Cashier */}
              <button
                type="button"
                onClick={() => handleQuickLogin('StationAdmin', 'mariam@futtaim.com')}
                className={`p-1.5 rounded-xl border text-center transition-all hover:scale-[1.01] ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-emerald-500/30 hover:bg-slate-700' 
                    : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                }`}
              >
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {isRtl ? 'مريم (مدير محطة الفطيم)' : 'Mariam (Futtaim Station Manager)'}
                </span>
                <span className="block text-[8px] text-slate-400 font-mono mt-0.5">
                  Station Manager
                </span>
              </button>

              {/* Elsewedy Admin */}
              <button
                type="button"
                onClick={() => handleQuickLogin('Admin', 'hassan@elsewedy.com')}
                className={`p-1.5 rounded-xl border text-center transition-all hover:scale-[1.01] ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-amber-500/30 hover:bg-slate-700' 
                    : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                }`}
              >
                <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate">
                  {isRtl ? 'حسن (ادمن الشركة السويدي)' : 'Hassan (Sewedy Company Admin)'}
                </span>
                <span className="block text-[8px] text-slate-400 font-mono mt-0.5">
                  Company Admin
                </span>
              </button>

              {/* Elsewedy Cashier */}
              <button
                type="button"
                onClick={() => handleQuickLogin('StationAdmin', 'zain@elsewedy.com')}
                className={`p-1.5 rounded-xl border text-center transition-all hover:scale-[1.01] ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-cyan-500/30 hover:bg-slate-700' 
                    : 'bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/10'
                }`}
              >
                <span className="block text-[10px] font-bold text-cyan-600 dark:text-cyan-400 truncate">
                  {isRtl ? 'زين (مدير محطة السويدي)' : 'Zain (Sewedy Station Manager)'}
                </span>
                <span className="block text-[8px] text-slate-400 font-mono mt-0.5">
                  Station Manager
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-[10px] font-mono text-slate-400">
        &copy; 2026 {t.title} ERP. {t.allRightsReserved}
      </div>
    </div>
  );
}
