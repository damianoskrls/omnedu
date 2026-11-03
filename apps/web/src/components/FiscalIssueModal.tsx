'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { fiscalApi } from '@/lib/api';

export type FiscalParentOption = {
  userId: string;
  fullName: string;
  vatNumber?: string | null;
  billingStreet?: string | null;
  billingNumber?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  isPrimary?: boolean;
  relation?: string | null;
};

export type FiscalIssuePrefill = {
  studentId: string;
  studentName?: string;
  studentAddress?: string | null;
  parents?: FiscalParentOption[];
  monthlyChargeId?: string;
  oneTimeChargeId?: string;
  grossAmount?: number;
  description?: string;
};

type Props = {
  schoolId: string;
  open: boolean;
  prefill: FiscalIssuePrefill | null;
  onClose: () => void;
  onIssued: (doc: any) => void;
};

const PAYMENT_METHODS = [
  { value: 3, label: 'Μετρητά' },
  { value: 7, label: 'POS / κάρτα' },
  { value: 1, label: 'Τραπεζικός λογαριασμός' },
  { value: 8, label: 'IRIS' },
  { value: 6, label: 'Web banking' },
  { value: 5, label: 'Επί πιστώσει' },
];

function applyParent(
  parent: FiscalParentOption | undefined,
  studentAddress: string | null | undefined,
  setters: {
    setCpVat: (v: string) => void;
    setCpName: (v: string) => void;
    setCpStreet: (v: string) => void;
    setCpNumber: (v: string) => void;
    setCpPostal: (v: string) => void;
    setCpCity: (v: string) => void;
  },
) {
  setters.setCpName(parent?.fullName || '');
  setters.setCpVat(parent?.vatNumber || '');
  setters.setCpStreet(parent?.billingStreet || studentAddress || '');
  setters.setCpNumber(parent?.billingNumber || '');
  setters.setCpPostal(parent?.billingPostalCode || '');
  setters.setCpCity(parent?.billingCity || '');
}

export function FiscalIssueModal({ schoolId, open, prefill, onClose, onIssued }: Props) {
  const [kind, setKind] = useState<'retail_receipt' | 'service_invoice'>('retail_receipt');
  const [grossAmount, setGrossAmount] = useState('');
  const [description, setDescription] = useState('');
  const [series, setSeries] = useState('');
  const [paymentMethodType, setPaymentMethodType] = useState(3);
  const [parentUserId, setParentUserId] = useState('');
  const [cpVat, setCpVat] = useState('');
  const [cpName, setCpName] = useState('');
  const [cpCountry, setCpCountry] = useState('GR');
  const [cpStreet, setCpStreet] = useState('');
  const [cpNumber, setCpNumber] = useState('');
  const [cpPostal, setCpPostal] = useState('');
  const [cpCity, setCpCity] = useState('');
  const [defaults, setDefaults] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parents = useMemo(() => prefill?.parents || [], [prefill]);

  useEffect(() => {
    if (!open || !schoolId) return;
    fiscalApi.getSettings(schoolId).then((s: any) => {
      setDefaults(s);
      setSeries(
        kind === 'retail_receipt'
          ? (s?.fiscalRetailSeries || 'ΑΠ')
          : (s?.fiscalInvoiceSeries || 'ΤΙΜ'),
      );
    }).catch(() => setDefaults(null));
  }, [open, schoolId]);

  useEffect(() => {
    if (!open || !prefill) return;
    setKind('retail_receipt');
    setGrossAmount(prefill.grossAmount != null ? String(prefill.grossAmount) : '');
    setDescription(prefill.description || `Φοίτηση — ${prefill.studentName || 'μαθητής'}`);
    setError('');
    setCpCountry('GR');
    setPaymentMethodType(3);
    const primary = parents.find((p) => p.isPrimary) || parents[0];
    setParentUserId(primary?.userId || '');
    applyParent(primary, prefill.studentAddress, {
      setCpVat, setCpName, setCpStreet, setCpNumber, setCpPostal, setCpCity,
    });
  }, [open, prefill, parents]);

  useEffect(() => {
    if (!defaults) return;
    setSeries(
      kind === 'retail_receipt'
        ? (defaults.fiscalRetailSeries || 'ΑΠ')
        : (defaults.fiscalInvoiceSeries || 'ΤΙΜ'),
    );
  }, [kind, defaults]);

  if (!open || !prefill) return null;

  function onSelectParent(userId: string) {
    setParentUserId(userId);
    const parent = parents.find((p) => p.userId === userId);
    applyParent(parent, prefill?.studentAddress, {
      setCpVat, setCpName, setCpStreet, setCpNumber, setCpPostal, setCpCity,
    });
  }

  async function submit() {
    setError('');
    const amount = parseFloat(grossAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Βάλε έγκυρο ποσό');
      return;
    }
    if (!description.trim()) {
      setError('Βάλε περιγραφή');
      return;
    }
    if (!cpName.trim()) {
      setError('Βάλε επωνυμία πελάτη (γονέα) — όπως στο κλασικό παραστατικό');
      return;
    }
    if (kind === 'service_invoice' && !cpVat.trim()) {
      setError('Για τιμολόγιο απαιτείται ΑΦΜ πελάτη');
      return;
    }
    setSubmitting(true);
    try {
      const doc: any = await fiscalApi.issue(schoolId, {
        studentId: prefill!.studentId,
        monthlyChargeId: prefill!.monthlyChargeId,
        oneTimeChargeId: prefill!.oneTimeChargeId,
        documentKind: kind,
        description: description.trim(),
        grossAmount: amount,
        series: series.trim() || undefined,
        paymentMethodType,
        counterparty: {
          vatNumber: cpVat.trim() || undefined,
          name: cpName.trim(),
          country: cpCountry.trim() || 'GR',
          street: cpStreet.trim() || undefined,
          number: cpNumber.trim() || undefined,
          postalCode: cpPostal.trim() || undefined,
          city: cpCity.trim() || undefined,
        },
      });
      if (doc?.status === 'failed') {
        setError(doc.errorMessage || 'Η έκδοση απέτυχε');
        onIssued(doc);
        return;
      }
      onIssued(doc);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Σφάλμα έκδοσης παραστατικού';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Έκδοση παραστατικού</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Elorus Fuse · {prefill.studentName || 'μαθητής'} · στοιχεία πελάτη = γονέας
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {defaults && !defaults.fuseConfigured && (
            <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
              Δεν έχει οριστεί <code className="text-xs">ELORUS_FUSE_API_TOKEN</code> στο API.
            </div>
          )}
          {defaults && !defaults.vatNumber && (
            <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
              Λείπει το ΑΦΜ <strong>σχολείου/εταιρείας</strong> (εκδότης). Όρισέ το στις Ρυθμίσεις Οικονομικών — όχι το ΑΦΜ του γονέα.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Τύπος</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('retail_receipt')}
                className={`rounded-xl border px-3 py-2.5 text-sm text-left ${
                  kind === 'retail_receipt'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                <div className="font-semibold">Απόδειξη</div>
                <div className="text-[11px] opacity-70">Παροχή υπηρεσιών · 11.2</div>
              </button>
              <button
                type="button"
                onClick={() => setKind('service_invoice')}
                className={`rounded-xl border px-3 py-2.5 text-sm text-left ${
                  kind === 'service_invoice'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                <div className="font-semibold">Τιμολόγιο</div>
                <div className="text-[11px] opacity-70">Παροχή υπηρεσιών · 2.1</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ποσό (€ μικτό)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Σειρά</label>
              <input
                type="text"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Περιγραφή γραμμής</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="π.χ. Φοίτηση Νηπιαγωγείο Οκτώβριος"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Τρόπος πληρωμής (myDATA)</label>
            <select
              value={paymentMethodType}
              onChange={(e) => setPaymentMethodType(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Στοιχεία πελάτη (γονέας)</p>
            {parents.length > 0 && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Γονέας</label>
                <select
                  value={parentUserId}
                  onChange={(e) => onSelectParent(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {parents.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.fullName}{p.isPrimary ? ' (κύριος)' : ''}{p.relation ? ` · ${p.relation}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">ΑΦΜ πελάτη {kind === 'service_invoice' ? '*' : ''}</label>
                <input
                  value={cpVat}
                  onChange={(e) => setCpVat(e.target.value)}
                  placeholder="π.χ. 125944067"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Χώρα</label>
                <input
                  value={cpCountry}
                  onChange={(e) => setCpCountry(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Επωνυμία / Ονοματεπώνυμο *</label>
              <input
                value={cpName}
                onChange={(e) => setCpName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Οδός</label>
                <input value={cpStreet} onChange={(e) => setCpStreet(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Αρ.</label>
                <input value={cpNumber} onChange={(e) => setCpNumber(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Τ.Κ.</label>
                <input value={cpPostal} onChange={(e) => setCpPostal(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Πόλη</label>
                <input value={cpCity} onChange={(e) => setCpCity(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              Αποθήκευσε ΑΦΜ/διεύθυνση στον γονέα (tab Γονείς) για να συμπληρώνονται αυτόματα την επόμενη φορά.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Ακύρωση
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
          >
            {submitting ? 'Έκδοση...' : 'Έκδοση στο Elorus'}
          </button>
        </div>
      </div>
    </div>
  );
}
