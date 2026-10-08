'use client';

import { useEffect, useState } from 'react';
import { questionnairesApi, schoolsApi, studentsApi, classesApi, levelsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { LinkKind, Question, QuestionType, registrationQuestionnaire } from '@/lib/registration-questionnaire';
import {
  ClipboardList, Plus, ChevronDown, ChevronUp, Pencil, Trash2, X, Save,
  Users, Clock, Send, CheckCircle2, Circle, ToggleLeft, List, AlignLeft,
  Loader2, Heading, Calendar, Hash, CheckSquare, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { AudienceSelector, AudienceValue, audienceLabel } from '@/components/AudienceSelector';

const CURRENT_YEAR = new Date().getFullYear();

// ─── Question types ──────────────────────────────────────────────────────────

const Q_TYPE_META: Record<QuestionType, { label: string; icon: React.ReactNode }> = {
  section: { label: 'Ενότητα', icon: <Heading className="w-4 h-4" /> },
  text: { label: 'Κείμενο', icon: <AlignLeft className="w-4 h-4" /> },
  long: { label: 'Μεγάλο κείμενο', icon: <FileText className="w-4 h-4" /> },
  date: { label: 'Ημερομηνία', icon: <Calendar className="w-4 h-4" /> },
  number: { label: 'Αριθμός', icon: <Hash className="w-4 h-4" /> },
  yesno: { label: 'Ναι / Όχι', icon: <ToggleLeft className="w-4 h-4" /> },
  choice: { label: 'Επιλογή', icon: <List className="w-4 h-4" /> },
  agree: { label: 'Συμφωνώ', icon: <CheckSquare className="w-4 h-4" /> },
};

const LINK_LABELS: Record<Exclude<LinkKind, ''>, string> = {
  operating: 'Κανονισμός λειτουργίας',
  financial: 'Οικονομικός κανονισμός',
  medication: 'Πρωτόκολλο φαρμάκων',
  text: 'Κείμενο για ανάγνωση',
  url: 'Σύνδεσμος',
};

// ─── Data types ──────────────────────────────────────────────────────────────

type Questionnaire = {
  id: string;
  title: string;
  description?: string;
  academicYear: number;
  questions: string;   // JSON
  scopeType: string;
  scopeIds: string;    // JSON
  deadline?: string;
  status: 'draft' | 'sent';
  isActive: boolean;
  createdAt: string;
  _count?: { responses: number };
};

type Student = {
  id: string;
  fullName: string;
  avatarUrl?: string;
  enrollments?: { classId: string; class?: { levelId?: string } }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseJson = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s); } catch { return fallback; }
};

const genId = () => Math.random().toString(36).slice(2, 9);

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

// ─── Edit modal state type ────────────────────────────────────────────────────

type EditState = {
  id?: string;
  title: string;
  description: string;
  academicYear: number;
  questions: Question[];
  audience: AudienceValue;
  deadline: string;
  status: 'draft' | 'sent';
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QuestionnairesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'teacher';

  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; levelId?: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any[]>>({});
  const [loadingResponses, setLoadingResponses] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [savingQ, setSavingQ] = useState(false);

  const [fillModal, setFillModal] = useState<{ questionnaire: Questionnaire; student: Student } | null>(null);
  const [fillAnswers, setFillAnswers] = useState<Record<string, any>>({});
  const [savingF, setSavingF] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [q, s, c, l] = await Promise.all([
        questionnairesApi.list(schoolId, CURRENT_YEAR) as Promise<any>,
        studentsApi.list(schoolId) as Promise<any>,
        classesApi.list(schoolId) as Promise<any>,
        levelsApi.list(schoolId) as Promise<any>,
      ]);
      setQuestionnaires(Array.isArray(q) ? q : []);
      setStudents(Array.isArray(s) ? s : []);
      setClasses(Array.isArray(c) ? c : []);
      setLevels(Array.isArray(l) ? l : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]);

  const getTargetStudents = (q: Questionnaire): Student[] => {
    const ids = parseJson<string[]>(q.scopeIds, []);
    if (q.scopeType === 'all') return students;
    if (q.scopeType === 'class') return students.filter(s => s.enrollments?.some(e => ids.includes(e.classId)));
    if (q.scopeType === 'level') {
      const classIds = new Set(classes.filter(c => (c as any).levelId && ids.includes((c as any).levelId)).map(c => c.id));
      return students.filter(s => s.enrollments?.some(e => classIds.has(e.classId)));
    }
    return students;
  };

  const openNew = () => setEditModal({
    title: '', description: '', academicYear: CURRENT_YEAR,
    questions: [],
    audience: { audienceType: 'all', audienceIds: [] },
    deadline: '', status: 'draft',
  });

  const openRegistration = () => {
    const form = registrationQuestionnaire();
    setEditModal({
      title: form.title,
      description: form.description,
      academicYear: CURRENT_YEAR,
      questions: form.questions,
      audience: { audienceType: 'all', audienceIds: [] },
      deadline: '',
      status: 'draft',
    });
  };

  const openEdit = (q: Questionnaire) => setEditModal({
    id: q.id,
    title: q.title,
    description: q.description ?? '',
    academicYear: q.academicYear,
    questions: parseJson<Question[]>(q.questions, []),
    audience: {
      audienceType: q.scopeType as any,
      audienceIds: parseJson<string[]>(q.scopeIds, []),
    },
    deadline: q.deadline ? q.deadline.slice(0, 16) : '',
    status: q.status,
  });

  const saveQuestionnaire = async () => {
    if (!editModal?.title.trim()) return;
    setSavingQ(true);
    try {
      const payload = {
        title: editModal.title,
        description: editModal.description || undefined,
        academicYear: editModal.academicYear,
        questions: editModal.questions,
        scopeType: editModal.audience.audienceType,
        scopeIds: editModal.audience.audienceIds,
        deadline: editModal.deadline || undefined,
        status: editModal.status,
      };
      if (editModal.id) {
        await questionnairesApi.update(schoolId, editModal.id, payload);
      } else {
        await questionnairesApi.create(schoolId, payload);
      }
      setEditModal(null);
      await load();
    } finally {
      setSavingQ(false);
    }
  };

  const sendQuestionnaire = async (q: Questionnaire) => {
    if (!confirm('Να αποσταλεί το ερωτηματολόγιο; Δεν θα μπορείτε να αλλάξετε τις ερωτήσεις μετά.')) return;
    await questionnairesApi.update(schoolId, q.id, { status: 'sent' });
    setQuestionnaires(prev => prev.map(x => x.id === q.id ? { ...x, status: 'sent' } : x));
  };

  const deleteQuestionnaire = async (id: string) => {
    if (!confirm('Να διαγραφεί οριστικά;')) return;
    await questionnairesApi.remove(schoolId, id);
    setQuestionnaires(prev => prev.filter(q => q.id !== id));
  };

  const toggleExpand = async (q: Questionnaire) => {
    if (expandedId === q.id) { setExpandedId(null); return; }
    setExpandedId(q.id);
    if (!responses[q.id]) {
      setLoadingResponses(q.id);
      try {
        const r = await questionnairesApi.getResponses(schoolId, q.id) as any;
        setResponses(prev => ({ ...prev, [q.id]: Array.isArray(r) ? r : [] }));
      } finally { setLoadingResponses(null); }
    }
  };

  const openFill = (q: Questionnaire, student: Student) => {
    const existing = responses[q.id]?.find((r: any) => r.studentId === student.id);
    setFillAnswers(existing ? parseJson(existing.answers, {}) : {});
    setFillModal({ questionnaire: q, student });
  };

  const saveFill = async () => {
    if (!fillModal) return;
    setSavingF(true);
    try {
      await questionnairesApi.upsertResponse(schoolId, fillModal.questionnaire.id, fillModal.student.id, fillAnswers);
      const r = await questionnairesApi.getResponses(schoolId, fillModal.questionnaire.id) as any;
      setResponses(prev => ({ ...prev, [fillModal.questionnaire.id]: Array.isArray(r) ? r : [] }));
      setFillModal(null);
    } finally { setSavingF(false); }
  };

  // ── Question builder helpers ─────────────────────────────────────────────

  const addQuestion = () => {
    if (!editModal) return;
    const q: Question = { id: genId(), text: '', type: 'yesno' };
    setEditModal(p => p ? { ...p, questions: [...p.questions, q] } : p);
  };

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setEditModal(p => p ? { ...p, questions: p.questions.map(q => q.id === id ? { ...q, ...patch } : q) } : p);
  };

  const removeQuestion = (id: string) => {
    setEditModal(p => p ? { ...p, questions: p.questions.filter(q => q.id !== id) } : p);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ερωτηματολόγια</h1>
          <p className="text-sm text-gray-500 mt-1">
            {CURRENT_YEAR} — {questionnaires.length} ερωτηματολόγια
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={openRegistration}
              className="flex items-center gap-2 px-4 py-2 border border-[#77328D] text-[#77328D] rounded-xl text-sm font-medium hover:bg-[#77328D]/5"
            >
              <ClipboardList className="w-4 h-4" /> Αίτηση εγγραφής
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-[#77328D] text-white rounded-xl text-sm font-medium hover:bg-[#642678]"
            >
              <Plus className="w-4 h-4" /> Νέο Ερωτηματολόγιο
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : questionnaires.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Δεν υπάρχουν ερωτηματολόγια ακόμα</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questionnaires.map(q => {
            const targets = getTargetStudents(q);
            const qResponses = responses[q.id] ?? [];
            const done = qResponses.length;
            const pct = targets.length ? Math.round((done / targets.length) * 100) : 0;
            const qs = parseJson<Question[]>(q.questions, []);
            const isOpen = expandedId === q.id;
            const isLoading = loadingResponses === q.id;

            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(q)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{q.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        q.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {q.status === 'sent' ? 'Εστάλη' : 'Πρόχειρο'}
                      </span>
                    </div>
                    {q.description && <p className="text-xs text-gray-500 mt-0.5">{q.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />{audienceLabel(q.scopeType, q.scopeIds, classes, levels)}
                      </span>
                      <span>{qs.filter((item) => item.type !== 'section').length} ερωτήσεις</span>
                      {q.deadline && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock className="w-3 h-3" />έως {format(new Date(q.deadline), 'd MMM yyyy', { locale: el })}
                        </span>
                      )}
                    </div>
                    {q.status === 'sent' && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-32 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{done}/{targets.length}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && q.status === 'draft' && (
                      <button
                        onClick={() => sendQuestionnaire(q)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                      >
                        <Send className="w-3.5 h-3.5" /> Αποστολή
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={() => openEdit(q)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteQuestionnaire(q.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => toggleExpand(q)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Φόρτωση...
                      </div>
                    ) : targets.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">Δεν υπάρχουν μαθητές στην επιλεγμένη ομάδα</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {targets.map(student => {
                          const resp = qResponses.find((r: any) => r.studentId === student.id);
                          const isDone = !!resp;
                          return (
                            <div key={student.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                                  {student.avatarUrl
                                    ? <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" />
                                    : student.fullName.slice(0, 2).toUpperCase()
                                  }
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{student.fullName}</p>
                                  {isDone
                                    ? <p className="text-xs text-emerald-600">Απάντησε {resp.submittedAt ? format(new Date(resp.submittedAt), 'd MMM', { locale: el }) : ''}</p>
                                    : <p className="text-xs text-gray-400">Δεν έχει απαντήσει</p>
                                  }
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isDone
                                  ? <CheckCircle2 className="text-emerald-500" size={18} />
                                  : <Circle className="text-gray-300" size={18} />
                                }
                                {isAdmin && (
                                  <button
                                    onClick={() => openFill(q, student)}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2.5 py-1 rounded-lg hover:bg-indigo-50"
                                  >
                                    {isDone ? 'Επεξεργασία' : 'Συμπλήρωση'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create/Edit questionnaire modal ─── */}
      {editModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-6">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {editModal.id ? 'Επεξεργασία Ερωτηματολογίου' : 'Νέο Ερωτηματολόγιο'}
              </h2>
              <button onClick={() => setEditModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Τίτλος *</label>
                <input
                  className={inputCls}
                  value={editModal.title}
                  onChange={e => setEditModal(p => p ? { ...p, title: e.target.value } : p)}
                  placeholder="π.χ. Ερωτηματολόγιο Υγείας 2026"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Περιγραφή</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={2}
                  value={editModal.description}
                  onChange={e => setEditModal(p => p ? { ...p, description: e.target.value } : p)}
                  placeholder="Σύντομη περιγραφή..."
                />
              </div>

              {/* Audience */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Απευθύνεται σε</label>
                <AudienceSelector
                  value={editModal.audience}
                  onChange={v => setEditModal(p => p ? { ...p, audience: v } : p)}
                  classes={classes}
                  levels={levels}
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Προθεσμία συμπλήρωσης</label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={editModal.deadline}
                  onChange={e => setEditModal(p => p ? { ...p, deadline: e.target.value } : p)}
                />
              </div>

              {/* Questions builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-gray-600">
                    Ερωτήσεις ({editModal.questions.length})
                  </label>
                  <button
                    onClick={addQuestion}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Προσθήκη ερώτησης
                  </button>
                </div>

                {editModal.questions.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-400">Δεν υπάρχουν ερωτήσεις ακόμα</p>
                    <button
                      onClick={addQuestion}
                      className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Προσθήκη πρώτης ερώτησης
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editModal.questions.map((q, idx) => (
                      <div key={q.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 space-y-2">
                            <input
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={q.text}
                              onChange={e => updateQuestion(q.id, { text: e.target.value })}
                              placeholder="Κείμενο ερώτησης..."
                            />
                            <div className="flex gap-2 flex-wrap">
                              {(Object.keys(Q_TYPE_META) as QuestionType[]).map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => updateQuestion(q.id, {
                                    type: t,
                                    options: t === 'choice' ? (q.options?.length ? q.options : ['', '']) : undefined,
                                  })}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                                    q.type === t
                                      ? 'border-[#77328D] bg-[#77328D]/10 text-[#77328D]'
                                      : 'border-gray-200 text-gray-500 hover:border-[#77328D]/30 bg-white'
                                  }`}
                                >
                                  {Q_TYPE_META[t].icon}{Q_TYPE_META[t].label}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={2}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                              value={q.help ?? ''}
                              onChange={e => updateQuestion(q.id, { help: e.target.value })}
                              placeholder={q.type === 'section' ? 'Σύντομη περιγραφή της ενότητας...' : 'Επεξήγηση που βλέπει ο γονέας κάτω από την ερώτηση...'}
                            />
                            {(q.type === 'yesno' || q.type === 'agree') && (
                              <div className="space-y-2">
                                <select
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  value={q.linkKind ?? ''}
                                  onChange={e => {
                                    const linkKind = e.target.value as LinkKind;
                                    updateQuestion(q.id, {
                                      linkKind,
                                      linkLabel: linkKind && linkKind !== 'url' ? LINK_LABELS[linkKind] : q.linkLabel,
                                    });
                                  }}
                                >
                                  <option value="">Χωρίς σύνδεσμο</option>
                                  <option value="operating">Σύνδεσμος: κανονισμός λειτουργίας</option>
                                  <option value="financial">Σύνδεσμος: οικονομικός κανονισμός</option>
                                  <option value="medication">Σύνδεσμος: πρωτόκολλο φαρμάκων</option>
                                  <option value="text">Σύνδεσμος: κείμενο για ανάγνωση</option>
                                  <option value="url">Σύνδεσμος: διεύθυνση ιστοσελίδας</option>
                                </select>
                                {q.linkKind === 'url' && (
                                  <input
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                    value={q.linkUrl ?? ''}
                                    onChange={e => updateQuestion(q.id, { linkUrl: e.target.value })}
                                    placeholder="https://"
                                  />
                                )}
                                {(q.linkKind === 'medication' || q.linkKind === 'text') && (
                                  <textarea
                                    rows={4}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                    value={q.document ?? ''}
                                    onChange={e => updateQuestion(q.id, { document: e.target.value })}
                                    placeholder="Το κείμενο που ανοίγει ο σύνδεσμος..."
                                  />
                                )}
                              </div>
                            )}

                            {q.type === 'choice' && (
                              <div className="space-y-1.5 ml-1">
                                {(q.options ?? ['', '']).map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                                    <input
                                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      value={opt}
                                      onChange={e => {
                                        const opts = [...(q.options ?? [])];
                                        opts[i] = e.target.value;
                                        updateQuestion(q.id, { options: opts });
                                      }}
                                      placeholder={`Επιλογή ${i + 1}`}
                                    />
                                    {(q.options ?? []).length > 2 && (
                                      <button
                                        onClick={() => {
                                          const opts = (q.options ?? []).filter((_, j) => j !== i);
                                          updateQuestion(q.id, { options: opts });
                                        }}
                                        className="text-red-400 hover:text-red-600"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  onClick={() => updateQuestion(q.id, { options: [...(q.options ?? []), ''] })}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 ml-6"
                                >
                                  <Plus className="w-3 h-3" /> Επιλογή
                                </button>
                              </div>
                            )}
                          </div>
                          <button onClick={() => removeQuestion(q.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm hover:bg-gray-50"
              >
                Ακύρωση
              </button>
              <button
                onClick={saveQuestionnaire}
                disabled={savingQ || !editModal.title.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savingQ ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fill response modal ─── */}
      {fillModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-6">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">{fillModal.questionnaire.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{fillModal.student.fullName}</p>
              </div>
              <button onClick={() => setFillModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <QuestionFields
                schoolId={schoolId}
                questions={parseJson<Question[]>(fillModal.questionnaire.questions, [])}
                answers={fillAnswers}
                onChange={(questionId, value) => setFillAnswers(prev => ({ ...prev, [questionId]: value }))}
              />
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setFillModal(null)}
                className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm hover:bg-gray-50"
              >
                Ακύρωση
              </button>
              <button
                onClick={saveFill}
                disabled={savingF}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savingF ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionFields({
  schoolId,
  questions,
  answers,
  onChange,
}: {
  schoolId: string;
  questions: Question[];
  answers: Record<string, any>;
  onChange: (id: string, value: string) => void;
}) {
  let number = 0;
  return (
    <>
      {questions.map((question) => {
        if (question.type === 'section') {
          return (
            <div key={question.id} className="pt-2">
              <h3 className="text-base font-bold text-[#77328D]">{question.text}</h3>
              {question.help && <p className="text-sm text-gray-500 mt-1">{question.help}</p>}
            </div>
          );
        }
        number += 1;
        const value = answers[question.id] ?? '';
        return (
          <div key={question.id}>
            <p className="text-sm font-medium text-gray-800 mb-1">
              <span className="text-[#77328D] font-bold mr-1.5">{number}.</span>{question.text}
            </p>
            {question.help && <p className="text-xs text-gray-500 mb-2 leading-5">{question.help}</p>}
            <DocumentButton schoolId={schoolId} question={question} />
            {question.type === 'yesno' && (
              <div className="flex gap-3">
                {['Ναι', 'Όχι'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(question.id, opt)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium ${
                      value === opt ? 'border-[#77328D] bg-[#77328D]/10 text-[#77328D]' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {question.type === 'choice' && (
              <div className="space-y-2">
                {(question.options ?? []).filter((opt) => opt.trim()).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(question.id, opt)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm ${
                      value === opt ? 'border-[#77328D] bg-[#77328D]/10 text-[#77328D]' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {question.type === 'agree' && (
              <button
                type="button"
                onClick={() => onChange(question.id, value === 'Συμφωνώ' ? '' : 'Συμφωνώ')}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium ${
                  value === 'Συμφωνώ' ? 'border-[#77328D] bg-[#77328D]/10 text-[#77328D]' : 'border-gray-200 text-gray-700'
                }`}
              >
                {value === 'Συμφωνώ' ? '✓ Συμφωνώ' : 'Συμφωνώ'}
              </button>
            )}
            {(question.type === 'text' || question.type === 'number' || question.type === 'date') && (
              <input
                type={question.type === 'number' ? 'number' : question.type === 'date' ? 'date' : 'text'}
                className={inputCls}
                value={value}
                onChange={(event) => onChange(question.id, event.target.value)}
              />
            )}
            {question.type === 'long' && (
              <textarea
                rows={3}
                className={inputCls + ' resize-none'}
                value={value}
                onChange={(event) => onChange(question.id, event.target.value)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function DocumentButton({ schoolId, question }: { schoolId: string; question: Question }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  if (!question.linkKind) return null;
  const label = question.linkLabel || LINK_LABELS[question.linkKind] || 'Διάβασε τους όρους';

  async function openDocument() {
    setLoading(true);
    setOpen(true);
    try {
      if (question.linkKind === 'operating' || question.linkKind === 'financial') {
        const data: any = await schoolsApi.getRegulations(schoolId);
        const body = question.linkKind === 'financial' ? data?.financialRegulation : data?.operatingRegulation;
        setText(body?.trim() || 'Ο διαχειριστής δεν έχει καταχωρίσει ακόμα αυτό το κείμενο.');
      } else if (question.linkKind === 'url') {
        setText(question.linkUrl || 'Δεν έχει οριστεί σύνδεσμος.');
      } else {
        setText(question.document?.trim() || question.help || 'Δεν έχει καταχωριστεί κείμενο.');
      }
    } catch {
      setText('Το κείμενο δεν φορτώθηκε.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-2">
      <button type="button" onClick={openDocument} className="text-xs font-semibold text-[#E95926] underline">
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[70vh] overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{label}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {loading ? <p className="text-sm text-gray-400">Φόρτωση...</p> : <p className="text-sm text-gray-700 whitespace-pre-wrap">{text}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
