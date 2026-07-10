import React, { useState, useEffect } from 'react';
import { Mail, ShieldAlert, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { Theme } from '../types';

interface SMTPConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  isRtl: boolean;
  onConfigUpdated: () => void;
}

export default function SMTPConfigModal({
  isOpen,
  onClose,
  theme,
  isRtl,
  onConfigUpdated
}: SMTPConfigModalProps) {
  const [smtpAdminEmail, setSmtpAdminEmail] = useState('alaaabusalah96@gmail.com');
  const [smtpAdminPassword, setSmtpAdminPassword] = useState('');
  const [smtpSecurityPin, setSmtpSecurityPin] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setModalError('');
      setModalSuccess('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
        setSmtpAdminPassword('');
        setSmtpSecurityPin('');
        onConfigUpdated();
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

  return (
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
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 font-bold transition-all text-sm px-2"
          >
            ✕
          </button>
        </div>

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
                  theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200'
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
              onClick={onClose}
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
  );
}
