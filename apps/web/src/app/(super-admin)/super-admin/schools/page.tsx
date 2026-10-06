'use client';

import { useEffect, useState } from 'react';
import { schoolsApi } from '@/lib/api';
import Link from 'next/link';
import { Plus, Palette, X, Save, Check } from 'lucide-react';

const PRESET_COLORS = [
  '#77328D', '#E95926', '#4F46E5', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777', '#1D4ED8',
];

export default function SchoolsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchool, setEditingSchool] = useState<any>(null);
  const [branding, setBranding] = useState({ name: '', logoUrl: '', primaryColor: '#77328D' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    schoolsApi.list().then((data: any) => {
      setSchools(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openBranding = (school: any) => {
    setEditingSchool(school);
    setBranding({
      name: school.name,
      logoUrl: school.logoUrl ?? '',
      primaryColor: school.primaryColor ?? '#77328D',
    });
    setSaved(false);
  };

  const saveBranding = async () => {
    if (!editingSchool) return;
    setSaving(true);
    try {
      await schoolsApi.updateBranding(editingSchool.id, {
        name: branding.name || undefined,
        logoUrl: branding.logoUrl || undefined,
        primaryColor: branding.primaryColor,
      });
      setSaved(true);
      load();
      setTimeout(() => { setEditingSchool(null); setSaved(false); }, 1000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-500 text-sm mt-1">{schools.length} schools on the platform</p>
        </div>
        <Link
          href="/super-admin/schools/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New School
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 font-medium rounded-tl-xl">School</th>
              <th className="px-6 py-3 font-medium">Slug</th>
              <th className="px-6 py-3 font-medium">Plan</th>
              <th className="px-6 py-3 font-medium">Members</th>
              <th className="px-6 py-3 font-medium">Students</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium rounded-tr-xl">Branding</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : schools.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No schools yet</td></tr>
            ) : schools.map((school) => (
              <tr key={school.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {school.logoUrl ? (
                      <img src={school.logoUrl} alt="" className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: school.primaryColor ?? '#77328D' }}
                      >
                        {school.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-gray-900">{school.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{school.slug}</td>
                <td className="px-6 py-4 capitalize text-gray-700">{school.subscriptionPlan}</td>
                <td className="px-6 py-4 text-gray-700">{school._count?.members ?? '—'}</td>
                <td className="px-6 py-4 text-gray-700">{school._count?.students ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    school.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {school.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => openBranding(school)}
                    className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                  >
                    <Palette size={14} />
                    <span
                      className="h-3 w-3 rounded-full inline-block border border-gray-200"
                      style={{ backgroundColor: school.primaryColor ?? '#77328D' }}
                    />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Branding modal */}
      {editingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
                <p className="text-sm text-gray-500">{editingSchool.name}</p>
              </div>
              <button onClick={() => setEditingSchool(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα Σχολείου</label>
                <input
                  value={branding.name}
                  onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Λογότυπου</label>
                <input
                  value={branding.logoUrl}
                  onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {branding.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="mt-2 h-10 object-contain" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Κύριο Χρώμα</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBranding({ ...branding, primaryColor: c })}
                      className="relative h-8 w-8 rounded-full"
                      style={{ backgroundColor: c, outline: branding.primaryColor === c ? `3px solid ${c}` : undefined, outlineOffset: '2px' }}
                    >
                      {branding.primaryColor === c && <Check size={13} className="text-white absolute inset-0 m-auto" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    className="h-8 w-8 rounded-full cursor-pointer"
                  />
                </div>
                {/* Preview */}
                <div className="mt-3 flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: branding.primaryColor }}>
                    Preview
                  </button>
                  <div className="h-6 w-6 rounded-lg" style={{ backgroundColor: branding.primaryColor }} />
                  <span className="text-xs text-gray-400 font-mono">{branding.primaryColor}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingSchool(null)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">
                Άκυρο
              </button>
              <button onClick={saveBranding} disabled={saving}
                className="flex-1 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: branding.primaryColor }}>
                {saved ? <Check size={14} /> : <Save size={14} />}
                {saved ? 'Αποθηκεύτηκε!' : saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
