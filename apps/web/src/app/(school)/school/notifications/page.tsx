'use client';

import { useEffect, useState, useCallback } from 'react';
import { broadcastsApi, classesApi, studentsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  Bell, Send, Users, GraduationCap, Baby, User, Image, Smartphone, Mail, MessageSquare as SmsIcon,
  Settings, ChevronLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

// ─── Constants ───────────────────────────────────────────────────────────────

const TARGET_OPTIONS = [
  { value: 'all',      label: 'Όλοι',      desc: 'Δάσκαλοι + Γονείς',           icon: Users },
  { value: 'teachers', label: 'Δάσκαλοι', desc: 'Όλοι οι εκπαιδευτικοί',        icon: GraduationCap },
  { value: 'parents',  label: 'Γονείς',   desc: 'Όλοι οι γονείς',               icon: Baby },
  { value: 'class',    label: 'Τμήμα',    desc: 'Γονείς συγκεκριμένης τάξης',   icon: User },
  { value: 'student',  label: 'Μαθητής',  desc: 'Γονείς ενός μαθητή',           icon: User },
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
];

const defaultForm = () => ({
  title: '', body: '', imageUrl: '',
  targetType: 'all', targetClassId: '', targetStudentId: '',
  channels: ['push'] as string[],
});

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';

  const [view, setView] = useState<'compose' | 'settings'>('compose');
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [classes, setClasses]       = useState<any[]>([]);
  const [students, setStudents]     = useState<any[]>([]);
  const [settings, setSettings]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [form, setForm]             = useState(defaultForm());
  const [sent, setSent]             = useState(false);
  const [sendNote, setSendNote]     = useState('');
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null);
  const [pushDevices, setPushDevices] = useState(0);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [bData, cData, sData, settingsData] = await Promise.all([
        broadcastsApi.list(schoolId),
        classesApi.list(schoolId),
        studentsApi.list(schoolId),
        isAdmin ? broadcastsApi.getSettings(schoolId) : Promise.resolve(null),
      ]);
      setBroadcasts(Array.isArray(bData) ? bData : []);
      setClasses(Array.isArray(cData) ? cData : []);
      setStudents(Array.isArray(sData) ? sData : []);
      if (settingsData) {
        setPushConfigured(Boolean((settingsData as any).pushConfigured));
        setPushDevices(Number((settingsData as any).pushDevices ?? 0));
      }
    } finally {
      setLoading(false);
    }
  }, [schoolId, isAdmin]);

  const loadSettings = useCallback(async () => {
    if (!schoolId || !isAdmin) return;
    const data = await broadcastsApi.getSettings(schoolId);
    setSettings(data);
  }, [schoolId, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (view === 'settings') loadSettings(); }, [view, loadSettings]);

  const toggleChannel = (ch: string) => {
    setForm(p => ({
      ...p,
      channels: p.channels.includes(ch) ? p.channels.filter(c => c !== ch) : [...p.channels, ch],
    }));
  };

  const send = async () => {
    if (!form.title || !form.body) return;
    if (form.targetType === 'class'   && !form.targetClassId)   return;
    if (form.targetType === 'student' && !form.targetStudentId) return;
    if (form.channels.length === 0) return;
    setSending(true);
    try {
      const result: any = await broadcastsApi.send(schoolId, {
        title: form.title,
        body: form.body,
        imageUrl: form.imageUrl || undefined,
        targetType: form.targetType,
        targetClassId: form.targetClassId || undefined,
        targetStudentId: form.targetStudentId || undefined,
        channels: form.channels,
      });
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
      setTimeout(() => setSent(false), 6000);
      load();
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

  // ─── Settings view ───────────────────────────────────────────────────────

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
            {/* Default channels */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Προεπιλεγμένα Κανάλια</h2>
              <p className="text-xs text-gray-500 mb-3">Ποια κανάλια προεπιλέγονται όταν στέλνετε νέα ειδοποίηση</p>
              <div className="flex gap-3">
                {CHANNEL_OPTIONS.map(ch => {
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

            {/* Auto events */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Αυτόματες Ειδοποιήσεις</h2>
              <p className="text-xs text-gray-500 mb-4">Ποια κανάλια χρησιμοποιούνται για κάθε αυτόματο γεγονός</p>
              <div className="space-y-3">
                {AUTO_EVENTS.map(ev => {
                  const ruleChannels: string[] = settings.eventRules?.[ev.key] ?? ['push'];
                  return (
                    <div key={ev.key} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1">{ev.label}</span>
                      <div className="flex gap-1.5">
                        {CHANNEL_OPTIONS.map(ch => {
                          const active = ruleChannels.includes(ch.value);
                          const Icon = ch.icon;
                          return (
                            <button
                              key={ch.value}
                              onClick={() => setEventRule(ev.key, active ? ruleChannels.filter(c => c !== ch.value) : [...ruleChannels, ch.value])}
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

            {/* SMS settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Ρυθμίσεις SMS</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SMS API Key (Twilio / Vonage / Yuboto)</label>
                  <input type="password" className={inputCls} value={settings.smsApiKey ?? ''} onChange={e => setSettings((p: any) => ({ ...p, smsApiKey: e.target.value }))} placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Αποστολέας SMS</label>
                  <input className={inputCls} value={settings.smsSenderId ?? ''} onChange={e => setSettings((p: any) => ({ ...p, smsSenderId: e.target.value }))} placeholder="π.χ. OmneduApp" maxLength={11} />
                </div>
              </div>
            </div>

            {/* Email settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Ρυθμίσεις Email</h2>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email αποστολέα</label>
                <input type="email" className={inputCls} value={settings.emailFrom ?? ''} onChange={e => setSettings((p: any) => ({ ...p, emailFrom: e.target.value }))} placeholder="noreply@myschool.gr" />
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

  // ─── Main compose view ───────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ειδοποιήσεις</h1>
          <p className="text-gray-500 text-sm mt-1">Αποστολή push, email & SMS σε γονείς και δάσκαλους</p>
        </div>
        {isAdmin && (
          <button onClick={() => setView('settings')} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Settings className="w-4 h-4" /> Ρυθμίσεις
          </button>
        )}
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
        {/* Compose panel */}
        {isAdmin && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-5">
                <Bell className="h-4 w-4 text-indigo-600" />
                <h2 className="font-semibold text-gray-800">Νέα ειδοποίηση</h2>
              </div>

              <div className="space-y-4">
                {/* Target */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Παραλήπτες</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TARGET_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setForm(p => ({ ...p, targetType: opt.value, targetClassId: '', targetStudentId: '' }))}
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

                {form.targetType === 'class' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Τμήμα</label>
                    <select
                      value={form.targetClassId}
                      onChange={e => setForm(p => ({ ...p, targetClassId: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Επιλέξτε τμήμα...</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {form.targetType === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Μαθητής</label>
                    <select
                      value={form.targetStudentId}
                      onChange={e => setForm(p => ({ ...p, targetStudentId: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Επιλέξτε μαθητή...</option>
                      {students.map((s: any) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </select>
                  </div>
                )}

                {/* Channels */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Κανάλια αποστολής</label>
                  <div className="flex gap-2">
                    {CHANNEL_OPTIONS.map(ch => {
                      const selected = form.channels.includes(ch.value);
                      const Icon = ch.icon;
                      return (
                        <button
                          key={ch.value}
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

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Τίτλος</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="π.χ. Σχολική γιορτή αύριο"
                    maxLength={100}
                    className={inputCls}
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Μήνυμα</label>
                  <textarea
                    value={form.body}
                    onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                    placeholder="Γράψτε το μήνυμά σας..."
                    rows={4}
                    maxLength={1000}
                    className={inputCls + ' resize-none'}
                  />
                  <p className="text-xs text-gray-400 text-right mt-0.5">{form.body.length}/1000</p>
                </div>

                {/* Image URL (email/push only) */}
                {(form.channels.includes('email') || form.channels.includes('push')) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" /> URL Εικόνας <span className="text-gray-400 font-normal">(προαιρετικό)</span>
                    </label>
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
                      placeholder="https://..."
                      className={inputCls}
                    />
                  </div>
                )}

                <button
                  onClick={send}
                  disabled={
                    sending || !form.title || !form.body || form.channels.length === 0 ||
                    (form.targetType === 'class' && !form.targetClassId) ||
                    (form.targetType === 'student' && !form.targetStudentId)
                  }
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

        {/* History */}
        <div className={isAdmin ? 'lg:col-span-3' : 'lg:col-span-5'}>
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
              <div className="divide-y divide-gray-50">
                {broadcasts.map((b: any) => {
                  const targetLabel =
                    b.targetType === 'all'     ? 'Όλοι'
                    : b.targetType === 'teachers' ? 'Δάσκαλοι'
                    : b.targetType === 'parents'  ? 'Γονείς'
                    : b.targetType === 'student'  ? `Μαθητής: ${b.targetStudent?.fullName ?? '—'}`
                    : `Τμήμα: ${b.targetClass?.name ?? '—'}`;
                  const channels: string[] = b.channels ?? ['push'];
                  return (
                    <div key={b.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 truncate">{b.title}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">{targetLabel}</span>
                            {channels.map((ch: string) => {
                              const chOpt = CHANNEL_OPTIONS.find(c => c.value === ch);
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
