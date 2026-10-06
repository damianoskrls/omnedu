'use client';

import { useEffect, useState } from 'react';
import { broadcastsApi, classesApi, schoolsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { DEFAULT_FINANCIAL_REGULATION, DEFAULT_OPERATING_REGULATION } from '@/lib/school-regulations';

type Kind = 'operating' | 'financial';

const TABS: { key: Kind; label: string; field: 'operatingRegulation' | 'financialRegulation'; fallback: string }[] = [
  { key: 'operating', label: 'Κανονισμός λειτουργίας', field: 'operatingRegulation', fallback: DEFAULT_OPERATING_REGULATION },
  { key: 'financial', label: 'Οικονομικός κανονισμός', field: 'financialRegulation', fallback: DEFAULT_FINANCIAL_REGULATION },
];

function calendarYear(now = new Date()) {
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export default function RegulationsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';
  const [years, setYears] = useState<{ label: string; isCurrent?: boolean }[]>([]);
  const [year, setYear] = useState(calendarYear());
  const [stored, setStored] = useState<{ operatingRegulation: string | null; financialRegulation: string | null }>({
    operatingRegulation: null,
    financialRegulation: null,
  });
  const [tab, setTab] = useState<Kind>('operating');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    classesApi.academicYears(schoolId).then((rows: any) => {
      const list = Array.isArray(rows) ? rows : [];
      const labels = new Map<string, { label: string; isCurrent?: boolean }>();
      const current = calendarYear();
      labels.set(current, { label: current, isCurrent: true });
      for (const row of list) {
        if (!row?.label) continue;
        labels.set(row.label, { label: row.label, isCurrent: !!row.isCurrent || labels.get(row.label)?.isCurrent });
      }
      const sorted = Array.from(labels.values()).sort((a, b) => b.label.localeCompare(a.label));
      setYears(sorted);
      const selected = sorted.find((item) => item.isCurrent)?.label ?? current;
      setYear(selected);
    }).catch(() => {
      const current = calendarYear();
      setYears([{ label: current, isCurrent: true }]);
      setYear(current);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !year) return;
    setEditing(false);
    setNotice('');
    setError('');
    schoolsApi.getRegulations(schoolId, year).then((data: any) => {
      setStored({
        operatingRegulation: data?.operatingRegulation ?? null,
        financialRegulation: data?.financialRegulation ?? null,
      });
    }).catch(async () => {
      const school: any = await schoolsApi.get(schoolId).catch(() => null);
      const current = years.find((item) => item.isCurrent)?.label ?? calendarYear();
      if (year === current && school) {
        setStored({
          operatingRegulation: school.operatingRegulation ?? null,
          financialRegulation: school.financialRegulation ?? null,
        });
      } else {
        setStored({ operatingRegulation: null, financialRegulation: null });
      }
    });
  }, [schoolId, year]);

  const current = TABS.find((item) => item.key === tab)!;
  const savedText = (stored[current.field] ?? '').trim();
  const text = savedText || current.fallback;

  function startEdit() {
    setDraft(savedText || current.fallback);
    setNotice('');
    setError('');
    setEditing(true);
  }

  async function persist(body: string) {
    try {
      const updated: any = await schoolsApi.saveRegulations(schoolId, {
        academicYear: year,
        [current.field]: body,
      });
      setStored({
        operatingRegulation: updated?.operatingRegulation ?? null,
        financialRegulation: updated?.financialRegulation ?? null,
      });
      return true;
    } catch {
      const currentYear = years.find((item) => item.isCurrent)?.label ?? calendarYear();
      if (year !== currentYear) {
        setError('Η αποθήκευση για αυτό το έτος θέλει την ενημέρωση του διακομιστή.');
        return false;
      }
      const updated: any = await schoolsApi.update(schoolId, { [current.field]: body });
      setStored({
        operatingRegulation: updated?.operatingRegulation ?? stored.operatingRegulation,
        financialRegulation: updated?.financialRegulation ?? stored.financialRegulation,
      });
      return true;
    }
  }

  async function save() {
    if (!schoolId) return;
    setSaving(true);
    setError('');
    try {
      const ok = await persist(draft);
      if (ok) {
        setEditing(false);
        setNotice('Αποθηκεύτηκε για το σχολικό έτος ' + year + '.');
      }
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Η αποθήκευση απέτυχε.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAndNotify() {
    if (!schoolId || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const ok = await persist(draft);
      if (!ok) return;
      await broadcastsApi.send(schoolId, {
        title: `${current.label} ${year}`,
        body: draft.trim(),
        targetType: 'all',
      });
      setEditing(false);
      setNotice('Αποθηκεύτηκε και στάλθηκε ως ειδοποίηση σε όλους.');
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Η αποστολή της ειδοποίησης απέτυχε.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold tracking-wide text-[#E95926]">Ονειροχώρα</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2422]">Κανονισμοί</h1>
          <p className="mt-1 text-sm text-[#6b625c]">
            Ο κανονισμός λειτουργίας και ο οικονομικός κανονισμός, χωριστά για κάθε σχολικό έτος.
          </p>
        </div>
        <label className="text-sm font-semibold text-[#2c2422]">
          Σχολικό έτος
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 block rounded-xl border border-[#e4d7ea] bg-white px-3 py-2 text-sm font-semibold text-[#642678]"
          >
            {years.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}{item.isCurrent ? ' · τρέχον' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-[#f3e8f7]/70 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => { setTab(item.key); setEditing(false); setNotice(''); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-white text-[#642678] shadow-sm' : 'text-[#6b625c]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#77328d]/10 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-[#2c2422]">{current.label}</h2>
            <p className="text-xs text-gray-500">Σχολικό έτος {year}</p>
          </div>
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
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Ακύρωση</button>
              <button type="button" onClick={save} disabled={saving || sending} className="rounded-lg border border-[#77328D] px-4 py-2 text-sm font-semibold text-[#642678] disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
              <button type="button" onClick={saveAndNotify} disabled={saving || sending || !draft.trim()} className="rounded-lg bg-[#E95926] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {sending ? 'Αποστολή...' : 'Αποστολή σε όλους'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">
            {!savedText && (
              <p className="mb-4 rounded-xl bg-[#fff6f1] px-3 py-2 text-xs text-[#8a5a32]">
                Για το {year} δεν έχει αποθηκευτεί ακόμη κείμενο. Εμφανίζεται ο κανονισμός της Ονειροχώρας ώσπου να τον αποθηκεύσεις.
              </p>
            )}
            {notice && <p className="mb-3 text-sm font-medium text-emerald-700">{notice}</p>}
            <div className="whitespace-pre-wrap text-sm leading-7 text-[#3f3834]">{text}</div>
          </div>
        )}
      </div>
    </div>
  );
}
