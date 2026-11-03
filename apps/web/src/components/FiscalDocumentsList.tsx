'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';
import { fiscalApi } from '@/lib/api';

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
  return kind;
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

  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white overflow-hidden">
      {documents.map((doc) => {
        const badge = statusBadge(doc.status, doc.mydataStatus);
        const href = doc.verificationUrl || doc.qrUrl;
        return (
          <div key={doc.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex items-center gap-2 shrink-0">
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
      })}
    </div>
  );
}
