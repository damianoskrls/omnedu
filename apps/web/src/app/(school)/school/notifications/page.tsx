'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { broadcastsApi, classesApi, studentsApi, parentsApi, staffApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import {
  Bell, Send, Users, GraduationCap, Baby, User, Image, Smartphone, Mail, MessageSquare as SmsIcon,
  Settings, ChevronLeft, Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const TARGET_OPTIONS = [
  { value: 'all',      label: 'Όλοι',      desc: 'Δάσκαλοι + Γονείς', icon: Users },
  { value: 'teachers', label: 'Δάσκαλοι', desc: 'Όλοι ή επιλογή',     icon: GraduationCap },
  { value: 'parents',  label: 'Γονείς',   desc: 'Όλοι ή επιλογή',     icon: Baby },
  { value: 'class',    label: 'Τμήμα',    desc: 'Γονείς τάξης',       icon: User },
  { value: 'student',  label: 'Μαθητής',  desc: 'Γονείς μαθητή/ών',   icon: User },
];

const CHANNEL_OPTIONS = [
  { value: 'push',  label: 'Push',  icon: Smartphone, desc: 'Εφαρμογή' },
  { value: 'email', label: 'Email', icon: Mail,       desc: 'Ηλεκτρονικό' },
  { value: 'sms',   label: 'SMS',   icon: SmsIcon,    desc: 'Κινητό' },
];

const AUTO_EVENTS = [
  { key: 'subscription_expiry', label: 'Λήξη συνδρομής' },
  { key: 'payment_overdue',     label: 'Καθυστέρηση πληρωμής' },
  { key: 'activity_approved',   label: 'Έγκριση δραστηριότητας' },
  { key: 'daily_report',        label: 'Νέα ημερήσια αναφορά' },
  { key: 'new_message',         label: 'Νέο μήνυμα' },
  { key: 'thematic_plan',       label: 'Νέο διαθεματικό' },
  { key: 'parent_meeting',      label: 'Ενημέρωση γονέων' },
  { key: 'parent_meeting_request', label: 'Αίτημα ώρας συνάντησης' },
  { key: 'parent_meeting_accepted', label: 'Κλεισμένη συνάντηση' },
  { key: 'event_post', label: 'Ανάρτηση εκδήλωσης' },
  { key: 'school_event', label: 'Νέα εκδήλωση ή εκδρομή' },
  { key: 'celebration', label: 'Γιορτή' },
  { key: 'school_post', label: 'Νέα ανάρτηση' },
  { key: 'teacher_absence', label: 'Απουσία εκπαιδευτικού' },
];

type PickPerson = { id: string; fullName: string; detail?: string };

const defaultForm = () => ({
  title: '',
  body: '',
  targetType: 'all',
  targetMode: 'all' as 'all' | 'pick',
  targetClassId: '',
  targetStudentIds: [] as string[],
  targetUserIds: [] as string[],
  channels: ['push'] as string[],
  customEmailsText: '',
});

function PersonPicker({
  people,
  selectedIds,
  onChange,
  searchPlaceholder,
}: {
  people: PickPerson[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      `${p.fullName} ${p.detail ?? ''}`.toLowerCase().includes(q),
    );
  }, [people, query]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id));

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 bg-gray-50">
        <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (allFilteredSelected) {
              const drop = new Set(filtered.map((p) => p.id));
              onChange(selectedIds.filter((id) => !drop.has(id)));
            } else {
              onChange(Array.from(new Set([...selectedIds, ...filtered.map((p) => p.id)])));
            }
          }}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
        >
          {allFilteredSelected ? 'Αποεπιλογή' : 'Επιλογή όλων'}
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-400">Δεν βρέθηκαν</p>
        ) : filtered.map((person) => {
          const checked = selectedIds.includes(person.id);
          return (
            <label
              key={person.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== person.id)
                      : [...selectedIds, person.id],
                  );
                }}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900 truncate">{person.fullName}</span>
                {person.detail && (
                  <span className="block text-xs text-gray-500 truncate">{person.detail}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2 text-xs text-indigo-700 bg-indigo-50 font-medium">
          {selectedIds.length} επιλεγμένοι
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const { selectedYear } = useAcademicYear();
  const isAdmin = user?.role === 'school_admin';

  const [view, setView] = useState<'compose' | 'settings'>('compose');
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [parents, setParents] = useState<PickPerson[]>([]);
  const [teachers, setTeachers] = useState<PickPerson[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [sent, setSent] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null);
  const [pushDevices, setPushDevices] = useState(0);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [bData, cData, sData, pData, staffData, settingsData] = await Promise.all([
        broadcastsApi.list(schoolId),
        classesApi.list(schoolId, selectedYear?.id),
        studentsApi.list(schoolId),
        isAdmin ? parentsApi.list(schoolId) : Promise.resolve([]),
        isAdmin ? staffApi.list(schoolId) : Promise.resolve([]),
        isAdmin ? broadcastsApi.getSettings(schoolId) : Promise.resolve(null),
      ]);
      setBroadcasts(Array.isArray(bData) ? bData : []);
      setClasses(Array.isArray(cData) ? cData : []);
      const studentList = Array.isArray(sData) ? sData : (sData as any)?.students ?? [];
      setStudents(studentList);
      const parentList = Array.isArray(pData) ? pData : [];
      setParentRows(parentList);
      setParents(
        parentList.map((p: any) => ({
          id: p.id,
          fullName: p.fullName,
          detail: [p.phone, p.email].filter(Boolean).join(' · ') || undefined,
        })),
      );
      setTeachers(
        (Array.isArray(staffData) ? staffData : [])
          .filter((m: any) => ['teacher', 'school_admin', 'owner'].includes(m.role))
          .map((m: any) => ({
            id: m.userId ?? m.user?.id,
            fullName: m.user?.fullName ?? m.fullName ?? '—',
            detail: m.role === 'teacher' ? 'Εκπαιδευτικός' : m.role === 'owner' ? 'Ιδιοκτήτης' : 'Διαχειριστής',
          }))
          .filter((m: PickPerson) => m.id),
      );
      if (settingsData) {
        setPushConfigured(Boolean((settingsData as any).pushConfigured));
        setPushDevices(Number((settingsData as any).pushDevices ?? 0));
      }
    } finally {
      setLoading(false);
    }
  }, [schoolId, isAdmin, selectedYear?.id]);

  const loadSettings = useCallback(async () => {
    if (!schoolId || !isAdmin) return;
    const data = await broadcastsApi.getSettings(schoolId);
    setSettings(data);
  }, [schoolId, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (view === 'settings') loadSettings(); }, [view, loadSettings]);

  const [parentRows, setParentRows] = useState<any[]>([]);

  const classParentPeople = useMemo((): PickPerson[] => {
    if (!form.targetClassId) return [];
    const classStudentIds = new Set(
      students
        .filter((s: any) => {
          const enrollments = s.enrollments ?? [];
          if (enrollments.some((e: any) => e.classId === form.targetClassId || e.class?.id === form.targetClassId)) return true;
          return s.classId === form.targetClassId;
        })
        .map((s: any) => s.id),
    );
    return parentRows
      .filter((p: any) => (p.children ?? []).some((c: any) => classStudentIds.has(c.id)))
      .map((p: any) => ({
        id: p.id,
        fullName: p.fullName,
        detail: (p.children ?? [])
          .filter((c: any) => classStudentIds.has(c.id))
          .map((c: any) => c.fullName)
          .join(', ') || undefined,
      }));
  }, [form.targetClassId, students, parentRows]);

  const peopleForTarget = useMemo((): PickPerson[] => {
    if (form.targetType === 'teachers') return teachers;
    if (form.targetType === 'parents') return parents;
    if (form.targetType === 'all') {
      const seen = new Set<string>();
      const merged: PickPerson[] = [];
      for (const p of [...teachers, ...parents]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        merged.push(p);
      }
      return merged.sort((a, b) => a.fullName.localeCompare(b.fullName, 'el'));
    }
    if (form.targetType === 'class') return classParentPeople;
    return [];
  }, [form.targetType, teachers, parents, classParentPeople]);

  const studentPeople = useMemo((): PickPerson[] => (
    students.map((s: any) => ({
      id: s.id,
      fullName: s.fullName,
      detail: s.className ?? s.enrollments?.[0]?.class?.name,
    }))
  ), [students]);

  const toggleChannel = (ch: string) => {
    setForm((p) => ({
      ...p,
      channels: p.channels.includes(ch) ? p.channels.filter((c) => c !== ch) : [...p.channels, ch],
    }));
  };

  const setTargetType = (value: string) => {
    setForm((p) => ({
      ...p,
      targetType: value,
      targetMode: 'all',
      targetClassId: '',
      targetStudentIds: [],
      targetUserIds: [],
    }));
  };

  const canSend = (() => {
    if (!form.title || !form.body || form.channels.length === 0) return false;
    if (form.targetType === 'class' && !form.targetClassId) return false;
    if (form.targetType === 'student') {
      if (form.targetMode === 'pick' && form.targetStudentIds.length === 0) return false;
      if (form.targetMode === 'all' && students.length === 0) return false;
    }
    if (['all', 'teachers', 'parents', 'class'].includes(form.targetType) && form.targetMode === 'pick') {
      if (form.targetUserIds.length === 0) return false;
    }
    return true;
  })();

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setSendNote('');
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const uploaded: any = await broadcastsApi.uploadImage(schoolId, imageFile);
        imageUrl = uploaded?.imageUrl;
        if (!imageUrl) {
          setSendNote('Η εικόνα δεν ανέβηκε.');
          return;
        }
      }
      const customEmails = form.customEmailsText
        ? form.customEmailsText.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean)
        : undefined;

      const payload: Parameters<typeof broadcastsApi.send>[1] = {
        title: form.title,
        body: form.body,
        imageUrl,
        pdfFiles: pdfFiles.length ? pdfFiles.slice(0, 5) : undefined,
        targetType: form.targetType,
        channels: form.channels,
        customEmails,
      };

      if (form.targetType === 'class') {
        payload.targetClassId = form.targetClassId;
        if (form.targetMode === 'pick') payload.targetUserIds = form.targetUserIds;
      } else if (form.targetType === 'student') {
        if (form.targetMode === 'pick') {
          payload.targetStudentIds = form.targetStudentIds;
          if (form.targetStudentIds.length === 1) payload.targetStudentId = form.targetStudentIds[0];
        } else {
          payload.targetStudentIds = students.map((s: any) => s.id);
        }
      } else if (form.targetMode === 'pick') {
        payload.targetUserIds = form.targetUserIds;
      }

      const result: any = await broadcastsApi.send(schoolId, payload);
      if (form.channels.includes('push')) {
        if (!result?.pushConfigured) {
          setSendNote('Η ειδοποίηση μπήκε στην εφαρμογή. Δεν χτυπάει με κλειστό app, γιατί δεν έχει συνδεθεί το Firebase της Ονειροχώρας.');
        } else if (!result?.pushDevices) {
          setSendNote('Η ειδοποίηση μπήκε στην εφαρμογή. Κανένα κινητό δεν έχει ανοίξει ακόμα την έκδοση που δέχεται ειδοποιήσεις με κλειστό app.');
        } else if (result?.pushDelivered > 0) {
          setSendNote(`Έφτασε σε ${result.pushDelivered} κινητά, ακόμα και αν η εφαρμογή είναι κλειστή.`);
        } else {
          setSendNote('Η ειδοποίηση μπήκε στην εφαρμογή, αλλά δεν παραδόθηκε σε κινητό.');
        }
      } else {
        setSendNote('Η ειδοποίηση καταχωρήθηκε.');
      }
      setSent(true);
      setForm(defaultForm());
      setImageFile(null);
      setImagePreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return '';
      });
      setPdfFiles([]);
      setTimeout(() => setSent(false), 6000);
      load();
    } catch (error: any) {
      const message = error?.message || error?.error || error?.data?.message;
      setSendNote(typeof message === 'string' && message.trim() ? message : 'Η αποστολή δεν ολοκληρώθηκε.');
    } finally {
      setSending(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await broadcastsApi.updateSettings(schoolId, {
        defaultChannels: settings.defaultChannels,
        eventRules: settings.eventRules,
        smsApiKey: settings.smsApiKey,
        smsSenderId: settings.smsSenderId,
        emailFrom: settings.emailFrom,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const setEventRule = (event: string, channels: string[]) => {
    setSettings((p: any) => ({ ...p, eventRules: { ...(p?.eventRules ?? {}), [event]: channels } }));
  };

  const showModeToggle = ['all', 'teachers', 'parents', 'class', 'student'].includes(form.targetType);

  if (view === 'settings' && isAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('compose')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ρυθμίσεις Ειδοποιήσεων</h1>
            <p className="text-sm text-gray-500">Αυτόματες ειδοποιήσεις και κανάλια επικοινωνίας</p>
          </div>
        </div>

        {!settings ? (
          <div className="text-center py-8 text-gray-400">Φόρτωση...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Προεπιλεγμένα Κανάλια</h2>
              <p className="text-xs text-gray-500 mb-3">Ποια κανάλια προεπιλέγονται όταν στέλνετε νέα ειδοποίηση</p>
              <div className="flex gap-3">
                {CHANNEL_OPTIONS.map((ch) => {
                  const selected = (settings.defaultChannels ?? []).includes(ch.value);
                  const Icon = ch.icon;
                  return (
                    <button
                      key={ch.value}
                      onClick={() => setSettings((p: any) => ({
                        ...p,
                        defaultChannels: selected
                          ? (p.defaultChannels ?? []).filter((c: string) => c !== ch.value)
                          : [...(p.defaultChannels ?? []), ch.value],
                      }))}
                      className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-colors ${
                        selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{ch.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Αυτόματες Ειδοποιήσεις</h2>
              <p className="text-xs text-gray-500 mb-4">Ποια κανάλια χρησιμοποιούνται για κάθε αυτόματο γεγονός</p>
              <div className="space-y-3">
                {AUTO_EVENTS.map((ev) => {
                  const ruleChannels: string[] = settings.eventRules?.[ev.key] ?? ['push'];
                  return (
                    <div key={ev.key} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1">{ev.label}</span>
                      <div className="flex gap-1.5">
                        {CHANNEL_OPTIONS.map((ch) => {
                          const active = ruleChannels.includes(ch.value);
                          const Icon = ch.icon;
                          return (
                            <button
                              key={ch.value}
                              onClick={() => setEventRule(ev.key, active ? ruleChannels.filter((c) => c !== ch.value) : [...ruleChannels, ch.value])}
                              title={ch.label}
                              className={`p-1.5 rounded-lg border transition-colors ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Ρυθμίσεις SMS</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SMS API Key (Twilio / Vonage / Yuboto)</label>
                  <input type="password" className={inputCls} value={settings.smsApiKey ?? ''} onChange={(e) => setSettings((p: any) => ({ ...p, smsApiKey: e.target.value }))} placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Αποστολέας SMS</label>
                  <input className={inputCls} value={settings.smsSenderId ?? ''} onChange={(e) => setSettings((p: any) => ({ ...p, smsSenderId: e.target.value }))} placeholder="π.χ. OmneduApp" maxLength={11} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Ρυθμίσεις Email</h2>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email αποστολέα</label>
                <input type="email" className={inputCls} value={settings.emailFrom ?? ''} onChange={(e) => setSettings((p: any) => ({ ...p, emailFrom: e.target.value }))} placeholder="noreply@myschool.gr" />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingSettings ? 'Αποθήκευση...' : 'Αποθήκευση Ρυθμίσεων'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ειδοποιήσεις</h1>
          <p className="text-gray-500 text-sm mt-1">Αποστολή push, email & SMS σε γονείς και δάσκαλους</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((h) => !h)}
            aria-expanded={showHistory}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Ιστορικό αποστολών{broadcasts.length ? ` (${broadcasts.length})` : ''}
          </button>
          {isAdmin && (
            <button onClick={() => setView('settings')} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Settings className="w-4 h-4" /> Ρυθμίσεις
            </button>
          )}
        </div>
      </div>

      {isAdmin && pushConfigured === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Η ειδοποίηση φαίνεται μέσα στην εφαρμογή όταν είναι ανοιχτή. Για να χτυπάει στο κινητό και με κλειστή εφαρμογή, όπως στο Facebook, χρειάζεται σύνδεση Firebase. Αυτή δεν έχει μπει ακόμα στον server.
        </div>
      )}
      {isAdmin && pushConfigured === true && pushDevices === 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Το Firebase είναι συνδεδεμένο, αλλά κανένα κινητό δεν έχει ανοίξει ακόμα την έκδοση που δηλώνει το τηλέφωνο για ειδοποιήσεις.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {isAdmin && (
          <div className={showHistory ? 'lg:col-span-3' : 'lg:col-span-5'}>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-5">
                <Bell className="h-4 w-4 text-indigo-600" />
                <h2 className="font-semibold text-gray-800">Νέα ειδοποίηση</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Παραλήπτες</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TARGET_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={form.targetType === opt.value}
                          onClick={() => setTargetType(opt.value)}
                          className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
                            form.targetType === opt.value
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={14} className="mb-1" />
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <span className="text-[10px] opacity-70 mt-0.5">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showModeToggle && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-pressed={form.targetMode === 'all'}
                      onClick={() => setForm((p) => ({ ...p, targetMode: 'all', targetUserIds: [], targetStudentIds: [] }))}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        form.targetMode === 'all'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Όλοι
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.targetMode === 'pick'}
                      onClick={() => setForm((p) => ({ ...p, targetMode: 'pick' }))}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        form.targetMode === 'pick'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Επιλογή από λίστα
                    </button>
                  </div>
                )}

                {form.targetType === 'class' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Τμήμα</label>
                    <select
                      value={form.targetClassId}
                      onChange={(e) => setForm((p) => ({ ...p, targetClassId: e.target.value, targetUserIds: [] }))}
                      className={inputCls}
                    >
                      <option value="">Επιλέξτε τμήμα...</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {form.targetMode === 'pick' && form.targetType === 'student' && (
                  <PersonPicker
                    people={studentPeople}
                    selectedIds={form.targetStudentIds}
                    onChange={(ids) => setForm((p) => ({ ...p, targetStudentIds: ids }))}
                    searchPlaceholder="Αναζήτηση μαθητή..."
                  />
                )}

                {form.targetMode === 'pick' && form.targetType === 'class' && !form.targetClassId && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Επίλεξε πρώτα τμήμα για να δεις τους γονείς.
                  </p>
                )}

                {form.targetMode === 'pick' && form.targetType !== 'student' && (form.targetType !== 'class' || form.targetClassId) && (
                  <PersonPicker
                    people={peopleForTarget}
                    selectedIds={form.targetUserIds}
                    onChange={(ids) => setForm((p) => ({ ...p, targetUserIds: ids }))}
                    searchPlaceholder={
                      form.targetType === 'teachers' ? 'Αναζήτηση δασκάλου...'
                        : form.targetType === 'parents' || form.targetType === 'class' ? 'Αναζήτηση γονέα...'
                          : 'Αναζήτηση...'
                    }
                  />
                )}

                {form.targetMode === 'all' && form.targetType === 'student' && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    Θα σταλεί στους γονείς όλων των μαθητών ({students.length}).
                  </p>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Κανάλια αποστολής</label>
                  <div className="flex gap-2">
                    {CHANNEL_OPTIONS.map((ch) => {
                      const selected = form.channels.includes(ch.value);
                      const Icon = ch.icon;
                      return (
                        <button
                          key={ch.value}
                          type="button"
                          onClick={() => toggleChannel(ch.value)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                            selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />{ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.channels.includes('email') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Επιπλέον email <span className="text-gray-400 font-normal">(προαιρετικό)</span>
                    </label>
                    <textarea
                      value={form.customEmailsText}
                      onChange={(e) => setForm((p) => ({ ...p, customEmailsText: e.target.value }))}
                      placeholder={'email1@example.com\nemail2@example.com'}
                      rows={3}
                      className={inputCls + ' resize-none font-mono text-xs'}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Ένα ανά γραμμή ή με κόμμα. Στέλνει και στα emails των υπαρχόντων χρηστών.</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Τίτλος</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="π.χ. Σχολική γιορτή αύριο"
                    maxLength={100}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Μήνυμα</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                    placeholder="Γράψτε το μήνυμά σας..."
                    rows={4}
                    maxLength={1000}
                    className={inputCls + ' resize-none'}
                  />
                  <p className="text-xs text-gray-400 text-right mt-0.5">{form.body.length}/1000</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5" /> Εικόνα <span className="text-gray-400 font-normal">(προαιρετικό)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-gray-600"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setImageFile(file);
                      setImagePreview((current) => {
                        if (current) URL.revokeObjectURL(current);
                        return file ? URL.createObjectURL(file) : '';
                      });
                    }}
                  />
                  {imagePreview && (
                    <img src={imagePreview} alt="" className="mt-2 h-32 w-full rounded-lg object-cover" />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PDF <span className="text-gray-400 font-normal">(προαιρετικό, έως 5)</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="block w-full text-sm text-gray-600"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []).filter((f) =>
                        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
                      );
                      setPdfFiles((prev) => {
                        const names = new Set(prev.map((f) => `${f.name}:${f.size}`));
                        const merged = [...prev];
                        for (const file of picked) {
                          const key = `${file.name}:${file.size}`;
                          if (!names.has(key)) merged.push(file);
                        }
                        return merged.slice(0, 5);
                      });
                      e.target.value = '';
                    }}
                  />
                  {pdfFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {pdfFiles.map((file, index) => (
                        <li key={`${file.name}-${file.size}-${index}`} className="text-xs text-gray-600 flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <span className="truncate">📄 {file.name}</span>
                          <button
                            type="button"
                            onClick={() => setPdfFiles((prev) => prev.filter((_, i) => i !== index))}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                            aria-label={`Αφαίρεση ${file.name}`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Στο email τα PDF στέλνονται ως επισυναπτόμενα αρχεία{pdfFiles.length >= 5 ? ' · μέγιστο 5 αρχεία' : ''}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={send}
                  disabled={sending || !canSend}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                    sent ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <Send size={14} />
                  {sent ? 'Στάλθηκε!' : sending ? 'Αποστολή...' : 'Αποστολή'}
                </button>
                {sendNote && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{sendNote}</p>}
              </div>
            </div>
          </div>
        )}

        {showHistory && (
          <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-5'}>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Ιστορικό αποστολών</h2>
              </div>
              {loading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Φόρτωση...</div>
              ) : broadcasts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Δεν έχουν σταλεί ειδοποιήσεις ακόμα.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
                  {broadcasts.map((b: any) => {
                    const targetLabel =
                      b.targetType === 'all' ? 'Όλοι'
                        : b.targetType === 'teachers' ? 'Δάσκαλοι'
                          : b.targetType === 'parents' ? 'Γονείς'
                            : b.targetType === 'student' ? `Μαθητής: ${b.targetStudent?.fullName ?? '—'}`
                              : `Τμήμα: ${b.targetClass?.name ?? '—'}`;
                    const channels: string[] = b.channels ?? ['push'];
                    return (
                      <div key={b.id} className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate">{b.title}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">{targetLabel}</span>
                          {channels.map((ch: string) => {
                            const chOpt = CHANNEL_OPTIONS.find((c) => c.value === ch);
                            if (!chOpt) return null;
                            const Icon = chOpt.icon;
                            return <Icon key={ch} className="w-3 h-3 text-gray-400 shrink-0" aria-label={chOpt.label} />;
                          })}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{b.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                          <span>{format(new Date(b.sentAt), 'd MMM yyyy, HH:mm', { locale: el })}</span>
                          <span>·</span>
                          <span>{b.sentBy?.fullName ?? '—'}</span>
                          <span>·</span>
                          <span className="text-green-600 font-medium">{b.recipientCount} παραλήπτες</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
