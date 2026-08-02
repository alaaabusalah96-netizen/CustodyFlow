import React, { useEffect } from 'react';
import { CustodyDB } from '../db';
import { Language, Theme, AppUser } from '../types';
import kemitLogo from '../assets/images/kemit_logo_1784280480891.jpg';

interface LoginProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  onLoginSuccess: (user: AppUser) => void;
}

export default function Login({
  language,
  onLoginSuccess
}: LoginProps) {
  const isRtl = language === 'ar';

  useEffect(() => {
    // TEMP AUTH BYPASS: if Login ever mounts, immediately "succeed" with DEV user
    const AUTH_BYPASS_ENABLED =
      typeof window !== 'undefined' && (window as any).__AUTH_BYPASS__ === true;
    if (!AUTH_BYPASS_ENABLED) return;

    const devUser = {
      id: 'dev-bypass-user',
      email: 'dev@local',
      full_name: 'Dev Bypass (مؤقت)',
      role: 'SystemAdmin' as const,
      is_active: true,
      is_platform_owner: true,
      company_id: '',
      permissions: {
        create_expense: true, edit_expense: true, delete_expense: true,
        create_voucher: true, approve_voucher: true, reject_voucher: true,
        create_custody: true, edit_custody: true, replace_custody: true,
        view_reports: true, manage_users: true, manage_companies: true,
        manage_regions: true, manage_stations: true, manage_roles: true,
        manage_settings: true, settle_voucher: true,
      },
    };
    try {
      CustodyDB.setActiveUser(devUser as any);
    } catch {}
    onLoginSuccess(devUser as any);
  }, [onLoginSuccess]);

  const AUTH_BYPASS_ENABLED =
    typeof window !== 'undefined' && (window as any).__AUTH_BYPASS__ === true;

  if (AUTH_BYPASS_ENABLED) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 ${isRtl ? 'font-cairo' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img
          className="mx-auto h-16 w-auto rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
          src={kemitLogo}
          alt="KEMIT ERP"
        />
        <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
          {isRtl ? 'منصة KEMIT ERP' : 'KEMIT ERP Platform'}
        </h2>
        <div className="mt-8 bg-white dark:bg-slate-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {isRtl ? 'نظام الدخول قيد إعادة البناء / Auth will be rebuilt later' : 'Auth will be rebuilt later / نظام الدخول قيد إعادة البناء'}
          </p>
        </div>
      </div>
    </div>
  );
}
