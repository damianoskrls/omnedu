'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { studentsApi, classesApi, billingApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { GraduationCap, BookOpen, CreditCard, Users, ArrowUpRight } from 'lucide-react';

export default function SchoolDashboard() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const firstName = user?.fullName?.split(' ')[0];

  const [stats, setStats] = useState({ students: 0, classes: 0, unpaidInvoices: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    Promise.all([
      studentsApi.list(schoolId),
      classesApi.list(schoolId),
      billingApi.stats(schoolId),
    ]).then(([students, classes, billing]: any) => {
      setStats({
        students: students?.length ?? 0,
        classes: classes?.length ?? 0,
        unpaidInvoices: billing?.unpaid ?? 0,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schoolId]);

  return (
    <div>
      <div className="mb-8 overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_-28px_rgba(119,50,141,0.55)]">
        <div className="h-1.5 bg-gradient-to-r from-[#E95926] via-[#c46a3a] to-[#77328D]" />
        <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-sm font-extrabold tracking-wide text-[#E95926]">Ονειροχώρα</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c2422]">
              {firstName ? `Καλώς ήρθες, ${firstName}` : 'Επισκόπηση'}
            </h1>
            <p className="mt-1 text-sm font-medium text-[#6b625c]">
              Σύνοψη της ημέρας στον βρεφονηπιακό σταθμό και το νηπιαγωγείο
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashCard label="Μαθητές" value={loading ? '…' : stats.students} icon={GraduationCap} tone="purple" href="/school/students" />
        <DashCard label="Τάξεις" value={loading ? '…' : stats.classes} icon={BookOpen} tone="orange" href="/school/classes" />
        <DashCard label="Απλήρωτα" value={loading ? '…' : stats.unpaidInvoices} icon={CreditCard} tone="green" href="/school/billing" />
        <DashCard label="Αναφορές ημέρας" value="—" icon={Users} tone="sand" href="/school/students" />
      </div>
    </div>
  );
}

const tones = {
  purple: { chip: 'bg-[#f3e8f7] text-[#77328D]', bar: 'bg-[#77328D]' },
  orange: { chip: 'bg-[#fff1ec] text-[#E95926]', bar: 'bg-[#E95926]' },
  green: { chip: 'bg-[#eef6e3] text-[#4d7a32]', bar: 'bg-[#8fbf63]' },
  sand: { chip: 'bg-[#f6f1ea] text-[#8a5a32]', bar: 'bg-[#e0c2a4]' },
};

function DashCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  icon: typeof GraduationCap;
  tone: keyof typeof tones;
  href: string;
}) {
  const colors = tones[tone];
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-[#77328d]/10 bg-white p-5 transition hover:-translate-y-0.5"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${colors.bar}`} />
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-xl p-2.5 ${colors.chip}`}>
          <Icon className="h-4 w-4" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-[#c4b6ae] transition group-hover:text-[#77328D]" />
      </div>
      <div className="text-3xl font-extrabold tracking-tight text-[#2c2422]">{value}</div>
      <div className="mt-1 text-sm font-semibold text-[#6b625c]">{label}</div>
    </Link>
  );
}
