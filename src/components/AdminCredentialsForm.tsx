import React, { useState, useEffect } from 'react';
import { CustodyDB } from '../db';
import { auth } from '../firebase';
import { AppUser, UserPermissions, SignupRequest, AccountCorrectionRequest } from '../types';

export const PERMISSION_KEYS = [
  { key: 'create_expense', ar: 'إضافة وتسجيل المصروفات', en: 'Create & record expenses' },
  { key: 'delete_expense', ar: 'حذف المصروفات المسجلة', en: 'Delete recorded expenses' },
  { key: 'settle_voucher', ar: 'تسوية وإقفال المطالبات', en: 'Settle & close vouchers' },
  { key: 'replace_custody', ar: 'طلب استعاضة العهدة النقدية', en: 'Request replenishment' },
  { key: 'view_reports', ar: 'عرض وتصدير التقارير المالية', en: 'View financial reports' },
  { key: 'manage_settings', ar: 'إدارة الإعدادات والنسخ', en: 'Manage settings & backups' },
] as const;

interface AdminCredentialsFormProps {
  initialEmail: string;
  initialPassword: string;
  onSave: (email: string, pass: string, permissions: UserPermissions) => void;
  isRtl: boolean;
  placeholderEmail?: string;
  placeholderPassword?: string;
  userRole: 'Admin' | 'RegionalManager' | 'StationAdmin';
  companyId?: string;
  regionId?: string;
  stationId?: string;
}

export default function AdminCredentialsForm({ 
  initialEmail, 
  initialPassword, 
  onSave, 
  isRtl, 
  placeholderEmail,
  placeholderPassword,
  userRole,
  companyId,
  regionId,
  stationId
}: AdminCredentialsFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [isEditing, setIsEditing] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'account' | 'requests' | 'corrections'>('account');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Account correction request review states
  const [rejectingCorrectionId, setRejectingCorrectionId] = useState<string | null>(null);
  const [correctionRejectReason, setCorrectionRejectReason] = useState('');
  const [approvingCorrectionId, setApprovingCorrectionId] = useState<string | null>(null);
  const [correctionNewEmail, setCorrectionNewEmail] = useState('');
  const [correctionNewName, setCorrectionNewName] = useState('');
  const [correctionNewPassword, setCorrectionNewPassword] = useState('');
  const [correctionError, setCorrectionError] = useState('');

  const getDefaultPermissions = (): UserPermissions => {
    return CustodyDB.enrichUserPermissions(userRole);
  };

  const [permissions, setPermissions] = useState<UserPermissions>(getDefaultPermissions());
  const [isDefaultMode, setIsDefaultMode] = useState<boolean>(true);

  const activeUser = CustodyDB.getActiveUser();

  const canSeePendingRequests = (() => {
    if (!activeUser) return false;
    if (activeUser.role === 'SystemAdmin') return true;
    if (activeUser.role === 'Admin') {
      return userRole === 'RegionalManager' || userRole === 'StationAdmin';
    }
    if (activeUser.role === 'RegionalManager') {
      return userRole === 'StationAdmin';
    }
    return false;
  })();

  const pendingRequests = CustodyDB.getSignupRequests().filter(r => {
    if (r.status !== 'Pending') return false;
    if (userRole === 'Admin') {
      return r.role === 'Admin' && r.company_id === companyId;
    }
    if (userRole === 'RegionalManager') {
      return r.role === 'RegionalManager' && r.region_id === regionId;
    }
    if (userRole === 'StationAdmin') {
      return r.role === 'StationAdmin' && r.station_id === stationId;
    }
    return false;
  });

  const pendingCorrections = CustodyDB.getAccountCorrectionRequests().filter(r => {
    if (r.status !== 'Pending') return false;
    if (userRole === 'Admin') {
      return r.targetRole === 'Admin' && r.company_id === companyId;
    }
    if (userRole === 'RegionalManager') {
      return r.targetRole === 'RegionalManager' && r.region_id === regionId;
    }
    if (userRole === 'StationAdmin') {
      return r.targetRole === 'StationAdmin' && r.station_id === stationId;
    }
    return false;
  });

  useEffect(() => {
    setEmail(initialEmail);
    setPassword(initialPassword);
    let currentPerms = getDefaultPermissions();
    if (initialEmail) {
      const u = CustodyDB.getUsers().find(user => user.email?.toLowerCase() === initialEmail.toLowerCase());
      if (u?.permissions) {
        currentPerms = { ...u.permissions };
      }
    }
    setPermissions(currentPerms);

    // Check if current permissions match standard/default permissions for the role
    const defaults = getDefaultPermissions();
    const isMatching = PERMISSION_KEYS.every(k => !!currentPerms[k.key as keyof UserPermissions] === !!defaults[k.key as keyof UserPermissions]);
    setIsDefaultMode(isMatching);
  }, [initialEmail, initialPassword, userRole]);

  const handleToggleMode = (useDefault: boolean) => {
    setIsDefaultMode(useDefault);
    if (useDefault) {
      setPermissions(getDefaultPermissions());
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert(isRtl ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور' : 'Please enter both email and password.');
      return;
    }
    onSave(email.trim(), password.trim(), permissions);
    setIsEditing(false);
  };

  const ensureCompliantPassword = (p: string) => {
    const trimmed = p.trim();
    if (trimmed.length >= 12 && /[a-zA-Z]/.test(trimmed) && /[0-9]/.test(trimmed)) {
      return trimmed;
    }
    return `Pass_${trimmed}_2026!`;
  };

  const handleApprove = async (req: SignupRequest) => {
    const cleanEmail = req.email.trim().toLowerCase();
    const initialPass = ensureCompliantPassword(req.password || '123456');
    const payload = {
      email: cleanEmail,
      password: initialPass,
      full_name: req.full_name,
      role: req.role,
      company_id: req.company_id,
      region_id: req.region_id || null,
      station_id: req.station_id || null,
      permissions: CustodyDB.enrichUserPermissions(req.role),
      must_change_password: true
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await auth.currentUser?.getIdToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`⚠️ ${data.message || (isRtl ? 'فشل قبول وتفعيل الحساب' : 'Failed to approve signup request')}`);
        return;
      }

      if (data.user) {
        const usersList = CustodyDB.getUsers();
        const existingIdx = usersList.findIndex(u => u.id === data.user.id);
        if (existingIdx >= 0) {
          usersList[existingIdx] = data.user;
        } else {
          usersList.push(data.user);
        }
        await CustodyDB.saveUsers(usersList);
      }
      await CustodyDB.deleteSignupRequest(req.id);
      CustodyDB.logAudit('APPROVE_SIGNUP_REQUEST', `Approved signup for ${req.full_name} (${req.email}) as ${req.role}`);

      alert(isRtl ? 'تم قبول طلب التسجيل وتفعيل الحساب بنجاح!' : 'Signup request approved successfully!');
      setActiveSubTab('account');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('custody_db_updated'));
      }
    } catch (err: any) {
      alert(isRtl ? `⚠️ خطأ في الاتصال بالخادم: ${err.message}` : `⚠️ Server connection error: ${err.message}`);
    }
  };

  const handleReject = async (req: SignupRequest) => {
    if (!rejectionReason.trim()) {
      alert(isRtl ? 'يرجى كتابة سبب الرفض' : 'Please provide a rejection reason.');
      return;
    }

    const updated = {
      ...req,
      status: 'Rejected' as const,
      rejection_reason: rejectionReason.trim()
    };
    await CustodyDB.saveSignupRequest(updated);
    CustodyDB.logAudit('REJECT_SIGNUP_REQUEST', `Rejected signup for ${req.full_name} (${req.email}). Reason: ${rejectionReason}`);

    alert(isRtl ? 'تم رفض طلب التسجيل بنجاح' : 'Signup request rejected successfully.');
    setRejectingRequestId(null);
    setRejectionReason('');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  };

  const handleApproveCorrection = async (req: AccountCorrectionRequest) => {
    setCorrectionError('');

    const users = CustodyDB.getUsers();
    const targetUser = users.find(u =>
      (req.targetUserId && u.id === req.targetUserId) ||
      (u.email && u.email.toLowerCase().trim() === req.targetEmail.toLowerCase().trim())
    );

    if (targetUser) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = await auth.currentUser?.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const patchPayload: Record<string, any> = {};
        if (correctionNewEmail.trim()) patchPayload.email = correctionNewEmail.trim().toLowerCase();
        if (correctionNewName.trim()) patchPayload.full_name = correctionNewName.trim();
        if (correctionNewPassword.trim()) patchPayload.password = ensureCompliantPassword(correctionNewPassword);

        if (Object.keys(patchPayload).length > 0) {
          const res = await fetch(`/api/admin/users/${targetUser.id}`, {
            method: 'PATCH',
            headers,
            credentials: 'include',
            body: JSON.stringify(patchPayload)
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            setCorrectionError(data.message || (isRtl ? 'فشل تحديث حساب المستخدم على الخادم' : 'Failed to update user account on server'));
            return;
          }
        }
      } catch (err: any) {
        setCorrectionError(err.message || 'Server error');
        return;
      }
    }

    const res = await CustodyDB.approveAccountCorrectionRequest(req.id, {
      newEmail: correctionNewEmail.trim() || undefined,
      newFullName: correctionNewName.trim() || undefined,
      newPasswordPlain: correctionNewPassword.trim() || undefined,
      approvedBy: activeUser?.email || 'Admin'
    });

    if (!res.success) {
      setCorrectionError(isRtl ? res.messageAr : res.messageEn);
      return;
    }

    alert(isRtl ? res.messageAr : res.messageEn);
    setApprovingCorrectionId(null);
    setCorrectionNewEmail('');
    setCorrectionNewName('');
    setCorrectionNewPassword('');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  };

  const handleRejectCorrection = async (req: AccountCorrectionRequest) => {
    if (!correctionRejectReason.trim()) {
      alert(isRtl ? 'يرجى كتابة سبب الرفض' : 'Please provide a rejection reason.');
      return;
    }

    const res = await CustodyDB.rejectAccountCorrectionRequest(
      req.id,
      correctionRejectReason.trim(),
      activeUser?.email || 'Admin'
    );

    alert(isRtl ? res.messageAr : res.messageEn);
    setRejectingCorrectionId(null);
    setCorrectionRejectReason('');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
    }
  };

  const renderSubTabButtons = () => {
    if (!canSeePendingRequests) return null;
    return (
      <div className="flex gap-2.5 border-b border-slate-100 dark:border-slate-800/60 pb-1.5 text-[11px] mb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('account')}
          className={`font-bold pb-1 px-0.5 transition-all cursor-pointer ${
            activeSubTab === 'account'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-black'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {isRtl ? 'الحسابات (Accounts)' : 'Accounts'}
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => setActiveSubTab('requests')}
          className={`font-bold pb-1 px-0.5 flex items-center gap-1 transition-all cursor-pointer ${
            activeSubTab === 'requests'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-black'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>{isRtl ? 'الطلبات المعلقة' : 'Pending Requests'}</span>
          {pendingRequests.length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full font-mono">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => setActiveSubTab('corrections')}
          className={`font-bold pb-1 px-0.5 flex items-center gap-1 transition-all cursor-pointer ${
            activeSubTab === 'corrections'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-black'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>{isRtl ? 'طلبات تعديل الحسابات' : 'Account Corrections'}</span>
          {pendingCorrections.length > 0 && (
            <span className="bg-blue-500 text-white text-[9px] px-1 rounded-full font-mono">
              {pendingCorrections.length}
            </span>
          )}
        </button>
      </div>
    );
  };

  if (canSeePendingRequests && activeSubTab === 'requests') {
    return (
      <div className="space-y-3 mt-2 border-t border-slate-100 dark:border-slate-850 pt-3">
        {/* Switcher tabs */}
        <div className="flex gap-2.5 border-b border-slate-100 dark:border-slate-800/60 pb-1.5 text-[11px] mb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('account')}
            className="font-bold text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            {isRtl ? 'الحسابات (Accounts)' : 'Accounts'}
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => setActiveSubTab('requests')}
            className="font-black text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 pb-1 px-0.5 flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>{isRtl ? 'الطلبات المعلقة' : 'Pending Requests'}</span>
            {pendingRequests.length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full font-mono">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center p-4 text-[10px] text-slate-400 italic">
            {isRtl ? 'لا توجد طلبات تسجيل معلقة حالياً تحت هذا العنصر الهيكلي.' : 'No pending signup requests for this item.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingRequests.map(req => (
              <div 
                key={req.id} 
                className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] space-y-1.5"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{req.full_name}</div>
                    <div className="font-mono text-slate-400 text-[10px]">{req.email}</div>
                  </div>
                  <span className="bg-amber-500/10 text-amber-500 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                    {isRtl ? 'قيد الانتظار' : 'Pending'}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400">
                  <span>{isRtl ? 'تاريخ التقديم: ' : 'Submitted: '}</span>
                  <span className="font-mono">{new Date(req.created_at).toLocaleDateString()}</span>
                </div>

                {rejectingRequestId === req.id ? (
                  <div className="space-y-1.5 p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                    <input
                      type="text"
                      placeholder={isRtl ? 'اكتب سبب الرفض هنا...' : 'Enter rejection reason...'}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-2 py-1 text-[10px] rounded border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingRequestId(null);
                          setRejectionReason('');
                        }}
                        className="px-2 py-0.5 text-[9px] font-bold rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                      >
                        {isRtl ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(req)}
                        className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                      >
                        {isRtl ? 'تأكيد الرفض' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/40">
                    <button
                      type="button"
                      onClick={() => setRejectingRequestId(req.id)}
                      className="px-2.5 py-1 text-[9px] font-black rounded-lg text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer transition-all"
                    >
                      {isRtl ? 'رفض الطلب ✕' : 'Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(req)}
                      className="px-2.5 py-1 text-[9px] font-black rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer transition-all"
                    >
                      {isRtl ? 'موافقة وتفعيل ✓' : 'Approve & Activate'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (canSeePendingRequests && activeSubTab === 'corrections') {
    return (
      <div className="space-y-3 mt-2 border-t border-slate-100 dark:border-slate-850 pt-3">
        {renderSubTabButtons()}

        {pendingCorrections.length === 0 ? (
          <div className="text-center p-4 text-[10px] text-slate-400 italic">
            {isRtl ? 'لا توجد طلبات تعديل حسابات معلقة حالياً تحت هذا العنصر الهيكلي.' : 'No pending account correction requests for this item.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingCorrections.map(req => (
              <div 
                key={req.id} 
                className="p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-[11px] space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{req.targetUserName}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                        {req.correctionType === 'password_reset'
                          ? (isRtl ? 'إعادة تعيين كلمة مرور' : 'Password Reset')
                          : req.correctionType === 'email_change'
                          ? (isRtl ? 'تعديل البريد' : 'Email Change')
                          : (isRtl ? 'تعديل بيانات الحساب' : 'Account Update')}
                      </span>
                    </div>
                    <div className="font-mono text-slate-400 text-[10px]">{req.targetEmail}</div>
                  </div>
                  <span className="bg-amber-500/10 text-amber-500 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                    {isRtl ? 'قيد المراجعة' : 'Pending'}
                  </span>
                </div>

                <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-400 mr-1">{isRtl ? 'سبب التعديل: ' : 'Reason: '}</span>
                  <span>{req.reason}</span>
                </div>

                <div className="text-[10px] text-slate-400 flex justify-between items-center">
                  <span>
                    {isRtl ? 'تاريخ التقديم: ' : 'Submitted: '}
                    <span className="font-mono">{new Date(req.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[9px]">
                    {isRtl ? '✓ لا يستهلك سقف الحسابات' : '✓ Headcount unaffected'}
                  </span>
                </div>

                {approvingCorrectionId === req.id ? (
                  <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 shadow-sm">
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      {isRtl ? 'تحديث بيانات الحساب واعتماد التعديل (دون إنشاء حساب جديد):' : 'Update account data and approve correction:'}
                    </div>

                    {correctionError && (
                      <div className="p-1.5 rounded bg-rose-500/10 text-rose-600 text-[10px]">
                        {correctionError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-0.5">{isRtl ? 'البريد الإلكتروني' : 'Email'}</label>
                        <input
                          type="email"
                          value={correctionNewEmail}
                          onChange={(e) => setCorrectionNewEmail(e.target.value)}
                          placeholder="user@company.com"
                          className="w-full px-2 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-0.5">{isRtl ? 'الاسم بالكامل' : 'Full Name'}</label>
                        <input
                          type="text"
                          value={correctionNewName}
                          onChange={(e) => setCorrectionNewName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full px-2 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">
                        {isRtl ? 'كلمة المرور الجديدة (اتركها فارغة إذا لم يطلب تعديلها)' : 'New Password (leave blank if not changing)'}
                      </label>
                      <input
                        type="text"
                        value={correctionNewPassword}
                        onChange={(e) => setCorrectionNewPassword(e.target.value)}
                        placeholder={isRtl ? 'أدخل كلمة مرور جديدة أو اتركها فارغة...' : 'Enter new password or leave blank...'}
                        className="w-full px-2 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                    </div>

                    <div className="flex gap-1.5 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setApprovingCorrectionId(null);
                          setCorrectionError('');
                        }}
                        className="px-2.5 py-1 text-[9px] font-bold rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                      >
                        {isRtl ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveCorrection(req)}
                        className="px-2.5 py-1 text-[9px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shadow"
                      >
                        {isRtl ? 'حفظ واعتماد التعديل ✓' : 'Approve & Save Changes ✓'}
                      </button>
                    </div>
                  </div>
                ) : rejectingCorrectionId === req.id ? (
                  <div className="space-y-1.5 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                    <input
                      type="text"
                      placeholder={isRtl ? 'اكتب سبب رفض التعديل هنا...' : 'Enter rejection reason...'}
                      value={correctionRejectReason}
                      onChange={(e) => setCorrectionRejectReason(e.target.value)}
                      className="w-full px-2 py-1 text-[10px] rounded border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingCorrectionId(null);
                          setCorrectionRejectReason('');
                        }}
                        className="px-2 py-0.5 text-[9px] font-bold rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                      >
                        {isRtl ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectCorrection(req)}
                        className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                      >
                        {isRtl ? 'تأكيد الرفض' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/40">
                    <button
                      type="button"
                      onClick={() => setRejectingCorrectionId(req.id)}
                      className="px-2.5 py-1 text-[9px] font-black rounded-lg text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer transition-all"
                    >
                      {isRtl ? 'رفض الطلب ✕' : 'Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApprovingCorrectionId(req.id);
                        setCorrectionNewEmail(req.targetEmail);
                        setCorrectionNewName(req.targetUserName);
                        setCorrectionNewPassword('');
                        setCorrectionError('');
                      }}
                      className="px-2.5 py-1 text-[9px] font-black rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer transition-all"
                    >
                      {isRtl ? 'اعتماد التعديل ✓' : 'Approve & Update'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!isEditing && initialEmail) {
    const activePermsList = PERMISSION_KEYS.filter(p => permissions[p.key as keyof UserPermissions]);
    return (
      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
        {/* Switcher tabs */}
        {renderSubTabButtons()}

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="font-mono text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-400 mr-1">{isRtl ? 'الايميل:' : 'Email:'}</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all">{initialEmail}</span>
            <span className="font-bold text-slate-400 mx-2">|</span>
            <span className="font-bold text-slate-400 mr-1">{isRtl ? 'الرمز:' : 'PIN:'}</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all font-bold">{initialPassword}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[10px] cursor-pointer"
          >
            {isRtl ? 'تعديل الحساب والصلاحيات' : 'Edit Account & Permissions'}
          </button>
        </div>
        
        {/* Read-only styled Permissions Badges */}
        <div className="mt-1">
          <span className="text-[10px] font-bold text-slate-400 block mb-1">
            {isRtl ? 'الصلاحيات الممنوحة للمسؤول صاحب هذا الحساب:' : 'Granted Permissions for this manager account:'}
          </span>
          <div className="flex flex-wrap gap-1">
            {activePermsList.length === 0 ? (
              <span className="text-[9px] bg-slate-100 dark:bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded">
                {isRtl ? 'لا توجد صلاحيات نشطة' : 'No active permissions'}
              </span>
            ) : (
              activePermsList.map(p => (
                <span key={p.key} className="text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded-lg font-bold flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  {isRtl ? p.ar : p.en}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2 border-t border-slate-100 dark:border-slate-850 pt-3">
      {/* Switcher tabs */}
      {renderSubTabButtons()}

      <form onSubmit={handleSave} className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[120px]">
            <input
              type="email"
              required
              placeholder={placeholderEmail || (isRtl ? 'البريد الإلكتروني للأدمن' : 'Admin Email Address')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2 py-1 text-[11px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <input
              type="text"
              required
              placeholder={placeholderPassword || (isRtl ? 'كلمة المرور' : 'Password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-2 py-1 text-[11px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div className="flex gap-1">
            <button
              type="submit"
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition-all cursor-pointer"
            >
              {isRtl ? 'حفظ الحساب والصلاحيات' : 'Save'}
            </button>
            {initialEmail && (
              <button
                type="button"
                onClick={() => {
                  setEmail(initialEmail);
                  setPassword(initialPassword);
                  const u = CustodyDB.getUsers().find(user => user.email?.toLowerCase() === (initialEmail || '').toLowerCase());
                  if (u?.permissions) {
                    setPermissions({ ...u.permissions });
                  }
                  setIsEditing(false);
                }}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold transition-all cursor-pointer"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            )}
          </div>
        </div>

        {/* Interactive Permissions checklist */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
          <span className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
            {isRtl ? 'تخصيص وتعديل الصلاحيات الممنوحة للمسؤول:' : 'Customize Scoped Permissions:'}
          </span>

          {/* Toggle between Default and Custom */}
          <div className="flex bg-slate-150 dark:bg-slate-950/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleToggleMode(true)}
              className={`flex-1 py-1 rounded text-[9px] font-bold transition-all text-center cursor-pointer ${
                isDefaultMode 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {isRtl ? 'الافتراضية للدور (Default)' : 'Default for Role'}
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode(false)}
              className={`flex-1 py-1 rounded text-[9px] font-bold transition-all text-center cursor-pointer ${
                !isDefaultMode 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {isRtl ? 'تخصيص يدوي (Manual)' : 'Manual Customization'}
            </button>
          </div>

          <div className={`grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] ${isDefaultMode ? 'opacity-70' : ''}`}>
            {PERMISSION_KEYS.map((p) => (
              <label key={p.key} className={`flex items-center gap-1.5 text-slate-600 dark:text-slate-300 ${isDefaultMode ? 'cursor-not-allowed' : 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400'}`}>
                <input
                  type="checkbox"
                  disabled={isDefaultMode}
                  checked={!!permissions[p.key as keyof UserPermissions]}
                  onChange={(e) => setPermissions({
                    ...permissions,
                    [p.key]: e.target.checked
                  })}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold">{isRtl ? p.ar : p.en}</span>
              </label>
            ))}
          </div>

          {isDefaultMode && (
            <p className="text-[9px] text-slate-400 font-semibold italic text-center border-t border-slate-100 dark:border-slate-850 pt-1.5">
              {isRtl ? '💡 يتم تطبيق الصلاحيات الافتراضية القياسية لهذا الدور تلقائياً.' : '💡 Default standard permissions are locked to this role automatically.'}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
