'use client';

import { useEffect, useState } from 'react';
import { busClosuresApi } from '@/lib/api';
import { Trash2 } from 'lucide-react';

type Closure = { id: string; day: string; reason: string };

export function BusClosures({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<Closure[]>([]);
  const [day, setDay] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    busClosuresApi.list(schoolId).then((data) => setRows(Array.isArray(data) ? data : [])).catch(() => setRows([]));
  };

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId]);

  const add = async () => {
    if (!day || !reason.trim()) {
      setError('Βάλε ημερομηνία και λόγο.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await busClosuresApi.create(schoolId, { day, reason: reason.trim() });
      setDay('');
      setReason('');
      load();
    } catch {
      setError('Δεν αποθηκεύτηκε. Δοκίμασε ξανά.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await busClosuresApi.remove(schoolId, id);
    setRows((current) => current.filter((row) => row.id !== id));
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <h2 className="font-semibold text-gray-900">Ημέρες χωρίς σχολικό</h2>
      <p className="text-sm text-gray-500 mt-1">Οι γονείς ενημερώνονται και, εκείνη την ημέρα, το βλέπουν στην εφαρμογή.</p>
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2 mt-3">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="π.χ. απεργία, βλάβη, αργία"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button type="button" onClick={add} disabled={saving} className="px-4 py-2 rounded-lg bg-[#77328D] text-white text-sm font-semibold disabled:opacity-60">
          {saving ? 'Αποθήκευση...' : 'Προσθήκη'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2">
            <span className="text-sm font-semibold text-gray-900 shrink-0">{formatDay(row.day)}</span>
            <span className="text-sm text-gray-700 flex-1">{row.reason}</span>
            <button type="button" onClick={() => remove(row.id)} className="text-gray-400 hover:text-red-600" aria-label="Διαγραφή">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}
