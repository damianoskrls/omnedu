'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { extraServicesApi, studentsApi } from '@/lib/api';
import { Map } from 'lucide-react';
import { useStoredUser } from '@/lib/auth';
import {
  Bus, Plus, X, ChevronDown, ChevronUp, Pencil, Trash2,
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
  homeAddress?: string; homeLat?: number; homeLng?: number;
  notes?: string;
  student: { id: string; fullName: string; avatarUrl?: string };
  route?: { id: string; name: string };
  stop?: { id: string; name: string; pickupTime?: string; dropoffTime?: string };
};
type Student = { id: string; fullName: string };

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'routes' | 'students' | 'schedule'>>({});

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
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const all = (await extraServicesApi.list(schoolId)) as unknown as Service[];
      setServices(all.filter(s => s.serviceType === 'bus'));
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

  const switchTab = async (serviceId: string, tab: 'routes' | 'students' | 'schedule') => {
    setActiveTab(prev => ({ ...prev, [serviceId]: tab }));
    if (tab === 'students' || tab === 'schedule') await loadStudents(serviceId);
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
    setAssignForm({ studentId: '', routeId: '', stopId: '', serviceMode: 'both', pickupTime: '', dropoffTime: '', dailyTimes: {} as DailyTimes, pickupContact: '', dropoffContact: '', pickupPersons: [], homeAddress: '', homeLat: undefined, homeLng: undefined, notes: '' });
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
            const tab = activeTab[service.id] ?? 'routes';
            return (
              <div key={service.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Bus className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{service.name}</span>
                    </div>
                    {service.description && <p className="text-sm text-gray-500 mt-0.5">{service.description}</p>}
                    <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{service.routes.length} δρομολόγια</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{service._count?.studentServices ?? 0} μαθητές</span>
                      {service.pickupCost != null && <span>Μία κατεύθυνση: {service.pickupCost}€</span>}
                      {service.monthlyCost != null && <span>Αμφίδρομο: {service.monthlyCost}€/μήνα</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && (
                      <button
                        onClick={() => setServiceModal({ ...service })}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        title="Ρυθμίσεις"
                      >
                        <Settings className="w-4 h-4" />
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

                {expandedService === service.id && (
                  <div className="border-t border-gray-100">
                    <div className="flex border-b border-gray-100 bg-gray-50">
                      {(['routes', 'students', 'schedule'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => switchTab(service.id, t)}
                          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            tab === t
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {t === 'routes' ? 'Δρομολόγια' : t === 'students' ? 'Μαθητές' : 'Πρόγραμμα'}
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
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm text-gray-800">{route.name}</span>
                                  {route.direction && route.direction !== 'both' && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${route.direction === 'pickup' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {route.direction === 'pickup' ? '↑ Παραλαβή' : '↓ Αποστολή'}
                                    </span>
                                  )}
                                  {(!route.direction || route.direction === 'both') && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">↑↓ Αμφίδρομο</span>
                                  )}
                                </div>
                                <div className="flex gap-3 mt-0.5 flex-wrap">
                                  {route.description && <span className="text-xs text-gray-500">{route.description}</span>}
                                  {route.driverName && <span className="text-xs text-gray-500 flex items-center gap-1"><User className="w-3 h-3" />{route.driverName}</span>}
                                  {route.busNumber && <span className="text-xs text-gray-500 flex items-center gap-1"><Bus className="w-3 h-3" />{route.busNumber}</span>}
                                </div>
                              </div>
                              {(route.stops ?? []).some(s => (s as any).latitude) && (
                                <button
                                  onClick={() => { loadStudents(service.id); setRouteMapModal({ serviceId: service.id, routeId: route.id }); }}
                                  className="p-1 hover:bg-indigo-100 rounded text-indigo-500"
                                  title="Χάρτης δρομολογίου"
                                >
                                  <Map className="w-3.5 h-3.5" />
                                </button>
                              )}
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
                            {(route.stops ?? []).length > 0 && (
                              <div className="divide-y divide-gray-100">
                                {[...(route.stops ?? [])].sort((a, b) => a.order - b.order).map((stop, i) => (
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

                    {/* Schedule tab */}
                    {tab === 'schedule' && (
                      <div className="p-4">
                        {!studentServiceData[service.id] ? (
                          <p className="text-sm text-gray-400">Φόρτωση...</p>
                        ) : studentServiceData[service.id].length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-8">Κανένας μαθητής δεν έχει ανατεθεί ακόμα.</p>
                        ) : (() => {
                          const students = studentServiceData[service.id];
                          const pickupGroup = students
                            .filter(ss => ss.serviceMode === 'pickup' || ss.serviceMode === 'both')
                            .map(ss => ({ ...ss, effectiveTime: ss.pickupTime ?? ss.stop?.pickupTime ?? '' }))
                            .sort((a, b) => a.effectiveTime.localeCompare(b.effectiveTime));
                          const dropoffGroup = students
                            .filter(ss => ss.serviceMode === 'dropoff' || ss.serviceMode === 'both')
                            .map(ss => ({ ...ss, effectiveTime: ss.dropoffTime ?? ss.stop?.dropoffTime ?? '' }))
                            .sort((a, b) => a.effectiveTime.localeCompare(b.effectiveTime));
                          return (
                            <div className="space-y-6">
                              {pickupGroup.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold">↑</span>
                                    <span className="text-sm font-semibold text-green-800">Παραλαβή — {pickupGroup.length} μαθητές</span>
                                  </div>
                                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                                    {pickupGroup.map(ss => (
                                      <ScheduleRow key={ss.id + '-p'} ss={ss} direction="pickup" />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {dropoffGroup.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">↓</span>
                                    <span className="text-sm font-semibold text-blue-800">Αποστολή — {dropoffGroup.length} μαθητές</span>
                                  </div>
                                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                                    {dropoffGroup.map(ss => (
                                      <ScheduleRow key={ss.id + '-d'} ss={ss} direction="dropoff" />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                                  {ss.student.fullName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900">{ss.student.fullName}</p>
                                    {ss.serviceMode && ss.serviceMode !== 'both' && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ss.serviceMode === 'pickup' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                        {ss.serviceMode === 'pickup' ? '↑ Παραλαβή' : '↓ Αποστολή'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-3 text-xs text-gray-500 flex-wrap mt-0.5">
                                    {ss.route && <span className="flex items-center gap-0.5"><Bus className="w-3 h-3" />{ss.route.name}</span>}
                                    {ss.stop && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{ss.stop.name}</span>}
                                    {ss.homeAddress && <span className="flex items-center gap-0.5"><Home className="w-3 h-3" />{ss.homeAddress}</span>}
                                    {ss.pickupContact && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{ss.pickupContact}</span>}
                                    {ss.pickupPersons && ss.pickupPersons.length > 0 && (
                                      <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{ss.pickupPersons.map(p => p.name).join(', ')}</span>
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
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => removeStudentService(service.id, ss.id)}
                                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
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

      {/* ─── Service (bus) modal ──────────────────────────────────────────── */}
      {serviceModal !== null && (
        <Modal title={serviceModal.id ? 'Ρυθμίσεις Λεωφορείου' : 'Νέο Λεωφορείο'} onClose={() => setServiceModal(null)}>
          <div className="space-y-4">
            <Field label="Όνομα *">
              <input className={inputCls} value={serviceModal.name ?? ''} onChange={e => setServiceModal(p => ({ ...p!, name: e.target.value }))} placeholder="π.χ. Λεωφορείο Α" />
            </Field>
            <Field label="Περιγραφή">
              <textarea rows={2} className={inputCls + ' resize-none'} value={serviceModal.description ?? ''} onChange={e => setServiceModal(p => ({ ...p!, description: e.target.value }))} />
            </Field>
            <div className="bg-gray-50 rounded-xl p-3 space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Τιμολόγηση</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Μία κατεύθυνση (€/μήνα)">
                  <input type="number" min="0" step="0.01" className={inputCls} value={(serviceModal as any).pickupCost ?? ''} onChange={e => setServiceModal(p => ({ ...p!, pickupCost: e.target.value ? Number(e.target.value) : undefined } as any))} placeholder="40.00" />
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
        <Modal title="Ανάθεση Μαθητή στο Σχολικό" onClose={() => setAssignModal(null)} wide>
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
                <StudentAssignForm
                  form={assignForm}
                  onChange={setAssignForm}
                  svc={svc}
                  selectedRoute={selectedRoute}
                />
              </div>
            );
          })()}
          <ModalFooter onCancel={() => setAssignModal(null)} onSave={saveAssign} saving={saving} disabled={!assignForm.studentId} />
        </Modal>
      )}
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

      {/* Notes */}
      <Field label="Σημειώσεις">
        <input className={inputCls} value={form.notes ?? ''} onChange={e => onChange({ ...form, notes: e.target.value })} placeholder="π.χ. κατεβαίνει μόνο Δευτέρα-Τετάρτη" />
      </Field>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[92vh] flex flex-col overflow-hidden`}>
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
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
        {ss.student.fullName.charAt(0)}
      </div>
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
