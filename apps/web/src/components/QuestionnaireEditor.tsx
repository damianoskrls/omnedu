'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, Plus, Save, X, Heading, Calendar, Hash, CheckSquare, FileText, AlignLeft, ToggleLeft, List } from 'lucide-react';
import { questionnairesApi, classesApi, levelsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { LinkKind, Question, QuestionType, registrationQuestionnaire } from '@/lib/registration-questionnaire';
import { AudienceSelector, AudienceValue } from '@/components/AudienceSelector';

const CURRENT_YEAR = new Date().getFullYear();

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

const parseJson = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s); } catch { return fallback; }
};

const genId = () => Math.random().toString(36).slice(2, 9);

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

export type QuestionnaireEditorState = {
  id?: string;
  title: string;
  description: string;
  academicYear: number;
  questions: Question[];
  audience: AudienceValue;
  deadline: string;
  status: 'draft' | 'sent';
};

export function emptyQuestionnaireState(template?: 'registration' | null): QuestionnaireEditorState {
  if (template === 'registration') {
    const form = registrationQuestionnaire();
    return {
      title: form.title,
      description: form.description,
      academicYear: CURRENT_YEAR,
      questions: form.questions,
      audience: { audienceType: 'all', audienceIds: [] },
      deadline: '',
      status: 'draft',
    };
  }
  return {
    title: '',
    description: '',
    academicYear: CURRENT_YEAR,
    questions: [],
    audience: { audienceType: 'all', audienceIds: [] },
    deadline: '',
    status: 'draft',
  };
}

export function stateFromQuestionnaire(q: {
  id: string;
  title: string;
  description?: string;
  academicYear: number;
  questions: string | Question[];
  scopeType: string;
  scopeIds: string | string[];
  deadline?: string;
  status: 'draft' | 'sent';
}): QuestionnaireEditorState {
  const questions = typeof q.questions === 'string'
    ? parseJson<Question[]>(q.questions, [])
    : (q.questions || []);
  const scopeIds = typeof q.scopeIds === 'string'
    ? parseJson<string[]>(q.scopeIds, [])
    : (q.scopeIds || []);
  return {
    id: q.id,
    title: q.title,
    description: q.description ?? '',
    academicYear: q.academicYear,
    questions,
    audience: {
      audienceType: q.scopeType as AudienceValue['audienceType'],
      audienceIds: scopeIds,
    },
    deadline: q.deadline ? q.deadline.slice(0, 16) : '',
    status: q.status,
  };
}

type Props = {
  mode: 'create' | 'edit';
  questionnaireId?: string;
  /** Prefill for create (e.g. registration template). */
  initialTemplate?: 'registration' | null;
};

export function QuestionnaireEditor({ mode, questionnaireId, initialTemplate }: Props) {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const router = useRouter();
  const { selectedYear } = useAcademicYear();

  const [state, setState] = useState<QuestionnaireEditorState | null>(
    mode === 'create' ? emptyQuestionnaireState(initialTemplate) : null,
  );
  const [classes, setClasses] = useState<{ id: string; name: string; levelId?: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    Promise.all([
      classesApi.list(schoolId, selectedYear?.id) as Promise<any>,
      levelsApi.list(schoolId) as Promise<any>,
    ]).then(([c, l]) => {
      if (cancelled) return;
      setClasses(Array.isArray(c) ? c : []);
      setLevels(Array.isArray(l) ? l : []);
    }).catch(() => {
      if (!cancelled) {
        setClasses([]);
        setLevels([]);
      }
    });
    return () => { cancelled = true; };
  }, [schoolId, selectedYear?.id]);

  useEffect(() => {
    if (mode !== 'edit' || !questionnaireId || !schoolId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    questionnairesApi.get(schoolId, questionnaireId)
      .then((q: any) => {
        if (cancelled) return;
        setState(stateFromQuestionnaire(q));
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || 'Αποτυχία φόρτωσης');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode, questionnaireId, schoolId]);

  function goBack() {
    router.push('/school/questionnaires');
  }

  const addQuestion = () => {
    const q: Question = { id: genId(), text: '', type: 'yesno' };
    setState((p) => (p ? { ...p, questions: [...p.questions, q] } : p));
  };

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setState((p) =>
      p ? { ...p, questions: p.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) } : p,
    );
  };

  const removeQuestion = (id: string) => {
    setState((p) => (p ? { ...p, questions: p.questions.filter((q) => q.id !== id) } : p));
  };

  const save = async () => {
    if (!state?.title.trim() || !schoolId) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: state.title,
        description: state.description || undefined,
        academicYear: state.academicYear,
        questions: state.questions,
        scopeType: state.audience.audienceType,
        scopeIds: state.audience.audienceIds,
        deadline: state.deadline || undefined,
        status: state.status,
      };
      if (state.id) {
        await questionnairesApi.update(schoolId, state.id, payload);
      } else {
        await questionnairesApi.create(schoolId, payload);
      }
      goBack();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (!schoolId) {
    return <div className="p-6 text-sm text-gray-500">Φόρτωση σχολείου...</div>;
  }

  if (loading || !state) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse mb-4" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <div className="sticky top-0 z-10 -mx-1 mb-4 border-b border-gray-100 bg-white/95 px-1 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={goBack}
              className="mt-0.5 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Πίσω"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {state.id ? 'Επεξεργασία Ερωτηματολογίου' : 'Νέο Ερωτηματολόγιο'}
              </h1>
              <p className="text-sm text-gray-500">
                {state.questions.length} ερωτήσεις · {state.status === 'sent' ? 'Απεσταλμένο' : 'Πρόχειρο'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Πίσω
            </button>
            <button
              type="button"
              disabled={saving || !state.title.trim()}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Τίτλος *</label>
          <input
            className={inputCls}
            value={state.title}
            onChange={(e) => setState((p) => (p ? { ...p, title: e.target.value } : p))}
            placeholder="π.χ. Ερωτηματολόγιο Υγείας 2026"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Περιγραφή</label>
          <textarea
            className={inputCls + ' resize-none'}
            rows={2}
            value={state.description}
            onChange={(e) => setState((p) => (p ? { ...p, description: e.target.value } : p))}
            placeholder="Σύντομη περιγραφή..."
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-gray-600">Απευθύνεται σε</label>
          <AudienceSelector
            value={state.audience}
            onChange={(v) => setState((p) => (p ? { ...p, audience: v } : p))}
            classes={classes}
            levels={levels}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Προθεσμία συμπλήρωσης</label>
          <input
            type="datetime-local"
            className={inputCls}
            value={state.deadline}
            onChange={(e) => setState((p) => (p ? { ...p, deadline: e.target.value } : p))}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">
              Ερωτήσεις ({state.questions.length})
            </label>
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Plus className="h-3.5 w-3.5" /> Προσθήκη ερώτησης
            </button>
          </div>

          {state.questions.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
              <ClipboardList className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">Δεν υπάρχουν ερωτήσεις ακόμα</p>
              <button
                type="button"
                onClick={addQuestion}
                className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Προσθήκη πρώτης ερώτησης
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {state.questions.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <input
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                        placeholder="Κείμενο ερώτησης..."
                      />
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(Q_TYPE_META) as QuestionType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              updateQuestion(q.id, {
                                type: t,
                                options: t === 'choice' ? (q.options?.length ? q.options : ['', '']) : undefined,
                              })
                            }
                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              q.type === t
                                ? 'border-[#77328D] bg-[#77328D]/10 text-[#77328D]'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-[#77328D]/30'
                            }`}
                          >
                            {Q_TYPE_META[t].icon}
                            {Q_TYPE_META[t].label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                        value={q.help ?? ''}
                        onChange={(e) => updateQuestion(q.id, { help: e.target.value })}
                        placeholder={
                          q.type === 'section'
                            ? 'Σύντομη περιγραφή της ενότητας...'
                            : 'Επεξήγηση που βλέπει ο γονέας κάτω από την ερώτηση...'
                        }
                      />
                      {(q.type === 'yesno' || q.type === 'agree') && (
                        <div className="space-y-2">
                          <select
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                            value={q.linkKind ?? ''}
                            onChange={(e) => {
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
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              value={q.linkUrl ?? ''}
                              onChange={(e) => updateQuestion(q.id, { linkUrl: e.target.value })}
                              placeholder="https://"
                            />
                          )}
                          {(q.linkKind === 'medication' || q.linkKind === 'text') && (
                            <textarea
                              rows={4}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              value={q.document ?? ''}
                              onChange={(e) => updateQuestion(q.id, { document: e.target.value })}
                              placeholder="Το κείμενο που ανοίγει ο σύνδεσμος..."
                            />
                          )}
                        </div>
                      )}

                      {q.type === 'choice' && (
                        <div className="ml-1 space-y-1.5">
                          {(q.options ?? ['', '']).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />
                              <input
                                className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...(q.options ?? [])];
                                  opts[i] = e.target.value;
                                  updateQuestion(q.id, { options: opts });
                                }}
                                placeholder={`Επιλογή ${i + 1}`}
                              />
                              {(q.options ?? []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const opts = (q.options ?? []).filter((_, j) => j !== i);
                                    updateQuestion(q.id, { options: opts });
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => updateQuestion(q.id, { options: [...(q.options ?? []), ''] })}
                            className="ml-6 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            <Plus className="h-3 w-3" /> Επιλογή
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="shrink-0 rounded p-1 text-red-400 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
