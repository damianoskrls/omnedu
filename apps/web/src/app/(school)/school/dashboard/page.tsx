'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { activitiesApi, billingApi, classesApi, extraServicesApi, schoolEventsApi, staffApi, studentsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { GraduationCap, BookOpen, CreditCard, UserPlus, ArrowUpRight, Bus, CalendarDays, Sparkles } from 'lucide-react';
import { eventDisplayStatus } from '@/lib/event-status';
import { PersonAvatar } from '@/components/PersonAvatar';

const MONTHS = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
const LEVEL_COLORS = ['#77328D', '#E95926', '#8fbf63', '#c46a3a', '#642678', '#e0c2a4'];

type MonthSlot = { month: number; year: number };

function openSchoolMonths(now = new Date()): MonthSlot[] {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = month >= 9 ? year : year - 1;
  const all: MonthSlot[] = [
    { month: 9, year: start }, { month: 10, year: start }, { month: 11, year: start }, { month: 12, year: start },
    { month: 1, year: start + 1 }, { month: 2, year: start + 1 }, { month: 3, year: start + 1 },
    { month: 4, year: start + 1 }, { month: 5, year: start + 1 }, { month: 6, year: start + 1 },
  ];
  return all.filter((slot) => slot.year < year || (slot.year === year && slot.month <= month));
}

function euro(value: number) {
  return `€${Math.round(value).toLocaleString('el-GR')}`;
}

export default function SchoolDashboard() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const firstName = user?.fullName?.split(' ')[0];
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DashboardView | null>(null);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    Promise.all([
      studentsApi.list(schoolId).catch(() => []),
      classesApi.list(schoolId).catch(() => []),
      billingApi.stats(schoolId).catch(() => null),
      activitiesApi.list(schoolId).catch(() => []),
      schoolEventsApi.list(schoolId).catch(() => []),
      extraServicesApi.list(schoolId).catch(() => []),
      staffApi.list(schoolId).catch(() => []),
    ]).then(([students, classes, billing, activities, events, services, staff]) => {
      setView(buildView(
        Array.isArray(students) ? students : [],
        Array.isArray(classes) ? classes : [],
        billing,
        Array.isArray(activities) ? activities : [],
        Array.isArray(events) ? events : [],
        Array.isArray(services) ? services : [],
        Array.isArray(staff) ? staff : [],
      ));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schoolId]);

  const data = view;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_-28px_rgba(119,50,141,0.55)]">
        <div className="h-1.5 bg-gradient-to-r from-[#E95926] via-[#c46a3a] to-[#77328D]" />
        <div className="px-6 py-6 sm:px-8">
          <p className="text-sm font-extrabold tracking-wide text-[#E95926]">Ονειροχώρα</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c2422]">
            {firstName ? `Καλώς ήρθες, ${firstName}` : 'Επισκόπηση'}
          </h1>
          <p className="mt-1 text-sm font-medium text-[#6b625c]">
            Εκδρομές, βαθμίδες και οικονομικά του σχολικού έτους {data?.schoolYear ?? ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashCard label="Μαθητές" value={loading ? '…' : data?.students ?? 0} icon={GraduationCap} tone="purple" href="/school/students" />
        <DashCard label="Νέοι αυτόν τον μήνα" value={loading ? '…' : data?.newThisMonth ?? 0} icon={UserPlus} tone="orange" href="/school/students" />
        <DashCard label="Τάξεις" value={loading ? '…' : data?.classes ?? 0} icon={BookOpen} tone="sand" href="/school/classes" />
        <DashCard label="Απλήρωτοι μήνες" value={loading ? '…' : data?.owing ?? 0} hint={data ? euro(data.outstanding) : undefined} icon={CreditCard} tone="green" href="/school/billing" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Επερχόμενες εκδρομές" subtitle="Οι επόμενες εκδηλώσεις του σχολείου">
          <UpcomingEvents events={data?.upcoming ?? []} />
        </Panel>
        <Panel title="Μαθητές ανά βαθμίδα" subtitle="Πού βρίσκονται τα παιδιά">
          <DonutChart slices={data?.byLevel ?? []} empty="Δεν έχουν οριστεί τάξεις ακόμη." />
        </Panel>
        <Panel title="Εισπράξεις και οφειλές" subtitle="Σύγκριση ανά μήνα">
          <GroupedBars rows={data?.billingMonths ?? []} empty="Δεν έχουν δημιουργηθεί μηνιαίες χρεώσεις ακόμη." />
        </Panel>
        <Panel title="Από πού έρχονται τα έσοδα" subtitle="Φοίτηση, σχολικό και δραστηριότητες">
          <HorizontalBars rows={data?.mix ?? []} empty="Δεν υπάρχουν ακόμη οικονομικά στοιχεία." />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Τελευταίοι μαθητές" subtitle="Οι πιο πρόσφατες εγγραφές" className="lg:col-span-2">
          {!data || data.recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Δεν υπάρχουν μαθητές ακόμη.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recent.map((student) => (
                <Link key={student.id} href={`/school/students/${student.id}`} className="flex items-center gap-3 py-2.5 hover:bg-[#faf5fc] rounded-lg px-1">
                  <PersonAvatar name={student.name} src={student.avatarUrl} tone="brand" letters={1} className="h-9 w-9 rounded-full text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#2c2422]">{student.name}</span>
                    <span className="block text-xs text-gray-500">{student.level}</span>
                  </span>
                  <span className="text-xs font-medium text-gray-400">{student.when}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <MiniStat icon={Sparkles} label="Δραστηριότητες" value={loading ? '…' : data?.activities ?? 0} detail={data ? `${data.activitySeats} συμμετοχές` : ''} href="/school/activities" />
          <MiniStat icon={CalendarDays} label="Εκδηλώσεις" value={loading ? '…' : data?.upcomingEvents ?? 0} detail="προσεχείς" href="/school/events" />
          <MiniStat icon={Bus} label="Στο σχολικό" value={loading ? '…' : data?.busStudents ?? 0} detail="μαθητές" href="/school/routes" />
          <MiniStat icon={GraduationCap} label="Προσωπικό" value={loading ? '…' : data?.staff ?? 0} detail="άτομα" href="/school/staff" />
        </div>
      </div>
    </div>
  );
}

type DashboardView = ReturnType<typeof buildView>;

function buildView(students: any[], classes: any[], billing: any, activities: any[], events: any[], services: any[], staff: any[]) {
  const now = new Date();
  const months = openSchoolMonths(now);
  const currentClasses = classes.some((item) => item.academicYear?.isCurrent)
    ? classes.filter((item) => item.academicYear?.isCurrent)
    : classes;
  const levelByClass = new Map(currentClasses.map((item) => [item.id, item.level?.name || item.name || 'Χωρίς βαθμίδα']));
  const currentClassIds = new Set(currentClasses.map((item) => item.id));

  const levelCounts = new Map<string, number>();
  for (const student of students) {
    const enrollment = (student.enrollments ?? []).find((item: any) => currentClassIds.has(item.classId ?? item.class?.id))
      ?? student.enrollments?.[0];
    const classId = enrollment?.classId ?? enrollment?.class?.id;
    const level = (classId && levelByClass.get(classId)) || 'Χωρίς τάξη';
    levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
  }

  const newByMonth = months.map((slot) => ({
    label: MONTHS[slot.month],
    value: students.filter((student) => {
      const created = new Date(student.createdAt);
      return created.getMonth() + 1 === slot.month && created.getFullYear() === slot.year;
    }).length,
  }));
  const newThisMonth = newByMonth[newByMonth.length - 1]?.value ?? 0;

  const byMonth = new Map<string, { due: number; paid: number }>();
  for (const row of billing?.sy?.byMonth ?? []) {
    byMonth.set(`${row.year}-${row.month}`, { due: Number(row.totalDue ?? 0), paid: Number(row.totalPaid ?? 0) });
  }
  const billingMonths = months.map((slot) => {
    const found = byMonth.get(`${slot.year}-${slot.month}`) ?? { due: 0, paid: 0 };
    return { label: MONTHS[slot.month], due: found.due, paid: found.paid };
  });

  const mix = [
    { label: 'Φοίτηση', value: Number(billing?.sy?.schoolFees ?? 0), color: '#77328D' },
    { label: 'Σχολικό', value: Number(billing?.sy?.busFees ?? 0), color: '#E95926' },
    { label: 'Δραστηριότητες', value: Number(billing?.sy?.activityFees ?? 0), color: '#8fbf63' },
  ];

  const recent = [...students]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
    .map((student) => {
      const enrollment = student.enrollments?.[0];
      const classId = enrollment?.classId ?? enrollment?.class?.id;
      return {
        id: student.id,
        name: student.fullName,
        avatarUrl: student.avatarUrl,
        level: (classId && levelByClass.get(classId)) || enrollment?.class?.name || 'Χωρίς τάξη',
        when: student.createdAt ? new Date(student.createdAt).toLocaleDateString('el-GR') : '',
      };
    });

  const upcoming = events
    .filter((event) => event.status !== 'draft' && event.eventDate && eventDisplayStatus(event.status, event.eventDate) !== 'completed')
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      title: event.title,
      when: new Date(event.eventDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }),
      type: event.eventType === 'excursion' ? 'Εκδρομή' : event.eventType === 'theater' ? 'Θέατρο' : 'Εκδήλωση',
    }));
  const upcomingEvents = upcoming.length;
  const busStudents = services
    .filter((service) => service.serviceType === 'bus')
    .reduce((sum, service) => sum + Number(service._count?.studentServices ?? 0), 0);

  return {
    schoolYear: billing?.schoolYear ?? `${months[0]?.year ?? now.getFullYear()}-${(months[0]?.year ?? now.getFullYear()) + 1}`,
    students: students.length,
    newThisMonth,
    classes: currentClasses.length,
    owing: Number(billing?.studentsOwingThisMonth ?? billing?.unpaid ?? 0),
    outstanding: Math.max(0, Number(billing?.totalDue ?? 0) - Number(billing?.totalPaid ?? 0)),
    newByMonth,
    upcoming,
    byLevel: Array.from(levelCounts.entries()).map(([label, value], index) => ({
      label,
      value,
      color: LEVEL_COLORS[index % LEVEL_COLORS.length],
    })),
    billingMonths,
    mix,
    recent,
    activities: activities.length,
    activitySeats: activities.reduce((sum, activity) => sum + Number(activity._count?.registrations ?? 0), 0),
    upcomingEvents,
    busStudents,
    staff: staff.length,
  };
}

const tones = {
  purple: { chip: 'bg-[#f3e8f7] text-[#77328D]', bar: 'bg-[#77328D]' },
  orange: { chip: 'bg-[#fff1ec] text-[#E95926]', bar: 'bg-[#E95926]' },
  green: { chip: 'bg-[#eef6e3] text-[#4d7a32]', bar: 'bg-[#8fbf63]' },
  sand: { chip: 'bg-[#f6f1ea] text-[#8a5a32]', bar: 'bg-[#e0c2a4]' },
};

function DashCard({
  label, value, hint, icon: Icon, tone, href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof GraduationCap;
  tone: keyof typeof tones;
  href: string;
}) {
  const colors = tones[tone];
  return (
    <Link href={href} className="group relative overflow-hidden rounded-2xl border border-[#77328d]/10 bg-white p-5 transition hover:-translate-y-0.5">
      <span className={`absolute inset-x-0 top-0 h-1 ${colors.bar}`} />
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-xl p-2.5 ${colors.chip}`}><Icon className="h-4 w-4" /></div>
        <ArrowUpRight className="h-4 w-4 text-[#c4b6ae] transition group-hover:text-[#77328D]" />
      </div>
      <div className="text-3xl font-extrabold tracking-tight text-[#2c2422]">{value}</div>
      <div className="mt-1 text-sm font-semibold text-[#6b625c]">{label}</div>
      {hint && <div className="text-xs text-gray-400">{hint} εκκρεμούν</div>}
    </Link>
  );
}

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[#77328d]/10 bg-white p-5 ${className}`}>
      <h2 className="font-bold text-[#2c2422]">{title}</h2>
      <p className="mb-4 text-xs text-gray-500">{subtitle}</p>
      {children}
    </section>
  );
}

function UpcomingEvents({ events }: { events: { id: string; title: string; when: string; type: string }[] }) {
  if (!events.length) {
    return <p className="py-10 text-center text-sm text-gray-400">Δεν υπάρχουν επερχόμενες εκδρομές.</p>;
  }
  return (
    <div className="divide-y divide-gray-50">
      {events.map((event) => (
        <Link key={event.id} href="/school/events" className="flex items-center gap-3 py-2.5">
          <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[#fff1ec] text-[#E95926]">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#2c2422]">{event.title}</span>
            <span className="block text-xs text-gray-500">{event.type} · {event.when}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function DonutChart({ slices, empty }: { slices: { label: string; value: number; color: string }[]; empty: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-gray-400">{empty}</p>;
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-40 w-40 shrink-0">
        {slices.map((slice) => {
          const length = (slice.value / total) * circ;
          const node = (
            <circle
              key={slice.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${length} ${circ - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += length;
          return node;
        })}
        <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="800" fill="#2c2422">{total}</text>
        <text x="60" y="74" textAnchor="middle" fontSize="9" fill="#6b625c">μαθητές</text>
      </svg>
      <ul className="min-w-[160px] flex-1 space-y-2">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} />
            <span className="flex-1 text-[#2c2422]">{slice.label}</span>
            <span className="font-bold">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupedBars({ rows, empty }: { rows: { label: string; due: number; paid: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.due, row.paid]));
  if (rows.every((row) => row.due === 0 && row.paid === 0)) return <p className="py-10 text-center text-sm text-gray-400">{empty}</p>;
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#e6d0ee]" /> Οφειλή</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#77328D]" /> Εισπράχθηκε</span>
      </div>
      <div className="flex h-44 items-end gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex h-full min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div className="w-2/5 rounded-t-md bg-[#e6d0ee]" style={{ height: `${(row.due / max) * 100}%`, minHeight: row.due ? 4 : 0 }} />
              <div className="w-2/5 rounded-t-md bg-[#77328D]" style={{ height: `${(row.paid / max) * 100}%`, minHeight: row.paid ? 4 : 0 }} />
            </div>
            <span className="mt-1 text-[11px] text-gray-500">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ rows, empty }: { rows: { label: string; value: number; color: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.every((row) => row.value === 0)) return <p className="py-10 text-center text-sm text-gray-400">{empty}</p>;
  return (
    <div className="space-y-4 py-2">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-[#2c2422]">{row.label}</span>
            <span className="font-bold">{euro(row.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#f6f1ea]">
            <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, detail, href,
}: {
  icon: typeof Bus;
  label: string;
  value: string | number;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-[#77328d]/10 bg-white px-4 py-3 hover:-translate-y-0.5 transition">
      <span className="rounded-xl bg-[#fff1ec] p-2 text-[#E95926]"><Icon className="h-4 w-4" /></span>
      <span>
        <span className="block text-lg font-extrabold leading-none text-[#2c2422]">{value}</span>
        <span className="block text-xs font-semibold text-[#6b625c]">{label}</span>
        {detail && <span className="block text-[11px] text-gray-400">{detail}</span>}
      </span>
    </Link>
  );
}
