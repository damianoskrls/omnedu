'use client';

import { Banknote, CreditCard, Landmark, Smartphone, Wallet } from 'lucide-react';
import { noteWithoutPayment, readPaymentRecords, type PaymentRecord } from '@/lib/payment-note';

function parseAmount(raw?: string) {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[€\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function money(value: number) {
  return `€${value.toFixed(2)}`;
}

function methodIcon(method?: string) {
  const key = (method || '').toLowerCase();
  if (key.includes('μετρητ') || key.includes('cash')) return Banknote;
  if (key.includes('κάρτ') || key.includes('card')) return CreditCard;
  if (key.includes('τραπεζ') || key.includes('bank') || key.includes('κατάθεσ')) return Landmark;
  if (key.includes('iris')) return Smartphone;
  return Wallet;
}

function methodTone(method?: string) {
  const key = (method || '').toLowerCase();
  if (key.includes('μετρητ') || key.includes('cash')) return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (key.includes('κάρτ') || key.includes('card')) return 'bg-sky-50 text-sky-800 ring-sky-100';
  if (key.includes('τραπεζ') || key.includes('bank') || key.includes('κατάθεσ')) return 'bg-indigo-50 text-indigo-800 ring-indigo-100';
  if (key.includes('iris')) return 'bg-violet-50 text-violet-800 ring-violet-100';
  return 'bg-gray-50 text-gray-700 ring-gray-100';
}

function PaymentRow({ record }: { record: PaymentRecord }) {
  const Icon = methodIcon(record.method);
  const amount = parseAmount(record.amount);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100">
      <span className="min-w-[4.75rem] text-xs font-semibold tabular-nums text-gray-500">
        {record.date || '—'}
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${methodTone(record.method)}`}>
        <Icon className="h-3 w-3" />
        {record.method || 'Άλλο'}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
        {record.payerName || '—'}
      </span>
      <span className="text-sm font-extrabold tabular-nums text-emerald-700">
        {amount != null ? money(amount) : (record.amount || '—')}
      </span>
    </li>
  );
}

/**
 * Inline payment history for billing lists.
 * Answers: πότε, τρόπος, ποιος πλήρωσε, πόσο — without dumping raw notes.
 */
export function PaymentHistoryStrip({
  notes,
  compact,
}: {
  notes?: string | null;
  compact?: boolean;
}) {
  const records = readPaymentRecords(notes);
  const freeText = noteWithoutPayment(notes).trim();
  if (!records.length && !freeText) return null;

  const total = records.reduce((sum, row) => sum + (parseAmount(row.amount) ?? 0), 0);
  const shown = compact ? records.slice(0, 3) : records;
  const hidden = Math.max(0, records.length - shown.length);

  return (
    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5">
      {records.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/80">
              Ιστορικό πληρωμών · {records.length}
            </p>
            {total > 0 && (
              <p className="text-xs font-bold tabular-nums text-emerald-800">
                Σύνολο {money(total)}
              </p>
            )}
          </div>
          <ul className="space-y-1.5">
            {shown.map((record, index) => (
              <PaymentRow key={`${record.date}-${record.amount}-${index}`} record={record} />
            ))}
          </ul>
          {hidden > 0 && (
            <p className="mt-1.5 text-[11px] text-emerald-800/70">
              +{hidden} ακόμα · άνοιξε «Λεπτομέρειες» για όλες
            </p>
          )}
        </>
      )}
      {freeText && (
        <p className={`text-xs text-gray-500 ${records.length ? 'mt-2 border-t border-emerald-100/80 pt-2' : ''}`}>
          {freeText}
        </p>
      )}
    </div>
  );
}
