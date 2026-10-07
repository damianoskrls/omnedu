'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { extraServicesApi, studentsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  Bus, Plus, X, Pencil, Trash2,
  MapPin, Clock, User, Users, Settings, Home, Phone,
} from 'lucide-react';

const MapPicker = dynamic(() => import('@/components/MapPickerInner'), {
  ssr: false,
  loading: () => <div style={{ height: 260 }} className="w-full rounded-xl bg-gray-100 animate-pulse" />,
});

const RouteMapView = dynamic(() => import('@/components/RouteMapView'), {
  ssr: false,
  loading: () => <div style={{ height: 480 }} className="w-full rounded-xl bg-gray-100 animate-pulse" />,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
type DayTimes = { pickup?: string; dropoff?: string };
type DailyTimes = Partial<Record<DayKey, DayTimes>>;

type Stop = {
  id: string; name: string; address?: string; order: number;
  pickupTime?: string; dropoffTime?: string;
  latitude?: number; longitude?: number;
};
type Route = {
  id: string; name: string; description?: string;
  direction?: string; // pickup | dropoff | both
  driverName?: string; busNumber?: string;
  isActive: boolean;
  stops: Stop[];
  _count?: { stops: number };
};
type Service = {
  id: string; name: string; description?: string; serviceType: string;
  driverName?: string; busNumber?: string;
  monthlyCost?: number; pickupCost?: number; dropoffCost?: number;
  isActive: boolean; createdAt: string;
  routes: Route[];
  _count?: { studentServices: number };
};
type PickupPerson = { name: string; phone?: string; relation?: string; idNumber?: string; isDefault?: boolean };
type StudentEntry = {
  id: string; isActive: boolean; serviceMode?: string;
  pickupTime?: string; dropoffTime?: string;
  dailyTimes?: DailyTimes; pickupContact?: string; dropoffContact?: string;
  pickupPersons?: PickupPerson[];
  discountAmount?: number;
  homeAddress?: string; homeLat?: number; homeLng?: number;
  notes?: string;
  student: { id: string; fullName: string; avatarUrl?: string };
  route?: { id: string; name: string };
  stop?: { id: string; name: string; pickupTime?: string; dropoffTime?: string };
};
type Student = { id: string; fullName: string; avatarUrl?: string; parents?: { user: { id: string } }[] };

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentServiceData, setStudentServiceData] = useState<Record<string, StudentEntry[]>>({});

  // modals
  const [serviceModal, setServiceModal] = useState<Partial<Service> | null>(null);
  const [routeModal, setRouteModal] = useState<{ serviceId: string; route?: Partial<Route> } | null>(null);
  const [stopModal, setStopModal] = useState<{ serviceId: string; routeId: string; stop?: Partial<Stop> } | null>(null);
  const [assignModal, setAssignModal] = useState<{ serviceId: string } | null>(null);
  const [assignForm, setAssignForm] = useState<any>({});
  const [editStudentModal, setEditStudentModal] = useState<{ serviceId: string; ssId: string } | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<any>({});
  const [routeMapModal, setRouteMapModal] = useState<{ serviceId: string; routeId: string } | null>(null);
  const [timelineServiceId, setTimelineServiceId] = useState<string | null>(null);
  const [timelineDay, setTimelineDay] = useState<DayKey>(currentSchoolDay);
  const [timelineRouteId, setTimelineRouteId] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const all = (await extraServicesApi.list(schoolId)) as unknown as Service[];
      const bus = all.filter(s => s.serviceType === 'bus');
      setServices(bus);
      // Load student data for all services immediately
      const entries = await Promise.all(
        bus.map(async svc => {
          try {
            const data = await extraServicesApi.getStudents(schoolId, svc.id) as unknown as StudentEntry[];
            return [svc.id, data] as const;
          } catch {
            return [svc.id, [] as StudentEntry[]] as const;
          }
        }),
      );
      setStudentServiceData(Object.fromEntries(entries));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]);

  const refreshStudents = async (serviceId: string) => {
    try {
      const data = await extraServicesApi.getStudents(schoolId, serviceId) as unknown as StudentEntry[];
      setStudentServiceData(prev => ({ ...prev, [serviceId]: data }));
    } catch {
      setStudentServiceData(prev => ({ ...prev, [serviceId]: [] }));
    }
  };

  const loadAllStudents = async () => {
    if (allStudents.length === 0) {
      const data = await studentsApi.list(schoolId) as unknown as Student[];
      setAllStudents(data);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm('Να διαγραφεί οριστικά αυτό το λεωφορείο μαζί με όλα τα δρομολόγια και τους μαθητές;')) return;
    await extraServicesApi.remove(schoolId, serviceId);
    setServiceModal(null);
    await load();
  };

  const saveService = async () => {
    if (!serviceModal?.name?.trim()) return;
    setSaving(true);
    try {
      const oneWay = (serviceModal as any).pickupCost ? Number((serviceModal as any).pickupCost) : undefined;
      const payload = {
        name: serviceModal.name,
        description: serviceModal.description,
        serviceType: 'bus',
        driverName: (serviceModal as any).driverName || undefined,
        busNumber: (serviceModal as any).busNumber || undefined,
        monthlyCost: serviceModal.monthlyCost ? Number(serviceModal.monthlyCost) : undefined,
        pickupCost: oneWay,
        dropoffCost: oneWay,
      };
      if (serviceModal.id) {
        await extraServicesApi.update(schoolId, serviceModal.id, payload);
      } else {
        await extraServicesApi.create(schoolId, payload);
      }
      setServiceModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  };


  const saveRoute = async () => {
    if (!routeModal?.route?.name?.trim()) return;
    setSaving(true);
    try {
      const r = routeModal.route as any;
      const payload = {
        name: r.name,
        description: r.description || undefined,
        direction: r.direction || 'both',
        driverName: r.driverName || undefined,
        busNumber: r.busNumber || undefined,
      };
      if (r.id) {
        await extraServicesApi.updateRoute(schoolId, routeModal.serviceId, r.id, payload);
      } else {
        await extraServicesApi.addRoute(schoolId, routeModal.serviceId, payload);
      }
      setRouteModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteRoute = async (serviceId: string, routeId: string) => {
    if (!confirm('Να διαγραφεί το δρομολόγιο και όλες οι στάσεις;')) return;
    await extraServicesApi.removeRoute(schoolId, serviceId, routeId);
    await load();
  };

  const saveStop = async () => {
    if (!stopModal?.stop?.name?.trim()) return;
    setSaving(true);
    try {
      const stop = stopModal.stop as any;
      const payload = {
        name: stop.name,
        order: stop.order,
        address: stop.address || undefined,
        pickupTime: stop.pickupTime || undefined,
        dropoffTime: stop.dropoffTime || undefined,
        latitude: stop.latitude != null ? Number(stop.latitude) : undefined,
        longitude: stop.longitude != null ? Number(stop.longitude) : undefined,
      };
      if (stopModal.stop.id) {
        await extraServicesApi.updateStop(schoolId, stopModal.serviceId, stopModal.routeId, stopModal.stop.id, payload);
      } else {
        await extraServicesApi.addStop(schoolId, stopModal.serviceId, stopModal.routeId, payload);
      }
      setStopModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteStop = async (serviceId: string, routeId: string, stopId: string) => {
    if (!confirm('Να διαγραφεί η στάση;')) return;
    await extraServicesApi.removeStop(schoolId, serviceId, routeId, stopId);
    await load();
  };

  const openAssign = async (serviceId: string) => {
    await loadAllStudents();
    setAssignForm({ studentIds: [] as string[], routeId: '', stopId: '', serviceMode: 'both', pickupTime: '', dropoffTime: '', dailyTimes: {} as DailyTimes, pickupContact: '', dropoffContact: '', pickupPersons: [], homeAddress: '', homeLat: undefined, homeLng: undefined, discountAmount: '', notes: '' });
    setAssignModal({ serviceId });
  };

  const saveAssign = async () => {
    if (!assignModal || !assignForm.studentIds?.length) return;
    setSaving(true);
    try {
      const hasDailyTimes = Object.keys(assignForm.dailyTimes ?? {}).length > 0;
      const basePayload = {
        routeId: assignForm.routeId || undefined,
        stopId: assignForm.stopId || undefined,
        serviceMode: assignForm.serviceMode ?? 'both',
        pickupTime: assignForm.pickupTime || undefined,
        dropoffTime: assignForm.dropoffTime || undefined,
        dailyTimes: hasDailyTimes ? assignForm.dailyTimes : undefined,
        pickupContact: assignForm.pickupContact || undefined,
        dropoffContact: assignForm.dropoffContact || undefined,
        pickupPersons: assignForm.pickupPersons?.length ? assignForm.pickupPersons : undefined,
        homeAddress: assignForm.homeAddress || undefined,
        homeLat: assignForm.homeLat ?? undefined,
        homeLng: assignForm.homeLng ?? undefined,
        discountAmount: assignForm.discountAmount ? Number(assignForm.discountAmount) : undefined,
        notes: assignForm.notes || undefined,
      };
      for (const studentId of assignForm.studentIds) {
        await extraServicesApi.assignStudent(schoolId, assignModal.serviceId, { ...basePayload, studentId });
      }
      const sid = assignModal.serviceId;
      setAssignModal(null);
      await refreshStudents(sid);
    } finally {
      setSaving(false);
    }
  };

  const openEditStudent = async (serviceId: string, ss: StudentEntry) => {
    setEditStudentForm({
      routeId: ss.route?.id ?? '',
      stopId: ss.stop?.id ?? '',
      serviceMode: ss.serviceMode ?? 'both',
      pickupTime: ss.pickupTime ?? '',
      dropoffTime: ss.dropoffTime ?? '',
      dailyTimes: (ss.dailyTimes ?? {}) as DailyTimes,
      pickupContact: ss.pickupContact ?? '',
      dropoffContact: ss.dropoffContact ?? '',
      pickupPersons: ss.pickupPersons ?? [],
      homeAddress: ss.homeAddress ?? '',
      homeLat: ss.homeLat,
      homeLng: ss.homeLng,
      discountAmount: ss.discountAmount != null ? String(ss.discountAmount) : '',
      notes: ss.notes ?? '',
    });
    setEditStudentModal({ serviceId, ssId: ss.id });
  };

  const saveEditStudent = async () => {
    if (!editStudentModal) return;
    setSaving(true);
    try {
      const hasDailyTimes = Object.keys(editStudentForm.dailyTimes ?? {}).length > 0;
      const updated = await extraServicesApi.updateStudentService(
        schoolId, editStudentModal.serviceId, editStudentModal.ssId,
        {
          routeId: editStudentForm.routeId || undefined,
          stopId: editStudentForm.stopId || undefined,
          serviceMode: editStudentForm.serviceMode ?? 'both',
          pickupTime: editStudentForm.pickupTime || undefined,
          dropoffTime: editStudentForm.dropoffTime || undefined,
          dailyTimes: hasDailyTimes ? editStudentForm.dailyTimes : null,
          pickupContact: editStudentForm.pickupContact || undefined,
          dropoffContact: editStudentForm.dropoffContact || undefined,
          pickupPersons: editStudentForm.pickupPersons?.length ? editStudentForm.pickupPersons : null,
          homeAddress: editStudentForm.homeAddress || undefined,
          homeLat: editStudentForm.homeLat ?? undefined,
          homeLng: editStudentForm.homeLng ?? undefined,
          discountAmount: editStudentForm.discountAmount ? Number(editStudentForm.discountAmount) : null,
          notes: editStudentForm.notes || undefined,
        },
      ) as unknown as StudentEntry;
      setStudentServiceData(prev => ({
        ...prev,
        [editStudentModal.serviceId]: (prev[editStudentModal.serviceId] ?? []).map(s =>
          s.id === editStudentModal.ssId ? { ...s, ...updated } : s
        ),
      }));
      setEditStudentModal(null);
    } finally {
      setSaving(false);
    }
  };

  const removeStudentService = async (serviceId: string, ssId: string) => {
    if (!confirm('Να αφαιρεθεί ο μαθητής από το σχολικό;')) return;
    await extraServicesApi.removeStudentService(schoolId, serviceId, ssId);
    setStudentServiceData(prev => ({
      ...prev,
      [serviceId]: prev[serviceId]?.filter(s => s.id !== ssId) ?? [],
    }));
  };

  // Stats
  const totalStudents = services.reduce((s, svc) => s + (svc._count?.studentServices ?? 0), 0);
  const totalRoutes = services.reduce((s, svc) => s + svc.routes.length, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Σχολικό Λεωφορείο</h1>
          <p className="text-sm text-gray-500 mt-1">Διαχείριση δρομολογίων, στάσεων και μαθητών</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setServiceModal({ serviceType: 'bus', isActive: true })}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Νέο Λεωφορείο
          </button>
        )}
      </div>

      {/* Stats */}
      {!loading && services.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Λεωφορεία</p>
            <p className="text-2xl font-bold text-gray-900">{services.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Δρομολόγια</p>
            <p className="text-2xl font-bold text-indigo-600">{totalRoutes}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Μαθητές στο σχολικό</p>
            <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">Φόρτωση...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bus className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500 mb-1">Δεν υπάρχει σχολικό λεωφορείο ακόμα</p>
          <p className="text-sm">Προσθέστε ένα λεωφορείο για να ξεκινήσετε</p>
        </div>
      ) : (
        <div className="space-y-4">
          {services.map(service => {
            const students = studentServiceData[service.id];
            return (
              <div key={service.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Bus className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900">{service.name}</span>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {(service as any).driverName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{(service as any).driverName}</span>}
                      {(service as any).busNumber && <span>{(service as any).busNumber}</span>}
                      {service.pickupCost != null && <span className="bg-gray-100 px-2 py-0.5 rounded-full">↑ {service.pickupCost}€/μήνα</span>}
                      {service.monthlyCost != null && <span className="bg-gray-100 px-2 py-0.5 rounded-full">↑↓ {service.monthlyCost}€/μήνα</span>}
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{students?.length ?? service._count?.studentServices ?? 0} μαθητές</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setTimelineServiceId(service.id); setTimelineRouteId('all'); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#77328D] text-white text-xs font-semibold hover:bg-[#642678]"
                    >
                      <Clock className="w-3.5 h-3.5" /> Δρομολόγιο
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setServiceModal({ ...service })}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        title="Ρυθμίσεις"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Students — always visible */}
                <div className="border-t border-gray-100">
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Μαθητές</span>
                    {isAdmin && (
                      <button
                        onClick={() => openAssign(service.id)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ανάθεση
                      </button>
                    )}
                  </div>
                  <div className="px-4 pb-4">
                    {!students ? (
                      <p className="text-sm text-gray-400 py-2">Φόρτωση...</p>
                    ) : students.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">Κανένας μαθητής δεν έχει ανατεθεί ακόμα.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {students.map(ss => (
                          <div key={ss.id} className="flex items-center gap-3 py-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0 overflow-hidden">
                              {ss.student.avatarUrl
                                ? <img src={ss.student.avatarUrl} alt="" className="w-full h-full object-cover" />
                                : ss.student.fullName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900">{ss.student.fullName}</p>
                                {ss.serviceMode && ss.serviceMode !== 'both' && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ss.serviceMode === 'pickup' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                    {ss.serviceMode === 'pickup' ? '↑ Παραλαβή' : '↓ Αποστολή'}
                                  </span>
                                )}
                                {ss.discountAmount != null && Number(ss.discountAmount) > 0 && (
                                  <span className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full">-{Number(ss.discountAmount).toFixed(0)}€</span>
                                )}
                              </div>
                              <div className="flex gap-3 text-xs text-gray-500 flex-wrap mt-0.5">
                                {ss.route && <span className="flex items-center gap-0.5"><Bus className="w-3 h-3" />{ss.route.name}</span>}
                                {ss.stop && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{ss.stop.name}</span>}
                                {ss.homeAddress && <span className="flex items-center gap-0.5"><Home className="w-3 h-3" />{ss.homeAddress}</span>}
                                {ss.pickupContact && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{ss.pickupContact}</span>}
                              </div>
                              <div className="flex gap-2 mt-0.5 text-xs">
                                {(ss.pickupTime ?? ss.stop?.pickupTime) && (
                                  <span className="text-green-700">↑ {ss.pickupTime ?? ss.stop?.pickupTime}</span>
                                )}
                                {(ss.dropoffTime ?? ss.stop?.dropoffTime) && (
                                  <span className="text-blue-700">↓ {ss.dropoffTime ?? ss.stop?.dropoffTime}</span>
                                )}
                              </div>
                              {ss.notes && <p className="text-xs text-gray-400 mt-0.5">{ss.notes}</p>}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEditStudent(service.id, ss)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => removeStudentService(service.id, ss.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Service (bus) modal ──────────────────────────────────────────── */}
      {serviceModal !== null && (
        <Modal title={serviceModal.id ? 'Ρυθμίσεις Λεωφορείου' : 'Νέο Λεωφορείο'} onClose={() => setServiceModal(null)}>
          <div className="space-y-4">
            <Field label="Όνομα *">
              <input className={inputCls} value={serviceModal.name ?? ''} onChange={e => setServiceModal(p => ({ ...p!, name: e.target.value }))} placeholder="π.χ. Λεωφορείο Α" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Οδηγός">
                <input className={inputCls} value={(serviceModal as any).driverName ?? ''} onChange={e => setServiceModal(p => ({ ...p!, driverName: e.target.value } as any))} placeholder="π.χ. Νίκος Παπαδόπουλος" />
              </Field>
              <Field label="Αριθμός λεωφορείου">
                <input className={inputCls} value={(serviceModal as any).busNumber ?? ''} onChange={e => setServiceModal(p => ({ ...p!, busNumber: e.target.value } as any))} placeholder="π.χ. ΑΒΓ-1234" />
              </Field>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Τιμολόγηση</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Μία κατεύθυνση (€/μήνα)">
                  <input type="number" min="0" step="0.01" className={inputCls} value={(serviceModal as any).pickupCost ?? ''} onChange={e => setServiceModal(p => ({ ...p!, pickupCost: e.target.value ? Number(e.target.value) : undefined } as any))} placeholder="35.00" />
                </Field>
                <Field label="Παραλαβή + Αποστολή (€/μήνα)">
                  <input type="number" min="0" step="0.01" className={inputCls} value={serviceModal.monthlyCost ?? ''} onChange={e => setServiceModal(p => ({ ...p!, monthlyCost: e.target.value ? Number(e.target.value) : undefined }))} placeholder="70.00" />
                </Field>
              </div>
              <p className="text-xs text-gray-400">Η τιμή μίας κατεύθυνσης εφαρμόζεται όταν ο μαθητής χρησιμοποιεί μόνο παραλαβή ή μόνο αποστολή.</p>
            </div>
          </div>
          <ModalFooter onCancel={() => setServiceModal(null)} onSave={saveService} saving={saving} disabled={!serviceModal.name?.trim()} />
          {serviceModal.id && (
            <div className="px-5 pb-4 border-t border-gray-100 pt-3">
              <button
                onClick={() => deleteService(serviceModal.id!)}
                className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                Διαγραφή Λεωφορείου
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ─── Route modal ──────────────────────────────────────────────────── */}
      {routeModal && (
        <Modal title={(routeModal.route as any)?.id ? 'Επεξεργασία Δρομολογίου' : 'Νέο Δρομολόγιο'} onClose={() => setRouteModal(null)}>
          <div className="space-y-4">
            <Field label="Όνομα *">
              <input className={inputCls} value={routeModal.route?.name ?? ''} onChange={e => setRouteModal(p => ({ ...p!, route: { ...p!.route!, name: e.target.value } }))} placeholder="π.χ. Πρωινό Α - 07:00" />
            </Field>
            <Field label="Τύπος Δρομολογίου *">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'pickup', label: '↑ Παραλαβή', desc: 'Πρωί προς σχολείο' },
                  { value: 'dropoff', label: '↓ Αποστολή', desc: 'Απόγευμα από σχολείο' },
                  { value: 'both', label: '↑↓ Αμφίδρομο', desc: 'Και τις δύο κατευθύνσεις' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRouteModal(p => ({ ...p!, route: { ...p!.route!, direction: opt.value } as any }))}
                    className={`py-2 px-2 text-xs rounded-lg border-2 font-medium transition-colors text-left ${
                      ((routeModal.route as any)?.direction ?? 'both') === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                    }`}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-[10px] font-normal text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Περιγραφή">
              <input className={inputCls} value={routeModal.route?.description ?? ''} onChange={e => setRouteModal(p => ({ ...p!, route: { ...p!.route!, description: e.target.value } }))} placeholder="π.χ. Εκκίνηση 07:00 από σχολείο" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Οδηγός">
                <input className={inputCls} value={(routeModal.route as any)?.driverName ?? ''} onChange={e => setRouteModal(p => ({ ...p!, route: { ...p!.route!, driverName: e.target.value } as any }))} placeholder="π.χ. Νίκος Παπαδόπουλος" />
              </Field>
              <Field label="Αριθμός Λεωφορείου">
                <input className={inputCls} value={(routeModal.route as any)?.busNumber ?? ''} onChange={e => setRouteModal(p => ({ ...p!, route: { ...p!.route!, busNumber: e.target.value } as any }))} placeholder="π.χ. ΑΒΓ-1234" />
              </Field>
            </div>
          </div>
          <ModalFooter onCancel={() => setRouteModal(null)} onSave={saveRoute} saving={saving} disabled={!routeModal.route?.name?.trim()} />
        </Modal>
      )}

      {/* ─── Stop modal ───────────────────────────────────────────────────── */}
      {stopModal && (() => {
        const svc = services.find(s => s.id === stopModal.serviceId);
        const route = svc?.routes.find(r => r.id === stopModal.routeId);
        const mapStops = (route?.stops ?? [])
          .filter(s => s.id !== stopModal.stop?.id && (s as any).latitude && (s as any).longitude)
          .map(s => ({
            lat: Number((s as any).latitude),
            lng: Number((s as any).longitude),
            name: s.name,
            order: s.order,
          }));
        const currentLat = (stopModal.stop as any)?.latitude ? Number((stopModal.stop as any).latitude) : undefined;
        const currentLng = (stopModal.stop as any)?.longitude ? Number((stopModal.stop as any).longitude) : undefined;
        return (
          <Modal title={stopModal.stop?.id ? 'Επεξεργασία Στάσης' : 'Νέα Στάση'} onClose={() => setStopModal(null)} wide>
            <div className="space-y-4">
              <Field label="Όνομα στάσης *">
                <input className={inputCls} value={stopModal.stop?.name ?? ''} onChange={e => setStopModal(p => ({ ...p!, stop: { ...p!.stop!, name: e.target.value } }))} placeholder="π.χ. Πλ. Ελευθερίας" />
              </Field>
              <Field label="Τοποθεσία στον χάρτη">
                <p className="text-xs text-gray-400 mb-2">Κάντε κλικ στον χάρτη για να ορίσετε την ακριβή τοποθεσία</p>
                <MapPicker
                  lat={currentLat}
                  lng={currentLng}
                  stops={mapStops}
                  onSelect={(lat, lng, addr) => setStopModal(p => ({
                    ...p!,
                    stop: {
                      ...p!.stop!,
                      latitude: lat,
                      longitude: lng,
                      ...(addr ? { address: addr } : {}),
                    } as any,
                  }))}
                />
                {currentLat != null && (
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {currentLat.toFixed(6)}, {currentLng?.toFixed(6)}
                  </p>
                )}
              </Field>
              <Field label="Διεύθυνση / Τοποθεσία">
                <div className="flex gap-2">
                  <input className={inputCls} value={(stopModal.stop as any)?.address ?? ''} onChange={e => setStopModal(p => ({ ...p!, stop: { ...p!.stop!, address: e.target.value } as any }))} placeholder="π.χ. Λεωφ. Αθηνών 42, Αθήνα" />
                  <button
                    type="button"
                    title="Εύρεση στον χάρτη"
                    onClick={async () => {
                      const addr = (stopModal.stop as any)?.address?.trim();
                      if (!addr) return;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&accept-language=el`, { headers: { Accept: 'application/json' } });
                        const data = await res.json();
                        if (data[0]) {
                          setStopModal(p => ({ ...p!, stop: { ...p!.stop!, latitude: Number(data[0].lat), longitude: Number(data[0].lon) } as any }));
                        } else { alert('Η διεύθυνση δεν βρέθηκε.'); }
                      } catch { alert('Σφάλμα geocoding.'); }
                    }}
                    className="shrink-0 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm hover:bg-indigo-100 flex items-center gap-1 whitespace-nowrap"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Εύρεση
                  </button>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ώρα παραλαβής (↑)">
                  <input type="time" className={inputCls} value={stopModal.stop?.pickupTime ?? ''} onChange={e => setStopModal(p => ({ ...p!, stop: { ...p!.stop!, pickupTime: e.target.value } }))} />
                </Field>
                <Field label="Ώρα αποβίβασης (↓)">
                  <input type="time" className={inputCls} value={stopModal.stop?.dropoffTime ?? ''} onChange={e => setStopModal(p => ({ ...p!, stop: { ...p!.stop!, dropoffTime: e.target.value } }))} />
                </Field>
              </div>
            </div>
            <ModalFooter onCancel={() => setStopModal(null)} onSave={saveStop} saving={saving} disabled={!stopModal.stop?.name?.trim()} />
          </Modal>
        );
      })()}

      {/* ─── Edit student assignment modal ────────────────────────────────── */}
      {editStudentModal && (
        <Modal title="Επεξεργασία Ανάθεσης" onClose={() => setEditStudentModal(null)} wide>
          {(() => {
            const svc = services.find(s => s.id === editStudentModal.serviceId);
            const selectedRoute = svc?.routes.find(r => r.id === editStudentForm.routeId);
            return (
              <StudentAssignForm
                form={editStudentForm}
                onChange={setEditStudentForm}
                svc={svc}
                selectedRoute={selectedRoute}
              />
            );
          })()}
          <ModalFooter onCancel={() => setEditStudentModal(null)} onSave={saveEditStudent} saving={saving} disabled={false} />
        </Modal>
      )}

      {/* ─── Assign student modal ─────────────────────────────────────────── */}
      {assignModal && (
        <Modal title="Ανάθεση Μαθητών στο Σχολικό" onClose={() => setAssignModal(null)} wide>
          {(() => {
            const svc = services.find(s => s.id === assignModal.serviceId);
            const selectedRoute = svc?.routes.find(r => r.id === assignForm.routeId);
            const assignedIds = new Set((studentServiceData[assignModal.serviceId] ?? []).map(ss => ss.student.id));
            return (
              <div className="space-y-4">
                <StudentMultiPicker
                  allStudents={allStudents}
                  selectedIds={assignForm.studentIds ?? []}
                  assignedIds={assignedIds}
                  onChange={ids => setAssignForm((p: any) => ({ ...p, studentIds: ids }))}
                />
                {(assignForm.studentIds?.length ?? 0) > 0 && (
                  <StudentAssignForm
                    form={assignForm}
                    onChange={setAssignForm}
                    svc={svc}
                    selectedRoute={selectedRoute}
                  />
                )}
              </div>
            );
          })()}
          <ModalFooter onCancel={() => setAssignModal(null)} onSave={saveAssign} saving={saving} disabled={!assignForm.studentIds?.length} />
        </Modal>
      )}
      {timelineServiceId && (() => {
        const service = services.find(item => item.id === timelineServiceId);
        if (!service) return null;
        const riders = (studentServiceData[service.id] ?? []).filter(entry => entry.isActive !== false);
        const routes = service.routes ?? [];
        return (
          <Modal title={`Δρομολόγιο · ${service.name}`} onClose={() => setTimelineServiceId(null)} wider>
            <BusRouteBoard
              riders={riders}
              routes={routes}
              day={timelineDay}
              onDay={setTimelineDay}
              routeId={timelineRouteId}
              onRoute={setTimelineRouteId}
            />
          </Modal>
        );
      })()}
      {/* ─── Route map modal ──────────────────────────────────────────────── */}
      {routeMapModal && (() => {
        const svc = services.find(s => s.id === routeMapModal.serviceId);
        const route = svc?.routes.find(r => r.id === routeMapModal.routeId);
        if (!route) return null;
        const mapStops = (route.stops ?? [])
          .filter(s => (s as any).latitude && (s as any).longitude)
          .map(s => ({
            lat: Number((s as any).latitude),
            lng: Number((s as any).longitude),
            name: s.name,
            order: s.order,
            pickupTime: s.pickupTime,
            dropoffTime: s.dropoffTime,
          }));
        const routeStudents = (studentServiceData[routeMapModal.serviceId] ?? [])
          .filter(ss => ss.route?.id === routeMapModal.routeId && ss.homeLat && ss.homeLng)
          .map(ss => ({
            id: ss.student.id,
            fullName: ss.student.fullName,
            avatarUrl: ss.student.avatarUrl,
            serviceMode: ss.serviceMode ?? 'both',
            pickupTime: ss.pickupTime ?? ss.stop?.pickupTime,
            dropoffTime: ss.dropoffTime ?? ss.stop?.dropoffTime,
            homeAddress: ss.homeAddress,
            homeLat: Number(ss.homeLat),
            homeLng: Number(ss.homeLng),
            pickupPersons: ss.pickupPersons ?? [],
            stopName: ss.stop?.name,
          }));
        return (
          <Modal title={`Χάρτης: ${route.name}`} onClose={() => setRouteMapModal(null)} wide>
            <div className="space-y-3">
              <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-indigo-500 inline-flex items-center justify-center text-white font-bold text-[9px]">1</span> Στάσεις δρομολογίου</span>
                <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-lg bg-violet-600 inline-flex" /> Αμφίδρομο</span>
                <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-lg bg-green-600 inline-flex" /> Μόνο παραλαβή</span>
                <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-lg bg-blue-600 inline-flex" /> Μόνο αποστολή</span>
              </div>
              {routeStudents.length === 0 && mapStops.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">Δεν υπάρχουν στοιχεία τοποθεσίας για αυτό το δρομολόγιο.</p>
              ) : (
                <RouteMapView
                  students={routeStudents}
                  stops={mapStops}
                  routeName={route.name}
                />
              )}
              {routeStudents.length === 0 && mapStops.length > 0 && (
                <p className="text-xs text-gray-400 text-center">Δεν υπάρχουν μαθητές με αποθηκευμένες συντεταγμένες για αυτό το δρομολόγιο.</p>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Δευ' },
  { key: 'tue', label: 'Τρι' },
  { key: 'wed', label: 'Τετ' },
  { key: 'thu', label: 'Πεμ' },
  { key: 'fri', label: 'Παρ' },
];

function DailyTimesGrid({ value, onChange }: { value: DailyTimes; onChange: (v: DailyTimes) => void }) {
  const set = (day: DayKey, field: 'pickup' | 'dropoff', time: string) =>
    onChange({ ...value, [day]: { ...value[day], [field]: time || undefined } });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="w-10 text-left text-gray-500 font-medium pb-1" />
            <th className="text-gray-500 font-medium pb-1 text-center">Παραλαβή ↑</th>
            <th className="text-gray-500 font-medium pb-1 text-center">Αποβίβαση ↓</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {DAYS.map(({ key, label }) => (
            <tr key={key}>
              <td className="py-1.5 pr-2 font-medium text-gray-600 whitespace-nowrap">{label}</td>
              <td className="py-1.5 pr-1">
                <input type="time" className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" value={value[key]?.pickup ?? ''} onChange={e => set(key, 'pickup', e.target.value)} />
              </td>
              <td className="py-1.5">
                <input type="time" className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" value={value[key]?.dropoff ?? ''} onChange={e => set(key, 'dropoff', e.target.value)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimePickerEl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const h24 = value ? parseInt(value.split(':')[0] ?? '0', 10) : NaN;
  const min = value ? (value.split(':')[1] ?? '00') : '00';
  const isPM = !isNaN(h24) && h24 >= 12;
  const h12 = isNaN(h24) ? '' : String(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24);

  const emit = (newH12: string, newMin: string, newIsPM: boolean) => {
    const h = parseInt(newH12 || '12', 10) % 12;
    const h24out = newIsPM ? h + 12 : h;
    const m = parseInt(newMin || '0', 10);
    onChange(`${String(h24out).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  return (
    <div className="flex items-center gap-1">
      <select
        className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={h12}
        onChange={e => emit(e.target.value, min, isPM)}
      >
        <option value="">–</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
          <option key={n} value={String(n)}>{String(n).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-gray-400 font-bold text-sm">:</span>
      <select
        className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={min}
        onChange={e => emit(h12, e.target.value, isPM)}
      >
        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => emit(h12 || '12', min, false)}
        className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition-colors ${!isPM && h12 ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
      >ΠΜ</button>
      <button
        type="button"
        onClick={() => emit(h12 || '12', min, true)}
        className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition-colors ${isPM && h12 ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
      >ΜΜ</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const SERVICE_MODES = [
  { value: 'both', label: '↑↓ Παραλαβή + Αποστολή' },
  { value: 'pickup', label: '↑ Μόνο Παραλαβή' },
  { value: 'dropoff', label: '↓ Μόνο Αποστολή' },
];

function StudentAssignForm({ form, onChange, svc, selectedRoute }: {
  form: any;
  onChange: (v: any) => void;
  svc: Service | undefined;
  selectedRoute: Route | undefined;
}) {
  const MapPickerDynamic = MapPicker;

  const addPickupPerson = () => {
    onChange({ ...form, pickupPersons: [...(form.pickupPersons ?? []), { name: '', phone: '', relation: '' }] });
  };
  const removePickupPerson = (i: number) => {
    onChange({ ...form, pickupPersons: form.pickupPersons.filter((_: any, idx: number) => idx !== i) });
  };
  const updatePickupPerson = (i: number, field: string, val: string) => {
    const persons = [...(form.pickupPersons ?? [])];
    const parsed = field === 'isDefault' ? val === 'true' : val;
    persons[i] = { ...persons[i], [field]: parsed };
    onChange({ ...form, pickupPersons: persons });
  };

  const routeDirection = selectedRoute?.direction ?? 'both';
  const availableModes = routeDirection === 'pickup'
    ? SERVICE_MODES.filter(m => m.value === 'pickup')
    : routeDirection === 'dropoff'
    ? SERVICE_MODES.filter(m => m.value === 'dropoff')
    : SERVICE_MODES;

  return (
    <div className="space-y-4">
      {/* Route + Stop — first so direction filtering works */}
      {svc && svc.routes.length > 0 && (
        <Field label="Δρομολόγιο">
          <select
            className={inputCls}
            value={form.routeId ?? ''}
            onChange={e => {
              const routeId = e.target.value;
              const route = svc.routes.find(r => r.id === routeId);
              const dir = route?.direction ?? 'both';
              const newMode = dir !== 'both' ? dir : form.serviceMode ?? 'both';
              onChange({ ...form, routeId, stopId: '', serviceMode: newMode });
            }}
          >
            <option value="">— χωρίς δρομολόγιο —</option>
            {svc.routes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}{r.direction === 'pickup' ? ' ↑' : r.direction === 'dropoff' ? ' ↓' : ' ↑↓'}
              </option>
            ))}
          </select>
        </Field>
      )}
      {selectedRoute && (selectedRoute.stops ?? []).length > 0 && (
        <Field label="Στάση">
          <select className={inputCls} value={form.stopId ?? ''} onChange={e => onChange({ ...form, stopId: e.target.value })}>
            <option value="">— χωρίς στάση —</option>
            {[...(selectedRoute.stops ?? [])].sort((a, b) => a.order - b.order).map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.pickupTime ? ` (↑${s.pickupTime})` : ''}</option>
            ))}
          </select>
        </Field>
      )}

      {/* Service mode — filtered based on selected route direction */}
      <Field label="Τύπος Υπηρεσίας">
        {availableModes.length === 1 ? (
          <div className={`py-2 px-3 text-xs rounded-lg border-2 font-medium border-indigo-500 bg-indigo-50 text-indigo-700 inline-block`}>
            {availableModes[0]!.label}
            <span className="ml-1 text-indigo-400 font-normal">(καθορίστηκε από το δρομολόγιο)</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {availableModes.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => onChange({ ...form, serviceMode: m.value })}
                className={`py-2 px-3 text-xs rounded-lg border-2 font-medium transition-colors ${
                  form.serviceMode === m.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </Field>

      {/* Home address with map */}
      {(form.serviceMode === 'both' || form.serviceMode === 'pickup') && (
        <Field label="Διεύθυνση κατοικίας / Σημείο παραλαβής">
          <p className="text-xs text-gray-400 mb-2">Κάντε κλικ στον χάρτη για να ορίσετε την τοποθεσία παραλαβής</p>
          <MapPickerDynamic
            lat={form.homeLat}
            lng={form.homeLng}
            stops={[]}
            onSelect={(lat: number, lng: number, addr?: string) => onChange({
              ...form,
              homeLat: lat,
              homeLng: lng,
              ...(addr ? { homeAddress: addr } : {}),
            })}
          />
          {form.homeLat != null && (
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {Number(form.homeLat).toFixed(6)}, {Number(form.homeLng).toFixed(6)}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              className={inputCls}
              value={form.homeAddress ?? ''}
              onChange={e => onChange({ ...form, homeAddress: e.target.value })}
              placeholder="π.χ. Λεωφ. Αθηνών 42, Αθήνα"
            />
            <button
              type="button"
              title="Εύρεση στον χάρτη"
              onClick={async () => {
                const addr = form.homeAddress?.trim();
                if (!addr) return;
                try {
                  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&accept-language=el`, { headers: { Accept: 'application/json' } });
                  const data = await res.json();
                  if (data[0]) {
                    onChange({ ...form, homeLat: Number(data[0].lat), homeLng: Number(data[0].lon) });
                  } else { alert('Η διεύθυνση δεν βρέθηκε.'); }
                } catch { alert('Σφάλμα geocoding.'); }
              }}
              className="shrink-0 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm hover:bg-indigo-100 flex items-center gap-1 whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" /> Εύρεση
            </button>
          </div>
        </Field>
      )}

      {/* Pickup times with ΠΜ/ΜΜ */}
      <Field label="Προεπιλεγμένες ώρες">
        <div className="grid grid-cols-2 gap-3">
          {(form.serviceMode === 'both' || form.serviceMode === 'pickup') && (
            <div>
              <span className="text-xs text-gray-500 mb-1.5 block">Παραλαβή ↑</span>
              <TimePickerEl value={form.pickupTime ?? ''} onChange={v => onChange({ ...form, pickupTime: v })} />
            </div>
          )}
          {(form.serviceMode === 'both' || form.serviceMode === 'dropoff') && (
            <div>
              <span className="text-xs text-gray-500 mb-1.5 block">Αποστολή ↓</span>
              <TimePickerEl value={form.dropoffTime ?? ''} onChange={v => onChange({ ...form, dropoffTime: v })} />
            </div>
          )}
        </div>
      </Field>

      {/* Contacts */}
      <div className="grid grid-cols-2 gap-3">
        {(form.serviceMode === 'both' || form.serviceMode === 'pickup') && (
          <Field label="Ποιος παραδίδει στο λεωφορείο">
            <input className={inputCls} value={form.pickupContact ?? ''} onChange={e => onChange({ ...form, pickupContact: e.target.value })} placeholder="π.χ. Μαρία (μαμά)" />
          </Field>
        )}
        {(form.serviceMode === 'both' || form.serviceMode === 'dropoff') && (
          <Field label="Ποιος παραλαμβάνει από το λεωφορείο">
            <input className={inputCls} value={form.dropoffContact ?? ''} onChange={e => onChange({ ...form, dropoffContact: e.target.value })} placeholder="π.χ. Γιώργης (μπαμπάς)" />
          </Field>
        )}
      </div>

      {/* Pickup persons */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-600">Εξουσιοδοτημένα άτομα παραλαβής</label>
          <button type="button" onClick={addPickupPerson} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Προσθήκη
          </button>
        </div>
        {(form.pickupPersons ?? []).length === 0 ? (
          <p className="text-xs text-gray-400">Δεν έχουν οριστεί εξουσιοδοτημένα άτομα</p>
        ) : (
          <div className="space-y-2">
            {(form.pickupPersons as PickupPerson[]).map((person, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} value={person.name} onChange={e => updatePickupPerson(i, 'name', e.target.value)} placeholder="Ονοματεπώνυμο *" />
                  <input className={inputCls} value={person.phone ?? ''} onChange={e => updatePickupPerson(i, 'phone', e.target.value)} placeholder="Τηλέφωνο" />
                  <input className={inputCls} value={person.relation ?? ''} onChange={e => updatePickupPerson(i, 'relation', e.target.value)} placeholder="Σχέση (μαμά, παππούς...)" />
                  <input className={inputCls} value={person.idNumber ?? ''} onChange={e => updatePickupPerson(i, 'idNumber', e.target.value)} placeholder="ΑΔΤ (προαιρετικό)" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={person.isDefault ?? false} onChange={e => updatePickupPerson(i, 'isDefault', String(e.target.checked))} className="rounded" />
                    Προεπιλεγμένο άτομο παραλαβής
                  </label>
                  <button type="button" onClick={() => removePickupPerson(i)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> Αφαίρεση
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-day times */}
      <Field label="Ώρες ανά ημέρα (προαιρετικό)">
        <DailyTimesGrid
          value={form.dailyTimes ?? {}}
          onChange={v => onChange({ ...form, dailyTimes: v })}
        />
      </Field>

      {/* Discount */}
      <Field label="Έκπτωση (€/μήνα)">
        <input
          type="number"
          className={inputCls}
          value={form.discountAmount ?? ''}
          onChange={e => onChange({ ...form, discountAmount: e.target.value })}
          placeholder="π.χ. 10 (αφήστε κενό για καμία έκπτωση)"
        />
      </Field>

      {/* Notes */}
      <Field label="Σημειώσεις">
        <input className={inputCls} value={form.notes ?? ''} onChange={e => onChange({ ...form, notes: e.target.value })} placeholder="π.χ. κατεβαίνει μόνο Δευτέρα-Τετάρτη" />
      </Field>
    </div>
  );
}

function StudentAvatar({ student, size = 8 }: { student: Pick<Student, 'fullName' | 'avatarUrl'>; size?: number }) {
  const sz = `w-${size} h-${size}`;
  return (
    <div className={`${sz} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0 overflow-hidden`}>
      {student.avatarUrl
        ? <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" />
        : student.fullName.charAt(0)}
    </div>
  );
}

function StudentMultiPicker({
  allStudents,
  selectedIds,
  assignedIds,
  onChange,
}: {
  allStudents: Student[];
  selectedIds: string[];
  assignedIds: Set<string>;
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');

  const toggle = (id: string) => {
    if (assignedIds.has(id)) return;
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  // Compute siblings: students sharing a parent user ID with any selected student
  const selectedParentIds = new Set<string>();
  for (const sid of selectedIds) {
    const s = allStudents.find(x => x.id === sid);
    s?.parents?.forEach(p => selectedParentIds.add(p.user.id));
  }
  const siblingIds = allStudents
    .filter(s => !selectedIds.includes(s.id) && !assignedIds.has(s.id) && s.parents?.some(p => selectedParentIds.has(p.user.id)))
    .map(s => s.id);

  const filtered = allStudents.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map(id => {
            const s = allStudents.find(x => x.id === id);
            if (!s) return null;
            return (
              <div key={id} className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs font-medium text-indigo-700">
                <StudentAvatar student={s} size={6} />
                {s.fullName}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 rounded-full hover:bg-indigo-200 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Sibling suggestions */}
      {siblingIds.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700">Αδέρφια που δεν έχουν επιλεγεί:</p>
          <div className="flex flex-wrap gap-2">
            {siblingIds.map(id => {
              const s = allStudents.find(x => x.id === id);
              if (!s) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 bg-white border border-amber-300 rounded-full text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <StudentAvatar student={s} size={6} />
                  {s.fullName}
                  <span className="text-amber-500 ml-0.5">+</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + list */}
      <div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Αναζήτηση μαθητή..."
          className={inputCls}
        />
        <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Δεν βρέθηκε μαθητής</p>
          )}
          {filtered.map(s => {
            const isAssigned = assignedIds.has(s.id);
            const isSelected = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                disabled={isAssigned}
                onClick={() => toggle(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isAssigned
                    ? 'opacity-40 cursor-not-allowed bg-gray-50'
                    : isSelected
                    ? 'bg-indigo-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <StudentAvatar student={s} size={8} />
                <span className="flex-1 text-sm font-medium text-gray-900">{s.fullName}</span>
                {isAssigned && <span className="text-xs text-gray-400">Ήδη ανατεθεί</span>}
                {isSelected && !isAssigned && (
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function currentSchoolDay(): DayKey {
  const map: DayKey[] = ['mon', 'mon', 'tue', 'wed', 'thu', 'fri', 'mon'];
  return map[new Date().getDay()] ?? 'mon';
}

function minutesOf(value?: string | null) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function clockLabel(value?: string | null) {
  const minutes = minutesOf(value);
  if (minutes == null) return 'Χωρίς ώρα';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

type RouteDot = {
  id: string;
  name: string;
  time: string | null;
  minutes: number | null;
  address?: string;
  stopName?: string;
  avatarUrl?: string;
};

function routeDots(riders: StudentEntry[], kind: 'pickup' | 'dropoff', day: DayKey, routeId: string): RouteDot[] {
  return riders
    .filter((entry) => {
      if (routeId !== 'all' && entry.route?.id !== routeId) return false;
      const mode = entry.serviceMode ?? 'both';
      return kind === 'pickup' ? mode !== 'dropoff' : mode !== 'pickup';
    })
    .map((entry) => {
      const daily = entry.dailyTimes?.[day]?.[kind];
      const time = daily
        || (kind === 'pickup' ? entry.pickupTime ?? entry.stop?.pickupTime : entry.dropoffTime ?? entry.stop?.dropoffTime)
        || null;
      return {
        id: entry.id,
        name: entry.student.fullName,
        time,
        minutes: minutesOf(time),
        address: entry.homeAddress,
        stopName: entry.stop?.name,
        avatarUrl: entry.student.avatarUrl,
      };
    })
    .sort((a, b) => {
      if (a.minutes == null && b.minutes == null) return a.name.localeCompare(b.name, 'el');
      if (a.minutes == null) return 1;
      if (b.minutes == null) return -1;
      if (a.minutes !== b.minutes) return a.minutes - b.minutes;
      return a.name.localeCompare(b.name, 'el');
    });
}

function BusRouteBoard({
  riders, routes, day, onDay, routeId, onRoute,
}: {
  riders: StudentEntry[];
  routes: Route[];
  day: DayKey;
  onDay: (day: DayKey) => void;
  routeId: string;
  onRoute: (id: string) => void;
}) {
  const pickup = routeDots(riders, 'pickup', day, routeId);
  const dropoff = routeDots(riders, 'dropoff', day, routeId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {DAYS.map((item) => (
          <button
            key={item.key}
            onClick={() => onDay(item.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${day === item.key ? 'bg-[#77328D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {item.label}
          </button>
        ))}
        {routes.length > 1 && (
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => onRoute('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${routeId === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Όλα
            </button>
            {routes.map((route) => (
              <button
                key={route.id}
                onClick={() => onRoute(route.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${routeId === route.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {route.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <RouteLine
        kind="pickup"
        title="Παραλαβή"
        hint="Πρωί, από το σπίτι προς το σχολείο. Η σειρά είναι η ώρα παραλαβής."
        dots={pickup}
      />
      <RouteLine
        kind="dropoff"
        title="Παράδοση"
        hint="Απόγευμα, από το σχολείο προς το σπίτι. Η σειρά είναι η ώρα παράδοσης."
        dots={dropoff}
      />
    </div>
  );
}

function RouteLine({ kind, title, hint, dots }: { kind: 'pickup' | 'dropoff'; title: string; hint: string; dots: RouteDot[] }) {
  const schoolFirst = kind === 'dropoff';
  const accent = kind === 'pickup' ? '#E95926' : '#77328D';
  const wash = kind === 'pickup' ? 'bg-orange-50/70 border-orange-100' : 'bg-[#faf5fc] border-[#e6d0ee]';
  const nodes: Array<{ key: string; school?: boolean; dot?: RouteDot; index?: number }> = schoolFirst
    ? [{ key: 'school', school: true }, ...dots.map((dot, index) => ({ key: dot.id, dot, index }))]
    : [...dots.map((dot, index) => ({ key: dot.id, dot, index })), { key: 'school', school: true }];

  return (
    <section className={`rounded-2xl border p-4 ${wash}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-gray-600 border border-gray-100">
          {dots.length} {dots.length === 1 ? 'μαθητής' : 'μαθητές'}
        </span>
      </div>
      {dots.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Κανένας μαθητής σε αυτή τη γραμμή.</p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="relative flex items-start gap-2 min-w-max px-2 pt-1">
            <div
              className="absolute left-8 right-8 top-[48px] h-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${accent}33, ${accent}, ${accent}33)` }}
            />
            {nodes.map((node) => node.school ? (
              <div key={node.key} className="relative z-10 w-[120px] shrink-0 flex flex-col items-center text-center">
                <span className="h-6 mb-2" />
                <span className="w-9 h-9 rounded-xl bg-white border-2 flex items-center justify-center shadow-sm" style={{ borderColor: accent, color: accent }}>
                  <Home className="w-4 h-4" />
                </span>
                <p className="mt-2 text-xs font-bold text-gray-800">Σχολείο</p>
                <p className="text-[11px] text-gray-400">{schoolFirst ? 'Αφετηρία' : 'Τέρμα'}</p>
              </div>
            ) : (
              <div key={node.key} className="relative z-10 w-[132px] shrink-0 flex flex-col items-center text-center">
                <span className="mb-2 h-6 inline-flex min-w-[58px] items-center justify-center rounded-full bg-white px-2 text-[11px] font-bold shadow-sm" style={{ color: accent }}>
                  {clockLabel(node.dot?.time)}
                </span>
                <span className="w-9 h-9 rounded-full border-[3px] bg-white shadow-sm overflow-hidden flex items-center justify-center text-xs font-bold" style={{ borderColor: accent, color: accent }}>
                  {node.dot?.avatarUrl
                    ? <img src={node.dot.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : (node.index ?? 0) + 1}
                </span>
                <p className="mt-2 text-xs font-semibold text-gray-900 leading-tight line-clamp-2">{node.dot?.name}</p>
                <p className="text-[11px] text-gray-500 line-clamp-2">{node.dot?.stopName || node.dot?.address || ' '}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Modal({ title, onClose, children, wide, wider }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; wider?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wider ? 'max-w-5xl' : wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[92vh] flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, disabled }: { onCancel: () => void; onSave: () => void; saving: boolean; disabled: boolean }) {
  return (
    <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-4">
      <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ακύρωση</button>
      <button onClick={onSave} disabled={saving || disabled} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
      </button>
    </div>
  );
}

function formatTimeGreek(time: string): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const meridiem = h < 12 ? 'πμ' : 'μμ';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${meridiem}`;
}

function ScheduleRow({ ss, direction }: {
  ss: StudentEntry & { effectiveTime: string };
  direction: 'pickup' | 'dropoff';
}) {
  const isPickup = direction === 'pickup';
  const contact = isPickup ? ss.pickupContact : ss.dropoffContact;
  const address = ss.homeAddress || ss.stop?.name || '';
  const timeFormatted = ss.effectiveTime ? formatTimeGreek(ss.effectiveTime) : null;
  const [timePart, meridiem] = timeFormatted ? timeFormatted.split(' ') : ['—', ''];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50">
      <div className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl shrink-0 ${isPickup ? 'bg-green-50' : 'bg-blue-50'}`}>
        <span className={`text-sm font-bold leading-none ${isPickup ? 'text-green-700' : 'text-blue-700'}`}>{timePart}</span>
        {meridiem && (
          <span className={`text-[10px] font-medium mt-0.5 ${isPickup ? 'text-green-600' : 'text-blue-600'}`}>{meridiem}</span>
        )}
      </div>
      <StudentAvatar student={ss.student} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{ss.student.fullName}</p>
        <div className="flex gap-3 text-xs text-gray-500 flex-wrap mt-0.5">
          {ss.route && <span className="flex items-center gap-0.5"><Bus className="w-3 h-3" />{ss.route.name}</span>}
          {address && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{address}</span>}
          {contact && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{contact}</span>}
        </div>
      </div>
    </div>
  );
}
