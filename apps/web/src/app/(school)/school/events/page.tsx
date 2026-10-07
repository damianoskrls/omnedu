'use client';

import { useEffect, useState, useRef } from 'react';
import { schoolEventsApi, classesApi, levelsApi, schoolsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  Plus, X, CalendarDays, Users, Euro, BookOpen, Check, Clock,
  Pencil, Trash2, ChevronDown, ChevronUp, Image, Upload,
} from 'lucide-react';
import { AudienceSelector, AudienceValue, audienceLabel } from '@/components/AudienceSelector';
import { eventDisplayStatus } from '@/lib/event-status';
import { paymentNote } from '@/lib/payment-note';
import { PaymentConfirmModal, PaymentPrompt } from '@/components/PaymentConfirmModal';

const EVENT_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  excursion: { label: 'Εκδρομή', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  theater:   { label: 'Θέατρο',  color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
  event:     { label: 'Εκδήλωση',color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  general:   { label: 'Γενικό',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Προσχέδιο', color: 'bg-gray-100 text-gray-600' },
  published: { label: 'Δημοσιευμένο', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Ολοκληρωμένο', color: 'bg-emerald-100 text-emerald-700' },
};

const ENROLLMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending_consent:  { label: 'Αναμ. Συναίνεση', color: 'bg-yellow-100 text-yellow-700' },
  consent_given:    { label: 'Συναίνεση ✓',      color: 'bg-emerald-100 text-emerald-700' },
  consent_declined: { label: 'Αρνήθηκε',          color: 'bg-red-100 text-red-700' },
  pending_payment:  { label: 'Αναμ. Πληρωμή',    color: 'bg-orange-100 text-orange-700' },
  paid:             { label: 'Πληρώθηκε ✓',       color: 'bg-green-100 text-green-700' },
};

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300';

export default function EventsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';

  const [events, setEvents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [staff, setStaff]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [form, setForm] = useState<any>({
    title: '', description: '', eventType: 'excursion', eventDate: '',
    costPerChild: '', classIds: [], audienceType: 'all', audienceIds: [],
    teacherIds: [], mediaUrls: [], status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Enrollment panel
  const [enrollPanel, setEnrollPanel] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loadingEnroll, setLoadingEnroll] = useState(false);

  // Media upload panel (post-event)
  const [mediaPanel, setMediaPanel] = useState<string | null>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [payPrompt, setPayPrompt] = useState<PaymentPrompt | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      schoolEventsApi.list(schoolId).then(r => setEvents(r ?? [])),
      classesApi.list(schoolId).then(r => setClasses(r ?? [])),
      (levelsApi.list(schoolId) as Promise<any>).then(r => setLevels(Array.isArray(r) ? r : [])),
      schoolsApi.getMembers(schoolId, 'teacher').then(r => setStaff(r ?? [])),
    ]).finally(() => setLoading(false));
  }, [schoolId]);

  const resetForm = () => setForm({
    title: '', description: '', eventType: 'excursion', eventDate: '',
    costPerChild: '', classIds: [], audienceType: 'all', audienceIds: [],
    teacherIds: [], mediaUrls: [], status: 'draft',
  });

  const openCreate = () => { resetForm(); setEditingEvent(null); setModal('create'); };
  const openEdit = (ev: any) => {
    setEditingEvent(ev);
    const storedIds: string[] = (() => { try { return JSON.parse(ev.audienceIds ?? '[]'); } catch { return []; } })();
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      eventType: ev.eventType,
      eventDate: ev.eventDate ? ev.eventDate.slice(0, 10) : '',
      costPerChild: ev.costPerChild ?? '',
      classIds: ev.classIds ?? [],
      audienceType: ev.audienceType ?? 'all',
      audienceIds: storedIds,
      teacherIds: (ev.teachers ?? []).map((t: any) => t.userId),
      mediaUrls: ev.mediaUrls ?? [],
      status: ev.status === 'completed' ? 'published' : ev.status,
    });
    setModal('edit');
  };

  const save = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        costPerChild: form.costPerChild !== '' ? Number(form.costPerChild) : null,
        eventDate: form.eventDate || null,
        status: form.status === 'completed' ? 'published' : form.status,
      };
      if (modal === 'create') {
        // Strip blob URLs and pending files before sending; upload after creation
        const pendingFiles: File[] = payload._pendingFiles ?? [];
        delete payload._pendingFiles;
        payload.mediaUrls = (payload.mediaUrls ?? []).filter((u: string) => !u.startsWith('blob:'));
        let res = await schoolEventsApi.create(schoolId, payload);
        // Upload pending preview images now that we have an event id
        if (pendingFiles.length > 0) {
          const uploads = await Promise.all(
            pendingFiles.map((f: File) => schoolEventsApi.uploadMedia(schoolId, res.id, f)),
          );
          const newUrls = uploads.map((u: any) => u?.url ?? u?.data?.url).filter(Boolean);
          if (newUrls.length > 0) {
            res = await schoolEventsApi.update(schoolId, res.id, { mediaUrls: newUrls });
          }
        }
        setEvents(p => [res, ...p]);
      } else if (modal === 'edit' && editingEvent) {
        const res = await schoolEventsApi.update(schoolId, editingEvent.id, payload);
        setEvents(p => p.map(e => e.id === editingEvent.id ? res : e));
      }
      setModal(null);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Διαγραφή εκδήλωσης;')) return;
    await schoolEventsApi.remove(schoolId, id);
    setEvents(p => p.filter(e => e.id !== id));
  };

  const uploadPreviewImage = async (file: File) => {
    if (!editingEvent && modal !== 'create') return;
    setUploadingImg(true);
    try {
      // For create we need the event id; use a temp post approach via posts media
      // For edit, upload directly
      if (modal === 'edit' && editingEvent) {
        const res = await schoolEventsApi.uploadMedia(schoolId, editingEvent.id, file);
        // Store as pre-event media url
        const newUrl = res?.url ?? res?.data?.url;
        setForm((p: any) => ({ ...p, mediaUrls: [...(p.mediaUrls ?? []), newUrl] }));
      } else {
        // For new events, use a simple object URL preview (upload after create)
        const url = URL.createObjectURL(file);
        setForm((p: any) => ({ ...p, mediaUrls: [...(p.mediaUrls ?? []), url], _pendingFiles: [...(p._pendingFiles ?? []), file] }));
      }
    } finally { setUploadingImg(false); }
  };

  const openEnrollments = async (eventId: string) => {
    if (enrollPanel === eventId) { setEnrollPanel(null); return; }
    setEnrollPanel(eventId);
    setLoadingEnroll(true);
    try {
      const res = await schoolEventsApi.getEnrollments(schoolId, eventId);
      setEnrollments(res ?? []);
    } finally { setLoadingEnroll(false); }
  };

  const togglePayment = async (eventId: string, enrollId: string, currentStatus: string) => {
    const paid = currentStatus !== 'paid';
    await schoolEventsApi.markPayment(schoolId, eventId, enrollId, paid);
    setEnrollments(p => p.map(e => e.id === enrollId ? { ...e, status: paid ? 'paid' : 'pending_payment', paidAt: paid ? new Date() : null } : e));
  };

  const askEventPayment = (ev: any, en: any) => {
    setPayPrompt({
      title: ev.title,
      detail: 'Εκδήλωση',
      studentName: en.student.fullName,
      studentId: en.studentId ?? en.student.id,
      schoolId,
      schoolName: window.localStorage.getItem('school_name') || 'Σχολείο',
      logoUrl: window.localStorage.getItem('school_logo_url') || '',
      chargeAmount: Number(ev.costPerChild) || 0,
      lockPaidAmount: true,
      run: async (info) => {
        await schoolEventsApi.markPayment(schoolId, ev.id, en.id, true, {
          paidAt: info.paidAt,
          notes: paymentNote(info),
        });
        setEnrollments(rows => rows.map(row => row.id === en.id ? { ...row, status: 'paid', paidAt: info.paidAt, notes: paymentNote(info) } : row));
      },
    });
  };

  const setConsent = async (eventId: string, enrollId: string, status: string) => {
    await schoolEventsApi.adminUpdateEnrollment(schoolId, eventId, enrollId, status);
    setEnrollments(p => p.map(e => e.id === enrollId ? {
      ...e,
      status,
      parentConsentAt: status === 'pending_consent' || status === 'consent_declined' ? null : new Date(),
    } : e));
  };

  const uploadEventMedia = async (eventId: string, file: File) => {
    setUploadingMedia(true);
    try {
      await schoolEventsApi.uploadMedia(schoolId, eventId, file);
      const res = await schoolEventsApi.get(schoolId, eventId);
      setEvents(p => p.map(e => e.id === eventId ? { ...e, ...res } : e));
    } finally { setUploadingMedia(false); }
  };

  const toggleTeacher = (id: string) =>
    setForm((p: any) => ({ ...p, teacherIds: p.teacherIds.includes(id) ? p.teacherIds.filter((c: string) => c !== id) : [...p.teacherIds, id] }));

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Φόρτωση...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Εκδρομές & Θέατρο</h1>
          <p className="text-sm text-gray-500 mt-0.5">Διαχείριση εκδηλώσεων, συναινέσεις και πληρωμές</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 shadow-sm">
          <Plus className="w-4 h-4" /> Νέα Εκδήλωση
        </button>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Δεν υπάρχουν εκδηλώσεις</p>
          <p className="text-sm mt-1">Δημιουργήστε την πρώτη εκδήλωση</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(ev => {
            const typeMeta = EVENT_TYPES[ev.eventType] ?? EVENT_TYPES.general;
            const shownStatus = eventDisplayStatus(ev.status, ev.eventDate);
            const statusMeta = STATUS_META[shownStatus] ?? STATUS_META.draft;
            const isEnrollOpen = enrollPanel === ev.id;
            const isMediaOpen = mediaPanel === ev.id;
            const totalEnroll = ev._count?.enrollments ?? 0;
            const postMediaCount = ev._count?.postMedia ?? ev.postMedia?.length ?? 0;

            return (
              <div key={ev.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Type badge */}
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold shrink-0 ${typeMeta.bg} ${typeMeta.color}`}>
                      {typeMeta.label}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900">{ev.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
                      </div>
                      {ev.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ev.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                        {ev.eventDate && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                            {new Date(ev.eventDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        )}
                        {ev.costPerChild && <span className="flex items-center gap-1"><Euro className="w-3 h-3" />{Number(ev.costPerChild).toFixed(2)} ανά παιδί</span>}
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{audienceLabel(ev.audienceType ?? 'all', ev.audienceIds ?? '[]', classes, levels)}</span>
                        {totalEnroll > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{totalEnroll} μαθητές</span>}
                        {postMediaCount > 0 && <span className="flex items-center gap-1"><Image className="w-3 h-3" />{postMediaCount} media</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(ev)} className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(ev.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Teachers */}
                  {ev.teachers?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ev.teachers.map((t: any) => (
                        <span key={t.userId} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-gray-600">
                          {t.user.fullName}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Preview images */}
                  {ev.mediaUrls?.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {ev.mediaUrls.map((url: string, i: number) => (
                        <img key={i} src={url} alt="" className="h-20 w-28 object-cover rounded-lg shrink-0 border border-gray-100" />
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <button
                      onClick={() => openEnrollments(ev.id)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                    >
                      <Users className="w-3.5 h-3.5" />Εγγραφές & Πληρωμές
                      {isEnrollOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {(shownStatus === 'published' || shownStatus === 'completed') && (
                      <button
                        onClick={() => setMediaPanel(isMediaOpen ? null : ev.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 text-emerald-700"
                      >
                        <Upload className="w-3.5 h-3.5" />Ανέβασε Φωτογραφίες
                      </button>
                    )}
                  </div>
                </div>

                {/* Enrollments panel */}
                {isEnrollOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Μαθητές & Κατάσταση Πληρωμής</h4>
                    {loadingEnroll ? (
                      <p className="text-sm text-gray-400">Φόρτωση...</p>
                    ) : enrollments.length === 0 ? (
                      <p className="text-sm text-gray-400">Κανένας μαθητής δεν έχει ανατεθεί ακόμα. Δημοσιεύστε την εκδήλωση για να ανατεθούν αυτόματα οι μαθητές των επιλεγμένων τάξεων.</p>
                    ) : (
                      <div className="space-y-2">
                        {enrollments.map(en => {
                          const stMeta = ENROLLMENT_STATUS[en.status] ?? ENROLLMENT_STATUS.pending_consent;
                          const consentStatus = Number(ev.costPerChild) > 0 ? 'pending_payment' : 'consent_given';
                          return (
                            <div key={en.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-2.5 flex-wrap">
                              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                <span className="text-violet-600 font-bold text-xs">{en.student.fullName.charAt(0)}</span>
                              </div>
                              <span className="font-medium text-sm text-gray-800 flex-1 min-w-[8rem]">{en.student.fullName}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stMeta.color}`}>{stMeta.label}</span>
                              {(en.status === 'pending_consent' || en.status === 'consent_declined') && (
                                <button
                                  onClick={() => setConsent(ev.id, en.id, consentStatus)}
                                  className="text-xs px-2.5 py-1 rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-700"
                                >
                                  Συναίνεση
                                </button>
                              )}
                              {en.status === 'pending_consent' && (
                                <button
                                  onClick={() => setConsent(ev.id, en.id, 'consent_declined')}
                                  className="text-xs px-2.5 py-1 rounded-lg font-medium border border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  Άρνηση
                                </button>
                              )}
                              {en.status === 'pending_payment' && (
                                <button
                                  onClick={() => askEventPayment(ev, en)}
                                  className="text-xs px-2.5 py-1 rounded-lg font-medium bg-orange-50 text-orange-600 hover:bg-green-50 hover:text-green-700 border border-orange-200"
                                >
                                  Σήμανση ως Πληρωμένο
                                </button>
                              )}
                              {en.status === 'paid' && (
                                <button
                                  onClick={() => togglePayment(ev.id, en.id, en.status)}
                                  className="text-xs px-2.5 py-1 rounded-lg font-medium bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600"
                                >
                                  ✓ Πληρωμένο
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Post-event media upload */}
                {isMediaOpen && (
                  <div className="border-t border-gray-100 bg-emerald-50 px-5 py-4">
                    <h4 className="text-sm font-semibold text-emerald-800 mb-3">Ανέβασμα Φωτογραφιών / Βίντεο μετά την εκδήλωση</h4>
                    <input
                      ref={mediaFileRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={async e => {
                        const files = Array.from(e.target.files ?? []);
                        for (const f of files) await uploadEventMedia(ev.id, f);
                        if (mediaFileRef.current) mediaFileRef.current.value = '';
                      }}
                    />
                    <button
                      disabled={uploadingMedia}
                      onClick={() => mediaFileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingMedia ? 'Ανέβασμα...' : 'Επιλογή αρχείων'}
                    </button>
                    {ev.postMedia?.length > 0 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto">
                        {ev.postMedia.map((m: any) => (
                          m.mediaType === 'image'
                            ? <img key={m.id} src={m.url} alt="" className="h-20 w-28 object-cover rounded-lg border border-emerald-200 shrink-0" />
                            : <video key={m.id} src={m.url} className="h-20 w-28 object-cover rounded-lg border border-emerald-200 shrink-0" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{modal === 'create' ? 'Νέα Εκδήλωση' : 'Επεξεργασία Εκδήλωσης'}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Τύπος</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(EVENT_TYPES).map(([k, v]) => (
                    <button key={k} onClick={() => setForm((p: any) => ({ ...p, eventType: k }))}
                      className={`py-2 rounded-xl border-2 text-xs font-medium transition-colors ${form.eventType === k ? `border-violet-500 ${v.bg} ${v.color}` : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Date & Cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Τίτλος *</label>
                <input value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} placeholder="π.χ. Εκδρομή στην Ακρόπολη" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ημερομηνία</label>
                  <input type="date" value={form.eventDate} onChange={e => setForm((p: any) => ({ ...p, eventDate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Κόστος ανά παιδί (€)</label>
                  <input type="number" min="0" step="0.50" value={form.costPerChild} onChange={e => setForm((p: any) => ({ ...p, costPerChild: e.target.value }))} placeholder="0.00" className={inputCls} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Περιγραφή</label>
                <textarea rows={3} value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
                  placeholder="Λεπτομέρειες εκδήλωσης, τι χρειάζεται να φέρει το παιδί, κτλ."
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Απευθύνεται σε</label>
                <AudienceSelector
                  value={{ audienceType: form.audienceType ?? 'all', audienceIds: form.audienceIds ?? [] }}
                  onChange={(v: AudienceValue) => setForm((p: any) => ({ ...p, audienceType: v.audienceType, audienceIds: v.audienceIds }))}
                  classes={classes}
                  levels={levels}
                />
                {form.status === 'published' && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <Users className="w-3 h-3" />Η δημοσίευση ανατάσσει αυτόματα τους μαθητές της επιλεγμένης ομάδας
                  </p>
                )}
              </div>

              {/* Teachers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Εκπαιδευτικοί εκδήλωσης</label>
                {staff.length === 0 ? (
                  <p className="text-sm text-gray-400">Δεν βρέθηκε προσωπικό</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {staff.map((s: any) => (
                      <button key={s.id} onClick={() => toggleTeacher(s.userId ?? s.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                          form.teacherIds.includes(s.userId ?? s.id) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-violet-200'
                        }`}>
                        {form.teacherIds.includes(s.userId ?? s.id) && <Check className="w-3 h-3 inline mr-1" />}{s.fullName ?? s.user?.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cover images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Εικόνες (αφίσα)</label>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { Array.from(e.target.files ?? []).forEach(uploadPreviewImage); if (fileRef.current) fileRef.current.value = ''; }} />
                <div className="flex flex-wrap gap-2">
                  {(form.mediaUrls ?? []).map((url: string, i: number) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="h-20 w-28 object-cover rounded-xl border border-gray-100" />
                      <button onClick={() => setForm((p: any) => ({ ...p, mediaUrls: p.mediaUrls.filter((_: string, j: number) => j !== i) }))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                        ×
                      </button>
                    </div>
                  ))}
                  <button disabled={uploadingImg} onClick={() => fileRef.current?.click()}
                    className="h-20 w-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">{uploadingImg ? '...' : 'Προσθήκη'}</span>
                  </button>
                </div>
              </div>

              {/* Status — completed follows the day after the event */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Κατάσταση</label>
                <div className="flex gap-2">
                  {(['draft', 'published'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setForm((p: any) => ({ ...p, status: s }))}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-colors ${form.status === s ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {eventDisplayStatus(form.status, form.eventDate) === 'completed'
                    ? 'Ολοκληρωμένο — πέρασε η ημέρα της εκδήλωσης.'
                    : 'Μετά την ημέρα της εκδήλωσης γίνεται αυτόματα Ολοκληρωμένο.'}
                  {' '}Οι εκπαιδευτικοί που επιλέγεις τη βλέπουν στην εφαρμογή και ανεβάζουν φωτογραφίες και βίντεο. Οι γονείς τα βλέπουν στην καρτέλα Εκδηλώσεις.
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Ακύρωση</button>
              <button disabled={!form.title || saving} onClick={save}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : modal === 'create' ? 'Δημιουργία' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
      <PaymentConfirmModal prompt={payPrompt} onClose={() => setPayPrompt(null)} />
    </div>
  );
}
