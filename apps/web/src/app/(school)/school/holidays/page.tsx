'use client';

import { useEffect, useState } from 'react';
import { useStoredUser } from '@/lib/auth';
import { schoolsApi } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';

type Holiday = { id: string; date: string; name: string; academicYear?: string };
type Absence = {
  id: string;
  date: string;
  note?: string | null;
  reason?: string | null;
  academicYear?: string;
  teacher?: { id: string; fullName: string };
  substitute?: { id: string; fullName: string } | null;
};
type Teacher = { user?: { id: string; fullName: string }; userId?: string };

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
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [absence, setAbsence] = useState({ teacherUserId: '', substituteUserId: '', date: '', endDate: '', reason: 'ασθένεια', note: '' });
  const [error, setError] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [savingAbsence, setSavingAbsence] = useState(false);

  const load = async (academicYear: string) => {
    if (!schoolId) return;
    setError('');
    try {
      const [holidayRows, absenceRows, members] = await Promise.all([
        schoolsApi.getHolidays(schoolId, academicYear),
        schoolsApi.getTeacherAbsences(schoolId, academicYear),
        schoolsApi.getMembers(schoolId, 'teacher'),
      ]);
      setHolidays(Array.isArray(holidayRows) ? holidayRows as Holiday[] : []);
      setAbsences(Array.isArray(absenceRows) ? absenceRows as Absence[] : []);
      setTeachers(Array.isArray(members) ? members as Teacher[] : []);
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

  const addAbsence = async () => {
    if (!absence.teacherUserId || !absence.date) return;
    setSavingAbsence(true);
    setError('');
    try {
      await schoolsApi.createTeacherAbsence(schoolId, {
        teacherUserId: absence.teacherUserId,
        substituteUserId: absence.substituteUserId,
        date: absence.date,
        endDate: absence.endDate || absence.date,
        reason: absence.reason,
        note: absence.note.trim(),
        academicYear: year,
      });
      setAbsence({ teacherUserId: '', substituteUserId: '', date: '', endDate: '', reason: 'ασθένεια', note: '' });
      await load(year);
    } catch (err) {
      setError(messageOf(err) || 'Η απουσία δεν αποθηκεύτηκε.');
    } finally {
      setSavingAbsence(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Σχολικές αργίες</h1>
        <p className="text-sm text-gray-500 mt-1">Αργίες ανά σχολική χρονιά και ημέρες που απουσιάζει ένας εκπαιδευτικός. Οι γονείς της τάξης του λαμβάνουν ειδοποίηση.</p>
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

      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
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

      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-1">Απουσία εκπαιδευτικού</h2>
        <p className="text-sm text-gray-500 mb-4">Με την αποθήκευση ενημερώνονται οι γονείς. Αν ορίσεις αντικαταστάτη, εκείνος βλέπει τα παιδιά της τάξης μόνο αυτές τις ημέρες για να περάσει την ημερήσια ενημέρωση.</p>
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            <select value={absence.teacherUserId} onChange={(event) => setAbsence((current) => ({ ...current, teacherUserId: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Εκπαιδευτικός που λείπει</option>
              {teachers.map((member) => {
                const id = member.user?.id || member.userId || '';
                const name = member.user?.fullName || 'Εκπαιδευτικός';
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
            <select value={absence.substituteUserId} onChange={(event) => setAbsence((current) => ({ ...current, substituteUserId: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Αντικαταστάτης, προαιρετικά</option>
              {teachers.map((member) => {
                const id = member.user?.id || member.userId || '';
                if (!id || id === absence.teacherUserId) return null;
                const name = member.user?.fullName || 'Εκπαιδευτικός';
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
            <label className="text-xs text-gray-500">Από
              <input type="date" value={absence.date} onChange={(event) => setAbsence((current) => ({ ...current, date: event.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">Έως
              <input type="date" value={absence.endDate} onChange={(event) => setAbsence((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </label>
            <select value={absence.reason} onChange={(event) => setAbsence((current) => ({ ...current, reason: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="ασθένεια">Ασθένεια</option>
              <option value="άδεια">Άδεια</option>
              <option value="προσωπικοί λόγοι">Προσωπικοί λόγοι</option>
              <option value="επιμόρφωση">Επιμόρφωση</option>
              <option value="άλλο">Άλλο</option>
            </select>
            <input
              type="text"
              placeholder="Σημείωση, προαιρετικά"
              value={absence.note}
              onChange={(event) => setAbsence((current) => ({ ...current, note: event.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={addAbsence} disabled={savingAbsence || !absence.teacherUserId || !absence.date} className="sm:col-span-2 justify-self-start px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-40">
              {savingAbsence ? 'Αποθήκευση...' : 'Αποθήκευση και ειδοποίηση γονέων'}
            </button>
          </div>
        )}
        {absences.length === 0 ? (
          <p className="text-sm text-gray-400">Δεν υπάρχουν απουσίες για {year}.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {absences.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2.5 gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.teacher?.fullName ?? 'Εκπαιδευτικός'}</p>
                  <p className="text-xs text-gray-500">
                    {dayLabel(item.date)}
                    {item.reason ? ` · ${item.reason}` : ''}
                    {item.substitute?.fullName ? ` · αντικατάσταση: ${item.substitute.fullName}` : ''}
                    {item.note ? ` · ${item.note}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => schoolsApi.deleteTeacherAbsence(schoolId, item.id).then(() => load(year))} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
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
