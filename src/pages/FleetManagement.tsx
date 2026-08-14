import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, Filter, Wrench, Fuel, ShieldAlert,
  Building2, Gauge, Calendar, User, FileText, CheckCircle2,
  MapPin, Navigation, Trash2, Map
} from 'lucide-react';
import { StorageEngine } from '../db/storage';
import { UsersModule } from '../db/users';
import { CompaniesModule } from '../db/companies';
import { LogsModule } from '../db/logs';
import { OrganizationEngine } from '../db/organizationEngine';
import OrgUnitTreeSelect from '../components/OrgUnitTreeSelect';
import LeafletMapPickerModal from '../components/LeafletMapPickerModal';
import { FleetBusinessEngine } from '../lib/enterprise/fleet_engine';
import { Vehicle, MaintenanceLog, FuelLog, VehicleType, VehicleStatus, Trip } from '../types/fleet';

interface FleetManagementProps {
  language: 'ar' | 'en';
  theme?: string;
}

export default function FleetManagement({ language }: FleetManagementProps) {
  const isRtl = language === 'ar';
  const companyId = CompaniesModule.getSelectedCompanyId() || 'comp-default';
  const activeUser = UsersModule.getActiveUser();

  const canCreateTrip = Boolean(
    activeUser?.permissions?.create_trip || 
    activeUser?.permissions?.manage_fleet || 
    activeUser?.role === 'SystemAdmin' ||
    activeUser?.role === 'Admin'
  );

  // Tabs
  const [activeTab, setActiveTab] = useState<'vehicles' | 'trips'>('vehicles');

  // State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [selectedOrgUnitFilter, setSelectedOrgUnitFilter] = useState<string>('ALL');

  // Modals
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showLogMaintenance, setShowLogMaintenance] = useState(false);
  const [showLogFuel, setShowLogFuel] = useState(false);
  const [selectedVehicleForLog, setSelectedVehicleForLog] = useState<Vehicle | null>(null);

  // Map Picker Modal
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [activeMapStopIndex, setActiveMapStopIndex] = useState<number | null>(null);

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

  const [tripForm, setTripForm] = useState({
    vehicle_id: '',
    driver_id: '',
    tripType: '',
    scheduledAt: new Date().toISOString().slice(0, 16),
    notes: '',
    stops: [
      { id: 'stop-1', label: '', org_unit_id: '', lat: undefined as number | undefined, lng: undefined as number | undefined },
      { id: 'stop-2', label: '', org_unit_id: '', lat: undefined as number | undefined, lng: undefined as number | undefined },
    ]
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

  if (!activeUser?.permissions?.manage_fleet) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
          {isRtl ? 'غير مصرح لك بالوصول لهذه الصفحة' : 'Unauthorized Access'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isRtl
            ? 'عذراً، لا تمتلك صلاحية إدارة الأسطول والمركبات (manage_fleet) للوصول لهذه الشاشة.'
            : 'Sorry, you do not have permission to access Fleet Management.'}
        </p>
      </div>
    );
  }

  const loadData = () => {
    const units = OrganizationEngine.getUnits(companyId);
    setOrgUnits(units);

    const loadedUsers = UsersModule.getUsers().filter(u => u.is_active);
    setUsers(loadedUsers);

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
    setTrips(FleetBusinessEngine.getTripsByCompany(companyId));
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

  const handleAddStopRow = () => {
    setTripForm(prev => ({
      ...prev,
      stops: [
        ...prev.stops,
        {
          id: `stop-${Date.now()}-${prev.stops.length + 1}`,
          label: '',
          org_unit_id: '',
          lat: undefined,
          lng: undefined
        }
      ]
    }));
  };

  const handleRemoveStopRow = (index: number) => {
    if (tripForm.stops.length <= 2) return;
    setTripForm(prev => ({
      ...prev,
      stops: prev.stops.filter((_, idx) => idx !== index)
    }));
  };

  const handleStopLabelChange = (index: number, value: string) => {
    const matchedUnit = orgUnits.find(u => 
      `${u.code} - ${u.name}` === value ||
      u.name === value ||
      u.code === value
    );

    setTripForm(prev => {
      const nextStops = [...prev.stops];
      nextStops[index] = {
        ...nextStops[index],
        label: value,
        org_unit_id: matchedUnit ? matchedUnit.id : ''
      };
      return { ...prev, stops: nextStops };
    });
  };

  const handleOpenMapPicker = (index: number) => {
    setActiveMapStopIndex(index);
    setMapModalOpen(true);
  };

  const handleConfirmMapCoords = (coords: { lat: number; lng: number }) => {
    if (activeMapStopIndex !== null) {
      setTripForm(prev => {
        const nextStops = [...prev.stops];
        const current = nextStops[activeMapStopIndex];
        nextStops[activeMapStopIndex] = {
          ...current,
          lat: coords.lat,
          lng: coords.lng,
          label: current.label || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
        };
        return { ...prev, stops: nextStops };
      });
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTrip) {
      showToast('error', isRtl ? 'غير مصرح لك بإنشاء مشوار' : 'Unauthorized to create trip');
      return;
    }

    if (!tripForm.vehicle_id || !tripForm.driver_id || !tripForm.tripType) {
      showToast('error', isRtl ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    if (tripForm.stops.length < 2) {
      showToast('error', isRtl ? 'يجب تحديد نقطتين على الأقل لخط السير' : 'At least 2 stops are required for the route');
      return;
    }

    const hasEmptyStop = tripForm.stops.some(s => !s.label.trim() && (s.lat === undefined || s.lng === undefined));
    if (hasEmptyStop) {
      showToast('error', isRtl ? 'يرجى إدخال اسم أو تحديد موقع لكل محطة في خط السير' : 'Please specify a name or map location for each stop');
      return;
    }

    try {
      const stopsData = tripForm.stops.map((s, idx) => ({
        id: s.id,
        sequence: idx + 1,
        location: {
          org_unit_id: s.org_unit_id || undefined,
          label: s.label.trim() || `${s.lat?.toFixed(4)}, ${s.lng?.toFixed(4)}`,
          lat: s.lat,
          lng: s.lng
        },
        status: 'PENDING' as const
      }));

      await FleetBusinessEngine.createTrip(companyId, activeUser?.id || 'system', {
        vehicle_id: tripForm.vehicle_id,
        driver_id: tripForm.driver_id,
        tripType: tripForm.tripType,
        scheduledAt: tripForm.scheduledAt,
        notes: tripForm.notes,
        stops: stopsData,
        org_unit_id: stopsData[0]?.location.org_unit_id
      });

      showToast('success', isRtl ? 'تم تسجيل المشوار بصفة مسودة (DRAFT) بنجاح' : 'Trip recorded in DRAFT status successfully');
      setTripForm({
        vehicle_id: '',
        driver_id: '',
        tripType: '',
        scheduledAt: new Date().toISOString().slice(0, 16),
        notes: '',
        stops: [
          { id: 'stop-1', label: '', org_unit_id: '', lat: undefined, lng: undefined },
          { id: 'stop-2', label: '', org_unit_id: '', lat: undefined, lng: undefined },
        ]
      });
      setShowAddTrip(false);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('error', isRtl ? 'حدث خطأ أثناء تسجيل المشوار' : 'Error creating trip');
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

      showToast('success', isRtl ? 'تم تسجيل الصيانة بنجاح' : 'Maintenance logged successfully');
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

      showToast('success', isRtl ? 'تم تسجيل الوقود بنجاح' : 'Fuel logged successfully');
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
              {isRtl ? 'متابعة سيارات وشاحنات الشركة، المصاريف، الوقود، والمشاوير المرتبطة بالهياكل التنظيمية' : 'Manage corporate fleet vehicles, maintenance logs, fuel expenses, and trips.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'vehicles' && activeUser?.permissions?.manage_fleet && (
            <button
              onClick={() => setShowAddVehicle(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>{isRtl ? 'إضافة مركبة للأسطول' : 'Register Vehicle'}</span>
            </button>
          )}

          {canCreateTrip && (
            <button
              onClick={() => setShowAddTrip(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>{isRtl ? 'إنشاء مشوار جديد' : 'Create Trip'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'vehicles'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>{isRtl ? 'المركبات والأسطول' : 'Vehicles'}</span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'trips'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Navigation className="h-4 w-4" />
          <span>{isRtl ? 'المشاوير' : 'Trips'}</span>
        </button>
      </div>

      {/* Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <>
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
        </>
      )}

      {/* Trips Tab */}
      {activeTab === 'trips' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Navigation className="h-4 w-4 text-indigo-600" />
              <span>{isRtl ? 'جدول المشاوير والرحلات' : 'Trips Schedule'}</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono font-bold">
              {trips.length} {isRtl ? 'مشوار مسجل' : 'trips'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{isRtl ? 'المركبة' : 'Vehicle'}</th>
                  <th className="p-3">{isRtl ? 'السائق' : 'Driver'}</th>
                  <th className="p-3">{isRtl ? 'خط السير (المحطات)' : 'Route (Stops)'}</th>
                  <th className="p-3">{isRtl ? 'نوع المشوار' : 'Trip Type'}</th>
                  <th className="p-3">{isRtl ? 'الموعد المجدول' : 'Scheduled At'}</th>
                  <th className="p-3">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="p-3">{isRtl ? 'ملاحظات' : 'Notes'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                      {isRtl ? 'لا توجد مشاوير مسجلة حالياً.' : 'No trips recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  trips.map((t, idx) => {
                    const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                    const driver = users.find(u => u.id === t.driver_id);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          {vehicle ? `${vehicle.plateNumber} (${vehicle.make})` : t.vehicle_id}
                        </td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                          {driver ? driver.full_name : t.driver_id}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {t.stops && t.stops.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-slate-500">
                                {isRtl ? 'من' : 'From'}
                              </span>
                              {t.stops.map((stop, sIdx) => {
                                const isFirst = sIdx === 0;
                                const isLast = sIdx === t.stops.length - 1;
                                const stopLabel =
                                  stop.location.label ||
                                  orgUnits.find(u => u.id === stop.location.org_unit_id)?.name ||
                                  stop.location.org_unit_id ||
                                  (stop.location.lat ? `${stop.location.lat.toFixed(3)}, ${stop.location.lng?.toFixed(3)}` : `Stop ${sIdx + 1}`);

                                return (
                                  <React.Fragment key={stop.id || sIdx}>
                                    {sIdx > 0 && <span className="text-slate-400 font-bold text-xs">←</span>}
                                    <span
                                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                        isFirst
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/60'
                                          : isLast
                                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800/60'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                      }`}
                                    >
                                      {stopLabel}
                                    </span>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400">
                          {t.tripType}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {t.scheduledAt ? new Date(t.scheduledAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US') : '-'}
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                            {t.status === 'DRAFT' ? (isRtl ? 'مسودة (DRAFT)' : 'DRAFT') : t.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-[11px]">
                          {t.notes || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <OrgUnitTreeSelect
                  label={isRtl ? 'الوحدة التنظيمية / الفرع / الموقع' : 'Organization Unit / Branch'}
                  value={formOrgUnitId}
                  onChange={(id) => setFormOrgUnitId(id)}
                  placeholder={isRtl ? '-- افتراضي (حسب صلاحية المستخدم) --' : '-- Default (User Scope) --'}
                  companyId={companyId}
                  isRtl={isRtl}
                  theme={undefined}
                  showInheritanceSummary={false}
                />
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

      {/* Create Trip Modal */}
      {showAddTrip && canCreateTrip && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Navigation className="h-5 w-5 text-emerald-600" />
                <span>{isRtl ? 'إنشاء مشوار جديد (مسودة)' : 'Create New Trip (DRAFT)'}</span>
              </h3>
              <button onClick={() => setShowAddTrip(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isRtl ? 'اختر المركبة *' : 'Select Vehicle *'}
                  </label>
                  <select
                    value={tripForm.vehicle_id}
                    onChange={(e) => setTripForm({ ...tripForm, vehicle_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">{isRtl ? '-- اختر مركبة --' : '-- Select Vehicle --'}</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} ({v.make} {v.model})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isRtl ? 'اختر السائق *' : 'Select Driver *'}
                  </label>
                  <select
                    value={tripForm.driver_id}
                    onChange={(e) => setTripForm({ ...tripForm, driver_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">{isRtl ? '-- اختر سائق --' : '-- Select Driver --'}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Multi-stop Route Section */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isRtl ? 'محطات خط السير *' : 'Route Stops *'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStopRow}
                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isRtl ? '+ إضافة نقطة' : '+ Add Stop'}</span>
                  </button>
                </div>

                <datalist id="fleet-org-units-list">
                  {orgUnits.map(u => (
                    <option key={u.id} value={`${u.code} - ${u.name}`} />
                  ))}
                </datalist>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {tripForm.stops.map((stop, sIdx) => {
                    const isFirst = sIdx === 0;
                    const isLast = sIdx === tripForm.stops.length - 1;
                    const stopTitle = isFirst
                      ? (isRtl ? 'نقطة الانطلاق (المصدر)' : 'Departure / Origin')
                      : isLast
                      ? (isRtl ? 'نقطة الوصول (الوجهة)' : 'Destination / Arrival')
                      : (isRtl ? `نقطة وسيطة (${sIdx + 1})` : `Stop (${sIdx + 1})`);

                    return (
                      <div
                        key={stop.id || sIdx}
                        className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                      >
                        <span className={`px-2 py-1 text-[10px] font-black rounded-md ${
                          isFirst ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                          isLast ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          #{sIdx + 1}
                        </span>

                        <div className="flex-1 relative">
                          <input
                            type="text"
                            list="fleet-org-units-list"
                            value={stop.label}
                            onChange={(e) => handleStopLabelChange(sIdx, e.target.value)}
                            placeholder={stopTitle}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                          />
                          {stop.lat !== undefined && stop.lng !== undefined && (
                            <span className="absolute left-2 rtl:left-2 rtl:right-auto ltr:right-2 top-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 pointer-events-none">
                              📍 {stop.lat.toFixed(3)}, {stop.lng.toFixed(3)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenMapPicker(sIdx)}
                          title={isRtl ? 'اختار من الخريطة' : 'Select from Map'}
                          className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                            stop.lat !== undefined
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <Map className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline text-[10px]">
                            {isRtl ? 'الخريطة' : 'Map'}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={tripForm.stops.length <= 2}
                          onClick={() => handleRemoveStopRow(sIdx)}
                          title={isRtl ? 'حذف هذه النقطة' : 'Remove Stop'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isRtl ? 'نوع المشوار *' : 'Trip Type *'}
                  </label>
                  <input
                    type="text"
                    value={tripForm.tripType}
                    onChange={(e) => setTripForm({ ...tripForm, tripType: e.target.value })}
                    required
                    placeholder={isRtl ? 'مثال: نقل بضائع / صيانة خارجية / مهمة عمل' : 'e.g. Freight / Cargo / Patrol'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isRtl ? 'الموعد المجدول *' : 'Scheduled At *'}
                  </label>
                  <input
                    type="datetime-local"
                    value={tripForm.scheduledAt}
                    onChange={(e) => setTripForm({ ...tripForm, scheduledAt: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isRtl ? 'ملاحظات إضافية' : 'Additional Notes'}
                </label>
                <input
                  type="text"
                  value={tripForm.notes}
                  onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
                  placeholder={isRtl ? 'أي تفاصيل خاصة بالمشوار...' : 'Any additional notes...'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTrip(false)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                >
                  {isRtl ? 'حفظ بصفة مسودة' : 'Save Draft Trip'}
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
                  {isRtl ? 'حفظ واعتماد الصيانة' : 'Save Maintenance'}
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
                  {isRtl ? 'حفظ واعتماد الوقود' : 'Save Fuel Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leaflet Map Picker Modal */}
      <LeafletMapPickerModal
        isOpen={mapModalOpen}
        onClose={() => {
          setMapModalOpen(false);
          setActiveMapStopIndex(null);
        }}
        onConfirm={handleConfirmMapCoords}
        initialLat={activeMapStopIndex !== null ? tripForm.stops[activeMapStopIndex]?.lat : undefined}
        initialLng={activeMapStopIndex !== null ? tripForm.stops[activeMapStopIndex]?.lng : undefined}
        stopLabel={activeMapStopIndex !== null ? tripForm.stops[activeMapStopIndex]?.label : undefined}
        isRtl={isRtl}
      />
    </div>
  );
}
