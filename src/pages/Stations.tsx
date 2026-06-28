import React, { useState } from 'react';
import { 
  Building, 
  Search, 
  Wallet, 
  Clock, 
  FileCheck, 
  TrendingUp, 
  ArrowRight,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Coins,
  ShieldCheck,
  Building2,
  Globe,
  CornerDownLeft,
  Settings,
  UserCheck
} from 'lucide-react';
import { CustodyDB } from '../db';
import { translations, Language, Theme, Station, Region, Company } from '../types';

interface StationsProps {
  language: Language;
  theme: Theme;
  setCurrentTab: (tab: string) => void;
  setSelectedStationId: (id: string | null) => void;
}

export default function Stations({
  language,
  theme,
  setCurrentTab,
  setSelectedStationId
}: StationsProps) {
  const t = translations[language];
  const isRtl = language === 'ar';
  const activeUser = CustodyDB.getActiveUser();
  const isAdmin = activeUser && (activeUser.role === 'SystemAdmin' || activeUser.role === 'Admin');
  const isSystemAdmin = activeUser?.role === 'SystemAdmin';
  const canRecharge = activeUser && (activeUser.role === 'SystemAdmin' || activeUser.role === 'Admin' || activeUser.role === 'RegionalManager');

  const [searchQuery, setSearchQuery] = useState('');
  
  // Scopes and data
  const [companies, setCompanies] = useState<Company[]>(() => CustodyDB.getCompanies());
  const [regions, setRegions] = useState<Region[]>(() => CustodyDB.getRegions());
  const [stations, setStations] = useState<Station[]>(() => CustodyDB.getStations());
  const allTransactions = CustodyDB.getScopedTransactions();

  // Selected company id and active region filtering
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => CustodyDB.getSelectedCompanyId());
  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    const compRegions = regions.filter(r => r.company_id === selectedCompanyId);
    return activeUser?.region_id || compRegions[0]?.id || 'all';
  });

  // UI state
  const [isStructureOpen, setIsStructureOpen] = useState(false);
  const [structureTab, setStructureTab] = useState<'companies' | 'regions' | 'stations'>(
    isSystemAdmin ? 'companies' : 'regions'
  );
  
  // Recharge Custody Modal State
  const [rechargingStation, setRechargingStation] = useState<Station | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeNotes, setRechargeNotes] = useState('');

  // Toast Notification
  const [toastMsg, setToastMsg] = useState('');

  // Form states for creating/editing entities
  const [compName, setCompName] = useState('');
  const [compCustody, setCompCustody] = useState('');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regCompanyId, setRegCompanyId] = useState(selectedCompanyId);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);

  const [stnName, setStnName] = useState('');
  const [stnCode, setStnCode] = useState('');
  const [stnCustody, setStnCustody] = useState('');
  const [stnRegionId, setStnRegionId] = useState('');
  const [editingStation, setEditingStation] = useState<Station | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const refreshData = () => {
    setCompanies(CustodyDB.getCompanies());
    setRegions(CustodyDB.getRegions());
    setStations(CustodyDB.getStations());
  };

  const handleViewStation = (stationId: string) => {
    setSelectedStationId(stationId);
    setCurrentTab('station-details');
  };

  // Company CRUD handlers
  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim() || !compCustody) return;
    const val = parseFloat(compCustody);
    if (isNaN(val) || val <= 0) return;

    if (editingCompany) {
      CustodyDB.updateCompany(editingCompany.id, {
        name: compName.trim(),
        custody_value: val
      });
      showToast(isRtl ? 'تم تحديث الشركة بنجاح' : 'Company updated successfully');
      setEditingCompany(null);
    } else {
      CustodyDB.addCompany(compName.trim(), val);
      showToast(isRtl ? 'تم إضافة الشركة بنجاح' : 'Company added successfully');
    }
    setCompName('');
    setCompCustody('');
    refreshData();
  };

  const startEditCompany = (c: Company) => {
    setEditingCompany(c);
    setCompName(c.name);
    setCompCustody(String(c.custody_value));
  };

  const handleDeleteCompany = (id: string) => {
    if (confirm(isRtl ? 'هل تريد حذف هذه الشركة وجميع بياناتها بالتأكيد؟' : 'Are you sure you want to delete this company?')) {
      CustodyDB.deleteCompany(id);
      showToast(isRtl ? 'تم حذف الشركة بنجاح' : 'Company deleted successfully');
      refreshData();
    }
  };

  // Region CRUD handlers
  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regCode.trim()) return;

    if (editingRegion) {
      CustodyDB.updateRegion(editingRegion.id, {
        name: regName.trim(),
        code: regCode.toUpperCase().trim(),
        company_id: regCompanyId
      });
      showToast(isRtl ? 'تم تحديث الإقليم بنجاح' : 'Region updated successfully');
      setEditingRegion(null);
    } else {
      CustodyDB.addRegion(regName.trim(), regCode.toUpperCase().trim(), regCompanyId);
      showToast(isRtl ? 'تم إضافة الإقليم بنجاح' : 'Region added successfully');
    }
    setRegName('');
    setRegCode('');
    refreshData();
  };

  const startEditRegion = (r: Region) => {
    setEditingRegion(r);
    setRegName(r.name);
    setRegCode(r.code);
    setRegCompanyId(r.company_id);
  };

  const handleDeleteRegion = (id: string) => {
    if (confirm(isRtl ? 'هل تريد حذف هذا الإقليم بالتأكيد؟' : 'Are you sure you want to delete this region?')) {
      CustodyDB.deleteRegion(id);
      showToast(isRtl ? 'تم حذف الإقليم بنجاح' : 'Region deleted successfully');
      refreshData();
    }
  };

  // Station CRUD handlers
  const handleAddStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stnName.trim() || !stnCode.trim() || !stnCustody) return;
    const val = parseFloat(stnCustody);
    if (isNaN(val) || val <= 0) return;

    const rId = stnRegionId === 'none' || !stnRegionId ? undefined : stnRegionId;

    if (editingStation) {
      CustodyDB.updateStation(editingStation.id, {
        station_name: stnName.trim(),
        station_code: stnCode.toUpperCase().trim(),
        custody_amount: val,
        region_id: rId
      });
      showToast(isRtl ? 'تم تحديث المحطة بنجاح' : 'Station/Branch updated successfully');
      setEditingStation(null);
    } else {
      CustodyDB.addStation(stnName.trim(), stnCode.toUpperCase().trim(), val, rId, selectedCompanyId);
      showToast(isRtl ? 'تم إضافة المحطة بنجاح' : 'Station/Branch added successfully');
    }
    setStnName('');
    setStnCode('');
    setStnCustody('');
    setStnRegionId('');
    refreshData();
  };

  const startEditStation = (s: Station) => {
    setEditingStation(s);
    setStnName(s.station_name);
    setStnCode(s.station_code);
    setStnCustody(String(s.custody_amount));
    setStnRegionId(s.region_id || 'none');
  };

  const handleDeleteStation = (id: string) => {
    if (confirm(isRtl ? 'هل تريد حذف هذه المحطة بالتأكيد؟' : 'Are you sure you want to delete this station/branch?')) {
      CustodyDB.deleteStation(id);
      showToast(isRtl ? 'تم حذف المحطة بنجاح' : 'Station deleted successfully');
      refreshData();
    }
  };

  // Replenish Custody handler
  const handleRechargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargingStation || !rechargeAmount) return;
    const amountVal = parseFloat(rechargeAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert(isRtl ? 'يرجى إدخال مبلغ صحيح وموجب' : 'Please enter a valid positive amount.');
      return;
    }

    const currentCustody = rechargingStation.custody_amount;
    const nextCustody = currentCustody + amountVal;

    CustodyDB.updateStation(rechargingStation.id, {
      custody_amount: nextCustody
    });

    CustodyDB.addLog(
      activeUser?.id || 'unknown',
      activeUser?.full_name || 'Anonymous',
      'Custody Replenishment',
      `Replenished custody balance of ${rechargingStation.station_name} with +${amountVal.toLocaleString()} EGP (Total custody updated from ${currentCustody.toLocaleString()} to ${nextCustody.toLocaleString()} EGP). Notes: ${rechargeNotes || '-'}`
    );

    showToast(isRtl ? 'تم استعاضة وشحن رصيد العهدة للمحطة بنجاح!' : 'Custody replenished successfully!');
    setRechargingStation(null);
    setRechargeAmount('');
    setRechargeNotes('');
    refreshData();
  };

  // Filtering scoped entities
  const companyRegions = regions.filter(r => r.company_id === selectedCompanyId);
  const companyStations = stations.filter(s => s.company_id === selectedCompanyId);

  // Active stations shown in main grid
  const currentRegion = regions.find(r => r.id === selectedRegionId);
  const stationsToDisplay = companyStations.filter(s => {
    if (selectedRegionId === 'all') return true;
    if (selectedRegionId === 'none') return !s.region_id;
    return s.region_id === selectedRegionId;
  });

  const filteredStations = stationsToDisplay.filter(s => 
    s.station_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.station_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="stations-directory-container">
      {/* Toast banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-emerald-600 text-white shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isRtl ? 'دليل المحطات والعهد والعمليات' : 'Stations & Custody Hub'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isRtl 
              ? `عرض هيكل وتفاصيل عهد فروع: ${companies.find(c => c.id === selectedCompanyId)?.name || ''}`
              : `View hierarchy and custody details for: ${companies.find(c => c.id === selectedCompanyId)?.name || ''}`
            }
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setIsStructureOpen(!isStructureOpen)}
              className={`flex items-center gap-1.5 px-4 py-2 border rounded-lg font-bold text-xs transition-all shadow-sm ${
                isStructureOpen 
                  ? 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-500' 
                  : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200 border-slate-200'
              }`}
            >
              <Settings size={14} />
              <span>{isRtl ? 'إدارة الهيكل التنظيمي والمحطات' : 'Organization Structure Builder'}</span>
            </button>
          )}
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-xs transition-all hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
          >
            {isRtl ? <ArrowRight size={14} className="text-slate-500 dark:text-slate-400" /> : <ArrowLeft size={14} className="text-slate-500 dark:text-slate-400" />}
            <span>{isRtl ? 'لوحة المتابعة' : 'Dashboard Overview'}</span>
          </button>
        </div>
      </div>

      {/* STRUCTURE BUILDER CONTROL PANEL (Platform Admin / Company Admin only) */}
      {isAdmin && isStructureOpen && (
        <div className={`p-6 rounded-2xl border transition-all animate-fade-in ${
          theme === 'dark' ? 'bg-[#1e293b]/80 border-[#334155]' : 'bg-slate-50/50 border-slate-300'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b mb-4 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Layers className="text-indigo-600" size={18} />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {isRtl ? 'محرر الهيكل التنظيمي للشركة وفروعها والعهد' : 'Company Hierarchy & Branches Structural Editor'}
              </h3>
            </div>
            <button 
              onClick={() => setIsStructureOpen(false)}
              className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form tab switcher */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
            {isSystemAdmin && (
              <button
                onClick={() => setStructureTab('companies')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                  structureTab === 'companies' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
                }`}
              >
                {isRtl ? '1. الشركات والكيانات' : '1. Companies'}
              </button>
            )}
            <button
              onClick={() => setStructureTab('regions')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                structureTab === 'regions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
              }`}
            >
              {isRtl ? '2. قطاعات ومناطق جغرافية' : '2. Regions'}
            </button>
            <button
              onClick={() => setStructureTab('stations')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                structureTab === 'stations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
              }`}
            >
              {isRtl ? '3. المحطات والفروع العهدية' : '3. Stations & Branches'}
            </button>
          </div>

          {/* TAB 1: COMPANIES */}
          {structureTab === 'companies' && isSystemAdmin && (
            <div className="space-y-4">
              <form onSubmit={handleAddCompany} className="grid gap-3 sm:grid-cols-3 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'اسم الشركة *' : 'Company Name *'}</label>
                  <input
                    type="text"
                    required
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder={isRtl ? 'مثال: شركة النيل للصناعات' : 'e.g., Nile Industrial Co.'}
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'سقف العهدة الأساسي ج.م *' : 'Base Custody Ceiling EGP *'}</label>
                  <input
                    type="number"
                    required
                    value={compCustody}
                    onChange={(e) => setCompCustody(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{editingCompany ? (isRtl ? 'تحديث الشركة' : 'Update Company') : (isRtl ? 'إضافة الشركة للهيكل' : 'Add Company')}</span>
                </button>
              </form>

              <div className="overflow-x-auto border rounded-xl bg-white dark:bg-slate-900 mt-2">
                <table className="w-full text-xs text-left min-w-[500px]" dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">{isRtl ? 'الشركة' : 'Company'}</th>
                      <th className="p-3">{isRtl ? 'سقف العهدة ج.م' : 'Custody Ceiling'}</th>
                      <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {companies.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-slate-400">{c.id}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{c.name}</td>
                        <td className="p-3 font-mono">{c.custody_value.toLocaleString()} EGP</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => startEditCompany(c)} className="p-1 hover:bg-indigo-50 rounded text-indigo-600"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteCompany(c.id)} className="p-1 hover:bg-rose-50 rounded text-rose-500"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: REGIONS */}
          {structureTab === 'regions' && (
            <div className="space-y-4">
              <form onSubmit={handleAddRegion} className="grid gap-3 sm:grid-cols-4 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'اسم القطاع / المنطقة جغرافياً *' : 'Region Name *'}</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={isRtl ? 'مثال: قطاع الصعيد' : 'e.g., Upper Egypt Sector'}
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'رمز المنطقة المختصر *' : 'Region Code *'}</label>
                  <input
                    type="text"
                    required
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value)}
                    placeholder="e.g. UEG"
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
                {isSystemAdmin ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'الشركة التابعة *' : 'Affiliated Company *'}</label>
                    <select
                      value={regCompanyId}
                      onChange={(e) => setRegCompanyId(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{editingRegion ? (isRtl ? 'تحديث الإقليم' : 'Update Region') : (isRtl ? 'إضافة الإقليم' : 'Add Region')}</span>
                </button>
              </form>

              <div className="overflow-x-auto border rounded-xl bg-white dark:bg-slate-900 mt-2">
                <table className="w-full text-xs text-left min-w-[550px]" dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">{isRtl ? 'المنطقة' : 'Region'}</th>
                      <th className="p-3">{isRtl ? 'الكود المالي' : 'Region Code'}</th>
                      <th className="p-3">{isRtl ? 'الشركة التابعة' : 'Affiliated Company'}</th>
                      <th className="p-3 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {regions.filter(r => isSystemAdmin ? true : r.company_id === selectedCompanyId).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-slate-400">{r.id}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{r.name}</td>
                        <td className="p-3 font-mono font-bold text-indigo-600">{r.code}</td>
                        <td className="p-3 text-slate-500">{companies.find(c => c.id === r.company_id)?.name || r.company_id}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => startEditRegion(r)} className="p-1 hover:bg-indigo-50 rounded text-indigo-600"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteRegion(r.id)} className="p-1 hover:bg-rose-50 rounded text-rose-500"><Trash2 size={14} /></button>
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
            <div className="space-y-4">
              <form onSubmit={handleAddStation} className="grid gap-3 sm:grid-cols-4 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'اسم الفرع أو المحطة *' : 'Station/Branch Name *'}</label>
                  <input
                    type="text"
                    required
                    value={stnName}
                    onChange={(e) => setStnName(e.target.value)}
                    placeholder={isRtl ? 'مثال: محطة السادات 1' : 'e.g., Sadat Station 1'}
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'كود مركز التكلفة *' : 'Cost Center Code *'}</label>
                  <input
                    type="text"
                    required
                    value={stnCode}
                    onChange={(e) => setStnCode(e.target.value)}
                    placeholder="e.g. STN-SAD-01"
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'قيمة عهدة البداية ج.م *' : 'Starting Custody Amount EGP *'}</label>
                  <input
                    type="number"
                    required
                    value={stnCustody}
                    onChange={(e) => setStnCustody(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{isRtl ? 'المنطقة الجغرافية التابعة (اختياري) *' : 'Supervising Region (Optional) *'}</label>
                  <select
                    value={stnRegionId}
                    onChange={(e) => setStnRegionId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="none">{isRtl ? 'مباشر - بدون منطقة (Direct - No Region)' : 'Direct - No Region'}</option>
                    {companyRegions.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Plus size={14} />
                    <span>{editingStation ? (isRtl ? 'تحديث الفرع' : 'Update Branch/Station') : (isRtl ? 'إضافة فرع / محطة عهدة جديدة' : 'Add New Branch/Station')}</span>
                  </button>
                </div>
              </form>

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
                  <tbody className="divide-y">
                    {companyStations.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-slate-400">{s.id}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{s.station_name}</td>
                        <td className="p-3 font-mono font-bold text-emerald-600">{s.station_code}</td>
                        <td className="p-3 font-mono font-bold">{s.custody_amount.toLocaleString()} EGP</td>
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
                            <button onClick={() => startEditStation(s)} className="p-1 hover:bg-indigo-50 rounded text-indigo-600"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteStation(s.id)} className="p-1 hover:bg-rose-50 rounded text-rose-500"><Trash2 size={14} /></button>
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

      {/* Directory Search & Filters Bar */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center justify-between ${
        theme === 'dark' ? 'bg-[#1e293b]/40 border-[#334155]' : 'bg-white border-slate-200'
      }`}>
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={isRtl ? 'البحث باسم المحطة أو الكود...' : 'Search station name or code...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-emerald-500' 
                : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Company Switcher for SystemAdmin */}
          {isSystemAdmin && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-bold">{isRtl ? 'شركة العرض:' : 'Viewing Company:'}</span>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedCompanyId(id);
                  CustodyDB.setSelectedCompanyId(id);
                  // Auto select first region of new company
                  const compRegs = regions.filter(r => r.company_id === id);
                  setSelectedRegionId(compRegs[0]?.id || 'all');
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:outline-none"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Region Switcher */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-bold">{isRtl ? 'تصفية المنطقة:' : 'Filter Region:'}</span>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:outline-none"
            >
              <option value="all">{isRtl ? 'عرض الكل (جميع الفروع)' : 'Show All Branches'}</option>
              <option value="none">{isRtl ? 'فروع مباشرة (بدون منطقة)' : 'Direct Branches (No Region)'}</option>
              {companyRegions.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
            <Layers size={14} className="text-emerald-500" />
            <span>
              {isRtl 
                ? `تم العثور على: ${filteredStations.length} فرع / محطة`
                : `Found ${filteredStations.length} branch(es)`
              }
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Stations Cards (Desktop Layout & Responsive Board) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="stations-cards-grid">
        {filteredStations.map((station) => {
          const sMetrics = CustodyDB.getReconciliation(station.id);
          const stationTxs = allTransactions.filter(t => t.station_id === station.id);
          
          let lastActivityDate = isRtl ? 'لا توجد عمليات بعد' : 'No recent operations';
          if (stationTxs.length > 0) {
            const sorted = [...stationTxs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            lastActivityDate = sorted[0].date;
          }

          const percentAvailable = (sMetrics.cashAvailable / (station.custody_amount || 1)) * 100;

          return (
            <div 
              key={station.id} 
              className={`rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all group ${
                theme === 'dark' ? 'bg-[#1e293b]/50 border-[#334155]' : 'bg-white border-slate-200'
              }`}
            >
              {/* Card Header Banner */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
                      <Building size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {station.station_name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono tracking-wider text-slate-400 font-semibold uppercase">
                          {station.station_code}
                        </span>
                        {station.region_id ? (
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold rounded">
                            {regions.find(r => r.id === station.region_id)?.name}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-600 font-bold rounded">
                            {isRtl ? 'فرع مباشر' : 'Direct'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    station.is_active 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${station.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {station.is_active ? t.active : t.inactive}
                  </span>
                </div>
              </div>

              {/* Card Body Metrics */}
              <div className="p-5 space-y-4">
                {/* Available Liquid Cash Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">{t.cashAvailable}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {percentAvailable.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentAvailable < 20 
                          ? 'bg-rose-500' 
                          : percentAvailable < 50 
                            ? 'bg-amber-500' 
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, percentAvailable))}%` }}
                    />
                  </div>
                </div>

                {/* Grid values */}
                <div className="grid grid-cols-2 gap-3 text-xs border-y py-3 border-slate-100 dark:border-slate-800/80">
                  <div>
                    <p className="text-slate-400 mb-0.5">{t.totalCustody}</p>
                    <p className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {station.custody_amount.toLocaleString()} EGP
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">{t.cashAvailable}</p>
                    <p className="font-bold font-mono text-emerald-500">
                      {sMetrics.cashAvailable.toLocaleString()} EGP
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">{t.totalPending}</p>
                    <p className="font-bold font-mono text-amber-500">
                      {sMetrics.pendingTotal.toLocaleString()} EGP
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">{t.totalUnderSettlement}</p>
                    <p className="font-bold font-mono text-indigo-500">
                      {sMetrics.underSettlementTotal.toLocaleString()} EGP
                    </p>
                  </div>
                </div>

                {/* Extra Stats */}
                <div className="flex justify-between items-center text-[11px] text-slate-400 font-semibold font-mono">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{stationTxs.length} {isRtl ? 'حركات مسجلة' : 'records logged'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{lastActivityDate}</span>
                  </div>
                </div>
              </div>

              {/* Card CTA Actions footer */}
              <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                {canRecharge && (
                  <button
                    onClick={() => setRechargingStation(station)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-amber-600 hover:text-white bg-amber-50 hover:bg-amber-600 dark:bg-amber-500/10 dark:hover:bg-amber-600 rounded-lg transition-all"
                  >
                    <Coins size={13} />
                    <span>{isRtl ? 'استعاضة عهدة' : 'Replenish'}</span>
                  </button>
                )}
                <button
                  onClick={() => handleViewStation(station.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-500/10 dark:hover:bg-indigo-600 rounded-lg transition-all"
                >
                  <span>{t.viewDashboard}</span>
                  {isRtl ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* RECHARGE / CUSTODY REPLENISHMENT MODAL */}
      {rechargingStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl animate-fade-in ${
            theme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Coins className="text-amber-500 animate-pulse" size={18} />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {isRtl ? `شحن واستعاضة العهدة للمحطة: ${rechargingStation.station_name}` : `Replenish/Recharge Station Custody Balance`}
                </h3>
              </div>
              <button 
                onClick={() => setRechargingStation(null)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRechargeSubmit} className="space-y-4">
              <div className={`p-4 rounded-xl text-xs space-y-1.5 ${
                theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'
              }`}>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">{isRtl ? 'العهدة الحالية:' : 'Current Custody Limit:'}</span>
                  <span className="font-mono font-bold">{rechargingStation.custody_amount.toLocaleString()} EGP</span>
                </div>
                <div className="flex justify-between border-t pt-1.5">
                  <span className="text-slate-400 font-bold">{isRtl ? 'السيولة المتوفرة بالخزنة:' : 'Current Cash Safe Liquid:'}</span>
                  <span className="font-mono font-bold text-emerald-500">
                    {CustodyDB.getReconciliation(rechargingStation.id).cashAvailable.toLocaleString()} EGP
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {isRtl ? 'مبلغ الاستعاضة المراد إضافته (ج.م) *' : 'Replenishment Amount (EGP) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder={isRtl ? 'أدخل مبلغ الإضافة...' : 'e.g., 25000'}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {isRtl ? 'ملاحظات / مستندات شحن العهدة' : 'Recharge Documentation/Notes'}
                </label>
                <input
                  type="text"
                  value={rechargeNotes}
                  onChange={(e) => setRechargeNotes(e.target.value)}
                  placeholder={isRtl ? 'رقم شيك التغذية، السند المصرفي المرفق...' : 'Check number, bank transfer ID...'}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRechargingStation(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1"
                >
                  <Coins size={13} />
                  <span>{isRtl ? 'تأكيد شحن واستعاضة الرصيد' : 'Confirm Replenishment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
