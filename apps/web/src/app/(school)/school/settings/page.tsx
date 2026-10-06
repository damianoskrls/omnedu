'use client';

import { useEffect, useState, useRef } from 'react';
import { useStoredUser } from '@/lib/auth';
import { schoolsApi } from '@/lib/api';
import { User, Bell, Palette, Save, Check, CalendarDays, Trash2, Plus, Upload } from 'lucide-react';

type Holiday = { id: string; date: string; name: string; academicYear?: string };

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

const PRESET_COLORS = [
  { hex: '#77328D', label: 'Ονειροχώρα' },
  { hex: '#E95926', label: 'Πορτοκαλί' },
  { hex: '#4F46E5', label: 'Indigo' },
  { hex: '#7C3AED', label: 'Violet' },
  { hex: '#0891B2', label: 'Cyan' },
  { hex: '#059669', label: 'Emerald' },
  { hex: '#D97706', label: 'Amber' },
  { hex: '#DC2626', label: 'Red' },
  { hex: '#DB2777', label: 'Pink' },
  { hex: '#1D4ED8', label: 'Blue' },
];

export default function SchoolSettingsPage() {
  const user = useStoredUser();
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';
  const schoolId = user?.schoolId ?? '';
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [school, setSchool] = useState<any>(null);
  const [branding, setBranding] = useState({ name: '', logoUrl: '', primaryColor: '#77328D' });
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayYear, setHolidayYear] = useState(currentAcademicYear());
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [savingHoliday, setSavingHoliday] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    schoolsApi.get(schoolId).then((s: any) => {
      setSchool(s);
      const b = {
        name: s.name ?? '',
        logoUrl: s.logoUrl ?? '',
        primaryColor: s.primaryColor ?? '#77328D',
      };
      setBranding(b);
      // Keep localStorage in sync so sidebar shows current branding immediately
      if (b.name) localStorage.setItem('school_name', b.name);
      if (b.logoUrl) localStorage.setItem('school_logo_url', b.logoUrl);
      if (b.primaryColor) localStorage.setItem('school_primary_color', b.primaryColor);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    schoolsApi.getHolidays(schoolId, holidayYear).then((h: any) => setHolidays(Array.isArray(h) ? h : []));
  }, [schoolId, holidayYear]);

  const addHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name.trim()) return;
    setSavingHoliday(true);
    try {
      const h = await schoolsApi.createHoliday(schoolId, { ...newHoliday, academicYear: holidayYear }) as unknown as Holiday;
      setHolidays(prev => [...prev, h].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHoliday({ date: '', name: '' });
    } finally {
      setSavingHoliday(false);
    }
  };

  const removeHoliday = async (id: string) => {
    await schoolsApi.deleteHoliday(schoolId, id);
    setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const uploadLogo = async (file: File) => {
    if (!schoolId) return;
    setUploadingLogo(true);
    try {
      const result = await schoolsApi.uploadLogo(schoolId, file) as unknown as { logoUrl: string };
      setBranding(prev => ({ ...prev, logoUrl: result.logoUrl }));
      localStorage.setItem('school_logo_url', result.logoUrl);
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveBranding = async () => {
    if (!schoolId) return;
    setSavingBranding(true);
    try {
      await schoolsApi.updateBranding(schoolId, {
        name: branding.name || undefined,
        logoUrl: branding.logoUrl || undefined,
        primaryColor: branding.primaryColor,
      });
      // Keep localStorage in sync so sidebar picks up changes immediately
      if (branding.name) localStorage.setItem('school_name', branding.name);
      if (branding.logoUrl) localStorage.setItem('school_logo_url', branding.logoUrl);
      else localStorage.removeItem('school_logo_url');
      localStorage.setItem('school_primary_color', branding.primaryColor);
      document.documentElement.style.setProperty('--school-primary', branding.primaryColor);
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 2000);
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ρυθμίσεις</h1>
        <p className="text-gray-500 text-sm mt-1">Προτιμήσεις λογαριασμού και σχολείου</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Προφίλ</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Όνομα</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{user?.fullName}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{user?.email}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ρόλος</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 capitalize">
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>
        </section>

        {/* Branding — admin only */}
        {isAdmin && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-indigo-600" />
              <h2 className="font-semibold text-gray-800">Branding Σχολείου</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα Σχολείου</label>
                <input
                  value={branding.name}
                  onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                  className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Λογότυπο</label>
                <div className="flex items-start gap-4">
                  {branding.logoUrl ? (
                    <div className="relative group shrink-0">
                      <img src={branding.logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-xl border border-gray-200 bg-gray-50 p-1" />
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="absolute inset-0 bg-black/40 rounded-xl hidden group-hover:flex items-center justify-center"
                      >
                        <Upload size={16} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload size={18} />
                      )}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Ανεβάστε αρχείο (PNG, JPG, SVG, max 5MB)</p>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }}
                    />
                    <input
                      value={branding.logoUrl}
                      onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                      placeholder="ή επικολλήστε URL..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {branding.logoUrl && (
                      <button onClick={() => setBranding(p => ({ ...p, logoUrl: '' }))} className="mt-1 text-xs text-red-400 hover:text-red-600">
                        Αφαίρεση λογότυπου
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Κύριο Χρώμα</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setBranding({ ...branding, primaryColor: c.hex })}
                      title={c.label}
                      className="relative h-9 w-9 rounded-full ring-offset-2 transition-all"
                      style={{ backgroundColor: c.hex, ring: branding.primaryColor === c.hex ? `2px solid ${c.hex}` : undefined }}
                    >
                      {branding.primaryColor === c.hex && (
                        <Check size={14} className="text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="h-9 w-9 rounded-full cursor-pointer border-0 p-0"
                    />
                    <span className="text-sm text-gray-500 font-mono">{branding.primaryColor}</span>
                  </div>
                </div>

                {/* Live preview */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    Προεπισκόπηση κουμπιού
                  </button>
                  <span
                    className="px-3 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    Badge
                  </span>
                </div>
              </div>

              <button
                onClick={saveBranding}
                disabled={savingBranding}
                className="flex items-center gap-2 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {brandingSaved ? <Check size={15} /> : <Save size={15} />}
                {brandingSaved ? 'Αποθηκεύτηκε!' : savingBranding ? 'Αποθήκευση...' : 'Αποθήκευση Branding'}
              </button>
            </div>
          </section>
        )}

        {/* Holidays — admin only */}
        {isAdmin && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
                <h2 className="font-semibold text-gray-800">Σχολικές Αργίες</h2>
              </div>
              <select
                value={holidayYear}
                onChange={e => setHolidayYear(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {[0, 1, -1].map(offset => {
                  const now = new Date();
                  const y = now.getFullYear() + offset;
                  const label = now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1 + offset}-${y + offset}`;
                  const yr = now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
                  const baseY = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
                  const yr2 = `${baseY + offset}-${baseY + offset + 1}`;
                  return <option key={yr2} value={yr2}>{yr2}</option>;
                })}
              </select>
            </div>

            {/* Add new */}
            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={newHoliday.date}
                onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Ονομασία αργίας..."
                value={newHoliday.name}
                onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={e => e.key === 'Enter' && addHoliday()}
              />
              <button
                onClick={addHoliday}
                disabled={savingHoliday || !newHoliday.date || !newHoliday.name.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            {holidays.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Δεν υπάρχουν αργίες για {holidayYear}</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {holidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-400 w-24">
                        {new Date(h.date).toLocaleDateString('el-GR', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-sm text-gray-800">{h.name}</span>
                    </div>
                    <button
                      onClick={() => removeHoliday(h.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Notifications */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Ειδοποιήσεις</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Ημερήσιο σημείωμα', desc: 'Ειδοποίηση όταν ο δάσκαλος συμπληρώσει σημείωμα' },
              { label: 'Νέο μήνυμα', desc: 'Ειδοποίηση για νέα μηνύματα' },
              { label: 'Εκπρόθεσμη πληρωμή', desc: 'Ειδοποίηση για εκπρόθεσμα τιμολόγια' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.desc}</div>
                </div>
                <div className="h-5 w-9 bg-indigo-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 h-4 w-4 bg-white rounded-full shadow" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
