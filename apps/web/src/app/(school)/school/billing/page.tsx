'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { billingApi, levelsApi, schoolEventsApi, broadcastsApi, schoolsApi, fiscalApi } from '@/lib/api';
import { eventDisplayStatus } from '@/lib/event-status';
import { payerOptions, paymentNote } from '@/lib/payment-note';
import { PaymentConfirmModal, PaymentPrompt } from '@/components/PaymentConfirmModal';
import { PaymentDetailsLink } from '@/components/PaymentDetailsLink';
import { useStoredUser } from '@/lib/auth';
import { currentMonthKey } from '@/lib/month-quote';
import {
  ChevronLeft, ChevronRight, Settings, Zap, Bus, CheckCircle2,
  Clock, AlertCircle, Euro, Plus, Pencil, Trash2, X, Check,
  CalendarDays, Filter, BellRing, ExternalLink, ChevronDown, ChevronUp, Users, FileText,
} from 'lucide-react';

const MONTHS_GR = [
  '', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

const EVENT_ENROLLMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending_consent:  { label: 'Αναμ. Συναίνεση', color: 'bg-yellow-100 text-yellow-800' },
  consent_given:    { label: 'Συναίνεση',       color: 'bg-blue-100 text-blue-700' },
  consent_declined: { label: 'Απόρριψη',        color: 'bg-red-100 text-red-700' },
  pending_payment:  { label: 'Αναμ. Πληρωμή',  color: 'bg-orange-100 text-orange-700' },
  paid:             { label: 'Πληρωμένο',       color: 'bg-green-100 text-green-700' },
};

const SUBSIDY_TYPES: Record<string, string> = {
  bank: 'Τράπεζα',
  voucher: 'Voucher/Επίδομα',
  other: 'Άλλο',
};

const STATUS_STYLES: Record<string, { label: string; color: string; icon: any }> = {
  paid: { label: 'Πληρωμένο', color: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle2 },
  partial: { label: 'Μερική', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: AlertCircle },
  unpaid: { label: 'Εκκρεμεί', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
};

function fmt(n: number) {
  return `€${n.toFixed(2)}`;
}

export default function BillingPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const router = useRouter();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [charges, setCharges] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [levelFees, setLevelFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'charges' | 'events' | 'fiscal' | 'settings'>('charges');
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [fiscalDocs, setFiscalDocs] = useState<any[]>([]);
  const [fiscalDocsLoading, setFiscalDocsLoading] = useState(false);
  const [refreshingFiscalId, setRefreshingFiscalId] = useState<string | null>(null);

  // Events tab state
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventEnrollments, setEventEnrollments] = useState<Record<string, any[]>>({});
  const [loadingEnrollments, setLoadingEnrollments] = useState<string | null>(null);
  const [markingPayment, setMarkingPayment] = useState<string | null>(null);
  const [sendingNotif, setSendingNotif] = useState<string | null>(null);

  // Billing due day
  const [billingDueDay, setBillingDueDay] = useState('');
  const [savingDueDay, setSavingDueDay] = useState(false);
  const [dueDaySaved, setDueDaySaved] = useState(false);

  // Sibling discount policy
  const [siblingPolicy, setSiblingPolicy] = useState<{ siblingDiscountEnabled: boolean; siblingDiscount2Pct: number | null; siblingDiscount3PlusPct: number | null }>({ siblingDiscountEnabled: false, siblingDiscount2Pct: null, siblingDiscount3PlusPct: null });
  const [savingSiblingPolicy, setSavingSiblingPolicy] = useState(false);
  const [siblingPolicySaved, setSiblingPolicySaved] = useState(false);

  // Elorus Fuse fiscal settings
  const [fiscalSettings, setFiscalSettings] = useState({
    vatNumber: '',
    fiscalRetailSeries: 'ΑΠ',
    fiscalInvoiceSeries: 'ΤΙΜ',
    fiscalVatCategory: '1',
    fiscalVatExemptionCategory: '',
    fuseConfigured: false,
    fuseBaseUrl: 'https://api.fuse-staging.gr',
  });
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [fiscalSaved, setFiscalSaved] = useState(false);

  // Settings modals
  const [editingLevelFee, setEditingLevelFee] = useState<any>(null); // { levelId, levelName, monthlyFee }
  const [editingOverride, setEditingOverride] = useState<any>(null); // student charge selected for override/subsidy management
  const [overrideData, setOverrideData] = useState<any>(null);
  const [subsidies, setSubsidies] = useState<any[]>([]);
  const [subsidyForm, setSubsidyForm] = useState<any>(null);

  const [payPrompt, setPayPrompt] = useState<PaymentPrompt | null>(null);

  const autoGeneratedRef = useRef<string>('');

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [ch, st, lv, lf, school, sibPol, fiscal] = await Promise.all([
        billingApi.getCharges(schoolId, month, year),
        billingApi.stats(schoolId),
        levelsApi.list(schoolId),
        billingApi.getLevelFees(schoolId),
        schoolsApi.get(schoolId),
        billingApi.getSiblingDiscountPolicy(schoolId).catch(() => null),
        fiscalApi.getSettings(schoolId).catch(() => null),
      ]);
      const chargesArr = Array.isArray(ch) ? ch : [];
      setCharges(chargesArr);
      setStats(st);
      setLevels(Array.isArray(lv) ? lv : []);
      setLevelFees(Array.isArray(lf) ? lf : []);
      if ((school as any)?.billingDueDay != null) setBillingDueDay(String((school as any).billingDueDay));
      if (sibPol) setSiblingPolicy({ siblingDiscountEnabled: (sibPol as any).siblingDiscountEnabled ?? false, siblingDiscount2Pct: (sibPol as any).siblingDiscount2Pct ?? null, siblingDiscount3PlusPct: (sibPol as any).siblingDiscount3PlusPct ?? null });
      if (fiscal) {
        setFiscalSettings({
          vatNumber: (fiscal as any).vatNumber || '',
          fiscalRetailSeries: (fiscal as any).fiscalRetailSeries || 'ΑΠ',
          fiscalInvoiceSeries: (fiscal as any).fiscalInvoiceSeries || 'ΤΙΜ',
          fiscalVatCategory: (fiscal as any).fiscalVatCategory != null ? String((fiscal as any).fiscalVatCategory) : '1',
          fiscalVatExemptionCategory: (fiscal as any).fiscalVatExemptionCategory != null ? String((fiscal as any).fiscalVatExemptionCategory) : '',
          fuseConfigured: Boolean((fiscal as any).fuseConfigured),
          fuseBaseUrl: (fiscal as any).fuseBaseUrl || 'https://api.fuse-staging.gr',
        });
      }

      // Auto-generate for the current month if no charges exist yet
      const now = new Date();
      const key = `${month}-${year}`;
      if (
        chargesArr.length === 0 &&
        month === now.getMonth() + 1 &&
        year === now.getFullYear() &&
        autoGeneratedRef.current !== key
      ) {
        autoGeneratedRef.current = key;
        setGenerating(true);
        try {
          await billingApi.generateCharges(schoolId, month, year);
          const fresh: any = await billingApi.getCharges(schoolId, month, year);
          setCharges(Array.isArray(fresh) ? fresh : []);
          const freshStats: any = await billingApi.stats(schoolId);
          setStats(freshStats);
        } finally {
          setGenerating(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [schoolId, month, year]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'events' || !schoolId) return;
    setEventsLoading(true);
    schoolEventsApi.list(schoolId).then((evts: any) => {
      setEvents(Array.isArray(evts) ? evts : []);
    }).catch(() => setEvents([])).finally(() => setEventsLoading(false));
  }, [tab, schoolId]);

  const loadFiscalDocs = useCallback(async () => {
    if (!schoolId) return;
    setFiscalDocsLoading(true);
    try {
      const rows: any = await fiscalApi.listDocuments(schoolId);
      setFiscalDocs(Array.isArray(rows) ? rows : []);
    } catch {
      setFiscalDocs([]);
    } finally {
      setFiscalDocsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (tab !== 'fiscal' || !schoolId) return;
    void loadFiscalDocs();
  }, [tab, schoolId, loadFiscalDocs]);

  async function refreshFiscalDoc(id: string) {
    setRefreshingFiscalId(id);
    try {
      await fiscalApi.refresh(schoolId, id);
      await loadFiscalDocs();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || err?.message || 'Αποτυχία ανανέωσης');
    } finally {
      setRefreshingFiscalId(null);
    }
  }

  async function loadEventEnrollments(eventId: string) {
    setLoadingEnrollments(eventId);
    try {
      const enrs: any = await schoolEventsApi.getEnrollments(schoolId, eventId);
      setEventEnrollments(prev => ({ ...prev, [eventId]: Array.isArray(enrs) ? enrs : [] }));
    } finally {
      setLoadingEnrollments(null);
    }
  }

  async function handleToggleEvent(eventId: string) {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      return;
    }
    setExpandedEventId(eventId);
    if (!eventEnrollments[eventId]) {
      await loadEventEnrollments(eventId);
    }
  }

  async function handleAdminConsent(eventId: string, enrollmentId: string, status: string) {
    setMarkingPayment(enrollmentId);
    try {
      await schoolEventsApi.adminUpdateEnrollment(schoolId, eventId, enrollmentId, status);
      await loadEventEnrollments(eventId);
    } finally {
      setMarkingPayment(null);
    }
  }

  async function handleMarkEventPayment(eventId: string, enrollmentId: string, paid: boolean) {
    setMarkingPayment(enrollmentId);
    try {
      await schoolEventsApi.markPayment(schoolId, eventId, enrollmentId, paid);
      await loadEventEnrollments(eventId);
    } finally {
      setMarkingPayment(null);
    }
  }

  async function notifyUnpaidForEvent(eventId: string, eventTitle: string) {
    const enrs = eventEnrollments[eventId] ?? [];
    const unpaid = enrs.filter((e: any) => e.status === 'pending_payment' || e.status === 'pending_consent');
    if (unpaid.length === 0) return;
    setSendingNotif(eventId);
    try {
      for (const enr of unpaid) {
        await broadcastsApi.send(schoolId, {
          title: `Υπενθύμιση: ${eventTitle}`,
          body: `Υπάρχει εκκρεμής ενέργεια για την εκδήλωση "${eventTitle}". Παρακαλούμε ενημερώστε τη γραμματεία.`,
          targetType: 'student',
          targetStudentId: enr.studentId,
        });
      }
    } catch {
      // ignore
    } finally {
      setSendingNotif(null);
    }
  }

  async function notifyUnpaidForMonth() {
    const unpaid = charges.filter(c => c.status !== 'paid');
    if (unpaid.length === 0) return;
    setSendingNotif('monthly');
    try {
      for (const c of unpaid) {
        await broadcastsApi.send(schoolId, {
          title: `Υπενθύμιση Πληρωμής — ${MONTHS_GR[month]} ${year}`,
          body: `Υπάρχει εκκρεμής πληρωμή για τον μήνα ${MONTHS_GR[month]} ${year}. Παρακαλούμε ενημερώστε τη γραμματεία.`,
          targetType: 'student',
          targetStudentId: c.studentId ?? c.student?.id,
        });
      }
    } catch {
      // ignore
    } finally {
      setSendingNotif(null);
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  async function generate() {
    setGenerating(true);
    try {
      await billingApi.generateCharges(schoolId, month, year);
      await load();
    } finally {
      setGenerating(false);
    }
  }

  function openChargePayment(charge: any) {
    const due = Number(charge.totalDue);
    const already = Number(charge.paidAmount ?? 0);
    setPayPrompt({
      title: `${MONTHS_GR[month]} ${year}`,
      detail: 'Μηνιαία χρέωση',
      studentName: charge.student.fullName,
      studentId: charge.studentId ?? charge.student.id,
      parents: payerOptions(charge.student?.parents),
      schoolId,
      schoolName: window.localStorage.getItem('school_name') || 'Σχολείο',
      logoUrl: window.localStorage.getItem('school_logo_url') || '',
      // allowAdvance: surplus → next months via applyChargePayment. User: πληρωσω και αλλο ποσο
      chargeAmount: Math.max(0, due - already) || due,
      allowAdvance: true,
      run: async (info) => {
        await billingApi.applyChargePayment(schoolId, charge.id, {
          paidAmount: info.paidAmount,
          paidAt: info.paidAt,
          notes: paymentNote(info, charge.notes),
        });
        await load();
      },
    });
  }

  async function markUnpaid(charge: any) {
    await billingApi.updateCharge(schoolId, charge.id, { paidAmount: 0, status: 'unpaid' });
    await load();
  }

  async function deleteCharge(charge: any) {
    if (!confirm(`Διαγραφή χρέωσης για ${charge.student.fullName};`)) return;
    await billingApi.deleteCharge(schoolId, charge.id);
    setCharges(prev => prev.filter(c => c.id !== charge.id));
  }

  async function saveBillingDueDay() {
    const day = parseInt(billingDueDay);
    if (isNaN(day) || day < 1 || day > 28) return;
    setSavingDueDay(true);
    try {
      await schoolsApi.update(schoolId, { billingDueDay: day });
      setDueDaySaved(true);
      setTimeout(() => setDueDaySaved(false), 2000);
    } finally {
      setSavingDueDay(false);
    }
  }

  async function saveSiblingPolicy() {
    setSavingSiblingPolicy(true);
    try {
      await billingApi.updateSiblingDiscountPolicy(schoolId, {
        siblingDiscountEnabled: siblingPolicy.siblingDiscountEnabled,
        siblingDiscount2Pct: siblingPolicy.siblingDiscountEnabled ? (siblingPolicy.siblingDiscount2Pct ?? null) : null,
        siblingDiscount3PlusPct: siblingPolicy.siblingDiscountEnabled ? (siblingPolicy.siblingDiscount3PlusPct ?? null) : null,
      });
      setSiblingPolicySaved(true);
      setTimeout(() => setSiblingPolicySaved(false), 2000);
    } finally {
      setSavingSiblingPolicy(false);
    }
  }

  async function saveFiscalSettings() {
    setSavingFiscal(true);
    try {
      const updated: any = await fiscalApi.updateSettings(schoolId, {
        vatNumber: fiscalSettings.vatNumber.trim() || null,
        fiscalRetailSeries: fiscalSettings.fiscalRetailSeries.trim() || null,
        fiscalInvoiceSeries: fiscalSettings.fiscalInvoiceSeries.trim() || null,
        fiscalVatCategory: fiscalSettings.fiscalVatCategory === '' ? null : Number(fiscalSettings.fiscalVatCategory),
        fiscalVatExemptionCategory: fiscalSettings.fiscalVatExemptionCategory === '' ? null : Number(fiscalSettings.fiscalVatExemptionCategory),
      });
      setFiscalSettings((prev) => ({
        ...prev,
        vatNumber: updated?.vatNumber || '',
        fiscalRetailSeries: updated?.fiscalRetailSeries || 'ΑΠ',
        fiscalInvoiceSeries: updated?.fiscalInvoiceSeries || 'ΤΙΜ',
        fiscalVatCategory: updated?.fiscalVatCategory != null ? String(updated.fiscalVatCategory) : '1',
        fiscalVatExemptionCategory: updated?.fiscalVatExemptionCategory != null ? String(updated.fiscalVatExemptionCategory) : '',
      }));
      setFiscalSaved(true);
      setTimeout(() => setFiscalSaved(false), 2000);
    } finally {
      setSavingFiscal(false);
    }
  }

  async function saveLevelFee() {
    if (!editingLevelFee) return;
    await billingApi.upsertLevelFee(schoolId, editingLevelFee.levelId, {
      monthlyFee: parseFloat(editingLevelFee.monthlyFee) || 0,
      annualFee: editingLevelFee.annualFee ? parseFloat(editingLevelFee.annualFee) : null,
    });
    setEditingLevelFee(null);
    const lf: any = await billingApi.getLevelFees(schoolId);
    setLevelFees(Array.isArray(lf) ? lf : []);
  }

  async function openStudentSettings(charge: any) {
    setEditingOverride(charge);
    const [ov, subs] = await Promise.all([
      billingApi.getStudentFee(schoolId, charge.student.id).catch(() => null),
      billingApi.getSubsidies(schoolId, charge.student.id),
    ]);
    const fee = ov as any;
    setOverrideData({
      discountPct: fee?.discountPct ?? '',
      fixedAmount: fee?.fixedAmount ?? '',
      reason: fee?.reason ?? '',
      from: currentMonthKey(),
    });
    setSubsidies(Array.isArray(subs) ? subs : []);
    setSubsidyForm(null);
  }

  async function saveOverride() {
    const d: any = { effectiveFrom: `${overrideData.from || currentMonthKey()}-01` };
    if (overrideData.fixedAmount !== '' && overrideData.fixedAmount !== null && overrideData.fixedAmount !== undefined) {
      d.fixedAmount = parseFloat(overrideData.fixedAmount);
      d.discountPct = null;
    } else if (overrideData.discountPct !== '' && overrideData.discountPct !== null && overrideData.discountPct !== undefined) {
      d.discountPct = parseFloat(overrideData.discountPct);
      d.fixedAmount = null;
    } else {
      d.fixedAmount = null;
      d.discountPct = null;
    }
    d.reason = overrideData.reason || null;
    await billingApi.upsertStudentFee(schoolId, editingOverride.student.id, d);
    setOverrideData(null);
    await load();
  }

  async function removeOverride() {
    await billingApi.deleteStudentFee(schoolId, editingOverride.student.id);
    setOverrideData({ discountPct: '', fixedAmount: '', reason: '', from: currentMonthKey() });
    await load();
  }

  async function saveSubsidy() {
    if (!subsidyForm) return;
    const payload = {
      name: subsidyForm.name,
      subsidyType: subsidyForm.subsidyType || 'voucher',
      monthlyAmount: Number(subsidyForm.monthlyAmount),
      notes: subsidyForm.notes || '',
      isActive: subsidyForm.isActive !== false,
      startsFrom: `${subsidyForm.startsMonth || currentMonthKey()}-01`,
    };
    if (subsidyForm.id) {
      await billingApi.updateSubsidy(schoolId, editingOverride.student.id, subsidyForm.id, payload);
    } else {
      await billingApi.createSubsidy(schoolId, editingOverride.student.id, payload);
    }
    const subs: any = await billingApi.getSubsidies(schoolId, editingOverride.student.id);
    setSubsidies(Array.isArray(subs) ? subs : []);
    setSubsidyForm(null);
  }

  async function deleteSubsidy(subsidyId: string) {
    await billingApi.deleteSubsidy(schoolId, editingOverride.student.id, subsidyId);
    const subs: any = await billingApi.getSubsidies(schoolId, editingOverride.student.id);
    setSubsidies(Array.isArray(subs) ? subs : []);
  }

  const totalDue = charges.reduce((s, c) => s + Number(c.totalDue), 0);
  const totalPaid = charges.reduce((s, c) => s + Number(c.paidAmount), 0);
  const totalPending = totalDue - totalPaid;
  const paidCount = charges.filter(c => c.status === 'paid').length;
  const unpaidCount = charges.filter(c => c.status === 'unpaid').length;
  const partialCount = charges.filter(c => c.status === 'partial').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Οικονομικά</h1>
          <p className="text-sm text-gray-500 mt-0.5">Σχολικό Έτος {stats?.schoolYear ?? '...'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab(tab === 'settings' ? 'charges' : 'settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'settings'
                ? 'bg-gray-800 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Settings className="h-4 w-4" />
            Ρυθμίσεις
          </button>
        </div>
      </div>

      {/* View tabs */}
      {tab !== 'settings' && (
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('charges')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'charges' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Euro className="h-4 w-4" /> Μηνιαία
          </button>
          <button
            onClick={() => setTab('events')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'events' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <CalendarDays className="h-4 w-4" /> Εκδηλώσεις
          </button>
          <button
            onClick={() => setTab('fiscal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'fiscal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileText className="h-4 w-4" /> Παραστατικά
          </button>
        </div>
      )}

      {tab === 'settings' ? (
        <SettingsTab
          levels={levels}
          levelFees={levelFees}
          editingLevelFee={editingLevelFee}
          setEditingLevelFee={setEditingLevelFee}
          saveLevelFee={saveLevelFee}
          billingDueDay={billingDueDay}
          setBillingDueDay={setBillingDueDay}
          saveBillingDueDay={saveBillingDueDay}
          savingDueDay={savingDueDay}
          dueDaySaved={dueDaySaved}
          siblingPolicy={siblingPolicy}
          setSiblingPolicy={setSiblingPolicy}
          saveSiblingPolicy={saveSiblingPolicy}
          savingSiblingPolicy={savingSiblingPolicy}
          siblingPolicySaved={siblingPolicySaved}
          fiscalSettings={fiscalSettings}
          setFiscalSettings={setFiscalSettings}
          saveFiscalSettings={saveFiscalSettings}
          savingFiscal={savingFiscal}
          fiscalSaved={fiscalSaved}
        />
      ) : tab === 'fiscal' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Όλα τα φορολογικά παραστατικά</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Αποδείξεις και τιμολόγια που εκδόθηκαν μέσω Elorus Fuse. Οι γονείς τα βλέπουν και στην εφαρμογή τους.
            </p>
          </div>
          {fiscalDocsLoading ? (
            <div className="text-center py-12 text-gray-400">Φόρτωση...</div>
          ) : (
            <div className="space-y-2">
              {fiscalDocs.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">Δεν έχουν εκδοθεί ακόμα παραστατικά.</p>
              ) : (
                fiscalDocs.map((doc: any) => {
                  const href = doc.verificationUrl || doc.qrUrl;
                  const studentName = doc.student?.fullName || '—';
                  const kind = doc.documentKind === 'service_invoice' ? 'Τιμολόγιο' : 'Απόδειξη';
                  return (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{kind} {doc.series}-{doc.number}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            doc.status === 'failed' ? 'bg-red-100 text-red-700'
                              : doc.status === 'issued' ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {doc.status === 'failed' ? 'Αποτυχία' : doc.status === 'issued' ? 'Εκδόθηκε' : 'Σε εξέλιξη'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {studentName} · {doc.description} · €{Number(doc.grossValue).toFixed(2)}
                          {doc.mark ? ` · MARK ${doc.mark}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => router.push(`/school/students/${doc.studentId}`)}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900"
                          disabled={!doc.studentId}
                        >
                          Μαθητής
                        </button>
                        {href && (
                          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                            <ExternalLink className="h-3.5 w-3.5" /> Επαλήθευση
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void refreshFiscalDoc(doc.id)}
                          disabled={refreshingFiscalId === doc.id}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          {refreshingFiscalId === doc.id ? '...' : 'Ανανέωση'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => void loadFiscalDocs()}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Ανανέωση λίστας
          </button>
        </div>
      ) : tab === 'events' ? (
        /* ---- Events tab ---- */
        <div className="space-y-3">
          {eventsLoading ? (
            <div className="text-center py-16 text-gray-400">Φόρτωση...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">Δεν υπάρχουν εκδηλώσεις</p>
            </div>
          ) : events.map((evt: any) => {
            const enrs = eventEnrollments[evt.id] ?? [];
            const isExpanded = expandedEventId === evt.id;
            const pendingCount = enrs.filter((e: any) => e.status === 'pending_payment' || e.status === 'pending_consent').length;
            const paidCount = enrs.filter((e: any) => e.status === 'paid').length;
            const totalCount = enrs.length;

            return (
              <div key={evt.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
                  onClick={() => handleToggleEvent(evt.id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{evt.title}</span>
                      {eventDisplayStatus(evt.status, evt.eventDate) === 'published' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Δημοσιευμένο</span>}
                      {eventDisplayStatus(evt.status, evt.eventDate) === 'completed' && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Ολοκληρώθηκε</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      {evt.eventDate && <span>{new Date(evt.eventDate).toLocaleDateString('el-GR')}</span>}
                      {evt.costPerChild > 0 && <span className="font-medium text-gray-700">€{evt.costPerChild}/παιδί</span>}
                      {isExpanded && totalCount > 0 && (
                        <>
                          <span className="text-green-600 font-medium">{paidCount} πληρωμένοι</span>
                          {pendingCount > 0 && <span className="text-orange-600 font-medium">{pendingCount} εκκρεμούν</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isExpanded && pendingCount > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); notifyUnpaidForEvent(evt.id, evt.title); }}
                        disabled={sendingNotif === evt.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <BellRing className="h-3.5 w-3.5" />
                        {sendingNotif === evt.id ? 'Αποστολή...' : `Ειδοποίηση (${pendingCount})`}
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {loadingEnrollments === evt.id ? (
                      <div className="py-6 text-center text-gray-400 text-sm">Φόρτωση...</div>
                    ) : enrs.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 text-sm">Δεν υπάρχουν εγγεγραμμένοι μαθητές.</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {enrs.map((enr: any) => (
                          <div key={enr.id} className="flex items-center gap-4 px-5 py-3">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                              {enr.student.avatarUrl ? (
                                <img src={enr.student.avatarUrl} className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-gray-400">{enr.student.fullName.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-900 text-sm">{enr.student.fullName}</span>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${EVENT_ENROLLMENT_STATUS[enr.status]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                              {EVENT_ENROLLMENT_STATUS[enr.status]?.label ?? enr.status}
                            </span>
                            {(enr.status === 'pending_consent' || enr.status === 'consent_declined') && (
                              <button
                                onClick={() => handleAdminConsent(evt.id, enr.id, Number(evt.costPerChild) > 0 ? 'pending_payment' : 'consent_given')}
                                disabled={markingPayment === enr.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 shrink-0"
                              >
                                <Check className="h-3 w-3" /> Συναίνεση
                              </button>
                            )}
                            {enr.status === 'pending_consent' && (
                              <button
                                onClick={() => handleAdminConsent(evt.id, enr.id, 'consent_declined')}
                                disabled={markingPayment === enr.id}
                                className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 shrink-0"
                              >
                                Άρνηση
                              </button>
                            )}
                            {enr.status === 'pending_payment' && (
                              <button
                                onClick={() => setPayPrompt({
                                  title: evt.title,
                                  detail: 'Εκδήλωση',
                                  studentName: enr.student.fullName,
                                  studentId: enr.studentId ?? enr.student.id,
                                  parents: payerOptions(enr.student?.parents),
                                  schoolId,
                                  schoolName: window.localStorage.getItem('school_name') || 'Σχολείο',
                                  logoUrl: window.localStorage.getItem('school_logo_url') || '',
                                  chargeAmount: Number(evt.costPerChild) || 0,
                                  lockPaidAmount: true,
                                  run: async (info) => {
                                    await schoolEventsApi.markPayment(schoolId, evt.id, enr.id, true, {
                                      paidAt: info.paidAt,
                                      notes: paymentNote(info),
                                    });
                                    await loadEventEnrollments(evt.id);
                                  },
                                })}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 shrink-0"
                              >
                                <Check className="h-3 w-3" /> Εξόφληση
                              </button>
                            )}
                            {enr.status === 'paid' && (
                              <div className="flex flex-col items-end shrink-0">
                                <button
                                  onClick={() => handleMarkEventPayment(evt.id, enr.id, false)}
                                  disabled={markingPayment === enr.id}
                                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg"
                                >
                                  Αναίρεση
                                </button>
                                <PaymentDetailsLink notes={enr.notes} paidAt={enr.paidAt} />
                              </div>
                            )}
                            <button
                              onClick={() => router.push(`/school/students/${enr.studentId}`)}
                              className="p-1.5 text-gray-300 hover:text-indigo-500 shrink-0"
                              title="Προφίλ μαθητή"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* School-year summary dashboard */}
          {stats?.sy && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Σύνολο Σχολικού Έτους {stats.schoolYear}</h2>
                <span className="text-xs text-gray-400">Εως σήμερα</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-indigo-50 rounded-xl p-4">
                  <div className="text-xs text-indigo-600 mb-1 font-medium">Εισπράχθηκαν</div>
                  <div className="text-2xl font-bold text-indigo-700">{fmt(stats.sy.totalPaid)}</div>
                  <div className="text-xs text-indigo-400 mt-0.5">από {fmt(stats.sy.totalDue)} συνολικά</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="text-xs text-amber-600 mb-1 font-medium">Εκκρεμούν</div>
                  <div className="text-2xl font-bold text-amber-700">{fmt(Math.max(0, stats.sy.totalDue - stats.sy.totalPaid))}</div>
                  <div className="text-xs text-amber-400 mt-0.5">{stats.studentsOwingThisMonth} μαθητές αυτόν τον μήνα</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-2 font-medium">Ανάλυση χρεώσεων</div>
                  <div className="space-y-1">
                    {stats.sy.schoolFees > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Δίδακτρα</span><span className="font-medium text-gray-700">{fmt(stats.sy.schoolFees)}</span></div>}
                    {stats.sy.busFees > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Σχολικό</span><span className="font-medium text-gray-700">{fmt(stats.sy.busFees)}</span></div>}
                    {stats.sy.activityFees > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Δραστηριότητες</span><span className="font-medium text-gray-700">{fmt(stats.sy.activityFees)}</span></div>}
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-xs text-emerald-600 mb-2 font-medium">Επιδοτήσεις / Voucher</div>
                  <div className="text-2xl font-bold text-emerald-700">{fmt(stats.sy.subsidies)}</div>
                  <div className="text-xs text-emerald-400 mt-0.5">αφαιρέθηκαν αυτόματα</div>
                </div>
              </div>
              {/* Progress bar */}
              {stats.sy.totalDue > 0 && (
                <div className="mt-1">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Εισπράχθηκε {Math.round((stats.sy.totalPaid / stats.sy.totalDue) * 100)}%</span>
                    <span>Εκκρεμεί {Math.round(((stats.sy.totalDue - stats.sy.totalPaid) / stats.sy.totalDue) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (stats.sy.totalPaid / stats.sy.totalDue) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Month selector + stats */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-lg font-bold text-gray-900 min-w-[200px] text-center">
                  {MONTHS_GR[month]} {year}
                </span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {generating ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Δημιουργία Χρεώσεων
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Χρεώσεις μήνα</div>
                <div className="text-xl font-bold text-gray-900">{fmt(totalDue)}</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-xs text-green-600 mb-1">Πληρωμένο</div>
                <div className="text-xl font-bold text-green-700">{fmt(totalPaid)}</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="text-xs text-amber-600 mb-1">Εκκρεμεί</div>
                <div className="text-xl font-bold text-amber-700">{fmt(totalPending)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Μαθητές</div>
                <div className="flex items-center gap-1.5 text-sm mt-1">
                  <span className="text-green-700 font-bold">{paidCount}</span>
                  <span className="text-xs text-gray-400">εξοφλ.</span>
                  <span className="text-gray-300 mx-1">·</span>
                  <span className="text-amber-700 font-bold">{unpaidCount}</span>
                  <span className="text-xs text-gray-400">εκκρ.</span>
                  {partialCount > 0 && <><span className="text-gray-300 mx-1">·</span><span className="text-blue-700 font-bold">{partialCount}</span><span className="text-xs text-gray-400">μερ.</span></>}
                </div>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          {!loading && charges.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUnpaidOnly(!showUnpaidOnly)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    showUnpaidOnly
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Μόνο Ανεξόφλητοι
                  {showUnpaidOnly && (
                    <span className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full">
                      {charges.filter(c => c.status !== 'paid').length}
                    </span>
                  )}
                </button>
              </div>
              {charges.filter(c => c.status !== 'paid').length > 0 && (
                <button
                  onClick={notifyUnpaidForMonth}
                  disabled={sendingNotif === 'monthly'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  {sendingNotif === 'monthly' ? 'Αποστολή...' : `Ειδοποίηση ανεξόφλητων (${charges.filter(c => c.status !== 'paid').length})`}
                </button>
              )}
            </div>
          )}

          {/* Charge list */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">Φόρτωση...</div>
          ) : charges.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Euro className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">Δεν υπάρχουν χρεώσεις για αυτόν τον μήνα</p>
              <p className="text-sm mt-1">Πατήστε "Δημιουργία Χρεώσεων" για να δημιουργηθούν αυτόματα</p>
            </div>
          ) : (
            <div className="space-y-2">
              {charges.filter(c => !showUnpaidOnly || c.status !== 'paid').map((charge: any) => {
                const s = STATUS_STYLES[charge.status] ?? STATUS_STYLES.unpaid;
                const Icon = s.icon;
                const levelName = charge.student.enrollments?.[0]?.class?.level?.name ?? '—';
                return (
                  <div key={charge.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-4">
                      {/* Student info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/school/students/${charge.studentId ?? charge.student?.id}`)}
                            className="font-semibold text-gray-900 truncate hover:text-indigo-600 transition-colors text-left"
                          >
                            {charge.student.fullName}
                          </button>
                          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full shrink-0">{levelName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {Number(charge.schoolFee) > 0 && (
                            <span>Δίδακτρα: <span className="font-medium text-gray-700">{fmt(Number(charge.schoolFee))}</span></span>
                          )}
                          {Number(charge.busFee) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Bus className="h-3 w-3" /> {fmt(Number(charge.busFee))}
                            </span>
                          )}
                          {Number(charge.activityFees) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Zap className="h-3 w-3" /> {fmt(Number(charge.activityFees))}
                            </span>
                          )}
                          {Number(charge.subsidyTotal) > 0 && (
                            <span className="text-emerald-600">−{fmt(Number(charge.subsidyTotal))} επιδότηση</span>
                          )}
                        </div>
                      </div>

                      {/* Total */}
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-gray-900">{fmt(Number(charge.totalDue))}</div>
                        {charge.status === 'partial' && (
                          <div className="text-xs text-blue-600">Πληρωμένο: {fmt(Number(charge.paidAmount))}</div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="flex flex-col items-end shrink-0">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${s.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {s.label}
                        </div>
                        {(charge.status === 'paid' || charge.status === 'partial') && (
                          <div className="mt-1">
                            <PaymentDetailsLink notes={charge.notes} paidAt={charge.paidAt} />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openStudentSettings(charge)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Ρυθμίσεις μαθητή"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        {charge.status === 'paid' ? (
                          <button
                            onClick={() => markUnpaid(charge)}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                            title="Αναίρεση πληρωμής"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openChargePayment(charge)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Πληρωμή
                          </button>
                        )}
                        <button
                          onClick={() => deleteCharge(charge)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          title="Διαγραφή χρέωσης"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {charge.notes && (
                      <div className="mt-2 text-xs text-gray-400 pl-0">{charge.notes}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <PaymentConfirmModal prompt={payPrompt} onClose={() => setPayPrompt(null)} />

      {/* Student settings modal (override + subsidies) */}
      {editingOverride && (
        <StudentFeeModal
          charge={editingOverride}
          overrideData={overrideData}
          setOverrideData={setOverrideData}
          subsidies={subsidies}
          subsidyForm={subsidyForm}
          setSubsidyForm={setSubsidyForm}
          onClose={() => { setEditingOverride(null); load(); }}
          saveOverride={saveOverride}
          removeOverride={removeOverride}
          saveSubsidy={saveSubsidy}
          deleteSubsidy={deleteSubsidy}
        />
      )}
    </div>
  );
}

function SettingsTab({ levels, levelFees, editingLevelFee, setEditingLevelFee, saveLevelFee, billingDueDay, setBillingDueDay, saveBillingDueDay, savingDueDay, dueDaySaved, siblingPolicy, setSiblingPolicy, saveSiblingPolicy, savingSiblingPolicy, siblingPolicySaved, fiscalSettings, setFiscalSettings, saveFiscalSettings, savingFiscal, fiscalSaved }: any) {
  const feeMap: Record<string, any> = {};
  levelFees.forEach((lf: any) => { feeMap[lf.levelId] = lf; });

  return (
    <div className="space-y-4">
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-1">Ηλεκτρονική τιμολόγηση (Elorus Fuse)</h2>
      <p className="text-sm text-gray-500 mb-4">
        ΑΦΜ εκδότη και σειρές παραστατικών για έκδοση απόδειξης/τιμολογίου από τα Οικονομικά μαθητή.
        Το API token ορίζεται στο server env (<code className="text-xs">ELORUS_FUSE_API_TOKEN</code>).
      </p>
      <div className="mb-3 text-xs text-gray-500">
        Base URL: <span className="font-mono">{fiscalSettings.fuseBaseUrl}</span>
        {' · '}
        Token: {fiscalSettings.fuseConfigured ? (
          <span className="text-emerald-700 font-medium">ρυθμισμένο</span>
        ) : (
          <span className="text-amber-700 font-medium">λείπει</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ΑΦΜ σχολείου</label>
          <input
            value={fiscalSettings.vatNumber}
            onChange={(e: any) => setFiscalSettings({ ...fiscalSettings, vatNumber: e.target.value })}
            placeholder="π.χ. 999999999"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Κατηγορία ΦΠΑ (myDATA)</label>
          <input
            type="number"
            value={fiscalSettings.fiscalVatCategory}
            onChange={(e: any) => setFiscalSettings({ ...fiscalSettings, fiscalVatCategory: e.target.value })}
            placeholder="1 = 24%"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Σειρά απόδειξης (11.2)</label>
          <input
            value={fiscalSettings.fiscalRetailSeries}
            onChange={(e: any) => setFiscalSettings({ ...fiscalSettings, fiscalRetailSeries: e.target.value })}
            placeholder="ΑΠ"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Σειρά τιμολογίου (2.1)</label>
          <input
            value={fiscalSettings.fiscalInvoiceSeries}
            onChange={(e: any) => setFiscalSettings({ ...fiscalSettings, fiscalInvoiceSeries: e.target.value })}
            placeholder="ΤΙΜ"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Κατηγορία απαλλαγής ΦΠΑ <span className="text-gray-400 font-normal">(προαιρετικό)</span></label>
          <input
            type="number"
            value={fiscalSettings.fiscalVatExemptionCategory}
            onChange={(e: any) => setFiscalSettings({ ...fiscalSettings, fiscalVatExemptionCategory: e.target.value })}
            placeholder="κενό αν δεν ισχύει"
            className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>
      <button
        onClick={saveFiscalSettings}
        disabled={savingFiscal}
        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {fiscalSaved ? <Check className="h-3.5 w-3.5" /> : null}
        {fiscalSaved ? 'Αποθηκεύτηκε' : savingFiscal ? 'Αποθήκευση...' : 'Αποθήκευση'}
      </button>
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-1">Ημερομηνία Εξόφλησης</h2>
      <p className="text-sm text-gray-500 mb-4">Ορίστε την ημέρα του μήνα που πρέπει να εξοφλούν οι γονείς (π.χ. 10 = κάθε 10η του μήνα). Εμφανίζεται στην εφαρμογή ως αντίστροφη μέτρηση.</p>
      <div className="flex items-center gap-3 max-w-xs">
        <input
          type="number"
          min={1}
          max={28}
          value={billingDueDay}
          onChange={(e) => setBillingDueDay(e.target.value)}
          placeholder="π.χ. 10"
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <span className="text-sm text-gray-500">η του μήνα</span>
        <button
          onClick={saveBillingDueDay}
          disabled={savingDueDay || !billingDueDay}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {dueDaySaved ? <Check className="h-3.5 w-3.5" /> : null}
          {dueDaySaved ? 'Αποθηκεύτηκε' : savingDueDay ? 'Αποθήκευση...' : 'Αποθήκευση'}
        </button>
      </div>
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-bold text-gray-900">Έκπτωση αδελφών</h2>
        <button
          role="switch"
          aria-checked={siblingPolicy.siblingDiscountEnabled}
          onClick={() => setSiblingPolicy({ ...siblingPolicy, siblingDiscountEnabled: !siblingPolicy.siblingDiscountEnabled })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 ${siblingPolicy.siblingDiscountEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${siblingPolicy.siblingDiscountEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Αυτόματη έκπτωση για οικογένειες με 2 ή περισσότερα παιδιά στο σχολείο. Εφαρμόζεται στη Φοίτηση κάθε μήνα.</p>
      {siblingPolicy.siblingDiscountEnabled && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Έκπτωση 2ου παιδιού (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={siblingPolicy.siblingDiscount2Pct ?? ''}
              onChange={e => setSiblingPolicy({ ...siblingPolicy, siblingDiscount2Pct: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="π.χ. 10"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Έκπτωση 3ου+ παιδιού (%) <span className="text-gray-400 font-normal">(προαιρετικό)</span></label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={siblingPolicy.siblingDiscount3PlusPct ?? ''}
              onChange={e => setSiblingPolicy({ ...siblingPolicy, siblingDiscount3PlusPct: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="π.χ. 15"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      )}
      <button
        onClick={saveSiblingPolicy}
        disabled={savingSiblingPolicy}
        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {siblingPolicySaved ? <Check className="h-3.5 w-3.5" /> : null}
        {siblingPolicySaved ? 'Αποθηκεύτηκε' : savingSiblingPolicy ? 'Αποθήκευση...' : 'Αποθήκευση'}
      </button>
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-1">Τιμολόγηση ανά Βαθμίδα</h2>
      <p className="text-sm text-gray-500 mb-5">Μηνιαία δίδακτρα + εφάπαξ εγγραφή για κάθε βαθμίδα</p>
      {levels.length === 0 && (
        <p className="text-sm text-gray-400">Δεν υπάρχουν βαθμίδες. Δημιουργήστε βαθμίδες στις ρυθμίσεις.</p>
      )}
      <div className="space-y-2">
        {levels.map((level: any) => {
          const fee = feeMap[level.id];
          const isEditing = editingLevelFee?.levelId === level.id;
          return (
            <div key={level.id} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{level.name}</div>
                  {fee && !isEditing && (
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                      <span>{fmt(Number(fee.monthlyFee))}/μήνα</span>
                      {fee.annualFee && <span className="text-purple-600">+ {fmt(Number(fee.annualFee))} εγγραφή/έτος</span>}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setEditingLevelFee({
                      levelId: level.id,
                      levelName: level.name,
                      monthlyFee: fee ? Number(fee.monthlyFee).toFixed(2) : '',
                      annualFee: fee?.annualFee ? Number(fee.annualFee).toFixed(2) : '',
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {fee ? 'Αλλαγή' : 'Ορισμός'}
                  </button>
                )}
              </div>
              {isEditing && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Μηνιαία δίδακτρα (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingLevelFee.monthlyFee}
                        onChange={e => setEditingLevelFee({ ...editingLevelFee, monthlyFee: e.target.value })}
                        placeholder="π.χ. 420"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Εγγραφή αρχής έτους (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingLevelFee.annualFee}
                        onChange={e => setEditingLevelFee({ ...editingLevelFee, annualFee: e.target.value })}
                        placeholder="π.χ. 100 (γραφική ύλη)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingLevelFee(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                      Ακύρωση
                    </button>
                    <button onClick={saveLevelFee} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                      Αποθήκευση
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

function StudentFeeModal({ charge, overrideData, setOverrideData, subsidies, subsidyForm, setSubsidyForm, onClose, saveOverride, removeOverride, saveSubsidy, deleteSubsidy }: any) {
  const [innerTab, setInnerTab] = useState<'override' | 'subsidies'>('override');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{charge.student.fullName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ρυθμίσεις χρέωσης</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 p-4 pb-0">
          {(['override', 'subsidies'] as const).map(t => (
            <button
              key={t}
              onClick={() => setInnerTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                innerTab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t === 'override' ? 'Προσαρμογή Ποσού' : 'Επιδοτήσεις'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {innerTab === 'override' && overrideData !== null && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Έκπτωση ή ειδική τιμή από τον μήνα που διαλέγεις. Οι προηγούμενοι μήνες μένουν ως έχουν.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Σταθερό Ποσό (€) <span className="text-gray-400 font-normal">— αντικαθιστά το ποσό βαθμίδας</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={overrideData.fixedAmount ?? ''}
                  onChange={e => setOverrideData({ ...overrideData, fixedAmount: e.target.value, discountPct: '' })}
                  placeholder="π.χ. 250.00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="h-px flex-1 bg-gray-100" /> ή <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Έκπτωση (%) <span className="text-gray-400 font-normal">— επί του ποσού βαθμίδας</span></label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={overrideData.discountPct ?? ''}
                  onChange={e => setOverrideData({ ...overrideData, discountPct: e.target.value, fixedAmount: '' })}
                  placeholder="π.χ. 10 (= 10%)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Αιτιολογία</label>
                <input
                  value={overrideData.reason ?? ''}
                  onChange={e => setOverrideData({ ...overrideData, reason: e.target.value })}
                  placeholder="π.χ. Έκπτωση αδελφών, Υπάλληλος"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ισχύει από</label>
                <input
                  type="month"
                  value={overrideData.from || currentMonthKey()}
                  onChange={e => setOverrideData({ ...overrideData, from: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={removeOverride}
                  className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
                >
                  Αφαίρεση
                </button>
                <button
                  onClick={saveOverride}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  Αποθήκευση
                </button>
              </div>
            </div>
          )}

          {innerTab === 'subsidies' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Τράπεζα, voucher ή άλλος φορέας. Η επεξεργασία αλλάζει τις χρεώσεις από τον μήνα που διαλέγεις.</p>
              {subsidies.map((sub: any) => (
                <div key={sub.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">{sub.name}</div>
                    <div className="text-xs text-gray-500">{SUBSIDY_TYPES[sub.subsidyType] ?? sub.subsidyType} · {fmt(Number(sub.monthlyAmount))}/μήνα</div>
                    {sub.notes && <div className="text-xs text-gray-400 mt-0.5">{sub.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setSubsidyForm({ ...sub, monthlyAmount: String(sub.monthlyAmount), startsMonth: currentMonthKey() })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteSubsidy(sub.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {subsidyForm !== null ? (
                <div className="border border-indigo-100 rounded-xl p-4 space-y-3 bg-indigo-50/30">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Όνομα φορέα</label>
                    <input
                      value={subsidyForm.name ?? ''}
                      onChange={e => setSubsidyForm({ ...subsidyForm, name: e.target.value })}
                      placeholder="π.χ. Alpha Bank, ΕΣΠΑ Voucher"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Τύπος</label>
                      <select
                        value={subsidyForm.subsidyType ?? 'bank'}
                        onChange={e => setSubsidyForm({ ...subsidyForm, subsidyType: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      >
                        {Object.entries(SUBSIDY_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Ποσό/μήνα (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={subsidyForm.monthlyAmount ?? ''}
                        onChange={e => setSubsidyForm({ ...subsidyForm, monthlyAmount: e.target.value })}
                        placeholder="250.00"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Σημειώσεις</label>
                    <input
                      value={subsidyForm.notes ?? ''}
                      onChange={e => setSubsidyForm({ ...subsidyForm, notes: e.target.value })}
                      placeholder="π.χ. Πληρώνει το 50% των διδάκτρων"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ισχύει από</label>
                    <input
                      type="month"
                      value={subsidyForm.startsMonth || currentMonthKey()}
                      onChange={e => setSubsidyForm({ ...subsidyForm, startsMonth: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSubsidyForm(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                      Ακύρωση
                    </button>
                    <button onClick={saveSubsidy} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                      Αποθήκευση
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSubsidyForm({ name: '', subsidyType: 'bank', monthlyAmount: '', notes: '', startsMonth: currentMonthKey() })}
                  className="flex items-center gap-2 w-full p-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-indigo-200 hover:text-indigo-500 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Προσθήκη Επιδότησης
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
