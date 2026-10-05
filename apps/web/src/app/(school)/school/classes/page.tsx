'use client';

import { useEffect, useState, useMemo } from 'react';
import { classesApi, levelsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Plus, Users, BookOpen, ChevronRight, GraduationCap, X } from 'lucide-react';
import Link from 'next/link';

// Ordered levels for Greek kindergartens
const LEVEL_ORDER = ['βρεφικό', 'μεταβρεφικό', 'βρεφονηπιακό', 'νηπιακό', 'νηπιαγωγείο'];

const LEVEL_META: Record<string, { label: string; description: string; color: string; gradient: string; dot: string }> = {
  βρεφικό: {
    label: 'Βρεφικό',
    description: '2–12 μηνών',
    color: 'text-pink-700',
    gradient: 'from-pink-400 to-rose-500',
    dot: 'bg-pink-400',
  },
  μεταβρεφικό: {
    label: 'Μεταβρεφικό',
    description: '12–24 μηνών',
    color: 'text-orange-700',
    gradient: 'from-orange-400 to-amber-500',
    dot: 'bg-orange-400',
  },
  βρεφονηπιακό: {
    label: 'Βρεφονηπιακό',
    description: '2–3 χρονών',
    color: 'text-amber-700',
    gradient: 'from-amber-400 to-yellow-500',
    dot: 'bg-amber-400',
  },
  νηπιακό: {
    label: 'Νηπιακό',
    description: '3–4 χρονών',
    color: 'text-indigo-700',
    gradient: 'from-indigo-400 to-blue-500',
    dot: 'bg-indigo-400',
  },
  νηπιαγωγείο: {
    label: 'Νηπιαγωγείο',
    description: '4–6 χρονών',
    color: 'text-violet-700',
    gradient: 'from-violet-400 to-purple-500',
    dot: 'bg-violet-400',
  },
};

const UNKNOWN_META = {
  label: 'Άλλο',
  description: '',
  color: 'text-gray-700',
  gradient: 'from-gray-400 to-slate-500',
  dot: 'bg-gray-400',
};

export default function ClassesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', levelId: '', academicYearId: '', ageGroup: '', capacity: '' });

  const load = () => {
    if (!schoolId) return;
    classesApi.list(schoolId).then((data: any) => {
      setClasses(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (!schoolId) return;
    levelsApi.list(schoolId).then((d: any) => setLevels(Array.isArray(d) ? d : []));
    classesApi.academicYears(schoolId).then((d: any) => setAcademicYears(Array.isArray(d) ? d : []));
  }, [schoolId]);

  const currentAcademicYear = academicYears.find(y => y.isCurrent);

  const createClass = async () => {
    if (!newClass.name.trim() || !newClass.academicYearId) return;
    setSaving(true);
    try {
      await classesApi.create(schoolId, {
        name: newClass.name.trim(),
        academicYearId: newClass.academicYearId,
        levelId: newClass.levelId || undefined,
        ageGroup: newClass.ageGroup || undefined,
        capacity: newClass.capacity ? Number(newClass.capacity) : undefined,
      });
      setShowCreate(false);
      setNewClass({ name: '', levelId: '', academicYearId: currentAcademicYear?.id ?? '', ageGroup: '', capacity: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  // Only current year classes, grouped by level
  const currentClasses = useMemo(() =>
    classes.filter((c) => c.academicYear?.isCurrent),
    [classes],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    currentClasses.forEach((cls) => {
      const key = (cls.level?.name ?? cls.level ?? '__other__').toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cls);
    });

    // Sort by LEVEL_ORDER
    const ordered: Array<{ key: string; classes: any[] }> = [];
    LEVEL_ORDER.forEach((lvl) => {
      if (map.has(lvl)) ordered.push({ key: lvl, classes: map.get(lvl)! });
    });
    // Append anything not in the order list
    map.forEach((v, k) => {
      if (!LEVEL_ORDER.includes(k)) ordered.push({ key: k, classes: v });
    });
    return ordered;
  }, [currentClasses]);

  const totalStudents = currentClasses.reduce((sum, c) => sum + (c._count?.enrollments ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Τάξεις</h1>
          <p className="text-gray-500 text-sm mt-1">
            {currentClasses.length} τάξεις · {totalStudents} μαθητές
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setNewClass(p => ({ ...p, academicYearId: currentAcademicYear?.id ?? '' })); setShowCreate(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Νέα Τάξη
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-12">Φόρτωση...</p>
      ) : currentClasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          Δεν υπάρχουν τάξεις για το τρέχον σχολικό έτος
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ key, classes: levelClasses }) => {
            const meta = LEVEL_META[key] ?? UNKNOWN_META;
            const sectionStudents = levelClasses.reduce((sum, c) => sum + (c._count?.enrollments ?? 0), 0);

            return (
              <div key={key}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`h-3 w-3 rounded-full ${meta.dot} flex-shrink-0`} />
                  <h2 className={`text-base font-bold ${meta.color}`}>{meta.label}</h2>
                  {meta.description && (
                    <span className="text-xs text-gray-400">{meta.description}</span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {levelClasses.length} {levelClasses.length === 1 ? 'τάξη' : 'τάξεις'} · {sectionStudents} μαθητές
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {levelClasses.map((cls) => {
                    const primaryTeacher = cls.teachers?.find((t: any) => t.isPrimary);
                    const count = cls._count?.enrollments ?? 0;
                    const capacity = cls.capacity;

                    return (
                      <Link
                        key={cls.id}
                        href={`/school/classes/${cls.id}`}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group hover:border-indigo-100"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-2.5 bg-gradient-to-br ${meta.gradient} rounded-xl shadow-sm`}>
                            <BookOpen className="h-5 w-5 text-white" />
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors mt-0.5" />
                        </div>

                        <h3 className="font-semibold text-gray-900 text-base">{cls.name}</h3>
                        {cls.ageGroup && (
                          <p className="text-xs text-gray-400 mt-0.5">{cls.ageGroup}</p>
                        )}

                        <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {count}
                            {capacity ? ` / ${capacity}` : ''} μαθητές
                          </span>
                        </div>

                        {/* Capacity bar */}
                        {capacity && capacity > 0 && (
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${meta.gradient} rounded-full transition-all`}
                              style={{ width: `${Math.min(100, (count / capacity) * 100)}%` }}
                            />
                          </div>
                        )}

                        {/* Primary teacher */}
                        {primaryTeacher && (
                          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-50">
                            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
                              {primaryTeacher.user.fullName.slice(0, 1)}
                            </div>
                            <span className="text-xs text-gray-500 truncate">{primaryTeacher.user.fullName}</span>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Νέα Τάξη</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Όνομα τάξης *</label>
                <input
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="π.χ. Butterflies, Αστεράκια..."
                  value={newClass.name}
                  onChange={e => setNewClass(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Σχολικό έτος *</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newClass.academicYearId}
                  onChange={e => setNewClass(p => ({ ...p, academicYearId: e.target.value }))}
                >
                  <option value="">Επιλέξτε έτος...</option>
                  {academicYears.map((y: any) => (
                    <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? ' (τρέχον)' : ''}</option>
                  ))}
                </select>
              </div>
              {levels.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Επίπεδο</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newClass.levelId}
                    onChange={e => setNewClass(p => ({ ...p, levelId: e.target.value }))}
                  >
                    <option value="">Χωρίς επίπεδο</option>
                    {levels.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ηλικιακή ομάδα</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="π.χ. 4-6 ετών"
                    value={newClass.ageGroup}
                    onChange={e => setNewClass(p => ({ ...p, ageGroup: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Χωρητικότητα</label>
                  <input
                    type="number" min="1"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="π.χ. 20"
                    value={newClass.capacity}
                    onChange={e => setNewClass(p => ({ ...p, capacity: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Ακύρωση
              </button>
              <button
                onClick={createClass}
                disabled={saving || !newClass.name.trim() || !newClass.academicYearId}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Αποθήκευση...' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
