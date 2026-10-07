'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { extraServicesApi, studentsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';

const MapPicker = dynamic(() => import('@/components/MapPickerInner'), {
  ssr: false,
  loading: () => <div style={{ height: 260 }} className="w-full rounded-xl bg-gray-100 animate-pulse" />,
});
import {
  Bus, Plus, X, ChevronDown, ChevronUp, Pencil, Trash2,
  MapPin, Clock, User, Euro, Users,
} from 'lucide-react';
import { PersonAvatar } from '@/components/PersonAvatar';

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
  id: string; name: string; description?: string; isActive: boolean;
  stops: Stop[];
  _count?: { stops: number };
};
type Service = {
  id: string; name: string; description?: string; serviceType: string;
  monthlyCost?: number; isActive: boolean; createdAt: string;
  routes: Route[];
  _count?: { studentServices: number };
};
type StudentEntry = {
  id: string; isActive: boolean; pickupTime?: string; dropoffTime?: string;
  dailyTimes?: DailyTimes; pickupContact?: string; notes?: string;
  student: { id: string; fullName: string; avatarUrl?: string };
  route?: { id: string; name: string };
  stop?: { id: string; name: string; pickupTime?: string; dropoffTime?: string };
};
type Student = { id: string; fullName: string };

const SERVICE_TYPES = [
  { value: 'aftercare', label: 'Ολοήμερο' },
  { value: 'other', label: 'Άλλο' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'routes' | 'students'>>({});

  // students for assign modal
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
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const all = (await extraServicesApi.list(schoolId)) as unknown as Service[];
      setServices(all.filter(s => s.serviceType !== 'bus'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]);

  const loadStudents = async (serviceId: string) => {
    if (!studentServiceData[serviceId]) {
      const data = await extraServicesApi.getStudents(schoolId, serviceId) as unknown as StudentEntry[];
      setStudentServiceData(prev => ({ ...prev, [serviceId]: data }));
    }
  };

  const loadAllStudents = async () => {
    if (allStudents.length === 0) {
      const data = await studentsApi.list(schoolId) as unknown as Student[];
      setAllStudents(data);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedService === id) { setExpandedService(null); return; }
    setExpandedService(id);
    const tab = activeTab[id] ?? 'routes';
    if (tab === 'students') await loadStudents(id);
  };

  const switchTab = async (serviceId: string, tab: 'routes' | 'students') => {
    setActiveTab(prev => ({ ...prev, [serviceId]: tab }));
    if (tab === 'students') await loadStudents(serviceId);
  };

  // ─── Save service ──────────────────────────────────────────────────────────

  const saveService = async () => {
    if (!serviceModal?.name?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: serviceModal.name,
        description: serviceModal.description,
        serviceType: serviceModal.serviceType ?? 'aftercare',
        monthlyCost: serviceModal.monthlyCost ? Number(serviceModal.monthlyCost) : undefined,
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

  // ─── Save route ────────────────────────────────────────────────────────────

  const saveRoute = async () => {
    if (!routeModal?.route?.name?.trim()) return;
    setSaving(true);
    try {
      const payload = { name: routeModal.route.name, description: routeModal.route.description };
      if (routeModal.route.id) {
        await extraServicesApi.updateRoute(schoolId, routeModal.serviceId, routeModal.route.id, payload);
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

  // ─── Save stop ─────────────────────────────────────────────────────────────

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

  // ─── Assign student ────────────────────────────────────────────────────────

  const openAssign = async (serviceId: string) => {
    await loadAllStudents();
    setAssignForm({ studentId: '', routeId: '', stopId: '', pickupTime: '', dropoffTime: '', dailyTimes: {} as DailyTimes, pickupContact: '', notes: '' });
    setAssignModal({ serviceId });
  };

  const saveAssign = async () => {
    if (!assignModal || !assignForm.studentId) return;
    setSaving(true);
    try {
      const hasDailyTimes = Object.keys(assignForm.dailyTimes ?? {}).length > 0;
      await extraServicesApi.assignStudent(schoolId, assignModal.serviceId, {
        studentId: assignForm.studentId,
        routeId: assignForm.routeId || undefined,
        stopId: assignForm.stopId || undefined,
        pickupTime: assignForm.pickupTime || undefined,
        dropoffTime: assignForm.dropoffTime || undefined,
        dailyTimes: hasDailyTimes ? assignForm.dailyTimes : undefined,
        pickupContact: assignForm.pickupContact || undefined,
        notes: assignForm.notes || undefined,
      });
      setAssignModal(null);
      setStudentServiceData(prev => { const n = { ...prev }; delete n[assignModal.serviceId]; return n; });
    } finally {
      setSaving(false);
    }
  };

  const openEditStudent = async (serviceId: string, ss: StudentEntry) => {
    setEditStudentForm({
      routeId: ss.route?.id ?? '',
      stopId: ss.stop?.id ?? '',
      pickupTime: ss.pickupTime ?? '',
      dropoffTime: ss.dropoffTime ?? '',
      dailyTimes: (ss.dailyTimes ?? {}) as DailyTimes,
      pickupContact: ss.pickupContact ?? '',
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
          pickupTime: editStudentForm.pickupTime || undefined,
          dropoffTime: editStudentForm.dropoffTime || undefined,
          dailyTimes: hasDailyTimes ? editStudentForm.dailyTimes : null,
          pickupContact: editStudentForm.pickupContact || undefined,
          notes: editStudentForm.notes || undefined,
        },
      ) as unknown as StudentEntry;
      setStudentServiceData(prev => ({
        ...prev,
        [editStudentModal.serviceId]: prev[editStudentModal.serviceId]?.map(s =>
          s.id === editStudentModal.ssId ? { ...s, ...updated } : s
        ) ?? [],
      }));
      setEditStudentModal(null);
    } finally {
      setSaving(false);
    }
  };

  const removeStudentService = async (serviceId: string, ssId: string) => {
    if (!confirm('Να αφαιρεθεί ο μαθητής από την παροχή;')) return;
    await extraServicesApi.removeStudentService(schoolId, serviceId, ssId);
    setStudentServiceData(prev => ({
      ...prev,
      [serviceId]: prev[serviceId]?.filter(s => s.id !== ssId) ?? [],
    }));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Παροχές Σχολείου</h1>
          <p className="text-sm text-gray-500 mt-1">Ολοήμερο και άλλες υπηρεσίες</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setServiceModal({ serviceType: 'aftercare', isActive: true })}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Νέα Παροχή
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">Φόρτωση...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bus className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Δεν υπάρχουν παροχές ακόμα</p>
        </div>
      ) : (
        <div className="space-y-4">
          {services.map(service => {
            const tab = activeTab[service.id] ?? 'routes';
            return (
              <div key={service.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Bus className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{service.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                        {SERVICE_TYPES.find(t => t.value === service.serviceType)?.label ?? service.serviceType}
                      </span>
                    </div>
                    {service.description && <p className="text-sm text-gray-500 mt-0.5">{service.description}</p>}
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>{service.routes.length} δρομολόγια</span>
                      <span>{service._count?.studentServices ?? 0} μαθητές</span>
                      {service.monthlyCost != null && <span>{service.monthlyCost}€/μήνα</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && (
                      <button
                        onClick={() => setServiceModal({ ...service })}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Επεξεργασία
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(service.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      {expandedService === service.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded */}
                {expandedService === service.id && (
                  <div className="border-t border-gray-100">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 bg-gray-50">
                      {(['routes', 'students'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => switchTab(service.id, t)}
                          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            tab === t
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {t === 'routes' ? 'Δρομολόγια' : 'Μαθητές'}
                        </button>
                      ))}
                    </div>

                    {/* Routes tab */}
                    {tab === 'routes' && (
                      <div className="p-4 space-y-3">
                        {isAdmin && (
                          <button
                            onClick={() => setRouteModal({ serviceId: service.id, route: {} })}
                            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
                          >
                            <Plus className="w-4 h-4" /> Προσθήκη δρομολογίου
                          </button>
                        )}
                        {service.routes.length === 0 ? (
                          <p className="text-sm text-gray-400">Δεν υπάρχουν δρομολόγια.</p>
                        ) : service.routes.map(route => (
                          <div key={route.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-3 p-3 bg-gray-50">
                              <span className="font-medium text-sm text-gray-800 flex-1">{route.name}</span>
                              {route.description && <span className="text-xs text-gray-500">{route.description}</span>}
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => setRouteModal({ serviceId: service.id, route })}
                                    className="p-1 hover:bg-gray-200 rounded text-gray-500"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteRoute(service.id, route.id)}
                                    className="p-1 hover:bg-red-100 rounded text-red-500"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setStopModal({ serviceId: service.id, routeId: route.id, stop: {} })}
                                    className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100"
                                  >
                                    + Στάση
                                  </button>
                                </>
                              )}
                            </div>
                            {route.stops.length > 0 && (
                              <div className="divide-y divide-gray-100">
                                {[...route.stops].sort((a, b) => a.order - b.order).map((stop, i) => (
                                  <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-medium shrink-0">
                                      {i + 1}
                                    </span>
                                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-gray-800">{stop.name}</span>
                                      {(stop as any).address && (
                                        <p className="text-xs text-gray-400 truncate">{(stop as any).address}</p>
                                      )}
                                    </div>
                                    {stop.pickupTime && (
                                      <span className="flex items-center gap-1 text-xs text-green-700">
                                        <Clock className="w-3 h-3" />↑ {stop.pickupTime}
                                      </span>
                                    )}
                                    {stop.dropoffTime && (
                                      <span className="flex items-center gap-1 text-xs text-blue-700">
                                        <Clock className="w-3 h-3" />↓ {stop.dropoffTime}
                                      </span>
                                    )}
                                    {isAdmin && (
                                      <div className="flex gap-1 shrink-0">
                                        <button
                                          onClick={() => setStopModal({ serviceId: service.id, routeId: route.id, stop })}
                                          className="p-1 hover:bg-gray-100 rounded text-gray-400"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => deleteStop(service.id, route.id, stop.id)}
                                          className="p-1 hover:bg-red-50 rounded text-red-400"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Students tab */}
                    {tab === 'students' && (
                      <div className="p-4 space-y-3">
                        {isAdmin && (
                          <button
                            onClick={() => openAssign(service.id)}
                            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
                          >
                            <Plus className="w-4 h-4" /> Ανάθεση μαθητή
                          </button>
                        )}
                        {!studentServiceData[service.id] ? (
                          <p className="text-sm text-gray-400">Φόρτωση...</p>
                        ) : studentServiceData[service.id].length === 0 ? (
                          <p className="text-sm text-gray-400">Κανένας μαθητής δεν έχει ανατεθεί.</p>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {studentServiceData[service.id].map(ss => (
                              <div key={ss.id} className="flex items-center gap-3 py-2.5">
                                <PersonAvatar name={ss.student.fullName} src={ss.student.avatarUrl} tone="soft" letters={1} className="w-8 h-8 rounded-full text-xs" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{ss.student.fullName}</p>
                                  <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                                    {ss.route && <span className="flex items-center gap-0.5"><Bus className="w-3 h-3" />{ss.route.name}</span>}
                                    {ss.stop && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{ss.stop.name}</span>}
                                    {ss.pickupContact && (
                                      <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{ss.pickupContact}</span>
                                    )}
                                  </div>
                                  {ss.dailyTimes && Object.keys(ss.dailyTimes).length > 0 ? (
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                      {DAYS.filter(d => (ss.dailyTimes as DailyTimes)[d.key]).map(({ key, label }) => {
                                        const dt = (ss.dailyTimes as DailyTimes)[key]!;
                                        return (
                                          <span key={key} className="text-xs text-gray-500">
                                            <span className="font-medium">{label}</span>
                                            {dt.pickup && <span className="text-green-700 ml-1">↑{dt.pickup}</span>}
                                            {dt.dropoff && <span className="text-blue-700 ml-1">↓{dt.dropoff}</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 mt-0.5 text-xs">
                                      {(ss.pickupTime ?? ss.stop?.pickupTime) && (
                                        <span className="text-green-700">↑ {ss.pickupTime ?? ss.stop?.pickupTime}</span>
                                      )}
                                      {(ss.dropoffTime ?? ss.stop?.dropoffTime) && (
                                        <span className="text-blue-700">↓ {ss.dropoffTime ?? ss.stop?.dropoffTime}</span>
                                      )}
                                    </div>
                                  )}
                                  {ss.notes && <p className="text-xs text-gray-400 mt-0.5">{ss.notes}</p>}
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => openEditStudent(service.id, ss)}
                                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                                      title="Επεξεργασία"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => removeStudentService(service.id, ss.id)}
                                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                                      title="Αφαίρεση"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Service modal ─────────────────────────────────────────────── */}
      {serviceModal !== null && (
        <Modal title={serviceModal.id ? 'Επεξεργασία Παροχής' : 'Νέα Παροχή'} onClose={() => setServiceModal(null)}>
          <div className="space-y-4">
            <Field label="Όνομα *">
              <input className={inputCls} value={serviceModal.name ?? ''} onChange={e => setServiceModal(p => ({ ...p!, name: e.target.value }))} placeholder="π.χ. Σχολικό Λεωφορείο" />
            </Field>
            <Field label="Τύπος">
              <select className={inputCls} value={serviceModal.serviceType ?? 'bus'} onChange={e => setServiceModal(p => ({ ...p!, serviceType: e.target.value }))}>
                {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Περιγραφή">
              <textarea rows={2} className={inputCls + ' resize-none'} value={serviceModal.description ?? ''} onChange={e => setServiceModal(p => ({ ...p!, description: e.target.value }))} />
            </Field>
            <Field label="Μηνιαίο κόστος (€)">
              <input type="number" min="0" step="0.01" className={inputCls} value={serviceModal.monthlyCost ?? ''} onChange={e => setServiceModal(p => ({ ...p!, monthlyCost: e.target.value ? Number(e.target.value) : undefined }))} />
            </Field>
          </div>
          <ModalFooter onCancel={() => setServiceModal(null)} onSave={saveService} saving={saving} disabled={!serviceModal.name?.trim()} />
        </Modal>
      )}

      {/* ─── Route modal ───────────────────────────────────────────────── */}
      {routeModal && (
        <Modal title={routeModal.route?.id ? 'Επεξεργασία Δρομολογίου' : 'Νέο Δρομολόγιο'} onClose={() => setRouteModal(null)}>
          <div className="space-y-4">
            <Field label="Όνομα *">
              <input className={inputCls} value={routeModal.route?.name ?? ''} onChange={e => setRouteModal(p => ({ ...p!, route: { ...p!.route!, name: e.target.value } }))} placeholder="π.χ. Γραμμή Α - Κέντρο" />
            </Field>
            <Field label="Περιγραφή">
              <input className={inputCls} value={routeModal.route?.description ?? ''} onChange={e => setRouteModal(p => ({ ...p!, route: { ...p!.route!, description: e.target.value } }))} />
            </Field>
          </div>
          <ModalFooter onCancel={() => setRouteModal(null)} onSave={saveRoute} saving={saving} disabled={!routeModal.route?.name?.trim()} />
        </Modal>
      )}

      {/* ─── Stop modal ────────────────────────────────────────────────── */}
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
                <input className={inputCls} value={(stopModal.stop as any)?.address ?? ''} onChange={e => setStopModal(p => ({ ...p!, stop: { ...p!.stop!, address: e.target.value } as any }))} placeholder="π.χ. Λεωφ. Αθηνών 42, κοντά στο φαρμακείο" />
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

      {/* ─── Edit student assignment modal ────────────────────────────── */}
      {editStudentModal && (
        <Modal title="Επεξεργασία Ανάθεσης" onClose={() => setEditStudentModal(null)}>
          {(() => {
            const svc = services.find(s => s.id === editStudentModal.serviceId);
            const selectedRoute = svc?.routes.find(r => r.id === editStudentForm.routeId);
            return (
              <div className="space-y-4">
                {svc && svc.routes.length > 0 && (
                  <Field label="Δρομολόγιο">
                    <select className={inputCls} value={editStudentForm.routeId} onChange={e => setEditStudentForm((p: any) => ({ ...p, routeId: e.target.value, stopId: '' }))}>
                      <option value="">— χωρίς δρομολόγιο —</option>
                      {svc.routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </Field>
                )}
                {selectedRoute && selectedRoute.stops.length > 0 && (
                  <Field label="Στάση">
                    <select className={inputCls} value={editStudentForm.stopId} onChange={e => setEditStudentForm((p: any) => ({ ...p, stopId: e.target.value }))}>
                      <option value="">— χωρίς στάση —</option>
                      {[...selectedRoute.stops].sort((a, b) => a.order - b.order).map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.pickupTime ? ` (↑${s.pickupTime})` : ''}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Παραλαμβάνεται από">
                  <input className={inputCls} value={editStudentForm.pickupContact ?? ''} onChange={e => setEditStudentForm((p: any) => ({ ...p, pickupContact: e.target.value }))} placeholder="π.χ. Μαρία Παπαδοπούλου (μαμά)" />
                </Field>
                <Field label="Προεπιλεγμένες ώρες">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Παραλαβή ↑</span>
                      <input type="time" className={inputCls} value={editStudentForm.pickupTime} onChange={e => setEditStudentForm((p: any) => ({ ...p, pickupTime: e.target.value }))} />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Αποβίβαση ↓</span>
                      <input type="time" className={inputCls} value={editStudentForm.dropoffTime} onChange={e => setEditStudentForm((p: any) => ({ ...p, dropoffTime: e.target.value }))} />
                    </div>
                  </div>
                </Field>
                <Field label="Ώρες ανά ημέρα (προαιρετικό)">
                  <DailyTimesGrid
                    value={editStudentForm.dailyTimes ?? {}}
                    onChange={v => setEditStudentForm((p: any) => ({ ...p, dailyTimes: v }))}
                  />
                </Field>
                <Field label="Σημειώσεις">
                  <input className={inputCls} value={editStudentForm.notes} onChange={e => setEditStudentForm((p: any) => ({ ...p, notes: e.target.value }))} placeholder="π.χ. κατεβαίνει μόνο Δευτέρα-Τετάρτη" />
                </Field>
              </div>
            );
          })()}
          <ModalFooter onCancel={() => setEditStudentModal(null)} onSave={saveEditStudent} saving={saving} disabled={false} />
        </Modal>
      )}

      {/* ─── Assign student modal ──────────────────────────────────────── */}
      {assignModal && (
        <Modal title="Ανάθεση Μαθητή" onClose={() => setAssignModal(null)}>
          {(() => {
            const svc = services.find(s => s.id === assignModal.serviceId);
            const selectedRoute = svc?.routes.find(r => r.id === assignForm.routeId);
            return (
              <div className="space-y-4">
                <Field label="Μαθητής *">
                  <select className={inputCls} value={assignForm.studentId} onChange={e => setAssignForm((p: any) => ({ ...p, studentId: e.target.value }))}>
                    <option value="">Επιλέξτε μαθητή...</option>
                    {allStudents.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                  </select>
                </Field>
                {svc && svc.routes.length > 0 && (
                  <Field label="Δρομολόγιο">
                    <select className={inputCls} value={assignForm.routeId} onChange={e => setAssignForm((p: any) => ({ ...p, routeId: e.target.value, stopId: '' }))}>
                      <option value="">— χωρίς δρομολόγιο —</option>
                      {svc.routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </Field>
                )}
                {selectedRoute && selectedRoute.stops.length > 0 && (
                  <Field label="Στάση">
                    <select className={inputCls} value={assignForm.stopId} onChange={e => setAssignForm((p: any) => ({ ...p, stopId: e.target.value }))}>
                      <option value="">— χωρίς στάση —</option>
                      {[...selectedRoute.stops].sort((a, b) => a.order - b.order).map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.pickupTime ? ` (↑${s.pickupTime})` : ''}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Παραλαμβάνεται από">
                  <input className={inputCls} value={assignForm.pickupContact ?? ''} onChange={e => setAssignForm((p: any) => ({ ...p, pickupContact: e.target.value }))} placeholder="π.χ. Μαρία Παπαδοπούλου (μαμά)" />
                </Field>
                <Field label="Προεπιλεγμένες ώρες">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Παραλαβή ↑</span>
                      <input type="time" className={inputCls} value={assignForm.pickupTime} onChange={e => setAssignForm((p: any) => ({ ...p, pickupTime: e.target.value }))} />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Αποβίβαση ↓</span>
                      <input type="time" className={inputCls} value={assignForm.dropoffTime} onChange={e => setAssignForm((p: any) => ({ ...p, dropoffTime: e.target.value }))} />
                    </div>
                  </div>
                </Field>
                <Field label="Ώρες ανά ημέρα (προαιρετικό)">
                  <DailyTimesGrid
                    value={assignForm.dailyTimes ?? {}}
                    onChange={v => setAssignForm((p: any) => ({ ...p, dailyTimes: v }))}
                  />
                </Field>
                <Field label="Σημειώσεις">
                  <input className={inputCls} value={assignForm.notes} onChange={e => setAssignForm((p: any) => ({ ...p, notes: e.target.value }))} placeholder="π.χ. κατεβαίνει μόνο Δευτέρα-Τετάρτη" />
                </Field>
              </div>
            );
          })()}
          <ModalFooter onCancel={() => setAssignModal(null)} onSave={saveAssign} saving={saving} disabled={!assignForm.studentId} />
        </Modal>
      )}
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
                <input
                  type="time"
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={value[key]?.pickup ?? ''}
                  onChange={e => set(key, 'pickup', e.target.value)}
                />
              </td>
              <td className="py-1.5">
                <input
                  type="time"
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={value[key]?.dropoff ?? ''}
                  onChange={e => set(key, 'dropoff', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[92vh] flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
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
