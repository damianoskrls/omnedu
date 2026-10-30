// Called by: Next route /school/attendance via schoolNav in nav-items.ts (sidebar.tsx).
// No prior web attendance page (glob school/attendance = 0). R/W attendance_records via attendanceApi.
// User: «να εχω και ενα section παρουσιολογιο στην διαχειριση με reports ανα ταξη κτλ και να βλεπω τι γινετε αλλα να μπορω και εγω σαν διαχειριστης να περασω παρουσιολογιο»
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { attendanceApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { PersonAvatar } from '@/components/PersonAvatar';
import {
  ClipboardCheck, Check, X, Save, Users, ChevronRight, Loader2,
} from 'lucide-react';

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function greekDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('el-GR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type ClassRow = {
  id: string;
  name: string;
  marked: boolean;
  complete: boolean;
  summary: {
    total: number;
    present: number;
    absent: number;
    unmarked: number;
    reported: number;
  };
};

type StudentRow = {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  status: 'present' | 'absent' | null;
  hasDailyReport?: boolean;
};

export default function AttendancePage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-[#8a756c]">Φόρτωση…</p>}>
      <AttendancePageContent />
    </Suspense>
  );
}

function AttendancePageContent() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const search = useSearchParams();
  const initialClass = search.get('classId') ?? '';

  const [date, setDate] = useState(todayIso);
  const [overview, setOverview] = useState<{
    classes: ClassRow[];
    schoolSummary: {
      totalStudents: number;
      present: number;
      absent: number;
      unmarked: number;
      reported: number;
      classesMarked: number;
      classesTotal: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(initialClass);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [localStatus, setLocalStatus] = useState<Record<string, 'present' | 'absent' | null>>({});
  const [classLoading, setClassLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadOverview = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError('');
    try {
      const data: any = await attendanceApi.overview(schoolId, date);
      setOverview(data);
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Αποτυχία φόρτωσης');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [schoolId, date]);

  const loadClass = useCallback(async (classId: string) => {
    if (!schoolId || !classId) return;
    setClassLoading(true);
    setSaveMsg('');
    try {
      const data: any = await attendanceApi.getClass(schoolId, classId, date);
      const list: StudentRow[] = Array.isArray(data?.students) ? data.students : [];
      setStudents(list);
      const map: Record<string, 'present' | 'absent' | null> = {};
      for (const s of list) map[s.id] = s.status ?? null;
      setLocalStatus(map);
    } catch (e: any) {
      setStudents([]);
      setSaveMsg(typeof e?.message === 'string' ? e.message : 'Σφάλμα φόρτωσης τμήματος');
    } finally {
      setClassLoading(false);
    }
  }, [schoolId, date]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedClassId) loadClass(selectedClassId);
    else {
      setStudents([]);
      setLocalStatus({});
    }
  }, [selectedClassId, loadClass]);

  const selectedClass = useMemo(
    () => overview?.classes.find((c) => c.id === selectedClassId) ?? null,
    [overview, selectedClassId],
  );

  const presentCount = Object.values(localStatus).filter((s) => s === 'present').length;
  const absentCount = Object.values(localStatus).filter((s) => s === 'absent').length;

  const setStatus = (studentId: string, status: 'present' | 'absent') => {
    setLocalStatus((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status,
    }));
  };

  const markAllPresent = () => {
    const next: Record<string, 'present' | 'absent' | null> = {};
    for (const s of students) next[s.id] = 'present';
    setLocalStatus(next);
  };

  const save = async () => {
    if (!selectedClassId) return;
    const records = Object.entries(localStatus)
      .filter(([, status]) => status === 'present' || status === 'absent')
      .map(([studentId, status]) => ({
        studentId,
        status: status as 'present' | 'absent',
      }));
    setSaving(true);
    setSaveMsg('');
    try {
      await attendanceApi.save(schoolId, {
        classId: selectedClassId,
        date,
        records,
      });
      setSaveMsg(`Αποθηκεύτηκε · ${presentCount} παρόντες · ${absentCount} απόντες`);
      await loadOverview();
      await loadClass(selectedClassId);
    } catch (e: any) {
      setSaveMsg(typeof e?.message === 'string' ? e.message : 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const summary = overview?.schoolSummary;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2f2a28]">
            <ClipboardCheck className="text-emerald-600" size={26} />
            Παρουσιολόγιο
          </h1>
          <p className="mt-1 text-sm text-[#6b625c]">
            Επισκόπηση ανά τάξη και καταχώρηση παρουσιών · {greekDate(date)}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-[#a89890]">
          Ημερομηνία
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSaveMsg('');
            }}
            className="rounded-xl border border-[#77328d]/20 bg-white px-3 py-2 text-sm font-semibold text-[#2f2a28]"
          />
        </label>
      </div>

      {loading && (
        <p className="py-12 text-center text-sm text-[#8a756c]">Φόρτωση παρουσιολογίου…</p>
      )}
      {error && !loading && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {!loading && summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Μαθητές" value={summary.totalStudents} />
          <Stat label="Παρόντες" value={summary.present} tone="emerald" />
          <Stat label="Απόντες" value={summary.absent} tone="rose" />
          <Stat label="Χωρίς σήμανση" value={summary.unmarked} tone="amber" />
          <Stat
            label="Τάξεις"
            value={`${summary.classesMarked}/${summary.classesTotal}`}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-[#77328d]/10 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2f2a28]">
            <Users size={16} className="text-[#642678]" />
            Ανά τάξη
          </h2>
          {!overview?.classes?.length ? (
            <p className="text-sm text-[#8a756c]">Δεν υπάρχουν ενεργές τάξεις.</p>
          ) : (
            <ul className="space-y-2">
              {overview.classes.map((klass) => {
                const active = klass.id === selectedClassId;
                return (
                  <li key={klass.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedClassId(klass.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-[#f3ece6] bg-white hover:border-[#77328d]/30'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#2f2a28]">{klass.name}</p>
                        <p className="mt-0.5 text-xs text-[#8a756c]">
                          {klass.summary.present} παρόν · {klass.summary.absent} απών
                          {klass.summary.unmarked > 0
                            ? ` · ${klass.summary.unmarked} εκκρεμ.`
                            : ''}
                        </p>
                      </div>
                      <StatusDot complete={klass.complete} marked={klass.marked} />
                      <ChevronRight size={16} className="text-[#c4b5ae]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
          {!selectedClassId ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center text-[#8a756c]">
              <ClipboardCheck size={36} className="mb-3 text-[#d6cbc4]" />
              <p className="font-semibold text-[#6b625c]">Επίλεξε τάξη</p>
              <p className="mt-1 text-sm">Δες την κατάσταση ή πέρασε παρουσιολόγιο για την ημερομηνία.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#2f2a28]">
                    {selectedClass?.name ?? 'Τάξη'}
                  </h2>
                  <p className="text-sm text-[#8a756c]">
                    {presentCount} παρόντες · {absentCount} απόντες · {students.length} σύνολο
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
                  >
                    Όλοι παρόντες
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || classLoading || students.length === 0 || presentCount + absentCount === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Αποθήκευση
                  </button>
                </div>
              </div>

              {saveMsg && (
                <p className="mb-3 rounded-xl bg-[#f8f5ff] px-3 py-2 text-sm text-[#642678]">{saveMsg}</p>
              )}

              {classLoading ? (
                <p className="py-10 text-center text-sm text-[#8a756c]">Φόρτωση μαθητών…</p>
              ) : students.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#8a756c]">
                  {saveMsg || 'Δεν υπάρχουν μαθητές σε αυτή την τάξη.'}
                </p>
              ) : (
                <ul className="divide-y divide-[#f3ece6]">
                  {students.map((s) => {
                    const status = localStatus[s.id] ?? null;
                    return (
                      <li
                        key={s.id}
                        className={`flex flex-wrap items-center gap-3 py-3 ${
                          status === 'present'
                            ? 'bg-emerald-50/60'
                            : status === 'absent'
                              ? 'bg-rose-50/60'
                              : ''
                        }`}
                      >
                        <PersonAvatar name={s.fullName} src={s.avatarUrl} className="h-10 w-10 rounded-xl text-sm" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/school/students/${s.id}`}
                            className="font-semibold text-[#2f2a28] hover:text-[#642678]"
                          >
                            {s.fullName}
                          </Link>
                          {s.hasDailyReport && (
                            <p className="text-xs font-semibold text-emerald-600">Ενημέρωση ✓</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <MarkBtn
                            active={status === 'present'}
                            tone="present"
                            label="Παρόν"
                            icon={<Check size={14} />}
                            onClick={() => setStatus(s.id, 'present')}
                          />
                          <MarkBtn
                            active={status === 'absent'}
                            tone="absent"
                            label="Απών"
                            icon={<X size={14} />}
                            onClick={() => setStatus(s.id, 'absent')}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'emerald' | 'rose' | 'amber';
}) {
  const color =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'rose'
        ? 'text-rose-700'
        : tone === 'amber'
          ? 'text-amber-700'
          : 'text-[#2f2a28]';
  return (
    <div className="rounded-2xl border border-[#77328d]/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-[#a89890]">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function StatusDot({ complete, marked }: { complete: boolean; marked: boolean }) {
  const cls = complete
    ? 'bg-emerald-500'
    : marked
      ? 'bg-amber-400'
      : 'bg-gray-300';
  return (
    <span
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls}`}
      title={complete ? 'Ολοκληρωμένο' : marked ? 'Μερικό' : 'Χωρίς καταχώρηση'}
    />
  );
}

function MarkBtn({
  active,
  tone,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  tone: 'present' | 'absent';
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const base =
    tone === 'present'
      ? active
        ? 'bg-emerald-600 text-white'
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : active
        ? 'bg-rose-600 text-white'
        : 'bg-rose-50 text-rose-700 border border-rose-200';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${base}`}
    >
      {icon}
      {label}
    </button>
  );
}
