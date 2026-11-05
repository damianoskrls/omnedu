'use client';

import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { ExternalLink, FileMinus2, FileText, RefreshCw } from 'lucide-react';
import { PaymentDetailsLink } from '@/components/PaymentDetailsLink';
import { pairFiscalDocuments } from '@/lib/fiscal-document-pairs';

const MONTHS = ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
const MONTHS_GEN = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];

const money = (value: number) => `€${Math.abs(value).toFixed(2)}`;

export type PayMonthTarget = {
  year: number;
  month: number;
  chargeId?: string | null;
  totalDue: number;
  paidAmount: number;
  notes?: string | null;
};

export type FiscalMonthTarget = {
  year: number;
  month: number;
  chargeId?: string | null;
  totalDue: number;
  paidAmount: number;
  description: string;
  lines?: { label: string; amount: number }[];
};

function statusLabel(status: string, totalDue?: number) {
  if (status === 'paid' && Number(totalDue ?? 0) === 0) return { text: 'Καλύπτεται', className: 'bg-emerald-100 text-emerald-800' };
  if (status === 'paid') return { text: 'Εξοφλήθη', className: 'bg-emerald-100 text-emerald-800' };
  if (status === 'partial') return { text: 'Μερική πληρωμή', className: 'bg-sky-100 text-sky-800' };
  if (status === 'upcoming') return { text: 'Δεν έχει ανοίξει', className: 'bg-gray-100 text-gray-500' };
  return { text: 'Αναμονή πληρωμής', className: 'bg-amber-100 text-amber-900' };
}

function monthRemainder(totalDue: number, paidAmount: number) {
  return Math.max(0, Number(totalDue || 0) - Number(paidAmount || 0));
}

/** e.g. ΦΟΙΤΗΣΗ ΝΗΠΙΑΓΩΓΕΙΟ ΟΚΤΩΒΡΙΟΣ */
export function monthFiscalDescription(month: {
  month: number;
  lines?: { label: string; amount: number }[];
}): string {
  const tuition = (month.lines || []).find((l) => Number(l.amount) > 0);
  const base = String(tuition?.label || 'Φοίτηση')
    .replace(/\([^)]*\)/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('el-GR');
  const mon = (MONTHS[month.month] || '').toLocaleUpperCase('el-GR');
  return `${base} ${mon}`.trim();
}

function MonthAmount({
  status,
  totalDue,
  paidAmount,
}: {
  status: string;
  totalDue: number;
  paidAmount: number;
}) {
  const due = Number(totalDue || 0);
  const paid = Number(paidAmount || 0);
  const remain = monthRemainder(due, paid);
  const showRemain = status === 'partial' || status === 'unpaid' || status === 'upcoming' || status === 'overdue';

  if (showRemain && due > 0) {
    return (
      <div className="text-right">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Υπόλοιπο</p>
        <p className={`text-xl font-extrabold tabular-nums leading-tight ${remain > 0.005 ? 'text-red-700' : 'text-gray-900'}`}>
          {money(remain)}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Οφειλή {money(due)} · Πληρώθηκε {money(paid)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-xl font-extrabold tabular-nums leading-tight text-gray-900">{money(due)}</p>
      {paid > 0.005 && due > 0 && (
        <p className="mt-0.5 text-[11px] text-gray-500">Πληρώθηκε {money(paid)}</p>
      )}
    </div>
  );
}

function toPayTarget(month: any): PayMonthTarget {
  return {
    year: Number(month.year),
    month: Number(month.month),
    chargeId: month.chargeId ?? null,
    totalDue: Number(month.totalDue ?? 0),
    paidAmount: Number(month.paidAmount ?? 0),
    notes: month.notes ?? null,
  };
}

function toFiscalTarget(month: any): FiscalMonthTarget {
  return {
    year: Number(month.year),
    month: Number(month.month),
    chargeId: month.chargeId ?? null,
    totalDue: Number(month.totalDue ?? 0),
    paidAmount: Number(month.paidAmount ?? 0),
    description: monthFiscalDescription(month),
    lines: month.lines,
  };
}

function canUndoMonth(month: any) {
  return Boolean(month?.chargeId)
    && Number(month?.paidAmount ?? 0) > 0.005
    && (month.status === 'paid' || month.status === 'partial');
}

function cardBorderClass(status: string, totalDue: number, paidAmount: number) {
  const remain = monthRemainder(totalDue, paidAmount);
  if (status === 'upcoming') return 'border-gray-100 bg-gray-50/60';
  if ((status === 'unpaid' || status === 'overdue' || status === 'partial') && remain > 0.005) {
    return 'border-amber-200/80 bg-white shadow-sm';
  }
  return 'border-gray-200 bg-white shadow-sm';
}

function MonthActionButtons({
  canPay,
  canFiscal,
  canUndo,
  saving,
  onPay,
  onFiscal,
  onUndo,
}: {
  canPay: boolean;
  canFiscal: boolean;
  canUndo: boolean;
  saving: boolean;
  onPay: () => void;
  onFiscal: () => void;
  onUndo: () => void;
}) {
  if (!canPay && !canFiscal && !canUndo) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canUndo && (
        <button
          type="button"
          disabled={saving}
          onClick={onUndo}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
        >
          Αναίρεση
        </button>
      )}
      {canFiscal && (
        <button
          type="button"
          disabled={saving}
          onClick={onFiscal}
          className="rounded-lg border border-[#d9bce6] bg-[#f8f1fb] px-3 py-1.5 text-xs font-semibold text-[#77328D] hover:bg-[#f1e4f7] disabled:opacity-50"
        >
          Παραστατικό
        </button>
      )}
      {canPay && (
        <button
          type="button"
          disabled={saving}
          onClick={onPay}
          className="rounded-lg bg-[#77328D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#652978] disabled:opacity-50"
        >
          Είσπραξη
        </button>
      )}
    </div>
  );
}

function fiscalShortLabel(doc: any) {
  const kind = String(doc.documentKind || '');
  if (kind === 'service_invoice') return 'ΤΙΜ';
  if (kind === 'service_credit_note') return 'ΠΤ';
  if (kind === 'retail_credit_note') return 'ΠΙΣ';
  return 'ΑΠ';
}

function isCreditKind(kind: string) {
  return kind === 'retail_credit_note' || kind === 'service_credit_note';
}

function canIssueCredit(doc: any, all: any[]) {
  if (doc.status !== 'issued') return false;
  if (doc.documentKind !== 'retail_receipt' && doc.documentKind !== 'service_invoice') return false;
  return !all.some(
    (d) =>
      d.relatedDocumentId === doc.id &&
      isCreditKind(String(d.documentKind || '')) &&
      d.status !== 'failed',
  );
}

function MonthFiscalLinks({
  docs,
  onResend,
  resendingId,
  onCredit,
  creditingId,
}: {
  docs: any[];
  onResend?: (id: string) => void | Promise<void>;
  resendingId?: string | null;
  onCredit?: (doc: any) => void | Promise<void>;
  creditingId?: string | null;
}) {
  const pairs = useMemo(() => pairFiscalDocuments(docs), [docs]);
  if (!docs.length) return null;

  function renderDoc(doc: any, opts?: { isCredit?: boolean }) {
    const href = doc.verificationUrl || doc.qrUrl;
    const label = `${fiscalShortLabel(doc)}-${doc.number}`;
    const pending = doc.status === 'pending' || !href;
    const creditRow = Boolean(opts?.isCredit) || isCreditKind(String(doc.documentKind || ''));
    const showCredit = Boolean(onCredit) && canIssueCredit(doc, docs);
    return (
      <div key={doc.id} className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
            creditRow
              ? 'bg-rose-50 text-rose-800 ring-rose-100'
              : 'bg-emerald-50 text-emerald-800 ring-emerald-100'
          }`}
        >
          <FileText className="h-3 w-3" />
          {creditRow ? 'ακυρώνει · ' : ''}
          {label} · €{Number(doc.grossValue).toFixed(2)}
          {pending ? ' · σε εξέλιξη' : ''}
        </span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#77328D] hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Προβολή
          </a>
        )}
        {showCredit && (
          <button
            type="button"
            disabled={creditingId === doc.id}
            onClick={() => void onCredit?.(doc)}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-rose-700 hover:text-rose-900 disabled:opacity-50"
          >
            <FileMinus2 className={`h-3 w-3 ${creditingId === doc.id ? 'animate-pulse' : ''}`} />
            {creditingId === doc.id ? 'Έκδοση…' : 'Πιστωτικό'}
          </button>
        )}
        {onResend && doc.status !== 'failed' && (
          <button
            type="button"
            disabled={resendingId === doc.id}
            onClick={() => void onResend(doc.id)}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${resendingId === doc.id ? 'animate-spin' : ''}`} />
            Επαναποστολή
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pairs.map((pair) => {
        const framed = pair.credits.length > 0;
        return (
          <div
            key={pair.key}
            className={
              framed
                ? 'space-y-1.5 rounded-xl border border-rose-200 bg-rose-50/40 px-2.5 py-2'
                : 'space-y-1.5'
            }
          >
            {framed && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                Παραστατικό + πιστωτικό ακύρωσης
              </p>
            )}
            {renderDoc(pair.primary)}
            {pair.credits.map((credit) => renderDoc(credit, { isCredit: true }))}
          </div>
        );
      })}
    </div>
  );
}

function LineList({ lines }: { lines?: { label: string; amount: number }[] }) {
  if (!lines?.length) {
    return <p className="text-sm text-gray-400">Δεν υπάρχει μηνιαία χρέωση.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/50">
      {lines.map((line) => (
        <li key={line.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="text-gray-700">{line.label}</span>
          <span className={`tabular-nums font-semibold ${line.amount < 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
            {line.amount < 0 ? `−${money(line.amount)}` : money(line.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExtraList({
  extras,
  isAdmin,
  saving,
  onPayExtra,
  onUndoExtra,
}: {
  extras?: any[];
  isAdmin: boolean;
  saving: boolean;
  onPayExtra: (extra: any) => void;
  onUndoExtra?: (extra: any) => void;
}) {
  if (!extras?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700/80">Εκδρομές / επιπλέον</p>
      {extras.map((extra) => {
        const badge = statusLabel(extra.status === 'pending_payment' ? 'unpaid' : extra.status, Number(extra.amount));
        const canUndo = isAdmin && Boolean(onUndoExtra) && (extra.status === 'paid' || extra.status === 'partial');
        const showDetails = extra.status === 'paid' || extra.status === 'partial';
        return (
          <div
            key={extra.id}
            className="rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {extra.kind === 'event' ? `Εκδρομή · ${extra.title}` : extra.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-gray-900">{money(Number(extra.amount))}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.text}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showDetails && (
                  <PaymentDetailsLink
                    notes={extra.notes}
                    paidAt={extra.paidAt}
                    totalDue={Number(extra.amount)}
                    paidAmount={Number(extra.paidAmount ?? (extra.status === 'paid' ? extra.amount : 0))}
                  />
                )}
                {isAdmin && extra.status !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => onPayExtra(extra)}
                    disabled={saving}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Είσπραξη
                  </button>
                )}
                {canUndo && (
                  <button
                    type="button"
                    onClick={() => onUndoExtra?.(extra)}
                    disabled={saving}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-white/80 hover:text-red-600 disabled:opacity-50"
                  >
                    Αναίρεση
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthCard({
  month,
  eyebrow,
  accent,
  isAdmin,
  saving,
  fiscalDocs,
  showDetails,
  detailsProps,
  canPay,
  canFiscal,
  canUndo,
  onPay,
  onFiscal,
  onUndo,
  onPayExtra,
  onUndoExtra,
  onResendFiscal,
  resendingFiscalId,
  onCreditFiscal,
  creditingFiscalId,
}: {
  month: any;
  eyebrow?: string;
  accent?: boolean;
  isAdmin: boolean;
  saving: boolean;
  fiscalDocs: any[];
  showDetails: boolean;
  detailsProps?: ComponentProps<typeof PaymentDetailsLink>;
  canPay: boolean;
  canFiscal: boolean;
  canUndo: boolean;
  onPay: () => void;
  onFiscal: () => void;
  onUndo: () => void;
  onPayExtra: (extra: any) => void;
  onUndoExtra?: (extra: any) => void;
  onResendFiscal?: (id: string) => void | Promise<void>;
  resendingFiscalId?: string | null;
  onCreditFiscal?: (doc: any) => void | Promise<void>;
  creditingFiscalId?: string | null;
}) {
  const badge = statusLabel(month.status, Number(month.totalDue));
  const quiet = month.status === 'upcoming';
  const hasFooter = showDetails || canPay || canFiscal || canUndo || fiscalDocs.length > 0;
  const border = accent
    ? 'border-[#e6d0ee] bg-white shadow-sm ring-1 ring-[#f3e8f8]'
    : cardBorderClass(month.status, Number(month.totalDue), Number(month.paidAmount ?? 0));

  return (
    <article className={`overflow-hidden rounded-2xl border ${border} ${quiet ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#77328D]">{eyebrow}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 sm:text-lg">
              {MONTHS[month.month]} {month.year}
            </h3>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
              {badge.text}
            </span>
          </div>
        </div>
        <MonthAmount
          status={month.status}
          totalDue={Number(month.totalDue)}
          paidAmount={Number(month.paidAmount ?? 0)}
        />
      </div>

      <div className="px-4 pb-3 sm:px-5">
        <LineList lines={month.lines} />
        <ExtraList
          extras={month.extras}
          isAdmin={isAdmin}
          saving={saving}
          onPayExtra={onPayExtra}
          onUndoExtra={onUndoExtra}
        />
      </div>

      {hasFooter && (
        <div className="space-y-2.5 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
          {(showDetails || canPay || canFiscal || canUndo) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-h-[28px]">
                {showDetails && detailsProps ? <PaymentDetailsLink {...detailsProps} /> : <span />}
              </div>
              <MonthActionButtons
                canPay={canPay}
                canFiscal={canFiscal}
                canUndo={canUndo}
                saving={saving}
                onPay={onPay}
                onFiscal={onFiscal}
                onUndo={onUndo}
              />
            </div>
          )}
          <MonthFiscalLinks
            docs={fiscalDocs}
            onResend={isAdmin ? onResendFiscal : undefined}
            resendingId={resendingFiscalId}
            onCredit={isAdmin ? onCreditFiscal : undefined}
            creditingId={creditingFiscalId}
          />
        </div>
      )}
    </article>
  );
}

export function StudentStatement({
  statement,
  isAdmin,
  saving,
  onPayMonth,
  onUndoMonth,
  onPayExtra,
  onUndoExtra,
  receipts = [],
  fiscalDocuments = [],
  onUploadReceipt,
  onDownloadReceipt,
  onDeleteReceipt,
  onRequestSystemReceipt,
  onIssueFiscalMonth,
  onResendFiscal,
  resendingFiscalId,
  onCreditFiscal,
  creditingFiscalId,
}: {
  statement: any;
  isAdmin: boolean;
  saving: boolean;
  onPayMonth: (target: PayMonthTarget) => void;
  onUndoMonth: (chargeId: string) => void;
  onPayExtra: (extra: any) => void;
  onUndoExtra?: (extra: any) => void;
  receipts?: any[];
  fiscalDocuments?: any[];
  onUploadReceipt?: (file: File, month: number, year: number, title: string) => Promise<void>;
  onDownloadReceipt?: (docId: string) => void;
  onDeleteReceipt?: (docId: string) => Promise<void>;
  onRequestSystemReceipt?: (month: number, year: number, notes?: string | null) => Promise<void>;
  onIssueFiscalMonth?: (target: FiscalMonthTarget) => void;
  onResendFiscal?: (id: string) => void | Promise<void>;
  resendingFiscalId?: string | null;
  onCreditFiscal?: (doc: any) => void | Promise<void>;
  creditingFiscalId?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingUpload, setPendingUpload] = useState<{ month: number; year: number } | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  function monthKey(month: number, year: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function receiptFor(month: number, year: number) {
    const key = monthKey(month, year);
    const ranked = receipts
      .filter((r) => (r.category === 'receipt' || !r.category) && Boolean(String(r.fileUrl || '').trim()))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const tagged = ranked.find((r) => r.academicYear === key);
    if (tagged) return tagged;
    return ranked.find((r) => {
      if (r.academicYear) return false;
      const when = new Date(r.uploadedAt);
      if (Number.isNaN(when.getTime())) return false;
      return when.getFullYear() === year && when.getMonth() + 1 === month;
    });
  }

  function fiscalsForCharge(chargeId?: string | null) {
    if (!chargeId) return [];
    const all = (fiscalDocuments || []).filter((d) => d.status !== 'failed');
    const direct = all.filter((d) => d.monthlyChargeId === chargeId);
    const ids = new Set(direct.map((d) => d.id));
    // Pull in related πιστωτικά even if monthlyChargeId was missing on older rows.
    const relatedCredits = all.filter(
      (d) =>
        isCreditKind(String(d.documentKind || '')) &&
        d.relatedDocumentId &&
        ids.has(d.relatedDocumentId) &&
        !ids.has(d.id),
    );
    return [...direct, ...relatedCredits];
  }

  function triggerUpload(month: number, year: number) {
    setPendingUpload({ month, year });
    fileRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingUpload || !onUploadReceipt) return;
    const { month, year } = pendingUpload;
    const key = monthKey(month, year);
    const title = `Απόδειξη ${MONTHS_GEN[month]} ${year}`;
    setUploadingKey(key);
    try {
      await onUploadReceipt(file, month, year, title);
    } finally {
      setUploadingKey(null);
      setPendingUpload(null);
    }
  }

  const current = statement.current;
  const owed = Number(statement.pendingNow ?? 0);
  void onDeleteReceipt;
  void uploadingKey;

  function monthDetailsProps(month: any) {
    return {
      notes: month.notes,
      paidAt: month.paidAt,
      totalDue: Number(month.totalDue),
      paidAmount: Number(month.paidAmount ?? 0),
      receipt: receiptFor(month.month, month.year),
      onDownloadReceipt,
      onUploadReceipt: isAdmin ? () => triggerUpload(month.month, month.year) : undefined,
      onRequestSystemReceipt:
        isAdmin && onRequestSystemReceipt
          ? () => onRequestSystemReceipt(month.month, month.year, month.notes)
          : undefined,
    };
  }

  function showMonthDetails(month: any) {
    return (
      (month.status === 'paid' || month.status === 'partial' || Number(month.paidAmount ?? 0) > 0.005)
      && Number(month.totalDue) > 0
    );
  }

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />
      <div className={`rounded-2xl px-5 py-4 text-white ${owed > 0 ? 'bg-[#77328D]' : 'bg-emerald-600'}`}>
        <p className="text-sm text-white/80">Σύνολο που εκκρεμεί τώρα</p>
        <p className="text-3xl font-extrabold tracking-tight">{owed > 0 ? money(owed) : 'Τίποτα'}</p>
        <p className="mt-1 text-xs text-white/75">Υπόλοιπα ανοιχτών μηνών, γραφική ύλη και εκδρομές που δεν έχουν εξοφληθεί.</p>
      </div>

      {current && (
        <MonthCard
          month={current}
          eyebrow="Τρέχων μήνας"
          accent
          isAdmin={isAdmin}
          saving={saving}
          fiscalDocs={fiscalsForCharge(current.chargeId)}
          showDetails={showMonthDetails(current)}
          detailsProps={monthDetailsProps(current)}
          canPay={isAdmin && current.status !== 'paid'}
          canFiscal={isAdmin && Boolean(onIssueFiscalMonth)}
          canUndo={isAdmin && canUndoMonth(current)}
          onPay={() => onPayMonth(toPayTarget(current))}
          onFiscal={() => onIssueFiscalMonth?.(toFiscalTarget(current))}
          onUndo={() => onUndoMonth(current.chargeId)}
          onPayExtra={onPayExtra}
          onUndoExtra={onUndoExtra}
          onResendFiscal={onResendFiscal}
          resendingFiscalId={resendingFiscalId}
          onCreditFiscal={onCreditFiscal}
          creditingFiscalId={creditingFiscalId}
        />
      )}

      {statement.stationery && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Έναρξη χρονιάς</p>
            <h3 className="font-bold text-gray-900">{statement.stationery.description}</h3>
            <p className="text-xs text-gray-500">Μία φορά για τη σχολική χρονιά {statement.schoolYear}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold tabular-nums">{money(Number(statement.stationery.amount))}</div>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusLabel(statement.stationery.status).className}`}>
              {statement.stationery.status === 'paid' ? 'Πληρώθηκε' : 'Δεν έχει πληρωθεί'}
            </span>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 sm:w-auto sm:border-0 sm:pt-0">
            {(statement.stationery.status === 'paid' || statement.stationery.status === 'partial') && (
              <PaymentDetailsLink
                notes={statement.stationery.notes}
                paidAt={statement.stationery.paidAt}
                totalDue={Number(statement.stationery.amount)}
                paidAmount={Number(statement.stationery.paidAmount ?? 0)}
              />
            )}
            {isAdmin && statement.stationery.status !== 'paid' && (
              <button
                type="button"
                onClick={() => onPayExtra({ id: statement.stationery.id, kind: 'once', amount: statement.stationery.amount })}
                disabled={saving}
                className="rounded-lg bg-[#77328D] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Είσπραξη
              </button>
            )}
            {isAdmin && onUndoExtra && (statement.stationery.status === 'paid' || statement.stationery.status === 'partial') && Number(statement.stationery.paidAmount ?? statement.stationery.amount) > 0 && (
              <button
                type="button"
                onClick={() => onUndoExtra({ id: statement.stationery.id, kind: 'once', amount: statement.stationery.amount, status: statement.stationery.status })}
                disabled={saving}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
                Αναίρεση
              </button>
            )}
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="px-0.5">
          <h3 className="font-semibold text-gray-900">Σχολικό έτος {statement.schoolYear}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Κάθε μήνας δείχνει φοίτηση, σχολικό, δραστηριότητες και voucher όπως ίσχυαν τότε. Μια αλλαγή τιμής ή voucher πιάνει από τον μήνα της και μετά.
          </p>
        </div>
        <div className="space-y-3">
          {(statement.months ?? []).map((month: any) => {
            const canPay = isAdmin && month.status !== 'paid' && Number(month.totalDue) >= 0;
            const canFiscal = isAdmin && Boolean(onIssueFiscalMonth) && month.status !== 'upcoming';
            return (
              <MonthCard
                key={`${month.year}-${month.month}`}
                month={month}
                isAdmin={isAdmin}
                saving={saving}
                fiscalDocs={fiscalsForCharge(month.chargeId)}
                showDetails={showMonthDetails(month)}
                detailsProps={monthDetailsProps(month)}
                canPay={canPay}
                canFiscal={canFiscal}
                canUndo={isAdmin && canUndoMonth(month)}
                onPay={() => onPayMonth(toPayTarget(month))}
                onFiscal={() => onIssueFiscalMonth?.(toFiscalTarget(month))}
                onUndo={() => onUndoMonth(month.chargeId)}
                onPayExtra={onPayExtra}
                onUndoExtra={onUndoExtra}
                onResendFiscal={onResendFiscal}
                resendingFiscalId={resendingFiscalId}
                onCreditFiscal={onCreditFiscal}
                creditingFiscalId={creditingFiscalId}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
