'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { staffApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  ArrowLeft, Phone, Mail, MapPin, GraduationCap, Briefcase,
  CheckCircle, Clock, XCircle, CalendarDays, Camera, Pencil, Trash2, Plus,
} from 'lucide-react';

const TABS = [
  { key: 'profile', label: 'Προφίλ' },
  { key: 'classes', label: 'Τάξεις' },
  { key: 'salary', label: 'Μισθοδοσία' },
  { key: 'leaves', label: 'Άδειες' },
];

const CONTRACT_LABELS: Record<string, string> = {
  full_time: 'Πλήρης Απασχόληση',
  part_time: 'Μερική Απασχόληση',
  hourly: 'Ωρομίσθιος',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Κανονική', sick: 'Ασθένεια', maternity: 'Μητρότητα', other: 'Άλλη',
};

const LEAVE_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Εκκρεμεί', color: 'bg-amber-50 text-amber-700', icon: Clock },
  approved: { label: 'Εγκρίθηκε', color: 'bg-green-50 text-green-700', icon: CheckCircle },
  rejected: { label: 'Απορρίφθηκε', color: 'bg-red-50 text-red-600', icon: XCircle },
};

const MONTH_NAMES = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Εκπαιδευτικός',
  school_admin: 'Διευθυντής/Διαχειριστής',
  owner: 'Ιδιοκτήτης',
  driver: 'Οδηγός σχολικού',
};

function leaveBalance(entitlement: unknown, requests: any[] | undefined) {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const from = `${startYear}-09-01`;
  const to = `${startYear + 1}-08-31`;
  const days = (requests ?? [])
    .filter((row) => row.status === 'approved' && row.leaveType === 'annual')
    .reduce((sum, row) => sum + overlap(String(row.startDate).slice(0, 10), String(row.endDate).slice(0, 10), from, to), 0);
  const allowed = Number(entitlement) || 0;
  return { remaining: allowed - days };
}

function overlap(start: string, end: string, from: string, to: string) {
  const a = start > from ? start : from;
  const b = end < to ? end : to;
  if (b < a) return 0;
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000) + 1;
}

function daysDiff(start: string, end: string) {
  const d1 = new Date(start).getTime();
  const d2 = new Date(end).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
}

export default function StaffProfilePage() {
  const { id: memberId } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [formError, setFormError] = useState('');
  const emptySalary = () => ({
    id: '', month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()),
    grossAmount: '', deductions: '0', paidAt: '', notes: '',
  });
  const [salaryForm, setSalaryForm] = useState(emptySalary());
  const [salarySaving, setSalarySaving] = useState(false);
  const [leaveDays, setLeaveDays] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);
  const emptyLeave = () => ({ id: '', leaveType: 'annual', startDate: '', endDate: '', notes: '' });
  const [leaveForm, setLeaveForm] = useState(emptyLeave());
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', address: '', specialization: '',
    contractType: 'full_time', hireDate: '', bio: '', monthlyGross: '',
    education: [] as { degree: string; institution: string; year: string }[],
  });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'school_admin';

  useEffect(() => {
    if (!schoolId) return;
    staffApi.get(schoolId, memberId).then((data: any) => {
      setMember(data);
      setLeaveDays(data?.teacherProfile?.annualLeaveDays != null ? String(data.teacherProfile.annualLeaveDays) : '0');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schoolId, memberId]);

  function startEdit() {
    const profile = member?.teacherProfile;
    const studies = Array.isArray(profile?.education) ? profile.education : [];
    setForm({
      fullName: member?.user?.fullName ?? '',
      email: member?.user?.email ?? '',
      phone: profile?.phone || member?.user?.phone || '',
      address: profile?.address ?? '',
      specialization: profile?.specialization ?? '',
      contractType: profile?.contractType || 'full_time',
      hireDate: profile?.hireDate ? String(profile.hireDate).slice(0, 10) : '',
      bio: profile?.bio ?? '',
      monthlyGross: profile?.monthlyGross != null ? String(Number(profile.monthlyGross)) : '',
      education: studies.map((edu: any) => ({
        degree: edu?.degree ?? '',
        institution: edu?.institution ?? '',
        year: edu?.year != null && edu.year !== '' ? String(edu.year) : '',
      })),
    });
    setLeaveDays(profile?.annualLeaveDays != null ? String(profile.annualLeaveDays) : '0');
    setSalaryForm(emptySalary());
    setLeaveForm(emptyLeave());
    setFormError('');
    setEditing(true);
    setTab('profile');
  }

  function setStudy(index: number, patch: Partial<{ degree: string; institution: string; year: string }>) {
    setForm({
      ...form,
      education: form.education.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  }

  async function saveProfile() {
    setSaving(true);
    setFormError('');
    const education = form.education
      .map((row) => ({
        degree: row.degree.trim(),
        institution: row.institution.trim(),
        ...(row.year.trim() && Number.isFinite(Number(row.year)) ? { year: Number(row.year) } : {}),
      }))
      .filter((row) => row.degree || row.institution);
    try {
      const updated = await staffApi.updateProfile(schoolId, memberId, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        specialization: form.specialization,
        contractType: form.contractType,
        hireDate: form.hireDate,
        bio: form.bio,
        monthlyGross: form.monthlyGross,
        annualLeaveDays: Number(leaveDays || 0),
        education,
      }) as any;
      setMember(updated);
      setLeaveDays(updated?.teacherProfile?.annualLeaveDays != null ? String(updated.teacherProfile.annualLeaveDays) : '0');
      setEditing(false);
    } catch (error: any) {
      const message = error?.message;
      setFormError(typeof message === 'string' ? message : 'Η αποθήκευση δεν ολοκληρώθηκε');
    } finally {
      setSaving(false);
    }
  }

  async function removeMember() {
    const name = member?.user?.fullName || 'αυτό το μέλος';
    if (!window.confirm(`Να διαγραφεί ο/η ${name} από το προσωπικό;`)) return;
    setRemoving(true);
    setFormError('');
    try {
      await staffApi.remove(schoolId, memberId);
      router.push('/school/staff');
    } catch (error: any) {
      const message = error?.message;
      setFormError(typeof message === 'string' ? message : 'Η διαγραφή δεν ολοκληρώθηκε');
      setRemoving(false);
    }
  }

  async function reload() {
    const updated = await staffApi.get(schoolId, memberId) as any;
    setMember(updated);
    setLeaveDays(updated?.teacherProfile?.annualLeaveDays != null ? String(updated.teacherProfile.annualLeaveDays) : '0');
  }

  function errorMessage(error: any, fallback: string) {
    const message = error?.message;
    return typeof message === 'string' ? message : fallback;
  }

  async function saveSalary() {
    const gross = Number(salaryForm.grossAmount);
    const deductions = Number(salaryForm.deductions || 0);
    if (!Number.isFinite(gross)) return;
    setSalarySaving(true);
    setFormError('');
    const payload = {
      month: Number(salaryForm.month),
      year: Number(salaryForm.year),
      grossAmount: gross,
      deductions,
      paidAt: salaryForm.paidAt || null,
      notes: salaryForm.notes,
    };
    try {
      if (salaryForm.id) await staffApi.updateSalary(schoolId, memberId, salaryForm.id, payload);
      else await staffApi.createSalary(schoolId, memberId, payload);
      setSalaryForm(emptySalary());
      await reload();
    } catch (error: any) {
      setFormError(errorMessage(error, 'Η μισθοδοσία δεν αποθηκεύτηκε'));
    } finally {
      setSalarySaving(false);
    }
  }

  async function removeSalary(salaryId: string) {
    if (!window.confirm('Να διαγραφεί αυτή η μισθοδοσία;')) return;
    setFormError('');
    try {
      await staffApi.deleteSalary(schoolId, memberId, salaryId);
      await reload();
    } catch (error: any) {
      setFormError(errorMessage(error, 'Η διαγραφή δεν ολοκληρώθηκε'));
    }
  }

  async function saveEntitlement() {
    setLeaveSaving(true);
    setFormError('');
    try {
      await staffApi.updateProfile(schoolId, memberId, { annualLeaveDays: Number(leaveDays || 0) });
      await reload();
    } catch (error: any) {
      setFormError(errorMessage(error, 'Οι ημέρες άδειας δεν αποθηκεύτηκαν'));
    } finally {
      setLeaveSaving(false);
    }
  }

  async function saveLeave() {
    if (!leaveForm.startDate || !leaveForm.endDate) return;
    setLeaveSaving(true);
    setFormError('');
    const payload = {
      leaveType: leaveForm.leaveType,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      notes: leaveForm.notes,
    };
    try {
      if (leaveForm.id) await staffApi.updateLeave(schoolId, memberId, leaveForm.id, payload);
      else await staffApi.createLeave(schoolId, memberId, payload);
      setLeaveForm(emptyLeave());
      await reload();
    } catch (error: any) {
      setFormError(errorMessage(error, 'Η άδεια δεν αποθηκεύτηκε'));
    } finally {
      setLeaveSaving(false);
    }
  }

  async function handleLeaveStatus(leaveId: string, status: string) {
    setApprovingId(leaveId);
    await staffApi.updateLeave(schoolId, memberId, leaveId, { status });
    const updated = await staffApi.get(schoolId, memberId) as any;
    setMember(updated);
    setApprovingId(null);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Φόρτωση...</div>;
  if (!member) return <div className="text-center py-20 text-gray-400">Ο εκπαιδευτικός δεν βρέθηκε.</div>;

  const profile = member.teacherProfile;
  const education: any[] = Array.isArray(profile?.education) ? profile.education : [];

  const totalSalary = member.teacherProfile?.salaryRecords?.reduce(
    (s: number, r: any) => s + Number(r.netAmount), 0
  ) ?? 0;

  const currentClasses = member.classes?.filter((c: any) => c.class.academicYear.isCurrent) ?? [];
  const pastClasses = member.classes?.filter((c: any) => !c.class.academicYear.isCurrent) ?? [];

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Επιστροφή
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="relative h-20 w-20 flex-shrink-0 group">
            {member.user.avatarUrl ? (
              <img src={member.user.avatarUrl} className="h-20 w-20 rounded-2xl object-cover shadow-md" alt={member.user.fullName} />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                {member.user.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {isAdmin && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingAvatar(true);
                    try {
                      const res: any = await staffApi.uploadAvatar(schoolId, memberId, file);
                      setMember((prev: any) => ({ ...prev, user: { ...prev.user, avatarUrl: res.avatarUrl } }));
                    } finally {
                      setUploadingAvatar(false);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </button>
              </>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{member.user.fullName}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-medium">
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
              {profile?.contractType && (
                <span className="text-gray-500">{CONTRACT_LABELS[profile.contractType] ?? profile.contractType}</span>
              )}
              {profile?.hireDate && (
                <span className="text-gray-500">
                  Από {new Date(profile.hireDate).toLocaleDateString('el-GR', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              {member.user.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-gray-400" /> {member.user.email}
                </span>
              )}
              {(profile?.phone || member.user.phone) && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-gray-400" /> {profile?.phone ?? member.user.phone}
                </span>
              )}
              {profile?.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" /> {profile.address}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#77328D] text-white text-sm font-medium hover:bg-[#642678]"
                >
                  <Pencil className="h-4 w-4" /> Επεξεργασία
                </button>
                {member.user.id !== user?.id && (
                  <button
                    onClick={removeMember}
                    disabled={removing}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> {removing ? 'Διαγραφή...' : 'Διαγραφή'}
                  </button>
                )}
              </div>
            )}
            {profile?.monthlyGross && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <div className="text-xs text-emerald-600 font-medium">Μισθός Brutto</div>
                <div className="text-xl font-bold text-emerald-700">€{Number(profile.monthlyGross).toFixed(0)}</div>
                <div className="text-xs text-emerald-500">/ μήνα</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Προφίλ */}
      {formError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}

      {tab === 'profile' && editing && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Επεξεργασία προφίλ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Ονοματεπώνυμο" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} />
            <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <Field label="Τηλέφωνο" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Διεύθυνση" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
            <Field label="Ειδικότητα" value={form.specialization} onChange={(value) => setForm({ ...form, specialization: value })} />
            <label className="block text-sm">
              <span className="text-gray-500 text-xs font-medium">Σύμβαση</span>
              <select
                value={form.contractType}
                onChange={(event) => setForm({ ...form, contractType: event.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="full_time">Πλήρης απασχόληση</option>
                <option value="part_time">Μερική απασχόληση</option>
                <option value="hourly">Ωρομίσθιος</option>
              </select>
            </label>
            <Field label="Ημ. πρόσληψης" type="date" value={form.hireDate} onChange={(value) => setForm({ ...form, hireDate: value })} />
            <Field label="Μισθός brutto (€)" type="number" value={form.monthlyGross} onChange={(value) => setForm({ ...form, monthlyGross: value })} />
            <label className="block text-sm md:col-span-2">
              <span className="text-gray-500 text-xs font-medium">Βιογραφικό</span>
              <textarea
                value={form.bio}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
                rows={4}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[#77328D]" /> Σπουδές
              </h4>
              <button
                type="button"
                onClick={() => setForm({ ...form, education: [...form.education, { degree: '', institution: '', year: '' }] })}
                className="flex items-center gap-1 text-sm font-medium text-[#77328D]"
              >
                <Plus className="h-4 w-4" /> Προσθήκη
              </button>
            </div>
            {form.education.length === 0 ? (
              <p className="text-sm text-gray-400">Δεν έχουν καταχωρηθεί σπουδές.</p>
            ) : (
              <div className="space-y-3">
                {form.education.map((edu, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_7rem_auto] gap-2 items-end">
                    <Field label="Τίτλος" value={edu.degree} onChange={(value) => setStudy(index, { degree: value })} />
                    <Field label="Ίδρυμα" value={edu.institution} onChange={(value) => setStudy(index, { institution: value })} />
                    <Field label="Έτος" type="number" value={edu.year} onChange={(value) => setStudy(index, { year: value })} />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, education: form.education.filter((_, i) => i !== index) })}
                      className="mb-0.5 p-2 rounded-lg text-red-600 hover:bg-red-50"
                      aria-label="Αφαίρεση σπουδών"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#77328D] text-white text-sm font-medium hover:bg-[#642678] disabled:opacity-50"
            >
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
            <button
              onClick={() => { setEditing(false); setFormError(''); }}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600"
            >
              Άκυρο
            </button>
          </div>
        </div>
      )}

      {tab === 'profile' && !editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Στοιχεία Επικοινωνίας</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Email" value={member.user.email} />
              <Row label="Τηλέφωνο" value={profile?.phone ?? member.user.phone ?? '—'} />
              <Row label="Διεύθυνση" value={profile?.address ?? '—'} />
            </dl>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Επαγγελματικά</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Ειδικότητα" value={profile?.specialization ?? '—'} />
              <Row label="Σύμβαση" value={CONTRACT_LABELS[profile?.contractType] ?? '—'} />
              <Row label="Ημ. Πρόσληψης" value={profile?.hireDate ? new Date(profile.hireDate).toLocaleDateString('el-GR') : '—'} />
              <Row label="Μισθός brutto" value={profile?.monthlyGross != null ? `€${Number(profile.monthlyGross).toFixed(0)} / μήνα` : '—'} />
              <Row label="Κανονική άδεια" value={profile?.annualLeaveDays != null ? `${profile.annualLeaveDays} ημέρες` : '—'} />
            </dl>
            {profile?.bio && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Βιογραφικό</div>
                <p className="text-sm text-gray-700">{profile.bio}</p>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 md:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" /> Σπουδές
            </h3>
            {education.length === 0 ? (
              <p className="text-sm text-gray-400">Δεν έχουν καταχωρηθεί σπουδές.</p>
            ) : (
              <div className="space-y-3">
                {education.map((edu: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{edu.degree || '—'}</div>
                      <div className="text-sm text-gray-500">{[edu.institution, edu.year].filter((part) => part != null && part !== '').join(' · ') || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Τάξεις */}
      {tab === 'classes' && (
        <div className="space-y-6">
          {currentClasses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Τρέχον Έτος</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentClasses.map((ct: any) => (
                  <ClassCard key={ct.classId} ct={ct} current />
                ))}
              </div>
            </div>
          )}
          {pastClasses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Προηγούμενα Έτη</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastClasses.map((ct: any) => (
                  <ClassCard key={`${ct.classId}-${ct.class.academicYear.label}`} ct={ct} current={false} />
                ))}
              </div>
            </div>
          )}
          {member.classes?.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              Δεν υπάρχουν τάξεις.
            </div>
          )}
        </div>
      )}

      {/* Tab: Μισθοδοσία — και μέσα στην επεξεργασία προφίλ */}
      {(tab === 'salary' || (tab === 'profile' && editing)) && (
        <div className={`space-y-6 ${tab === 'profile' ? 'mt-6' : ''}`}>
          {tab === 'profile' && <h3 className="font-semibold text-gray-800">Μισθοδοσία</h3>}
          <div className="grid grid-cols-3 gap-4">
            <StatMini label="Σύνολο Καθαρών (ιστορικό)" value={`€${totalSalary.toFixed(2)}`} color="text-gray-900" />
            <StatMini label="Μισθός Brutto" value={profile?.monthlyGross ? `€${Number(profile.monthlyGross).toFixed(0)}/μήνα` : '—'} color="text-emerald-700" />
            <StatMini label="Εγγραφές" value={`${member.teacherProfile?.salaryRecords?.length ?? 0}`} color="text-gray-900" />
          </div>
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="text-xs text-gray-500">Μήνας
                <select value={salaryForm.month} onChange={(event) => setSalaryForm({ ...salaryForm, month: event.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-900">
                  {MONTH_NAMES.slice(1).map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Έτος
                <input type="number" value={salaryForm.year} onChange={(event) => setSalaryForm({ ...salaryForm, year: event.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-gray-500">Brutto €
                <input type="number" value={salaryForm.grossAmount} onChange={(event) => setSalaryForm({ ...salaryForm, grossAmount: event.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-gray-500">Κρατήσεις €
                <input type="number" value={salaryForm.deductions} onChange={(event) => setSalaryForm({ ...salaryForm, deductions: event.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-gray-500">Πληρώθηκε
                <input type="date" value={salaryForm.paidAt} onChange={(event) => setSalaryForm({ ...salaryForm, paidAt: event.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-gray-500 md:col-span-2">Σημείωση
                <input value={salaryForm.notes} onChange={(event) => setSalaryForm({ ...salaryForm, notes: event.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </label>
              <div className="flex items-end gap-2">
                <button type="button" onClick={saveSalary} disabled={salarySaving || !salaryForm.grossAmount} className="px-3 py-2 rounded-lg bg-[#77328D] text-white text-sm font-semibold disabled:opacity-50">
                  {salaryForm.id ? 'Αποθήκευση' : 'Προσθήκη'}
                </button>
                {salaryForm.id && (
                  <button type="button" onClick={() => setSalaryForm(emptySalary())} className="px-3 py-2 rounded-lg border text-sm">Άκυρο</button>
                )}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 font-medium rounded-tl-xl">Μήνας</th>
                  <th className="px-6 py-3 font-medium">Brutto</th>
                  <th className="px-6 py-3 font-medium">Κρατήσεις</th>
                  <th className="px-6 py-3 font-medium">Καθαρά</th>
                  <th className="px-6 py-3 font-medium">Πληρώθηκε</th>
                  {isAdmin && <th className="px-6 py-3 font-medium rounded-tr-xl" />}
                </tr>
              </thead>
              <tbody>
                {!member.teacherProfile?.salaryRecords?.length ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">Δεν υπάρχουν εγγραφές μισθοδοσίας.</td></tr>
                ) : member.teacherProfile.salaryRecords.map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {MONTH_NAMES[r.month]} {r.year}
                      {r.notes ? <div className="text-xs font-normal text-gray-400 mt-0.5">{r.notes}</div> : null}
                    </td>
                    <td className="px-6 py-4 text-gray-700">€{Number(r.grossAmount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-red-500">-€{Number(r.deductions).toFixed(2)}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">€{Number(r.netAmount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {r.paidAt ? (
                        <span className="flex items-center gap-1 text-green-700 text-xs font-medium">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {new Date(r.paidAt).toLocaleDateString('el-GR')}
                        </span>
                      ) : (
                        <span className="text-amber-600 text-xs font-medium">Εκκρεμεί</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button type="button" onClick={() => setSalaryForm({
                          id: r.id,
                          month: String(r.month),
                          year: String(r.year),
                          grossAmount: String(Number(r.grossAmount)),
                          deductions: String(Number(r.deductions)),
                          paidAt: r.paidAt ? String(r.paidAt).slice(0, 10) : '',
                          notes: r.notes ?? '',
                        })} className="text-xs font-semibold text-[#77328D] mr-3">Επεξεργασία</button>
                        <button type="button" onClick={() => removeSalary(r.id)} className="text-xs font-semibold text-red-600">Διαγραφή</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Άδειες — και μέσα στην επεξεργασία προφίλ */}
      {(tab === 'leaves' || (tab === 'profile' && editing)) && (
        <div className={`space-y-4 ${tab === 'profile' ? 'mt-6' : ''}`}>
          {tab === 'profile' && <h3 className="font-semibold text-gray-800">Άδειες</h3>}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-gray-500">Ημέρες κανονικής άδειας που δικαιούται
                  <input type="number" min={0} value={leaveDays} onChange={(event) => setLeaveDays(event.target.value)} className="mt-1 block w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <button type="button" onClick={saveEntitlement} disabled={leaveSaving} className="px-3 py-2 rounded-lg bg-[#77328D] text-white text-sm font-semibold disabled:opacity-50">Αποθήκευση δικαιώματος</button>
                <p className="text-sm text-gray-600">Υπόλοιπο σχολικής χρονιάς: <span className="font-bold text-gray-900">{leaveBalance(member.teacherProfile?.annualLeaveDays, member.teacherProfile?.leaveRequests).remaining}</span> ημέρες</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <select value={leaveForm.leaveType} onChange={(event) => setLeaveForm({ ...leaveForm, leaveType: event.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-sm">
                  <option value="annual">Κανονική</option>
                  <option value="sick">Ασθένεια</option>
                  <option value="maternity">Μητρότητα</option>
                  <option value="other">Άλλη</option>
                </select>
                <input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm({ ...leaveForm, startDate: event.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-sm" />
                <input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm({ ...leaveForm, endDate: event.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-sm" />
                <input value={leaveForm.notes} onChange={(event) => setLeaveForm({ ...leaveForm, notes: event.target.value })} placeholder="Σημείωση" className="border border-gray-200 rounded-lg px-2 py-2 text-sm" />
                <button type="button" onClick={saveLeave} disabled={leaveSaving || !leaveForm.startDate || !leaveForm.endDate} className="px-3 py-2 rounded-lg bg-[#E95926] text-white text-sm font-semibold disabled:opacity-50">
                  {leaveForm.id ? 'Αποθήκευση άδειας' : 'Προσθήκη άδειας'}
                </button>
              </div>
            </div>
          )}
          {!member.teacherProfile?.leaveRequests?.length ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              Δεν υπάρχουν αιτήματα αδείας.
            </div>
          ) : member.teacherProfile.leaveRequests.map((leave: any) => {
            const st = LEAVE_STATUS[leave.status] ?? LEAVE_STATUS['pending'];
            const StatusIcon = st.icon;
            const days = daysDiff(leave.startDate, leave.endDate);
            return (
              <div key={leave.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType} Άδεια</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                        <StatusIcon className="h-3 w-3" /> {st.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(leave.startDate).toLocaleDateString('el-GR')} — {new Date(leave.endDate).toLocaleDateString('el-GR')}
                      <span className="ml-2 text-indigo-600 font-medium">({days} {days === 1 ? 'ημέρα' : 'ημέρες'})</span>
                    </div>
                    {leave.notes && <p className="text-sm text-gray-600 mt-1 italic">"{leave.notes}"</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setLeaveForm({
                          id: leave.id,
                          leaveType: leave.leaveType,
                          startDate: String(leave.startDate).slice(0, 10),
                          endDate: String(leave.endDate).slice(0, 10),
                          notes: leave.notes ?? '',
                        })}
                        className="px-3 py-1.5 border text-xs rounded-lg"
                      >
                        Επεξεργασία
                      </button>
                      {leave.status === 'pending' && (
                        <>
                          <button
                            disabled={approvingId === leave.id}
                            onClick={() => handleLeaveStatus(leave.id, 'approved')}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            Έγκριση
                          </button>
                          <button
                            disabled={approvingId === leave.id}
                            onClick={() => handleLeaveStatus(leave.id, 'rejected')}
                            className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 disabled:opacity-50"
                          >
                            Απόρριψη
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-500 text-xs font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-1 border-b border-gray-50 last:border-0">
      <dt className="w-32 text-gray-500 flex-shrink-0 text-xs uppercase tracking-wide font-medium">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ClassCard({ ct, current }: { ct: any; current: boolean }) {
  return (
    <div className={`rounded-xl border shadow-sm p-5 ${current ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${current ? 'bg-emerald-200' : 'bg-gray-100'}`}>
          <Briefcase className={`h-4 w-4 ${current ? 'text-emerald-700' : 'text-gray-500'}`} />
        </div>
        {ct.isPrimary && (
          <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Κύριος</span>
        )}
      </div>
      <div className="font-semibold text-gray-900">{ct.class.name}</div>
      <div className="text-sm text-gray-500">{ct.class.academicYear.label}</div>
      {ct.class.ageGroup && <div className="text-xs text-gray-400 mt-1">{ct.class.ageGroup}</div>}
    </div>
  );
}
