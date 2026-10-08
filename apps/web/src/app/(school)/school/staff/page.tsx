'use client';

import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Plus, ChevronRight, GraduationCap } from 'lucide-react';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  school_admin: 'Διαχειριστής',
  teacher: 'Εκπαιδευτικός',
  owner: 'Ιδιοκτήτης',
};

const ROLE_COLORS: Record<string, string> = {
  school_admin: 'bg-indigo-50 text-indigo-700',
  teacher: 'bg-emerald-50 text-emerald-700',
  owner: 'bg-[#f3e8f7] text-[#77328D]',
};

const CONTRACT_LABELS: Record<string, string> = {
  full_time: 'Πλήρης',
  part_time: 'Μερική',
  hourly: 'Ωρομίσθιος',
};

export default function StaffPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('teacher');

  useEffect(() => {
    if (!schoolId) return;
    staffApi.list(schoolId).then((data: any) => {
      setMembers(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schoolId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Προσωπικό</h1>
          <p className="text-gray-500 text-sm mt-1">{members.length} μέλη προσωπικού</p>
        </div>
        <button
          type="button"
          onClick={() => { setAdding(true); setFormError(''); }}
          className="flex items-center gap-2 bg-[#77328D] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#642678]"
        >
          <Plus className="h-4 w-4" /> Νέο προσωπικό
        </button>
      </div>

      {adding && (
        <div className="mb-6">
          <form
            className="w-full max-w-md rounded-2xl border border-[#77328d]/15 bg-white p-5 shadow-sm"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setFormError('');
              try {
                await staffApi.create(schoolId, { fullName, phone, role });
                const data: any = await staffApi.list(schoolId);
                setMembers(Array.isArray(data) ? data : []);
                setFullName('');
                setPhone('');
                setRole('teacher');
                setAdding(false);
              } catch (error: any) {
                const message = error?.message;
                setFormError(Array.isArray(message) ? message.join(' ') : (typeof message === 'string' && message ? message : 'Το μέλος δεν αποθηκεύτηκε'));
              } finally {
                setSaving(false);
              }
            }}
          >
            <h2 className="font-semibold text-gray-900">Νέο προσωπικό</h2>
            <p className="mt-1 text-sm text-gray-500">Μπαίνει στην εφαρμογή με το κινητό. Ο ιδιοκτήτης βλέπει όλες τις τάξεις και τις αναφορές.</p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Ρόλος
              <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2">
                <option value="teacher">Εκπαιδευτικός</option>
                <option value="school_admin">Διαχειριστής</option>
                <option value="owner">Ιδιοκτήτης</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium text-gray-700">
              Ονοματεπώνυμο
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
            </label>
            <label className="mt-3 block text-sm font-medium text-gray-700">
              Κινητό
              <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="69XXXXXXXX" />
            </label>
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="rounded-xl bg-[#77328D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-xl px-4 py-2 text-sm text-gray-500">Ακύρωση</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-400 col-span-3 text-center py-12">Φόρτωση...</p>
        ) : members.length === 0 ? (
          <p className="text-gray-400 col-span-3 text-center py-12">Δεν υπάρχουν μέλη προσωπικού</p>
        ) : members.map((m) => {
          const profile = m.teacherProfile;
          return (
            <Link
              key={m.id}
              href={`/school/staff/${m.id}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-4">
                {m.user.avatarUrl ? (
                  <img
                    src={m.user.avatarUrl}
                    alt={m.user.fullName}
                    className="h-14 w-14 rounded-xl object-cover shadow-sm shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                    {m.user.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors mt-1" />
              </div>
              <div className="font-semibold text-gray-900">{m.user.fullName}</div>
              <div className="text-sm text-gray-500 mt-0.5">{m.user.email}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[m.role] ?? 'bg-gray-50 text-gray-600'}`}>
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
                {profile?.contractType && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {CONTRACT_LABELS[profile.contractType] ?? profile.contractType}
                  </span>
                )}
                {profile?.specialization && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    <GraduationCap className="h-3 w-3" /> {profile.specialization}
                  </span>
                )}
              </div>
              {profile?.monthlyGross && (
                <div className="mt-3 text-xs text-gray-400">
                  Μισθός: <span className="font-semibold text-emerald-600">€{Number(profile.monthlyGross).toFixed(0)}/μήνα</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
