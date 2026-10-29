'use client';

import { useEffect, useState } from 'react';
import { useStoredUser } from '@/lib/auth';
import { schoolsApi } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';

type Holiday = { id: string; date: string; name: string; academicYear?: string };

function currentAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function yearOptions() {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return [-1, 0, 1].map((offset) => `${start + offset}-${start + offset + 1}`);
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function messageOf(error: unknown) {
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message !== 'Internal server error' ? message : '';
}

export default function HolidaysPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';
  const [year, setYear] = useState(currentAcademicYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [error, setError] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);

  const load = async (academicYear: string) => {
    if (!schoolId) return;
    setError('');
    try {
      const holidayRows = await schoolsApi.getHolidays(schoolId, academicYear);
      setHolidays(Array.isArray(holidayRows) ? holidayRows as Holiday[] : []);
    } catch (err) {
      setError(messageOf(err) || 'Τα στοιχεία δεν φορτώθηκαν.');
    }
  };

  useEffect(() => { load(year); }, [schoolId, year]);

  const addHoliday = async () => {
    if (!holiday.date || !holiday.name.trim()) return;
    setSavingHoliday(true);
    setError('');
    try {
      await schoolsApi.createHoliday(schoolId, { ...holiday, name: holiday.name.trim(), academicYear: year });
      setHoliday({ date: '', name: '' });
      await load(year);
    } catch (err) {
      setError(messageOf(err) || 'Η αργία δεν αποθηκεύτηκε.');
    } finally {
      setSavingHoliday(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Σχολικές αργίες</h1>
        <p className="text-sm text-gray-500 mt-1">Αργίες ανά σχολική χρονιά.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {yearOptions().map((label) => (
          <button
            key={label}
            onClick={() => setYear(label)}
            className={`px-3 py-1.5 rounded-full text-sm border ${year === label ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Αργίες {year}</h2>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 mb-4">
            <input type="date" value={holiday.date} onChange={(event) => setHoliday((current) => ({ ...current, date: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input
              type="text"
              placeholder="Ονομασία αργίας"
              value={holiday.name}
              onChange={(event) => setHoliday((current) => ({ ...current, name: event.target.value }))}
              className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={addHoliday} disabled={savingHoliday || !holiday.date || !holiday.name.trim()} className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-40">
              <Plus className="w-4 h-4" /> Προσθήκη
            </button>
          </div>
        )}
        {holidays.length === 0 ? (
          <p className="text-sm text-gray-400">Δεν υπάρχουν αργίες για {year}.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {holidays.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400 w-28">{dayLabel(item.date)}</span>
                  <span className="text-sm text-gray-800">{item.name}</span>
                </div>
                {isAdmin && (
                  <button onClick={() => schoolsApi.deleteHoliday(schoolId, item.id).then(() => load(year))} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
