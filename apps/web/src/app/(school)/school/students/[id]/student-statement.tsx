'use client';

import { useRef, useState } from 'react';
import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { PaymentDetailsLink } from '@/components/PaymentDetailsLink';

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
  if (status === 'paid' && Number(totalDue ?? 0) === 0) return { text: 'Καλύπτεται', className: 'bg-emerald-100 text-emerald-700' };
  if (status === 'paid') return { text: 'Εξοφλήθη', className: 'bg-green-100 text-green-700' };
  if (status === 'partial') return { text: 'Μερική πληρωμή', className: 'bg-blue-100 text-blue-700' };
  if (status === 'upcoming') return { text: 'Δεν έχει ανοίξει', className: 'bg-gray-100 text-gray-500' };
  return { text: 'Αναμονή πληρωμής', className: 'bg-amber-100 text-amber-800' };
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
        <p className={`text-lg font-extrabold ${remain > 0.005 ? 'text-red-700' : 'text-gray-900'}`}>{money(remain)}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Οφειλή {money(due)} · Πληρώθηκε {money(paid)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-lg font-extrabold text-gray-900">{money(due)}</p>
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

function MonthActionButtons({
  canPay,
  canFiscal,
  canUndo,
  saving,
  onPay,
  onFiscal,
  onUndo,
  fullWidthPay,
}: {
  canPay: boolean;
  canFiscal: boolean;
  canUndo: boolean;
  saving: boolean;
  onPay: () => void;
  onFiscal: () => void;
  onUndo: () => void;
  fullWidthPay?: boolean;
}) {
  if (!canPay && !canFiscal && !canUndo) return null;
  return (
    <div className={`mt-2 flex flex-wrap gap-1.5 ${fullWidthPay ? '' : 'justify-end'}`}>
      {canPay && (
        <button
          type="button"
          disabled={saving}
          onClick={onPay}
          className={
            fullWidthPay
              ? 'flex-1 rounded-xl bg-[#77328D] py-2.5 text-sm font-semibold text-white disabled:opacity-50'
              : 'rounded-lg bg-[#77328D] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50'
          }
        >
          Είσπραξη
        </button>
      )}
      {canFiscal && (
        <button
          type="button"
          disabled={saving}
          onClick={onFiscal}
          className={
            fullWidthPay
              ? 'flex-1 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-700 disabled:opacity-50'
              : 'rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50'
          }
        >
          Παραστατικό
        </button>
      )}
      {canUndo && (
        <button
          type="button"
          disabled={saving}
          onClick={onUndo}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          Αναίρεση
        </button>
      )}
    </div>
  );
}

function MonthFiscalLinks({
  docs,
  onResend,
  resendingId,
}: {
  docs: any[];
  onResend?: (id: string) => void | Promise<void>;
  resendingId?: string | null;
}) {
  if (!docs.length) return null;
  return (
    <div className="mt-2 space-y-1.5 text-right">
      {docs.map((doc) => {
        const href = doc.verificationUrl || doc.qrUrl;
        const label = `${doc.documentKind === 'service_invoice' ? 'ΤΙΜ' : 'ΑΠ'}-${doc.number}`;
        const pending = doc.status === 'pending' || !href;
        return (
          <div key={doc.id} className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              <FileText className="h-3 w-3" />
              {label} · €{Number(doc.grossValue).toFixed(2)}
              {pending ? ' · σε εξέλιξη' : ''}
            </span>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
              >
                <ExternalLink className="h-3 w-3" /> Προβολή
              </a>
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
      })}
    </div>
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
    return (fiscalDocuments || []).filter(
      (d) => d.monthlyChargeId === chargeId && d.status !== 'failed',
    );
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
  void uploadingKey;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />
      <div className={`rounded-2xl px-5 py-4 text-white ${owed > 0 ? 'bg-[#77328D]' : 'bg-emerald-600'}`}>
        <p className="text-sm text-white/80">Σύνολο που εκκρεμεί τώρα</p>
        <p className="text-3xl font-extrabold tracking-tight">{owed > 0 ? money(owed) : 'Τίποτα'}</p>
        <p className="text-xs text-white/75 mt-1">Υπόλοιπα ανοιχτών μηνών, γραφική ύλη και εκδρομές που δεν έχουν εξοφληθεί.</p>
      </div>

      {current && (
        <div className="bg-white rounded-2xl border border-[#e6d0ee] shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#77328D]">Τρέχων μήνας</p>
              <h3 className="text-xl font-bold text-gray-900">{MONTHS[current.month]} {current.year}</h3>
            </div>
            <div className="text-right">
              <MonthAmount
                status={current.status}
                totalDue={Number(current.totalDue)}
                paidAmount={Number(current.paidAmount ?? 0)}
              />
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusLabel(current.status, Number(current.totalDue)).className}`}>
                {statusLabel(current.status, Number(current.totalDue)).text}
              </span>
              {(current.status === 'paid' || current.status === 'partial') && Number(current.totalDue) > 0 && (
                <div className="mt-1 flex justify-end">
                  <PaymentDetailsLink
                    notes={current.notes}
                    paidAt={current.paidAt}
                    totalDue={Number(current.totalDue)}
                    paidAmount={Number(current.paidAmount ?? 0)}
                    receipt={receiptFor(current.month, current.year)}
                    onDownloadReceipt={onDownloadReceipt}
                    onUploadReceipt={isAdmin ? () => triggerUpload(current.month, current.year) : undefined}
                    onRequestSystemReceipt={isAdmin && onRequestSystemReceipt ? () => onRequestSystemReceipt(current.month, current.year, current.notes) : undefined}
                  />
                </div>
              )}
              <MonthFiscalLinks
                docs={fiscalsForCharge(current.chargeId)}
                onResend={isAdmin ? onResendFiscal : undefined}
                resendingId={resendingFiscalId}
              />
            </div>
          </div>
          <LineList lines={current.lines} />
          <ExtraList extras={current.extras} isAdmin={isAdmin} saving={saving} onPayExtra={onPayExtra} onUndoExtra={onUndoExtra} />
          {isAdmin && (
            <MonthActionButtons
              canPay={current.status !== 'paid'}
              canFiscal={Boolean(onIssueFiscalMonth)}
              canUndo={canUndoMonth(current)}
              saving={saving}
              fullWidthPay
              onPay={() => onPayMonth(toPayTarget(current))}
              onFiscal={() => onIssueFiscalMonth?.(toFiscalTarget(current))}
              onUndo={() => onUndoMonth(current.chargeId)}
            />
          )}
        </div>
      )}

      {statement.stationery && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Έναρξη χρονιάς</p>
            <h3 className="font-bold text-gray-900">{statement.stationery.description}</h3>
            <p className="text-xs text-gray-500">Μία φορά για τη σχολική χρονιά {statement.schoolYear}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold">{money(Number(statement.stationery.amount))}</div>
            <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusLabel(statement.stationery.status).className}`}>
              {statement.stationery.status === 'paid' ? 'Πληρώθηκε' : 'Δεν έχει πληρωθεί'}
            </span>
            {(statement.stationery.status === 'paid' || statement.stationery.status === 'partial') && (
              <div className="mt-1 flex justify-end">
                <PaymentDetailsLink
                  notes={statement.stationery.notes}
                  paidAt={statement.stationery.paidAt}
                  totalDue={Number(statement.stationery.amount)}
                  paidAmount={Number(statement.stationery.paidAmount ?? 0)}
                />
              </div>
            )}
          </div>
          {isAdmin && statement.stationery.status !== 'paid' && (
            <button
              onClick={() => onPayExtra({ id: statement.stationery.id, kind: 'once', amount: statement.stationery.amount })}
              disabled={saving}
              className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
            >
              Είσπραξη
            </button>
          )}
          {isAdmin && onUndoExtra && (statement.stationery.status === 'paid' || statement.stationery.status === 'partial') && Number(statement.stationery.paidAmount ?? statement.stationery.amount) > 0 && (
            <button
              type="button"
              onClick={() => onUndoExtra({ id: statement.stationery.id, kind: 'once', amount: statement.stationery.amount, status: statement.stationery.status })}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-xs font-medium text-gray-400 hover:text-red-500 disabled:opacity-50"
            >
              Αναίρεση
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Σχολικό έτος {statement.schoolYear}</h3>
          <p className="text-xs text-gray-500">Κάθε μήνας δείχνει φοίτηση, σχολικό, δραστηριότητες και voucher όπως ίσχυαν τότε. Μια αλλαγή τιμής ή voucher πιάνει από τον μήνα της και μετά.</p>
        </div>
        <div className="divide-y divide-gray-50">
          {(statement.months ?? []).map((month: any) => {
            const badge = statusLabel(month.status, Number(month.totalDue));
            const quiet = month.status === 'upcoming';
            const canPay = isAdmin && month.status !== 'paid' && Number(month.totalDue) >= 0;
            const canFiscal = isAdmin && Boolean(onIssueFiscalMonth) && month.status !== 'upcoming';
            return (
              <div key={`${month.year}-${month.month}`} className={`px-5 py-4 ${quiet ? 'opacity-80' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-36 shrink-0">
                    <p className="font-semibold text-gray-900">{MONTHS[month.month]}</p>
                    <p className="text-xs text-gray-400">{month.year}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <LineList lines={month.lines} compact />
                    <ExtraList extras={month.extras} isAdmin={isAdmin} saving={saving} onPayExtra={onPayExtra} onUndoExtra={onUndoExtra} />
                  </div>
                  <div className="text-right shrink-0 min-w-[9.5rem]">
                    <MonthAmount
                      status={month.status}
                      totalDue={Number(month.totalDue)}
                      paidAmount={Number(month.paidAmount ?? 0)}
                    />
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>
                    {(month.status === 'paid' || month.status === 'partial' || Number(month.paidAmount ?? 0) > 0.005) && Number(month.totalDue) > 0 && (
                      <div className="mt-1 flex justify-end">
                        <PaymentDetailsLink
                          notes={month.notes}
                          paidAt={month.paidAt}
                          totalDue={Number(month.totalDue)}
                          paidAmount={Number(month.paidAmount ?? 0)}
                          receipt={receiptFor(month.month, month.year)}
                          onDownloadReceipt={onDownloadReceipt}
                          onUploadReceipt={isAdmin ? () => triggerUpload(month.month, month.year) : undefined}
                          onRequestSystemReceipt={isAdmin && onRequestSystemReceipt ? () => onRequestSystemReceipt(month.month, month.year, month.notes) : undefined}
                        />
                      </div>
                    )}
                    <MonthActionButtons
                      canPay={canPay}
                      canFiscal={canFiscal}
                      canUndo={isAdmin && canUndoMonth(month)}
                      saving={saving}
                      onPay={() => onPayMonth(toPayTarget(month))}
                      onFiscal={() => onIssueFiscalMonth?.(toFiscalTarget(month))}
                      onUndo={() => onUndoMonth(month.chargeId)}
                    />
                    <MonthFiscalLinks
                      docs={fiscalsForCharge(month.chargeId)}
                      onResend={isAdmin ? onResendFiscal : undefined}
                      resendingId={resendingFiscalId}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LineList({ lines, compact }: { lines?: { label: string; amount: number }[]; compact?: boolean }) {
  if (!lines?.length) return <p className="text-sm text-gray-400">Δεν υπάρχει μηνιαία χρέωση.</p>;
  return (
    <ul className={compact ? 'space-y-0.5' : 'mt-4 divide-y divide-gray-50 rounded-xl border border-gray-100'}>
      {lines.map((line) => (
        <li key={line.label} className={`flex justify-between gap-3 text-sm ${compact ? 'py-0.5' : 'px-3 py-2'}`}>
          <span className="text-gray-700">{line.label}</span>
          <span className={line.amount < 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-gray-900'}>
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
    <div className="mt-2 space-y-1">
      {extras.map((extra) => {
        const badge = statusLabel(extra.status === 'pending_payment' ? 'unpaid' : extra.status, Number(extra.amount));
        const canUndo = isAdmin && Boolean(onUndoExtra) && (extra.status === 'paid' || extra.status === 'partial');
        return (
          <div key={extra.id} className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm">
            <span className="flex-1 text-gray-800">{extra.kind === 'event' ? `Εκδρομή · ${extra.title}` : extra.title}</span>
            <span className="font-semibold">{money(Number(extra.amount))}</span>
            <span className="flex flex-col items-end">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>
              {(extra.status === 'paid' || extra.status === 'partial') && (
                <PaymentDetailsLink
                  notes={extra.notes}
                  paidAt={extra.paidAt}
                  totalDue={Number(extra.amount)}
                  paidAmount={Number(extra.paidAmount ?? (extra.status === 'paid' ? extra.amount : 0))}
                />
              )}
            </span>
            {isAdmin && extra.status !== 'paid' && (
              <button onClick={() => onPayExtra(extra)} disabled={saving} className="text-xs font-semibold text-green-700">Είσπραξη</button>
            )}
            {canUndo && (
              <button
                type="button"
                onClick={() => onUndoExtra?.(extra)}
                disabled={saving}
                className="text-xs font-medium text-gray-400 hover:text-red-500 disabled:opacity-50"
              >
                Αναίρεση
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
