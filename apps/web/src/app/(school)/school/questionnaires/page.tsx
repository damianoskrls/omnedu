'use client';

import { useEffect, useState, useMemo } from 'react';
import { questionnairesApi, studentFormsApi, studentsApi, classesApi, levelsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  ClipboardList, Plus, Search, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Pencil, Trash2, X, Save, Users, BookOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const CURRENT_YEAR = new Date().getFullYear();

const FORM_FIELDS = [
  { key: 'foodAllergies', label: 'Αλλεργίες τροφίμων', placeholder: 'πχ. γλουτένη, γαλακτοκομικά, ξηροί καρποί...' },
  { key: 'medicationAllergies', label: 'Αλλεργίες φαρμάκων', placeholder: 'πχ. πενικιλίνη, ασπιρίνη...' },
  { key: 'chronicConditions', label: 'Χρόνιες παθήσεις / ιδιαίτερες ανάγκες', placeholder: 'πχ. διαβήτης, επιληψία, άσθμα...', multiline: true },
  { key: 'dietaryNotes', label: 'Διατροφικές ιδιαιτερότητες', placeholder: 'πχ. χορτοφάγος, νηστεία...' },
  { key: 'emergencyContact', label: 'Επείγουσα επαφή (εκτός γονέων)', placeholder: 'Ονοματεπώνυμο — τηλέφωνο' },
  { key: 'pediatricianName', label: 'Παιδίατρος — Ονοματεπώνυμο', placeholder: 'Δρ. Παπαδόπουλος Γιώργος' },
  { key: 'pediatricianPhone', label: 'Παιδίατρος — Τηλέφωνο', placeholder: '210 1234567' },
  { key: 'additionalNotes', label: 'Επιπλέον πληροφορίες', placeholder: 'Οτιδήποτε άλλο χρειάζεται να γνωρίζει το σχολείο...', multiline: true },
] as const;

type FormFieldKey = typeof FORM_FIELDS[number]['key'];

type Questionnaire = {
  id: string;
  title: string;
  description?: string;
  academicYear: number;
  scopeType: 'all' | 'class' | 'level';
  scopeIds: string; // JSON string
  isActive: boolean;
  createdAt: string;
};

type Student = { id: string; fullName: string; avatarUrl?: string; enrollments?: { classId: string; class?: { levelId?: string } }[] };
type Class = { id: string; name: string; levelId?: string };
type Level = { id: string; name: string };
type StudentForm = { studentId: string; academicYear: number; submittedAt?: string; [key: string]: any };

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function QuestionnairesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'teacher';

  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [forms, setForms] = useState<StudentForm[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});

  // Create / edit questionnaire modal
  const [editModal, setEditModal] = useState<Partial<Questionnaire> | null>(null);
  const [savingQ, setSavingQ] = useState(false);

  // Fill student form modal
  const [fillModal, setFillModal] = useState<{ student: Student; questionnaireId: string } | null>(null);
  const [fillForm, setFillForm] = useState<Partial<Record<FormFieldKey, string>>>({});
  const [savingF, setSavingF] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [q, s, f, c, l] = await Promise.all([
        questionnairesApi.list(schoolId, CURRENT_YEAR) as Promise<any>,
        studentsApi.list(schoolId) as Promise<any>,
        studentFormsApi.list(schoolId, CURRENT_YEAR) as Promise<any>,
        classesApi.list(schoolId) as Promise<any>,
        levelsApi.list(schoolId) as Promise<any>,
      ]);
      setQuestionnaires(Array.isArray(q) ? q : []);
      setStudents(Array.isArray(s) ? s : []);
      setForms(Array.isArray(f) ? f : []);
      setClasses(Array.isArray(c) ? c : []);
      setLevels(Array.isArray(l) ? l : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]);

  const formMap = useMemo(() => {
    const m: Record<string, StudentForm> = {};
    forms.forEach(f => { m[f.studentId] = f; });
    return m;
  }, [forms]);

  const getTargetStudents = (q: Questionnaire): Student[] => {
    const ids = (() => {
      try { return JSON.parse(q.scopeIds) as string[]; } catch { return []; }
    })();
    if (q.scopeType === 'all') return students;
    if (q.scopeType === 'class') {
      return students.filter(s =>
        s.enrollments?.some(e => ids.includes(e.classId))
      );
    }
    if (q.scopeType === 'level') {
      const classIds = new Set(classes.filter(c => c.levelId && ids.includes(c.levelId)).map(c => c.id));
      return students.filter(s =>
        s.enrollments?.some(e => classIds.has(e.classId))
      );
    }
    return students;
  };

  const openFill = (student: Student, questionnaireId: string) => {
    const existing = formMap[student.id] ?? {};
    setFillForm(Object.fromEntries(FORM_FIELDS.map(({ key }) => [key, existing[key] ?? ''])) as Record<FormFieldKey, string>);
    setFillModal({ student, questionnaireId });
  };

  const saveFill = async () => {
    if (!fillModal) return;
    setSavingF(true);
    try {
      const payload: any = {};
      FORM_FIELDS.forEach(({ key }) => { payload[key] = fillForm[key]?.trim() || null; });
      await studentFormsApi.upsert(schoolId, fillModal.student.id, CURRENT_YEAR, payload);
      setFillModal(null);
      const f = await studentFormsApi.list(schoolId, CURRENT_YEAR) as any;
      setForms(Array.isArray(f) ? f : []);
    } finally {
      setSavingF(false);
    }
  };

  const saveQuestionnaire = async () => {
    if (!editModal?.title?.trim()) return;
    setSavingQ(true);
    try {
      const payload = {
        title: editModal.title,
        description: editModal.description || undefined,
        academicYear: editModal.academicYear ?? CURRENT_YEAR,
        scopeType: editModal.scopeType ?? 'all',
        scopeIds: (() => { try { return JSON.parse((editModal as any)._scopeIds ?? '[]'); } catch { return []; } })(),
      };
      if (editModal.id) {
        await questionnairesApi.update(schoolId, editModal.id, payload);
      } else {
        await questionnairesApi.create(schoolId, payload);
      }
      setEditModal(null);
      const q = await questionnairesApi.list(schoolId, CURRENT_YEAR) as any;
      setQuestionnaires(Array.isArray(q) ? q : []);
    } finally {
      setSavingQ(false);
    }
  };

  const deleteQuestionnaire = async (id: string) => {
    if (!confirm('Να διαγραφεί οριστικά αυτό το ερωτηματολόγιο;')) return;
    await questionnairesApi.remove(schoolId, id);
    setQuestionnaires(prev => prev.filter(q => q.id !== id));
  };

  const scopeLabel = (q: Questionnaire) => {
    if (q.scopeType === 'all') return 'Όλοι οι μαθητές';
    const ids: string[] = (() => { try { return JSON.parse(q.scopeIds); } catch { return []; } })();
    if (q.scopeType === 'class') {
      const names = ids.map(id => classes.find(c => c.id === id)?.name).filter(Boolean);
      return names.length ? `Τάξεις: ${names.join(', ')}` : 'Συγκεκριμένες τάξεις';
    }
    if (q.scopeType === 'level') {
      const names = ids.map(id => levels.find(l => l.id === id)?.name).filter(Boolean);
      return names.length ? `Βαθμίδες: ${names.join(', ')}` : 'Συγκεκριμένες βαθμίδες';
    }
    return '';
  };

  const totalAll = questionnaires.reduce((sum, q) => sum + getTargetStudents(q).length, 0);
  const totalDone = questionnaires.reduce((sum, q) => {
    return sum + getTargetStudents(q).filter(s => !!formMap[s.id]?.submittedAt).length;
  }, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ερωτηματολόγια</h1>
          <p className="text-sm text-gray-500 mt-1">
            {CURRENT_YEAR} — {questionnaires.length} ερωτηματολόγια · {totalDone}/{totalAll} συμπληρωμένα
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditModal({ scopeType: 'all', academicYear: CURRENT_YEAR, _scopeIds: '[]' } as any)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Νέο Ερωτηματολόγιο
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : questionnaires.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Δεν υπάρχουν ερωτηματολόγια ακόμα</p>
          <p className="text-sm text-gray-400 mt-1">Δημιουργήστε το πρώτο ερωτηματολόγιο</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questionnaires.map(q => {
            const targets = getTargetStudents(q);
            const done = targets.filter(s => !!formMap[s.id]?.submittedAt).length;
            const pct = targets.length ? Math.round((done / targets.length) * 100) : 0;
            const isOpen = expandedId === q.id;
            const qSearch = search[q.id] ?? '';
            const filtered = targets.filter(s =>
              s.fullName.toLowerCase().includes(qSearch.toLowerCase())
            );

            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div
                  className="p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : q.id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{q.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{q.academicYear}</span>
                    </div>
                    {q.description && <p className="text-xs text-gray-500 mt-0.5">{q.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />{scopeLabel(q)}
                      </span>
                      <span className="text-xs text-gray-500">{done}/{targets.length} συμπληρωμένα</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 max-w-xs">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && (
                      <>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditModal({ ...q, _scopeIds: q.scopeIds } as any);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteQuestionnaire(q.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded student list */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <div className="px-4 pt-3 pb-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          value={qSearch}
                          onChange={e => setSearch(prev => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Αναζήτηση μαθητή..."
                          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {filtered.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Δεν βρέθηκαν μαθητές</p>
                      ) : (
                        filtered.map(student => {
                          const form = formMap[student.id];
                          const done = !!form?.submittedAt;
                          return (
                            <div key={student.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                                  {student.avatarUrl
                                    ? <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" />
                                    : student.fullName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{student.fullName}</p>
                                  {done && form.submittedAt ? (
                                    <p className="text-xs text-emerald-600">
                                      Υποβλήθηκε {format(new Date(form.submittedAt), 'd MMM yyyy', { locale: el })}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-400">Δεν έχει συμπληρωθεί</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {done ? (
                                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" size={18} />
                                ) : (
                                  <Clock className="w-4.5 h-4.5 text-amber-400" size={18} />
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => openFill(student, q.id)}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2.5 py-1 rounded-lg hover:bg-indigo-50"
                                  >
                                    {done ? 'Επεξεργασία' : 'Συμπλήρωση'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create/Edit questionnaire modal ─── */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {editModal.id ? 'Επεξεργασία Ερωτηματολογίου' : 'Νέο Ερωτηματολόγιο'}
              </h2>
              <button onClick={() => setEditModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Τίτλος *</label>
                <input
                  className={inputCls}
                  value={editModal.title ?? ''}
                  onChange={e => setEditModal(p => ({ ...p!, title: e.target.value }))}
                  placeholder="π.χ. Ερωτηματολόγιο Υγείας 2026"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Περιγραφή</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={2}
                  value={editModal.description ?? ''}
                  onChange={e => setEditModal(p => ({ ...p!, description: e.target.value }))}
                  placeholder="Σύντομη περιγραφή..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Σχολικό έτος</label>
                <input
                  type="number"
                  className={inputCls}
                  value={editModal.academicYear ?? CURRENT_YEAR}
                  onChange={e => setEditModal(p => ({ ...p!, academicYear: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Αφορά</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all', label: 'Όλους τους μαθητές', icon: '👥' },
                    { value: 'class', label: 'Συγκεκριμένες τάξεις', icon: '🏫' },
                    { value: 'level', label: 'Συγκεκριμένες βαθμίδες', icon: '📚' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditModal(p => ({ ...p!, scopeType: opt.value as any, _scopeIds: '[]' } as any))}
                      className={`py-2.5 px-2 text-xs rounded-xl border-2 font-medium transition-colors text-center ${
                        editModal.scopeType === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                      }`}
                    >
                      <div className="text-base mb-0.5">{opt.icon}</div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class selector */}
              {editModal.scopeType === 'class' && classes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Επιλογή τάξεων</label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {classes.map(c => {
                      const ids: string[] = (() => { try { return JSON.parse((editModal as any)._scopeIds ?? '[]'); } catch { return []; } })();
                      const selected = ids.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const cur: string[] = (() => { try { return JSON.parse((editModal as any)._scopeIds ?? '[]'); } catch { return []; } })();
                            const next = selected ? cur.filter(x => x !== c.id) : [...cur, c.id];
                            setEditModal(p => ({ ...p!, _scopeIds: JSON.stringify(next) } as any));
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                            selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Level selector */}
              {editModal.scopeType === 'level' && levels.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Επιλογή βαθμίδων</label>
                  <div className="flex flex-wrap gap-2">
                    {levels.map(l => {
                      const ids: string[] = (() => { try { return JSON.parse((editModal as any)._scopeIds ?? '[]'); } catch { return []; } })();
                      const selected = ids.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            const cur: string[] = (() => { try { return JSON.parse((editModal as any)._scopeIds ?? '[]'); } catch { return []; } })();
                            const next = selected ? cur.filter(x => x !== l.id) : [...cur, l.id];
                            setEditModal(p => ({ ...p!, _scopeIds: JSON.stringify(next) } as any));
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                            selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                          }`}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setEditModal(null)} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm hover:bg-gray-50">
                Ακύρωση
              </button>
              <button
                onClick={saveQuestionnaire}
                disabled={savingQ || !editModal.title?.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingQ ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fill student form modal ─── */}
      {fillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-6">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ερωτηματολόγιο Υγείας</h2>
                <p className="text-sm text-gray-500">{fillModal.student.fullName} · {CURRENT_YEAR}</p>
              </div>
              <button onClick={() => setFillModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {FORM_FIELDS.map(({ key, label, placeholder, multiline }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  {multiline ? (
                    <textarea
                      value={fillForm[key] ?? ''}
                      onChange={e => setFillForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  ) : (
                    <input
                      value={fillForm[key] ?? ''}
                      onChange={e => setFillForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-gray-100">
              <button onClick={() => setFillModal(null)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50">
                Άκυρο
              </button>
              <button
                onClick={saveFill}
                disabled={savingF}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
