'use client';

import { useState } from 'react';
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
}: {
  notes?: string | null;
  paidAt?: string | null;
}) {
  const [open, setOpen] = useState(false);
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
