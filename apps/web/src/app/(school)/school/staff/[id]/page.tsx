'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { staffApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  ArrowLeft, Phone, Mail, MapPin, GraduationCap, Briefcase,
  CheckCircle, Clock, XCircle, CalendarDays, Camera,
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
};

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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'school_admin';

  useEffect(() => {
    if (!schoolId) return;
    staffApi.get(schoolId, memberId).then((data: any) => {
      setMember(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schoolId, memberId]);

  async function handleLeaveStatus(leaveId: string, status: string) {
    setApprovingId(leaveId);
    await staffApi.updateLeave(schoolId, memberId, leaveId, status);
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
          {profile?.monthlyGross && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center flex-shrink-0">
              <div className="text-xs text-emerald-600 font-medium">Μισθός Brutto</div>
              <div className="text-xl font-bold text-emerald-700">€{Number(profile.monthlyGross).toFixed(0)}</div>
              <div className="text-xs text-emerald-500">/ μήνα</div>
            </div>
          )}
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
      {tab === 'profile' && (
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
            </dl>
            {profile?.bio && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Βιογραφικό</div>
                <p className="text-sm text-gray-700">{profile.bio}</p>
              </div>
            )}
          </div>
          {education.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 md:col-span-2">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600" /> Σπουδές
              </h3>
              <div className="space-y-3">
                {education.map((edu: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{edu.degree}</div>
                      <div className="text-sm text-gray-500">{edu.institution} · {edu.year}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* Tab: Μισθοδοσία */}
      {tab === 'salary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatMini label="Σύνολο Καθαρών (ιστορικό)" value={`€${totalSalary.toFixed(2)}`} color="text-gray-900" />
            <StatMini label="Μισθός Brutto" value={profile?.monthlyGross ? `€${Number(profile.monthlyGross).toFixed(0)}/μήνα` : '—'} color="text-emerald-700" />
            <StatMini label="Εγγραφές" value={`${member.teacherProfile?.salaryRecords?.length ?? 0}`} color="text-gray-900" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 font-medium rounded-tl-xl">Μήνας</th>
                  <th className="px-6 py-3 font-medium">Brutto</th>
                  <th className="px-6 py-3 font-medium">Κρατήσεις</th>
                  <th className="px-6 py-3 font-medium">Καθαρά</th>
                  <th className="px-6 py-3 font-medium rounded-tr-xl">Πληρώθηκε</th>
                </tr>
              </thead>
              <tbody>
                {!member.teacherProfile?.salaryRecords?.length ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">Δεν υπάρχουν εγγραφές μισθοδοσίας.</td></tr>
                ) : member.teacherProfile.salaryRecords.map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{MONTH_NAMES[r.month]} {r.year}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Άδειες */}
      {tab === 'leaves' && (
        <div className="space-y-4">
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
                  {leave.status === 'pending' && user?.role === 'school_admin' && (
                    <div className="flex gap-2">
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
