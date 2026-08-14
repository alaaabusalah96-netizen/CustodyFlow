import React, { useState } from 'react';
import { ShieldAlert, ArrowRightLeft, MapPin, CheckCircle2, Clock, Truck, Sparkles } from 'lucide-react';
import { Vehicle, Trip } from '../types/fleet';
import { FleetBusinessEngine } from '../lib/enterprise/fleet_engine';

interface BreakdownReassignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  companyId: string;
  activeUserId: string;
  onReassigned: () => void;
  isRtl: boolean;
}

export default function BreakdownReassignmentModal({
  isOpen,
  onClose,
  vehicle,
  companyId,
  activeUserId,
  onReassigned,
  isRtl
}: BreakdownReassignmentModalProps) {
  if (!isOpen || !vehicle) return null;

  const affectedTrips = FleetBusinessEngine.getOpenTripsForVehicle(companyId, vehicle.id);
  const [selectedTripId, setSelectedTripId] = useState<string>(affectedTrips[0]?.id || '');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Target coordinates: use vehicle's last known location or first stop of selected trip
  const activeTrip = affectedTrips.find(t => t.id === selectedTripId) || affectedTrips[0];
  const targetCoords = (vehicle.last_known_location?.lat && vehicle.last_known_location?.lng)
    ? { lat: vehicle.last_known_location.lat, lng: vehicle.last_known_location.lng }
    : (activeTrip?.startLocation?.lat && activeTrip?.startLocation?.lng)
    ? { lat: activeTrip.startLocation.lat, lng: activeTrip.startLocation.lng }
    : { lat: 30.0444, lng: 31.2357 }; // Default HQ fallback

  const candidateVehicles = FleetBusinessEngine.suggestNearestVehiclesForTasks(
    companyId,
    targetCoords,
    vehicle.id
  );

  const handleExecuteReassign = async () => {
    if (!selectedTripId || !selectedVehicleId) return;
    try {
      setSubmitting(true);
      await FleetBusinessEngine.reassignTripVehicle(
        companyId,
        activeUserId,
        selectedTripId,
        selectedVehicleId,
        undefined,
        isRtl 
          ? `تعطل المركبة الأصلية (${vehicle.plateNumber}) وإعادة الإسناد لأقرب مركبة لتوفير السولار والوقت`
          : `Breakdown of original vehicle (${vehicle.plateNumber}) and reassigning to nearest available vehicle`
      );
      setSuccessMsg(isRtl ? 'تمت إعادة إسناد المشوار للمركبة البديلة بنجاح' : 'Trip reassigned to nearest vehicle successfully');
      setTimeout(() => {
        setSuccessMsg(null);
        onReassigned();
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {isRtl ? 'تعطل المركبة وإعادة توزيع المهام المفتوحة' : 'Vehicle Breakdown & Task Redistribution'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRtl ? 'اقتراح أقرب سيارات متاحة لتغطية المهام وتقليل استهلاك السولار وزمن الوصول' : 'Suggest nearest available vehicles to minimize time and fuel consumption.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* Breakdown vehicle summary */}
        <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-2xl flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
              {isRtl ? 'المركبة المتعطلة / خارج الخدمة' : 'Disabled Vehicle'}
            </span>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {vehicle.plateNumber} ({vehicle.make} {vehicle.model}) - <span className="font-mono text-rose-600">{vehicle.code}</span>
            </div>
            {vehicle.last_known_location && (
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-rose-500" />
                <span>
                  {isRtl ? 'آخر موقع مسجل:' : 'Last location:'} {vehicle.last_known_location.label || `${vehicle.last_known_location.lat.toFixed(3)}, ${vehicle.last_known_location.lng.toFixed(3)}`}
                </span>
              </div>
            )}
          </div>
          <div className="px-3 py-1 bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300">
            {affectedTrips.length} {isRtl ? 'مشاوير مفتوحة تتطلب تدخلاً' : 'Open trips affected'}
          </div>
        </div>

        {affectedTrips.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-medium">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            {isRtl ? 'لا توجد مشاوير أو مهام مفتوحة مسندة لهذه المركبة حالياً. لا حاجة لإعادة التوزيع.' : 'No active trips assigned to this vehicle. No redistribution needed.'}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Select Trip to reassign */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? '1. اختر المشوار المراد إعادة توزيعه:' : '1. Select trip to reassign:'}
              </label>
              <div className="space-y-2">
                {affectedTrips.map(trip => (
                  <label
                    key={trip.id}
                    className={`flex items-start justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      selectedTripId === trip.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="affectedTrip"
                        checked={selectedTripId === trip.id}
                        onChange={() => setSelectedTripId(trip.id)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {trip.tripType} - <span className="font-mono text-slate-500">{new Date(trip.scheduledAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {isRtl ? 'المهام:' : 'Tasks:'} {trip.stops.map(s => s.taskTitle || s.location.label).filter(Boolean).join(' ← ')}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                      {trip.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 2: Suggested Nearest Vehicles */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRtl ? '2. اقتراحات أقرب سيارات متاحة (مرتبة حسب المسافة وتوفير السولار):' : '2. Nearest available vehicles (sorted by distance & fuel economy):'}
                </label>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {isRtl ? 'حساب جغرافي ذكي' : 'Smart Distance Match'}
                </span>
              </div>

              {candidateVehicles.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl text-xs text-slate-500">
                  {isRtl ? 'لا توجد مركبات بديلة متاحة حالياً بالشركة.' : 'No alternative vehicles available.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {candidateVehicles.map((cand, idx) => {
                    const isNearest = idx === 0 && cand.distanceKm < 9999;
                    const isSelected = selectedVehicleId === cand.vehicle.id;

                    return (
                      <label
                        key={cand.vehicle.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="candidateVehicle"
                            checked={isSelected}
                            onChange={() => setSelectedVehicleId(cand.vehicle.id)}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {cand.vehicle.plateNumber} ({cand.vehicle.make} {cand.vehicle.model})
                              </span>
                              <span className="font-mono text-[10px] font-bold text-slate-500">
                                {cand.vehicle.code}
                              </span>
                              {isNearest && (
                                <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300">
                                  {isRtl ? 'الأقرب مسافة ⚡' : 'Nearest Match ⚡'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>{isRtl ? 'السائق:' : 'Driver:'} {cand.vehicle.driverName || '-'}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                {cand.lastLocationLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right rtl:text-left font-mono">
                          {cand.distanceKm < 9999 ? (
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200/60">
                              ~ {cand.distanceKm} KM
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {isRtl ? 'الموقع غير محدد' : 'Unknown loc'}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!selectedTripId || !selectedVehicleId || submitting}
                onClick={handleExecuteReassign}
                className="flex-1 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-sm flex items-center justify-center gap-1.5"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>{submitting ? (isRtl ? 'جاري التحويل...' : 'Reassigning...') : (isRtl ? 'إسناد للأقرب وتوفير السولار' : 'Reassign to Nearest Vehicle')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
