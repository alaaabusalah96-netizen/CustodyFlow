import React, { useState } from 'react';
import { ShieldAlert, ArrowRightLeft, MapPin, CheckCircle2, Clock, Truck, Sparkles, PauseCircle, HelpCircle, Calendar, User } from 'lucide-react';
import { Vehicle, Trip, BreakdownDecisionType } from '../types/fleet';
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
  const allVehicles = FleetBusinessEngine.getVehiclesByOrgUnit(companyId);

  // State per trip decision
  const [selectedTripId, setSelectedTripId] = useState<string>(affectedTrips[0]?.id || '');
  const [decisionType, setDecisionType] = useState<BreakdownDecisionType>('REASSIGN');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');
  const [postponeUntil, setPostponeUntil] = useState<string>(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return tmrw.toISOString().slice(0, 16);
  });
  const [customReason, setCustomReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Target coordinates for proximity calculation
  const activeTrip = affectedTrips.find(t => t.id === selectedTripId) || affectedTrips[0];
  const targetCoords = (vehicle.last_known_location?.lat && vehicle.last_known_location?.lng)
    ? { lat: vehicle.last_known_location.lat, lng: vehicle.last_known_location.lng }
    : (activeTrip?.startLocation?.lat && activeTrip?.startLocation?.lng)
    ? { lat: activeTrip.startLocation.lat, lng: activeTrip.startLocation.lng }
    : { lat: 30.0444, lng: 31.2357 };

  const candidateVehicles = FleetBusinessEngine.suggestNearestVehiclesForTasks(
    companyId,
    targetCoords,
    vehicle.id
  );

  const selectedTargetVehicle = allVehicles.find(v => v.id === selectedVehicleId);

  const handleVehicleSelect = (vehId: string) => {
    setSelectedVehicleId(vehId);
    const v = allVehicles.find(item => item.id === vehId);
    if (v?.driverName) {
      setSelectedDriverName(v.driverName);
    } else if (activeTrip?.driver_id) {
      setSelectedDriverName(activeTrip.driver_id);
    }
  };

  const handleExecuteDecision = async () => {
    if (!selectedTripId) return;
    if (decisionType === 'REASSIGN' && !selectedVehicleId) return;

    try {
      setSubmitting(true);
      const defaultReason = decisionType === 'REASSIGN'
        ? (isRtl ? `تعطل المركبة (${vehicle.plateNumber}) وإعادة الإسناد للمركبة (${selectedTargetVehicle?.plateNumber || selectedVehicleId})` : `Vehicle breakdown (${vehicle.plateNumber}) reassigned to ${selectedTargetVehicle?.plateNumber || selectedVehicleId}`)
        : decisionType === 'POSTPONE'
        ? (isRtl ? `تأجيل المشوار نظراً لتعطل المركبة (${vehicle.plateNumber})` : `Trip postponed due to breakdown of vehicle ${vehicle.plateNumber}`)
        : (isRtl ? `تعليق المشوار بانتظار قرار لاحق بعد تعطل المركبة (${vehicle.plateNumber})` : `Trip suspended pending future decision`);

      await FleetBusinessEngine.executeBreakdownDecision(
        companyId,
        activeUserId,
        {
          tripId: selectedTripId,
          decision: decisionType,
          fromVehicleId: vehicle.id,
          toVehicleId: decisionType === 'REASSIGN' ? selectedVehicleId : undefined,
          toDriverId: decisionType === 'REASSIGN' ? (selectedDriverName || selectedTargetVehicle?.driverName || activeTrip?.driver_id) : undefined,
          reason: customReason.trim() || defaultReason,
          postponedUntil: decisionType === 'POSTPONE' ? postponeUntil : undefined
        }
      );

      const msg = decisionType === 'REASSIGN'
        ? (isRtl ? 'تمت إعادة إسناد المشوار للمركبة البديلة بنجاح' : 'Trip successfully reassigned')
        : decisionType === 'POSTPONE'
        ? (isRtl ? 'تم تأجيل المشوار بنجاح' : 'Trip successfully postponed')
        : (isRtl ? 'تم تعليق المشوار لقرار لاحق' : 'Trip suspended for later decision');

      setSuccessMsg(msg);
      setTimeout(() => {
        setSuccessMsg(null);
        onReassigned();
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Breakdown decision failed:', err);
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
                {isRtl ? 'إدارة مشاوير المركبة المتعطلة' : 'Vehicle Breakdown Management'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRtl ? 'خيارات المشرف: إعادة إسناد لأقرب مركبة لتوفير السولار، أو التأجيل، أو التعليق' : 'Supervisor decisions: Reassign to nearest vehicle, postpone, or suspend.'}
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
            {affectedTrips.length} {isRtl ? 'مشاوير مفتوحة' : 'Open trips affected'}
          </div>
        </div>

        {affectedTrips.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-medium">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            {isRtl ? 'لا توجد مشاوير أو مهام مفتوحة مسندة لهذه المركبة حالياً.' : 'No active trips assigned to this vehicle.'}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Select Trip */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? '1. اختر المشوار المراد معالجته:' : '1. Select trip to handle:'}
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
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{trip.tripType}</span>
                          {trip.isEmergency && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-rose-100 text-rose-700">
                              {isRtl ? 'طارئ ⚡' : 'Emergency'}
                            </span>
                          )}
                          <span className="font-mono text-slate-500 text-[10px]">{new Date(trip.scheduledAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>
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

            {/* Step 2: Choose Decision Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? '2. قرار المشرف لهذا المشوار:' : '2. Supervisor decision for this trip:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionType('REASSIGN')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    decisionType === 'REASSIGN'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-extrabold shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span className="text-xs">{isRtl ? 'إعادة إسناد الآن' : 'Reassign Now'}</span>
                  <span className="text-[10px] opacity-75">{isRtl ? 'تحويل لأقرب مركبة' : 'Transfer to vehicle'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDecisionType('POSTPONE')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    decisionType === 'POSTPONE'
                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-extrabold shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">{isRtl ? 'تأجيل المشوار' : 'Postpone'}</span>
                  <span className="text-[10px] opacity-75">{isRtl ? 'تحديد موعد لاحق' : 'Reschedule'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDecisionType('SUSPEND')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    decisionType === 'SUSPEND'
                      ? 'border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <PauseCircle className="h-4 w-4" />
                  <span className="text-xs">{isRtl ? 'تعليق المشوار' : 'Suspend'}</span>
                  <span className="text-[10px] opacity-75">{isRtl ? 'قرار لاحق' : 'Decide later'}</span>
                </button>
              </div>
            </div>

            {/* Decision Details Body */}
            {decisionType === 'REASSIGN' && (
              <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isRtl ? 'اقتراحات أقرب سيارات متاحة (مرتبة حسب المسافة وتوفير السولار):' : 'Nearest available vehicles (sorted by distance & fuel economy):'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {isRtl ? 'حساب جغرافي' : 'Geo Match'}
                  </span>
                </div>

                {candidateVehicles.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    {isRtl ? 'لا توجد مركبات بديلة متاحة حالياً.' : 'No alternative vehicles available.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {candidateVehicles.map((cand, idx) => {
                      const isNearest = idx === 0 && cand.distanceKm < 9999;
                      const isSelected = selectedVehicleId === cand.vehicle.id;

                      return (
                        <label
                          key={cand.vehicle.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="candidateVehicle"
                              checked={isSelected}
                              onChange={() => handleVehicleSelect(cand.vehicle.id)}
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
                                  <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    {isRtl ? 'الأقرب ⚡' : 'Nearest ⚡'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{isRtl ? 'السائق الأساسي:' : 'Default driver:'} {cand.vehicle.driverName || '-'}</span>
                                <span>•</span>
                                <span>{cand.lastLocationLabel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right rtl:text-left font-mono">
                            {cand.distanceKm < 9999 ? (
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200/60">
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

                {/* Driver Flexibility input */}
                {selectedVehicleId && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <User className="h-3 w-3 text-indigo-500" />
                      {isRtl ? 'السائق المنفذ للمشوار (يمكن تشغيل أي سائق متاح على العربية البديلة):' : 'Assigned Driver:'}
                    </label>
                    <input
                      type="text"
                      value={selectedDriverName}
                      onChange={e => setSelectedDriverName(e.target.value)}
                      placeholder={isRtl ? 'اسم السائق المنفذ' : 'Driver name'}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {decisionType === 'POSTPONE' && (
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRtl ? 'تاريخ ووقت التأجيل المقترح:' : 'Postponed until:'}
                </label>
                <input
                  type="datetime-local"
                  value={postponeUntil}
                  onChange={e => setPostponeUntil(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            )}

            {decisionType === 'SUSPEND' && (
              <div className="p-3 bg-slate-100 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                {isRtl 
                  ? 'سيتم تعليق هذا المشوار وحفظه بحالة (معلق بسبب عطل) ليتمكن المشرف من البت فيه لاحقاً عند جاهزية مركبة أو توفر سائق.'
                  : 'This trip will be placed in suspended breakdown status for later supervisor dispatch.'}
              </div>
            )}

            {/* Custom Reason Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isRtl ? 'ملاحظات وسبب القرار (أثر تدقيق):' : 'Reason & Decision notes (Audit trail):'}
              </label>
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder={isRtl ? 'اكتب ملاحظات إضافية إن وجدت...' : 'Add additional notes if any...'}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
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
                disabled={!selectedTripId || (decisionType === 'REASSIGN' && !selectedVehicleId) || submitting}
                onClick={handleExecuteDecision}
                className="flex-1 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-sm flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {submitting 
                    ? (isRtl ? 'جاري التنفيذ...' : 'Processing...') 
                    : (isRtl ? 'تأكيد وتنفيذ القرار' : 'Confirm Decision')}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
