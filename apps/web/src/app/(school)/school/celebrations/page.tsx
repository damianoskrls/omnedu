'use client';

import { useEffect, useState } from 'react';
import { celebrationsApi, classesApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { PartyPopper, Plus, Pencil, Trash2, X } from 'lucide-react';

type ItemDraft = { name: string; cost: string; phase: 'before' | 'after' };
type Celebration = {
  id: string;
  academicYear: string;
  title: string;
  eventDate?: string | null;
  arrivalTime?: string | null;
  place?: string | null;
  details?: string | null;
  items?: string;
};

function calendarYear(now = new Date()) {
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function parseItems(raw?: string): ItemDraft[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(row => row && typeof row.name === 'string').map(row => ({
      name: row.name,
      cost: row.cost == null || row.cost === '' ? '' : String(row.cost),
      phase: row.phase === 'after' ? 'after' : 'before',
    }));
  } catch {
    return [];
  }
}

const emptyForm = (year: string) => ({
  id: '',
  academicYear: year,
  title: '',
  eventDate: '',
  arrivalTime: '',
  place: '',
  details: '',
  items: [] as ItemDraft[],
});

export default function CelebrationsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';
  const [years, setYears] = useState<string[]>([calendarYear()]);
  const [year, setYear] = useState(calendarYear());
  const [rows, setRows] = useState<Celebration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    classesApi.academicYears(schoolId).then((data: any) => {
      const labels = new Set<string>([calendarYear()]);
      if (Array.isArray(data)) data.forEach((row: any) => { if (row?.label) labels.add(row.label); });
      const sorted = Array.from(labels).sort((a, b) => b.localeCompare(a));
      setYears(sorted);
      const current = sorted.find(label => label === calendarYear()) ?? sorted[0];
      setYear(current);
    }).catch(() => undefined);
  }, [schoolId]);

  const load = async (selected = year) => {
    if (!schoolId || !selected) return;
    setLoading(true);
    setError('');
    try {
      const data = await celebrationsApi.list(schoolId, selected) as any;
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const message = err?.message;
      setError(typeof message === 'string' && message !== 'Internal server error'
        ? message
        : 'Οι γιορτές δεν φορτώθηκαν.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(year); }, [schoolId, year]);

  const save = async () => {
    if (!form?.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        academicYear: year,
        title: form.title.trim(),
        eventDate: form.eventDate || null,
        arrivalTime: form.arrivalTime || null,
        place: form.place || null,
        details: form.details || null,
        items: form.items
          .map(item => ({ name: item.name.trim(), cost: item.cost === '' ? null : Number(item.cost), phase: item.phase }))
          .filter(item => item.name),
      };
      if (form.id) await celebrationsApi.update(schoolId, form.id, payload);
      else await celebrationsApi.create(schoolId, payload);
      setForm(null);
      await load(year);
    } catch (err: any) {
      const message = err?.message;
      setError(typeof message === 'string' && message !== 'Internal server error' ? message : 'Η γιορτή δεν αποθηκεύτηκε.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Να διαγραφεί η γιορτή;')) return;
    await celebrationsApi.remove(schoolId, id);
    await load(year);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Γιορτές</h1>
          <p className="text-sm text-gray-500 mt-1">Ανά σχολική χρονιά: πότε, πού, ώρα προσέλευσης, στολή και USB.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setForm(emptyForm(year))}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Νέα γιορτή
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {years.map(label => (
          <button key={label} onClick={() => setYear(label)}
            className={`px-3 py-1.5 rounded-full text-sm border ${year === label ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-gray-400">Φόρτωση...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PartyPopper className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Δεν υπάρχουν γιορτές για τη χρονιά {year}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const items = parseItems(row.items);
            const before = items.filter(item => item.phase !== 'after');
            const after = items.filter(item => item.phase === 'after');
            return (
              <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{row.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {row.eventDate ? new Date(row.eventDate).toLocaleDateString('el-GR', { timeZone: 'UTC' }) : 'Χωρίς ημερομηνία'}
                      {row.arrivalTime ? ` · προσέλευση ${row.arrivalTime}` : ''}
                      {row.place ? ` · ${row.place}` : ''}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => setForm({
                        id: row.id,
                        academicYear: row.academicYear,
                        title: row.title,
                        eventDate: row.eventDate ? row.eventDate.slice(0, 10) : '',
                        arrivalTime: row.arrivalTime ?? '',
                        place: row.place ?? '',
                        details: row.details ?? '',
                        items: parseItems(row.items),
                      })} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><Pencil className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => remove(row.id)} className="p-2 rounded-lg border border-red-200 hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  )}
                </div>
                {row.details && <p className="text-sm text-gray-700 mt-3 whitespace-pre-line">{row.details}</p>}
                <ItemList title="Πριν τη γιορτή" items={before} />
                <ItemList title="Μετά τη γιορτή" items={after} />
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{form.id ? 'Επεξεργασία γιορτής' : 'Νέα γιορτή'}</h2>
              <button onClick={() => setForm(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">Σχολική χρονιά {year}</p>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Τίτλος, π.χ. Καλοκαιρινή γιορτή"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.eventDate}
                  onChange={e => setForm({ ...form, eventDate: e.target.value })} />
                <input type="time" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.arrivalTime}
                  onChange={e => setForm({ ...form, arrivalTime: e.target.value })} />
              </div>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Πού θα γίνει"
                value={form.place} onChange={e => setForm({ ...form, place: e.target.value })} />
              <textarea rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Λεπτομέρειες, π.χ. το παιδί να είναι εκεί στις 17:30"
                value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} />
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">Στολή, USB και άλλα κόστη</p>
                <button type="button" className="text-xs text-[#77328D] font-medium"
                  onClick={() => setForm({ ...form, items: [...form.items, { name: '', cost: '', phase: 'before' }] })}>+ Στοιχείο</button>
              </div>
              {form.items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <select className="border border-gray-200 rounded-lg px-2 py-2 text-sm" value={item.phase}
                    onChange={e => setForm({ ...form, items: form.items.map((row, i) => i === index ? { ...row, phase: e.target.value as 'before' | 'after' } : row) })}>
                    <option value="before">Πριν</option>
                    <option value="after">Μετά</option>
                  </select>
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="π.χ. Στολή ή USB με φωτογραφίες"
                    value={item.name} onChange={e => setForm({ ...form, items: form.items.map((row, i) => i === index ? { ...row, name: e.target.value } : row) })} />
                  <input type="number" min="0" step="0.01" className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm" placeholder="€"
                    value={item.cost} onChange={e => setForm({ ...form, items: form.items.map((row, i) => i === index ? { ...row, cost: e.target.value } : row) })} />
                  <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Ακύρωση</button>
              <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemList({ title, items }: { title: string; items: ItemDraft[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
      <ul className="text-sm text-gray-800 space-y-1">
        {items.map(item => (
          <li key={`${item.phase}-${item.name}`}>{item.name}{item.cost ? ` · ${item.cost}€` : ''}</li>
        ))}
      </ul>
    </div>
  );
}
