import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, Filter, Wrench, Fuel, ShieldAlert,
  Building2, Gauge, Calendar, User, FileText, CheckCircle2
} from 'lucide-react';
import { StorageEngine } from '../db/storage';
import { UsersModule } from '../db/users';
import { CompaniesModule } from '../db/companies';
import { LogsModule } from '../db/logs';
import { OrganizationEngine } from '../db/organizationEngine';
import { FleetBusinessEngine } from '../lib/enterprise/fleet_engine';
import { Vehicle, MaintenanceLog, FuelLog, VehicleType, VehicleStatus } from '../types/fleet';

interface FleetManagementProps {
  language: 'ar' | 'en';
  theme?: string;
}

export default function FleetManagement({ language }: FleetManagementProps) {
  const isRtl = language === 'ar';
  const companyId = CompaniesModule.getSelectedCompanyId() || 'comp-default';
  const activeUser = UsersModule.getActiveUser();

  // State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [selectedOrgUnitFilter, setSelectedOrgUnitFilter] = useState<string>('ALL');

  // Modals
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showLogMaintenance, setShowLogMaintenance] = useState(false);
  const [showLogFuel, setShowLogFuel] = useState(false);
  const [selectedVehicleForLog, setSelectedVehicleForLog] = useState<Vehicle | null>(null);

  // Forms
  const [formOrgUnitId, setFormOrgUnitId] = useState<string>('');
  const [vehicleForm, setVehicleForm] = useState({
    plateNumber: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    type: 'TRUCK' as VehicleType,
    driverName: '',
    odometerReading: 0,
    fuelCapacity: 100
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenanceDate: new Date().toISOString().split('T')[0],
    type: 'ROUTINE' as 'ROUTINE' | 'REPAIR' | 'OIL_CHANGE' | 'TIRES' | 'INSPECTION',
    description: '',
    cost: 0,
    providerName: '',
    odometerAtService: 0
  });

  const [fuelForm, setFuelForm] = useState({
    logDate: new Date().toISOString().split('T')[0],
    liters: 0,
    costPerLiter: 15,
    odometerReading: 0
  });

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = () => {
    const units = OrganizationEngine.getUnits(companyId);
    setOrgUnits(units);

    const loadedVehicles = FleetBusinessEngine.getVehiclesByOrgUnit(companyId, selectedOrgUnitFilter);

    if (loadedVehicles.length === 0 && selectedOrgUnitFilter === 'ALL') {
      // Seed default vehicles if empty
      const defaults: Vehicle[] = [
        {
          id: 'veh-001',
          company_id: companyId,
          code: 'FLT-101',
          plateNumber: 'أ ب ج 1234',
          make: 'Mercedes-Benz',
          model: 'Actros 1842',
          year: 2022,
          type: 'TRUCK',
          status: 'ACTIVE',
          driverName: 'أحمد محمود العبد',
          odometerReading: 45000,
          fuelCapacity: 300,
          createdAt: new Date().toISOString()
        },
        {
          id: 'veh-002',
          company_id: companyId,
          code: 'FLT-102',
          plateNumber: 'س ص ع 5678',
          make: 'Toyota',
          model: 'Hilux Pickup',
          year: 2023,
          type: 'PICKUP',
          status: 'ACTIVE',
          driverName: 'محمود السيد حسن',
          odometerReading: 18500,
          fuelCapacity: 80,
          createdAt: new Date().toISOString()
        }
      ];
      StorageEngine.setStored('fleet_vehicles_items', defaults);
      setVehicles(defaults);
    } else {
      setVehicles(loadedVehicles);
    }

    setMaintenanceLogs(StorageEngine.getStored<MaintenanceLog[]>('fleet_maintenance_logs', []).filter(l => l.company_id === companyId));
    setFuelLogs(StorageEngine.getStored<FuelLog[]>('fleet_fuel_logs', []).filter(l => l.company_id === companyId));
  };

  useEffect(() => {
    loadData();
    const onUpdate = () => loadData();
    window.addEventListener('custody_db_updated', onUpdate);
    return () => window.removeEventListener('custody_db_updated', onUpdate);
  }, [companyId, selectedOrgUnitFilter]);

  // Handlers
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.plateNumber || !vehicleForm.make) {
      showToast('error', isRtl ? 'يرجى إدخال رقم اللوحة والماركة' : 'Please input plate number and make');
      return;
    }

    try {
      const created = await FleetBusinessEngine.createVehicle(companyId, {
        plateNumber: vehicleForm.plateNumber,
        make: vehicleForm.make,
        model: vehicleForm.model,
        year: vehicleForm.year,
        type: vehicleForm.type,
        driverName: vehicleForm.driverName,
        odometerReading: vehicleForm.odometerReading,
        fuelCapacity: vehicleForm.fuelCapacity,
        org_unit_id: formOrgUnitId || activeUser?.org_unit_id
      });

      LogsModule.addLog(
        activeUser?.id || 'system',
        activeUser?.full_name || 'System',
        isRtl ? 'تسجيل مركبة أسطول' : 'Register Fleet Vehicle',
        `Registered vehicle ${created.make} (${created.plateNumber}) with code ${created.code}`
      );

      showToast('success', isRtl ? 'تم تسجيل المركبة بنجاح' : 'Vehicle registered successfully');
      setVehicleForm({
        plateNumber: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        type: 'TRUCK',
        driverName: '',
        odometerReading: 0,
        fuelCapacity: 100
      });
      setFormOrgUnitId('');
      setShowAddVehicle(false);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('error', isRtl ? 'حدث خطأ أثناء تسجيل المركبة' : 'Error registering vehicle');
    }
  };

  const handleLogMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForLog) return;

    try {
      await FleetBusinessEngine.logMaintenance(companyId, activeUser?.id || 'system', {
        vehicle_id: selectedVehicleForLog.id,
        maintenanceDate: maintenanceForm.maintenanceDate,
        type: maintenanceForm.type,
        description: maintenanceForm.description,
        cost: maintenanceForm.cost,
        providerName: maintenanceForm.providerName,
        odometerAtService: maintenanceForm.odometerAtService || selectedVehicleForLog.odometerReading,
        org_unit_id: selectedVehicleForLog.org_unit_id
      });

      showToast('success', isRtl ? 'تم تسجيل الصيانة وتسييل القيد المالي بنجاح' : 'Maintenance logged & GL entry posted');
      setShowLogMaintenance(false);
      setSelectedVehicleForLog(null);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('error', isRtl ? 'حدث خطأ أثناء تسجيل الصيانة' : 'Error logging maintenance');
    }
  };

  const handleLogFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForLog) return;

    try {
      await FleetBusinessEngine.logFuel(companyId, activeUser?.id || 'system', {
        vehicle_id: selectedVehicleForLog.id,
        logDate: fuelForm.logDate,
        liters: fuelForm.liters,
        costPerLiter: fuelForm.costPerLiter,
        odometerReading: fuelForm.odometerReading || selectedVehicleForLog.odometerReading,
        org_unit_id: selectedVehicleForLog.org_unit_id
      });

      showToast('success', isRtl ? 'تم تسجيل الوقود وتسييل القيد المالي بنجاح' : 'Fuel logged & GL entry posted');
      setShowLogFuel(false);
      setSelectedVehicleForLog(null);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('error', isRtl ? 'حدث خطأ أثناء تسجيل الوقود' : 'Error logging fuel');
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (v.driverName && v.driverName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || v.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200' 
            : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
        }`}>
          <CheckCircle2 className="h-4 w-4" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {isRtl ? 'إدارة الأسطول والحركة والنقل' : 'Fleet & Transportation Management'}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl ? 'متابعة سيارات وشاحنات الشركة، المصاريف، الوقود، والصيانة المرتبطة بالهياكل التنظيمية' : 'Manage corporate fleet vehicles, maintenance logs, fuel expenses tied to org units.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddVehicle(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>{isRtl ? 'إضافة مركبة للأسطول' : 'Register Vehicle'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 rtl:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRtl ? 'ابحث برقم اللوحة، الماركة، السائق، الكود...' : 'Search plate, make, driver, code...'}
            className="w-full pl-9 pr-9 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedOrgUnitFilter}
              onChange={(e) => setSelectedOrgUnitFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="ALL">{isRtl ? 'جميع الهياكل التنظيمية' : 'All Org Units'}</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
              ))}
            </select>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 focus:outline-none"
          >
            <option value="ALL">{isRtl ? 'جميع أنواع المركبات' : 'All Vehicle Types'}</option>
            <option value="TRUCK">{isRtl ? 'شاحنات نقل ثقيل' : 'Trucks'}</option>
            <option value="PICKUP">{isRtl ? 'سيارات نقل خفيف (بيك آب)' : 'Pickups'}</option>
            <option value="VAN">{isRtl ? 'فانات وتوزيع' : 'Vans'}</option>
            <option value="CAR">{isRtl ? 'سيارات ملاكي وموظفين' : 'Passenger Cars'}</option>
            <option value="HEAVY_EQUIPMENT">{isRtl ? 'معدات ثقيلة ورافعات' : 'Heavy Equipment'}</option>
          </select>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map(v => (
          <div key={v.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                    {v.code}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-md">
                    {v.type}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                  {v.make} {v.model} ({v.year})
                </h3>
                <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {v.plateNumber}
                </p>
                {v.org_unit_id && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    <Building2 className="h-3 w-3" />
                    <span>{orgUnits.find(u => u.id === v.org_unit_id)?.name || v.org_unit_id}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">{isRtl ? 'السائق المسؤول' : 'Assigned Driver'}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{v.driverName || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">{isRtl ? 'عدّاد الكيلومترات' : 'Odometer (KM)'}</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{v.odometerReading.toLocaleString()} KM</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                onClick={() => {
                  setSelectedVehicleForLog(v);
                  setShowLogFuel(true);
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-100 transition-all"
              >
                <Fuel className="h-3.5 w-3.5" />
                <span>{isRtl ? 'تموين وقود' : 'Fuel Refill'}</span>
              </button>

              <button
                onClick={() => {
                  setSelectedVehicleForLog(v);
                  setShowLogMaintenance(true);
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 transition-all"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>{isRtl ? 'تسجيل صيانة' : 'Maintenance'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {isRtl ? 'تسجيل مركبة جديدة بالأسطول' : 'Register New Fleet Vehicle'}
              </h3>
              <button onClick={() => setShowAddVehicle(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isRtl ? 'الوحدة التنظيمية / الفرع / الموقع' : 'Organization Unit / Branch'}
                </label>
                <select
                  value={formOrgUnitId}
                  onChange={(e) => setFormOrgUnitId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                >
                  <option value="">{isRtl ? '-- افتراضي (حسب صلاحية المستخدم) --' : '-- Default (User Scope) --'}</option>
                  {orgUnits.map((u) => (
                    <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'رقم اللوحة المعدنية *' : 'Plate Number *'}</label>
                  <input
                    type="text"
                    value={vehicleForm.plateNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
                    required
                    placeholder="e.g. أ ب ج 1234"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'نوع المركبة' : 'Vehicle Type'}</label>
                  <select
                    value={vehicleForm.type}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="TRUCK">شاحنة نقل</option>
                    <option value="PICKUP">بيك آب / نصف نقل</option>
                    <option value="VAN">فان توزيع</option>
                    <option value="CAR">سيارة ركوب</option>
                    <option value="HEAVY_EQUIPMENT">معدات ثقيلة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'الماركة المصنعة *' : 'Make *'}</label>
                  <input
                    type="text"
                    value={vehicleForm.make}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                    required
                    placeholder="e.g. Mercedes, Toyota"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'الموديل وسنة الصنع' : 'Model & Year'}</label>
                  <input
                    type="text"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    placeholder="e.g. Actros 1842"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'اسم السائق المكلّف' : 'Driver Name'}</label>
                  <input
                    type="text"
                    value={vehicleForm.driverName}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'قراءة الكيلومترات الحالية' : 'Current Odometer (KM)'}</label>
                  <input
                    type="number"
                    value={vehicleForm.odometerReading}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, odometerReading: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                >
                  {isRtl ? 'حفظ وتأكيد' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Maintenance Modal */}
      {showLogMaintenance && selectedVehicleForLog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {isRtl ? `تسجيل صيانة: ${selectedVehicleForLog.plateNumber}` : `Log Maintenance: ${selectedVehicleForLog.plateNumber}`}
              </h3>
              <button onClick={() => setShowLogMaintenance(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleLogMaintenance} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'نوع الصيانة' : 'Maintenance Type'}</label>
                <select
                  value={maintenanceForm.type}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="ROUTINE">صيانة دورية</option>
                  <option value="OIL_CHANGE">تغيير زيوت وفلاتر</option>
                  <option value="TIRES">تغيير إطارات وبطاريات</option>
                  <option value="REPAIR">إصلاح أعطال مفاجئة</option>
                  <option value="INSPECTION">فحص وفحص فني</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'وصف الصيانة والإصلاح' : 'Description'}</label>
                <input
                  type="text"
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                  required
                  placeholder="e.g. تغيير زيت المحرك 10,000 كم وفلتر الزيت"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'التكلفة الإجمالية (ج.م)' : 'Cost (EGP)'}</label>
                  <input
                    type="number"
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'الكيلومترات عند الخدمة' : 'Odometer Reading'}</label>
                  <input
                    type="number"
                    value={maintenanceForm.odometerAtService || selectedVehicleForLog.odometerReading}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, odometerAtService: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogMaintenance(false)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                >
                  {isRtl ? 'حفظ وتسييل القيد' : 'Post Maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Fuel Modal */}
      {showLogFuel && selectedVehicleForLog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {isRtl ? `تسجيل وقود: ${selectedVehicleForLog.plateNumber}` : `Fuel Refill: ${selectedVehicleForLog.plateNumber}`}
              </h3>
              <button onClick={() => setShowLogFuel(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleLogFuel} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'كمية اللترات' : 'Liters'}</label>
                  <input
                    type="number"
                    value={fuelForm.liters}
                    onChange={(e) => setFuelForm({ ...fuelForm, liters: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'سعر اللتر (ج.م)' : 'Price / Liter'}</label>
                  <input
                    type="number"
                    value={fuelForm.costPerLiter}
                    onChange={(e) => setFuelForm({ ...fuelForm, costPerLiter: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-200/50 flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-200">
                <span>{isRtl ? 'التكلفة الإجمالية' : 'Total Fuel Cost'}:</span>
                <span className="font-mono text-sm">{(fuelForm.liters * fuelForm.costPerLiter).toLocaleString()} EGP</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{isRtl ? 'الكيلومترات عند التموين' : 'Odometer Reading'}</label>
                <input
                  type="number"
                  value={fuelForm.odometerReading || selectedVehicleForLog.odometerReading}
                  onChange={(e) => setFuelForm({ ...fuelForm, odometerReading: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogFuel(false)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                >
                  {isRtl ? 'حفظ وتسييل قيد الوقود' : 'Post Fuel Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
