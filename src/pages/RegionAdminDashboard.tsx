import React, { useState, useMemo, useEffect } from 'react';
import { CustodyDB } from '../db';
import { useScreenListeners } from '../firebase';
import { Company, AppUser, Language, Theme, Region, Station, UserPermissions, Transaction, TransactionStatus, ActivityLog, DeletedTransaction, SignupRequest } from '../types';
import { 
  Building2, ShieldCheck, KeyRound, UserCheck, RefreshCw, AlertTriangle, 
  Plus, Calendar, Sparkles, User, LogOut, ClipboardList, Info, Check, Search, ShieldAlert,
  Globe, Laptop, FileText, CheckCircle2, XCircle, Network, X, Settings, Trash2, Edit,
  PlusCircle, Building, Layers, Power, Activity, RotateCcw, Lock
} from 'lucide-react';

interface RegionAdminDashboardProps {
  activeUser: AppUser;
  language: Language;
  theme: Theme;
}

const PERMISSION_KEYS = [
  { key: 'create_expense', ar: 'إضافة وتسجيل المصروفات', en: 'Create & record expenses' },
  { key: 'delete_expense', ar: 'حذف المصروفات المسجلة', en: 'Delete recorded expenses' },
  { key: 'settle_voucher', ar: 'تسوية وإقفال المطالبات', en: 'Settle & close vouchers' },
  { key: 'replace_custody', ar: 'طلب استعاضة العهدة النقدية', en: 'Request replenishment' },
  { key: 'view_reports', ar: 'عرض وتصدير التقارير المالية', en: 'View financial reports' },
  { key: 'manage_settings', ar: 'إدارة الإعدادات والنسخ', en: 'Manage settings & backups' },
] as const;

function AdminCredentialsForm({ 
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
}: {
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
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [isEditing, setIsEditing] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'account' | 'requests'>('account');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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

  const handleApprove = async (req: SignupRequest) => {
    const usersList = CustodyDB.getUsers();
    const newUser: AppUser = {
      id: `user-approved-${req.role.toLowerCase()}-${Date.now()}`,
      email: req.email,
      full_name: req.full_name,
      role: req.role,
      company_id: req.company_id,
      region_id: req.region_id,
      station_id: req.station_id,
      is_active: true,
      password: req.password || '123456',
      salt: req.email.toLowerCase().trim(),
      permissions: CustodyDB.enrichUserPermissions(req.role)
    };

    await CustodyDB.saveUsers([...usersList, newUser]);
    await CustodyDB.deleteSignupRequest(req.id);
    CustodyDB.logAudit('APPROVE_SIGNUP_REQUEST', `Approved signup for ${req.full_name} (${req.email}) as ${req.role}`);

    alert(isRtl ? 'تم قبول طلب التسجيل وتفعيل الحساب بنجاح!' : 'Signup request approved successfully!');
    setActiveSubTab('account');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('custody_db_updated'));
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

  if (!isEditing && initialEmail) {
    const activePermsList = PERMISSION_KEYS.filter(p => permissions[p.key as keyof UserPermissions]);
    return (
      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
        {/* Switcher tabs */}
        {canSeePendingRequests && (
          <div className="flex gap-2.5 border-b border-slate-100 dark:border-slate-800/60 pb-1.5 text-[11px] mb-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('account')}
              className="font-black text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 pb-1 px-0.5 transition-all cursor-pointer"
            >
              {isRtl ? 'الحسابات (Accounts)' : 'Accounts'}
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setActiveSubTab('requests')}
              className="font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-all cursor-pointer"
            >
              <span>{isRtl ? 'الطلبات المعلقة' : 'Pending Requests'}</span>
              {pendingRequests.length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full font-mono">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        )}

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
      {canSeePendingRequests && (
        <div className="flex gap-2.5 border-b border-slate-100 dark:border-slate-800/60 pb-1.5 text-[11px] mb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('account')}
            className="font-black text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 pb-1 px-0.5 transition-all cursor-pointer"
          >
            {isRtl ? 'الحسابات (Accounts)' : 'Accounts'}
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => setActiveSubTab('requests')}
            className="font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>{isRtl ? 'الطلبات المعلقة' : 'Pending Requests'}</span>
            {pendingRequests.length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full font-mono">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      )}

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
              {isRtl ? 'حفظ' : 'Save'}
            </button>
            {initialEmail && (
              <button
                type="button"
                onClick={() => {
                  setEmail(initialEmail);
                  setPassword(initialPassword);
                  const u = CustodyDB.getUsers().find(user => user.email?.toLowerCase() === initialEmail.toLowerCase());
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
              {isRtl ? 'الافتراضية للدور' : 'Default for Role'}
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
              {isRtl ? 'صلاحيات مخصصة' : 'Custom Checklist'}
            </button>
          </div>

          {!isDefaultMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {PERMISSION_KEYS.map(p => {
                const checked = !!permissions[p.key as keyof UserPermissions];
                return (
                  <label key={p.key} className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/40 cursor-pointer text-[10px] font-bold text-slate-600 dark:text-slate-350">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setPermissions(prev => ({
                          ...prev,
                          [p.key]: e.target.checked
                        }));
                      }}
                      className="mt-0.5 h-3.5 w-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span>{isRtl ? p.ar : p.en}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export default function RegionAdminDashboard({ activeUser, language, theme }: RegionAdminDashboardProps) {
  useScreenListeners(['transactions', 'logs', 'Expenses', 'CashVouchers', 'deleted_transactions', 'signup_requests']);

  const isRtl = language === 'ar';
  const myCompanyId = activeUser.company_id || '';
  const myRegionId = activeUser.region_id || '';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'directory' | 'operations'>('directory');

  // Directory / Structure builder state
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [myRegion, setMyRegion] = useState<Region | null>(null);

  // Operations Ledger State
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const [allDeletedTransactions, setAllDeletedTransactions] = useState<DeletedTransaction[]>([]);

  // Filtering / Search States
  const [opStationFilter, setOpStationFilter] = useState<string>('all');
  const [opStatusFilter, setOpStatusFilter] = useState<string>('all');
  const [opSearchQuery, setOpSearchQuery] = useState<string>('');

  // Selected item for edit or delete
  const [editingOp, setEditingOp] = useState<any>(null);
  const [deletingOp, setDeletingOp] = useState<any>(null);
  const [opDeleteReason, setOpDeleteReason] = useState<string>('');

  // Modals visibility
  const [showOpEditModal, setShowOpEditModal] = useState(false);
  const [showOpDeleteModal, setShowOpDeleteModal] = useState(false);
  const [showStructStationModal, setShowStructStationModal] = useState(false);

  // Fields for Editing Transaction
  const [opEditAmount, setOpEditAmount] = useState<string>('');
  const [opEditDate, setOpEditDate] = useState<string>('');
  const [opEditDescription, setOpEditDescription] = useState<string>('');
  const [opEditStatus, setOpEditStatus] = useState<TransactionStatus>('Pending');
  const [opEditNotes, setOpEditNotes] = useState<string>('');

  // Fields for Editing Replenishment
  const [opEditReplenishAmount, setOpEditReplenishAmount] = useState<string>('');
  const [opEditReplenishNotes, setOpEditReplenishNotes] = useState<string>('');

  // Fields for Structure add/edit
  const [structEditingStation, setStructEditingStation] = useState<Station | null>(null);
  const [structStnName, setStructStnName] = useState<string>('');
  const [structStnCode, setStructStnCode] = useState<string>('');
  const [structStnCustody, setStructStnCustody] = useState<string>('');

  // Visual cues
  const [structToastMsg, setStructToastMsg] = useState<string>('');

  const showStructToast = (msg: string) => {
    setStructToastMsg(msg);
    setTimeout(() => setStructToastMsg(''), 4000);
  };

  const loadData = () => {
    // Fetch regions to find my region
    const rawRegions = CustodyDB.getRegions();
    setMyRegion(rawRegions.find(r => r.id === myRegionId) || null);

    // Filter stations inside my region
    const rawStations = CustodyDB.getStations();
    setStations(rawStations.filter(s => s.region_id === myRegionId && s.company_id === myCompanyId));

    // Filter users inside my region
    const rawUsers = CustodyDB.getUsers();
    setUsers(rawUsers.filter(u => u.region_id === myRegionId && u.company_id === myCompanyId));

    // Filter operations ledger scoped to my region
    const regionStations = rawStations.filter(s => s.region_id === myRegionId && s.company_id === myCompanyId);
    const filteredStationsIds = regionStations.map(s => s.id);
    const filteredStationsNames = regionStations.map(s => s.station_name);

    setAllTransactions(CustodyDB.getTransactions().filter(t => filteredStationsIds.includes(t.station_id)));
    setAllLogs(CustodyDB.getLogs().filter(l => l.station_id && filteredStationsIds.includes(l.station_id)));
    
    setAllDeletedTransactions(
      CustodyDB.getDeletedTransactions().filter(t => {
        const isCompany = t.company_id === myCompanyId;
        if (!isCompany) return false;

        const stId = t.transaction_data?.station_id;
        if (stId) {
          return filteredStationsIds.includes(stId);
        }

        if (t.station_name) {
          return filteredStationsNames.includes(t.station_name);
        }

        return false;
      })
    );
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('custody_db_updated', handleUpdate);
    return () => {
      window.removeEventListener('custody_db_updated', handleUpdate);
    };
  }, [myRegionId, myCompanyId]);

  // Parser for replenishment details
  const parseReplenishmentLog = (log: ActivityLog) => {
    let amount = log.amount || 0;
    let stationId = log.station_id || '';
    
    if (!amount || !stationId) {
      const matchAmount = log.details.match(/\+(\d+[\d,]*)/);
      if (matchAmount) {
        amount = parseFloat(matchAmount[1].replace(/,/g, ''));
      }
      
      const matchedStation = stations.find(s => log.details.includes(s.station_name));
      if (matchedStation) {
        stationId = matchedStation.id;
      }
    }
    
    return { amount, stationId };
  };

  // Directory manager for stations inside my region
  const handleSaveStationAdmin = async (stationId: string, email: string, pass: string, permissions?: UserPermissions) => {
    if (!email || !pass) return;
    const usersList = CustodyDB.getUsers();
    const existingAdmin = usersList.find(u => u.station_id === stationId && u.role === 'StationAdmin');
    
    if (existingAdmin) {
      const updatedUsers = usersList.map(u => {
        if (u.id === existingAdmin.id) {
          return {
            ...u,
            email: email.trim().toLowerCase(),
            password: pass.trim(),
            is_active: true,
            permissions: permissions ? { ...u.permissions, ...permissions } : u.permissions
          };
        }
        return u;
      });
      await CustodyDB.saveUsers(updatedUsers);
    } else {
      const newAdmin: AppUser = {
        id: `user-sa-${stationId}-${Date.now()}`,
        email: email.trim().toLowerCase(),
        full_name: isRtl ? `مسؤول فرع` : `Branch Manager`,
        role: 'StationAdmin',
        company_id: myCompanyId,
        region_id: myRegionId,
        station_id: stationId,
        is_active: true,
        password: pass.trim(),
        permissions: permissions || CustodyDB.enrichUserPermissions('StationAdmin')
      };
      await CustodyDB.saveUsers([...usersList, newAdmin]);
    }
    showStructToast(isRtl ? 'تم حفظ بيانات مدير الفرع بنجاح!' : 'Branch Admin credentials saved successfully!');
    loadData();
  };

  // Station Handlers inside my region
  const handleStructAddStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structStnName.trim() || !structStnCode.trim() || !structStnCustody) return;
    const val = parseFloat(structStnCustody);
    if (isNaN(val) || val <= 0) return;

    if (structEditingStation) {
      CustodyDB.updateStation(structEditingStation.id, {
        station_name: structStnName.trim(),
        station_code: structStnCode.toUpperCase().trim(),
        custody_amount: val,
        region_id: myRegionId
      });
      showStructToast(isRtl ? 'تم تحديث الفرع بنجاح' : 'Branch updated successfully');
      setStructEditingStation(null);
    } else {
      CustodyDB.addStation(structStnName.trim(), structStnCode.toUpperCase().trim(), val, myRegionId, myCompanyId);
      showStructToast(isRtl ? 'تم إضافة الفرع بنجاح' : 'Branch added successfully');
    }
    setStructStnName('');
    setStructStnCode('');
    setStructStnCustody('');
    setShowStructStationModal(false);
    loadData();
  };

  const handleStructDeleteStation = (id: string) => {
    if (confirm(isRtl ? 'هل تريد حذف هذا الفرع بالتأكيد؟' : 'Are you sure you want to delete this branch?')) {
      CustodyDB.deleteStation(id);
      showStructToast(isRtl ? 'تم حذف الفرع بنجاح' : 'Branch deleted successfully');
      loadData();
    }
  };

  // Compiled Operations Memo
  const compiledOperations = useMemo(() => {
    const txOps = allTransactions
      .filter(tx => tx.status !== 'Deleted')
      .map(tx => ({
        id: tx.id,
        refNo: tx.transaction_no,
        date: tx.date || tx.created_at,
        description: tx.description,
        amount: tx.amount,
        status: tx.status as any,
        type: 'transaction' as const,
        created_by: tx.created_by,
        notes: tx.notes || '',
        station_id: tx.station_id,
        company_id: tx.company_id,
        original: tx
      }));

    const legacyDeletedOps = allDeletedTransactions
      .map(del => ({
        id: del.id,
        refNo: del.transaction_no,
        date: del.deleted_at,
        description: del.description || del.transaction_data?.description || '',
        amount: del.amount,
        status: 'Deleted' as any,
        type: 'transaction' as const,
        created_by: del.created_by_name || del.transaction_data?.created_by || '',
        notes: del.delete_reason ? (language === 'ar' ? `سبب الحذف: ${del.delete_reason}` : `Reason: ${del.delete_reason}`) : '',
        station_id: del.transaction_data?.station_id || '',
        company_id: del.company_id || del.transaction_data?.company_id || myCompanyId,
        original: del.transaction_data || del
      }));

    const replenishmentOps = allLogs
      .filter(l => l.action === 'Custody Replenishment')
      .map(log => {
        const { amount, stationId } = parseReplenishmentLog(log);
        return {
          id: log.id,
          refNo: log.id.slice(0, 10),
          date: log.timestamp,
          description: log.details,
          amount: amount,
          status: 'Replenished' as const,
          type: 'replenishment' as const,
          created_by: log.user_name,
          notes: log.notes || '',
          station_id: stationId,
          company_id: myCompanyId,
          original: log
        };
      });

    return [...txOps, ...legacyDeletedOps, ...replenishmentOps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, allLogs, allDeletedTransactions, stations, language]);

  const filteredOperations = useMemo(() => {
    return compiledOperations.filter(op => {
      // 1. Station Filter inside region
      if (opStationFilter !== 'all' && op.station_id !== opStationFilter) return false;

      // 2. Status Filter
      if (opStatusFilter !== 'all') {
        if (opStatusFilter === 'Replenishment') {
          if (op.type !== 'replenishment') return false;
        } else {
          if (op.type === 'replenishment' || op.status !== opStatusFilter) return false;
        }
      }

      // 3. Instant Search Query
      if (opSearchQuery.trim()) {
        const query = opSearchQuery.toLowerCase();
        const desc = op.description.toLowerCase();
        const ref = op.refNo.toLowerCase();
        const notes = op.notes.toLowerCase();
        const cBy = op.created_by.toLowerCase();
        const amountStr = String(op.amount);
        return desc.includes(query) || ref.includes(query) || notes.includes(query) || cBy.includes(query) || amountStr.includes(query);
      }

      return true;
    });
  }, [compiledOperations, opStationFilter, opStatusFilter, opSearchQuery, stations]);

  // Handle Edit Operation
  const handleEditTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOp) return;
    const amountVal = parseFloat(opEditAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert(isRtl ? 'يرجى إدخال مبلغ صحيح وموجب' : 'Please enter a valid positive amount.');
      return;
    }

    const updates: Partial<Transaction> = {
      amount: amountVal,
      date: opEditDate,
      description: opEditDescription,
      status: opEditStatus,
      notes: opEditNotes
    };

    if (amountVal !== editingOp.amount) {
      const vouchers = CustodyDB.getCashVouchers();
      const associatedVoucher = vouchers.find(v => v.expense_ids && v.expense_ids.includes(editingOp.id));
      if (associatedVoucher) {
        const diff = amountVal - editingOp.amount;
        const newVoucherAmount = Math.max(0, associatedVoucher.amount + diff);
        CustodyDB.saveCashVoucher({
          ...associatedVoucher,
          amount: newVoucherAmount
        });
      }
    }

    const res = await CustodyDB.updateTransaction(editingOp.id, updates);
    if (!res.success) {
      alert(res.errors?.join(' \n ') || 'Failed to update transaction');
      return;
    }
    
    CustodyDB.addLog(
      activeUser.id,
      activeUser.full_name,
      'Transaction Updated By RegionManager',
      `RegionManager updated transaction ${editingOp.refNo}: amount ${editingOp.amount} -> ${amountVal}, status ${editingOp.status} -> ${opEditStatus}.`,
      editingOp.station_id,
      myCompanyId
    );

    showStructToast(isRtl ? 'تم تعديل الحركة بنجاح وتحديث الأثر المالي!' : 'Transaction updated successfully and financial impact applied!');
    setShowOpEditModal(false);
    setEditingOp(null);
    loadData();
  };

  const handleEditReplenishmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOp) return;
    const { amount: oldAmount, stationId } = parseReplenishmentLog(editingOp.original);
    const newAmount = parseFloat(opEditReplenishAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      alert(isRtl ? 'يرجى إدخال مبلغ صحيح وموجب' : 'Please enter a valid positive amount.');
      return;
    }

    if (!stationId) {
      alert(isRtl ? 'تعذر العثور على المحطة المقترنة بالعملية' : 'Could not locate the station associated with this replenishment.');
      return;
    }

    const station = stations.find(s => s.id === stationId);
    if (!station) {
      alert(isRtl ? 'المحطة غير موجودة' : 'Station not found.');
      return;
    }

    const diff = newAmount - oldAmount;
    const nextCustody = station.custody_amount + diff;

    CustodyDB.updateStation(stationId, {
      custody_amount: nextCustody
    });

    const detailsMsg = `Replenished custody balance of ${station.station_name} with +${newAmount.toLocaleString()} EGP (Total custody updated). Notes: ${opEditReplenishNotes || '-'}`;
    CustodyDB.updateReplenishmentLog(editingOp.id, newAmount, opEditReplenishNotes, detailsMsg);

    CustodyDB.addLog(
      activeUser.id,
      activeUser.full_name,
      'Replenishment Updated By RegionManager',
      `RegionManager updated replenishment for ${station.station_name}: amount ${oldAmount} -> ${newAmount}. Notes: ${opEditReplenishNotes || '-'}`,
      stationId,
      myCompanyId
    );

    showStructToast(isRtl ? 'تم تعديل مبلغ الاستعاضة وتحديث قيمة العهدة للمحطة بنجاح!' : 'Replenishment updated successfully and nominal custody adjusted!');
    setShowOpEditModal(false);
    setEditingOp(null);
    loadData();
  };

  const handleDeleteOpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingOp) return;
    if (!opDeleteReason.trim()) {
      alert(isRtl ? 'يرجى كتابة سبب الحذف' : 'Please provide a reason for deletion.');
      return;
    }

    if (deletingOp.type === 'transaction') {
      const success = await CustodyDB.deleteTransaction(deletingOp.id, opDeleteReason.trim());
      if (success) {
        CustodyDB.addLog(
          activeUser.id,
          activeUser.full_name,
          'Transaction Deleted By RegionManager',
          `RegionManager deleted transaction ${deletingOp.refNo} (${deletingOp.amount} EGP). Reason: ${opDeleteReason}`,
          deletingOp.station_id,
          myCompanyId
        );
        showStructToast(isRtl ? 'تم حذف الحركة بنجاح وتحديث الأثر المالي!' : 'Transaction deleted successfully and financial impact applied!');
      } else {
        alert(isRtl ? 'حدث خطأ أثناء الحذف' : 'An error occurred while deleting.');
      }
    } else {
      const { amount, stationId } = parseReplenishmentLog(deletingOp.original);
      if (!stationId) {
        alert(isRtl ? 'تعذر العثور على المحطة المقترنة بالعملية' : 'Could not locate the station associated with this replenishment.');
        return;
      }

      const station = stations.find(s => s.id === stationId);
      if (!station) {
        alert(isRtl ? 'المحطة غير موجودة' : 'Station not found.');
        return;
      }

      const nextCustody = Math.max(0, station.custody_amount - amount);
      CustodyDB.updateStation(stationId, {
        custody_amount: nextCustody
      });

      CustodyDB.deleteLog(deletingOp.id);

      CustodyDB.addLog(
        activeUser.id,
        activeUser.full_name,
        'Replenishment Deleted By RegionManager',
        `RegionManager deleted replenishment log ${deletingOp.id} for ${station.station_name} of amount ${amount} EGP. Reason: ${opDeleteReason}`,
        stationId,
        myCompanyId
      );
      showStructToast(isRtl ? 'تم حذف عملية الاستعاضة وإلغاء أثرها المالي من قيمة العهدة!' : 'Replenishment deleted successfully and nominal custody reverted!');
    }

    setShowOpDeleteModal(false);
    setDeletingOp(null);
    setOpDeleteReason('');
    loadData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {structToastMsg && (
        <div className="fixed bottom-5 right-5 z-[110] flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-fade-in text-xs font-bold">
          <Check size={16} />
          <span>{structToastMsg}</span>
        </div>
      )}

      {/* Regional Dashboard Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#111827] via-[#1e293b] to-[#111827] border border-indigo-500/10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-slate-500/5 rounded-full filter blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/20 border border-slate-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Layers size={12} />
              <span>{myRegion?.name || (isRtl ? 'منطقتي الجغرافية' : 'My Assigned Region')}</span>
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              {isRtl ? 'لوحة تحكم وإدارة المنطقة' : 'Regional Administration Dashboard'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isRtl 
                ? 'مرحباً بك في وحدة الإدارة الفرعية المخصصة لقطاعك الجغرافي. يمكنك إضافة ومتابعة محطات وفروع منطقتك، وإعداد حسابات مسؤولي العهدة وصلاحياتهم المخصصة، ومراجعة وتدقيق حركات الصرف والاستعاضة الداخلية.'
                : 'Welcome to your scoped regional management desk. Supervise and coordinate branch locations assigned to your sector, setup customized Station Admin login options, and audit internal spend workflows.'}
            </p>
          </div>
          <button 
            onClick={loadData}
            className="flex items-center justify-center gap-2 px-4.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg active:scale-95 cursor-pointer border border-indigo-500/30 w-full lg:w-auto"
          >
            <RefreshCw size={14} />
            <span>{isRtl ? 'تحديث البيانات' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 pb-2.5 gap-2">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Network size={16} />
          <span>{isRtl ? 'دليل وبناء فروع المنطقة' : 'Region Branches & Directory'}</span>
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          className={`px-4 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'operations'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Activity size={16} />
          <span>{isRtl ? 'إدارة العمليات الداخلية للمنطقة' : 'Region Operations Ledger'}</span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                {isRtl ? 'فروع ومحطات عهدة قطاع: ' : 'Active Custody Branches in: '} {myRegion?.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRtl 
                  ? 'يمكنك مراجعة المحطات التابعة لمنطقتك وإضافة محطات جديدة والتحكم بحسابات مسؤولي عهدها المباشرين.' 
                  : 'Review sub-stations assigned to your regional hub, add fresh branches, and customize Station Admin permissions.'}
              </p>
            </div>
            <button
              onClick={() => {
                setStructEditingStation(null);
                setStructStnName('');
                setStructStnCode('');
                setStructStnCustody('');
                setShowStructStationModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer self-start sm:self-auto"
            >
              <PlusCircle size={14} />
              <span>{isRtl ? 'إضافة فرع جديد للمنطقة' : 'Add Region Branch'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {stations.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                {isRtl ? 'لا توجد فروع مضافة لمنطقتك حتى الآن. يمكنك البدء بإضافة فرع جديد بالضغط على الزر أعلاه.' : 'No branches registered to your region yet. Click the button above to add your first branch.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stations.map(stn => {
                  const stnUser = users.find(u => u.station_id === stn.id && u.role === 'StationAdmin');
                  return (
                    <div 
                      key={stn.id}
                      className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 flex flex-col gap-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-850 pb-3">
                        <div>
                          <div className="font-bold text-sm md:text-base text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${stn.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{stn.station_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Code: <span className="font-bold">{stn.station_code}</span> | {isRtl ? 'العهدة الكلية:' : 'Custody Amount:'} <span className="font-bold text-indigo-600 dark:text-indigo-400">{CustodyDB.getStationDeductedCustody(stn.id).toLocaleString()} EGP</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setStructEditingStation(stn);
                              setStructStnName(stn.station_name);
                              setStructStnCode(stn.station_code);
                              setStructStnCustody(String(stn.custody_amount));
                              setShowStructStationModal(true);
                            }}
                            className="p-1.5 rounded hover:bg-indigo-50 dark:hover:bg-slate-850 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                            title={isRtl ? 'تعديل بيانات المحطة' : 'Edit branch metadata'}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleStructDeleteStation(stn.id)}
                            className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-slate-850 text-rose-500 cursor-pointer"
                            title={isRtl ? 'حذف المحطة' : 'Delete branch'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-450 dark:text-slate-550 mb-2 uppercase">
                          <KeyRound size={11} />
                          <span>{isRtl ? 'صلاحيات وحساب مسؤول الفرع' : 'Branch Manager Account & Permission Grid'}</span>
                        </div>
                        <AdminCredentialsForm
                          initialEmail={stnUser?.email || ''}
                          initialPassword={stnUser?.password || ''}
                          onSave={(email, pass, permissions) => handleSaveStationAdmin(stn.id, email, pass, permissions)}
                          isRtl={isRtl}
                          userRole="StationAdmin"
                          companyId={myCompanyId}
                          regionId={myRegionId}
                          stationId={stn.id}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="space-y-6 animate-fade-in">
          {/* Operations Overview banner */}
          <div className="p-4.5 rounded-2xl bg-slate-500/10 border border-slate-500/20 text-slate-800 dark:text-slate-300 flex items-start gap-3">
            <Activity size={20} className="text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">{isRtl ? 'مراجعة وتدقيق حركات وعمليات فروع منطقتك' : 'Region Scoped Financial Audit Ledger'}</h4>
              <p className="text-[11px] leading-relaxed">
                {isRtl 
                  ? 'شاشة تحكم الإدارة الفرعية لمراجعة وتدقيق كافة الحركات المالية للفروع التابعة لمنطقتك فقط. بصفتك مدير منطقة، يمكنك تعديل أو حذف أي مصروف، أو مراجعة استعاضة العهد النقدية للمحطات وإصلاح الأخطاء الإجرائية فوراً.'
                  : 'Sector control desk to audit and modify any cash ledger activity or custody replenishment within your regional boundary. Adjusting or rolling back receipts will automatically recalculate branch metrics in real-time.'}
              </p>
            </div>
          </div>

          {/* Filtering Console */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Station Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'الفرع / المحطة' : 'Station'}</label>
                <select
                  value={opStationFilter}
                  onChange={(e) => setOpStationFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                >
                  <option value="all">{isRtl ? 'كل فروع منطقتي' : 'All Region Stations'}</option>
                  {stations.map(s => (
                    <option key={s.id} value={s.id}>{s.station_name} ({s.station_code})</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'نوع وحالة الحركة' : 'Status'}</label>
                <select
                  value={opStatusFilter}
                  onChange={(e) => setOpStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                >
                  <option value="all">{isRtl ? 'كل الحركات' : 'All Operations'}</option>
                  <option value="Pending">{isRtl ? 'معلقة (Pending)' : 'Pending Expenses'}</option>
                  <option value="Under Settlement">{isRtl ? 'تحت التسوية (Under Settlement)' : 'Under Settlement'}</option>
                  <option value="Settled">{isRtl ? 'تمت تسويتها (Settled)' : 'Fully Settled'}</option>
                  <option value="Replenishment">{isRtl ? 'استعاضة عهدة (Replenishment)' : 'Custody Replenishments'}</option>
                  <option value="Deleted">{isRtl ? 'محذوفة (Deleted)' : 'Deleted Operations'}</option>
                </select>
              </div>

              {/* Instant Search */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'البحث السريع' : 'Search'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder={isRtl ? 'ابحث بالبيان، رقم القيد...' : 'Search details, amount, ref...'}
                    value={opSearchQuery}
                    onChange={(e) => setOpSearchQuery(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Master Operations Ledger */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[900px] border-collapse text-xs text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold p-3">
                    <th className="p-3 text-start">{isRtl ? 'رقم الحركة' : 'Ref No'}</th>
                    <th className="p-3 text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 text-start">{isRtl ? 'الفرع' : 'Branch Location'}</th>
                    <th className="p-3 text-start">{isRtl ? 'بيان وتفاصيل العملية' : 'Details & Description'}</th>
                    <th className="p-3 text-start">{isRtl ? 'المبلغ' : 'Amount'}</th>
                    <th className="p-3 text-center">{isRtl ? 'حالة الحركة' : 'Status'}</th>
                    <th className="p-3 text-start">{isRtl ? 'بواسطة' : 'Created By'}</th>
                    <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {filteredOperations.map(op => {
                    const st = stations.find(s => s.id === op.station_id);
                    
                    return (
                      <tr key={op.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all">
                        <td className="p-3 font-mono font-bold text-slate-500 text-start">{op.refNo}</td>
                        <td className="p-3 text-slate-500 whitespace-nowrap text-start">
                          {new Date(op.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="p-3 text-start">
                          <div className="font-bold text-slate-900 dark:text-white">{st ? st.station_name : (isRtl ? 'غير مصنف' : 'Direct Link')}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{st?.station_code}</div>
                        </td>
                        <td className="p-3 text-start max-w-xs truncate">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{op.description}</div>
                          {op.notes && <div className="text-[10px] text-slate-400 font-mono italic">{op.notes}</div>}
                        </td>
                        <td className="p-3 font-mono font-bold text-start text-sm text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {op.amount.toLocaleString()} EGP
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {op.type === 'replenishment' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center gap-1 w-max mx-auto border border-cyan-500/20">
                              <RefreshCw size={11} className="animate-spin-slow animate-spin shrink-0" />
                              <span>{isRtl ? 'استعاضة عهدة' : 'Replenished'}</span>
                            </span>
                          ) : op.status === 'Pending' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1 w-max mx-auto border border-amber-500/20">
                              <span>●</span>
                              <span>{isRtl ? 'معلقة' : 'Pending'}</span>
                            </span>
                          ) : op.status === 'Under Settlement' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1 w-max mx-auto border border-indigo-500/20">
                              <span>●</span>
                              <span>{isRtl ? 'تحت التسوية' : 'Under Settlement'}</span>
                            </span>
                          ) : op.status === 'Settled' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 w-max mx-auto border border-emerald-500/20">
                              <CheckCircle2 size={11} className="shrink-0" />
                              <span>{isRtl ? 'مسواة نهائياً' : 'Fully Settled'}</span>
                            </span>
                          ) : op.status === 'Deleted' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1 w-max mx-auto border border-rose-500/20">
                              <span>●</span>
                              <span>{isRtl ? 'محذوفة' : 'Deleted'}</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 flex items-center justify-center gap-1 w-max mx-auto border border-slate-500/20">
                              <span>{op.status}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 whitespace-nowrap text-start">
                          <div className="font-semibold">{op.created_by}</div>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {op.status === 'Settled' ? (
                            <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800/40 px-2 py-1 rounded-md w-max mx-auto">
                              <Lock size={12} className="text-slate-400 shrink-0" />
                              <span>{isRtl ? 'حركة مغلقة' : 'Locked'}</span>
                            </span>
                          ) : op.status !== 'Deleted' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingOp(op);
                                  if (op.type === 'transaction') {
                                    setOpEditAmount(op.amount.toString());
                                    setOpEditDate(op.date);
                                    setOpEditDescription(op.description);
                                    setOpEditStatus(op.status);
                                    setOpEditNotes(op.notes);
                                  } else {
                                    setOpEditReplenishAmount(op.amount.toString());
                                    setOpEditReplenishNotes(op.notes);
                                  }
                                  setShowOpEditModal(true);
                                }}
                                className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                                title={isRtl ? 'تعديل الحركة والأثر المالي' : 'Edit transaction details'}
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingOp(op);
                                  setOpDeleteReason('');
                                  setShowOpDeleteModal(true);
                                }}
                                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-rose-500 transition-colors cursor-pointer"
                                title={isRtl ? 'حذف الحركة والتدقيق المالي' : 'Delete transaction and reverse ledger'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={async () => {
                                const success = await CustodyDB.restoreTransaction(op.id);
                                if (success) {
                                  showStructToast(isRtl ? 'تم استرجاع العملية بنجاح وإعادة تطبيق أثرها المالي!' : 'Transaction restored successfully and financial impact applied!');
                                  loadData();
                                } else {
                                  showStructToast(isRtl ? 'فشل استرجاع العملية.' : 'Failed to restore transaction.');
                                }
                              }}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 mx-auto border border-emerald-500/20 text-xs font-bold"
                              title={isRtl ? 'استرجاع الحركة والأثر المالي' : 'Restore transaction and financial impact'}
                            >
                              <RotateCcw size={12} />
                              <span>{isRtl ? 'استرجاع' : 'Restore'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredOperations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <Activity size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-700 animate-pulse" />
                        <div className="font-bold">{isRtl ? 'لم يتم العثور على أي عمليات مطابقة للفلاتر.' : 'No operations matching active filters.'}</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Add/Edit Station Modal */}
      {showStructStationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setShowStructStationModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-white mb-4">
              {structEditingStation 
                ? (isRtl ? 'تعديل بيانات المحطة/الفرع' : 'Edit Branch') 
                : (isRtl ? 'إضافة فرع أو محطة عهدة جديدة' : 'Add New Branch')}
            </h3>
            <form onSubmit={handleStructAddStation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'اسم الفرع/المحطة' : 'Branch Name'}</label>
                <input
                  type="text"
                  required
                  placeholder={isRtl ? 'مثال: محطة أكتوبر 1، فرع الدقي...' : 'e.g. October Station 1, Dokki Branch...'}
                  value={structStnName}
                  onChange={(e) => setStructStnName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'كود مركز الكلفة' : 'Cost Center Code'}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OCT-01"
                    value={structStnCode}
                    onChange={(e) => setStructStnCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'مبلغ العهدة الكلي' : 'Nominal Custody (EGP)'}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50000"
                    value={structStnCustody}
                    onChange={(e) => setStructStnCustody(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'القطاع الجغرافي' : 'Region'}</label>
                <input
                  type="text"
                  disabled
                  value={myRegion?.name || ''}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs dark:bg-slate-900 bg-slate-100 text-slate-400 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStructStationModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'حفظ البيانات' : 'Save Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Operations Edit Modal */}
      {showOpEditModal && editingOp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => {
                setShowOpEditModal(false);
                setEditingOp(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-white mb-4">
              {editingOp.type === 'transaction' 
                ? (isRtl ? `تعديل الحركة المالية: ${editingOp.refNo}` : `Edit Operation: ${editingOp.refNo}`)
                : (isRtl ? `تعديل استعاضة العهدة: ${editingOp.refNo}` : `Edit Replenishment: ${editingOp.refNo}`)}
            </h3>

            {editingOp.type === 'transaction' ? (
              <form onSubmit={handleEditTransactionSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'المبلغ' : 'Amount (EGP)'}</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={opEditAmount}
                      onChange={(e) => setOpEditAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'التاريخ' : 'Date'}</label>
                    <input
                      type="date"
                      required
                      value={opEditDate.split('T')[0]}
                      onChange={(e) => setOpEditDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'البيان وتفاصيل العملية' : 'Description'}</label>
                  <input
                    type="text"
                    required
                    value={opEditDescription}
                    onChange={(e) => setOpEditDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'حالة الحركة' : 'Status'}</label>
                    <select
                      value={opEditStatus}
                      onChange={(e) => setOpEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                    >
                      <option value="Pending">{isRtl ? 'معلقة (Pending)' : 'Pending'}</option>
                      <option value="Under Settlement">{isRtl ? 'تحت التسوية (Under Settlement)' : 'Under Settlement'}</option>
                      <option value="Settled">{isRtl ? 'مسواة نهائياً (Settled)' : 'Fully Settled'}</option>
                      <option value="Rejected">{isRtl ? 'مرفوضة نهائياً (Rejected)' : 'Permanently Rejected'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'رقم الكود / ملاحظات' : 'Voucher/Notes'}</label>
                    <input
                      type="text"
                      value={opEditNotes}
                      onChange={(e) => setOpEditNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOpEditModal(false);
                      setEditingOp(null);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                  >
                    {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEditReplenishmentSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'مبلغ الاستعاضة العهدية الجديد' : 'New Replenishment Amount (EGP)'}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={opEditReplenishAmount}
                    onChange={(e) => setOpEditReplenishAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'ملاحظات وتفاصيل' : 'Notes/Details'}</label>
                  <input
                    type="text"
                    value={opEditReplenishNotes}
                    onChange={(e) => setOpEditReplenishNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOpEditModal(false);
                      setEditingOp(null);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                  >
                    {isRtl ? 'تحديث مبلغ الاستعاضة' : 'Save Replenishment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. Operations Delete Modal */}
      {showOpDeleteModal && deletingOp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-rose-500/20 dark:border-rose-950/20 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => {
                setShowOpDeleteModal(false);
                setDeletingOp(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle size={24} className="shrink-0 animate-bounce-subtle" />
              <h3 className="text-sm md:text-base font-bold">{isRtl ? 'حذف وتراجع مالي عكسي' : 'Destructive Rollback Action'}</h3>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {isRtl 
                ? `أنت على وشك حذف الحركة المالية المعرفة بالرمز (${deletingOp.refNo}) وقيمتها (${deletingOp.amount.toLocaleString()} EGP). سيقوم النظام بعكس الأثر المالي وتعديل العهد النقدية للفرع تلقائياً. هذه العملية نهائية وتتطلب تبريراً رقابياً.` 
                : `You are permanently deleting transaction ${deletingOp.refNo} of amount ${deletingOp.amount.toLocaleString()} EGP. This rollback will automatically reverse corresponding branch balances. Deletion reason is required for security auditing.`}
            </p>

            <form onSubmit={handleDeleteOpSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1">{isRtl ? 'سبب الإلغاء والحذف الرقابي' : 'Audit Deletion Reason'}</label>
                <input
                  type="text"
                  required
                  placeholder={isRtl ? 'مثال: إدخال مكرر، خطأ في الفاتورة المرفقة...' : 'e.g. Duplicate entry, receipt scan failure...'}
                  value={opDeleteReason}
                  onChange={(e) => setOpDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-950 text-xs focus:ring-2 focus:ring-rose-500/20 dark:bg-slate-950 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpDeleteModal(false);
                    setDeletingOp(null);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  {isRtl ? 'تأكيد الحذف النهائي' : 'Confirm Rollback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
