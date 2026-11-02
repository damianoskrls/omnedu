'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { readPaymentRecords } from '@/lib/payment-note';

function formatPaidAt(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('el-GR');
}

function money(value: number) {
  return `€${Math.abs(value).toFixed(2)}`;
}

export function PaymentDetailsLink({
  notes,
  paidAt,
  receipt,
  totalDue,
  paidAmount,
  onDownloadReceipt,
  onUploadReceipt,
  onRequestSystemReceipt,
}: {
  notes?: string | null;
  paidAt?: string | null;
  receipt?: any;
  totalDue?: number;
  paidAmount?: number;
  onDownloadReceipt?: (docId: string) => void;
  onUploadReceipt?: () => void;
  onRequestSystemReceipt?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const records = readPaymentRecords(notes);
  const fallbackDate = formatPaidAt(paidAt);
  const due = Number(totalDue);
  const paid = Number(paidAmount);
  const showBalance = Number.isFinite(due) && due > 0;
  const remain = showBalance ? Math.max(0, due - (Number.isFinite(paid) ? paid : 0)) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block text-xs font-semibold text-[#77328D] hover:underline"
      >
        Λεπτομέρειες
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Λεπτομέρειες πληρωμής</h3>

            {showBalance && (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Οφειλή</span>
                  <span className="font-semibold text-gray-900">{money(due)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3">
                  <span className="text-gray-500">Πληρώθηκε</span>
                  <span className="font-semibold text-emerald-700">{money(Number.isFinite(paid) ? paid : 0)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3 border-t border-gray-200 pt-1">
                  <span className="font-medium text-gray-700">Υπόλοιπο</span>
                  <span className={`font-bold ${remain > 0.005 ? 'text-red-700' : 'text-emerald-700'}`}>{money(remain)}</span>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Πληρωμές</p>
              {records.length > 0 ? (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {records.map((record, index) => (
                    <li key={`${record.date}-${record.amount}-${index}`} className="rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Πότε</span>
                        <span className="font-semibold text-gray-900">{record.date || fallbackDate || '—'}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-gray-500">Από ποιον</span>
                        <span className="text-right font-semibold text-gray-900">{record.payerName || '—'}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-gray-500">Τρόπος</span>
                        <span className="font-semibold text-gray-900">{record.method || '—'}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-gray-500">Ποσό</span>
                        <span className="font-semibold text-gray-900">{record.amount || '—'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  {fallbackDate
                    ? `Η πληρωμή σημειώθηκε στις ${fallbackDate} χωρίς επιπλέον στοιχεία.`
                    : 'Η πληρωμή σημειώθηκε χωρίς επιπλέον στοιχεία.'}
                </p>
              )}
            </div>

            {(receipt || onUploadReceipt || onRequestSystemReceipt) && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Απόδειξη</p>
                {receipt ? (
                  <button
                    type="button"
                    onClick={() => { onDownloadReceipt?.(receipt.id); setOpen(false); }}
                    className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    Κατέβασε απόδειξη
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Δεν έχει ανεβεί απόδειξη για αυτή την πληρωμή.</p>
                    {onUploadReceipt && (
                      <button
                        type="button"
                        onClick={() => { setOpen(false); onUploadReceipt(); }}
                        className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Ανέβασε από εξωτερικό σύστημα
                      </button>
                    )}
                    {onRequestSystemReceipt && (
                      <button
                        type="button"
                        disabled={generatingReceipt}
                        onClick={async () => {
                          setGeneratingReceipt(true);
                          try {
                            await onRequestSystemReceipt();
                            setOpen(false);
                          } finally {
                            setGeneratingReceipt(false);
                          }
                        }}
                        className="w-full rounded-lg bg-[#77328D] py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {generatingReceipt ? 'Δημιουργία απόδειξης...' : 'Κόψε από το σύστημα'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-xl bg-[#77328D] py-2.5 text-sm font-semibold text-white"
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      )}
    </>
  );
}
