'use client';

import { useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { PaymentDetailsLink } from '@/components/PaymentDetailsLink';

const MONTHS = ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
const MONTHS_GEN = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];

const money = (value: number) => `€${Math.abs(value).toFixed(2)}`;

function statusLabel(status: string, totalDue?: number) {
  if (status === 'paid' && Number(totalDue ?? 0) === 0) return { text: 'Καλύπτεται', className: 'bg-emerald-100 text-emerald-700' };
  if (status === 'paid') return { text: 'Εξοφλήθη', className: 'bg-green-100 text-green-700' };
  if (status === 'partial') return { text: 'Μερική πληρωμή', className: 'bg-blue-100 text-blue-700' };
  if (status === 'upcoming') return { text: 'Δεν έχει ανοίξει', className: 'bg-gray-100 text-gray-500' };
  return { text: 'Αναμονή πληρωμής', className: 'bg-amber-100 text-amber-800' };
}

export function StudentStatement({
  statement,
  isAdmin,
  saving,
  onPayMonth,
  onUndoMonth,
  onPayExtra,
  receipts = [],
  onUploadReceipt,
  onDownloadReceipt,
  onDeleteReceipt,
  onRequestSystemReceipt,
}: {
  statement: any;
  isAdmin: boolean;
  saving: boolean;
  onPayMonth: (chargeId: string, amount: number) => void;
  onUndoMonth: (chargeId: string) => void;
  onPayExtra: (extra: any) => void;
  receipts?: any[];
  onUploadReceipt?: (file: File, month: number, year: number, title: string) => Promise<void>;
  onDownloadReceipt?: (docId: string) => void;
  onDeleteReceipt?: (docId: string) => Promise<void>;
  onRequestSystemReceipt?: (month: number, year: number, notes?: string | null) => Promise<void>;
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
    // Older receipts uploaded before academicYear tagging: match by upload month/year.
    return ranked.find((r) => {
      if (r.academicYear) return false;
      const when = new Date(r.uploadedAt);
      if (Number.isNaN(when.getTime())) return false;
      return when.getFullYear() === year && when.getMonth() + 1 === month;
    });
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

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />
      <div className={`rounded-2xl px-5 py-4 text-white ${owed > 0 ? 'bg-[#77328D]' : 'bg-emerald-600'}`}>
        <p className="text-sm text-white/80">Σύνολο που εκκρεμεί τώρα</p>
        <p className="text-3xl font-extrabold tracking-tight">{owed > 0 ? money(owed) : 'Τίποτα'}</p>
        <p className="text-xs text-white/75 mt-1">Ανοιχτοί μήνες, γραφική ύλη και εκδρομές που δεν έχουν εξοφληθεί.</p>
      </div>

      {current && (
        <div className="bg-white rounded-2xl border border-[#e6d0ee] shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#77328D]">Τρέχων μήνας</p>
              <h3 className="text-xl font-bold text-gray-900">{MONTHS[current.month]} {current.year}</h3>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-gray-900">{money(Number(current.totalDue))}</div>
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusLabel(current.status, Number(current.totalDue)).className}`}>
                {statusLabel(current.status, Number(current.totalDue)).text}
              </span>
              {(current.status === 'paid' || current.status === 'partial') && Number(current.totalDue) > 0 && (
                <div className="mt-1 flex justify-end">
                  <PaymentDetailsLink
                    notes={current.notes}
                    paidAt={current.paidAt}
                    receipt={receiptFor(current.month, current.year)}
                    onDownloadReceipt={onDownloadReceipt}
                    onUploadReceipt={isAdmin ? () => triggerUpload(current.month, current.year) : undefined}
                    onRequestSystemReceipt={isAdmin && onRequestSystemReceipt ? () => onRequestSystemReceipt(current.month, current.year, current.notes) : undefined}
                  />
                </div>
              )}
              <ReceiptBadge
                receipt={receiptFor(current.month, current.year)}
                uploading={uploadingKey === monthKey(current.month, current.year)}
                showUpload={isAdmin && (current.status === 'paid' || current.status === 'partial')}
                onUpload={() => triggerUpload(current.month, current.year)}
                onDownload={onDownloadReceipt}
                onDelete={onDeleteReceipt}
              />
            </div>
          </div>
          <LineList lines={current.lines} />
          <ExtraList extras={current.extras} isAdmin={isAdmin} saving={saving} onPayExtra={onPayExtra} />
          {isAdmin && current.chargeId && current.status !== 'paid' && current.status !== 'upcoming' && (
            <button
              onClick={() => onPayMonth(current.chargeId, Number(current.totalDue))}
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-[#77328D] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Εξόφληση μήνα
            </button>
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
                <PaymentDetailsLink notes={statement.stationery.notes} paidAt={statement.stationery.paidAt} />
              </div>
            )}
          </div>
          {isAdmin && statement.stationery.status !== 'paid' && (
            <button
              onClick={() => onPayExtra({ id: statement.stationery.id, kind: 'once', amount: statement.stationery.amount })}
              disabled={saving}
              className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
            >
              Πληρωμή
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
            return (
              <div key={`${month.year}-${month.month}`} className={`px-5 py-4 ${quiet ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-36 shrink-0">
                    <p className="font-semibold text-gray-900">{MONTHS[month.month]}</p>
                    <p className="text-xs text-gray-400">{month.year}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <LineList lines={month.lines} compact />
                    <ExtraList extras={month.extras} isAdmin={isAdmin && !quiet} saving={saving} onPayExtra={onPayExtra} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-extrabold text-gray-900">{money(Number(month.totalDue))}</p>
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>
                    {(month.status === 'paid' || month.status === 'partial') && Number(month.totalDue) > 0 && (
                      <div className="mt-1 flex justify-end">
                        <PaymentDetailsLink
                          notes={month.notes}
                          paidAt={month.paidAt}
                          receipt={receiptFor(month.month, month.year)}
                          onDownloadReceipt={onDownloadReceipt}
                          onUploadReceipt={isAdmin && !quiet ? () => triggerUpload(month.month, month.year) : undefined}
                          onRequestSystemReceipt={isAdmin && !quiet && onRequestSystemReceipt ? () => onRequestSystemReceipt(month.month, month.year, month.notes) : undefined}
                        />
                      </div>
                    )}
                    {isAdmin && month.chargeId && month.status !== 'paid' && month.status !== 'upcoming' && (
                      <button onClick={() => onPayMonth(month.chargeId, Number(month.totalDue))} className="block ml-auto mt-2 text-xs font-semibold text-[#77328D]">Εξόφληση</button>
                    )}
                    {isAdmin && month.chargeId && month.status === 'paid' && Number(month.totalDue) > 0 && (
                      <button onClick={() => onUndoMonth(month.chargeId)} className="block ml-auto mt-2 text-xs text-gray-400">Αναίρεση</button>
                    )}
                    <ReceiptBadge
                      receipt={receiptFor(month.month, month.year)}
                      uploading={uploadingKey === monthKey(month.month, month.year)}
                      showUpload={isAdmin && (month.status === 'paid' || month.status === 'partial') && !quiet}
                      onUpload={() => triggerUpload(month.month, month.year)}
                      onDownload={onDownloadReceipt}
                      onDelete={onDeleteReceipt}
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

function ReceiptBadge({ receipt, uploading, showUpload, onUpload, onDownload, onDelete }: {
  receipt?: any;
  uploading: boolean;
  showUpload: boolean;
  onUpload: () => void;
  onDownload?: (docId: string) => void;
  onDelete?: (docId: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  if (uploading) {
    return <p className="mt-1 text-xs text-gray-400 text-right">Ανέβασμα...</p>;
  }
  if (receipt) {
    return (
      <div className="mt-1 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onDownload?.(receipt.id)}
          className="flex items-center gap-1 text-xs text-emerald-700 font-medium hover:underline"
        >
          <FileText className="h-3 w-3" />
          Απόδειξη ✓
        </button>
        {onDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try { await onDelete(receipt.id); } finally { setDeleting(false); }
            }}
            className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 ml-1"
            title="Διαγραφή απόδειξης"
          >
            ×
          </button>
        )}
      </div>
    );
  }
  if (!showUpload) return null;
  return (
    <button
      type="button"
      onClick={onUpload}
      className="mt-1 flex items-center justify-end gap-1 text-xs text-gray-400 hover:text-[#77328D] ml-auto"
    >
      <FileText className="h-3 w-3" />
      Ανέβασε απόδειξη
    </button>
  );
}

function ExtraList({
  extras,
  isAdmin,
  saving,
  onPayExtra,
}: {
  extras?: any[];
  isAdmin: boolean;
  saving: boolean;
  onPayExtra: (extra: any) => void;
}) {
  if (!extras?.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {extras.map((extra) => {
        const badge = statusLabel(extra.status === 'pending_payment' ? 'unpaid' : extra.status, Number(extra.amount));
        return (
          <div key={extra.id} className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm">
            <span className="flex-1 text-gray-800">{extra.kind === 'event' ? `Εκδρομή · ${extra.title}` : extra.title}</span>
            <span className="font-semibold">{money(Number(extra.amount))}</span>
            <span className="flex flex-col items-end">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>
              {(extra.status === 'paid' || extra.status === 'partial') && (
                <PaymentDetailsLink notes={extra.notes} paidAt={extra.paidAt} />
              )}
            </span>
            {isAdmin && extra.status !== 'paid' && (
              <button onClick={() => onPayExtra(extra)} disabled={saving} className="text-xs font-semibold text-green-700">Πληρωμή</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
