'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { readPaymentRecord } from '@/lib/payment-note';

function formatPaidAt(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('el-GR');
}

export function PaymentDetailsLink({
  notes,
  paidAt,
  receipt,
  onDownloadReceipt,
  onUploadReceipt,
  onRequestSystemReceipt,
}: {
  notes?: string | null;
  paidAt?: string | null;
  receipt?: any;
  onDownloadReceipt?: (docId: string) => void;
  onUploadReceipt?: () => void;
  onRequestSystemReceipt?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const record = readPaymentRecord(notes);
  const date = record?.date || formatPaidAt(paidAt);

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
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Πότε</dt>
                <dd className="font-semibold text-gray-900">{date || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Από ποιον</dt>
                <dd className="text-right font-semibold text-gray-900">{record?.payerName || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Τρόπος</dt>
                <dd className="font-semibold text-gray-900">{record?.method || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Ποσό</dt>
                <dd className="font-semibold text-gray-900">{record?.amount || '—'}</dd>
              </div>
            </dl>
            {!record && !date && (
              <p className="mt-4 text-sm text-gray-500">Η πληρωμή σημειώθηκε χωρίς επιπλέον στοιχεία.</p>
            )}
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
