'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classesApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Plus, Pencil, Trash2, Check, X, Star, ChevronRight } from 'lucide-react';

type AcademicYear = {
  id: string;
  label: string;
  isCurrent: boolean;
  startsOn?: string;
  endsOn?: string;
};

export default function SchoolYearsPage() {
  const router = useRouter();
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', startsOn: '', endsOn: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await classesApi.academicYears(schoolId) as any[];
      setYears(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [schoolId]);

  const startEdit = (y: AcademicYear) => {
    setEditingId(y.id);
    setEditForm({
      label: y.label,
      startsOn: y.startsOn ? y.startsOn.split('T')[0] : '',
      endsOn: y.endsOn ? y.endsOn.split('T')[0] : '',
    });
    setError('');
  };

  const cancelEdit = () => { setEditingId(null); setError(''); };

  const saveEdit = async (y: AcademicYear) => {
    if (!editForm.label.trim()) { setError('Ο τίτλος είναι υποχρεωτικός'); return; }
    setSaving(true); setError('');
    try {
      await classesApi.updateAcademicYear(schoolId, y.id, {
        label: editForm.label.trim(),
        ...(editForm.startsOn ? { startsOn: editForm.startsOn } : {}),
        ...(editForm.endsOn ? { endsOn: editForm.endsOn } : {}),
      });
      setEditingId(null);
      await load();
    } catch (e: any) { setError(e?.message || 'Σφάλμα αποθήκευσης'); }
    finally { setSaving(false); }
  };

  const setAsCurrent = async (y: AcademicYear) => {
    if (y.isCurrent) return;
    setSaving(true); setError('');
    try {
      await classesApi.updateAcademicYear(schoolId, y.id, { isCurrent: true });
      await load();
    } catch (e: any) { setError(e?.message || 'Σφάλμα'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError('');
    try {
      await classesApi.deleteAcademicYear(schoolId, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e: any) { setError(e?.message || 'Σφάλμα διαγραφής'); setDeleteTarget(null); }
    finally { setDeleting(false); }
  };

  const fmt = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Σχολικά Έτη</h1>
          <p className="text-sm text-gray-500 mt-1">Διαχείριση σχολικών ετών</p>
        </div>
        <button
          onClick={() => router.push('/school/new-year')}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#642678] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1d5e]"
        >
          <Plus className="h-4 w-4" /> Νέα Χρονιά
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Φόρτωση...</div>
      ) : years.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm mb-4">Δεν υπάρχουν σχολικά έτη ακόμα.</p>
          <button onClick={() => router.push('/school/new-year')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#642678] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1d5e] mx-auto">
            <Plus className="h-4 w-4" /> Δημιούργησε το πρώτο έτος
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {years.map(y => (
            <div key={y.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${y.isCurrent ? 'border-[#77328d]/40' : 'border-gray-100'}`}>
              {editingId === y.id ? (
                <div className="p-4 space-y-3">
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30"
                    value={editForm.label}
                    onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="π.χ. 2025-2026"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Έναρξη</label>
                      <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30"
                        value={editForm.startsOn} onChange={e => setEditForm(p => ({ ...p, startsOn: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Λήξη</label>
                      <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30"
                        value={editForm.endsOn} onChange={e => setEditForm(p => ({ ...p, endsOn: e.target.value }))} />
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                      <X className="h-3.5 w-3.5" /> Άκυρο
                    </button>
                    <button onClick={() => saveEdit(y)} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#642678] text-white rounded-lg text-sm font-semibold hover:bg-[#4e1d5e] disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" /> {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 px-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{y.label}</span>
                      {y.isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f3e8f7] text-[#642678] rounded-full text-xs font-semibold">
                          <Star className="h-3 w-3" /> Τρέχον
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(y.startsOn)} – {fmt(y.endsOn)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!y.isCurrent && (
                      <button
                        onClick={() => router.push(`/school/new-year?yearId=${y.id}&yearLabel=${encodeURIComponent(y.label)}`)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#642678] border border-[#c4a1d9] rounded-lg hover:bg-[#faf5fc] font-medium"
                        title="Συνέχεια ρύθμισης"
                      >
                        Ρύθμιση <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!y.isCurrent && (
                      <button onClick={() => setAsCurrent(y)} disabled={saving}
                        className="p-1.5 text-gray-400 hover:text-[#642678] rounded-lg hover:bg-[#faf5fc] disabled:opacity-50" title="Ορισμός ως τρέχον">
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => startEdit(y)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50" title="Επεξεργασία">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!y.isCurrent && (
                      <button onClick={() => setDeleteTarget(y)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Διαγραφή">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-bold text-gray-900">Διαγραφή σχολικού έτους</h3>
            <p className="text-sm text-gray-600">
              Θέλεις σίγουρα να διαγράψεις το έτος <strong>{deleteTarget.label}</strong>; Αυτή η ενέργεια δεν αναιρείται.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Άκυρο
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Διαγραφή...' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
