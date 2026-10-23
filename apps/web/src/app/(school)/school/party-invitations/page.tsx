'use client';

import { useEffect, useState, useRef } from 'react';
import { api, partyInvitationsApi, studentsApi, classesApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Plus, X, Send, Bell, Trash2, Cake, Users, ChevronDown, ChevronUp, ImageIcon, Pencil, FileText } from 'lucide-react';

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300';

export default function PartyInvitationsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'school_admin';

  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    birthdayStudentId: string;
    birthdayStudentName: string;
    title: string;
    body: string;
    imageUrl: string;
    pdfUrl: string;
    eventDate: string;
    recipientStudentIds: string[];
  }>({ birthdayStudentId: '', birthdayStudentName: '', title: '', body: '', imageUrl: '', pdfUrl: '', eventDate: '', recipientStudentIds: [] });

  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [expandedRecipients, setExpandedRecipients] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!schoolId) return;
    Promise.allSettled([
      partyInvitationsApi.list(schoolId),
      studentsApi.list(schoolId),
      classesApi.list(schoolId),
    ]).then(([invRes, stuRes, clsRes]) => {
      const inv = invRes.status === 'fulfilled' ? invRes.value : [];
      const stu = stuRes.status === 'fulfilled' ? stuRes.value : [];
      const cls = clsRes.status === 'fulfilled' ? clsRes.value : [];
      setInvitations(Array.isArray(inv) ? inv : []);
      setAllStudents(Array.isArray(stu) ? (stu as any[]).filter((s: any) => s.isActive !== false) : []);
      setClasses(Array.isArray(cls) ? cls : []);
      setLoading(false);
    });
  }, [schoolId]);

  const studentsInClass = selectedClassId
    ? allStudents.filter((s: any) =>
        s.classId === selectedClassId ||
        s.enrollments?.some((e: any) => e.classId === selectedClassId)
      )
    : allStudents;

  const openCreate = () => {
    setEditingId(null);
    setForm({ birthdayStudentId: '', birthdayStudentName: '', title: '', body: '', imageUrl: '', pdfUrl: '', eventDate: '', recipientStudentIds: [] });
    setStudentSearch('');
    setSelectedClassId('');
    setExpandedRecipients(false);
    setShowModal(true);
  };

  const openEdit = (inv: any) => {
    setEditingId(inv.id);
    setForm({
      birthdayStudentId: inv.birthdayStudentId,
      birthdayStudentName: inv.birthdayStudent?.fullName ?? '',
      title: inv.title,
      body: inv.body ?? '',
      imageUrl: inv.imageUrl ?? '',
      pdfUrl: inv.pdfUrl ?? '',
      eventDate: inv.eventDate ?? '',
      recipientStudentIds: Array.isArray(inv.recipientStudentIds) ? inv.recipientStudentIds : [],
    });
    setStudentSearch('');
    setSelectedClassId('');
    setExpandedRecipients(false);
    setShowModal(true);
  };

  const toggleRecipient = (id: string) => {
    setForm(f => ({
      ...f,
      recipientStudentIds: f.recipientStudentIds.includes(id)
        ? f.recipientStudentIds.filter(rid => rid !== id)
        : [...f.recipientStudentIds, id],
    }));
  };

  const selectAllInClass = () => {
    const ids = studentsInClass.map((s: any) => s.id);
    const allSelected = ids.every((id: string) => form.recipientStudentIds.includes(id));
    setForm(f => ({
      ...f,
      recipientStudentIds: allSelected
        ? f.recipientStudentIds.filter(id => !ids.includes(id))
        : Array.from(new Set([...f.recipientStudentIds, ...ids])),
    }));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await api.post(`/schools/${schoolId}/party-invitations/upload-attachment`, data);
      if (res.data?.url) setForm(f => ({ ...f, imageUrl: res.data.url }));
    } catch { /* ignore */ } finally { setUploading(false); }
  };

  const handlePdfUpload = async (file: File) => {
    setUploadingPdf(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await api.post(`/schools/${schoolId}/party-invitations/upload-attachment`, data);
      if (res.data?.url) setForm(f => ({ ...f, pdfUrl: res.data.url }));
    } catch { /* ignore */ } finally { setUploadingPdf(false); }
  };

  const doSave = async () => {
    if (!form.birthdayStudentId || !form.title.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated: any = await partyInvitationsApi.update(schoolId, editingId, {
          title: form.title,
          body: form.body || undefined,
          imageUrl: form.imageUrl || undefined,
          pdfUrl: form.pdfUrl || undefined,
          eventDate: form.eventDate || undefined,
          recipientStudentIds: form.recipientStudentIds,
        });
        setInvitations(prev => prev.map(i => i.id === editingId ? updated : i));
      } else {
        const inv: any = await partyInvitationsApi.create(schoolId, {
          birthdayStudentId: form.birthdayStudentId,
          title: form.title,
          body: form.body || undefined,
          imageUrl: form.imageUrl || undefined,
          pdfUrl: form.pdfUrl || undefined,
          eventDate: form.eventDate || undefined,
          recipientStudentIds: form.recipientStudentIds,
        });
        setInvitations(prev => [inv, ...prev]);
      }
      setShowModal(false);
    } finally { setSaving(false); }
  };

  const doSend = async (id: string) => {
    setSending(id);
    try {
      const updated: any = await partyInvitationsApi.send(schoolId, id);
      setInvitations(prev => prev.map(i => i.id === id ? updated : i));
    } finally { setSending(null); }
  };

  const doRemind = async (id: string) => {
    setReminding(id);
    try {
      const updated: any = await partyInvitationsApi.remind(schoolId, id);
      setInvitations(prev => prev.map(i => i.id === id ? updated : i));
    } finally { setReminding(null); }
  };

  const doDelete = async (id: string) => {
    setDeleting(id);
    try {
      await partyInvitationsApi.delete(schoolId, id);
      setInvitations(prev => prev.filter(i => i.id !== id));
    } finally { setDeleting(null); }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Φόρτωση...</div>;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Cake className="h-6 w-6 text-pink-500" />
          <h1 className="text-xl font-bold text-gray-900">Προσκλήσεις Πάρτυ</h1>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-pink-600 text-white text-sm font-medium rounded-xl px-4 py-2 hover:bg-pink-700">
            <Plus className="h-4 w-4" /> Νέα Πρόσκληση
          </button>
        )}
      </div>

      {invitations.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">Δεν υπάρχουν προσκλήσεις ακόμα.</div>
      )}

      <div className="space-y-4">
        {invitations.map(inv => (
          <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex gap-4 p-4">
              {inv.imageUrl && (
                <img src={inv.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-base">{inv.title}</div>
                <div className="text-sm text-pink-600 font-medium mt-0.5">
                  🎂 {inv.birthdayStudent?.fullName}
                  {inv.eventDate && <span className="text-gray-500 font-normal"> · {inv.eventDate}</span>}
                </div>
                {inv.body && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{inv.body}</div>}
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {Array.isArray(inv.recipientStudentIds) ? inv.recipientStudentIds.length : 0} παιδιά
                  </span>
                  {inv.pdfUrl && (
                    <span className="text-xs bg-red-50 text-red-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> PDF
                    </span>
                  )}
                  {inv.sentAt
                    ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">✓ Εστάλη {fmtDate(inv.sentAt)}</span>
                    : <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5">Δεν έχει σταλεί</span>
                  }
                  {inv.reminderSentAt && (
                    <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">🔔 Υπενθύμιση {fmtDate(inv.reminderSentAt)}</span>
                  )}
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2 px-4 pb-4 border-t border-gray-50 pt-3 flex-wrap">
                <button
                  onClick={() => openEdit(inv)}
                  className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 font-medium hover:bg-gray-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Επεξεργασία
                </button>
                {!inv.sentAt ? (
                  <button
                    disabled={sending === inv.id}
                    onClick={() => doSend(inv.id)}
                    className="flex items-center gap-1.5 text-xs bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-pink-700 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending === inv.id ? 'Αποστολή...' : 'Αποστολή'}
                  </button>
                ) : (
                  <button
                    disabled={reminding === inv.id}
                    onClick={() => doRemind(inv.id)}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {reminding === inv.id ? 'Αποστολή...' : 'Υπενθύμιση'}
                  </button>
                )}
                <button
                  disabled={deleting === inv.id}
                  onClick={() => doDelete(inv.id)}
                  className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 rounded-lg px-3 py-1.5 font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting === inv.id ? '...' : 'Διαγραφή'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Cake className="h-5 w-5 text-pink-500" /> {editingId ? 'Επεξεργασία Πρόσκλησης' : 'Νέα Πρόσκληση Πάρτυ'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Birthday child picker */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Παιδί που κάνει πάρτυ *</label>
                {editingId ? (
                  <div className={`${inputCls} bg-gray-50 text-gray-700 flex items-center gap-2`}>
                    🎂 {form.birthdayStudentName}
                  </div>
                ) : (
                  <>
                    <input
                      value={studentSearch || form.birthdayStudentName}
                      onChange={e => {
                        setStudentSearch(e.target.value);
                        setForm(f => ({ ...f, birthdayStudentId: '', birthdayStudentName: '' }));
                        setShowStudentDropdown(e.target.value.length >= 1);
                      }}
                      onFocus={() => { if ((studentSearch || form.birthdayStudentName).length >= 1) setShowStudentDropdown(true); }}
                      onBlur={() => setTimeout(() => setShowStudentDropdown(false), 150)}
                      className={inputCls}
                      placeholder="Αναζήτηση μαθητή..."
                    />
                    {form.birthdayStudentId && (
                      <div className="mt-1 text-xs text-pink-600 font-medium">🎂 {form.birthdayStudentName}</div>
                    )}
                    {showStudentDropdown && (() => {
                      const q = studentSearch.toLowerCase();
                      const filtered = allStudents.filter((s: any) => s.fullName?.toLowerCase().includes(q)).slice(0, 6);
                      if (!filtered.length) return null;
                      return (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          {filtered.map((s: any) => (
                            <button key={s.id} type="button"
                              onMouseDown={() => {
                                setForm(f => ({
                                  ...f,
                                  birthdayStudentId: s.id,
                                  birthdayStudentName: s.fullName,
                                  title: f.title || `Πρόσκληση από ${s.fullName}`,
                                }));
                                setStudentSearch('');
                                setShowStudentDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-sm border-b border-gray-100 last:border-0"
                            >
                              {s.fullName}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Τίτλος *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="π.χ. Πρόσκληση από τη Μαρία" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ημερομηνία πάρτυ</label>
                <input type="date" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Λεπτομέρειες</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Ώρα, τόπος, οδηγίες..." />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Εικόνα πρόσκλησης</label>
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 border border-dashed border-pink-300 rounded-xl px-4 py-6 text-sm text-pink-500 w-full bg-pink-50">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Ανέβασμα εικόνας...
                  </div>
                ) : form.imageUrl ? (
                  <div className="relative w-full group">
                    <img src={form.imageUrl} alt="" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
                    <button onClick={() => setForm(f => ({ ...f, imageUrl: '' }))} className="absolute top-2 right-2 bg-white rounded-full border border-gray-200 p-1 text-gray-500 hover:text-red-500 shadow-sm">
                      <X className="h-4 w-4" />
                    </button>
                    <div className="mt-1.5 text-xs text-green-600 font-medium flex items-center gap-1">✓ Η εικόνα ανέβηκε επιτυχώς
                      <button type="button" onClick={() => { setForm(f => ({ ...f, imageUrl: '' })); fileRef.current?.click(); }} className="ml-2 text-gray-400 hover:text-gray-600 underline">Αλλαγή</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-pink-400 hover:text-pink-500 w-full justify-center"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Ανέβασε εικόνα πρόσκλησης
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
              </div>

              {/* PDF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF πρόσκλησης</label>
                {uploadingPdf ? (
                  <div className="flex items-center justify-center gap-2 border border-dashed border-red-300 rounded-xl px-4 py-4 text-sm text-red-500 w-full bg-red-50">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Ανέβασμα PDF...
                  </div>
                ) : form.pdfUrl ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 bg-red-50 px-4 py-3">
                      <div className="flex-shrink-0 bg-red-100 rounded-lg p-2">
                        <FileText className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800">PDF Πρόσκλησης</div>
                        <div className="text-xs text-green-600 font-medium mt-0.5">✓ Ανέβηκε επιτυχώς</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={form.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:text-red-800 font-medium underline">Άνοιγμα</a>
                        <button onClick={() => setForm(f => ({ ...f, pdfUrl: '' }))} className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-100">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => pdfRef.current?.click()}
                    className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-red-400 hover:text-red-500 w-full justify-center"
                  >
                    <FileText className="h-4 w-4" />
                    Ανέβασε PDF πρόσκλησης
                  </button>
                )}
                <input ref={pdfRef} type="file" accept="application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = ''; }} />
              </div>

              {/* Recipients */}
              <div>
                <button type="button" onClick={() => setExpandedRecipients(v => !v)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700 py-1">
                  <span>Παιδιά που θα λάβουν πρόσκληση ({form.recipientStudentIds.length})</span>
                  {expandedRecipients ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expandedRecipients && (
                  <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                      <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-1">
                        <option value="">Όλες οι τάξεις</option>
                        {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button type="button" onClick={selectAllInClass}
                        className="text-xs text-purple-600 font-medium whitespace-nowrap hover:text-purple-800">
                        {studentsInClass.length > 0 && studentsInClass.every((s: any) => form.recipientStudentIds.includes(s.id))
                          ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
                      </button>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                      {studentsInClass.map((s: any) => (
                        <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={form.recipientStudentIds.includes(s.id)} onChange={() => toggleRecipient(s.id)}
                            className="rounded border-gray-300 text-purple-600" />
                          <span className="text-sm text-gray-800">{s.fullName}</span>
                        </label>
                      ))}
                      {studentsInClass.length === 0 && (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">Δεν υπάρχουν μαθητές</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Ακύρωση
              </button>
              <button disabled={saving || !form.birthdayStudentId || !form.title.trim()} onClick={doSave}
                className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : editingId ? 'Αποθήκευση αλλαγών' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
