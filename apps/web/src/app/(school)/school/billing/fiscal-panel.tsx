'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileText, Search } from 'lucide-react';
import type { FiscalIssuePrefill } from '@/components/FiscalIssueModal';
import { fiscalDocNetGross, pairFiscalDocuments } from '@/lib/fiscal-document-pairs';

const MONTHS_SHORT = ['', 'Ιαν', 'Φεβ', 'Μάρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

function fmt(n: number) {
  return `€${n.toFixed(2)}`;
}

function docMonthKey(doc: any): string {
  const d = doc.issueDate ? new Date(doc.issueDate) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function docMonthLabel(key: string) {
  if (!key) return 'Χωρίς ημερομηνία';
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_SHORT[m] ?? m} ${y}`;
}

function enrollmentMeta(doc: any) {
  const enr = doc.student?.enrollments?.[0];
  return {
    classId: enr?.class?.id ?? '',
    className: enr?.class?.name ?? '',
    levelId: enr?.class?.level?.id ?? '',
    levelName: enr?.class?.level?.name ?? '',
  };
}

function fiscalKindLabel(kind: string) {
  if (kind === 'service_invoice') return 'Τιμολόγιο';
  if (kind === 'retail_credit_note') return 'Πιστωτικό απόδειξης';
  if (kind === 'service_credit_note') return 'Πιστωτικό τιμολογίου';
  if (kind === 'retail_receipt') return 'Απόδειξη';
  return kind;
}

function canIssueCredit(doc: any, all: any[]) {
  if (doc.status !== 'issued') return false;
  if (doc.documentKind !== 'retail_receipt' && doc.documentKind !== 'service_invoice') return false;
  return !all.some(
    (d) =>
      d.relatedDocumentId === doc.id &&
      (d.documentKind === 'retail_credit_note' || d.documentKind === 'service_credit_note') &&
      d.status !== 'failed',
  );
}

export function FiscalPanel({
  schoolId,
  docs,
  loading,
  refreshingId,
  onRefreshDoc,
  onCreditDoc,
  onRefreshList,
  onIssue,
}: {
  schoolId: string;
  docs: any[];
  loading: boolean;
  refreshingId: string | null;
  onRefreshDoc: (id: string) => void;
  onCreditDoc?: (doc: any) => void;
  onRefreshList: () => void;
  onIssue: (prefill?: FiscalIssuePrefill | null) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'retail_receipt' | 'service_invoice' | 'credit'>('all');
  const [monthFilter, setMonthFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'student' | 'month' | 'none'>('student');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'pending' | 'failed'>('all');

  const metaOptions = useMemo(() => {
    const months = new Map<string, string>();
    const levels = new Map<string, string>();
    const classes = new Map<string, string>();
    for (const doc of docs) {
      const mk = docMonthKey(doc);
      if (mk) months.set(mk, docMonthLabel(mk));
      const meta = enrollmentMeta(doc);
      if (meta.levelId) levels.set(meta.levelId, meta.levelName);
      if (meta.classId) classes.set(meta.classId, meta.className);
    }
    return {
      months: Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0])),
      levels: Array.from(levels.entries()).sort((a, b) => a[1].localeCompare(b[1], 'el')),
      classes: Array.from(classes.entries()).sort((a, b) => a[1].localeCompare(b[1], 'el')),
    };
  }, [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((doc) => {
      if (kindFilter === 'credit') {
        if (doc.documentKind !== 'retail_credit_note' && doc.documentKind !== 'service_credit_note') return false;
      } else if (kindFilter !== 'all' && doc.documentKind !== kindFilter) {
        return false;
      }
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
      if (monthFilter && docMonthKey(doc) !== monthFilter) return false;
      const meta = enrollmentMeta(doc);
      if (levelFilter && meta.levelId !== levelFilter) return false;
      if (classFilter && meta.classId !== classFilter) return false;
      if (!q) return true;
      const name = (doc.student?.fullName || doc.cpName || '').toLowerCase();
      const desc = (doc.description || '').toLowerCase();
      const series = `${doc.series}-${doc.number}`.toLowerCase();
      const mark = (doc.mark || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || series.includes(q) || mark.includes(q);
    });
  }, [docs, search, kindFilter, statusFilter, monthFilter, levelFilter, classFilter]);

  const kpis = useMemo(() => {
    let receipts = 0;
    let invoices = 0;
    let receiptSum = 0;
    let invoiceSum = 0;
    let issued = 0;
    let failed = 0;
    let pending = 0;
    let total = 0;
    for (const doc of filtered) {
      const gross = Number(doc.grossValue) || 0;
      const isCredit =
        doc.documentKind === 'retail_credit_note' || doc.documentKind === 'service_credit_note';
      total += isCredit ? -gross : gross;
      if (doc.documentKind === 'service_invoice' || doc.documentKind === 'service_credit_note') {
        invoices += 1;
        invoiceSum += isCredit ? -gross : gross;
      } else {
        receipts += 1;
        receiptSum += isCredit ? -gross : gross;
      }
      if (doc.status === 'issued') issued += 1;
      else if (doc.status === 'failed') failed += 1;
      else pending += 1;
    }
    return { receipts, invoices, receiptSum, invoiceSum, issued, failed, pending, total, count: filtered.length };
  }, [filtered]);

  const byMonthChart = useMemo(() => {
    const map = new Map<string, { key: string; label: string; receipts: number; invoices: number }>();
    for (const doc of filtered) {
      const key = docMonthKey(doc) || 'unknown';
      const cur = map.get(key) ?? { key, label: docMonthLabel(key), receipts: 0, invoices: 0 };
      const gross = Number(doc.grossValue) || 0;
      if (doc.documentKind === 'service_invoice') cur.invoices += gross;
      else cur.receipts += gross;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-8);
  }, [filtered]);

  const groups = useMemo(() => {
    type Group = { key: string; title: string; subtitle?: string; docs: any[]; total: number };
    if (groupBy === 'none') {
      return [{
        key: 'all',
        title: 'Όλα τα παραστατικά',
        docs: filtered,
        pairs: pairFiscalDocuments(filtered),
        total: filtered.reduce((s, d) => s + fiscalDocNetGross(d), 0),
      }] as Group[];
    }
    const map = new Map<string, Group>();
    for (const doc of filtered) {
      let key: string;
      let title: string;
      let subtitle: string | undefined;
      if (groupBy === 'student') {
        key = doc.studentId || `cp-${doc.cpName || doc.id}`;
        title = doc.student?.fullName || doc.cpName || 'Χωρίς μαθητή';
        const meta = enrollmentMeta(doc);
        subtitle = [meta.levelName, meta.className].filter(Boolean).join(' · ') || undefined;
      } else {
        key = docMonthKey(doc) || 'unknown';
        title = docMonthLabel(key);
      }
      const cur = map.get(key) ?? { key, title, subtitle, docs: [], total: 0 };
      cur.docs.push(doc);
      cur.total += fiscalDocNetGross(doc);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, pairs: pairFiscalDocuments(g.docs) }))
      .sort((a, b) => {
        if (groupBy === 'month') return b.key.localeCompare(a.key);
        return a.title.localeCompare(b.title, 'el');
      });
  }, [filtered, groupBy]);

  const maxBar = Math.max(1, ...byMonthChart.map((r) => r.receipts + r.invoices));
  const donutTotal = kpis.receiptSum + kpis.invoiceSum;
  const receiptPct = donutTotal > 0 ? (kpis.receiptSum / donutTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header + issue */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Φορολογικά παραστατικά</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Αναζήτηση, φίλτρα, ομαδοποίηση και σύνολα. Έκδοση μέσω Elorus Fuse.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onIssue(null)}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            <FileText className="h-4 w-4" /> Έκδοση παραστατικού
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Σύνολο</div>
            <div className="text-xl font-bold text-gray-900">{fmt(kpis.total)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{kpis.count} παραστατικά</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3">
            <div className="text-xs text-emerald-600 mb-1">Αποδείξεις</div>
            <div className="text-xl font-bold text-emerald-700">{kpis.receipts}</div>
            <div className="text-xs text-emerald-500 mt-0.5">{fmt(kpis.receiptSum)}</div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3">
            <div className="text-xs text-indigo-600 mb-1">Τιμολόγια</div>
            <div className="text-xl font-bold text-indigo-700">{kpis.invoices}</div>
            <div className="text-xs text-indigo-500 mt-0.5">{fmt(kpis.invoiceSum)}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-xs text-green-600 mb-1">Εκδόθηκαν</div>
            <div className="text-xl font-bold text-green-700">{kpis.issued}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <div className="text-xs text-red-600 mb-1">Αποτυχίες</div>
            <div className="text-xl font-bold text-red-700">{kpis.failed}</div>
            {kpis.pending > 0 && (
              <div className="text-xs text-amber-600 mt-0.5">{kpis.pending} σε εξέλιξη</div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-3">Αποδείξεις vs Τιμολόγια</div>
            {donutTotal <= 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Χωρίς δεδομένα</p>
            ) : (
              <div className="flex items-center gap-5">
                <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label="Κατανομή ποσών παραστατικών">
                  <circle cx="60" cy="60" r="42" fill="none" stroke="#e5e7eb" strokeWidth="16" />
                  <circle
                    cx="60"
                    cy="60"
                    r="42"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="16"
                    strokeDasharray={`${(receiptPct / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                    transform="rotate(-90 60 60)"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="42"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="16"
                    strokeDasharray={`${((100 - receiptPct) / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                    strokeDashoffset={-((receiptPct / 100) * 2 * Math.PI * 42)}
                    transform="rotate(-90 60 60)"
                  />
                  <text x="60" y="58" textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">{kpis.count}</text>
                  <text x="60" y="72" textAnchor="middle" fontSize="8" fill="#6b7280">τεμ.</text>
                </svg>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="flex-1 text-gray-700">Αποδείξεις</span>
                    <span className="font-semibold">{fmt(kpis.receiptSum)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <span className="flex-1 text-gray-700">Τιμολόγια</span>
                    <span className="font-semibold">{fmt(kpis.invoiceSum)}</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-3">Ανά μήνα έκδοσης</div>
            {byMonthChart.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Χωρίς δεδομένα</p>
            ) : (
              <div className="flex h-32 items-end gap-2" role="img" aria-label="Παραστατικά ανά μήνα">
                {byMonthChart.map((row) => (
                  <div key={row.key} className="flex h-full min-w-0 flex-1 flex-col items-center">
                    <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                      <div
                        className="w-2/5 rounded-t bg-emerald-400"
                        style={{ height: `${(row.receipts / maxBar) * 100}%`, minHeight: row.receipts ? 3 : 0 }}
                        title={`Αποδείξεις ${fmt(row.receipts)}`}
                      />
                      <div
                        className="w-2/5 rounded-t bg-indigo-500"
                        style={{ height: `${(row.invoices / maxBar) * 100}%`, minHeight: row.invoices ? 3 : 0 }}
                        title={`Τιμολόγια ${fmt(row.invoices)}`}
                      />
                    </div>
                    <span className="mt-1 text-[10px] text-gray-500 truncate w-full text-center">{row.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση μαθητή, περιγραφής, σειράς, MARK…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="all">Όλοι οι τύποι</option>
            <option value="retail_receipt">Μόνο αποδείξεις</option>
            <option value="service_invoice">Μόνο τιμολόγια</option>
            <option value="credit">Μόνο πιστωτικά</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="all">Όλες οι καταστάσεις</option>
            <option value="issued">Εκδόθηκε</option>
            <option value="pending">Σε εξέλιξη</option>
            <option value="failed">Αποτυχία</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="">Όλοι οι μήνες</option>
            {metaOptions.months.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="">Όλες οι βαθμίδες</option>
            {metaOptions.levels.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="">Όλες οι τάξεις</option>
            {metaOptions.classes.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="student">Ομαδοποίηση: μαθητής</option>
            <option value="month">Ομαδοποίηση: μήνας</option>
            <option value="none">Χωρίς ομαδοποίηση</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Φόρτωση…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center text-gray-400">
          <p className="text-sm">Δεν βρέθηκαν παραστατικά με αυτά τα φίλτρα.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {groupBy !== 'none' && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/70">
                  <div>
                    <span className="font-semibold text-gray-900">{group.title}</span>
                    {group.subtitle && (
                      <span className="text-xs text-gray-400 ml-2">{group.subtitle}</span>
                    )}
                    <span className="text-xs text-gray-400 ml-2">{group.docs.length} τεμ.</span>
                  </div>
                  <span className="font-bold text-gray-800">{fmt(group.total)}</span>
                </div>
              )}
              <div className="p-2 space-y-2">
                {(group.pairs || pairFiscalDocuments(group.docs)).map((pair: any) => {
                  const framed = pair.credits.length > 0;
                  const rows = [pair.primary, ...pair.credits];
                  return (
                    <div
                      key={pair.key}
                      className={
                        framed
                          ? 'rounded-xl border-2 border-rose-200 bg-rose-50/40 overflow-hidden'
                          : 'rounded-xl border border-gray-100 overflow-hidden'
                      }
                    >
                      {framed && (
                        <div className="px-3 py-1 bg-rose-100/80 border-b border-rose-200 text-[11px] font-medium text-rose-800">
                          Παραστατικό + πιστωτικό ακύρωσης
                        </div>
                      )}
                      <div className="divide-y divide-gray-100">
                        {rows.map((doc: any, idx: number) => {
                          const href = doc.verificationUrl || doc.qrUrl;
                          const kind = fiscalKindLabel(doc.documentKind);
                          const showCredit = Boolean(onCreditDoc) && canIssueCredit(doc, docs);
                          const isCredit = idx > 0 || doc.documentKind === 'retail_credit_note' || doc.documentKind === 'service_credit_note';
                          return (
                            <div
                              key={doc.id}
                              className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 ${
                                isCredit ? 'bg-rose-50/70' : 'bg-white'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isCredit && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                                      ακυρώνει
                                    </span>
                                  )}
                                  <span className="text-sm font-semibold text-gray-900">{kind} {doc.series}-{doc.number}</span>
                                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                    doc.status === 'failed' ? 'bg-red-100 text-red-700'
                                      : doc.status === 'issued' ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {doc.status === 'failed' ? 'Αποτυχία' : doc.status === 'issued' ? 'Εκδόθηκε' : 'Σε εξέλιξη'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                  {groupBy !== 'student' && (doc.student?.fullName || doc.cpName || '—') + ' · '}
                                  {doc.description} · {fmt(Number(doc.grossValue))}
                                  {doc.issueDate && ` · ${new Date(doc.issueDate).toLocaleDateString('el-GR')}`}
                                  {doc.mark ? ` · MARK ${doc.mark}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                {doc.studentId && (
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/school/students/${doc.studentId}`)}
                                    className="text-xs font-medium text-gray-600 hover:text-gray-900"
                                  >
                                    Μαθητής
                                  </button>
                                )}
                                {href && (
                                  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                                    <ExternalLink className="h-3.5 w-3.5" /> Επαλήθευση
                                  </a>
                                )}
                                {showCredit && (
                                  <button
                                    type="button"
                                    onClick={() => onCreditDoc?.(doc)}
                                    disabled={refreshingId === doc.id}
                                    className="text-xs font-medium text-rose-700 hover:text-rose-900 disabled:opacity-50"
                                  >
                                    Πιστωτικό
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onRefreshDoc(doc.id)}
                                  disabled={refreshingId === doc.id}
                                  className="text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                                >
                                  {refreshingId === doc.id ? '…' : 'Ανανέωση'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onRefreshList}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
      >
        Ανανέωση λίστας
      </button>
      {/* schoolId kept for API parity / future issue flows */}
      <span className="sr-only">{schoolId}</span>
    </div>
  );
}
