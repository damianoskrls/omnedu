'use client';

import { useEffect, useState } from 'react';
import { studentsApi, classesApi, billingApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { GraduationCap, BookOpen, CreditCard, Users } from 'lucide-react';

export default function SchoolDashboard() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';

  const [stats, setStats] = useState({ students: 0, classes: 0, unpaidInvoices: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
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
    });
  }, [schoolId]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.fullName}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <DashCard label="Students" value={stats.students} icon={GraduationCap} color="blue" href="/school/students" />
        <DashCard label="Classes" value={stats.classes} icon={BookOpen} color="violet" href="/school/classes" />
        <DashCard label="Unpaid Invoices" value={stats.unpaidInvoices} icon={CreditCard} color="amber" href="/school/billing" />
        <DashCard label="Today's Reports" value="—" icon={Users} color="emerald" href="/school/students" />
      </div>
    </div>
  );
}

function DashCard({ label, value, icon: Icon, color, href }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <a href={href} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
    </a>
  );
}
