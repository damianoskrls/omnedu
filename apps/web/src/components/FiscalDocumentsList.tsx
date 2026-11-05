'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, FileMinus2, RefreshCw, Send } from 'lucide-react';
import { fiscalApi } from '@/lib/api';
import { pairFiscalDocuments } from '@/lib/fiscal-document-pairs';

type Props = {
  schoolId: string;
  documents: any[];
  onChanged: () => void;
  refreshingId?: string | null;
  setRefreshingId?: (id: string | null) => void;
};

function kindLabel(kind: string) {
  if (kind === 'retail_receipt') return 'Απόδειξη';
  if (kind === 'service_invoice') return 'Τιμολόγιο';
  if (kind === 'retail_credit_note') return 'Πιστωτικό απόδειξης';
  if (kind === 'service_credit_note') return 'Πιστωτικό τιμολογίου';
  return kind;
}

function isCreditKind(kind: string) {
  return kind === 'retail_credit_note' || kind === 'service_credit_note';
}

function canIssueCredit(doc: any, all: any[]) {
  if (doc.status !== 'issued') return false;
  if (doc.documentKind !== 'retail_receipt' && doc.documentKind !== 'service_invoice') return false;
  const already = all.some(
    (d) =>
      d.relatedDocumentId === doc.id &&
      isCreditKind(d.documentKind) &&
      d.status !== 'failed',
  );
  return !already;
}

function statusBadge(status: string, mydataStatus?: string | null) {
  if (status === 'failed') return { text: 'Αποτυχία', className: 'bg-red-100 text-red-700' };
  if (status === 'pending') return { text: 'Σε εξέλιξη', className: 'bg-amber-100 text-amber-800' };
  const md = String(mydataStatus || '').toLowerCase();
  if (md.includes('success') || md.includes('sent')) {
    return { text: 'myDATA OK', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (md.includes('not') || md.includes('pending') || !mydataStatus) {
    return { text: 'Εκδόθηκε', className: 'bg-blue-100 text-blue-700' };
  }
  return { text: String(mydataStatus), className: 'bg-gray-100 text-gray-700' };
}

export function FiscalDocumentsList({
  schoolId,
  documents,
  onChanged,
  refreshingId,
  setRefreshingId,
}: Props) {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [creditingId, setCreditingId] = useState<string | null>(null);
  const pairs = useMemo(() => pairFiscalDocuments(documents), [documents]);

  if (!documents.length) {
    return (
      <p className="text-sm text-gray-400 py-2">Δεν έχουν εκδοθεί ακόμα φορολογικά παραστατικά για αυτόν τον μαθητή.</p>
    );
  }

  async function refresh(id: string) {
    setRefreshingId?.(id);
    try {
      await fiscalApi.refresh(schoolId, id);
      onChanged();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Αποτυχία ανανέωσης';
      window.alert(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setRefreshingId?.(null);
    }
  }

  async function resend(id: string) {
    setResendingId(id);
    try {
      await fiscalApi.resend(schoolId, id);
      window.alert('Στάλθηκε ειδοποίηση στους γονείς.');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Αποτυχία επαναποστολής';
      window.alert(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setResendingId(null);
    }
  }

  async function credit(doc: any) {
    const kind =
      doc.documentKind === 'service_invoice'
        ? 'πιστωτικό τιμολόγιο (5.1)'
        : 'πιστωτικό απόδειξης (11.4)';
    const ok = window.confirm(
      `Έκδοση ${kind} για ${doc.series}-${doc.number} (€${Number(doc.grossValue).toFixed(2)}) μέσω Elorus Fuse;\n\nΘα δημιουργηθεί νέο παραστατικό με τα ίδια ποσά.`,
    );
    if (!ok) return;
    setCreditingId(doc.id);
    try {
      const result: any = await fiscalApi.credit(schoolId, doc.id);
      if (result?.status === 'failed') {
        window.alert(result.errorMessage || 'Η έκδοση πιστωτικού απέτυχε');
      }
      onChanged();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Αποτυχία έκδοσης πιστωτικού';
      window.alert(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setCreditingId(null);
    }
  }

  function renderRow(doc: any, opts?: { isCredit?: boolean }) {
    const badge = statusBadge(doc.status, doc.mydataStatus);
    const href = doc.verificationUrl || doc.qrUrl;
    const creditRow = Boolean(opts?.isCredit) || isCreditKind(doc.documentKind);
    return (
      <div
        key={doc.id}
        className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${
          creditRow ? 'bg-rose-50/60' : 'bg-white'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {creditRow && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                ακυρώνει
              </span>
            )}
            <span className="text-sm font-semibold text-gray-900">
              {kindLabel(doc.documentKind)} {doc.series}-{doc.number}
            </span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.text}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{doc.description}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            €{Number(doc.grossValue).toFixed(2)}
            {doc.mark ? ` · MARK ${doc.mark}` : ''}
            {doc.fuseUid ? ` · UID ${String(doc.fuseUid).slice(0, 8)}…` : ''}
          </p>
          {doc.status === 'failed' && doc.errorMessage && (
            <p className="text-xs text-red-600 mt-1">{doc.errorMessage}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Επαλήθευση
            </a>
          )}
          {canIssueCredit(doc, documents) && (
            <button
              type="button"
              onClick={() => void credit(doc)}
              disabled={creditingId === doc.id}
              className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-900 disabled:opacity-50"
            >
              <FileMinus2 className={`h-3.5 w-3.5 ${creditingId === doc.id ? 'animate-pulse' : ''}`} />
              {creditingId === doc.id ? 'Έκδοση…' : 'Πιστωτικό'}
            </button>
          )}
          {doc.studentId && doc.status !== 'failed' && (
            <button
              type="button"
              onClick={() => void resend(doc.id)}
              disabled={resendingId === doc.id}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <Send className={`h-3.5 w-3.5 ${resendingId === doc.id ? 'animate-pulse' : ''}`} />
              Επαναποστολή
            </button>
          )}
          <button
            type="button"
            onClick={() => void refresh(doc.id)}
            disabled={refreshingId === doc.id}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === doc.id ? 'animate-spin' : ''}`} />
            Ανανέωση
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pairs.map((pair) => {
        const framed = pair.credits.length > 0;
        return (
          <div
            key={pair.key}
            className={
              framed
                ? 'rounded-xl border-2 border-rose-200 bg-rose-50/30 overflow-hidden shadow-sm'
                : 'rounded-xl border border-gray-100 bg-white overflow-hidden'
            }
          >
            {framed && (
              <div className="px-4 py-1.5 bg-rose-100/80 border-b border-rose-200 text-[11px] font-medium text-rose-800">
                Παραστατικό + πιστωτικό ακύρωσης
              </div>
            )}
            <div className="divide-y divide-gray-100">
              {renderRow(pair.primary)}
              {pair.credits.map((credit) => renderRow(credit, { isCredit: true }))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
