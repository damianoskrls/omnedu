'use client';

import { useEffect, useState } from 'react';
import { schoolsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { DEFAULT_FINANCIAL_REGULATION, DEFAULT_OPERATING_REGULATION } from '@/lib/school-regulations';

type Kind = 'operating' | 'financial';

const TABS: { key: Kind; label: string; field: 'operatingRegulation' | 'financialRegulation'; fallback: string }[] = [
  { key: 'operating', label: 'Κανονισμός λειτουργίας', field: 'operatingRegulation', fallback: DEFAULT_OPERATING_REGULATION },
  { key: 'financial', label: 'Οικονομικός κανονισμός', field: 'financialRegulation', fallback: DEFAULT_FINANCIAL_REGULATION },
];

export default function RegulationsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';
  const [school, setSchool] = useState<any>(null);
  const [tab, setTab] = useState<Kind>('operating');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    schoolsApi.get(schoolId).then(setSchool).catch(() => setSchool(null));
  }, [schoolId]);

  const current = TABS.find((item) => item.key === tab)!;
  const stored = (school?.[current.field] as string | null | undefined)?.trim();
  const text = stored || current.fallback;

  function startEdit() {
    setDraft(text);
    setSaved(false);
    setError('');
    setEditing(true);
  }

  async function save() {
    if (!schoolId) return;
    setSaving(true);
    setError('');
    try {
      const updated: any = await schoolsApi.update(schoolId, { [current.field]: draft });
      setSchool(updated);
      setEditing(false);
      setSaved(true);
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Η αποθήκευση απέτυχε.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-extrabold tracking-wide text-[#E95926]">Ονειροχώρα</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2422]">Κανονισμοί</h1>
        <p className="mt-1 text-sm text-[#6b625c]">
          Ο κανονισμός λειτουργίας και ο οικονομικός κανονισμός του σχολείου, μέσα στο σύστημα.
        </p>
      </div>

      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-[#f3e8f7]/70 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => { setTab(item.key); setEditing(false); setSaved(false); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-white text-[#642678] shadow-sm' : 'text-[#6b625c]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#77328d]/10 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="font-bold text-[#2c2422]">{current.label}</h2>
          {isAdmin && !editing && (
            <button type="button" onClick={startEdit} className="rounded-lg bg-[#77328D] px-3 py-1.5 text-sm font-semibold text-white">
              Επεξεργασία
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3 p-5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={22}
              className="w-full rounded-xl border border-[#e4d7ea] px-4 py-3 text-sm leading-6 text-[#2f2a28] focus:border-[#77328D] focus:outline-none focus:ring-2 focus:ring-[#77328D]/20"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Ακύρωση</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#77328D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">
            {!stored && (
              <p className="mb-4 rounded-xl bg-[#fff6f1] px-3 py-2 text-xs text-[#8a5a32]">
                Εμφανίζεται ο κανονισμός της Ονειροχώρας. Η αποθήκευση τον κρατά στο σχολείο και από εκεί μπορεί να αλλάξει.
              </p>
            )}
            {saved && <p className="mb-3 text-sm font-medium text-emerald-700">Αποθηκεύτηκε.</p>}
            <div className="whitespace-pre-wrap text-sm leading-7 text-[#3f3834]">{text}</div>
          </div>
        )}
      </div>
    </div>
  );
}
