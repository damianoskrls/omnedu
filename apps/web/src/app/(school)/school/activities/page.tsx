'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { activitiesApi, studentsApi, classesApi, levelsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  Plus, X, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Users, Euro,
  Calendar, Trash2, BookOpen, UserCheck, CalendarDays, Zap, Upload,
} from 'lucide-react';
import { AudienceSelector, AudienceValue, audienceLabel } from '@/components/AudienceSelector';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { PersonAvatar } from '@/components/PersonAvatar';

// ── Types ─────────────────────────────────────────────────────────────────────

type Activity = {
  id: string; title: string; description?: string; imageUrl?: string; activityType: string;
  monthlyCost?: number; oneTimeCost?: number; maxCapacity?: number;
  startsOn?: string; endsOn?: string; deadline?: string; isActive: boolean;
  audienceType?: string; audienceIds?: string;
  _count?: { registrations: number };
};
type Registration = {
  id: string; status: string; registeredAt: string; enrolledByAdmin?: boolean; notes?: string;
  student: { id: string; fullName: string; avatarUrl?: string };
  parent?: { id: string; fullName: string; email: string } | null;
};
type ScheduleSlot = {
  id: string; dayOfWeek: number; startTime?: string; endTime?: string; notes?: string;
  activity: { id: string; title: string; activityType: string };
};
type Instructor = {
  id: string; name: string; title?: string; bio?: string; photoUrl?: string; isActive: boolean;
  activityLinks: { activityId: string; activity: { id: string; title: string } }[];
};
type Student = { id: string; fullName: string };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Αναμονή',      color: 'bg-yellow-100 text-yellow-800' },
  approved:  { label: 'Εγκρίθηκε',   color: 'bg-green-100 text-green-800' },
  rejected:  { label: 'Απορρίφθηκε', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Ακυρώθηκε',   color: 'bg-gray-100 text-gray-600' },
};

const TYPES = [
  { value: 'excursion', label: 'Εκδρομή' },
  { value: 'sport',    label: 'Αθλητισμός' },
  { value: 'art',      label: 'Τέχνες' },
  { value: 'music',    label: 'Μουσική' },
  { value: 'language', label: 'Γλώσσα' },
  { value: 'other',    label: 'Άλλο' },
];

const DAYS = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
const DAY_COLORS = [
  'bg-teal-50 border-teal-200 text-teal-800',
  'bg-sky-50 border-sky-200 text-sky-800',
  'bg-yellow-50 border-yellow-200 text-yellow-800',
  'bg-pink-50 border-pink-200 text-pink-800',
  'bg-violet-50 border-violet-200 text-violet-800',
  'bg-orange-50 border-orange-200 text-orange-800',
  'bg-gray-50 border-gray-200 text-gray-800',
];

const emptyActivity = (): Partial<Activity> => ({ title: '', activityType: 'other', isActive: true });

function monthValue(iso?: string) {
  if (!iso) return '';
  return iso.slice(0, 7);
}

function monthStart(ym: string) {
  return ym ? `${ym}-01` : undefined;
}

function monthEnd(ym: string) {
  if (!ym) return undefined;
  const [year, month] = ym.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${ym}-${String(last).padStart(2, '0')}`;
}

function formatMonth(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
const emptyInstructor = () => ({ name: '', title: '', bio: '', photoUrl: '' });

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';

  const [activeTab, setActiveTab] = useState<'activities' | 'schedule' | 'instructors'>('activities');

  // ── Activities tab state ───────────────────────────────────────────────────
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Record<string, Registration[]>>({});
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editActivity, setEditActivity] = useState<Partial<Activity>>(emptyActivity());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [inlineEnroll, setInlineEnroll] = useState<Record<string, { studentId: string; notes: string }>>({});
  const [enrolling, setEnrolling] = useState<string | null>(null);

  // ── Schedule tab state ─────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [newSlot, setNewSlot] = useState({ activityId: '', dayOfWeek: 1, startTime: '', endTime: '' });

  // ── Instructors tab state ──────────────────────────────────────────────────
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const [editInstructor, setEditInstructor] = useState<Partial<Instructor> & typeof emptyInstructor>(emptyInstructor() as any);
  const [expandedInstructorId, setExpandedInstructorId] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string>('');
  const instructorPhotoInputRef = useRef<HTMLInputElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadActivities = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError('');
    try { setActivities((await activitiesApi.list(schoolId)) as unknown as Activity[]); }
    catch (err: any) {
      const message = err?.message;
      setLoadError(Array.isArray(message) ? message.join(' ') : message || 'Οι δραστηριότητες δεν φορτώθηκαν. Δοκίμασε ξανά.');
      setActivities([]);
    }
    finally { setLoading(false); }
  }, [schoolId]);

  const loadSchedule = useCallback(async () => {
    if (!schoolId) return;
    setScheduleLoading(true);
    try { setSchedule((await activitiesApi.getSchedule(schoolId)) as unknown as ScheduleSlot[]); }
    finally { setScheduleLoading(false); }
  }, [schoolId]);

  const loadInstructors = useCallback(async () => {
    if (!schoolId) return;
    setInstructorsLoading(true);
    try { setInstructors((await activitiesApi.getInstructors(schoolId)) as unknown as Instructor[]); }
    finally { setInstructorsLoading(false); }
  }, [schoolId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);
  useEffect(() => { if (!schoolId || !isAdmin) return; studentsApi.list(schoolId).then((r: any) => setStudents(r || [])); }, [schoolId, isAdmin]);
  useEffect(() => {
    if (!schoolId) return;
    Promise.all([classesApi.list(schoolId) as Promise<any>, levelsApi.list(schoolId) as Promise<any>])
      .then(([c, l]) => { setClasses(Array.isArray(c) ? c : []); setLevels(Array.isArray(l) ? l : []); });
  }, [schoolId]);

  useEffect(() => {
    if (activeTab === 'schedule' && schedule.length === 0) loadSchedule();
    if (activeTab === 'instructors' && instructors.length === 0) loadInstructors();
  }, [activeTab]);

  // ── Activity handlers ──────────────────────────────────────────────────────

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!registrations[id]) {
      const regs = await activitiesApi.getRegistrations(schoolId, id) as unknown as Registration[];
      setRegistrations(prev => ({ ...prev, [id]: regs }));
    }
  };

  const updateStatus = async (activityId: string, regId: string, status: string) => {
    setActionLoading(regId);
    try {
      await activitiesApi.updateRegistrationStatus(schoolId, activityId, regId, status);
      setRegistrations(prev => ({ ...prev, [activityId]: prev[activityId].map(r => r.id === regId ? { ...r, status } : r) }));
    } finally { setActionLoading(null); }
  };

  const saveActivity = async () => {
    if (!editActivity.title?.trim()) return;
    setSaving(true);
    try {
      setSaveError('');
      const audienceIds: string[] = (() => { try { return JSON.parse(editActivity.audienceIds ?? '[]'); } catch { return []; } })();
      const startMonth = monthValue(editActivity.startsOn);
      const endMonth = monthValue(editActivity.endsOn);
      const payload = {
        title: editActivity.title,
        description: editActivity.description ?? '',
        activityType: editActivity.activityType,
        monthlyCost: editActivity.monthlyCost != null && editActivity.monthlyCost !== ('' as any) ? Number(editActivity.monthlyCost) : null,
        oneTimeCost: editActivity.oneTimeCost != null && editActivity.oneTimeCost !== ('' as any) ? Number(editActivity.oneTimeCost) : null,
        startsOn: monthStart(startMonth) ?? null,
        endsOn: monthEnd(endMonth) ?? null,
        deadline: editActivity.deadline || null,
        isActive: editActivity.isActive ?? true,
        audienceType: editActivity.audienceType ?? 'all',
        audienceIds: JSON.stringify(audienceIds),
      };
      const saved = (editActivity.id
        ? await activitiesApi.update(schoolId, editActivity.id, payload)
        : await activitiesApi.create(schoolId, payload)) as unknown as Activity;
      if (imageFile && saved?.id) {
        await activitiesApi.uploadImage(schoolId, saved.id, imageFile);
      }
      setShowActivityModal(false);
      setImageFile(null);
      setImagePreview(null);
      await loadActivities();
    } catch (err: any) {
      setSaveError(typeof err?.message === 'string' ? err.message : 'Η αποθήκευση απέτυχε. Δοκιμάστε ξανά.');
    } finally { setSaving(false); }
  };

  const submitEnroll = async (activityId: string) => {
    const form = inlineEnroll[activityId];
    if (!form?.studentId) return;
    setEnrolling(activityId);
    try {
      const reg = await activitiesApi.adminEnroll(schoolId, activityId, { studentId: form.studentId, notes: form.notes || undefined }) as unknown as Registration;
      setRegistrations(prev => ({ ...prev, [activityId]: [reg, ...(prev[activityId] ?? []).filter(r => r.student.id !== form.studentId)] }));
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, _count: { registrations: (a._count?.registrations ?? 0) + 1 } } : a));
      setInlineEnroll(prev => ({ ...prev, [activityId]: { studentId: '', notes: '' } }));
    } finally { setEnrolling(null); }
  };

  const removeReg = async (activityId: string, regId: string) => {
    if (!confirm('Να αφαιρεθεί ο μαθητής;')) return;
    await activitiesApi.removeRegistration(schoolId, activityId, regId);
    setRegistrations(prev => ({ ...prev, [activityId]: prev[activityId]?.filter(r => r.id !== regId) ?? [] }));
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, _count: { registrations: Math.max(0, (a._count?.registrations ?? 1) - 1) } } : a));
  };

  const deactivate = async (id: string) => {
    if (!confirm('Να αρχειοθετηθεί η δραστηριότητα;')) return;
    await activitiesApi.remove(schoolId, id);
    await loadActivities();
  };

  // ── Schedule handlers ──────────────────────────────────────────────────────

  const addSlot = async () => {
    if (!newSlot.activityId) return;
    setSaving(true);
    try {
      await activitiesApi.addScheduleSlot(schoolId, newSlot.activityId, {
        dayOfWeek: newSlot.dayOfWeek,
        startTime: newSlot.startTime || undefined,
        endTime: newSlot.endTime || undefined,
      });
      setShowSlotModal(false);
      setNewSlot({ activityId: '', dayOfWeek: 1, startTime: '', endTime: '' });
      await loadSchedule();
    } finally { setSaving(false); }
  };

  const deleteSlot = async (activityId: string, slotId: string) => {
    await activitiesApi.deleteScheduleSlot(schoolId, activityId, slotId);
    setSchedule(prev => prev.filter(s => s.id !== slotId));
  };

  // ── Instructor handlers ────────────────────────────────────────────────────

  const saveInstructor = async () => {
    if (!(editInstructor as any).name?.trim()) return;
    setSaving(true);
    try {
      const data = { name: (editInstructor as any).name, title: (editInstructor as any).title || undefined, bio: (editInstructor as any).bio || undefined };
      let instructorId = (editInstructor as any).id;
      if (instructorId) {
        await activitiesApi.updateInstructor(schoolId, instructorId, data);
      } else {
        const created = await activitiesApi.createInstructor(schoolId, data) as any;
        instructorId = created.id;
      }
      if (pendingPhotoFile && instructorId) {
        await activitiesApi.uploadInstructorPhoto(schoolId, instructorId, pendingPhotoFile);
      }
      setPendingPhotoFile(null);
      setPendingPhotoPreview('');
      setShowInstructorModal(false);
      await loadInstructors();
    } finally { setSaving(false); }
  };

  const deleteInstructor = async (id: string) => {
    if (!confirm('Να διαγραφεί αυτός ο εκπαιδευτής;')) return;
    await activitiesApi.deleteInstructor(schoolId, id);
    setInstructors(prev => prev.filter(i => i.id !== id));
  };

  const toggleInstructorActivity = async (instructorId: string, activityId: string, assigned: boolean) => {
    if (assigned) await activitiesApi.unassignInstructor(schoolId, activityId, instructorId);
    else await activitiesApi.assignInstructor(schoolId, activityId, instructorId);
    await loadInstructors();
  };

  // ── Derived: schedule by day ───────────────────────────────────────────────

  const scheduleByDay = DAYS.map((day, idx) => ({
    day, dayIdx: idx + 1,
    slots: schedule.filter(s => s.dayOfWeek === idx + 1).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
  })).filter(d => d.slots.length > 0 || d.dayIdx <= 5);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Δραστηριότητες</h1>
          <p className="text-sm text-gray-500 mt-1">Εκδρομές, δραστηριότητες, πρόγραμμα και εκπαιδευτές</p>
        </div>
        {isAdmin && activeTab === 'activities' && (
          <button onClick={() => { setEditActivity(emptyActivity()); setImageFile(null); setImagePreview(null); setSaveError(''); setShowActivityModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Νέα Δραστηριότητα
          </button>
        )}
        {isAdmin && activeTab === 'schedule' && (
          <button onClick={() => setShowSlotModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Προσθήκη στο Πρόγραμμα
          </button>
        )}
        {isAdmin && activeTab === 'instructors' && (
          <button onClick={() => { setEditInstructor(emptyInstructor() as any); setPendingPhotoFile(null); setPendingPhotoPreview(''); setShowInstructorModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Νέος Εκπαιδευτής
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'activities', label: 'Δραστηριότητες', icon: BookOpen },
          { key: 'schedule',   label: 'Πρόγραμμα',      icon: CalendarDays },
          { key: 'instructors',label: 'Εκπαιδευτές',     icon: UserCheck },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Tab: Activities ────────────────────────────────────────────────── */}
      {activeTab === 'activities' && (
        <>
          {loadError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}
          {loading ? (
            <div className="flex justify-center py-12 text-gray-400">Φόρτωση...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Δεν υπάρχουν δραστηριότητες</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(activity => (
                <div key={activity.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-4 flex items-start gap-4">
                    {activity.imageUrl && (
                      <img src={activity.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{activity.title}</span>
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                          {TYPES.find(t => t.value === activity.activityType)?.label ?? activity.activityType}
                        </span>
                        {!activity.isActive && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Αρχείο</span>}
                      </div>
                      {activity.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{activity.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                        {activity.monthlyCost != null && <span className="flex items-center gap-1"><Euro className="w-3 h-3" />{activity.monthlyCost}/μήνα</span>}
                        {activity.oneTimeCost != null && <span className="flex items-center gap-1"><Euro className="w-3 h-3" />{activity.oneTimeCost} εφάπαξ</span>}
                        {activity.startsOn && (
                          <span className="flex items-center gap-1 capitalize">
                            <Calendar className="w-3 h-3" />
                            {formatMonth(activity.startsOn)}
                            {activity.endsOn && ` – ${formatMonth(activity.endsOn)}`}
                          </span>
                        )}
                        {activity.deadline && <span className="flex items-center gap-1 text-orange-600"><Clock className="w-3 h-3" />Λήξη εγγρ.: {format(new Date(activity.deadline), 'dd/MM/yyyy', { locale: el })}</span>}
                        <span className="flex items-center gap-1 text-indigo-600 font-medium"><Users className="w-3 h-3" />{activity._count?.registrations ?? 0} εγγεγραμμένοι</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && (
                        <>
                          <button onClick={() => { setEditActivity({ ...activity }); setImageFile(null); setImagePreview(activity.imageUrl ?? null); setSaveError(''); setShowActivityModal(true); }} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Επεξεργασία</button>
                          {activity.isActive && <button onClick={() => deactivate(activity.id)} className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Αρχείο</button>}
                        </>
                      )}
                      <button onClick={() => toggleExpand(activity.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                        {expandedId === activity.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {expandedId === activity.id && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Εγγραφές μαθητών</h3>
                      {isAdmin && (
                        <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg p-2">
                          <select className="flex-1 text-sm border-0 bg-transparent focus:outline-none text-gray-700"
                            value={inlineEnroll[activity.id]?.studentId ?? ''}
                            onChange={e => setInlineEnroll(prev => ({ ...prev, [activity.id]: { ...prev[activity.id], studentId: e.target.value, notes: prev[activity.id]?.notes ?? '' } }))}>
                            <option value="">+ Επιλέξτε μαθητή...</option>
                            {students.filter(s => !registrations[activity.id]?.some(r => r.student.id === s.id && r.status !== 'cancelled'))
                              .map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                          </select>
                          <input className="w-36 text-sm border-l border-gray-200 pl-2 bg-transparent focus:outline-none text-gray-600 placeholder-gray-400"
                            placeholder="Σημειώσεις..." value={inlineEnroll[activity.id]?.notes ?? ''}
                            onChange={e => setInlineEnroll(prev => ({ ...prev, [activity.id]: { ...prev[activity.id], notes: e.target.value, studentId: prev[activity.id]?.studentId ?? '' } }))} />
                          <button disabled={!inlineEnroll[activity.id]?.studentId || enrolling === activity.id}
                            onClick={() => submitEnroll(activity.id)}
                            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 shrink-0">
                            {enrolling === activity.id ? '...' : 'Ανάθεση'}
                          </button>
                        </div>
                      )}
                      {!registrations[activity.id] ? <p className="text-sm text-gray-400">Φόρτωση...</p>
                        : registrations[activity.id].length === 0 ? <p className="text-sm text-gray-400">Δεν υπάρχουν εγγραφές ακόμα.</p>
                        : (
                          <div className="space-y-2">
                            {registrations[activity.id].map(reg => (
                              <div key={reg.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200">
                                <PersonAvatar name={reg.student.fullName} src={reg.student.avatarUrl} tone="soft" letters={1} className="w-8 h-8 rounded-full text-xs" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900">{reg.student.fullName}</p>
                                    {reg.enrolledByAdmin && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Διαχ.</span>}
                                  </div>
                                  {reg.parent ? <p className="text-xs text-gray-500">{reg.parent.fullName} · {reg.parent.email}</p> : <p className="text-xs text-gray-400 italic">Άμεση ανάθεση</p>}
                                  {reg.notes && <p className="text-xs text-gray-400 mt-0.5">{reg.notes}</p>}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[reg.status]?.color}`}>{STATUS_LABELS[reg.status]?.label}</span>
                                {isAdmin && (
                                  <div className="flex gap-1 shrink-0">
                                    {reg.status === 'pending' && (
                                      <>
                                        <button disabled={actionLoading === reg.id} onClick={() => updateStatus(activity.id, reg.id, 'approved')} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 disabled:opacity-40"><CheckCircle className="w-4 h-4" /></button>
                                        <button disabled={actionLoading === reg.id} onClick={() => updateStatus(activity.id, reg.id, 'rejected')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40"><XCircle className="w-4 h-4" /></button>
                                      </>
                                    )}
                                    <button onClick={() => removeReg(activity.id, reg.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Schedule ──────────────────────────────────────────────────── */}
      {activeTab === 'schedule' && (
        scheduleLoading ? <div className="flex justify-center py-12 text-gray-400">Φόρτωση...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {scheduleByDay.slice(0, 5).map(({ day, dayIdx, slots }) => (
              <div key={dayIdx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-4 py-2 font-semibold text-sm border-b ${DAY_COLORS[dayIdx - 1]}`}>{day}</div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {slots.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-4">—</p>
                  ) : slots.map(slot => (
                    <div key={slot.id} className="group relative bg-indigo-50 rounded-lg px-3 py-2 text-xs">
                      <p className="font-semibold text-indigo-800 leading-tight">{slot.activity.title}</p>
                      {(slot.startTime || slot.endTime) && (
                        <p className="text-indigo-500 mt-0.5">{slot.startTime}{slot.endTime ? ` – ${slot.endTime}` : ''}</p>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteSlot(slot.activity.id, slot.id)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded text-indigo-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Tab: Instructors ───────────────────────────────────────────────── */}
      {activeTab === 'instructors' && (
        instructorsLoading ? <div className="flex justify-center py-12 text-gray-400">Φόρτωση...</div> : (
          instructors.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Δεν υπάρχουν εκπαιδευτές</p>
            </div>
          ) : (
            <div className="space-y-4">
              {instructors.map(instructor => (
                <div key={instructor.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-5 flex gap-4">
                    {instructor.photoUrl ? (
                      <img src={instructor.photoUrl} alt={instructor.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-bold shrink-0">
                        {instructor.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{instructor.name}</h3>
                          {instructor.title && <p className="text-sm text-gray-500">{instructor.title}</p>}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setEditInstructor({ ...instructor } as any); setPendingPhotoFile(null); setPendingPhotoPreview(instructor.photoUrl ?? ''); setShowInstructorModal(true); }}
                              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Επεξεργασία</button>
                            <button onClick={() => deleteInstructor(instructor.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 border border-transparent hover:border-red-200">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {instructor.activityLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {instructor.activityLinks.map(link => (
                            <span key={link.activityId} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">{link.activity.title}</span>
                          ))}
                        </div>
                      )}
                      {instructor.bio && (
                        <button onClick={() => setExpandedInstructorId(id => id === instructor.id ? null : instructor.id)}
                          className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                          {expandedInstructorId === instructor.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Βιογραφικό
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedInstructorId === instructor.id && instructor.bio && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-3">
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{instructor.bio}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Δραστηριότητες</p>
                      <div className="flex flex-wrap gap-2">
                        {activities.map(a => {
                          const assigned = instructor.activityLinks.some(l => l.activityId === a.id);
                          return (
                            <button key={a.id} onClick={() => toggleInstructorActivity(instructor.id, a.id, assigned)}
                              className={`text-xs px-3 py-1 rounded-full border transition-colors ${assigned ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                              {a.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )
      )}

      {/* ── Modal: Activity ─────────────────────────────────────────────────── */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editActivity.id ? 'Επεξεργασία Δραστηριότητας' : 'Νέα Δραστηριότητα'}</h2>
              <button onClick={() => setShowActivityModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Εικόνα</label>
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="h-16 w-16 rounded-xl object-cover border border-gray-100" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                      <Upload className="w-5 h-5" />
                    </div>
                  )}
                  <label className="text-sm font-medium text-[#77328D] cursor-pointer">
                    Ανέβασμα εικόνας
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Τίτλος *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editActivity.title ?? ''} onChange={e => setEditActivity(p => ({ ...p, title: e.target.value }))} placeholder="π.χ. Εκδρομή Αθήνα" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Τύπος</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editActivity.activityType ?? 'other'} onChange={e => setEditActivity(p => ({ ...p, activityType: e.target.value }))}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Περιγραφή</label>
                <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={editActivity.description ?? ''} onChange={e => setEditActivity(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Απευθύνεται σε</label>
                <AudienceSelector
                  value={{
                    audienceType: (editActivity.audienceType ?? 'all') as any,
                    audienceIds: (() => { try { return JSON.parse(editActivity.audienceIds ?? '[]'); } catch { return []; } })(),
                  }}
                  onChange={(v: AudienceValue) => setEditActivity(p => ({ ...p, audienceType: v.audienceType, audienceIds: JSON.stringify(v.audienceIds) }))}
                  classes={classes}
                  levels={levels}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Μηνιαίο κόστος (€)</label>
                  <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editActivity.monthlyCost ?? ''} onChange={e => setEditActivity(p => ({ ...p, monthlyCost: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Εφάπαξ κόστος (€)</label>
                  <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editActivity.oneTimeCost ?? ''} onChange={e => setEditActivity(p => ({ ...p, oneTimeCost: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Λήξη εγγραφών</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editActivity.deadline ? editActivity.deadline.slice(0, 10) : ''} onChange={e => setEditActivity(p => ({ ...p, deadline: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Έναρξη</label>
                  <input type="month" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={monthValue(editActivity.startsOn)} onChange={e => setEditActivity(p => ({ ...p, startsOn: monthStart(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Λήξη</label>
                  <input type="month" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={monthValue(editActivity.endsOn)} onChange={e => setEditActivity(p => ({ ...p, endsOn: monthEnd(e.target.value) }))} />
                </div>
              </div>
            </div>
            {saveError && <p className="px-5 text-sm text-red-600">{saveError}</p>}
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowActivityModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ακύρωση</button>
              <button onClick={saveActivity} disabled={saving || !editActivity.title?.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Schedule slot ──────────────────────────────────────────────── */}
      {showSlotModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Προσθήκη στο Πρόγραμμα</h2>
              <button onClick={() => setShowSlotModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Δραστηριότητα *</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newSlot.activityId} onChange={e => setNewSlot(p => ({ ...p, activityId: e.target.value }))}>
                  <option value="">Επιλέξτε δραστηριότητα...</option>
                  {activities.filter(a => a.isActive).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ημέρα</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newSlot.dayOfWeek} onChange={e => setNewSlot(p => ({ ...p, dayOfWeek: Number(e.target.value) }))}>
                  {DAYS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ώρα έναρξης</label>
                  <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newSlot.startTime} onChange={e => setNewSlot(p => ({ ...p, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ώρα λήξης</label>
                  <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newSlot.endTime} onChange={e => setNewSlot(p => ({ ...p, endTime: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowSlotModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ακύρωση</button>
              <button onClick={addSlot} disabled={saving || !newSlot.activityId}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '...' : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Instructor ──────────────────────────────────────────────── */}
      {showInstructorModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{(editInstructor as any).id ? 'Επεξεργασία Εκπαιδευτή' : 'Νέος Εκπαιδευτής'}</h2>
              <button onClick={() => setShowInstructorModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ονοματεπώνυμο *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={(editInstructor as any).name ?? ''} onChange={e => setEditInstructor((p: any) => ({ ...p, name: e.target.value }))} placeholder="π.χ. Αφροδίτη Κορέτση" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ιδιότητα / Τίτλος</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={(editInstructor as any).title ?? ''} onChange={e => setEditInstructor((p: any) => ({ ...p, title: e.target.value }))} placeholder="π.χ. Δασκάλα χορού, Γυμναστής..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Φωτογραφία</label>
                <div className="flex items-center gap-3">
                  {pendingPhotoPreview ? (
                    <img src={pendingPhotoPreview} alt="Preview" className="h-16 w-16 rounded-xl object-cover border border-gray-200" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-gray-100 flex items-center justify-center border border-dashed border-gray-300">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => instructorPhotoInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> {pendingPhotoPreview ? 'Αλλαγή φωτογραφίας' : 'Επιλογή φωτογραφίας'}
                    </button>
                    {pendingPhotoPreview && (
                      <button type="button" onClick={() => { setPendingPhotoFile(null); setPendingPhotoPreview(''); }}
                        className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                        Αφαίρεση
                      </button>
                    )}
                  </div>
                </div>
                <input ref={instructorPhotoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPendingPhotoFile(file);
                    setPendingPhotoPreview(URL.createObjectURL(file));
                    e.target.value = '';
                  }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Βιογραφικό</label>
                <textarea rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={(editInstructor as any).bio ?? ''} onChange={e => setEditInstructor((p: any) => ({ ...p, bio: e.target.value }))} placeholder="Σύντομο βιογραφικό σημείωμα..." />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowInstructorModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ακύρωση</button>
              <button onClick={saveInstructor} disabled={saving || !(editInstructor as any).name?.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

