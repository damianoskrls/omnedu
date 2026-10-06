'use client';

import { useEffect, useState } from 'react';
import { schoolsApi } from '@/lib/api';
import { School } from '@/types';
import { School as SchoolIcon, Users, Activity } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminDashboard() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    schoolsApi.list().then((data: any) => {
      setSchools(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-extrabold tracking-wide text-[#E95926]">Ονειροχώρα</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2422]">Επισκόπηση πλατφόρμας</h1>
        <p className="text-gray-500 text-sm mt-1">Όλα τα σχολεία στο σύστημα</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Schools" value={schools.length} icon={SchoolIcon} color="indigo" />
        <StatCard
          label="Total Students"
          value={schools.reduce((s, sc) => s + (sc._count?.students ?? 0), 0)}
          icon={Users}
          color="emerald"
        />
        <StatCard
          label="Active Schools"
          value={schools.filter((s) => s.isActive).length}
          icon={Activity}
          color="violet"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Schools</h2>
          <Link
            href="/super-admin/schools/new"
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700"
          >
            + New School
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-50">
              <th className="px-6 py-3 font-medium">School</th>
              <th className="px-6 py-3 font-medium">Plan</th>
              <th className="px-6 py-3 font-medium">Students</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : schools.map((school) => (
              <tr key={school.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link href={`/super-admin/schools/${school.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {school.name}
                  </Link>
                  <div className="text-gray-400 text-xs">{school.slug}</div>
                </td>
                <td className="px-6 py-4 capitalize">{school.subscriptionPlan}</td>
                <td className="px-6 py-4">{school._count?.students ?? 0}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${school.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {school.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
