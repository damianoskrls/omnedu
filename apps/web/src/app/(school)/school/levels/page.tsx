'use client';

import { useEffect, useState } from 'react';
import { levelsApi, staffApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  Plus, Pencil, Trash2, X, ChevronRight, Users, GraduationCap, UserCheck,
} from 'lucide-react';
import Link from 'next/link';

const LEVEL_COLORS: Record<string, { bg: string; border: string; dot: string; text: string }> = {
  βρεφικό:      { bg: 'bg-pink-50',   border: 'border-pink-200',   dot: 'bg-pink-400',   text: 'text-pink-700' },
  μεταβρεφικό:  { bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400', text: 'text-orange-700' },
  βρεφονηπιακό: { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400',  text: 'text-amber-700' },
  νηπιακό:      { bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-400', text: 'text-indigo-700' },
  νηπιαγωγείο:  { bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-400', text: 'text-violet-700' },
};

const DEFAULT_COLOR = { bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400', text: 'text-gray-700' };

type Level = {
  id: string;
  name: string;
  description?: string;
  order: number;
  coordinatorId?: string;
  coordinator?: { id: string; fullName: string; avatarUrl?: string };
  coordinatorLinks: { userId: string; user: { id: string; fullName: string; avatarUrl?: string } }[];
  classes: any[];
};

type StaffMember = { userId: string; user: { id: string; fullName: string } };

export default function LevelsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';

  const [levels, setLevels] = useState<Level[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Level | null>(null);
  const [form, setForm] = useState({ name: '', description: '', order: 0, coordinatorIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [lvls, stf] = await Promise.all([
        levelsApi.list(schoolId) as unknown as Promise<Level[]>,
        staffApi.list(schoolId) as unknown as Promise<StaffMember[]>,
      ]);
      setLevels(lvls);
      setStaff(stf);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]);

  const openNew = () => {
    setEditTarget(null);
    setForm({ name: '', description: '', order: levels.length, coordinatorIds: [] });
    setShowForm(true);
  };

  const openEdit = (l: Level) => {
    setEditTarget(l);
    setForm({
      name: l.name,
      description: l.description ?? '',
      order: l.order,
      coordinatorIds: l.coordinatorLinks?.map(c => c.userId) ?? (l.coordinatorId ? [l.coordinatorId] : []),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        order: Number(form.order),
        coordinatorIds: form.coordinatorIds,
      };
      if (editTarget) {
        await levelsApi.update(schoolId, editTarget.id, payload);
      } else {
        await levelsApi.create(schoolId, payload);
      }
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleCoordinator = (userId: string) => {
    setForm(prev => ({
      ...prev,
      coordinatorIds: prev.coordinatorIds.includes(userId)
        ? prev.coordinatorIds.filter(id => id !== userId)
        : [...prev.coordinatorIds, userId],
    }));
  };

  const remove = async (id: string) => {
    if (!confirm('Διαγραφή βαθμίδας;')) return;
    await levelsApi.remove(schoolId, id);
    load();
  };

  const sorted = [...levels].sort((a, b) => a.order - b.order);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Βαθμίδες</h1>
          <p className="text-sm text-gray-500 mt-1">Οργάνωση τάξεων ανά εκπαιδευτική βαθμίδα</p>
        </div>
        {isAdmin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus size={16} /> Νέα Βαθμίδα
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <GraduationCap size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Δεν υπάρχουν βαθμίδες</p>
          {isAdmin && (
            <button onClick={openNew} className="mt-4 text-indigo-600 hover:underline text-sm">
              Δημιουργία πρώτης βαθμίδας
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((level) => {
            const meta = LEVEL_COLORS[level.name.toLowerCase()] ?? DEFAULT_COLOR;
            return (
              <div key={level.id} className={`rounded-xl border ${meta.border} ${meta.bg} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <div className="min-w-0">
                      <h2 className={`text-lg font-semibold capitalize ${meta.text}`}>{level.name}</h2>
                      {level.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{level.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => openEdit(level)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(level.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-white rounded-lg"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  {(level.coordinatorLinks?.length > 0) && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <UserCheck size={14} className="text-gray-400" />
                      <span>
                        {level.coordinatorLinks.length === 1 ? 'Υπεύθυνη: ' : 'Υπεύθυνες: '}
                        <span className="font-medium">
                          {level.coordinatorLinks.map(c => c.user.fullName).join(', ')}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Users size={14} className="text-gray-400" />
                    <span>{level.classes?.length ?? 0} τάξεις</span>
                  </div>
                </div>

                {level.classes && level.classes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {level.classes.map((cls: any) => (
                      <Link
                        key={cls.id}
                        href={`/school/classes/${cls.id}`}
                        className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-1 text-xs hover:border-indigo-300 hover:text-indigo-700"
                      >
                        {cls.name}
                        <ChevronRight size={12} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editTarget ? 'Επεξεργασία Βαθμίδας' : 'Νέα Βαθμίδα'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="πχ. νηπιαγωγείο"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Περιγραφή</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="πχ. 4–6 χρονών"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Σειρά εμφάνισης</label>
                <input
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Υπεύθυνες Εκπαιδευτικοί</label>
                {staff.length === 0 ? (
                  <p className="text-sm text-gray-400">Δεν υπάρχει προσωπικό.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {staff.map((s) => {
                      const checked = form.coordinatorIds.includes(s.userId);
                      return (
                        <label key={s.userId} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCoordinator(s.userId)}
                            className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">{s.user.fullName}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Άκυρο
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
