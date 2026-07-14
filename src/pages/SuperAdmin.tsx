import React, { useState, useMemo, useEffect } from 'react';
import { CustodyDB, ModulesModule, ERP_MODULES_REGISTRY, CompanyModuleSettings } from '../db';
import { Company, AppUser, Language, Theme, AuditLog, Region, Station, UserPermissions, Transaction, TransactionStatus, ActivityLog, DeletedTransaction, SignupRequest } from '../types';
import { 
  Building2, ShieldCheck, KeyRound, UserCheck, RefreshCw, AlertTriangle, 
  Plus, Calendar, Sparkles, User, LogOut, ClipboardList, Info, Check, Search, ShieldAlert,
  Globe, Laptop, FileText, CheckCircle2, XCircle, Network, X, Settings, Trash2, Edit,
  PlusCircle, Building, Layers, Power, Activity, RotateCcw
} from 'lucide-react';
import AdminCredentialsForm from '../components/AdminCredentialsForm';

interface SuperAdminProps {
  language: Language;
  theme: Theme;
}


export default function SuperAdmin({ language, theme }: SuperAdminProps) {
  const isRtl = language === 'ar';
  
  // State
  const [companies, setCompanies] = useState<Company[]>(() => CustodyDB.getCompanies());
  const [users, setUsers] = useState<AppUser[]>(() => CustodyDB.getUsers());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => CustodyDB.getAuditLogs());
  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'operations' | 'impersonate' | 'audit'>('companies');

  // Operations Management Tab State
  const [allTransactions, setAllTransactions] = useState<Transaction[]>(() => CustodyDB.getTransactions());
  const [allLogs, setAllLogs] = useState<ActivityLog[]>(() => CustodyDB.getLogs());
  const [allDeletedTransactions, setAllDeletedTransactions] = useState<DeletedTransaction[]>(() => CustodyDB.getDeletedTransactions());

  const [opCompanyFilter, setOpCompanyFilter] = useState<string>('all');
  const [opRegionFilter, setOpRegionFilter] = useState<string>('all');
  const [opStationFilter, setOpStationFilter] = useState<string>('all');
  const [opStatusFilter, setOpStatusFilter] = useState<string>('all');
  const [opSearchQuery, setOpSearchQuery] = useState<string>('');
  
  // Selected item for edit or delete
  const [editingOp, setEditingOp] = useState<any>(null); // Transaction or ActivityLog (replenishment)
  const [deletingOp, setDeletingOp] = useState<any>(null);
  const [opDeleteReason, setOpDeleteReason] = useState<string>('');
  
  // Modal visibility
  const [showOpEditModal, setShowOpEditModal] = useState(false);
  const [showOpDeleteModal, setShowOpDeleteModal] = useState(false);
  
  // Fields for Editing Transaction
  const [opEditAmount, setOpEditAmount] = useState<string>('');
  const [opEditDate, setOpEditDate] = useState<string>('');
  const [opEditDescription, setOpEditDescription] = useState<string>('');
  const [opEditStatus, setOpEditStatus] = useState<TransactionStatus>('Pending');
  const [opEditNotes, setOpEditNotes] = useState<string>('');

  // Fields for Editing Replenishment
  const [opEditReplenishAmount, setOpEditReplenishAmount] = useState<string>('');
  const [opEditReplenishNotes, setOpEditReplenishNotes] = useState<string>('');

  const handleRefreshData = () => {
    setCompanies(CustodyDB.getCompanies());
    setUsers(CustodyDB.getUsers());
    setAuditLogs(CustodyDB.getAuditLogs());
    setRegions(CustodyDB.getRegions());
    setStations(CustodyDB.getStations());
    setAllTransactions(CustodyDB.getTransactions());
    setAllLogs(CustodyDB.getLogs());
    setAllDeletedTransactions(CustodyDB.getDeletedTransactions());
  };

  const refreshOperationsData = () => {
    handleRefreshData();
  };

  useEffect(() => {
    handleRefreshData();
    const handleUpdate = () => handleRefreshData();
    window.addEventListener('custody_db_updated', handleUpdate);
    return () => {
      window.removeEventListener('custody_db_updated', handleUpdate);
    };
  }, []);

  // Search/Filters state
  const [companySearch, setCompanySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [supportUserSearch, setSupportUserSearch] = useState('');
  
  // Create Company state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCustody, setNewCompanyCustody] = useState<number>(0);
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);

  // Edit Subscription state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [subPlan, setSubPlan] = useState<Company['subscription_plan']>('Basic');
  const [subStatus, setSubStatus] = useState<Company['subscription_status']>('active');
  const [subExpiry, setSubExpiry] = useState('');
  const [activeModalTab, setActiveModalTab] = useState<'subscription' | 'modules'>('subscription');
  const [companyModules, setCompanyModules] = useState<Record<string, any>>({});
  const [copySourceCompanyId, setCopySourceCompanyId] = useState<string>('');

  // Password reset state
  const [selectedUserForReset, setSelectedUserForReset] = useState<AppUser | null>(null);
  const [newPlainPassword, setNewPlainPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  // Impersonation state
  const [impersonateReason, setImpersonateReason] = useState('');
  const [impersonateTargetUserId, setImpersonateTargetUserId] = useState('');
  const [impersonateError, setImpersonateError] = useState('');

  // States for Structure Builder inside SaaS Companies Sub-Tab
  const [isStructureOpen, setIsStructureOpen] = useState(true);
  const [structureView, setStructureView] = useState<'tree' | 'tables'>('tree');
  const [structureTab, setStructureTab] = useState<'companies' | 'regions' | 'stations'>('companies');
  
  const [regions, setRegions] = useState<Region[]>(() => CustodyDB.getRegions());
  const [stations, setStations] = useState<Station[]>(() => CustodyDB.getStations());
  const [structSelectedCompanyId, setStructSelectedCompanyId] = useState<string>(() => companies[0]?.id || '');
  const [structSelectedRegionId, setStructSelectedRegionId] = useState<string>('all');

  // Modals for structure builder
  const [showStructCompanyModal, setShowStructCompanyModal] = useState(false);
  const [showStructRegionModal, setShowStructRegionModal] = useState(false);
  const [showStructStationModal, setShowStructStationModal] = useState(false);

  // Form states
  const [structCompName, setStructCompName] = useState('');
  const [structEditingCompany, setStructEditingCompany] = useState<Company | null>(null);

  const [structRegName, setStructRegName] = useState('');
  const [structRegCompanyId, setStructRegCompanyId] = useState('');
  const [structEditingRegion, setStructEditingRegion] = useState<Region | null>(null);

  const [structStnName, setStructStnName] = useState('');
  const [structStnCode, setStructStnCode] = useState('');
  const [structStnCustody, setStructStnCustody] = useState('');
  const [structStnRegionId, setStructStnRegionId] = useState('');
  const [structEditingStation, setStructEditingStation] = useState<Station | null>(null);

  const [structToastMsg, setStructToastMsg] = useState('');
  const showStructToast = (msg: string) => {
    setStructToastMsg(msg);
    setTimeout(() => setStructToastMsg(''), 3000);
  };

  // Handlers for Company Structure Builder
  const handleStructAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structCompName.trim()) return;

    if (structEditingCompany) {
      CustodyDB.updateCompany(structEditingCompany.id, {
        name: structCompName.trim()
      });
      showStructToast(isRtl ? 'تم تحديث الشركة بنجاح' : 'Company updated successfully');
      setStructEditingCompany(null);
    } else {
      const created = CustodyDB.addCompany(structCompName.trim(), newCompanyCustody);
      CustodyDB.updateCompanySubscription(created.id, 'Basic', 'active', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      showStructToast(isRtl ? 'تم إضافة وتفعيل الشركة بنجاح' : 'Company added and activated successfully');
    }
    setStructCompName('');
    setNewCompanyCustody(0);
    setShowStructCompanyModal(false);
    handleRefreshData();
  };

  const startStructAddCompany = () => {
    setStructEditingCompany(null);
    setStructCompName('');
    setNewCompanyCustody(0);
    setShowStructCompanyModal(true);
  };

  const startStructEditCompany = (c: Company) => {
    setStructEditingCompany(c);
    setStructCompName(c.name);
    setShowStructCompanyModal(true);
  };

  const handleStructDeleteCompany = (id: string) => {
    const connectedRegions = regions.filter(r => r.company_id === id);
    const connectedStations = stations.filter(s => s.company_id === id);

    if (connectedRegions.length > 0 || connectedStations.length > 0) {
      alert(
        isRtl 
          ? `لا يمكن حذف هذه الشركة لوجود قطاعات (${connectedRegions.length}) أو فروع (${connectedStations.length}) تابعة لها. يرجى حذف الفروع أولاً.` 
          : `Cannot delete company. It contains ${connectedRegions.length} regions and ${connectedStations.length} stations. Please delete them first.`
      );
      return;
    }

    if (confirm(isRtl ? 'هل تريد حذف هذه الشركة وجميع بياناتها بالتأكيد؟' : 'Are you sure you want to delete this company?')) {
      CustodyDB.deleteCompany(id);
      showStructToast(isRtl ? 'تم حذف الشركة بنجاح' : 'Company deleted successfully');
      handleRefreshData();
    }
  };

  // Region Handlers
  const handleStructAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structRegName.trim() || !structRegCompanyId) return;

    if (structEditingRegion) {
      CustodyDB.updateRegion(structEditingRegion.id, {
        name: structRegName.trim(),
        company_id: structRegCompanyId
      });
      showStructToast(isRtl ? 'تم تحديث الإقليم بنجاح' : 'Region updated successfully');
      setStructEditingRegion(null);
    } else {
      CustodyDB.addRegion(structRegName.trim(), '', structRegCompanyId);
      showStructToast(isRtl ? 'تم إضافة الإقليم بنجاح' : 'Region added successfully');
    }
    setStructRegName('');
    setShowStructRegionModal(false);
    handleRefreshData();
  };

  const startStructAddRegionForCompany = (companyId: string) => {
    setStructEditingRegion(null);
    setStructRegName('');
    setStructRegCompanyId(companyId);
    setShowStructRegionModal(true);
  };

  const startStructEditRegion = (r: Region) => {
    setStructEditingRegion(r);
    setStructRegName(r.name);
    setStructRegCompanyId(r.company_id || structSelectedCompanyId);
    setShowStructRegionModal(true);
  };

  const handleStructDeleteRegion = (id: string) => {
    const connectedStations = stations.filter(s => s.region_id === id);
    if (connectedStations.length > 0) {
      alert(
        isRtl 
          ? `لا يمكن حذف هذا القطاع لوجود عدد (${connectedStations.length}) فروع تابعة له. يرجى نقل أو حذف الفروع أولاً.` 
          : `Cannot delete region. It contains ${connectedStations.length} branches. Please move or delete them first.`
      );
      return;
    }

    if (confirm(isRtl ? 'هل تريد حذف هذا الإقليم بالتأكيد؟' : 'Are you sure you want to delete this region?')) {
      CustodyDB.deleteRegion(id);
      showStructToast(isRtl ? 'تم حذف الإقليم بنجاح' : 'Region deleted successfully');
      handleRefreshData();
    }
  };

  // Station Handlers
  const handleStructAddStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structStnName.trim() || !structStnCode.trim() || !structStnCustody) return;
    const val = parseFloat(structStnCustody);
    if (isNaN(val) || val <= 0) return;

    const rId = structStnRegionId === 'none' || !structStnRegionId ? undefined : structStnRegionId;

    if (structEditingStation) {
      CustodyDB.updateStation(structEditingStation.id, {
        station_name: structStnName.trim(),
        station_code: structStnCode.toUpperCase().trim(),
        custody_amount: val,
        region_id: rId
      });
      showStructToast(isRtl ? 'تم تحديث المحطة بنجاح' : 'Station/Branch updated successfully');
      setStructEditingStation(null);
    } else {
      let targetCompanyId = structSelectedCompanyId;
      if (rId) {
        const reg = regions.find(r => r.id === rId);
        if (reg && reg.company_id) {
          targetCompanyId = reg.company_id;
        }
      }
      CustodyDB.addStation(structStnName.trim(), structStnCode.toUpperCase().trim(), val, rId, targetCompanyId);
      showStructToast(isRtl ? 'تم إضافة المحطة بنجاح' : 'Station/Branch added successfully');
    }
    setStructStnName('');
    setStructStnCode('');
    setStructStnCustody('');
    setStructStnRegionId('');
    setShowStructStationModal(false);
    handleRefreshData();
  };

  // Parser for old text logs or structured replenishment logs
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

  const handleEditTransactionSubmit = (e: React.FormEvent) => {
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

    CustodyDB.updateTransaction(editingOp.id, updates);
    
    CustodyDB.addLog(
      'super-admin',
      'System Admin',
      'Transaction Updated By SuperAdmin',
      `SuperAdmin updated transaction ${editingOp.refNo}: amount ${editingOp.amount} -> ${amountVal}, status ${editingOp.status} -> ${opEditStatus}.`
    );

    showStructToast(isRtl ? 'تم تعديل الحركة بنجاح وتحديث الأثر المالي!' : 'Transaction updated successfully and financial impact applied!');
    setShowOpEditModal(false);
    setEditingOp(null);
    refreshOperationsData();
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
      'super-admin',
      'System Admin',
      'Replenishment Updated By SuperAdmin',
      `SuperAdmin updated replenishment for ${station.station_name}: amount ${oldAmount} -> ${newAmount}. Notes: ${opEditReplenishNotes || '-'}`
    );

    showStructToast(isRtl ? 'تم تعديل مبلغ الاستعاضة وتحديث قيمة العهدة للمحطة بنجاح!' : 'Replenishment updated successfully and nominal custody adjusted!');
    setShowOpEditModal(false);
    setEditingOp(null);
    refreshOperationsData();
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
          'super-admin',
          'System Admin',
          'Transaction Deleted By SuperAdmin',
          `SuperAdmin deleted transaction ${deletingOp.refNo} (${deletingOp.amount} EGP). Reason: ${opDeleteReason}`
        );
        showStructToast(isRtl ? 'تم حذف الحركة بنجاح وتحديث الأثر المالي!' : 'Transaction deleted successfully and financial impact applied!');
      } else {
        alert(isRtl ? 'حدث خطأ أثناء الحذف' : 'An error occurred while deleting.');
      }
    } else {
      // Replenishment deletion
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
        'super-admin',
        'System Admin',
        'Replenishment Deleted By SuperAdmin',
        `SuperAdmin deleted replenishment log ${deletingOp.id} for ${station.station_name} of amount ${amount} EGP. Reason: ${opDeleteReason}`
      );
      showStructToast(isRtl ? 'تم حذف عملية الاستعاضة وإلغاء أثرها المالي من قيمة العهدة!' : 'Replenishment deleted successfully and nominal custody reverted!');
    }

    setShowOpDeleteModal(false);
    setDeletingOp(null);
    setOpDeleteReason('');
    refreshOperationsData();
  };

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
        company_id: del.company_id || del.transaction_data?.company_id || '',
        original: del.transaction_data || del
      }));

    const replenishmentOps = allLogs
      .filter(l => l.action === 'Custody Replenishment')
      .map(log => {
        const { amount, stationId } = parseReplenishmentLog(log);
        const st = stations.find(s => s.id === stationId);
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
          company_id: st?.company_id || log.company_id,
          original: log
        };
      });

    return [...txOps, ...legacyDeletedOps, ...replenishmentOps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, allLogs, allDeletedTransactions, stations, language]);

  const opFilteredRegions = useMemo(() => {
    if (opCompanyFilter === 'all') return regions;
    return regions.filter(r => r.company_id === opCompanyFilter);
  }, [regions, opCompanyFilter]);

  const opFilteredStations = useMemo(() => {
    let list = stations;
    if (opCompanyFilter !== 'all') {
      list = list.filter(s => s.company_id === opCompanyFilter);
    }
    if (opRegionFilter !== 'all') {
      list = list.filter(s => s.region_id === opRegionFilter);
    }
    return list;
  }, [stations, opCompanyFilter, opRegionFilter]);

  const filteredOperations = useMemo(() => {
    return compiledOperations.filter(op => {
      if (opCompanyFilter !== 'all' && op.company_id !== opCompanyFilter) return false;
      if (opRegionFilter !== 'all') {
        const st = stations.find(s => s.id === op.station_id);
        if (!st || st.region_id !== opRegionFilter) return false;
      }
      if (opStationFilter !== 'all' && op.station_id !== opStationFilter) return false;
      
      if (opStatusFilter !== 'all') {
        if (opStatusFilter === 'Replenishment' && op.type !== 'replenishment') return false;
        if (opStatusFilter !== 'Replenishment') {
          if (op.type !== 'transaction' || op.status !== opStatusFilter) return false;
        }
      }

      if (opSearchQuery.trim()) {
        const q = opSearchQuery.toLowerCase();
        const desc = (op.description || '').toLowerCase();
        const ref = (op.refNo || '').toLowerCase();
        const createdBy = (op.created_by || '').toLowerCase();
        const notes = (op.notes || '').toLowerCase();
        const amountStr = op.amount.toString();
        
        if (!desc.includes(q) && !ref.includes(q) && !createdBy.includes(q) && !notes.includes(q) && !amountStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [compiledOperations, opCompanyFilter, opRegionFilter, opStationFilter, opStatusFilter, opSearchQuery, stations]);

  const startStructAddStationForRegion = (regionId: string, companyId?: string) => {
    setStructEditingStation(null);
    setStructStnName('');
    setStructStnCode('');
    setStructStnCustody('');
    setStructStnRegionId(regionId);
    if (companyId) {
      setStructSelectedCompanyId(companyId);
    }
    setShowStructStationModal(true);
  };

  const startStructAddStationDirectForCompany = (companyId: string) => {
    setStructEditingStation(null);
    setStructStnName('');
    setStructStnCode('');
    setStructStnCustody('');
    setStructStnRegionId('none');
    setStructSelectedCompanyId(companyId);
    setShowStructStationModal(true);
  };

  const startStructEditStation = (s: Station) => {
    setStructEditingStation(s);
    setStructStnName(s.station_name);
    setStructStnCode(s.station_code);
    setStructStnCustody(String(s.custody_amount));
    setStructStnRegionId(s.region_id || 'none');
    setShowStructStationModal(true);
  };

  const handleStructDeleteStation = (id: string) => {
    if (confirm(isRtl ? 'هل تريد حذف هذا الفرع/المحطة بالتأكيد؟' : 'Are you sure you want to delete this station?')) {
      CustodyDB.deleteStation(id);
      showStructToast(isRtl ? 'تم حذف الفرع بنجاح' : 'Station deleted successfully');
      handleRefreshData();
    }
  };

  const handleSaveCompanyAdmin = (companyId: string, email: string, pass: string, permissions?: UserPermissions) => {
    if (!email || !pass) return;
    const usersList = CustodyDB.getUsers();
    const existingAdmin = usersList.find(u => u.company_id === companyId && u.role === 'Admin');
    
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
      CustodyDB.saveUsers(updatedUsers);
    } else {
      const newAdmin: AppUser = {
        id: `user-admin-${companyId}-${Date.now()}`,
        email: email.trim().toLowerCase(),
        full_name: isRtl ? `أدمن الشركة` : `Company Admin`,
        role: 'Admin',
        company_id: companyId,
        is_active: true,
        password: pass.trim(),
        permissions: permissions || CustodyDB.enrichUserPermissions('Admin')
      };
      CustodyDB.saveUsers([...usersList, newAdmin]);
    }
    showStructToast(isRtl ? 'تم حفظ بيانات أدمن الشركة بنجاح!' : 'Company Admin credentials saved successfully!');
    handleRefreshData();
  };

  const handleSaveRegionManager = (regionId: string, companyId: string, email: string, pass: string, permissions?: UserPermissions) => {
    if (!email || !pass) return;
    const usersList = CustodyDB.getUsers();
    const existingManager = usersList.find(u => u.region_id === regionId && u.role === 'RegionalManager');
    
    if (existingManager) {
      const updatedUsers = usersList.map(u => {
        if (u.id === existingManager.id) {
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
      CustodyDB.saveUsers(updatedUsers);
    } else {
      const newManager: AppUser = {
        id: `user-rm-${regionId}-${Date.now()}`,
        email: email.trim().toLowerCase(),
        full_name: isRtl ? `مدير قطاع` : `Regional Manager`,
        role: 'RegionalManager',
        company_id: companyId,
        region_id: regionId,
        is_active: true,
        password: pass.trim(),
        permissions: permissions || CustodyDB.enrichUserPermissions('RegionalManager')
      };
      CustodyDB.saveUsers([...usersList, newManager]);
    }
    showStructToast(isRtl ? 'تم حفظ بيانات مدير القطاع بنجاح!' : 'Regional Manager credentials saved successfully!');
    handleRefreshData();
  };

  const handleSaveStationAdmin = (stationId: string, regionId: string | undefined, companyId: string, email: string, pass: string, permissions?: UserPermissions) => {
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
      CustodyDB.saveUsers(updatedUsers);
    } else {
      const newAdmin: AppUser = {
        id: `user-sa-${stationId}-${Date.now()}`,
        email: email.trim().toLowerCase(),
        full_name: isRtl ? `مسؤول فرع` : `Branch Administrator`,
        role: 'StationAdmin',
        company_id: companyId,
        region_id: regionId,
        station_id: stationId,
        is_active: true,
        password: pass.trim(),
        permissions: permissions || CustodyDB.enrichUserPermissions('StationAdmin')
      };
      CustodyDB.saveUsers([...usersList, newAdmin]);
    }
    showStructToast(isRtl ? 'تم حفظ بيانات مسؤول الفرع بنجاح!' : 'Branch Admin credentials saved successfully!');
    handleRefreshData();
  };

  // 1. Create New Company
  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    
    const created = CustodyDB.addCompany(newCompanyName.trim(), newCompanyCustody);
    
    // Automatically set default subscription properties
    CustodyDB.updateCompanySubscription(created.id, 'Basic', 'active', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    setNewCompanyName('');
    setNewCompanyCustody(0);
    setShowCreateCompanyModal(false);
    handleRefreshData();
  };

  // 2. Toggle Activation Status
  const handleToggleCompanyActive = (companyId: string, currentStatus: boolean) => {
    CustodyDB.toggleCompanyStatus(companyId, !currentStatus);
    handleRefreshData();
  };

  // 3. Save Subscription Plan/Expiry
  const handleSaveSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    
    CustodyDB.updateCompanySubscription(editingCompany.id, subPlan, subStatus, subExpiry);
    ModulesModule.saveCompanyModules(editingCompany.id, companyModules);
    setEditingCompany(null);
    handleRefreshData();
  };

  // 4. Reset Password
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset || !newPlainPassword.trim()) return;
    
    if (newPlainPassword.length < 4) {
      alert(isRtl ? 'يجب ألا تقل كلمة المرور عن 4 أحرف.' : 'Password must be at least 4 characters.');
      return;
    }

    CustodyDB.resetUserPassword(selectedUserForReset.id, newPlainPassword);
    setResetSuccessMessage(isRtl ? `🎉 تم تعيين كلمة المرور بنجاح للمدير: ${selectedUserForReset.full_name}` : `🎉 Password successfully reset for: ${selectedUserForReset.full_name}`);
    setNewPlainPassword('');
    setTimeout(() => {
      setResetSuccessMessage('');
      setSelectedUserForReset(null);
    }, 3000);
    handleRefreshData();
  };

  // 5. Impersonate support login
  const handleStartImpersonation = (targetUser: AppUser) => {
    if (!targetUser) return;
    
    try {
      CustodyDB.impersonateUser(targetUser, impersonateReason.trim());
      // Refresh the page session
      window.location.reload();
    } catch (err: any) {
      setImpersonateError(err.message);
    }
  };

  // Filters
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => 
      c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
      c.id.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [companies, companySearch]);

  const companyAdmins = useMemo(() => {
    return users.filter(u => 
      u.role === 'Admin' && 
      (u.full_name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
    );
  }, [users, userSearch]);

  const supportUsersList = useMemo(() => {
    return users.filter(u => 
      u.role !== 'SystemAdmin' && (
        u.full_name.toLowerCase().includes(supportUserSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(supportUserSearch.toLowerCase()) ||
        (u.role || '').toLowerCase().includes(supportUserSearch.toLowerCase())
      )
    );
  }, [users, supportUserSearch]);

  const impersonationAuditLogs = useMemo(() => {
    return auditLogs.filter(log => 
      log.action_type === 'IMPERSONATION_START' || 
      log.action_type === 'IMPERSONATION_END'
    );
  }, [auditLogs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
      {/* SaaS Welcome Banner */}
      <div className="p-5 sm:p-8 rounded-3xl bg-gradient-to-r from-[#1e1b4b] via-[#311042] to-[#1e1b4b] border border-indigo-500/20 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-fuchsia-500/5 rounded-full filter blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={12} className="animate-pulse" />
              <span>{isRtl ? 'التحكم المركزي والأمان' : 'Centralized Security Hub'}</span>
            </span>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold tracking-tight">
              {isRtl ? 'لوحة تحكم المدير العام للمنصة (SaaS)' : 'SaaS Super Admin Control Center'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isRtl 
                ? 'مرحباً بك في وحدة الإدارة الشاملة لنظام SaaS. يمكنك التحكم بالاشتراكات وتفعيل وتعطيل الشركات المنضوية، والولوج الفوري للدعم الفني لمساعدة المستخدمين مع الرقابة والامتثال الكامل.'
                : 'Welcome to the complete multi-tenant SaaS management hub. Easily regulate subscriptions, toggle organization status, reset administrative passwords, and gain instant technical support access under secure audit rails.'}
            </p>
          </div>
          <button 
            onClick={handleRefreshData}
            className="flex items-center justify-center gap-2 px-4.5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg active:scale-95 cursor-pointer border border-indigo-500/30 w-full lg:w-auto"
          >
            <RefreshCw size={16} />
            <span>{isRtl ? 'تحديث البيانات' : 'Refresh Ledger'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('companies')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center lg:justify-start gap-2 transition-all cursor-pointer ${
            activeSubTab === 'companies'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 size={16} />
          <span>{isRtl ? 'دليل الشركات والاشتراكات' : 'Companies & Subscriptions'}</span>
        </button>
        <button
          onClick={() => setActiveSubTab('operations')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center lg:justify-start gap-2 transition-all cursor-pointer ${
            activeSubTab === 'operations'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Activity size={16} />
          <span>{isRtl ? 'إدارة العمليات الداخلية لكل الشركات' : 'Internal Operations Management'}</span>
        </button>
        <button
          onClick={() => setActiveSubTab('impersonate')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center lg:justify-start gap-2 transition-all cursor-pointer ${
            activeSubTab === 'impersonate'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck size={16} />
          <span>{isRtl ? 'بوابة الدعم والمحاكاة' : 'Support Impersonation Portal'}</span>
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center lg:justify-start gap-2 transition-all cursor-pointer ${
            activeSubTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <ClipboardList size={16} />
          <span>{isRtl ? 'سجل الرقابة للرؤساء' : 'Impersonation Audit Logs'}</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeSubTab === 'companies' && (
        <div className="space-y-6">
          {/* TOAST NOTIFICATION FOR STRUCTURE BUILDER */}
          {structToastMsg && (
            <div className="fixed bottom-5 right-5 z-[110] flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-fade-in text-xs font-bold">
              <Check size={16} />
              <span>{structToastMsg}</span>
            </div>
          )}

          {/* Header Actions */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder={isRtl ? 'بحث باسم الشركة أو المعرف...' : 'Search company name or ID...'}
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => setIsStructureOpen(!isStructureOpen)}
                className={`w-full md:w-auto px-5 py-2.5 border rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 ${
                  isStructureOpen 
                    ? 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-505' 
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200 border-slate-200'
                }`}
              >
                <Settings size={14} />
                <span>{isRtl ? 'إدارة الهيكل التنظيمي والمحطات' : 'Organization Structure Builder'}</span>
              </button>
            </div>
          </div>

          {/* ENTERPRISE ORGANIZATIONAL STRUCTURE BUILDER (Interactive Tree Chart / traditional table builder) */}
          {isStructureOpen && (
            <div className={`p-6 rounded-3xl border transition-all animate-fade-in ${
              theme === 'dark' ? 'bg-[#1e293b]/90 border-[#334155]' : 'bg-slate-50 border-slate-300'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b mb-6 border-slate-200 dark:border-slate-700 gap-3">
                <div className="flex items-center gap-2">
                  <Network className="text-indigo-600 animate-pulse" size={20} />
                  <div>
                    <h3 className="font-bold text-sm md:text-base text-slate-800 dark:text-slate-100">
                      {isRtl ? 'محرر الهيكل التنظيمي والعهد والشركات التابعة' : 'Enterprise Corporate Structure & Custody Builder'}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isRtl ? 'إضافة وتعديل وحذف الشركات، والقطاعات أو المناطق التابعة، ومحطات العهد التكليفية.' : 'Add, edit, and delete companies, regional sectors, and custody branch assets.'}
                    </p>
                  </div>
                </div>
                
                {/* Control Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* View Switcher Toggle */}
                  <div className="flex p-0.5 bg-slate-200/60 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setStructureView('tree')}
                      className={`px-3 py-1 rounded-md font-bold transition-all ${
                        structureView === 'tree' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-850'
                      }`}
                    >
                      🌳 {isRtl ? 'المخطط الشجري للمؤسسة' : 'Visual Hierarchy Tree'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStructureView('tables')}
                      className={`px-3 py-1 rounded-md font-bold transition-all ${
                        structureView === 'tables' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-850'
                      }`}
                    >
                      📋 {isRtl ? 'عرض الجداول والمدرجات' : 'Classic Tables List'}
                    </button>
                  </div>

                  {/* Close Button */}
                  <button 
                    onClick={() => setIsStructureOpen(false)}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={isRtl ? 'إغلاق المحرر' : 'Close Editor'}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* VIEW A: VISUAL HIERARCHY TREE */}
              {structureView === 'tree' && (
                <div className="space-y-8">
                  {/* Top Bar for Tree layout */}
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Sparkles size={14} className="text-amber-500 animate-pulse" />
                      <span>
                        {isRtl 
                          ? 'اضغط على أزرار الإضافة السريعة (+) على مستوى كل كارت لتربيط وفصل الهياكل بشكل مرن.' 
                          : 'Click the Quick Add (+) buttons on cards to automatically link regional sectors and custody branch assets.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={startStructAddCompany}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer"
                    >
                      <PlusCircle size={13} />
                      <span>{isRtl ? 'إضافة شركة جديدة للهيكل' : 'Create New Company'}</span>
                    </button>
                  </div>

                  {/* Company Tree Loops */}
                  <div className="space-y-10" dir={isRtl ? 'rtl' : 'ltr'}>
                    {filteredCompanies.map(comp => {
                      const compRegs = regions.filter(r => r.company_id === comp.id);
                      const compStns = stations.filter(s => s.company_id === comp.id);
                      const directStns = compStns.filter(s => !s.region_id);

                      return (
                        <div 
                          key={comp.id}
                          className="border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-5 bg-indigo-50/5 dark:bg-slate-900/20 shadow-sm relative overflow-hidden"
                        >
                          {/* Company Header node */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100 dark:border-slate-800/80 pb-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-md">
                                <Building2 size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-slate-900 dark:text-white text-base md:text-lg">
                                    {comp.name}
                                  </h4>
                                  <span className="text-[10px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold rounded-full">
                                    {isRtl ? 'الشركة الأم' : 'Parent Enterprise'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    comp.is_active !== false 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  }`}>
                                    <span className={`h-1 w-1 rounded-full ${comp.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <span>{comp.is_active !== false ? (isRtl ? 'مفعلة' : 'Active') : (isRtl ? 'معطلة' : 'Suspended')}</span>
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    comp.subscription_plan === 'Enterprise'
                                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                      : comp.subscription_plan === 'Professional'
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {comp.subscription_plan || 'Basic'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    {isRtl ? 'العهدة الكلية:' : 'Total Custody:'} <strong className="text-slate-700 dark:text-slate-200">{CustodyDB.getCompanyDeductedCustody(comp.id).toLocaleString()} EGP</strong>
                                  </span>
                                  {comp.subscription_expiry && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ({isRtl ? 'تنتهي:' : 'Expires:'} {comp.subscription_expiry})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Company Quick Actions */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startStructAddRegionForCompany(comp.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-slate-700 text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                title={isRtl ? 'إضافة قطاع/منطقة تحت هذه الشركة' : 'Add Sector under Company'}
                              >
                                <Globe size={13} className="text-indigo-500" />
                                <span>{isRtl ? 'إضافة قطاع/منطقة' : 'Add Sector'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startStructAddStationDirectForCompany(comp.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-slate-700 text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                title={isRtl ? 'إضافة فرع عهدة مباشر بدون قطاع' : 'Add Direct custody branch'}
                              >
                                <Building size={13} className="text-emerald-500" />
                                <span>{isRtl ? 'فرع مباشر' : 'Add Direct Branch'}</span>
                              </button>
                              
                              {/* Toggle active status */}
                              <button
                                type="button"
                                onClick={() => handleToggleCompanyActive(comp.id, comp.is_active !== false)}
                                className={`p-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  comp.is_active !== false
                                    ? 'hover:bg-amber-50 dark:hover:bg-slate-800 text-amber-500'
                                    : 'hover:bg-emerald-50 dark:hover:bg-slate-800 text-emerald-500'
                                }`}
                                title={comp.is_active !== false ? (isRtl ? 'تعطيل الحساب' : 'Suspend Account') : (isRtl ? 'تفعيل الحساب' : 'Activate Account')}
                              >
                                <Power size={14} />
                              </button>

                              {/* Manage Subscription */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCompany(comp);
                                  setSubPlan(comp.subscription_plan || 'Basic');
                                  setSubStatus(comp.subscription_status || 'active');
                                  setSubExpiry(comp.subscription_expiry || '');
                                  setCompanyModules(ModulesModule.getCompanyModules(comp.id));
                                  setActiveModalTab('subscription');
                                }}
                                className="p-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-slate-800 text-purple-500 cursor-pointer"
                                title={isRtl ? 'إدارة الاشتراك والتراخيص' : 'Manage Subscription'}
                              >
                                <Calendar size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => startStructEditCompany(comp)}
                                className="p-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                title={isRtl ? 'تعديل اسم الشركة' : 'Edit Company Name'}
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStructDeleteCompany(comp.id)}
                                className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-slate-800 text-rose-500 hover:text-rose-600 cursor-pointer"
                                title={isRtl ? 'حذف الشركة' : 'Delete Company'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Company Admin Credentials Section */}
                          <div className="mb-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-200/30 dark:border-indigo-900/30">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2.5">
                              <KeyRound size={13} />
                              <span>{isRtl ? 'حساب مدير الشركة (الأدمن)' : 'Company Administrator Account'}</span>
                            </div>
                            <AdminCredentialsForm
                              initialEmail={users.find(u => u.company_id === comp.id && u.role === 'Admin')?.email || ''}
                              initialPassword={users.find(u => u.company_id === comp.id && u.role === 'Admin')?.password || ''}
                              onSave={(email, pass, permissions) => handleSaveCompanyAdmin(comp.id, email, pass, permissions)}
                              isRtl={isRtl}
                              userRole="Admin"
                              companyId={comp.id}
                            />
                          </div>

                          {/* Tree Inner branches (Sectors and Stations) */}
                          <div className="space-y-6 pl-4 sm:pl-8 border-l-2 border-indigo-100 dark:border-slate-800/80 mr-1 sm:mr-4 rtl:pl-0 rtl:pr-4 sm:rtl:pr-8 rtl:border-l-0 rtl:border-r-2">
                            
                            {/* 1. SECTORS LOOP */}
                            {compRegs.length === 0 && directStns.length === 0 ? (
                              <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-400">
                                {isRtl 
                                  ? 'لا يوجد هيكل تنظيمي مضاف تحت هذه الشركة حتى الآن. ابدأ بإضافة قطاع أو فرع من الأزرار بالأعلى.' 
                                  : 'No organizational structure has been added under this company yet. Start by adding a sector or direct branch.'}
                              </div>
                            ) : (
                              compRegs.map(reg => {
                                const regStns = compStns.filter(s => s.region_id === reg.id);

                                return (
                                  <div key={reg.id} className="relative group/sector">
                                    {/* Horizontal connector dot */}
                                    <div className="absolute -left-[25px] rtl:-right-[25px] top-6 h-2 w-2 rounded-full bg-indigo-400 border-2 border-white dark:border-[#1e293b]" />
                                    
                                    {/* Sector Card */}
                                    <div className="p-4 rounded-xl border border-indigo-100 dark:border-slate-800 bg-white/50 dark:bg-slate-800/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-900 transition-all">
                                      <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                          <Globe size={16} />
                                        </div>
                                        <div>
                                          <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                                            {reg.name}
                                          </h5>
                                          <span className="text-[9px] font-mono font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                            {reg.code || 'REG-SEC'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Sector actions */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => startStructAddStationForRegion(reg.id, comp.id)}
                                          className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-450 text-[10px] font-black transition-all flex items-center gap-0.5 cursor-pointer"
                                          title={isRtl ? 'إضافة فرع عهدة تحت هذا القطاع' : 'Add Station under Sector'}
                                        >
                                          <Plus size={11} />
                                          <span>{isRtl ? 'إضافة فرع' : 'Add Branch'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => startStructEditRegion(reg)}
                                          className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-450 cursor-pointer"
                                          title={isRtl ? 'تعديل القطاع' : 'Edit Sector'}
                                        >
                                          <Edit size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStructDeleteRegion(reg.id)}
                                          className="p-1 rounded hover:bg-rose-50 dark:hover:bg-slate-800 text-rose-500 hover:text-rose-600 cursor-pointer"
                                          title={isRtl ? 'حذف القطاع' : 'Delete Sector'}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Region Manager Credentials Section */}
                                    <div className="mt-2.5 mb-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-200/20 dark:border-indigo-900/20 max-w-xl">
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-2">
                                        <KeyRound size={12} />
                                        <span>{isRtl ? 'حساب مدير القطاع (المنطقة)' : 'Regional Manager Account'}</span>
                                      </div>
                                      <AdminCredentialsForm
                                        initialEmail={users.find(u => u.region_id === reg.id && u.role === 'RegionalManager')?.email || ''}
                                        initialPassword={users.find(u => u.region_id === reg.id && u.role === 'RegionalManager')?.password || ''}
                                        onSave={(email, pass, permissions) => handleSaveRegionManager(reg.id, comp.id, email, pass, permissions)}
                                        isRtl={isRtl}
                                        userRole="RegionalManager"
                                        companyId={comp.id}
                                        regionId={reg.id}
                                      />
                                    </div>

                                    {/* Stations of Sector */}
                                    <div className="pl-6 mr-1 pr-0 sm:mr-3 sm:pr-0 border-l border-dashed border-indigo-200 dark:border-slate-800/80 my-2 space-y-3 rtl:pl-0 rtl:pr-6 rtl:border-l-0 rtl:border-r rtl:border-dashed">
                                      {regStns.length === 0 ? (
                                        <div className="p-3 text-[10px] text-slate-400 italic">
                                          {isRtl ? 'لا توجد فروع مضافة تحت هذا القطاع.' : 'No branches added under this sector yet.'}
                                        </div>
                                      ) : (
                                        regStns.map(stn => (
                                          <div 
                                            key={stn.id}
                                            className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/40 hover:border-slate-200 flex flex-col gap-2 max-w-xl"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2">
                                                <div className={`h-1.5 w-1.5 rounded-full ${stn.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                <div>
                                                  <div className="font-bold text-[11px] text-slate-700 dark:text-slate-200">
                                                    {stn.station_name}
                                                  </div>
                                                  <div className="text-[9px] text-slate-400 font-mono">
                                                    Code: {stn.station_code} | {isRtl ? 'العهدة:' : 'Custody:'} {CustodyDB.getStationDeductedCustody(stn.id).toLocaleString()} EGP
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => startStructEditStation(stn)}
                                                  className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-850 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                                  title={isRtl ? 'تعديل الفرع' : 'Edit Branch'}
                                                >
                                                  <Edit size={12} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleStructDeleteStation(stn.id)}
                                                  className="p-1 rounded hover:bg-rose-50 dark:hover:bg-slate-850 text-rose-500 hover:text-rose-600 cursor-pointer"
                                                  title={isRtl ? 'حذف الفرع' : 'Delete Branch'}
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                            </div>

                                            {/* Station Admin Credentials Section */}
                                            <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-450 dark:text-slate-500 mb-1.5">
                                                <KeyRound size={10} />
                                                <span>{isRtl ? 'حساب مسؤول الفرع (المحطة)' : 'Branch Manager Account'}</span>
                                              </div>
                                              <AdminCredentialsForm
                                                initialEmail={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.email || ''}
                                                initialPassword={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.password || ''}
                                                onSave={(email, pass, permissions) => handleSaveStationAdmin(stn.id, stn.region_id, comp.id, email, pass, permissions)}
                                                isRtl={isRtl}
                                                userRole="StationAdmin"
                                                companyId={comp.id}
                                                regionId={stn.region_id}
                                                stationId={stn.id}
                                              />
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}

                            {/* 2. DIRECT STATIONS LOOP */}
                            {directStns.length > 0 && (
                              <div className="space-y-3 mt-4 pt-4 border-t border-dashed border-slate-150 dark:border-slate-800">
                                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-2">
                                  {isRtl ? '🔗 فروع مباشرة تحت الشركة الأم' : '🔗 Direct Corporate Branches'}
                                </div>
                                {directStns.map(stn => (
                                  <div 
                                    key={stn.id}
                                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/40 hover:border-slate-200 flex flex-col gap-2 max-w-xl"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`h-1.5 w-1.5 rounded-full ${stn.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        <div>
                                          <div className="font-bold text-[11px] text-slate-700 dark:text-slate-200">
                                            {stn.station_name}
                                          </div>
                                          <div className="text-[9px] text-slate-400 font-mono">
                                            Code: {stn.station_code} | {isRtl ? 'العهدة:' : 'Custody:'} {CustodyDB.getStationDeductedCustody(stn.id).toLocaleString()} EGP
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => startStructEditStation(stn)}
                                          className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-850 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                          title={isRtl ? 'تعديل الفرع' : 'Edit Branch'}
                                        >
                                          <Edit size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStructDeleteStation(stn.id)}
                                          className="p-1 rounded hover:bg-rose-50 dark:hover:bg-slate-850 text-rose-500 hover:text-rose-600 cursor-pointer"
                                          title={isRtl ? 'حذف الفرع' : 'Delete Branch'}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Station Admin Credentials Section */}
                                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-450 dark:text-slate-500 mb-1.5">
                                        <KeyRound size={10} />
                                        <span>{isRtl ? 'حساب مسؤول الفرع (المحطة)' : 'Branch Manager Account'}</span>
                                      </div>
                                      <AdminCredentialsForm
                                        initialEmail={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.email || ''}
                                        initialPassword={users.find(u => u.station_id === stn.id && u.role === 'StationAdmin')?.password || ''}
                                        onSave={(email, pass, permissions) => handleSaveStationAdmin(stn.id, stn.region_id, comp.id, email, pass, permissions)}
                                        isRtl={isRtl}
                                        userRole="StationAdmin"
                                        companyId={comp.id}
                                        regionId={stn.region_id}
                                        stationId={stn.id}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VIEW B: CLASSIC LIST TABLES */}
              {structureView === 'tables' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Form tab switcher */}
                  <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
                    <button
                      onClick={() => setStructureTab('companies')}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        structureTab === 'companies' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
                      }`}
                    >
                      {isRtl ? '1. الشركات والكيانات' : '1. Companies'}
                    </button>
                    <button
                      onClick={() => setStructureTab('regions')}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        structureTab === 'regions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
                      }`}
                    >
                      {isRtl ? '2. قطاعات ومناطق جغرافية' : '2. Regions'}
                    </button>
                    <button
                      onClick={() => setStructureTab('stations')}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        structureTab === 'stations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
                      }`}
                    >
                      {isRtl ? '3. المحطات والفروع العهدية' : '3. Stations & Branches'}
                    </button>
                  </div>

                  {/* TAB 1: COMPANIES */}
                  {structureTab === 'companies' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={startStructAddCompany}
                          className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-all flex items-center gap-1 shadow-md cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>{isRtl ? 'إضافة شركة جديدة' : 'Add Company'}</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 mt-2 shadow-sm">
                        <table className="w-full text-xs text-left min-w-[750px]" dir={isRtl ? 'rtl' : 'ltr'}>
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="p-3.5">ID</th>
                              <th className="p-3.5">{isRtl ? 'الشركة' : 'Company'}</th>
                              <th className="p-3.5 text-center">{isRtl ? 'حالة الحساب' : 'Account Status'}</th>
                              <th className="p-3.5 text-center">{isRtl ? 'الباقة المفعلة' : 'Subscription Plan'}</th>
                              <th className="p-3.5 text-center">{isRtl ? 'انتهاء الاشتراك' : 'Subscription Expiry'}</th>
                              <th className="p-3.5 text-center">{isRtl ? 'حد العهدة الكلية' : 'Total Custody Limit'}</th>
                              <th className="p-3.5 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredCompanies.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-3.5 font-mono text-slate-400">{c.id}</td>
                                <td className="p-3.5 font-bold text-slate-900 dark:text-white text-xs md:text-sm">{c.name}</td>
                                <td className="p-3.5 text-center whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    c.is_active !== false 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${c.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <span>{c.is_active !== false ? (isRtl ? 'مفعلة' : 'Active') : (isRtl ? 'معطلة' : 'Suspended')}</span>
                                  </span>
                                </td>
                                <td className="p-3.5 text-center whitespace-nowrap font-bold">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    c.subscription_plan === 'Enterprise'
                                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                      : c.subscription_plan === 'Professional'
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {c.subscription_plan || 'Basic'}
                                  </span>
                                </td>
                                <td className="p-3.5 text-center whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                                  {c.subscription_expiry || '—'}
                                </td>
                                <td className="p-3.5 text-center whitespace-nowrap font-mono font-black text-slate-700 dark:text-slate-200">
                                  {CustodyDB.getCompanyDeductedCustody(c.id).toLocaleString()} EGP
                                </td>
                                <td className="p-3.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* Edit Name */}
                                    <button 
                                      onClick={() => startStructEditCompany(c)} 
                                      className="p-1.5 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400 cursor-pointer transition-all"
                                      title={isRtl ? 'تعديل اسم الشركة' : 'Edit Company Name'}
                                    >
                                      <Edit size={14} />
                                    </button>

                                    {/* Toggle active status */}
                                    <button
                                      onClick={() => handleToggleCompanyActive(c.id, c.is_active !== false)}
                                      className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        c.is_active !== false
                                          ? 'hover:bg-amber-50 dark:hover:bg-slate-800 text-amber-500'
                                          : 'hover:bg-emerald-50 dark:hover:bg-slate-800 text-emerald-500'
                                      }`}
                                      title={c.is_active !== false ? (isRtl ? 'تعطيل الحساب' : 'Suspend Account') : (isRtl ? 'تفعيل الحساب' : 'Activate Account')}
                                    >
                                      <Power size={14} />
                                    </button>

                                    {/* Edit Subscription */}
                                    <button
                                      onClick={() => {
                                        setEditingCompany(c);
                                        setSubPlan(c.subscription_plan || 'Basic');
                                        setSubStatus(c.subscription_status || 'active');
                                        setSubExpiry(c.subscription_expiry || '');
                                        setCompanyModules(ModulesModule.getCompanyModules(c.id));
                                        setActiveModalTab('subscription');
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 text-purple-500 cursor-pointer transition-all"
                                      title={isRtl ? 'إدارة الاشتراك والتراخيص' : 'Manage Subscription'}
                                    >
                                      <Calendar size={14} />
                                    </button>

                                    {/* Delete */}
                                    <button 
                                      onClick={() => handleStructDeleteCompany(c.id)} 
                                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg text-rose-500 cursor-pointer transition-all"
                                      title={isRtl ? 'حذف الشركة بالكامل' : 'Delete Company'}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {filteredCompanies.length === 0 && (
                              <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400">
                                  <Building2 size={24} className="mx-auto mb-2 text-slate-300" />
                                  <span>{isRtl ? 'لم يتم العثور على أي شركات مطابقة.' : 'No matching companies found.'}</span>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: REGIONS */}
                  {structureTab === 'regions' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => startStructAddRegionForCompany(structSelectedCompanyId)}
                          className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-all flex items-center gap-1 shadow-md cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>{isRtl ? 'إضافة قطاع/منطقة جديدة' : 'Add Region'}</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto border rounded-xl bg-white dark:bg-slate-900 mt-2">
                        <table className="w-full text-xs text-left min-w-[550px]" dir={isRtl ? 'rtl' : 'ltr'}>
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                            <tr>
                              <th className="p-3">ID</th>
                              <th className="p-3">{isRtl ? 'المنطقة' : 'Region'}</th>
                              <th className="p-3">{isRtl ? 'الشركة التابعة له' : 'Affiliated Company'}</th>
                              <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {regions.map(r => (
                              <tr key={r.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-mono text-slate-400">{r.id}</td>
                                <td className="p-3 font-bold text-slate-900 dark:text-white">{r.name}</td>
                                <td className="p-3 text-slate-500 dark:text-slate-400">{companies.find(c => c.id === r.company_id)?.name || r.company_id}</td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => startStructEditRegion(r)} className="p-1 hover:bg-indigo-50 rounded text-indigo-600 dark:text-indigo-400 cursor-pointer"><Edit size={14} /></button>
                                    <button onClick={() => handleStructDeleteRegion(r.id)} className="p-1 hover:bg-rose-50 rounded text-rose-500 cursor-pointer"><Trash2 size={14} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: STATIONS */}
                  {structureTab === 'stations' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => startStructAddStationForRegion('none', structSelectedCompanyId)}
                          className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-all flex items-center gap-1 shadow-md cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>{isRtl ? 'إضافة محطة/فرع عهدة جديدة' : 'Add Station'}</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto border rounded-xl bg-white dark:bg-slate-900 mt-2">
                        <table className="w-full text-xs text-left min-w-[650px]" dir={isRtl ? 'rtl' : 'ltr'}>
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                            <tr>
                              <th className="p-3">ID</th>
                              <th className="p-3">{isRtl ? 'اسم الفرع/المحطة' : 'Station/Branch'}</th>
                              <th className="p-3">{isRtl ? 'مركز كلفة العهدة' : 'Cost Center'}</th>
                              <th className="p-3">{isRtl ? 'المبلغ الكلي للعهدة' : 'Custody Amount'}</th>
                              <th className="p-3">{isRtl ? 'المنطقة' : 'Region'}</th>
                              <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {stations.map(s => (
                              <tr key={s.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-mono text-slate-400">{s.id}</td>
                                <td className="p-3 font-bold text-slate-900 dark:text-white">{s.station_name}</td>
                                <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-450">{s.station_code}</td>
                                <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{CustodyDB.getStationDeductedCustody(s.id).toLocaleString()} EGP</td>
                                <td className="p-3">
                                  {s.region_id ? (
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {regions.find(r => r.id === s.region_id)?.name || s.region_id}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                                      {isRtl ? 'مباشر - بدون منطقة' : 'Direct - No Region'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => startStructEditStation(s)} className="p-1 hover:bg-indigo-50 rounded text-indigo-600 dark:text-indigo-400 cursor-pointer"><Edit size={14} /></button>
                                    <button onClick={() => handleStructDeleteStation(s.id)} className="p-1 hover:bg-rose-50 rounded text-rose-500 cursor-pointer"><Trash2 size={14} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {activeSubTab === 'operations' && (
        <div className="space-y-6">
          {/* Operations Overview banner */}
          <div className="p-4.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 flex items-start gap-3">
            <Activity size={20} className="text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">{isRtl ? 'إدارة العمليات والتدقيق المالي الشامل' : 'Internal Operations & Financial Audit Ledger'}</h4>
              <p className="text-[11px] leading-relaxed">
                {isRtl 
                  ? 'شاشة التحكم المركزية لمراجعة كافة الحركات والعمليات المالية والعهدية على مستوى كافة الشركات. يمكنك تعديل أو حذف أي حركة (معلقة، تحت التسوية، مسواة، أو شحن واستعاضة عهد) مع إعادة تفعيل واحتساب الأثر المالي فوراً وبشكل متكامل.'
                  : 'Central console to audit and modify any cash ledger activity or replenishment across all corporate tenants. Modifying or deleting records will automatically recalculate cash disponible, nominal custody, and corresponding vouchers in real-time.'}
              </p>
            </div>
          </div>

          {/* Filtering Console */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Company Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'الشركة' : 'Company'}</label>
                <select
                  value={opCompanyFilter}
                  onChange={(e) => {
                    setOpCompanyFilter(e.target.value);
                    setOpRegionFilter('all');
                    setOpStationFilter('all');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                >
                  <option value="all">{isRtl ? 'كل الشركات' : 'All Companies'}</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Region Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'القطاع / المنطقة' : 'Region / Sector'}</label>
                <select
                  value={opRegionFilter}
                  onChange={(e) => {
                    setOpRegionFilter(e.target.value);
                    setOpStationFilter('all');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                >
                  <option value="all">{isRtl ? 'كل المناطق' : 'All Regions'}</option>
                  {opFilteredRegions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Station Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'الفرع / المحطة' : 'Branch / Station'}</label>
                <select
                  value={opStationFilter}
                  onChange={(e) => setOpStationFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 font-semibold"
                >
                  <option value="all">{isRtl ? 'كل الفروع والمحطات' : 'All Branches/Stations'}</option>
                  {opFilteredStations.map(s => (
                    <option key={s.id} value={s.id}>{s.station_name} ({s.station_code})</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isRtl ? 'نوع وحالة الحركة' : 'Operation Status'}</label>
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
                    <th className="p-3 text-start">{isRtl ? 'المنشأة والفرع' : 'Entity & Branch'}</th>
                    <th className="p-3 text-start">{isRtl ? 'بيان وتفاصيل العملية' : 'Details & Description'}</th>
                    <th className="p-3 text-start">{isRtl ? 'المبلغ' : 'Amount'}</th>
                    <th className="p-3 text-center">{isRtl ? 'حالة الحركة' : 'Status'}</th>
                    <th className="p-3 text-start">{isRtl ? 'بواسطة' : 'Created By'}</th>
                    <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {filteredOperations.map(op => {
                    const comp = companies.find(c => c.id === op.company_id);
                    const st = stations.find(s => s.id === op.station_id);
                    
                    return (
                      <tr key={op.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all">
                        {/* Ref No */}
                        <td className="p-3 font-mono font-bold text-slate-500 text-start">{op.refNo}</td>
                        
                        {/* Date */}
                        <td className="p-3 text-slate-500 whitespace-nowrap text-start">
                          {new Date(op.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric'
                          })}
                        </td>

                        {/* Entity & Branch */}
                        <td className="p-3 text-start">
                          <div className="font-bold text-slate-900 dark:text-white">{comp?.name || isRtl ? 'منصة عامة' : 'Global Platform'}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{st ? `${st.station_name} (${st.station_code})` : (isRtl ? 'مباشر - بدون محطة' : 'Direct Link')}</div>
                        </td>

                        {/* Description */}
                        <td className="p-3 text-start max-w-xs truncate">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{op.description}</div>
                          {op.notes && <div className="text-[10px] text-slate-400 font-mono italic">{op.notes}</div>}
                        </td>

                        {/* Amount */}
                        <td className="p-3 font-mono font-bold text-start text-sm text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {op.amount.toLocaleString()} EGP
                        </td>

                        {/* Status */}
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

                        {/* Created By */}
                        <td className="p-3 text-slate-500 whitespace-nowrap text-start">
                          <div className="font-semibold">{op.created_by}</div>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center whitespace-nowrap">
                          {op.status !== 'Deleted' ? (
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
                                  refreshOperationsData();
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
                        <div className="text-[11px] text-slate-400 mt-1">{isRtl ? 'جرب تغيير خيارات الفلترة أو كتابة كلمة بحث مختلفة.' : 'Try adjusting the search criteria or filters above.'}</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'impersonate' && (
        <div className="space-y-6">
          <div className="p-4.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 flex items-start gap-3">
            <Info size={20} className="text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">{isRtl ? 'بوابة الدعم الفني المباشر للمنصة' : 'Direct Technical Support Access'}</h4>
              <p className="text-[11px] leading-relaxed">
                {isRtl 
                  ? 'تتيح لك البوابة الولوج السريع لأي مستخدم لمباشرة المشاكل الفنية وتصحيح العهد بدون إدخال كلمة مرورهم. سيحتفظ النظام بجلستك الأساسية كـ Super Admin، ويمكنك إنهاء الدعم والعودة بضغطة زر واحدة. يتم تسجيل كل جلسة في سجل الامتثال.'
                  : 'Gain direct read/write context to any user account to troubleshoot bugs, adjust balances or guide cashiers. This session runs on temporary authentication under audit. You can resume your Super Admin dashboard instantly with one click.'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm w-full">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isRtl ? 'اختر مستخدماً لبدء الدعم' : 'Select Target Support Session'}
                </h3>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-bold">{isRtl ? `مجموع المستخدمين: ${supportUsersList.length}` : `Total Users: ${supportUsersList.length}`}</span>
              </div>
              
              {/* Support User Search Filter */}
              <div className="relative w-full">
                <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder={isRtl ? 'بحث باسم المستخدم، البريد، أو الصلاحية...' : 'Search target name, email or role...'}
                  value={supportUserSearch}
                  onChange={(e) => setSupportUserSearch(e.target.value)}
                  className="w-full pl-4 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            {impersonateError && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 font-semibold border border-rose-500/20 text-[11px]">
                {impersonateError}
              </div>
            )}

            <div className="space-y-2 max-h-[380px] overflow-y-auto px-1">
              {supportUsersList.map(u => {
                const comp = companies.find(c => c.id === u.company_id);
                const userStation = stations.find(s => s.id === u.station_id);
                const userRegionId = u.region_id || userStation?.region_id;
                const userRegion = regions.find(r => r.id === userRegionId);

                // Friendly role display
                let friendlyRole = u.role;
                if (u.role === 'Admin') friendlyRole = isRtl ? 'ادمن الشركة' : 'Company Admin';
                else if (u.role === 'RegionalManager') friendlyRole = isRtl ? 'مدير منطقة' : 'Regional Manager';
                else if (u.role === 'StationAdmin') friendlyRole = isRtl ? 'مدير محطة' : 'Station Manager';

                return (
                  <div 
                    key={u.id}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all text-xs"
                  >
                    <div className="space-y-1.5 w-full sm:w-auto">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>{u.full_name}</span>
                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-black tracking-wide">
                          {friendlyRole}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-1.5 items-center">
                        <span>{u.email}</span>
                        
                        {/* Company */}
                        {comp && (
                          <span className="text-slate-500 dark:text-slate-300 font-semibold flex items-center gap-1">
                            <span className="inline-block">🏢</span>
                            <span>{comp.name}</span>
                          </span>
                        )}

                        {/* Region */}
                        {userRegion && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <span className="inline-block">🌍</span>
                            <span>{isRtl ? `المنطقة: ${userRegion.name}` : `Region: ${userRegion.name}`}</span>
                          </span>
                        )}

                        {/* Station / Branch */}
                        {userStation && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="inline-block">📍</span>
                            <span>{isRtl ? `الفرع/المحطة: ${userStation.station_name}` : `Branch/Station: ${userStation.station_name}`}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartImpersonation(u)}
                      className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[10px] transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <UserCheck size={12} />
                      <span>{isRtl ? 'الدخول للدعم الفني' : 'Impersonate Account'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ClipboardList size={18} className="text-indigo-500" />
                <span>{isRtl ? 'سجل الولوج التقني (Impersonation Audit)' : 'Support Sessions History'}</span>
              </h3>
            </div>
            
          {/* Audit Logs Responsive Container */}
          <div>
            {/* Mobile Cards Layout */}
            <div className="block md:hidden space-y-4">
              {impersonationAuditLogs.map(log => {
                const dets = log.details || {};
                return (
                  <div key={log.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block">{isRtl ? 'المشرف المسؤول (Super)' : 'Super Admin'}</span>
                        <div className="font-bold text-slate-900 dark:text-white">{dets.impersonator_name || log.user_name}</div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                        log.action_type === 'IMPERSONATION_START'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {log.action_type === 'IMPERSONATION_START' ? (isRtl ? 'بدء دعم' : 'Support Begun') : (isRtl ? 'إنهاء الدعم' : 'Support Exited')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-slate-100 dark:border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isRtl ? 'المستخدم المستهدف' : 'Target User'}</span>
                        <div className="font-bold text-slate-900 dark:text-white mt-0.5">{dets.target_user_name || '-'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isRtl ? 'الشركة' : 'Company'}</span>
                        <div className="text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 truncate">{dets.company_name || '-'}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'تفاصيل الرقابة الفنية' : 'Session Details / IP / Agent'}</span>
                      <div className="text-slate-950 dark:text-white font-semibold">{dets.reason || log.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1.5 flex flex-wrap gap-2">
                        <span className="flex items-center gap-0.5"><Globe size={11} /> {log.ip_address}</span>
                        <span className="flex items-center gap-0.5"><Laptop size={11} /> {log.device}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono text-left">
                      {new Date(log.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                    </div>
                  </div>
                );
              })}

              {impersonationAuditLogs.length === 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400">
                  <ClipboardList size={24} className="mx-auto mb-2 text-slate-300" />
                  <span>{isRtl ? 'سجل العمليات فارغ حتى الآن.' : 'No support session logs found.'}</span>
                </div>
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-bold text-right md:text-left">
                    <th className="p-4">{isRtl ? 'المشرف المسؤول (Super)' : 'Super Admin'}</th>
                    <th className="p-4">{isRtl ? 'العملية' : 'Action Type'}</th>
                    <th className="p-4">{isRtl ? 'المستخدم المستهدف والشركة' : 'Target User & Company'}</th>
                    <th className="p-4 font-mono">{isRtl ? 'التوقيت' : 'Timestamp'}</th>
                    <th className="p-4">{isRtl ? 'تفاصيل الرقابة الفنية' : 'Session Details / IP / Agent'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-xs text-right md:text-left">
                  {impersonationAuditLogs.map(log => {
                    const dets = log.details || {};
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {dets.impersonator_name || log.user_name}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.action_type === 'IMPERSONATION_START'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {log.action_type === 'IMPERSONATION_START' ? (isRtl ? 'بدء دعم فني' : 'Support Begun') : (isRtl ? 'إنهاء الدعم الفني' : 'Support Exited')}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">{dets.target_user_name || '-'}</div>
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{dets.company_name || '-'}</div>
                        </td>
                        <td className="p-4 font-mono text-[10px] text-slate-500">
                          {new Date(log.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </td>
                        <td className="p-4">
                          <div className="text-slate-900 dark:text-white font-semibold">{dets.reason || log.description}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1 flex flex-wrap gap-x-2.5">
                            <span className="flex items-center gap-0.5"><Globe size={11} /> {log.ip_address}</span>
                            <span className="flex items-center gap-0.5"><Laptop size={11} /> {log.device}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {impersonationAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        <ClipboardList size={24} className="mx-auto mb-2 text-slate-300" />
                        <span>{isRtl ? 'سجل العمليات فارغ حتى الآن.' : 'No support session logs found.'}</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Company */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCreateCompanyModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Building2 size={20} className="text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isRtl ? 'إضافة شركة جديدة للمنصة' : 'Onboard New Company'}</h3>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'اسم الشركة (عربي / إنجليزي)' : 'Company Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Al-Futtaim Egypt (الفطيم مصر)"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'قيمة العهدة الابتدائية المسموح بها' : 'Initial Custody Limit'}</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newCompanyCustody}
                  onChange={(e) => setNewCompanyCustody(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateCompanyModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'إنشاء وتفعيل' : 'Onboard Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Subscription & Modules */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingCompany(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl space-y-4 text-xs my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isRtl ? `إدارة تراخيص واشتراكات: ${editingCompany.name}` : `Licensing & Subscription: ${editingCompany.name}`}
                </h3>
              </div>
              <button onClick={() => setEditingCompany(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Tab Switches */}
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModalTab('subscription')}
                className={`py-2 px-4 font-bold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'subscription'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {isRtl ? 'بيانات الاشتراك الرئيسي' : 'Main Subscription'}
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('modules')}
                className={`py-2 px-4 font-bold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'modules'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {isRtl ? 'الموديولات والأقسام (Modules)' : 'Module Management'}
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4">
              {activeModalTab === 'subscription' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'الباقة المفعلة' : 'Select Subscription Plan'}</label>
                    <select
                      value={subPlan}
                      onChange={(e) => setSubPlan(e.target.value as Company['subscription_plan'])}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                    >
                      <option value="Basic">{isRtl ? 'الباقة الأساسية (Basic)' : 'Basic Plan'}</option>
                      <option value="Professional">{isRtl ? 'باقة المحترفين (Professional)' : 'Professional Plan'}</option>
                      <option value="Enterprise">{isRtl ? 'باقة الشركات الكبرى (Enterprise)' : 'Enterprise Plan'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'حالة الاشتراك' : 'Subscription Status'}</label>
                    <select
                      value={subStatus}
                      onChange={(e) => setSubStatus(e.target.value as Company['subscription_status'])}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                    >
                      <option value="active">{isRtl ? 'نشط (Active)' : 'Active'}</option>
                      <option value="suspended">{isRtl ? 'موقوف مؤقتاً (Suspended)' : 'Suspended'}</option>
                      <option value="trial">{isRtl ? 'فترة تجريبية (Trial)' : 'Trial Period'}</option>
                      <option value="expired">{isRtl ? 'منتهي الصلاحية (Expired)' : 'Expired'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'تاريخ انتهاء الاشتراك' : 'Subscription Expiry Date'}</label>
                    <input
                      type="date"
                      required
                      value={subExpiry}
                      onChange={(e) => setSubExpiry(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {activeModalTab === 'modules' && (
                <div className="space-y-4">
                  {/* Top quick administrative actions */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...companyModules };
                          Object.keys(updated).forEach(k => {
                            updated[k] = { ...updated[k], enabled: true, status: 'active' };
                          });
                          setCompanyModules(updated);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 cursor-pointer font-bold text-[10px]"
                      >
                        {isRtl ? 'تفعيل الكل' : 'Enable All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...companyModules };
                          Object.keys(updated).forEach(k => {
                            updated[k] = { ...updated[k], enabled: false, status: 'inactive' };
                          });
                          setCompanyModules(updated);
                        }}
                        className="px-2.5 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-500/20 cursor-pointer font-bold text-[10px]"
                      >
                        {isRtl ? 'تعطيل الكل' : 'Disable All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const defaults = ModulesModule.getDefaultModulesForPlan(subPlan);
                          setCompanyModules(defaults);
                        }}
                        className="px-2.5 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-500/20 cursor-pointer font-bold text-[10px]"
                      >
                        {isRtl ? 'تطبيق باقة الاشتراك' : 'Apply Package'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={copySourceCompanyId}
                        onChange={(e) => setCopySourceCompanyId(e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] text-slate-800 dark:text-white font-semibold"
                      >
                        <option value="">{isRtl ? 'نسخ من شركة...' : 'Copy from company...'}</option>
                        {CustodyDB.getCompanies()
                          .filter(c => c.id !== editingCompany.id)
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!copySourceCompanyId}
                        onClick={() => {
                          if (!copySourceCompanyId) return;
                          const copied = ModulesModule.getCompanyModules(copySourceCompanyId);
                          setCompanyModules(copied);
                        }}
                        className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold text-[10px]"
                      >
                        {isRtl ? 'نسخ' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Modules detail matrix list */}
                  <div className="max-h-72 overflow-y-auto space-y-3.5 pr-1">
                    {ERP_MODULES_REGISTRY.map(m => {
                      const modSettings = companyModules[m.id] || {
                        enabled: false,
                        plan: 'Basic',
                        status: 'inactive',
                        activation_date: '',
                        expiry_date: '',
                        notes: ''
                      };

                      const updateModField = (field: keyof CompanyModuleSettings, val: any) => {
                        setCompanyModules({
                          ...companyModules,
                          [m.id]: {
                            ...modSettings,
                            [field]: val
                          }
                        });
                      };

                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            modSettings.enabled
                              ? 'bg-indigo-500/5 border-indigo-500/10 dark:border-indigo-500/20'
                              : 'bg-slate-50/50 border-slate-100 dark:border-slate-850 dark:bg-slate-850/40 text-slate-400'
                          }`}
                        >
                          {/* Module identity */}
                          <div className="flex items-start justify-between gap-4 mb-2.5">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${modSettings.enabled ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                                {isRtl ? m.name_ar : m.name_en}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {isRtl ? m.description_ar : m.description_en}
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!modSettings.enabled}
                                onChange={(e) => {
                                  updateModField('enabled', e.target.checked);
                                  updateModField('status', e.target.checked ? 'active' : 'inactive');
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                            </label>
                          </div>

                          {/* Module detail fields */}
                          {modSettings.enabled && (
                            <div className="grid grid-cols-2 gap-2 text-[10px] mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                              <div>
                                <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'مستوى الخدمة (Plan)' : 'Service Plan'}</label>
                                <select
                                  value={modSettings.plan}
                                  onChange={(e) => updateModField('plan', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-lg text-[10px] text-slate-800 dark:text-white"
                                >
                                  <option value="Basic">{isRtl ? 'أساسي (Basic)' : 'Basic'}</option>
                                  <option value="Professional">{isRtl ? 'محترف (Professional)' : 'Professional'}</option>
                                  <option value="Enterprise">{isRtl ? 'مؤسسات (Enterprise)' : 'Enterprise'}</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'حالة التفعيل (Status)' : 'Activation Status'}</label>
                                <select
                                  value={modSettings.status}
                                  onChange={(e) => updateModField('status', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-lg text-[10px] text-slate-800 dark:text-white"
                                >
                                  <option value="active">{isRtl ? 'نشط (Active)' : 'Active'}</option>
                                  <option value="inactive">{isRtl ? 'معطل (Inactive)' : 'Inactive'}</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'تاريخ البدء' : 'Start Date'}</label>
                                <input
                                  type="date"
                                  value={modSettings.activation_date || ''}
                                  onChange={(e) => updateModField('activation_date', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-lg text-[10px] text-slate-800 dark:text-white font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
                                <input
                                  type="date"
                                  value={modSettings.expiry_date || ''}
                                  onChange={(e) => updateModField('expiry_date', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-lg text-[10px] text-slate-800 dark:text-white font-mono"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="block text-slate-400 font-bold mb-1">{isRtl ? 'ملاحظات' : 'Licensing Notes'}</label>
                                <input
                                  type="text"
                                  placeholder={isRtl ? 'مثال: باقة تجريبية مجانية لمدير فرع جده' : 'e.g. Free demo for region admin'}
                                  value={modSettings.notes || ''}
                                  onChange={(e) => updateModField('notes', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-lg text-[10px] text-slate-800 dark:text-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'حفظ التعديلات والترخيص' : 'Save & License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset Password Confirm */}
      {selectedUserForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedUserForReset(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-rose-500">
              <KeyRound size={20} />
              <h3 className="text-sm font-bold">{isRtl ? `تغيير كلمة المرور: ${selectedUserForReset.full_name}` : `Reset Password: ${selectedUserForReset.full_name}`}</h3>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'البريد الإلكتروني للمدير' : 'Manager Email'}</label>
                <input
                  type="text"
                  disabled
                  value={selectedUserForReset.email}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-slate-50 dark:bg-slate-850 text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  placeholder="e.g. Pass9922"
                  value={newPlainPassword}
                  onChange={(e) => setNewPlainPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 font-mono"
                />
              </div>

              {resetSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-center">
                  {resetSuccessMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForReset(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'تغيير كلمة المرور الآن' : 'Commit Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Structure Builder Company Modal */}
      {showStructCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowStructCompanyModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Building2 size={20} className="text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {structEditingCompany ? (isRtl ? 'تعديل بيانات الشركة الكيان' : 'Edit Enterprise Company') : (isRtl ? 'إضافة شركة كيان جديدة للمنصة' : 'Add New Enterprise Company')}
              </h3>
            </div>

            <form onSubmit={handleStructAddCompany} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'اسم الشركة (عربي / إنجليزي)' : 'Company Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Al-Futtaim Egypt (الفطيم مصر)"
                  value={structCompName}
                  onChange={(e) => setStructCompName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                />
              </div>

              {!structEditingCompany && (
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'قيمة العهدة الابتدائية المسموح بها' : 'Initial Custody Limit'}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newCompanyCustody}
                    onChange={(e) => setNewCompanyCustody(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStructCompanyModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'حفظ وتفعيل' : 'Save & Onboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Structure Builder Region Modal */}
      {showStructRegionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowStructRegionModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Globe size={20} className="text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {structEditingRegion ? (isRtl ? 'تعديل قطاع / منطقة' : 'Edit Region Sector') : (isRtl ? 'إضافة قطاع / منطقة جديدة' : 'Add New Region Sector')}
              </h3>
            </div>

            <form onSubmit={handleStructAddRegion} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'المنطقة الجغرافية / اسم القطاع' : 'Region/Sector Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Cairo South (جنوب القاهرة)"
                  value={structRegName}
                  onChange={(e) => setStructRegName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'الشركة التابعة لها' : 'Belongs to Parent Company'}</label>
                <select
                  value={structRegCompanyId}
                  onChange={(e) => setStructRegCompanyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                >
                  <option value="">{isRtl ? '-- اختر الشركة التابعة لها --' : '-- Select Parent Company --'}</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStructRegionModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Structure Builder Station Modal */}
      {showStructStationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowStructStationModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Building size={20} className="text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {structEditingStation ? (isRtl ? 'تعديل فرع عهدة / محطة' : 'Edit Custody Station') : (isRtl ? 'إضافة فرع عهدة / محطة جديدة' : 'Add Custody Station')}
              </h3>
            </div>

            <form onSubmit={handleStructAddStation} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'اسم الفرع / المحطة العهدية' : 'Station/Branch Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Degla Maadi Branch (فرع دجلة المعادي)"
                  value={structStnName}
                  onChange={(e) => setStructStnName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'كود مركز الكلفة المالي' : 'Cost Center Code'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., CC-MAADI-01"
                  value={structStnCode}
                  onChange={(e) => setStructStnCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'قيمة الرصيد الدفتري الكلي للعهدة (EGP)' : 'Total Custody Book Limit (EGP)'}</label>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="e.g., 50000"
                  value={structStnCustody}
                  onChange={(e) => setStructStnCustody(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'القطاع / الإقليم الجغرافي التابع له' : 'Belongs to Region/Sector'}</label>
                <select
                  value={structStnRegionId}
                  onChange={(e) => setStructStnRegionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                >
                  <option value="none">{isRtl ? 'ارتباط مباشر بالشركة (بدون قطاع)' : 'Direct Link to Company (No Sector)'}</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({companies.find(c => c.id === r.company_id)?.name})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStructStationModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'حفظ الفرع' : 'Save Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Edit Operation (Expense or Replenishment) */}
      {showOpEditModal && editingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setShowOpEditModal(false); setEditingOp(null); }} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-indigo-600 dark:text-indigo-400">
              <Activity size={20} />
              <h3 className="text-sm font-bold">
                {isRtl 
                  ? `تعديل الحركة المالية: ${editingOp.refNo}`
                  : `Edit Operation: ${editingOp.refNo}`}
              </h3>
            </div>

            {editingOp.type === 'transaction' ? (
              <form onSubmit={handleEditTransactionSubmit} className="space-y-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'تاريخ الحركة' : 'Operation Date'}</label>
                  <input
                    type="date"
                    required
                    value={opEditDate}
                    onChange={(e) => setOpEditDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'المبلغ بالجنيه المصري (EGP)' : 'Amount (EGP)'}</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="any"
                    value={opEditAmount}
                    onChange={(e) => setOpEditAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'البيان والوصف' : 'Description/Details'}</label>
                  <input
                    type="text"
                    required
                    value={opEditDescription}
                    onChange={(e) => setOpEditDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'حالة الحركة' : 'Operation Status'}</label>
                  <select
                    value={opEditStatus}
                    onChange={(e) => setOpEditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500"
                  >
                    <option value="Pending">{isRtl ? 'معلقة (Pending)' : 'Pending'}</option>
                    <option value="Under Settlement">{isRtl ? 'تحت التسوية (Under Settlement)' : 'Under Settlement'}</option>
                    <option value="Settled">{isRtl ? 'تمت تسويتها (Settled)' : 'Fully Settled'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'ملاحظات إضافية' : 'Additional Notes / Check Reference'}</label>
                  <textarea
                    rows={3}
                    value={opEditNotes}
                    onChange={(e) => setOpEditNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setShowOpEditModal(false); setEditingOp(null); }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                  >
                    {isRtl ? 'حفظ الأثر المالي والتعديل' : 'Save & Recalculate'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEditReplenishmentSubmit} className="space-y-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-800 dark:text-cyan-300">
                  <p className="text-[10px] leading-relaxed text-right">
                    {isRtl 
                      ? '⚠️ تنبيه: تعديل مبلغ الاستعاضة سيقوم تلقائياً بتعديل قيمة العهدة الاسمية للمحطة في النظام بمقدار الفارق.'
                      : '⚠️ Warning: Changing the replenishment amount will automatically adjust the nominal custody limit of the branch.'}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'مبلغ الاستعاضة والشحن (EGP)' : 'Replenishment Amount (EGP)'}</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="any"
                    value={opEditReplenishAmount}
                    onChange={(e) => setOpEditReplenishAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'ملاحظات الاستعاضة والتحويل' : 'Transfer/Cheque Notes'}</label>
                  <textarea
                    rows={3}
                    value={opEditReplenishNotes}
                    onChange={(e) => setOpEditReplenishNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setShowOpEditModal(false); setEditingOp(null); }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                  >
                    {isRtl ? 'حفظ وتعديل قيمة العهدة' : 'Save & Adjust Custody'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 8: Delete Operation Confirm */}
      {showOpDeleteModal && deletingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setShowOpDeleteModal(false); setDeletingOp(null); }} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-rose-500">
              <AlertTriangle size={20} className="animate-bounce" />
              <h3 className="text-sm font-bold">
                {isRtl 
                  ? `حذف نهائي وتراجع مالي: ${deletingOp.refNo}`
                  : `Irreversible Deletion: ${deletingOp.refNo}`}
              </h3>
            </div>

            <form onSubmit={handleDeleteOpSubmit} className="space-y-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 space-y-1.5">
                <h4 className="font-bold text-[11px] uppercase tracking-wider">{isRtl ? 'تأثير مالي خطير وحرج' : 'Critical Financial Action'}</h4>
                <p className="text-[10px] leading-relaxed text-right">
                  {deletingOp.type === 'transaction'
                    ? (isRtl 
                        ? 'سيؤدي هذا الإجراء إلى حذف الحركة كلياً وإلغاء أثرها المالي وإرجاع قيمة المبلغ للخزينة الحالية للفرع والعهدة المستهلكة فوراً.'
                        : 'Deletes this transaction entirely, restoring the spent funds back to the station balance in real-time.')
                    : (isRtl 
                        ? 'سيؤدي حذف عملية الاستعاضة إلى إلغاء شحن رصيد العهدة للمحطة وخصم قيمة المبلغ من قيمة العهدة الاسمية الحالية فوراً في النظام.'
                        : 'Deletes this custody replenishment, instantly subtracting the amount from the branch custody limit.')}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">{isRtl ? 'سبب الحذف والتدقيق (مطلوب)' : 'Auditable Reason for Deletion (Required)'}</label>
                <textarea
                  required
                  rows={3}
                  placeholder={isRtl ? 'مثال: إدخال مكرر للمصروف / إلغاء طلب الشحن من الإدارة المالية...' : 'e.g., Duplicate record entry / Reversed bank transfer...'}
                  value={opDeleteReason}
                  onChange={(e) => setOpDeleteReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 focus:border-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowOpDeleteModal(false); setDeletingOp(null); }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  {isRtl ? 'حذف وتحديث كافة الحسابات فوراً' : 'Confirm Deletion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
