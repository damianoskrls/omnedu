'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { billingApi, broadcastsApi } from '@/lib/api';
import {
  BellRing, ChevronDown, ChevronUp, ExternalLink, Search, Users,
} from 'lucide-react';

const MONTHS_GR = [
  '', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

function fmt(n: number) {
  return `€${n.toFixed(2)}`;
}

type DebtorItem = {
  kind: 'monthly' | 'one_time';
  id: string;
  label: string;
  month?: number;
  year?: number;
  totalDue: number;
  paidAmount: number;
  remaining: number;
  status: string;
};

type Debtor = {
  studentId: string;
  fullName: string;
  classId: string | null;
  className: string;
  levelId: string | null;
  levelName: string;
  totalDue: number;
  paidAmount: number;
  remaining: number;
  items: DebtorItem[];
};

type DebtorsPayload = {
  scope: 'month' | 'all';
  month: number;
  year: number;
  schoolYear: string;
  totalDebtors: number;
  totalRemaining: number;
  totalDue: number;
  totalPaid: number;
  byLevel: { label: string; count: number; remaining: number }[];
  debtors: Debtor[];
};

export function DebtorsPanel({
  schoolId,
  month,
  year,
}: {
  schoolId: string;
  month: number;
  year: number;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [data, setData] = useState<DebtorsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res: any = await billingApi.getDebtors(schoolId, {
        scope,
        month,
        year,
      });
      setData(res);
      setSelected({});
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [schoolId, scope, month, year]);

  useEffect(() => { void load(); }, [load]);

  const levels = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data?.debtors ?? []) {
      if (d.levelId) map.set(d.levelId, d.levelName || 'Βαθμίδα');
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'el'));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.debtors ?? []).filter((d) => {
      if (levelFilter && d.levelId !== levelFilter) return false;
      if (!q) return true;
      return (
        d.fullName.toLowerCase().includes(q) ||
        d.className.toLowerCase().includes(q) ||
        d.levelName.toLowerCase().includes(q)
      );
    });
  }, [data, search, levelFilter]);

  const selectedIds = filtered.filter((d) => selected[d.studentId]).map((d) => d.studentId);
  const allSelected = filtered.length > 0 && filtered.every((d) => selected[d.studentId]);

  async function sendReminder(studentIds: string[], label: string) {
    if (!studentIds.length) return;
    const key = studentIds.length === 1 ? studentIds[0] : 'bulk';
    setSending(key);
    try {
      const scopeLabel =
        scope === 'month'
          ? `${MONTHS_GR[month]} ${year}`
          : `σχολικό έτος ${data?.schoolYear ?? ''}`;
      await broadcastsApi.send(schoolId, {
        title: `Υπενθύμιση πληρωμής — ${scopeLabel}`,
        body: `Υπάρχει εκκρεμής οφειλή για ${scopeLabel}. Παρακαλούμε ενημερώστε τη γραμματεία ή εξοφλήστε μέσω της εφαρμογής.`,
        targetType: 'student',
        targetStudentId: studentIds.length === 1 ? studentIds[0] : undefined,
        targetStudentIds: studentIds.length > 1 ? studentIds : undefined,
        channels: ['push'],
        appScreen: 'payments',
      });
      window.alert(studentIds.length === 1
        ? `Στάλθηκε υπενθύμιση σε ${label}.`
        : `Στάλθηκαν υπενθυμίσεις σε ${studentIds.length} οικογένειες.`);
    } catch (err: any) {
      window.alert(err?.response?.data?.message || err?.message || 'Αποτυχία αποστολής');
    } finally {
      setSending(null);
    }
  }

  const maxLevel = Math.max(1, ...(data?.byLevel ?? []).map((r) => r.remaining));

  return (
    <div className="space-y-4">
      {/* Scope + KPIs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              Εκκρεμότητες
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Ποιοι χρωστάνε και τι — με μαζική ή ατομική υπενθύμιση.
            </p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              type="button"
              onClick={() => setScope('month')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                scope === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              Τρέχων μήνας
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                scope === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              Όλο το έτος
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="text-xs text-amber-600 mb-1 font-medium">Οφειλέτες</div>
            <div className="text-2xl font-bold text-amber-800">{data?.totalDebtors ?? '—'}</div>
            <div className="text-xs text-amber-500 mt-0.5">
              {scope === 'month' ? `${MONTHS_GR[month]} ${year}` : data?.schoolYear ?? '…'}
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <div className="text-xs text-red-600 mb-1 font-medium">Σύνολο οφειλών</div>
            <div className="text-2xl font-bold text-red-700">
              {data ? fmt(data.totalRemaining) : '—'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium">Χρεώσεις</div>
            <div className="text-2xl font-bold text-gray-800">
              {data ? fmt(data.totalDue) : '—'}
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <div className="text-xs text-green-600 mb-1 font-medium">Πληρωμένο (μέρος)</div>
            <div className="text-2xl font-bold text-green-700">
              {data ? fmt(data.totalPaid) : '—'}
            </div>
          </div>
        </div>

        {/* Level breakdown chart */}
        {(data?.byLevel?.length ?? 0) > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Οφειλές ανά βαθμίδα</div>
            <div className="space-y-2">
              {data!.byLevel.map((row) => (
                <div key={row.label} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate text-gray-600 shrink-0">{row.label}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${(row.remaining / maxLevel) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-semibold text-gray-800 shrink-0">{fmt(row.remaining)}</span>
                  <span className="w-10 text-right text-xs text-gray-400 shrink-0">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters + bulk */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Αναζήτηση μαθητή, τάξης…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
        >
          <option value="">Όλες οι βαθμίδες</option>
          {levels.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedIds.length || sending === 'bulk'}
          onClick={() => void sendReminder(selectedIds, '')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <BellRing className="h-4 w-4" />
          {sending === 'bulk'
            ? 'Αποστολή…'
            : selectedIds.length
              ? `Υπενθύμιση (${selectedIds.length})`
              : 'Υπενθύμιση επιλεγμένων'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Φόρτωση…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Κανένας οφειλέτης</p>
          <p className="text-sm mt-1">
            {scope === 'month'
              ? `Όλοι έχουν εξοφλήσει για ${MONTHS_GR[month]} ${year}.`
              : 'Δεν υπάρχουν ανοιχτές οφειλές στο σχολικό έτος.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 text-xs text-gray-500">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  const next: Record<string, boolean> = { ...selected };
                  for (const d of filtered) next[d.studentId] = e.target.checked;
                  setSelected(next);
                }}
                className="rounded border-gray-300"
              />
              Επιλογή όλων ({filtered.length})
            </label>
          </div>
          <div className="divide-y divide-gray-50">
            {filtered.map((d) => {
              const open = expanded[d.studentId];
              return (
                <div key={d.studentId}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!selected[d.studentId]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [d.studentId]: e.target.checked }))}
                      className="rounded border-gray-300 shrink-0"
                    />
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => setExpanded((prev) => ({ ...prev, [d.studentId]: !prev[d.studentId] }))}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{d.fullName}</span>
                        {d.levelName && (
                          <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{d.levelName}</span>
                        )}
                        {d.className && (
                          <span className="text-[11px] bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">{d.className}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {d.items.length} {d.items.length === 1 ? 'οφειλή' : 'οφειλές'}
                        {d.paidAmount > 0 && <> · πληρωμένο {fmt(d.paidAmount)}</>}
                      </div>
                    </button>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-amber-700">{fmt(d.remaining)}</div>
                    </div>
                    <button
                      type="button"
                      title="Ατομική υπενθύμιση"
                      disabled={sending === d.studentId}
                      onClick={() => void sendReminder([d.studentId], d.fullName)}
                      className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 shrink-0"
                    >
                      <BellRing className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/school/students/${d.studentId}`)}
                      className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 shrink-0"
                      title="Προφίλ μαθητή"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [d.studentId]: !prev[d.studentId] }))}
                      className="p-1 text-gray-400 shrink-0"
                    >
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                  {open && (
                    <div className="px-4 pb-3 pl-12 space-y-1.5">
                      {d.items.map((item) => (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-100/80"
                        >
                          <div>
                            <span className="font-medium text-gray-800">{item.label}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {item.kind === 'monthly' ? 'Μηνιαία' : 'Έκτακτη'}
                              {item.status === 'partial' ? ' · μερική' : ''}
                            </span>
                          </div>
                          <span className="font-semibold text-amber-800">{fmt(item.remaining)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
