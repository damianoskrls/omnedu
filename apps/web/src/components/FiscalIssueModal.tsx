'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { fiscalApi, studentsApi } from '@/lib/api';

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
  studentId?: string;
  studentName?: string;
  studentAddress?: string | null;
  parents?: FiscalParentOption[];
  monthlyChargeId?: string;
  oneTimeChargeId?: string;
  grossAmount?: number;
  description?: string;
  /** When true, start in manual recipient mode (e.g. bank invoice). */
  manualRecipient?: boolean;
  defaultKind?: 'retail_receipt' | 'service_invoice';
};

type Props = {
  schoolId: string;
  open: boolean;
  prefill: FiscalIssuePrefill | null;
  onClose: () => void;
  onIssued: (doc: any) => void;
  /** Allow picking any student from the school (billing Παραστατικά flow). */
  allowStudentPicker?: boolean;
};

const PAYMENT_METHODS = [
  { value: 3, label: 'Μετρητά' },
  { value: 7, label: 'POS / κάρτα' },
  { value: 1, label: 'Τραπεζικός λογαριασμός' },
  { value: 8, label: 'IRIS' },
  { value: 6, label: 'Web banking' },
  { value: 5, label: 'Επί πιστώσει' },
];

const MONTHS_GR = [
  '', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
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

function clearCustomer(setters: {
  setCpVat: (v: string) => void;
  setCpName: (v: string) => void;
  setCpStreet: (v: string) => void;
  setCpNumber: (v: string) => void;
  setCpPostal: (v: string) => void;
  setCpCity: (v: string) => void;
}) {
  setters.setCpName('');
  setters.setCpVat('');
  setters.setCpStreet('');
  setters.setCpNumber('');
  setters.setCpPostal('');
  setters.setCpCity('');
}

function mapParents(raw: any[]): FiscalParentOption[] {
  return (raw || [])
    .map((p: any) => ({
      userId: p.userId || p.user?.id,
      fullName: p.user?.fullName || p.fullName || '',
      vatNumber: p.user?.vatNumber ?? p.vatNumber ?? null,
      billingStreet: p.user?.billingStreet ?? p.billingStreet ?? null,
      billingNumber: p.user?.billingNumber ?? p.billingNumber ?? null,
      billingPostalCode: p.user?.billingPostalCode ?? p.billingPostalCode ?? null,
      billingCity: p.user?.billingCity ?? p.billingCity ?? null,
      isPrimary: Boolean(p.isPrimary),
      relation: p.relation || null,
    }))
    .filter((p: FiscalParentOption) => Boolean(p.userId && p.fullName));
}

function buildSuggestions(studentName?: string, className?: string) {
  const now = new Date();
  const month = MONTHS_GR[now.getMonth() + 1];
  const year = now.getFullYear();
  const name = studentName?.trim() || 'μαθητή';
  const cls = className?.trim();
  return [
    `Δίδακτρα μήνα ${month} ${year} για τον Μαθητή ${name}${cls ? ` (${cls})` : ''}`,
    `Φοίτηση ${month} ${year} — ${name}${cls ? ` · τμήμα ${cls}` : ''}`,
    `Μηνιαία δίδακτρα — ${name}`,
    `Επιδότηση / τράπεζα — δίδακτρα για ${name}`,
  ];
}

export function FiscalIssueModal({ schoolId, open, prefill, onClose, onIssued, allowStudentPicker = false }: Props) {
  const [kind, setKind] = useState<'retail_receipt' | 'service_invoice'>('retail_receipt');
  const [recipientMode, setRecipientMode] = useState<'student' | 'manual'>('student');
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

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentAddress, setStudentAddress] = useState<string | null>(null);
  const [studentClassName, setStudentClassName] = useState('');
  const [parents, setParents] = useState<FiscalParentOption[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentOptions, setStudentOptions] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);

  const setters = useMemo(() => ({
    setCpVat, setCpName, setCpStreet, setCpNumber, setCpPostal, setCpCity,
  }), []);

  const suggestions = useMemo(
    () => buildSuggestions(studentName || prefill?.studentName, studentClassName),
    [studentName, prefill?.studentName, studentClassName],
  );

  useEffect(() => {
    if (!open || !schoolId) return;
    fiscalApi.getSettings(schoolId).then((s: any) => {
      setDefaults(s);
    }).catch(() => setDefaults(null));
  }, [open, schoolId]);

  useEffect(() => {
    if (!open) return;
    const startManual = Boolean(prefill?.manualRecipient) || (!prefill?.studentId && !allowStudentPicker);
    setRecipientMode(startManual ? 'manual' : 'student');
    setKind(prefill?.defaultKind || (startManual ? 'service_invoice' : 'retail_receipt'));
    setGrossAmount(prefill?.grossAmount != null ? String(prefill.grossAmount) : '');
    setDescription(prefill?.description || '');
    setError('');
    setCpCountry('GR');
    setPaymentMethodType(3);
    setStudentQuery('');
    setStudentOptions([]);

    if (prefill?.studentId) {
      setStudentId(prefill.studentId);
      setStudentName(prefill.studentName || '');
      setStudentAddress(prefill.studentAddress || null);
      const mapped = mapParents(prefill.parents || []);
      setParents(mapped);
      const primary = mapped.find((p) => p.isPrimary) || mapped[0];
      setParentUserId(primary?.userId || '');
      if (!startManual) applyParent(primary, prefill.studentAddress, setters);
      else clearCustomer(setters);
      if (!prefill.description && prefill.studentName) {
        setDescription(buildSuggestions(prefill.studentName)[0]);
      }
    } else {
      setStudentId('');
      setStudentName('');
      setStudentAddress(null);
      setStudentClassName('');
      setParents([]);
      setParentUserId('');
      clearCustomer(setters);
    }
  }, [open, prefill, allowStudentPicker, setters]);

  useEffect(() => {
    if (!defaults) return;
    setSeries(
      kind === 'retail_receipt'
        ? (defaults.fiscalRetailSeries || 'ΑΠ')
        : (defaults.fiscalInvoiceSeries || 'ΤΙΜ'),
    );
  }, [kind, defaults]);

  useEffect(() => {
    if (!open || !allowStudentPicker || recipientMode !== 'student') return;
    const q = studentQuery.trim().toLowerCase();
    let cancelled = false;
    setLoadingStudents(true);
    studentsApi.list(schoolId, undefined, true)
      .then((rows: any) => {
        if (cancelled) return;
        const list = Array.isArray(rows)
          ? rows
          : (Array.isArray(rows?.students) ? rows.students : []);
        const filtered = !q
          ? list.slice(0, 40)
          : list.filter((s: any) => String(s.fullName || '').toLowerCase().includes(q)).slice(0, 40);
        setStudentOptions(filtered);
      })
      .catch(() => { if (!cancelled) setStudentOptions([]); })
      .finally(() => { if (!cancelled) setLoadingStudents(false); });
    return () => { cancelled = true; };
  }, [open, allowStudentPicker, recipientMode, schoolId, studentQuery]);

  async function selectStudent(id: string) {
    setLoadingStudent(true);
    setError('');
    try {
      const s: any = await studentsApi.get(schoolId, id);
      const name = s?.fullName || '';
      const address = s?.address || null;
      const mapped = mapParents(s?.parents || []);
      const enrollment = Array.isArray(s?.enrollments) ? s.enrollments[0] : null;
      const className = enrollment?.class?.name || enrollment?.class?.level?.name || '';
      setStudentId(s.id);
      setStudentName(name);
      setStudentAddress(address);
      setStudentClassName(className);
      setParents(mapped);
      const primary = mapped.find((p) => p.isPrimary) || mapped[0];
      setParentUserId(primary?.userId || '');
      applyParent(primary, address, setters);
      setDescription(buildSuggestions(name, className)[0]);
      setStudentQuery(name);
      setStudentOptions([]);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Αποτυχία φόρτωσης μαθητή');
    } finally {
      setLoadingStudent(false);
    }
  }

  function onSelectParent(userId: string) {
    setParentUserId(userId);
    const parent = parents.find((p) => p.userId === userId);
    applyParent(parent, studentAddress, setters);
  }

  if (!open) return null;

  async function submit() {
    setError('');
    const amount = parseFloat(grossAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Βάλε έγκυρο ποσό');
      return;
    }
    if (!description.trim()) {
      setError('Βάλε περιγραφή υπηρεσίας');
      return;
    }
    if (!cpName.trim()) {
      setError('Βάλε επωνυμία / ονοματεπώνυμο παραλήπτη');
      return;
    }
    if (kind === 'service_invoice' && !cpVat.trim()) {
      setError('Για τιμολόγιο απαιτείται ΑΦΜ παραλήπτη');
      return;
    }
    if (recipientMode === 'student' && allowStudentPicker && !studentId && !prefill?.studentId) {
      setError('Επίλεξε μαθητή ή άλλαξε σε χειροκίνητα στοιχεία');
      return;
    }
    setSubmitting(true);
    try {
      const linkedStudentId = recipientMode === 'student'
        ? (studentId || prefill?.studentId)
        : (studentId || prefill?.studentId || undefined);
      const doc: any = await fiscalApi.issue(schoolId, {
        studentId: linkedStudentId,
        monthlyChargeId: prefill?.monthlyChargeId,
        oneTimeChargeId: prefill?.oneTimeChargeId,
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
      <div className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[94vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Έκδοση παραστατικού</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Απόδειξη ή τιμολόγιο μέσω Elorus Fuse
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {defaults && !defaults.fuseConfigured && (
            <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
              Λείπει το <code className="text-xs">ELORUS_FUSE_API_TOKEN</code> στο API.
            </div>
          )}
          {defaults && !defaults.vatNumber && (
            <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
              Λείπει το ΑΦΜ σχολείου/εταιρείας (εκδότης) στις Ρυθμίσεις Οικονομικών.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Τύπος</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('retail_receipt')}
                className={`rounded-xl border px-3 py-2.5 text-sm text-left ${
                  kind === 'retail_receipt' ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-gray-200 text-gray-700'
                }`}
              >
                <div className="font-semibold">Απόδειξη</div>
                <div className="text-[11px] opacity-70">Παροχή υπηρεσιών · 11.2</div>
              </button>
              <button
                type="button"
                onClick={() => setKind('service_invoice')}
                className={`rounded-xl border px-3 py-2.5 text-sm text-left ${
                  kind === 'service_invoice' ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-gray-200 text-gray-700'
                }`}
              >
                <div className="font-semibold">Τιμολόγιο</div>
                <div className="text-[11px] opacity-70">π.χ. για τράπεζα / επιδότηση · 2.1</div>
              </button>
            </div>
          </div>

          {(allowStudentPicker || Boolean(prefill?.studentId)) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Παραλήπτης</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecipientMode('student');
                    if (parents.length) {
                      const primary = parents.find((p) => p.isPrimary) || parents[0];
                      setParentUserId(primary?.userId || '');
                      applyParent(primary, studentAddress, setters);
                    }
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    recipientMode === 'student' ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  Από μαθητή / γονέα
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientMode('manual');
                    clearCustomer(setters);
                    setParentUserId('');
                    if (kind === 'retail_receipt') setKind('service_invoice');
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    recipientMode === 'manual' ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  Χειροκίνητα (π.χ. τράπεζα)
                </button>
              </div>
            </div>
          )}

          {recipientMode === 'student' && allowStudentPicker && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Αναζήτηση μαθητή</label>
              <input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Όνομα μαθητή..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {loadingStudents && <p className="text-xs text-gray-400">Φόρτωση μαθητών...</p>}
              {!loadingStudents && studentOptions.length > 0 && (
                !studentId || studentQuery.trim().toLowerCase() !== studentName.trim().toLowerCase()
              ) && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                  {studentOptions.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void selectStudent(s.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                    >
                      {s.fullName}
                    </button>
                  ))}
                </div>
              )}
              {loadingStudent && <p className="text-xs text-indigo-600">Φόρτωση στοιχείων...</p>}
              {studentId && (
                <div className="rounded-lg bg-emerald-50 text-emerald-800 text-sm px-3 py-2 flex items-center justify-between gap-2">
                  <span>Επιλεγμένος: <strong>{studentName}</strong></span>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => {
                      setStudentId('');
                      setStudentName('');
                      setStudentClassName('');
                      setParents([]);
                      setParentUserId('');
                      clearCustomer(setters);
                      setStudentQuery('');
                    }}
                  >
                    Αλλαγή
                  </button>
                </div>
              )}
            </div>
          )}

          {recipientMode === 'student' && !allowStudentPicker && studentName && (
            <div className="rounded-lg bg-gray-50 text-gray-700 text-sm px-3 py-2">
              Μαθητής: <strong>{studentName}</strong>
            </div>
          )}

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
            <label className="block text-xs font-medium text-gray-600 mb-1">Περιγραφή υπηρεσίας</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Χειροκίνητα ή επίλεξε πρόταση παρακάτω"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDescription(s)}
                  className="text-[11px] px-2 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50"
                >
                  {s}
                </button>
              ))}
            </div>
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
            <p className="text-xs font-semibold text-gray-700">
              {recipientMode === 'manual' ? 'Στοιχεία παραλήπτη (χειροκίνητα)' : 'Στοιχεία πελάτη (γονέας)'}
            </p>
            {recipientMode === 'student' && parents.length > 0 && (
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
                <p className="text-[11px] text-gray-500 mt-1">Μπορείς να διορθώσεις τα πεδία χειροκίνητα πριν την έκδοση.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">ΑΦΜ {kind === 'service_invoice' ? '*' : ''}</label>
                <input value={cpVat} onChange={(e) => setCpVat(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Χώρα</label>
                <input value={cpCountry} onChange={(e) => setCpCountry(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Επωνυμία / Ονοματεπώνυμο *</label>
              <input value={cpName} onChange={(e) => setCpName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
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
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
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
