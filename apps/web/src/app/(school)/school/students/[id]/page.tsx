'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { studentsApi, billingApi, classesApi, activitiesApi, extraServicesApi, medicationRequestsApi, studentFormsApi, broadcastsApi, schoolEventsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  ArrowLeft, Phone, Mail, MapPin, Droplets,
  BookOpen, ClipboardList, Users, AlertCircle,
  Zap, Bus, Clock, Camera, Plus, Pencil, Trash2, X, Check,
  Bell, Pill, FileText, Activity, ChevronDown, ChevronUp, Send, Home, CalendarDays,
} from 'lucide-react';

const MapPicker = dynamic(() => import('@/components/MapPickerInner'), { ssr: false, loading: () => <div className="h-[260px] rounded-xl bg-gray-100 animate-pulse" /> });

const TABS = [
  { key: 'general', label: 'Γενικά' },
  { key: 'health', label: 'Υγεία' },
  { key: 'parents', label: 'Γονείς' },
  { key: 'bus', label: 'Σχολικό' },
  { key: 'activities', label: 'Δραστηριότητες' },
  { key: 'events', label: 'Εκδηλώσεις' },
  { key: 'classes', label: 'Ιστορικό Τάξεων' },
  { key: 'diary', label: 'Ημερολόγιο' },
  { key: 'billing', label: 'Οικονομικά' },
  { key: 'records', label: 'Αρχεία' },
];

const ACTIVITY_TYPES: Record<string, string> = {
  excursion: 'Εκδρομή', sport: 'Αθλητισμός', art: 'Τέχνες',
  music: 'Μουσική', language: 'Γλώσσα', other: 'Άλλο',
};
const SERVICE_TYPES: Record<string, string> = {
  bus: 'Σχολικό Λεωφορείο', aftercare: 'Ολοήμερο', other: 'Άλλο',
};
const ACT_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Αναμονή',      color: 'bg-yellow-100 text-yellow-800' },
  approved:  { label: 'Εγκρίθηκε',    color: 'bg-green-100 text-green-800' },
  rejected:  { label: 'Απορρίφθηκε',  color: 'bg-red-100 text-red-800' },
};
const DAY_LABELS: Record<string, string> = {
  mon: 'Δευ', tue: 'Τρι', wed: 'Τετ', thu: 'Πεμ', fri: 'Παρ',
};

const MOOD_EMOJI: Record<string, string> = {
  χαρούμενος: '😊', happy: '😊',
  ήρεμος: '😌', calm: '😌',
  κουρασμένος: '😴', tired: '😴',
  λυπημένος: '😢', sad: '😢',
  αγχωμένος: '😟', anxious: '😟',
};

const MEAL_LABELS: Record<string, { label: string; color: string }> = {
  good: { label: 'Έφαγε', color: 'bg-green-100 text-green-700' },
  partial: { label: 'Μερικώς', color: 'bg-amber-100 text-amber-700' },
  refused: { label: 'Αρνήθηκε', color: 'bg-red-100 text-red-700' },
};

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const STATUS_LABELS: Record<string, string> = {
  paid: 'Εξοφλήθη', unpaid: 'Εκκρεμεί', overdue: 'Ληξιπρόθεσμο', cancelled: 'Ακυρωθέν',
};

const EVENT_TYPES_GR: Record<string, string> = {
  excursion: 'Εκδρομή', theater: 'Θεατρικό', sports: 'Αθλητισμός',
  cultural: 'Πολιτισμός', educational: 'Εκπαιδευτικό', other: 'Άλλο',
};
const ENROLLMENT_STATUS_META: Record<string, { label: string; color: string }> = {
  pending_consent:   { label: 'Αναμ. Συναίνεση',  color: 'bg-yellow-100 text-yellow-800' },
  consent_given:     { label: 'Συναίνεση',         color: 'bg-blue-100 text-blue-700' },
  consent_declined:  { label: 'Απόρριψη',          color: 'bg-red-100 text-red-700' },
  pending_payment:   { label: 'Αναμ. Πληρωμή',    color: 'bg-orange-100 text-orange-700' },
  paid:              { label: 'Πληρωμένο',         color: 'bg-green-100 text-green-700' },
};

function age(dob?: string) {
  if (!dob) return null;
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
  return years > 0 ? `${years} ετών` : `${months} μηνών`;
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('general');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'school_admin';
  const [billingSummary, setBillingSummary] = useState<{ totalDue: number; totalPaid: number } | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifForm, setNotifForm] = useState({ title: '', body: '' });
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifSent, setNotifSent] = useState(false);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState(false);
  const [questionnaireForm, setQuestionnaireForm] = useState<any>(null);
  const [savingQuestionnaire, setSavingQuestionnaire] = useState(false);
  const [charges, setCharges] = useState<any[]>([]);
  const [oneTimeCharges, setOneTimeCharges] = useState<any[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [subsidies, setSubsidies] = useState<any[]>([]);
  const [subsidyForm, setSubsidyForm] = useState<any>(null);
  const [savingSubsidy, setSavingSubsidy] = useState(false);
  const [oneTimeForm, setOneTimeForm] = useState<any>(null);
  const [savingOneTime, setSavingOneTime] = useState(false);
  const [levelFees, setLevelFees] = useState<any[]>([]);
  const [feeOverride, setFeeOverride] = useState<any>(null);
  const [feeForm, setFeeForm] = useState<any>(null);
  const [savingFee, setSavingFee] = useState(false);
  const [payingChargeId, setPayingChargeId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState<any>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docYear, setDocYear] = useState('');
  const docInputRef = useRef<HTMLInputElement>(null);

  // Activities & services modals
  const [allActivities, setAllActivities] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [showEnrollActivity, setShowEnrollActivity] = useState(false);
  const [showAssignService, setShowAssignService] = useState(false);
  const [enrollingActivity, setEnrollingActivity] = useState(false);
  const [assigningService, setAssigningService] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedServiceFull, setSelectedServiceFull] = useState<any>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [pickupContact, setPickupContact] = useState('');
  // Full bus assignment form state
  const [assignServiceMode, setAssignServiceMode] = useState<'both'|'pickup'|'dropoff'>('both');
  const [assignDropoffContact, setAssignDropoffContact] = useState('');
  const [assignPickupTime, setAssignPickupTime] = useState('');
  const [assignDropoffTime, setAssignDropoffTime] = useState('');
  const [assignHomeAddress, setAssignHomeAddress] = useState('');
  const [assignHomeLat, setAssignHomeLat] = useState<number|undefined>();
  const [assignHomeLng, setAssignHomeLng] = useState<number|undefined>();
  const [assignPickupPersons, setAssignPickupPersons] = useState<{name:string;phone?:string;relation?:string}[]>([]);
  const [assignNotes, setAssignNotes] = useState('');
  const [assignDiscount, setAssignDiscount] = useState('');
  const [geocodingAddr, setGeocodingAddr] = useState(false);
  const [editingSs, setEditingSs] = useState<{ ssId: string; serviceId: string } | null>(null);

  const [markingEventPayment, setMarkingEventPayment] = useState<string | null>(null);
  const [updatingEnrollment, setUpdatingEnrollment] = useState<string | null>(null);

  // Sibling linking
  const [showLinkSibling, setShowLinkSibling] = useState(false);
  const [siblingSearch, setSiblingSearch] = useState('');
  const [siblingResults, setSiblingResults] = useState<any[]>([]);
  const [linkingSibling, setLinkingSibling] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);

  // Parent management
  const [parentForm, setParentForm] = useState<any>(null);
  const [savingParent, setSavingParent] = useState(false);
  const [showAddParent, setShowAddParent] = useState(false);

  const SUBSIDY_TYPES: Record<string, string> = {
    bank: 'Τράπεζα', voucher: 'Voucher/Επίδομα', other: 'Άλλο',
  };

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      studentsApi.get(schoolId, id),
      classesApi.list(schoolId),
    ]).then(([data, cls]: any) => {
      setStudent(data);
      setClasses(Array.isArray(cls) ? cls : []);
      setLoading(false);
    }).catch(() => setLoading(false));
    // Load billing summary, medications, questionnaire in background
    const curYear = new Date().getFullYear();
    Promise.all([
      billingApi.getStudentCharges(schoolId, id).catch(() => []),
      billingApi.getOneTimeCharges(schoolId, { studentId: id }).catch(() => []),
      medicationRequestsApi.list(schoolId, { studentId: id }).catch(() => []),
      studentFormsApi.get(schoolId, id, curYear).catch(() => null),
    ]).then(([ch, otc, meds, qForm]: any) => {
      const monthly = Array.isArray(ch) ? ch : [];
      const oneTime = Array.isArray(otc) ? otc : [];
      const totalDue = monthly.reduce((s: number, c: any) => s + Number(c.totalDue ?? 0), 0)
        + oneTime.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
      const totalPaid = [...monthly, ...oneTime].reduce((s: number, c: any) => s + Number(c.paidAmount ?? 0), 0);
      setBillingSummary({ totalDue, totalPaid });
      setMedications(Array.isArray(meds) ? meds.filter((m: any) => m.status !== 'completed') : []);
      setQuestionnaire(qForm ?? null);
    });
  }, [schoolId, id]);

  const loadBillingData = async () => {
    if (!schoolId) return;
    setChargesLoading(true);
    try {
      const [ch, subs, otc, lf, fee] = await Promise.all([
        billingApi.getStudentCharges(schoolId, id).catch(() => []),
        billingApi.getSubsidies(schoolId, id).catch(() => []),
        billingApi.getOneTimeCharges(schoolId, { studentId: id }).catch(() => []),
        billingApi.getLevelFees(schoolId).catch(() => []),
        billingApi.getStudentFee(schoolId, id).catch(() => null),
      ]);
      setCharges(Array.isArray(ch) ? ch : []);
      setSubsidies(Array.isArray(subs) ? subs : []);
      setOneTimeCharges(Array.isArray(otc) ? otc : []);
      setLevelFees(Array.isArray(lf) ? lf : []);
      setFeeOverride(fee && !fee.message ? fee : null);
    } finally {
      setChargesLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'billing') return;
    loadBillingData();
  }, [tab, schoolId, id]);

  const loadDocuments = async (year?: string) => {
    setDocsLoading(true);
    try {
      const docs: any = await studentsApi.getDocuments(schoolId, id, year || undefined);
      setDocuments(Array.isArray(docs) ? docs : []);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'records') return;
    loadDocuments(docYear);
  }, [tab, schoolId, id, docYear]);

  useEffect(() => {
    if ((tab !== 'bus' && tab !== 'activities') || !schoolId) return;
    Promise.all([
      activitiesApi.list(schoolId),
      extraServicesApi.list(schoolId),
    ]).then(([acts, svcs]: any) => {
      setAllActivities(Array.isArray(acts) ? acts : []);
      setAllServices(Array.isArray(svcs) ? svcs : []);
    });
  }, [tab, schoolId]);

  useEffect(() => {
    if (!showLinkSibling || allStudents.length > 0 || !schoolId) return;
    studentsApi.list(schoolId).then((s: any) => {
      setAllStudents(Array.isArray(s) ? s.filter((st: any) => st.id !== id) : []);
    });
  }, [showLinkSibling, schoolId]);

  useEffect(() => {
    if (!siblingSearch.trim()) { setSiblingResults([]); return; }
    const q = siblingSearch.toLowerCase();
    setSiblingResults(allStudents.filter(s => s.fullName.toLowerCase().includes(q)).slice(0, 8));
  }, [siblingSearch, allStudents]);

  async function handleSaveFee() {
    if (!feeForm) return;
    setSavingFee(true);
    try {
      if (feeForm.mode === 'level') {
        await billingApi.deleteStudentFee(schoolId, id).catch(() => null);
      } else if (feeForm.mode === 'percent') {
        await billingApi.upsertStudentFee(schoolId, id, {
          discountPct: parseFloat(feeForm.percent) || 0,
          fixedAmount: null,
          reason: feeForm.reason || undefined,
        });
      } else {
        await billingApi.upsertStudentFee(schoolId, id, {
          fixedAmount: parseFloat(feeForm.fixed) || 0,
          discountPct: null,
          reason: feeForm.reason || undefined,
        });
      }
      setFeeForm(null);
      await loadBillingData();
    } finally {
      setSavingFee(false);
    }
  }

  async function handleSaveSubsidy() {
    if (!subsidyForm) return;
    setSavingSubsidy(true);
    try {
      if (subsidyForm.id) {
        await billingApi.updateSubsidy(schoolId, id, subsidyForm.id, subsidyForm);
      } else {
        await billingApi.createSubsidy(schoolId, id, subsidyForm);
      }
      setSubsidyForm(null);
      await loadBillingData();
    } finally {
      setSavingSubsidy(false);
    }
  }

  async function handleDeleteSubsidy(subsidyId: string) {
    await billingApi.deleteSubsidy(schoolId, id, subsidyId);
    await loadBillingData();
  }

  async function handleSaveOneTime() {
    if (!oneTimeForm) return;
    setSavingOneTime(true);
    try {
      if (oneTimeForm.id) {
        await billingApi.updateOneTimeCharge(schoolId, oneTimeForm.id, oneTimeForm);
      } else {
        await billingApi.createOneTimeCharge(schoolId, { ...oneTimeForm, studentId: id });
      }
      setOneTimeForm(null);
      await loadBillingData();
    } finally {
      setSavingOneTime(false);
    }
  }

  async function handleDeleteOneTime(chargeId: string) {
    await billingApi.deleteOneTimeCharge(schoolId, chargeId);
    await loadBillingData();
  }

  async function handlePayOneTime(charge: any, paidAmount: number) {
    await billingApi.updateOneTimeCharge(schoolId, charge.id, { paidAmount });
    await loadBillingData();
  }

  function openEditInfo() {
    const currentClassId = student.enrollments?.[0]?.classId ?? '';
    const currentClass = classes.find((c: any) => c.id === currentClassId);
    setInfoForm({
      fullName: student.fullName,
      dob: student.dob ? new Date(student.dob).toISOString().slice(0, 10) : '',
      address: student.address ?? '',
      allergies: student.allergies ?? '',
      bloodType: student.bloodType ?? '',
      notes: student.notes ?? '',
      classId: currentClassId,
      levelId: currentClass?.level?.id ?? '',
    });
    setEditingInfo(true);
  }

  async function handleSaveInfo() {
    if (!infoForm) return;
    setSavingInfo(true);
    try {
      const updated: any = await studentsApi.update(schoolId, id, {
        fullName: infoForm.fullName,
        dob: infoForm.dob || undefined,
        address: infoForm.address || undefined,
        allergies: infoForm.allergies || undefined,
        bloodType: infoForm.bloodType || undefined,
        notes: infoForm.notes || undefined,
      });
      // Enroll in class if changed
      if (infoForm.classId && infoForm.classId !== student.enrollments?.[0]?.classId) {
        await studentsApi.enroll(schoolId, id, infoForm.classId);
      }
      setStudent((prev: any) => ({ ...prev, ...updated }));
      // Refresh full student data
      const fresh: any = await studentsApi.get(schoolId, id);
      setStudent(fresh);
      setEditingInfo(false);
    } finally {
      setSavingInfo(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Φόρτωση...</div>
  );
  if (!student) return (
    <div className="text-center py-20 text-gray-400">Ο μαθητής δεν βρέθηκε.</div>
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const result = await studentsApi.uploadAvatar(schoolId, id, file) as any;
      setStudent((prev: any) => ({ ...prev, avatarUrl: result.avatarUrl }));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const eventEnrOwed = (student?.eventEnrollments ?? [])
    .filter((e: any) => e.status === 'pending_payment')
    .reduce((s: number, e: any) => s + Number(e.event?.costPerChild ?? 0), 0);
  const owed = billingSummary
    ? Math.max(0, billingSummary.totalDue - billingSummary.totalPaid + eventEnrOwed)
    : null;

  const handleSendNotif = async () => {
    if (!notifForm.title.trim() || !notifForm.body.trim()) return;
    setSendingNotif(true);
    try {
      await broadcastsApi.send(schoolId, {
        title: notifForm.title,
        body: notifForm.body,
        targetType: 'student',
        targetStudentId: id,
      });
      setNotifSent(true);
      setNotifForm({ title: '', body: '' });
      setTimeout(() => { setNotifSent(false); setNotifOpen(false); }, 2000);
    } finally {
      setSendingNotif(false);
    }
  };

  // Derived status values from student data
  const busService = student?.studentServices?.find((ss: any) => ss.service?.serviceType === 'bus');
  const activeActivities = student?.activityRegistrations ?? [];
  const questionnaireSubmitted = questionnaire?.submittedAt != null;
  const currentClass = student?.enrollments?.[0]?.class;

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Επιστροφή
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="relative h-20 w-20 flex-shrink-0 group">
            {student.avatarUrl ? (
              <img
                src={student.avatarUrl}
                alt={student.fullName}
                className="h-20 w-20 rounded-2xl object-cover shadow-md"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                {student.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {isAdmin && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity disabled:cursor-wait"
                >
                  {uploadingAvatar
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera className="w-6 h-6 text-white" />
                  }
                </button>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{student.fullName}</h1>
            <div className="flex flex-wrap gap-3 mt-2">
              {student.dob && (
                <span className="text-sm text-gray-500">
                  {new Date(student.dob).toLocaleDateString('el-GR')} · {age(student.dob)}
                </span>
              )}
              {student.bloodType && (
                <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
                  <Droplets className="h-3.5 w-3.5" /> {student.bloodType}
                </span>
              )}
              {student.enrollments?.[0]?.class && (
                <span className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
                  <BookOpen className="h-3.5 w-3.5" /> {student.enrollments[0].class.name}
                </span>
              )}
            </div>
            {student.allergies && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg w-fit">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {student.allergies}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {owed !== null && owed > 0.005 && (
              <button
                onClick={() => setTab('billing')}
                className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-center hover:bg-red-100 transition-colors"
              >
                <div>
                  <div className="text-xs text-red-500 font-medium">Οφείλει</div>
                  <div className="text-lg font-bold text-red-600">€{owed.toFixed(2)}</div>
                </div>
              </button>
            )}
            {owed !== null && owed <= 0.005 && (billingSummary!.totalDue > 0 || eventEnrOwed > 0) && (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
                <Check className="w-4 h-4 text-green-600" />
                <div>
                  <div className="text-xs text-green-600 font-medium">Εξοφλημένος</div>
                  <div className="text-sm font-semibold text-green-700">€{billingSummary!.totalDue.toFixed(2)}</div>
                </div>
              </div>
            )}
            <button
              onClick={() => { setNotifOpen(o => !o); setNotifSent(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 bg-indigo-50 rounded-lg text-sm text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              <Bell className="h-3.5 w-3.5" /> Ειδοποίηση
            </button>
            {isAdmin && (
              <button
                onClick={openEditInfo}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Επεξεργασία
              </button>
            )}
          </div>
        </div>

        {/* Notification send panel */}
        {notifOpen && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {notifSent ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-3 text-sm font-medium">
                <Check className="w-4 h-4" /> Η ειδοποίηση εστάλη!
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 mb-2">Αποστολή ειδοποίησης στους γονείς του μαθητή</p>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Θέμα ειδοποίησης *"
                  value={notifForm.title}
                  onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))}
                />
                <textarea
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Κείμενο μηνύματος *"
                  value={notifForm.body}
                  onChange={e => setNotifForm(f => ({ ...f, body: e.target.value }))}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setNotifOpen(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ακύρωση</button>
                  <button
                    onClick={handleSendNotif}
                    disabled={sendingNotif || !notifForm.title.trim() || !notifForm.body.trim()}
                    className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingNotif ? 'Αποστολή...' : 'Αποστολή'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status chips bar ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Class */}
        {currentClass && (
          <button
            onClick={() => setTab('classes')}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 transition-colors text-sm"
          >
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <span className="font-medium text-gray-800">{currentClass.name}</span>
          </button>
        )}

        {/* Bus service */}
        {busService ? (
          <button
            onClick={() => setTab('bus')}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-emerald-200 shadow-sm hover:bg-emerald-50 transition-colors text-sm"
          >
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="22" height="14" rx="2"/>
              <path d="M1 9h22"/>
              <circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>
              <path d="M6 17H4v-4"/><path d="M18 17h2v-4"/>
              <path d="M8 9V3h8v6"/>
            </svg>
            <div className="text-left">
              <div className="font-medium text-emerald-700 leading-none">Σχολικό Λεωφορείο</div>
              {busService.route?.name && <div className="text-xs text-emerald-600 mt-0.5">{busService.route.name}{busService.stop?.name ? ` · ${busService.stop.name}` : ''}</div>}
            </div>
          </button>
        ) : (
          <button
            onClick={() => {
              setTab('bus');
              setSelectedServiceId('');
              setSelectedRouteId('');
              setSelectedStopId('');
              setPickupContact('');
              setSelectedServiceFull(null);
              setShowAssignService(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm text-sm hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
          >
            <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="22" height="14" rx="2"/>
              <path d="M1 9h22"/>
              <circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>
              <path d="M6 17H4v-4"/><path d="M18 17h2v-4"/>
              <path d="M8 9V3h8v6"/>
            </svg>
            <span className="text-gray-400 font-medium group-hover:text-indigo-600">+ Προσθήκη σχολικού</span>
          </button>
        )}

        {/* Activities */}
        {activeActivities.length > 0 && (
          <button
            onClick={() => setTab('activities')}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-violet-200 shadow-sm hover:bg-violet-50 transition-colors text-sm"
          >
            <Activity className="w-4 h-4 text-violet-500" />
            <span className="font-medium text-violet-700">{activeActivities.length} Δραστηριότητ{activeActivities.length === 1 ? 'α' : 'ες'}</span>
          </button>
        )}

        {/* Medications */}
        <button
          onClick={() => setTab('health')}
          className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border shadow-sm hover:opacity-80 transition-colors text-sm ${
            medications.length > 0 ? 'border-amber-200' : 'border-gray-100 opacity-50'
          }`}
        >
          <Pill className={`w-4 h-4 ${medications.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          <span className={`font-medium ${medications.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            {medications.length > 0 ? `${medications.length} Φάρμακ${medications.length === 1 ? 'ο' : 'α'}` : 'Χωρίς φάρμακα'}
          </span>
        </button>

        {/* Questionnaire */}
        <button
          onClick={() => setTab('health')}
          className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border shadow-sm hover:opacity-80 transition-colors text-sm ${
            questionnaireSubmitted ? 'border-blue-200' : 'border-amber-200'
          }`}
        >
          <FileText className={`w-4 h-4 ${questionnaireSubmitted ? 'text-blue-500' : 'text-amber-500'}`} />
          <span className={`font-medium ${questionnaireSubmitted ? 'text-blue-700' : 'text-amber-700'}`}>
            {questionnaireSubmitted ? 'Ερωτηματολόγιο ✓' : 'Ερωτηματολόγιο —'}
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Γενικά */}
      {tab === 'general' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Στοιχεία Μαθητή</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Ονοματεπώνυμο" value={student.fullName} />
              {student.dob && (
                <Row label="Ημερομηνία Γέννησης"
                  value={`${new Date(student.dob).toLocaleDateString('el-GR')} (${age(student.dob)})`} />
              )}
              {student.bloodType && <Row label="Ομάδα Αίματος" value={student.bloodType} />}
              {student.address && (
                <div className="flex gap-2 py-1 border-b border-gray-50">
                  <dt className="w-36 text-gray-500 flex-shrink-0 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Διεύθυνση
                  </dt>
                  <dd className="text-gray-800">{student.address}</dd>
                </div>
              )}
              {student.notes && <Row label="Σημειώσεις" value={student.notes} />}
            </dl>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Υγεία</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Ομάδα Αίματος" value={student.bloodType ?? '—'} />
              <Row label="Αλλεργίες" value={student.allergies ?? '—'} />
            </dl>
          </div>
        </div>
        {/* Class Instructions */}
        {(() => {
          const instructions = student.enrollments?.[0]?.class?.instructions ?? [];
          if (!instructions.length) return null;
          return (
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-6 mt-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-500" />
                Οδηγίες από το Σχολείο
              </h3>
              <div className="space-y-3">
                {instructions.map((instr: any) => (
                  <div key={instr.id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-3.5">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-800">{instr.title}</p>
                      {instr.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{instr.category}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{instr.content}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        </>
      )}

      {/* Tab: Υγεία */}
      {tab === 'health' && (
        <div className="space-y-6">
          {/* Questionnaire card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <FileText className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-gray-800">Ερωτηματολόγιο Υγείας</h3>
              {questionnaire?.submittedAt && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Υποβλήθηκε {new Date(questionnaire.submittedAt).toLocaleDateString('el-GR')}
                </span>
              )}
              {!questionnaire?.submittedAt && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Δεν έχει υποβληθεί</span>
              )}
              {isAdmin && !editingQuestionnaire && (
                <button
                  onClick={() => {
                    setQuestionnaireForm({
                      foodAllergies: questionnaire?.foodAllergies ?? '',
                      medicationAllergies: questionnaire?.medicationAllergies ?? '',
                      chronicConditions: questionnaire?.chronicConditions ?? '',
                      dietaryNotes: questionnaire?.dietaryNotes ?? '',
                      emergencyContact: questionnaire?.emergencyContact ?? '',
                      pediatricianName: questionnaire?.pediatricianName ?? '',
                      pediatricianPhone: questionnaire?.pediatricianPhone ?? '',
                      additionalNotes: questionnaire?.additionalNotes ?? '',
                    });
                    setEditingQuestionnaire(true);
                  }}
                  className="ml-auto flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50"
                >
                  <Pencil className="h-3.5 w-3.5" /> Επεξεργασία
                </button>
              )}
            </div>
            {editingQuestionnaire && questionnaireForm ? (
              <div className="p-6 space-y-4">
                {([
                  { key: 'foodAllergies', label: 'Αλλεργίες τροφίμων', multi: false },
                  { key: 'medicationAllergies', label: 'Αλλεργίες φαρμάκων', multi: false },
                  { key: 'chronicConditions', label: 'Χρόνιες παθήσεις / ιδιαίτερες ανάγκες', multi: true },
                  { key: 'dietaryNotes', label: 'Διατροφικές ιδιαιτερότητες', multi: false },
                  { key: 'emergencyContact', label: 'Επείγουσα επαφή (εκτός γονέων)', multi: false },
                  { key: 'pediatricianName', label: 'Παιδίατρος — Ονοματεπώνυμο', multi: false },
                  { key: 'pediatricianPhone', label: 'Παιδίατρος — Τηλέφωνο', multi: false },
                  { key: 'additionalNotes', label: 'Επιπλέον πληροφορίες', multi: true },
                ] as { key: string; label: string; multi: boolean }[]).map(({ key, label, multi }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    {multi ? (
                      <textarea
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                        value={questionnaireForm[key] ?? ''}
                        onChange={e => setQuestionnaireForm((f: any) => ({ ...f, [key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={questionnaireForm[key] ?? ''}
                        onChange={e => setQuestionnaireForm((f: any) => ({ ...f, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setEditingQuestionnaire(false); setQuestionnaireForm(null); }}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Ακύρωση
                  </button>
                  <button
                    disabled={savingQuestionnaire}
                    onClick={async () => {
                      setSavingQuestionnaire(true);
                      try {
                        const curYear = new Date().getFullYear();
                        const updated = await studentFormsApi.upsert(schoolId, id, curYear, questionnaireForm);
                        setQuestionnaire(updated ?? questionnaireForm);
                        setEditingQuestionnaire(false);
                        setQuestionnaireForm(null);
                      } finally {
                        setSavingQuestionnaire(false);
                      }
                    }}
                    className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingQuestionnaire ? 'Αποθήκευση...' : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                {!questionnaire ? (
                  <p className="text-sm text-gray-400 text-center py-4">Δεν έχει συμπληρωθεί ερωτηματολόγιο.</p>
                ) : (
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    {([
                      { key: 'foodAllergies', label: 'Αλλεργίες τροφίμων' },
                      { key: 'medicationAllergies', label: 'Αλλεργίες φαρμάκων' },
                      { key: 'chronicConditions', label: 'Χρόνιες παθήσεις' },
                      { key: 'dietaryNotes', label: 'Διατροφή' },
                      { key: 'emergencyContact', label: 'Επείγουσα επαφή' },
                      { key: 'pediatricianName', label: 'Παιδίατρος' },
                      { key: 'pediatricianPhone', label: 'Τηλ. Παιδιάτρου' },
                      { key: 'additionalNotes', label: 'Επιπλέον πληροφορίες' },
                    ] as { key: string; label: string }[]).map(({ key, label }) => (
                      questionnaire[key] ? (
                        <div key={key}>
                          <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
                          <dd className="text-gray-800 whitespace-pre-line">{questionnaire[key]}</dd>
                        </div>
                      ) : null
                    ))}
                    {!Object.keys(questionnaire).some(k => questionnaire[k] && k !== 'submittedAt' && k !== 'id' && k !== 'studentId' && k !== 'schoolId' && k !== 'year') && (
                      <div className="col-span-2 text-center text-gray-400 py-2">Δεν υπάρχουν συμπληρωμένα πεδία.</div>
                    )}
                  </dl>
                )}
              </div>
            )}
          </div>

          {/* Medications card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <Pill className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-gray-800">Φάρμακα</h3>
              <span className="text-xs text-gray-400">{medications.length} ενεργά αιτήματα</span>
            </div>
            {medications.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">Δεν υπάρχουν ενεργά αιτήματα φαρμάκων.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {medications.map((med: any) => (
                  <div key={med.id} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Pill className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{med.medicationName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            med.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            med.status === 'approved' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {med.status === 'pending' ? 'Αναμονή' : med.status === 'approved' ? 'Εγκρίθηκε' : med.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                          <span>Δόση: {med.dose}</span>
                          <span>Συχνότητα: {med.frequency}</span>
                          <span>Από: {new Date(med.startDate).toLocaleDateString('el-GR')}</span>
                          {med.endDate && <span>Έως: {new Date(med.endDate).toLocaleDateString('el-GR')}</span>}
                        </div>
                        {med.reason && <p className="text-xs text-gray-400 mt-1">{med.reason}</p>}
                        {med.doctorNotes && <p className="text-xs text-indigo-600 mt-1 italic">Ιατρικές οδηγίες: {med.doctorNotes}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Γονείς */}
      {tab === 'parents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700">Γονείς / Κηδεμόνες</h3>
            {isAdmin && (
              <button
                onClick={() => { setParentForm({ fullName: '', email: '', phone: '', relation: 'γονέας', isPrimary: false }); setShowAddParent(true); }}
                className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium hover:text-indigo-800 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50"
              >
                <Plus className="h-3.5 w-3.5" /> Προσθήκη Γονέα
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {student.parents?.map((p: any) => (
              <div key={p.userId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                    {p.user.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-900">{p.user.fullName}</div>
                        <div className="text-xs text-indigo-600 font-medium mt-0.5">
                          {p.relation} {p.isPrimary ? '· Κύριος κηδεμόνας' : ''}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { setParentForm({ userId: p.userId, fullName: p.user.fullName, email: p.user.email || '', phone: p.user.phone || '', relation: p.relation, isPrimary: p.isPrimary }); setShowAddParent(false); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            title="Επεξεργασία"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('Να αφαιρεθεί ο γονέας από τον μαθητή;')) return;
                              await studentsApi.removeParent(schoolId, id, p.userId);
                              const fresh: any = await studentsApi.get(schoolId, id);
                              setStudent(fresh);
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                            title="Αφαίρεση"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                      {p.user.email && !p.user.email.includes('@omnedu.placeholder') && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-gray-400" /> {p.user.email}
                        </div>
                      )}
                      {p.user.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-gray-400" /> {p.user.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" /> Αδέρφια στο σχολείο
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setShowLinkSibling(true)}
                  className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Σύνδεση
                </button>
              )}
            </div>
            {(!student.siblings || student.siblings.length === 0) ? (
              <p className="text-sm text-gray-400">Δεν υπάρχουν αδέρφια καταχωρημένα.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {student.siblings.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-xl">
                    <a href={`/school/students/${s.id}`} className="flex items-center gap-2 hover:opacity-80">
                      <div className="h-7 w-7 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {s.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-indigo-800">{s.fullName}</span>
                      {s.dob && <span className="text-xs text-indigo-500">{age(s.dob)}</span>}
                    </a>
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          await studentsApi.unlinkSibling(schoolId, id, s.id);
                          const fresh: any = await studentsApi.get(schoolId, id);
                          setStudent(fresh);
                        }}
                        className="ml-1 text-indigo-300 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Δραστηριότητες */}
      {tab === 'activities' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <Zap className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-gray-800">Δραστηριότητες</h3>
              <span className="text-xs text-gray-400">{student.activityRegistrations?.length ?? 0} εγγραφές</span>
              {isAdmin && (
                <button
                  onClick={() => { setSelectedActivityId(''); setShowEnrollActivity(true); }}
                  className="ml-auto flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Εγγραφή
                </button>
              )}
            </div>
            {!student.activityRegistrations?.length ? (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">Δεν υπάρχουν εγγραφές σε δραστηριότητες.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {student.activityRegistrations.map((reg: any) => (
                  <div key={reg.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{reg.activity.title}</p>
                      <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                        <span>{ACTIVITY_TYPES[reg.activity.activityType] ?? reg.activity.activityType}</span>
                        {reg.activity.monthlyCost != null && <span>{reg.activity.monthlyCost}€/μήνα</span>}
                        {reg.activity.oneTimeCost != null && <span>{reg.activity.oneTimeCost}€ εφάπαξ</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${ACT_STATUS[reg.status]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                        {ACT_STATUS[reg.status]?.label ?? reg.status}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            await activitiesApi.removeRegistration(schoolId, reg.activity.id, reg.id);
                            const fresh: any = await studentsApi.get(schoolId, id);
                            setStudent(fresh);
                          }}
                          className="p-1 text-gray-300 hover:text-red-500 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Σχολικό */}
      {tab === 'bus' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <Bus className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-gray-800">Σχολικό</h3>
              <span className="text-xs text-gray-400">{(student.studentServices ?? []).filter((ss: any) => ss.service?.serviceType === 'bus').length} εγγραφές</span>
              {isAdmin && (
                <button
                  onClick={() => { setSelectedServiceId(''); setSelectedRouteId(''); setSelectedStopId(''); setPickupContact(''); setSelectedServiceFull(null); setShowAssignService(true); }}
                  className="ml-auto flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Ανάθεση
                </button>
              )}
            </div>
            {!(student.studentServices ?? []).some((ss: any) => ss.service?.serviceType === 'bus') ? (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">Το παιδί δεν είναι γραμμένο σε σχολικό.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {student.studentServices.filter((ss: any) => ss.service?.serviceType === 'bus').map((ss: any) => {
                  const dailyTimes = ss.dailyTimes as Record<string, { pickup?: string; dropoff?: string }> | null;
                  const hasDailyTimes = dailyTimes && Object.values(dailyTimes).some((d: any) => d?.pickup || d?.dropoff);
                  const pickupPersons: { name: string; phone?: string; relation?: string }[] = ss.pickupPersons ?? [];
                  const isBus = ss.service.serviceType === 'bus';
                  const serviceMode: string = ss.serviceMode ?? 'both';
                  const serviceModeLabel = serviceMode === 'pickup' ? 'Μόνο Παραλαβή' : serviceMode === 'dropoff' ? 'Μόνο Παράδοση' : 'Παραλαβή & Παράδοση';
                  const serviceModeColor = serviceMode === 'pickup' ? 'bg-green-50 text-green-700' : serviceMode === 'dropoff' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700';
                  const pickupTime = ss.pickupTime ?? ss.stop?.pickupTime;
                  const dropoffTime = ss.dropoffTime ?? ss.stop?.dropoffTime;
                  const showPickup = serviceMode === 'pickup' || serviceMode === 'both';
                  const showDropoff = serviceMode === 'dropoff' || serviceMode === 'both';
                  return (
                    <div key={ss.id} className="px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                          <Bus className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Header row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{ss.service.name}</p>
                            <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                              {SERVICE_TYPES[ss.service.serviceType] ?? ss.service.serviceType}
                            </span>
                            {isBus && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${serviceModeColor}`}>
                                {serviceModeLabel}
                              </span>
                            )}
                            {(() => {
                              const mode = ss.serviceMode ?? 'both';
                              const base = mode === 'pickup'
                                ? Number(ss.service.pickupCost ?? ss.service.monthlyCost ?? 0)
                                : mode === 'dropoff'
                                ? Number(ss.service.dropoffCost ?? ss.service.monthlyCost ?? 0)
                                : Number(ss.service.monthlyCost ?? 0);
                              const discount = Number(ss.discountAmount ?? 0);
                              const net = Math.max(0, base - discount);
                              if (!base && !discount) return null;
                              return (
                                <span className="ml-auto text-right">
                                  <span className="text-sm font-semibold text-gray-800">{net.toFixed(0)}€/μήνα</span>
                                  {discount > 0 && (
                                    <span className="block text-xs text-orange-700">από {base.toFixed(0)}€ · έκπτωση −{discount.toFixed(0)}€</span>
                                  )}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Route & Stop */}
                          {(ss.route || ss.stop) && (
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                              {ss.route && <span className="flex items-center gap-1.5"><Bus className="w-3 h-3 text-gray-400" />{ss.route.name}</span>}
                              {ss.stop && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3 text-gray-400" />{ss.stop.name}
                                  {ss.stop.address && <span className="text-gray-400">· {ss.stop.address}</span>}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Home address */}
                          {ss.homeAddress && (
                            <div className="flex items-start gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                              <Home className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <span>{ss.homeAddress}</span>
                            </div>
                          )}

                          {/* Times — grid for pickup/dropoff */}
                          {isBus && !hasDailyTimes && (pickupTime || dropoffTime) && (
                            <div className="grid grid-cols-2 gap-2">
                              {showPickup && pickupTime && (
                                <div className="bg-green-50 rounded-lg px-3 py-2.5">
                                  <p className="text-xs text-green-600 font-medium mb-0.5">Παραλαβή</p>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-green-600" />
                                    <span className="text-sm font-semibold text-green-800">{pickupTime}</span>
                                  </div>
                                  {ss.pickupContact && (
                                    <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                                      <Users className="w-3 h-3" />{ss.pickupContact}
                                    </p>
                                  )}
                                </div>
                              )}
                              {showDropoff && dropoffTime && (
                                <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                                  <p className="text-xs text-blue-600 font-medium mb-0.5">Παράδοση</p>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-sm font-semibold text-blue-800">{dropoffTime}</span>
                                  </div>
                                  {ss.dropoffContact && (
                                    <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                                      <Users className="w-3 h-3" />{ss.dropoffContact}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Daily times */}
                          {hasDailyTimes && (
                            <div className="flex flex-wrap gap-2">
                              {(['mon','tue','wed','thu','fri'] as const).filter(d => dailyTimes?.[d]).map(d => (
                                <span key={d} className="text-xs bg-gray-50 border border-gray-100 rounded-md px-2 py-1">
                                  <span className="font-medium text-gray-600">{DAY_LABELS[d]}</span>
                                  {dailyTimes?.[d]?.pickup && <span className="text-green-700 ml-1">↑{dailyTimes[d]!.pickup}</span>}
                                  {dailyTimes?.[d]?.dropoff && <span className="text-blue-700 ml-1">↓{dailyTimes[d]!.dropoff}</span>}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Contact persons if no times grid shown */}
                          {isBus && !pickupTime && !dropoffTime && (ss.pickupContact || ss.dropoffContact) && (
                            <div className="flex flex-wrap gap-2">
                              {ss.pickupContact && (
                                <span className="text-xs bg-green-50 text-green-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                                  <Users className="w-3 h-3" />Παραλαβή: {ss.pickupContact}
                                </span>
                              )}
                              {ss.dropoffContact && (
                                <span className="text-xs bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                                  <Users className="w-3 h-3" />Παράδοση: {ss.dropoffContact}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Authorized pickup persons */}
                          {pickupPersons.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1.5">Εξουσιοδοτημένα άτομα παραλαβής</p>
                              <div className="flex flex-wrap gap-2">
                                {pickupPersons.map((p, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-xs bg-white border border-gray-100 shadow-sm rounded-lg px-2.5 py-1.5">
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                      <span className="text-indigo-600 font-bold text-[9px]">{p.name.charAt(0)}</span>
                                    </div>
                                    <span className="font-medium text-gray-700">{p.name}</span>
                                    {p.relation && <span className="text-gray-400">· {p.relation}</span>}
                                    {p.phone && <span className="text-gray-400">· {p.phone}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {ss.notes && <p className="text-xs text-gray-400 italic">{ss.notes}</p>}
                        </div>
                        {isAdmin && (
                          <div className="flex flex-col gap-1 self-start mt-0.5 shrink-0">
                            <button
                              onClick={async () => {
                                const svcFull: any = await extraServicesApi.get(schoolId, ss.service.id).catch(() => null);
                                setSelectedServiceId(ss.service.id);
                                setSelectedServiceFull(svcFull);
                                setSelectedRouteId(ss.route?.id ?? '');
                                setSelectedStopId(ss.stop?.id ?? '');
                                setAssignServiceMode(ss.serviceMode ?? 'both');
                                setPickupContact(ss.pickupContact ?? '');
                                setAssignDropoffContact(ss.dropoffContact ?? '');
                                setAssignPickupTime(ss.pickupTime ?? '');
                                setAssignDropoffTime(ss.dropoffTime ?? '');
                                setAssignHomeAddress(ss.homeAddress ?? '');
                                setAssignHomeLat(ss.homeLat ? Number(ss.homeLat) : undefined);
                                setAssignHomeLng(ss.homeLng ? Number(ss.homeLng) : undefined);
                                setAssignPickupPersons(ss.pickupPersons ?? []);
                                setAssignDiscount(ss.discountAmount != null ? String(ss.discountAmount) : '');
                                setAssignNotes(ss.notes ?? '');
                                setEditingSs({ ssId: ss.id, serviceId: ss.service.id });
                                setShowAssignService(true);
                              }}
                              className="p-1.5 text-gray-300 hover:text-indigo-500 rounded"
                              title="Επεξεργασία"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Να αφαιρεθεί αυτή η παροχή;')) return;
                                const svc = allServices.find((s: any) => s.id === ss.service.id) ?? { id: ss.service.id };
                                await extraServicesApi.removeStudentService(schoolId, svc.id, ss.id);
                                const fresh: any = await studentsApi.get(schoolId, id);
                                setStudent(fresh);
                              }}
                              className="p-1.5 text-gray-300 hover:text-red-500 rounded"
                              title="Διαγραφή"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Εκδηλώσεις */}
      {tab === 'events' && (
        <div className="space-y-4">
          {!student.eventEnrollments?.length ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              Δεν υπάρχουν εγγραφές σε εκδηλώσεις.
            </div>
          ) : student.eventEnrollments.map((enr: any) => (
            <div key={enr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">{enr.event.title}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ENROLLMENT_STATUS_META[enr.status]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                      {ENROLLMENT_STATUS_META[enr.status]?.label ?? enr.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-gray-500">
                    {enr.event.eventDate && (
                      <span>{new Date(enr.event.eventDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    )}
                    <span>{EVENT_TYPES_GR[enr.event.eventType] ?? enr.event.eventType}</span>
                    {enr.event.costPerChild > 0 && <span className="font-semibold text-gray-700">€{enr.event.costPerChild}</span>}
                    {enr.parentConsentAt && <span className="text-green-600">Συναίνεση: {new Date(enr.parentConsentAt).toLocaleDateString('el-GR')}</span>}
                    {enr.paidAt && <span className="text-green-600">Πληρωμή: {new Date(enr.paidAt).toLocaleDateString('el-GR')}</span>}
                  </div>
                </div>
              </div>

              {/* Admin action buttons */}
              {isAdmin && (
                <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
                  {enr.status === 'pending_consent' && (
                    <>
                      <button
                        onClick={async () => {
                          setUpdatingEnrollment(enr.id);
                          try {
                            const newStatus = enr.event.costPerChild > 0 ? 'pending_payment' : 'consent_given';
                            await schoolEventsApi.adminUpdateEnrollment(schoolId, enr.eventId, enr.id, newStatus);
                            const fresh: any = await studentsApi.get(schoolId, id);
                            setStudent(fresh);
                          } finally { setUpdatingEnrollment(null); }
                        }}
                        disabled={updatingEnrollment === enr.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Συναίνεση Γονέα
                      </button>
                      <button
                        onClick={async () => {
                          setUpdatingEnrollment(enr.id);
                          try {
                            await schoolEventsApi.adminUpdateEnrollment(schoolId, enr.eventId, enr.id, 'consent_declined');
                            const fresh: any = await studentsApi.get(schoolId, id);
                            setStudent(fresh);
                          } finally { setUpdatingEnrollment(null); }
                        }}
                        disabled={updatingEnrollment === enr.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Άρνηση
                      </button>
                    </>
                  )}
                  {enr.status === 'pending_payment' && (
                    <button
                      onClick={async () => {
                        setUpdatingEnrollment(enr.id);
                        try {
                          await schoolEventsApi.adminUpdateEnrollment(schoolId, enr.eventId, enr.id, 'paid');
                          const fresh: any = await studentsApi.get(schoolId, id);
                          setStudent(fresh);
                        } finally { setUpdatingEnrollment(null); }
                      }}
                      disabled={updatingEnrollment === enr.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Εξόφληση
                    </button>
                  )}
                  {(enr.status === 'paid' || enr.status === 'consent_given') && (
                    <button
                      onClick={async () => {
                        setUpdatingEnrollment(enr.id);
                        try {
                          const prev = enr.status === 'paid' ? 'pending_payment' : 'pending_consent';
                          await schoolEventsApi.adminUpdateEnrollment(schoolId, enr.eventId, enr.id, prev);
                          const fresh: any = await studentsApi.get(schoolId, id);
                          setStudent(fresh);
                        } finally { setUpdatingEnrollment(null); }
                      }}
                      disabled={updatingEnrollment === enr.id}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg"
                    >
                      Αναίρεση
                    </button>
                  )}
                  {updatingEnrollment === enr.id && (
                    <span className="text-xs text-gray-400">Αποθήκευση...</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Ιστορικό Τάξεων */}
      {tab === 'classes' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          {student.enrollments?.length === 0 ? (
            <p className="p-8 text-center text-gray-400">Δεν υπάρχουν εγγραφές.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 font-medium rounded-tl-xl">Σχολικό Έτος</th>
                  <th className="px-6 py-3 font-medium">Τάξη</th>
                  <th className="px-6 py-3 font-medium">Ηλικιακή Ομάδα</th>
                  <th className="px-6 py-3 font-medium rounded-tr-xl">Εγγραφή</th>
                </tr>
              </thead>
              <tbody>
                {student.enrollments.map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {e.academicYear.label}
                      {e.academicYear.isCurrent && (
                        <span className="ml-2 px-1.5 py-0.5 bg-green-50 text-green-700 text-xs rounded-md font-medium">Τρέχον</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{e.class.name}</td>
                    <td className="px-6 py-4 text-gray-500">{e.class.ageGroup ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(e.enrolledAt).toLocaleDateString('el-GR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Ημερολόγιο */}
      {tab === 'diary' && (
        <div className="space-y-4">
          {student.dailyReports?.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              Δεν υπάρχουν καταχωρήσεις.
            </div>
          ) : student.dailyReports.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-gray-900">
                  {new Date(r.reportDate).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div className="flex items-center gap-2">
                  {r.mood && (
                    <span className="text-lg" title={r.mood}>
                      {MOOD_EMOJI[r.mood] ?? '😐'}
                    </span>
                  )}
                  {r.teacher && (
                    <span className="text-xs text-gray-400">από {r.teacher.fullName}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {r.mealBreakfast && (
                  <Chip label={`Πρωινό: ${MEAL_LABELS[r.mealBreakfast]?.label ?? r.mealBreakfast}`}
                    color={MEAL_LABELS[r.mealBreakfast]?.color ?? 'bg-gray-100 text-gray-600'} />
                )}
                {r.mealLunch && (
                  <Chip label={`Μεσημεριανό: ${MEAL_LABELS[r.mealLunch]?.label ?? r.mealLunch}`}
                    color={MEAL_LABELS[r.mealLunch]?.color ?? 'bg-gray-100 text-gray-600'} />
                )}
                {r.napDurationMinutes != null && r.napDurationMinutes > 0 && (
                  <Chip label={`Ύπνος: ${r.napDurationMinutes} λεπτά`} color="bg-blue-50 text-blue-700" />
                )}
                {r.bathroomCount > 0 && (
                  <Chip label={`WC: ${r.bathroomCount}x`} color="bg-purple-50 text-purple-700" />
                )}
              </div>
              {r.notes && <p className="text-sm text-gray-600 mt-2 italic">"{r.notes}"</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Οικονομικά */}
      {tab === 'billing' && (() => {
        const MONTH_GR = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
        const MONTH_FULL = ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

        const now = new Date();
        const curMonth = now.getMonth() + 1;
        const curYear = now.getFullYear();

        // School year for a given month/year (Sep-Jun = same school year)
        const schoolYearOf = (m: number, y: number) => m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
        const currentSY = schoolYearOf(curMonth, curYear);

        // Collect all school years to display
        const sySet = new Set<string>([currentSY]);
        charges.forEach((c: any) => sySet.add(schoolYearOf(c.month, c.year)));
        oneTimeCharges.forEach((c: any) => {
          const d = new Date(c.chargeDate);
          sySet.add(schoolYearOf(d.getMonth() + 1, d.getFullYear()));
        });
        const schoolYears = Array.from(sySet).sort();

        // Months of a school year in order Sep → Jun
        const monthsOf = (sy: string) => {
          const startY = parseInt(sy.split('-')[0]);
          return [
            {m: 9, y: startY}, {m: 10, y: startY}, {m: 11, y: startY}, {m: 12, y: startY},
            {m: 1, y: startY + 1}, {m: 2, y: startY + 1}, {m: 3, y: startY + 1},
            {m: 4, y: startY + 1}, {m: 5, y: startY + 1}, {m: 6, y: startY + 1},
          ];
        };

        const cmpMonth = (m1: number, y1: number, m2: number, y2: number) =>
          y1 !== y2 ? y1 - y2 : m1 - m2;

        // Expected monthly amount (before charge exists)
        const levelId = student?.enrollments?.[0]?.class?.level?.id;
        const levelName = student?.enrollments?.[0]?.class?.level?.name;
        const levelFee = levelFees.find((f: any) => f.levelId === levelId);
        const levelMonthly = levelFee ? Number(levelFee.monthlyFee) : 0;
        const round2 = (n: number) => Math.round(n * 100) / 100;
        let schoolNet = levelMonthly;
        let schoolAdjust = 'τιμή βαθμίδας';
        if (feeOverride?.fixedAmount != null) {
          schoolNet = Number(feeOverride.fixedAmount);
          schoolAdjust = `ειδική τιμή αντί για €${levelMonthly.toFixed(0)} της βαθμίδας`;
        } else if (feeOverride?.discountPct != null) {
          schoolNet = round2(levelMonthly * (1 - Number(feeOverride.discountPct) / 100));
          schoolAdjust = `έκπτωση ${Number(feeOverride.discountPct)}% στην τιμή βαθμίδας €${levelMonthly.toFixed(0)}`;
        }
        const busLines = (student.studentServices ?? [])
          .filter((ss: any) => ss.service?.serviceType === 'bus')
          .map((ss: any) => {
            const mode = ss.serviceMode ?? 'both';
            const base = mode === 'pickup'
              ? Number(ss.service.pickupCost ?? ss.service.monthlyCost ?? 0)
              : mode === 'dropoff'
              ? Number(ss.service.dropoffCost ?? ss.service.monthlyCost ?? 0)
              : Number(ss.service.monthlyCost ?? 0);
            const discount = Number(ss.discountAmount ?? 0);
            return { id: ss.id, name: ss.service.name, base, discount, net: Math.max(0, round2(base - discount)) };
          });
        const activityLines = (student.activityRegistrations ?? [])
          .filter((r: any) => (r.status === 'approved' || r.status === 'pending') && r.activity?.monthlyCost != null)
          .map((r: any) => ({ id: r.id, name: r.activity.title, amount: Number(r.activity.monthlyCost) }));
        const busTotal = busLines.reduce((s: number, l: any) => s + l.net, 0);
        const activityTotal = activityLines.reduce((s: number, l: any) => s + l.amount, 0);
        const subsidyTotal = subsidies.filter((s: any) => s.isActive).reduce((sum: number, s: any) => sum + Number(s.monthlyAmount), 0);
        const monthlyTotal = Math.max(0, round2(schoolNet + busTotal + activityTotal - subsidyTotal));
        const expectedNet = monthlyTotal;

        const handleGenerateMonth = async (m: number, y: number) => {
          const key = `${m}-${y}`;
          setGeneratingMonth(key);
          try {
            await (billingApi as any).generateStudentCharge(schoolId, id, m, y);
            await loadBillingData();
          } finally {
            setGeneratingMonth(null);
          }
        };

        const handleQuickPay = async (charge: any) => {
          setSavingPay(true);
          try {
            await billingApi.updateCharge(schoolId, charge.id, { paidAmount: Number(charge.totalDue), status: 'paid' });
            await loadBillingData();
          } finally {
            setSavingPay(false);
          }
        };

        const handleSubmitPay = async (charge: any) => {
          const amt = parseFloat(payAmount);
          if (isNaN(amt) || amt < 0) return;
          setSavingPay(true);
          try {
            await billingApi.updateCharge(schoolId, charge.id, { paidAmount: amt });
            setPayingChargeId(null);
            setPayAmount('');
            await loadBillingData();
          } finally {
            setSavingPay(false);
          }
        };

        // Year totals
        const yearStats = (sy: string) => {
          const ms = monthsOf(sy);
          const syCharges = charges.filter((c: any) => ms.some(({m, y}) => c.month === m && c.year === y));
          return {
            totalDue: syCharges.reduce((s: number, c: any) => s + Number(c.totalDue), 0),
            totalPaid: syCharges.reduce((s: number, c: any) => s + Number(c.paidAmount), 0),
          };
        };

        // Financial summary across all categories
        const eventEnrollments = student.eventEnrollments ?? [];
        const eventsDue = eventEnrollments
          .filter((e: any) => e.status === 'pending_payment' || e.status === 'paid')
          .reduce((s: number, e: any) => s + Number(e.event?.costPerChild ?? 0), 0);
        const eventsPaid = eventEnrollments
          .filter((e: any) => e.status === 'paid')
          .reduce((s: number, e: any) => s + Number(e.event?.costPerChild ?? 0), 0);
        const activityDue = (student.activityRegistrations ?? [])
          .filter((r: any) => r.status === 'approved')
          .reduce((s: number, r: any) => s + Number(r.activity?.oneTimeCost ?? 0), 0);
        const monthlyDue = charges.reduce((s: number, c: any) => s + Number(c.totalDue ?? 0), 0);
        const monthlyPaid = charges.reduce((s: number, c: any) => s + Number(c.paidAmount ?? 0), 0);
        const otcDue = oneTimeCharges.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
        const otcPaid = oneTimeCharges.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);

        const handleMarkEventPaid = async (enr: any, paid: boolean) => {
          setMarkingEventPayment(enr.id);
          try {
            await schoolEventsApi.markPayment(schoolId, enr.eventId, enr.id, paid);
            const fresh: any = await studentsApi.get(schoolId, id);
            setStudent(fresh);
          } finally {
            setMarkingEventPayment(null);
          }
        };

        return (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Μηνιαία χρέωση</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ισχύει κάθε μήνα της σχολικής χρονιάς{levelName ? ` · βαθμίδα ${levelName}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-[#77328D]">€{monthlyTotal.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">σύνολο / μήνα</div>
                </div>
              </div>
              <div className="divide-y divide-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Σχολείο</p>
                    <p className="text-xs text-gray-500">{schoolAdjust}{feeOverride?.reason ? ` · ${feeOverride.reason}` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">€{schoolNet.toFixed(2)}</span>
                </div>
                {busLines.map((line: any) => (
                  <div key={line.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Σχολικό · {line.name}</p>
                      {line.discount > 0 && (
                        <p className="text-xs text-orange-700">€{line.base.toFixed(0)} − έκπτωση €{line.discount.toFixed(0)}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">€{line.net.toFixed(2)}</span>
                  </div>
                ))}
                {activityLines.map((line: any) => (
                  <div key={line.id} className="flex items-center gap-3 px-4 py-3">
                    <p className="flex-1 text-sm font-medium text-gray-900">Δραστηριότητα · {line.name}</p>
                    <span className="text-sm font-semibold text-gray-800">€{line.amount.toFixed(2)}</span>
                  </div>
                ))}
                {subsidyTotal > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <p className="flex-1 text-sm font-medium text-emerald-800">Επιδοτήσεις</p>
                    <span className="text-sm font-semibold text-emerald-700">−€{subsidyTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="mt-4">
                  {feeForm === null ? (
                    <button
                      onClick={() => setFeeForm({
                        mode: feeOverride?.fixedAmount != null ? 'fixed' : feeOverride?.discountPct != null ? 'percent' : 'level',
                        percent: feeOverride?.discountPct != null ? String(feeOverride.discountPct) : '10',
                        fixed: feeOverride?.fixedAmount != null ? String(feeOverride.fixedAmount) : '',
                        reason: feeOverride?.reason ?? '',
                      })}
                      className="text-sm font-medium text-[#77328D] hover:underline"
                    >
                      {feeOverride ? 'Αλλαγή τιμής σχολείου για αυτό το παιδί' : 'Έκπτωση ή ειδική τιμή για αυτό το παιδί'}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-[#e6d0ee] bg-[#faf5fc] p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-800">Τιμή σχολείου για όλη τη σχολική χρονιά</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {([
                          ['level', 'Τιμή βαθμίδας'],
                          ['percent', 'Έκπτωση %'],
                          ['fixed', 'Ειδική τιμή'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setFeeForm({ ...feeForm, mode })}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium ${feeForm.mode === mode ? 'border-[#77328D] bg-white text-[#642678]' : 'border-transparent bg-white/70 text-gray-600'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {feeForm.mode === 'percent' && (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={feeForm.percent}
                          onChange={e => setFeeForm({ ...feeForm, percent: e.target.value })}
                          placeholder="π.χ. 10 για αδελφάκι"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                      )}
                      {feeForm.mode === 'fixed' && (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={feeForm.fixed}
                          onChange={e => setFeeForm({ ...feeForm, fixed: e.target.value })}
                          placeholder="π.χ. 380 αντί για την τιμή της τάξης"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                      )}
                      {feeForm.mode !== 'level' && (
                        <input
                          value={feeForm.reason}
                          onChange={e => setFeeForm({ ...feeForm, reason: e.target.value })}
                          placeholder="Αιτιολογία, π.χ. αδελφάκι 10%"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                      )}
                      <p className="text-xs text-gray-500">Η ρύθμιση ακολουθεί το παιδί σε κάθε μηνιαία χρέωση της χρονιάς. Για αδελφάκι, βάλε την ίδια έκπτωση και στα δύο προφίλ.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setFeeForm(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Ακύρωση</button>
                        <button onClick={handleSaveFee} disabled={savingFee} className="flex-1 py-2 rounded-lg bg-[#77328D] text-white text-sm font-medium disabled:opacity-50">
                          {savingFee ? 'Αποθήκευση...' : 'Αποθήκευση'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Financial summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Οικονομική Επισκόπηση</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-medium mb-1">Μηνιαία Δίδακτρα</p>
                  <p className="text-lg font-bold text-blue-800">€{monthlyPaid.toFixed(0)}<span className="text-xs font-normal text-blue-500"> / €{monthlyDue.toFixed(0)}</span></p>
                </div>
                <div className="bg-violet-50 rounded-xl p-3">
                  <p className="text-xs text-violet-600 font-medium mb-1">Εκδηλώσεις</p>
                  <p className="text-lg font-bold text-violet-800">€{eventsPaid.toFixed(0)}<span className="text-xs font-normal text-violet-500"> / €{eventsDue.toFixed(0)}</span></p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-600 font-medium mb-1">Εκτακτες Χρεώσεις</p>
                  <p className="text-lg font-bold text-amber-800">€{otcPaid.toFixed(0)}<span className="text-xs font-normal text-amber-500"> / €{otcDue.toFixed(0)}</span></p>
                </div>
                <div className={`rounded-xl p-3 ${(monthlyDue + eventsDue + otcDue - monthlyPaid - eventsPaid - otcPaid) > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className={`text-xs font-medium mb-1 ${(monthlyDue + eventsDue + otcDue - monthlyPaid - eventsPaid - otcPaid) > 0 ? 'text-red-600' : 'text-green-600'}`}>Υπόλοιπο</p>
                  <p className={`text-lg font-bold ${(monthlyDue + eventsDue + otcDue - monthlyPaid - eventsPaid - otcPaid) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    €{Math.max(0, monthlyDue + eventsDue + otcDue - monthlyPaid - eventsPaid - otcPaid).toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Events billing section */}
            {eventEnrollments.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 bg-violet-50 border-b border-violet-100">
                  <CalendarDays className="w-4 h-4 text-violet-600" />
                  <span className="font-semibold text-gray-900">Εκδηλώσεις</span>
                  <span className="text-xs text-violet-500">{eventEnrollments.length} εγγραφές</span>
                  {eventsDue > 0 && (
                    <div className="ml-auto text-xs text-gray-500 flex gap-4">
                      <span>Σύνολο: <span className="font-semibold text-gray-700">€{eventsDue.toFixed(0)}</span></span>
                      {eventsPaid > 0 && <span>Εξοφλήθη: <span className="font-semibold text-emerald-600">€{eventsPaid.toFixed(0)}</span></span>}
                      {eventsDue > eventsPaid && <span>Υπόλοιπο: <span className="font-semibold text-red-500">€{(eventsDue - eventsPaid).toFixed(0)}</span></span>}
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {eventEnrollments.map((enr: any) => (
                    <div key={enr.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-sm">{enr.event.title}</p>
                          <span className="text-xs text-gray-400">{EVENT_TYPES_GR[enr.event.eventType] ?? enr.event.eventType}</span>
                        </div>
                        {enr.event.eventDate && (
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(enr.event.eventDate).toLocaleDateString('el-GR')}</p>
                        )}
                      </div>
                      {enr.event.costPerChild > 0 && (
                        <span className="text-sm font-semibold text-gray-700 shrink-0">€{enr.event.costPerChild}</span>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${ENROLLMENT_STATUS_META[enr.status]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                        {ENROLLMENT_STATUS_META[enr.status]?.label ?? enr.status}
                      </span>
                      {isAdmin && enr.status === 'pending_consent' && (
                        <button
                          onClick={async () => {
                            setMarkingEventPayment(enr.id);
                            try {
                              const ns = enr.event.costPerChild > 0 ? 'pending_payment' : 'consent_given';
                              await schoolEventsApi.adminUpdateEnrollment(schoolId, enr.eventId, enr.id, ns);
                              const fresh: any = await studentsApi.get(schoolId, id);
                              setStudent(fresh);
                            } finally { setMarkingEventPayment(null); }
                          }}
                          disabled={markingEventPayment === enr.id}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                        >
                          <Check className="h-3 w-3" /> Συναίνεση
                        </button>
                      )}
                      {isAdmin && enr.status === 'pending_payment' && (
                        <button
                          onClick={async () => {
                            setMarkingEventPayment(enr.id);
                            try {
                              await schoolEventsApi.adminUpdateEnrollment(schoolId, enr.eventId, enr.id, 'paid');
                              const fresh: any = await studentsApi.get(schoolId, id);
                              setStudent(fresh);
                            } finally { setMarkingEventPayment(null); }
                          }}
                          disabled={markingEventPayment === enr.id}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 shrink-0"
                        >
                          <Check className="h-3 w-3" /> Εξόφληση
                        </button>
                      )}
                      {isAdmin && enr.status === 'paid' && (
                        <button
                          onClick={async () => {
                            setMarkingEventPayment(enr.id);
                            try {
                              await schoolEventsApi.adminUpdateEnrollment(schoolId, enr.eventId, enr.id, 'pending_payment');
                              const fresh: any = await studentsApi.get(schoolId, id);
                              setStudent(fresh);
                            } finally { setMarkingEventPayment(null); }
                          }}
                          disabled={markingEventPayment === enr.id}
                          className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg shrink-0"
                        >
                          Αναίρεση
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subsidies section */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">Επιδοτήσεις / Voucher</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Αφαιρούνται αυτόματα από κάθε μηνιαία χρέωση</p>
                  </div>
                  {subsidyForm === null && (
                    <button
                      onClick={() => setSubsidyForm({ name: '', subsidyType: 'voucher', monthlyAmount: '', notes: '' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Προσθήκη
                    </button>
                  )}
                </div>
                {subsidies.length === 0 && subsidyForm === null ? (
                  <p className="text-sm text-gray-400 py-1">Δεν υπάρχουν επιδοτήσεις</p>
                ) : (
                  <div className="space-y-2">
                    {subsidies.map((sub: any) => (
                      <div key={sub.id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{sub.name}</span>
                            <span className="text-xs bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">
                              {SUBSIDY_TYPES[sub.subsidyType] ?? sub.subsidyType}
                            </span>
                            {!sub.isActive && <span className="text-xs text-gray-400">(ανενεργό)</span>}
                          </div>
                          {sub.notes && <div className="text-xs text-gray-500 mt-0.5">{sub.notes}</div>}
                        </div>
                        <div className="text-emerald-700 font-bold text-sm shrink-0">−€{Number(sub.monthlyAmount).toFixed(0)}/μήνα</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSubsidyForm({ ...sub, monthlyAmount: String(sub.monthlyAmount) })} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteSubsidy(sub.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {subsidyForm !== null && (
                  <div className="mt-3 border border-indigo-100 rounded-xl p-4 bg-indigo-50/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Τύπος</label>
                        <select value={subsidyForm.subsidyType ?? 'voucher'} onChange={e => setSubsidyForm({ ...subsidyForm, subsidyType: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          {Object.entries(SUBSIDY_TYPES).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Ποσό/μήνα (€)</label>
                        <input type="number" min="0" step="0.01" value={subsidyForm.monthlyAmount} onChange={e => setSubsidyForm({ ...subsidyForm, monthlyAmount: e.target.value })} placeholder="π.χ. 300" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>
                    <input value={subsidyForm.name} onChange={e => setSubsidyForm({ ...subsidyForm, name: e.target.value })} placeholder="Φορέας / Περιγραφή (π.χ. ΕΣΠΑ Voucher, Alpha Bank)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <input value={subsidyForm.notes ?? ''} onChange={e => setSubsidyForm({ ...subsidyForm, notes: e.target.value })} placeholder="Σημειώσεις" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <div className="flex gap-2">
                      <button onClick={() => setSubsidyForm(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Ακύρωση</button>
                      <button onClick={handleSaveSubsidy} disabled={savingSubsidy || !subsidyForm.name || !subsidyForm.monthlyAmount} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{savingSubsidy ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* School year timelines */}
            {chargesLoading ? (
              <div className="text-center py-10 text-gray-400">Φόρτωση...</div>
            ) : schoolYears.map(sy => {
              const stats = yearStats(sy);
              const isCurrentSY = sy === currentSY;
              const months = monthsOf(sy);
              return (
                <div key={sy} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Year header */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Σχολικό Έτος {sy}</span>
                      {isCurrentSY && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Τρέχον</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-4">
                      {stats.totalDue > 0 && <span>Σύνολο: <span className="font-semibold text-gray-700">€{stats.totalDue.toFixed(0)}</span></span>}
                      {stats.totalPaid > 0 && <span>Εισπραχθέν: <span className="font-semibold text-emerald-600">€{stats.totalPaid.toFixed(0)}</span></span>}
                      {stats.totalDue > stats.totalPaid && stats.totalDue > 0 && <span>Υπόλοιπο: <span className="font-semibold text-red-500">€{(stats.totalDue - stats.totalPaid).toFixed(0)}</span></span>}
                    </div>
                  </div>

                  {/* Month rows */}
                  <div className="divide-y divide-gray-50">
                    {months.map(({m, y}) => {
                      const charge = charges.find((c: any) => c.month === m && c.year === y);
                      const monthOTC = oneTimeCharges.filter((c: any) => {
                        const d = new Date(c.chargeDate);
                        return d.getMonth() + 1 === m && d.getFullYear() === y;
                      });
                      const cmp = cmpMonth(m, y, curMonth, curYear);
                      const isPast = cmp < 0;
                      const isCurrent = cmp === 0;
                      const isFuture = cmp > 0;
                      const genKey = `${m}-${y}`;
                      const isGenerating = generatingMonth === genKey;
                      const isPaying = payingChargeId === charge?.id;

                      return (
                        <div
                          key={genKey}
                          className={`px-5 py-3 transition-colors ${isFuture ? 'opacity-40' : ''} ${isCurrent ? 'bg-indigo-50/40' : 'hover:bg-gray-50/50'}`}
                        >
                          {/* Month main row */}
                          <div className="flex items-center gap-3">
                            {/* Month label */}
                            <div className={`w-24 shrink-0 ${isCurrent ? 'font-bold text-indigo-700' : 'font-medium text-gray-700'}`}>
                              <div className="text-sm">{MONTH_FULL[m]}</div>
                              <div className="text-xs text-gray-400">{y}</div>
                            </div>

                            {charge ? (
                              <>
                                {/* Breakdown */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                    {Number(charge.schoolFee) > 0 && <span>Δίδακτρα €{Number(charge.schoolFee).toFixed(0)}</span>}
                                    {Number(charge.busFee) > 0 && <span>Σχολικό €{Number(charge.busFee).toFixed(0)}</span>}
                                    {Number(charge.activityFees) > 0 && <span>Δραστ. €{Number(charge.activityFees).toFixed(0)}</span>}
                                    {Number(charge.subsidyTotal) > 0 && <span className="text-emerald-600">−€{Number(charge.subsidyTotal).toFixed(0)} επιδότηση</span>}
                                  </div>
                                  {charge.status === 'partial' && (
                                    <div className="text-xs text-blue-600 mt-0.5">Πληρ.: €{Number(charge.paidAmount).toFixed(0)} · Υπόλ.: €{(Number(charge.totalDue) - Number(charge.paidAmount)).toFixed(0)}</div>
                                  )}
                                </div>

                                {/* Total */}
                                <div className="text-right shrink-0">
                                  <div className="font-bold text-gray-900">€{Number(charge.totalDue).toFixed(0)}</div>
                                </div>

                                {/* Status */}
                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  charge.status === 'paid' ? 'bg-green-100 text-green-700' :
                                  charge.status === 'partial' ? 'bg-blue-100 text-blue-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {charge.status === 'paid' ? 'Εξοφλήθη' : charge.status === 'partial' ? 'Μερική' : 'Εκκρεμεί'}
                                </span>

                                {/* Actions */}
                                {isAdmin && !isFuture && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    {charge.status !== 'paid' && (
                                      <>
                                        <button
                                          onClick={() => handleQuickPay(charge)}
                                          disabled={savingPay}
                                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"
                                          title="Εξόφληση ολόκληρου ποσού"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => { setPayingChargeId(charge.id); setPayAmount(String(Number(charge.totalDue) - Number(charge.paidAmount))); }}
                                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
                                          title="Καταχώρηση πληρωμής"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                    {charge.status === 'paid' && (
                                      <button
                                        onClick={() => billingApi.updateCharge(schoolId, charge.id, { paidAmount: 0, status: 'unpaid' }).then(loadBillingData)}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500"
                                        title="Αναίρεση πληρωμής"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {/* No charge yet */}
                                <div className="flex-1 text-xs text-gray-400 italic">
                                  {isFuture ? 'Μελλοντικός μήνας' : expectedNet > 0 ? `~€${expectedNet.toFixed(0)} αναμενόμενο` : 'Δεν έχει υπολογιστεί'}
                                </div>
                                {isAdmin && !isFuture && (
                                  <button
                                    onClick={() => handleGenerateMonth(m, y)}
                                    disabled={isGenerating}
                                    className="shrink-0 text-xs px-2.5 py-1 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                                  >
                                    {isGenerating ? '...' : '+ Δημιουργία'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>

                          {/* Inline pay form */}
                          {isPaying && (
                            <div className="mt-2 pl-27 flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg px-2 py-1">
                                <span className="text-sm text-gray-500">€</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={payAmount}
                                  onChange={e => setPayAmount(e.target.value)}
                                  className="w-24 text-sm focus:outline-none"
                                  autoFocus
                                />
                              </div>
                              <button onClick={() => handleSubmitPay(charge)} disabled={savingPay} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                {savingPay ? '...' : 'Αποθήκευση'}
                              </button>
                              <button onClick={() => { setPayingChargeId(null); setPayAmount(''); }} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Ακύρωση</button>
                            </div>
                          )}

                          {/* One-time charges for this month */}
                          {monthOTC.map((c: any) => (
                            <div key={c.id} className="mt-2 ml-24 flex items-center gap-3 py-1.5 px-3 bg-orange-50 border border-orange-100 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-gray-700">{c.description}</span>
                                {c.notes && <span className="text-xs text-gray-400 ml-2">{c.notes}</span>}
                              </div>
                              <span className="text-xs font-semibold text-gray-700 shrink-0">€{Number(c.amount).toFixed(0)}</span>
                              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                                c.status === 'paid' ? 'bg-green-100 text-green-700' :
                                c.status === 'partial' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {c.status === 'paid' ? 'Εξοφλήθη' : c.status === 'partial' ? 'Μερική' : 'Εκκρεμεί'}
                              </span>
                              {isAdmin && c.status !== 'paid' && (
                                <button onClick={() => handlePayOneTime(c, Number(c.amount))} className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 shrink-0" title="Εξόφληση"><Check className="h-3.5 w-3.5" /></button>
                              )}
                              {isAdmin && (
                                <button onClick={() => setOneTimeForm({ ...c, amount: String(c.amount), chargeDate: new Date(c.chargeDate).toISOString().slice(0, 10) })} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 shrink-0"><Pencil className="h-3 w-3" /></button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add one-time charge for this year */}
                  {isAdmin && (
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                      {oneTimeForm?.schoolYear === sy ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <input value={oneTimeForm.description} onChange={e => setOneTimeForm({ ...oneTimeForm, description: e.target.value })} placeholder="Περιγραφή (π.χ. Γραφική Ύλη)" className="col-span-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                            <input type="number" min="0" step="0.01" value={oneTimeForm.amount} onChange={e => setOneTimeForm({ ...oneTimeForm, amount: e.target.value })} placeholder="Ποσό (€)" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="date" value={oneTimeForm.chargeDate} onChange={e => setOneTimeForm({ ...oneTimeForm, chargeDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                            <input value={oneTimeForm.notes ?? ''} onChange={e => setOneTimeForm({ ...oneTimeForm, notes: e.target.value })} placeholder="Σημειώσεις" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                            <button onClick={() => setOneTimeForm(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-white">Ακύρωση</button>
                            <button onClick={handleSaveOneTime} disabled={savingOneTime || !oneTimeForm.description || !oneTimeForm.amount} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{savingOneTime ? '...' : 'Αποθήκευση'}</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setOneTimeForm({ description: '', amount: '', chargeDate: `${sy.split('-')[0]}-09-01`, notes: '', schoolYear: sy })}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600"
                        >
                          <Plus className="h-3.5 w-3.5" /> Εφάπαξ χρέωση (γραφική ύλη, εκδρομή κ.λπ.)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Records tab */}
      {tab === 'records' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-700">Σχολικά Αρχεία</h3>
              <select
                value={docYear}
                onChange={e => setDocYear(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-600"
              >
                <option value="">Όλα τα Έτη</option>
                {Array.from(new Set(documents.map((d: any) => d.academicYear).filter(Boolean))).sort().reverse().map((y: any) => (
                  <option key={y} value={y}>{y}</option>
                ))}
                {/* Current year option always present */}
                {!documents.find((d: any) => d.academicYear === `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`) && (
                  <option value={`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`}>
                    {new Date().getFullYear()}-{new Date().getFullYear() + 1}
                  </option>
                )}
              </select>
            </div>
            {isAdmin && (
              <>
                <input
                  ref={docInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.txt"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingDoc(true);
                    try {
                      const currentYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
                      await studentsApi.uploadDocument(schoolId, id, file, {
                        academicYear: docYear || currentYear,
                      });
                      await loadDocuments(docYear);
                    } finally {
                      setUploadingDoc(false);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {uploadingDoc ? 'Ανέβασμα...' : 'Προσθήκη Αρχείου'}
                </button>
              </>
            )}
          </div>

          {docsLoading ? (
            <div className="text-center py-12 text-gray-400">Φόρτωση...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-6 w-6 text-gray-400" />
              </div>
              <p className="font-medium text-gray-500">Δεν υπάρχουν αρχεία</p>
              {isAdmin && (
                <p className="text-sm text-gray-400 mt-1">Κάντε κλικ στο "Προσθήκη Αρχείου" για να ανεβάσετε</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => {
                const isImage = doc.fileType?.startsWith('image/');
                const isPdf = doc.fileType === 'application/pdf';
                const ext = doc.fileUrl?.split('.').pop()?.toUpperCase() ?? 'ΑΡΧΕΙΟ';
                const sizeKb = doc.fileSize ? Math.round(doc.fileSize / 1024) : null;
                return (
                  <div key={doc.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 text-xs font-bold">{isPdf ? 'PDF' : isImage ? 'IMG' : ext.slice(0, 4)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{doc.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        {doc.academicYear && <span>{doc.academicYear}</span>}
                        {sizeKb && <span>{sizeKb} KB</span>}
                        <span>{new Date(doc.uploadedAt).toLocaleDateString('el-GR')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                      >
                        Άνοιγμα
                      </a>
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            await studentsApi.deleteDocument(schoolId, id, doc.id);
                            await loadDocuments(docYear);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Enroll activity modal */}
      {showEnrollActivity && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Εγγραφή σε Δραστηριότητα</h3>
              <button onClick={() => setShowEnrollActivity(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {allActivities.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Δεν υπάρχουν διαθέσιμες δραστηριότητες</p>
              ) : allActivities.map((act: any) => {
                const already = student.activityRegistrations?.some((r: any) => r.activity.id === act.id);
                return (
                  <button
                    key={act.id}
                    disabled={already}
                    onClick={() => setSelectedActivityId(act.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                      already ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' :
                      selectedActivityId === act.id ? 'border-indigo-500 bg-indigo-50' :
                      'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">{act.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                      <span>{ACTIVITY_TYPES[act.activityType] ?? act.activityType}</span>
                      {act.monthlyCost != null && <span>{act.monthlyCost}€/μήνα</span>}
                      {already && <span className="text-indigo-500">Ήδη εγγεγραμμένος</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowEnrollActivity(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Ακύρωση</button>
              <button
                disabled={!selectedActivityId || enrollingActivity}
                onClick={async () => {
                  if (!selectedActivityId) return;
                  setEnrollingActivity(true);
                  try {
                    await activitiesApi.adminEnroll(schoolId, selectedActivityId, { studentId: id });
                    const fresh: any = await studentsApi.get(schoolId, id);
                    setStudent(fresh);
                    setShowEnrollActivity(false);
                  } finally { setEnrollingActivity(false); }
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {enrollingActivity ? 'Εγγραφή...' : 'Εγγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign service modal — full bus form */}
      {showAssignService && (() => {
        const svc = selectedServiceFull ?? allServices.find((s: any) => s.id === selectedServiceId);
        const routes = svc?.routes ?? [];
        const route = routes.find((r: any) => r.id === selectedRouteId);
        const stops = (route?.stops ?? []).filter((s: any) => s.latitude && s.longitude);
        const isBus = svc?.serviceType === 'bus';
        const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300';
        const showPickup = assignServiceMode === 'pickup' || assignServiceMode === 'both';
        const showDropoff = assignServiceMode === 'dropoff' || assignServiceMode === 'both';
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">{editingSs ? 'Επεξεργασία Παροχής' : 'Ανάθεση Παροχής'}</h3>
                <button onClick={() => setShowAssignService(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

                {/* Service selector — hide when editing */}
                {!editingSs && <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Παροχή</label>
                  <div className="grid grid-cols-2 gap-2">
                    {allServices.filter((s: any) => s.serviceType === 'bus').map((s: any) => (
                      <button
                        key={s.id}
                        onClick={async () => {
                          setSelectedServiceId(s.id); setSelectedRouteId(''); setSelectedStopId(''); setSelectedServiceFull(null);
                          const full: any = await extraServicesApi.get(schoolId, s.id);
                          setSelectedServiceFull(full);
                        }}
                        className={`text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                          selectedServiceId === s.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{SERVICE_TYPES[s.serviceType] ?? s.serviceType}{s.monthlyCost != null ? ` · ${s.monthlyCost}€/μήνα` : ''}</div>
                      </button>
                    ))}
                  </div>
                </div>}

                {(svc || editingSs) && (<>
                  {/* Route & Stop */}
                  {routes.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Δρομολόγιο</label>
                        <select value={selectedRouteId} onChange={e => { setSelectedRouteId(e.target.value); setSelectedStopId(''); }} className={inputCls}>
                          <option value="">— Χωρίς —</option>
                          {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      {stops.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Στάση</label>
                          <select value={selectedStopId} onChange={e => setSelectedStopId(e.target.value)} className={inputCls}>
                            <option value="">— Χωρίς στάση —</option>
                            {stops.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.address ? ` · ${s.address}` : ''}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Service mode (bus only) */}
                  {isBus && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Κατεύθυνση</label>
                      <div className="flex gap-2">
                        {([['both','Παραλαβή & Παράδοση'],['pickup','Μόνο Παραλαβή'],['dropoff','Μόνο Παράδοση']] as const).map(([v,l]) => (
                          <button key={v} onClick={() => setAssignServiceMode(v)}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-colors ${assignServiceMode === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600 hover:border-indigo-200'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Times */}
                  {isBus && (
                    <div className="grid grid-cols-2 gap-3">
                      {showPickup && (
                        <div>
                          <label className="block text-xs font-medium text-green-700 mb-1">Ώρα Παραλαβής ↑</label>
                          <input type="time" value={assignPickupTime} onChange={e => setAssignPickupTime(e.target.value)} className={inputCls} />
                        </div>
                      )}
                      {showDropoff && (
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">Ώρα Παράδοσης ↓</label>
                          <input type="time" value={assignDropoffTime} onChange={e => setAssignDropoffTime(e.target.value)} className={inputCls} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contacts */}
                  {isBus && (
                    <div className="grid grid-cols-2 gap-3">
                      {showPickup && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Άτομο Παραλαβής (πρωί)</label>
                          <input value={pickupContact} onChange={e => setPickupContact(e.target.value)} placeholder="π.χ. Μαρία Παπαδοπούλου" className={inputCls} />
                        </div>
                      )}
                      {showDropoff && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Άτομο Παράδοσης (απόγευμα)</label>
                          <input value={assignDropoffContact} onChange={e => setAssignDropoffContact(e.target.value)} placeholder="π.χ. Νίκος Παπαδόπουλος" className={inputCls} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Home address + map */}
                  {isBus && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Διεύθυνση κατοικίας</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          value={assignHomeAddress}
                          onChange={e => setAssignHomeAddress(e.target.value)}
                          placeholder="π.χ. Λεωφ. Αθηνών 42, Αθήνα"
                          className={`flex-1 ${inputCls}`}
                        />
                        <button
                          onClick={async () => {
                            const addr = assignHomeAddress.trim();
                            if (!addr) return;
                            setGeocodingAddr(true);
                            try {
                              const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&accept-language=el`);
                              const data = await res.json();
                              if (data[0]) { setAssignHomeLat(Number(data[0].lat)); setAssignHomeLng(Number(data[0].lon)); }
                            } finally { setGeocodingAddr(false); }
                          }}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                          disabled={geocodingAddr}
                        >
                          {geocodingAddr ? '...' : 'Εύρεση'}
                        </button>
                      </div>
                      <MapPicker
                        lat={assignHomeLat}
                        lng={assignHomeLng}
                        onSelect={(lat, lng, addr) => {
                          setAssignHomeLat(lat);
                          setAssignHomeLng(lng);
                          if (addr) setAssignHomeAddress(addr);
                        }}
                      />
                    </div>
                  )}

                  {/* Authorized pickup persons */}
                  {isBus && showPickup && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Εξουσιοδοτημένα άτομα παραλαβής</label>
                        <button onClick={() => setAssignPickupPersons(p => [...p, { name: '', phone: '', relation: '' }])}
                          className="text-xs text-indigo-600 font-medium hover:text-indigo-800">+ Προσθήκη</button>
                      </div>
                      <div className="space-y-2">
                        {assignPickupPersons.map((p, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input value={p.name} onChange={e => { const arr = [...assignPickupPersons]; arr[i] = {...arr[i], name: e.target.value}; setAssignPickupPersons(arr); }}
                              placeholder="Όνομα" className={`flex-1 ${inputCls}`} />
                            <input value={p.relation ?? ''} onChange={e => { const arr = [...assignPickupPersons]; arr[i] = {...arr[i], relation: e.target.value}; setAssignPickupPersons(arr); }}
                              placeholder="Σχέση" className={`w-24 ${inputCls}`} />
                            <input value={p.phone ?? ''} onChange={e => { const arr = [...assignPickupPersons]; arr[i] = {...arr[i], phone: e.target.value}; setAssignPickupPersons(arr); }}
                              placeholder="Τηλ." className={`w-28 ${inputCls}`} />
                            <button onClick={() => setAssignPickupPersons(p => p.filter((_,j)=>j!==i))} className="text-gray-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Discount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Έκπτωση (€/μήνα)</label>
                    <input type="number" value={assignDiscount} onChange={e => setAssignDiscount(e.target.value)}
                      placeholder="π.χ. 10 (αφήστε κενό για καμία έκπτωση)" className={inputCls} />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Σημειώσεις</label>
                    <textarea value={assignNotes} onChange={e => setAssignNotes(e.target.value)} rows={2}
                      placeholder="π.χ. κατεβαίνει μόνο Δευτέρα-Τετάρτη"
                      className={`${inputCls} resize-none`} />
                  </div>
                </>)}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                <button onClick={() => setShowAssignService(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Ακύρωση</button>
                <button
                  disabled={(!selectedServiceId && !editingSs) || assigningService}
                  onClick={async () => {
                    if (!selectedServiceId && !editingSs) return;
                    setAssigningService(true);
                    try {
                      const payload = {
                        studentId: id,
                        routeId: selectedRouteId || undefined,
                        stopId: selectedStopId || undefined,
                        serviceMode: assignServiceMode,
                        pickupContact: pickupContact || undefined,
                        dropoffContact: assignDropoffContact || undefined,
                        pickupTime: assignPickupTime || undefined,
                        dropoffTime: assignDropoffTime || undefined,
                        homeAddress: assignHomeAddress || undefined,
                        homeLat: assignHomeLat,
                        homeLng: assignHomeLng,
                        pickupPersons: assignPickupPersons.filter(p => p.name),
                        discountAmount: assignDiscount ? Number(assignDiscount) : undefined,
                        notes: assignNotes || undefined,
                      };
                      if (editingSs) {
                        await extraServicesApi.updateStudentService(schoolId, editingSs.serviceId, editingSs.ssId, payload);
                      } else {
                        await extraServicesApi.assignStudent(schoolId, selectedServiceId, payload);
                      }
                      const fresh: any = await studentsApi.get(schoolId, id);
                      setStudent(fresh);
                      setShowAssignService(false);
                      setEditingSs(null);
                      // reset
                      setAssignServiceMode('both'); setPickupContact(''); setAssignDropoffContact('');
                      setAssignPickupTime(''); setAssignDropoffTime('');
                      setAssignHomeAddress(''); setAssignHomeLat(undefined); setAssignHomeLng(undefined);
                      setAssignPickupPersons([]); setAssignDiscount(''); setAssignNotes('');
                    } finally { setAssigningService(false); }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {assigningService ? 'Αποθήκευση...' : editingSs ? 'Αποθήκευση' : 'Ανάθεση'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Link sibling modal */}
      {showLinkSibling && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Σύνδεση Αδερφιού</h3>
              <button onClick={() => { setShowLinkSibling(false); setSiblingSearch(''); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100">
              <input
                autoFocus
                value={siblingSearch}
                onChange={e => setSiblingSearch(e.target.value)}
                placeholder="Αναζήτηση μαθητή..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-3 space-y-2">
              {!siblingSearch.trim() ? (
                <p className="text-center text-gray-400 py-6 text-sm">Πληκτρολογήστε για αναζήτηση</p>
              ) : siblingResults.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">Δεν βρέθηκαν μαθητές</p>
              ) : siblingResults.map((s: any) => {
                const alreadySibling = student.siblings?.some((sib: any) => sib.id === s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                      {s.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{s.fullName}</div>
                      {s.dob && <div className="text-xs text-gray-500">{age(s.dob)}</div>}
                    </div>
                    {alreadySibling ? (
                      <span className="text-xs text-indigo-500 font-medium">Ήδη συνδεδεμένο</span>
                    ) : (
                      <button
                        disabled={linkingSibling}
                        onClick={async () => {
                          setLinkingSibling(true);
                          try {
                            await studentsApi.linkSibling(schoolId, id, s.id);
                            const fresh: any = await studentsApi.get(schoolId, id);
                            setStudent(fresh);
                            setShowLinkSibling(false);
                            setSiblingSearch('');
                          } finally { setLinkingSibling(false); }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Σύνδεση
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Parent edit / add modal */}
      {parentForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {showAddParent ? 'Προσθήκη Γονέα' : 'Επεξεργασία Γονέα'}
              </h3>
              <button onClick={() => setParentForm(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ονοματεπώνυμο *</label>
                <input
                  value={parentForm.fullName}
                  onChange={e => setParentForm({ ...parentForm, fullName: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="π.χ. Μαρία Παπαδοπούλου"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Τηλέφωνο</label>
                  <input
                    value={parentForm.phone}
                    onChange={e => setParentForm({ ...parentForm, phone: e.target.value })}
                    type="tel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="69xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Σχέση</label>
                  <select
                    value={parentForm.relation}
                    onChange={e => setParentForm({ ...parentForm, relation: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {['γονέας', 'μητέρα', 'πατέρας', 'παππούς', 'γιαγιά', 'κηδεμόνας', 'θείος', 'θεία', 'άλλο'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              {showAddParent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (προαιρετικό)</label>
                  <input
                    value={parentForm.email}
                    onChange={e => setParentForm({ ...parentForm, email: e.target.value })}
                    type="email"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="email@example.com"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parentForm.isPrimary ?? false}
                  onChange={e => setParentForm({ ...parentForm, isPrimary: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-300"
                />
                <span className="text-sm text-gray-700">Κύριος κηδεμόνας</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setParentForm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Ακύρωση
              </button>
              <button
                disabled={savingParent || !parentForm.fullName.trim()}
                onClick={async () => {
                  setSavingParent(true);
                  try {
                    if (showAddParent) {
                      await studentsApi.addParent(schoolId, id, {
                        fullName: parentForm.fullName,
                        email: parentForm.email || undefined,
                        phone: parentForm.phone || undefined,
                        relation: parentForm.relation,
                        isPrimary: parentForm.isPrimary,
                      });
                    } else {
                      await studentsApi.updateParent(schoolId, id, parentForm.userId, {
                        fullName: parentForm.fullName,
                        phone: parentForm.phone || undefined,
                        relation: parentForm.relation,
                        isPrimary: parentForm.isPrimary,
                      });
                    }
                    const fresh: any = await studentsApi.get(schoolId, id);
                    setStudent(fresh);
                    setParentForm(null);
                  } finally { setSavingParent(false); }
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingParent ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit student modal */}
      {editingInfo && infoForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Επεξεργασία Μαθητή</h3>
              <button onClick={() => setEditingInfo(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ονοματεπώνυμο *</label>
                <input
                  value={infoForm.fullName}
                  onChange={e => setInfoForm({ ...infoForm, fullName: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ημ. Γέννησης</label>
                  <input
                    type="date"
                    value={infoForm.dob}
                    onChange={e => setInfoForm({ ...infoForm, dob: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ομάδα Αίματος</label>
                  <select
                    value={infoForm.bloodType}
                    onChange={e => setInfoForm({ ...infoForm, bloodType: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">—</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(() => {
                const currentClasses = classes.filter((c: any) => c.academicYear?.isCurrent);
                const levels = Array.from(
                  new Map(currentClasses.filter((c: any) => c.level).map((c: any) => [c.level.id, c.level])).values()
                ).sort((a: any, b: any) => a.name.localeCompare(b.name));
                const currentLevelId = infoForm.levelId || classes.find((c: any) => c.id === infoForm.classId)?.level?.id || '';
                const classesForLevel = currentLevelId
                  ? currentClasses.filter((c: any) => c.level?.id === currentLevelId)
                  : [];
                const selectedCls = classes.find((c: any) => c.id === infoForm.classId);
                const classTeachers: any[] = selectedCls?.teachers ?? [];
                return (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Βαθμίδα</label>
                      <select
                        value={infoForm.levelId ?? currentLevelId}
                        onChange={e => setInfoForm({ ...infoForm, levelId: e.target.value, classId: '' })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">— Επιλέξτε βαθμίδα —</option>
                        {levels.map((lvl: any) => (
                          <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                        ))}
                      </select>
                    </div>
                    {(infoForm.levelId ?? currentLevelId) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Τμήμα</label>
                        {classesForLevel.length === 0 ? (
                          <p className="text-sm text-gray-400 py-1">Δεν υπάρχουν τμήματα για αυτή τη βαθμίδα</p>
                        ) : (
                          <div className="space-y-2">
                            {classesForLevel.map((cls: any) => {
                              const isSelected = infoForm.classId === cls.id;
                              const clsTeachers = cls.teachers?.map((t: any) => t.user.fullName).join(', ') || '—';
                              return (
                                <button
                                  key={cls.id}
                                  type="button"
                                  onClick={() => setInfoForm({ ...infoForm, classId: cls.id })}
                                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                                    isSelected
                                      ? 'border-indigo-500 bg-indigo-50'
                                      : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="font-medium text-gray-900 text-sm">{cls.name}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {clsTeachers !== '—' ? `Εκπαιδευτικός: ${clsTeachers}` : 'Χωρίς εκπαιδευτικό'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {classTeachers.length > 0 && infoForm.classId && (
                      <div className="bg-emerald-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                          {classTeachers[0].user.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs text-emerald-700 font-medium">{classTeachers.map((t: any) => t.user.fullName).join(', ')}</div>
                          <div className="text-xs text-emerald-500">Εκπαιδευτικός τμήματος</div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Διεύθυνση</label>
                <input
                  value={infoForm.address}
                  onChange={e => setInfoForm({ ...infoForm, address: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Αλλεργίες / Ειδικές ανάγκες</label>
                <input
                  value={infoForm.allergies}
                  onChange={e => setInfoForm({ ...infoForm, allergies: e.target.value })}
                  placeholder="π.χ. Αλλεργία στη γλουτένη"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Σημειώσεις</label>
                <textarea
                  value={infoForm.notes}
                  onChange={e => setInfoForm({ ...infoForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingInfo(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Ακύρωση
              </button>
              <button
                onClick={handleSaveInfo}
                disabled={savingInfo || !infoForm.fullName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingInfo ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-1 border-b border-gray-50 last:border-0">
      <dt className="w-36 text-gray-500 flex-shrink-0">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${color}`}>{label}</span>;
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
