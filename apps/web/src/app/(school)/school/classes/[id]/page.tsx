'use client';

import { useEffect, useState } from 'react';
import { classesApi, studentsApi, parentMeetingsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, GraduationCap, BookOpen, ChevronRight, Star,
  Calendar, Plus, X, Save, ClipboardList, Pencil, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { PersonAvatar } from '@/components/PersonAvatar';

const LEVEL_COLORS: Record<string, string> = {
  βρεφικό:       'bg-pink-100 text-pink-700',
  μεταβρεφικό:   'bg-orange-100 text-orange-700',
  βρεφονηπιακό:  'bg-amber-100 text-amber-700',
  νηπιακό:       'bg-indigo-100 text-indigo-700',
  νηπιαγωγείο:   'bg-violet-100 text-violet-700',
};

function age(dob: string) {
  const diff = Date.now() - new Date(dob).getTime();
  const y = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return y > 0 ? `${y} ετών` : '< 1 έτους';
}

export default function ClassDetailPage() {
  const params = useParams();
  const classId = params.id as string;
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'teacher';

  const [cls, setCls] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Meeting form
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', description: '', meetingDate: '' });
  const [savingMeeting, setSavingMeeting] = useState(false);

  // Instructions
  const [showInstrForm, setShowInstrForm] = useState(false);
  const [editingInstr, setEditingInstr] = useState<any>(null);
  const [instrForm, setInstrForm] = useState({ title: '', content: '', category: '' });
  const [savingInstr, setSavingInstr] = useState(false);
  const [deletingInstr, setDeletingInstr] = useState<string | null>(null);

  const load = async () => {
    if (!schoolId || !classId) return;
    try {
      const [c, s, m] = await Promise.all([
        classesApi.get(schoolId, classId),
        studentsApi.list(schoolId),
        parentMeetingsApi.list(schoolId, { classId }),
      ]) as any[];
      setCls(c);
      const enrolled = (Array.isArray(s) ? s : []).filter((st: any) =>
        st.enrollments?.some((e: any) => e.classId === classId && e.academicYear?.isCurrent),
      );
      setStudents(enrolled);
      setMeetings(Array.isArray(m) ? m : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId, classId]);

  const saveMeeting = async () => {
    if (!meetingForm.title.trim() || !meetingForm.meetingDate) return;
    setSavingMeeting(true);
    try {
      await parentMeetingsApi.create(schoolId, { ...meetingForm, classId });
      setShowMeetingForm(false);
      setMeetingForm({ title: '', description: '', meetingDate: '' });
      load();
    } finally {
      setSavingMeeting(false);
    }
  };

  const removeMeeting = async (id: string) => {
    if (!confirm('Διαγραφή ενημέρωσης;')) return;
    await parentMeetingsApi.remove(schoolId, id);
    load();
  };

  const openNewInstr = () => {
    setEditingInstr(null);
    setInstrForm({ title: '', content: '', category: '' });
    setShowInstrForm(true);
  };

  const openEditInstr = (instr: any) => {
    setEditingInstr(instr);
    setInstrForm({ title: instr.title, content: instr.content, category: instr.category ?? '' });
    setShowInstrForm(true);
  };

  const saveInstr = async () => {
    if (!instrForm.title.trim() || !instrForm.content.trim()) return;
    setSavingInstr(true);
    try {
      const payload = { title: instrForm.title.trim(), content: instrForm.content.trim(), category: instrForm.category.trim() || undefined };
      if (editingInstr) {
        await classesApi.updateInstruction(schoolId, classId, editingInstr.id, payload);
      } else {
        await classesApi.createInstruction(schoolId, classId, payload);
      }
      setShowInstrForm(false);
      load();
    } finally {
      setSavingInstr(false);
    }
  };

  const deleteInstr = async (id: string) => {
    if (!confirm('Διαγραφή οδηγίας;')) return;
    setDeletingInstr(id);
    try {
      await classesApi.deleteInstruction(schoolId, classId, id);
      load();
    } finally {
      setDeletingInstr(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-400 text-center">Φόρτωση...</div>;
  if (!cls) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Η τάξη δεν βρέθηκε.</p>
        <Link href="/school/classes" className="text-indigo-600 text-sm mt-2 inline-block hover:underline">← Επιστροφή</Link>
      </div>
    );
  }

  const levelName = cls.level?.name ?? cls.level ?? null;
  const levelColor = levelName ? (LEVEL_COLORS[levelName.toLowerCase()] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-600';
  const now = new Date();
  const upcomingMeetings = meetings.filter((m) => new Date(m.meetingDate) >= now);
  const pastMeetings = meetings.filter((m) => new Date(m.meetingDate) < now);

  return (
    <div>
      <Link href="/school/classes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Τάξεις
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-sm">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{cls.name}</h1>
                {levelName && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${levelColor}`}>
                    {levelName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                {cls.ageGroup && <span>{cls.ageGroup}</span>}
                {cls.academicYear && <span>Σχ. Έτος {cls.academicYear.label}</span>}
                {cls.capacity && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {students.length}/{cls.capacity} θέσεις
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-center px-4 py-2 bg-indigo-50 rounded-xl">
              <div className="text-2xl font-bold text-indigo-700">{students.length}</div>
              <div className="text-xs text-indigo-500 mt-0.5">Μαθητές</div>
            </div>
            <div className="text-center px-4 py-2 bg-violet-50 rounded-xl">
              <div className="text-2xl font-bold text-violet-700">{cls.teachers?.length ?? 0}</div>
              <div className="text-xs text-violet-500 mt-0.5">Εκπαιδευτικοί</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: teachers + meetings */}
        <div className="space-y-6">
          {/* Teachers */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              Εκπαιδευτικοί
            </h2>
            {!cls.teachers?.length ? (
              <p className="text-sm text-gray-400">Δεν έχουν ανατεθεί.</p>
            ) : (
              <div className="space-y-3">
                {cls.teachers.map((t: any) => (
                  <div key={t.userId} className="flex items-center gap-3">
                    <PersonAvatar name={t.user.fullName} src={t.user.avatarUrl} tone="green" className="h-9 w-9 rounded-xl text-xs shadow-sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{t.user.fullName}</div>
                      {t.isPrimary && (
                        <div className="flex items-center gap-0.5 text-xs text-amber-600">
                          <Star className="h-2.5 w-2.5 fill-amber-600" /> Κύριος
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parent Meetings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-500" />
                Ενημέρωση Γονέων
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setShowMeetingForm(true)}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {meetings.length === 0 ? (
              <p className="text-sm text-gray-400">Δεν υπάρχουν προγραμματισμένες ενημερώσεις.</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Επερχόμενες</p>
                    {upcomingMeetings.map((m) => (
                      <MeetingCard key={m.id} meeting={m} onDelete={isAdmin ? () => removeMeeting(m.id) : undefined} />
                    ))}
                  </>
                )}
                {pastMeetings.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3">Παρελθόν</p>
                    {pastMeetings.map((m) => (
                      <MeetingCard key={m.id} meeting={m} past onDelete={isAdmin ? () => removeMeeting(m.id) : undefined} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          {/* Class Instructions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-500" />
                Οδηγίες Τάξης
              </h2>
              {isAdmin && (
                <button onClick={openNewInstr} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                  <Plus size={16} />
                </button>
              )}
            </div>
            {!cls.instructions?.length ? (
              <p className="text-sm text-gray-400">Δεν υπάρχουν οδηγίες.</p>
            ) : (
              <div className="space-y-2.5">
                {cls.instructions.map((instr: any) => (
                  <div key={instr.id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{instr.title}</p>
                          {instr.category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{instr.category}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{instr.content}</p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEditInstr(instr)}
                            className="p-1 text-gray-300 hover:text-indigo-500"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteInstr(instr.id)}
                            disabled={deletingInstr === instr.id}
                            className="p-1 text-gray-300 hover:text-red-400 disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Students list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              Μαθητές ({students.length})
            </h2>
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">Δεν υπάρχουν εγγεγραμμένοι μαθητές.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {students.map((s) => {
                const parentNames = s.parents?.map((p: any) => p.user.fullName).join(', ');
                return (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={s.fullName} src={s.avatarUrl} className="h-9 w-9 rounded-xl text-xs shadow-sm" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{s.fullName}</div>
                        <div className="text-xs text-gray-400">{s.dob ? age(s.dob) : '—'}{parentNames ? ` · ${parentNames}` : ''}</div>
                      </div>
                    </div>
                    <Link
                      href={`/school/students/${s.id}`}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                    >
                      Προφίλ <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Instruction form modal */}
      {showInstrForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingInstr ? 'Επεξεργασία Οδηγίας' : 'Νέα Οδηγία'}
              </h2>
              <button onClick={() => setShowInstrForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Τίτλος *</label>
                <input
                  value={instrForm.title}
                  onChange={(e) => setInstrForm({ ...instrForm, title: e.target.value })}
                  placeholder="πχ. Ώρα προσέλευσης"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Περιεχόμενο *</label>
                <textarea
                  value={instrForm.content}
                  onChange={(e) => setInstrForm({ ...instrForm, content: e.target.value })}
                  rows={4}
                  placeholder="πχ. Προσέλευση μέχρι τις 8:30. Να έχουν στην τσάντα τους αλλαξιά ρούχα και μωρομάντηλα."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Κατηγορία (προαιρετικό)</label>
                <input
                  value={instrForm.category}
                  onChange={(e) => setInstrForm({ ...instrForm, category: e.target.value })}
                  placeholder="πχ. Προσέλευση / Εξοπλισμός / Διατροφή"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInstrForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Άκυρο
              </button>
              <button
                onClick={saveInstr}
                disabled={savingInstr || !instrForm.title.trim() || !instrForm.content.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={14} />
                {savingInstr ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting form modal */}
      {showMeetingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Νέα Ενημέρωση Γονέων</h2>
              <button onClick={() => setShowMeetingForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Θέμα *</label>
                <input
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  placeholder="πχ. Τριμηνιαία ενημέρωση γονέων"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ημερομηνία & Ώρα *</label>
                <input
                  type="datetime-local"
                  value={meetingForm.meetingDate}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Περιγραφή / Ανακοίνωση</label>
                <textarea
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                  rows={3}
                  placeholder="Παρακαλούμε να προσέλθετε..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Calendar size={12} />
                Θα αποστέλλεται push notification στους γονείς 3 μέρες πριν.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMeetingForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Άκυρο
              </button>
              <button
                onClick={saveMeeting}
                disabled={savingMeeting || !meetingForm.title.trim() || !meetingForm.meetingDate}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={14} />
                {savingMeeting ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting, past, onDelete }: { meeting: any; past?: boolean; onDelete?: () => void }) {
  const date = new Date(meeting.meetingDate);
  return (
    <div className={`rounded-lg border p-3 ${past ? 'border-gray-100 bg-gray-50/50' : 'border-indigo-100 bg-indigo-50/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-medium ${past ? 'text-gray-500' : 'text-gray-800'} truncate`}>
            {meeting.title}
          </p>
          <p className={`text-xs mt-0.5 ${past ? 'text-gray-400' : 'text-indigo-500'}`}>
            {format(date, 'EEEE, d MMM yyyy · HH:mm', { locale: el })}
          </p>
          {meeting.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{meeting.description}</p>
          )}
        </div>
        {onDelete && (
          <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
