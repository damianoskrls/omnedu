'use client';

import { useEffect, useState, useMemo } from 'react';
import { studentFormsApi, studentsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  ClipboardList, Search, CheckCircle2, Clock, ChevronRight, X, Save,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const CURRENT_YEAR = new Date().getFullYear();

const FIELDS = [
  { key: 'foodAllergies', label: 'Αλλεργίες τροφίμων', placeholder: 'πχ. γλουτένη, γαλακτοκομικά, ξηροί καρποί...' },
  { key: 'medicationAllergies', label: 'Αλλεργίες φαρμάκων', placeholder: 'πχ. πενικιλίνη, ασπιρίνη...' },
  { key: 'chronicConditions', label: 'Χρόνιες παθήσεις / ιδιαίτερες ανάγκες', placeholder: 'πχ. διαβήτης, επιληψία, άσθμα...' },
  { key: 'dietaryNotes', label: 'Διατροφικές ιδιαιτερότητες', placeholder: 'πχ. χορτοφάγος, νηστεία...' },
  { key: 'emergencyContact', label: 'Επείγουσα επαφή (εκτός γονέων)', placeholder: 'Ονοματεπώνυμο — τηλέφωνο' },
  { key: 'pediatricianName', label: 'Παιδίατρος — Ονοματεπώνυμο', placeholder: 'Δρ. Παπαδόπουλος Γιώργος' },
  { key: 'pediatricianPhone', label: 'Παιδίατρος — Τηλέφωνο', placeholder: '210 1234567' },
  { key: 'additionalNotes', label: 'Επιπλέον πληροφορίες', placeholder: 'Οτιδήποτε άλλο χρειάζεται να γνωρίζει το σχολείο...' },
] as const;

type FormKey = typeof FIELDS[number]['key'];

export default function QuestionnairesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'teacher';

  const [students, setStudents] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editStudent, setEditStudent] = useState<any>(null);
  const [editForm, setEditForm] = useState<Partial<Record<FormKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [s, f] = await Promise.all([
        studentsApi.list(schoolId) as Promise<any[]>,
        studentFormsApi.list(schoolId, CURRENT_YEAR) as Promise<any[]>,
      ]);
      setStudents(Array.isArray(s) ? s : []);
      setForms(Array.isArray(f) ? f : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]);

  const formMap = useMemo(() => {
    const m: Record<string, any> = {};
    forms.forEach((f) => { m[f.studentId] = f; });
    return m;
  }, [forms]);

  const filtered = students.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const submitted = students.filter((s) => formMap[s.id]?.submittedAt).length;

  const openEdit = (student: any) => {
    const existing = formMap[student.id] ?? {};
    setEditForm(
      Object.fromEntries(FIELDS.map(({ key }) => [key, existing[key] ?? ''])) as Record<FormKey, string>,
    );
    setEditStudent(student);
  };

  const save = async () => {
    if (!editStudent) return;
    setSaving(true);
    try {
      const payload: any = {};
      FIELDS.forEach(({ key }) => {
        payload[key] = editForm[key]?.trim() || null;
      });
      await studentFormsApi.upsert(schoolId, editStudent.id, CURRENT_YEAR, payload);
      setEditStudent(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ερωτηματολόγιο {CURRENT_YEAR}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Υγεία & στοιχεία μαθητών — {submitted}/{students.length} συμπληρωμένα
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-600">{submitted}</div>
          <div className="text-xs text-gray-400">από {students.length}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all"
          style={{ width: students.length ? `${(submitted / students.length) * 100}%` : '0%' }}
        />
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση μαθητή..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-100 shadow-sm">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">Δεν βρέθηκαν μαθητές.</p>
          ) : (
            filtered.map((student) => {
              const form = formMap[student.id];
              const done = !!form?.submittedAt;
              return (
                <div key={student.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {student.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{student.fullName}</p>
                      {done && form.submittedAt && (
                        <p className="text-xs text-emerald-600">
                          Υποβλήθηκε {format(new Date(form.submittedAt), 'd MMM yyyy', { locale: el })}
                        </p>
                      )}
                      {!done && (
                        <p className="text-xs text-gray-400">Δεν έχει συμπληρωθεί</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {done ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <Clock size={18} className="text-amber-400" />
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => openEdit(student)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        {done ? 'Επεξεργασία' : 'Συμπλήρωση'} <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Edit modal */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-6">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ερωτηματολόγιο</h2>
                <p className="text-sm text-gray-500">{editStudent.fullName} · {CURRENT_YEAR}</p>
              </div>
              <button onClick={() => setEditStudent(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  {key === 'additionalNotes' || key === 'chronicConditions' ? (
                    <textarea
                      value={editForm[key] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      placeholder={placeholder}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  ) : (
                    <input
                      value={editForm[key] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 p-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setEditStudent(null)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50"
              >
                Άκυρο
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={14} />
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
