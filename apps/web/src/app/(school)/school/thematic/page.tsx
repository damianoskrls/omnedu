'use client';

import { useCallback, useEffect, useState } from 'react';
import { classesApi, thematicPlansApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { APRIL_MAY_2026 } from '@/lib/thematic-april-may-2026';
import { Save, Sparkles, Trash2 } from 'lucide-react';

type ClassRow = { id: string; name: string };
type Plan = {
  id: string;
  classId: string;
  month: string;
  throughMonth?: string | null;
  title: string;
  greeting: string;
  introduction: string;
  goals: string;
  extras: string;
  closing: string;
  signature: string;
  class?: { id: string; name: string };
};

const EMPTY = {
  title: '',
  greeting: 'Αγαπημένοι μας γονείς,',
  introduction: '',
  goals: '',
  extras: '',
  closing: '',
  signature: '',
  throughMonth: '',
};

const MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

function monthName(ym?: string) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return '';
  const [year, month] = ym.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

function lines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function errorText(err: any) {
  const message = err?.message || err?.error;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' ? message : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.';
}

export default function ThematicPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const canEdit = user?.role === 'school_admin' || user?.role === 'teacher';

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [planId, setPlanId] = useState<string | null>(null);
  const [alsoClasses, setAlsoClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [holdSample, setHoldSample] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    try {
      const classRows = await classesApi.list(schoolId);
      const nextClasses = Array.isArray(classRows) ? classRows as ClassRow[] : [];
      setClasses(nextClasses);
      setClassId((current) => current || nextClasses[0]?.id || '');
      setError('');
    } catch {
      setError('Οι τάξεις δεν φορτώθηκαν.');
      return;
    }
    try {
      const planRows = await thematicPlansApi.list(schoolId, { month });
      setPlans(Array.isArray(planRows) ? planRows as Plan[] : []);
    } catch {
      setPlans([]);
    }
  }, [schoolId, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (holdSample) return;
    const existing = plans.find((plan) => plan.classId === classId);
    if (existing) {
      setPlanId(existing.id);
      setForm({
        title: existing.title,
        greeting: existing.greeting,
        introduction: existing.introduction,
        goals: existing.goals,
        extras: existing.extras,
        closing: existing.closing,
        signature: existing.signature,
        throughMonth: existing.throughMonth ?? '',
      });
    } else {
      setPlanId(null);
      setForm({ ...EMPTY, title: `Διαθεματικό ${monthName(month)}` });
    }
    setAlsoClasses([]);
  }, [classId, plans, month, holdSample]);

  const setField = (key: keyof typeof EMPTY, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!classId) { setError('Διάλεξε τάξη.'); return; }
    setSaving(true);
    setError('');
    setMessage('');
    const payload = {
      month,
      throughMonth: form.throughMonth || null,
      title: form.title,
      greeting: form.greeting,
      introduction: form.introduction,
      goals: form.goals,
      extras: form.extras,
      closing: form.closing,
      signature: form.signature,
    };
    try {
      await thematicPlansApi.save(schoolId, { ...payload, classId });
      for (const extraId of alsoClasses) {
        await thematicPlansApi.save(schoolId, { ...payload, classId: extraId });
      }
      setHoldSample(false);
      setMessage(alsoClasses.length ? 'Αποθηκεύτηκε στην τάξη και στα αντίγραφα.' : 'Αποθηκεύτηκε για αυτή την τάξη.');
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!planId) return;
    setSaving(true);
    setError('');
    try {
      await thematicPlansApi.remove(schoolId, planId);
      setMessage('Διαγράφηκε το διαθεματικό αυτής της τάξης.');
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const loadSample = () => {
    setHoldSample(true);
    setMonth(APRIL_MAY_2026.month);
    setForm({
      title: APRIL_MAY_2026.title,
      greeting: APRIL_MAY_2026.greeting,
      introduction: APRIL_MAY_2026.introduction,
      goals: APRIL_MAY_2026.goals,
      extras: APRIL_MAY_2026.extras,
      closing: APRIL_MAY_2026.closing,
      signature: APRIL_MAY_2026.signature,
      throughMonth: APRIL_MAY_2026.throughMonth,
    });
    setMessage('Μπήκε το κείμενο Απριλίου-Μαΐου 2026. Διάλεξε την τάξη και πάτα αποθήκευση.');
  };

  const className = classes.find((item) => item.id === classId)?.name ?? 'Τάξη';
  const period = form.throughMonth && form.throughMonth !== month
    ? `${monthName(month)} – ${monthName(form.throughMonth)}`
    : monthName(month);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Διαθεματικό</h1>
          <p className="text-sm text-gray-500 mt-1">Ξεχωριστό πρόγραμμα για κάθε τάξη, κάθε μήνα.</p>
        </div>
        {canEdit && (
          <button onClick={loadSample} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Sparkles size={15} /> Απρίλιος-Μάιος 2026
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="block font-medium text-gray-700 mb-1">Τάξη</span>
          <select value={classId} onChange={(e) => { setHoldSample(false); setClassId(e.target.value); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {classes.length === 0 && <option value="">Δεν υπάρχουν τάξεις</option>}
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <MonthField label="Μήνας" value={month} onChange={(value) => { setHoldSample(false); setMonth(value); }} />
        <MonthField label="Έως (προαιρετικά)" value={form.throughMonth} allowEmpty onChange={(value) => setField('throughMonth', value)} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {classes.map((item) => {
          const filled = plans.some((plan) => plan.classId === item.id);
          return (
            <button
              key={item.id}
              onClick={() => { setHoldSample(false); setClassId(item.id); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${item.id === classId ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'} ${filled ? '' : 'opacity-70'}`}
            >
              {item.name} {filled ? '· έτοιμο' : '· κενό'}
            </button>
          );
        })}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <Field label="Τίτλος" value={form.title} onChange={(value) => setField('title', value)} />
          <Field label="Χαιρετισμός" value={form.greeting} onChange={(value) => setField('greeting', value)} />
          <Area label="Εισαγωγή" value={form.introduction} onChange={(value) => setField('introduction', value)} rows={8} />
          <Area label="Εκπαιδευτικοί στόχοι (μία γραμμή ο καθένας)" value={form.goals} onChange={(value) => setField('goals', value)} rows={6} />
          <Area label="Επιπλέον δραστηριότητες (μία γραμμή η καθεμία)" value={form.extras} onChange={(value) => setField('extras', value)} rows={5} />
          <Area label="Κλείσιμο" value={form.closing} onChange={(value) => setField('closing', value)} rows={3} />
          <Area label="Υπογραφή" value={form.signature} onChange={(value) => setField('signature', value)} rows={2} />

          {canEdit && classes.filter((item) => item.id !== classId).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Αντίγραφο και σε άλλες τάξεις (το αλλάζεις μετά ξεχωριστά)</p>
              <div className="flex flex-wrap gap-2">
                {classes.filter((item) => item.id !== classId).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAlsoClasses((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${alsoClasses.includes(item.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving || !classId} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                <Save size={14} /> {saving ? 'Αποθήκευση...' : `Αποθήκευση · ${className}`}
              </button>
              {planId && (
                <button onClick={remove} disabled={saving} className="px-3 border border-red-200 text-red-600 rounded-lg text-sm">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <article className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <p className="text-center text-xs tracking-widest text-gray-400 mb-1">ΟΝΕΙΡΟΧΩΡΑ</p>
          <h2 className="text-center text-lg font-bold text-gray-900 mb-1">{form.title || 'Διαθεματικό'}</h2>
          <p className="text-center text-sm text-indigo-700 mb-4">{className} · {period}</p>
          <p className="text-sm text-gray-800 mb-3">{form.greeting}</p>
          {form.introduction.split(/\n\s*\n/).filter(Boolean).map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{paragraph}</p>
          ))}
          {lines(form.goals).length > 0 && (
            <>
              <p className="text-sm font-semibold text-gray-900 mt-4 mb-2">Οι εκπαιδευτικοί μας στόχοι αφορούν:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {lines(form.goals).map((goal) => <li key={goal}>{goal}</li>)}
              </ul>
            </>
          )}
          {lines(form.extras).length > 0 && (
            <>
              <p className="text-sm font-semibold text-gray-900 mt-4 mb-2">Επιπλέον:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {lines(form.extras).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </>
          )}
          {form.closing && <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{form.closing}</p>}
          {form.signature && <p className="text-sm text-gray-800 mt-4 whitespace-pre-wrap">{form.signature}</p>}
        </article>
      </div>
    </div>
  );
}

function MonthField({ label, value, onChange, allowEmpty }: { label: string; value: string; onChange: (value: string) => void; allowEmpty?: boolean }) {
  const now = new Date().getFullYear();
  const selectedYear = /^\d{4}-\d{2}$/.test(value) ? Number(value.slice(0, 4)) : now;
  const selectedMonth = /^\d{4}-\d{2}$/.test(value) ? value.slice(5, 7) : '';
  const years = Array.from(new Set([selectedYear - 1, selectedYear, selectedYear + 1, now])).sort();
  const emit = (monthPart: string, yearPart: number) => {
    if (!monthPart) { onChange(''); return; }
    onChange(`${yearPart}-${monthPart}`);
  };
  return (
    <label className="text-sm">
      <span className="block font-medium text-gray-700 mb-1">{label}</span>
      <span className="grid grid-cols-2 gap-2">
        <select value={selectedMonth} onChange={(e) => emit(e.target.value, selectedYear)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          {allowEmpty && <option value="">—</option>}
          {MONTHS.map((name, index) => (
            <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>
          ))}
        </select>
        <select value={selectedYear} onChange={(e) => emit(selectedMonth || (allowEmpty ? '' : '01'), Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </span>
    </label>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </label>
  );
}

function Area({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y" />
    </label>
  );
}
