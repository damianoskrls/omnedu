'use client';

import { useEffect, useState, useMemo } from 'react';
import { studentsApi, classesApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Plus, Search, ChevronRight, X, UserPlus, Trash2, Archive, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function age(dob: string) {
  const diff = Date.now() - new Date(dob).getTime();
  const y = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return y > 0 ? `${y} ετών` : '< 1 έτους';
}

export default function StudentsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const router = useRouter();
  const isAdmin = user?.role === 'school_admin';

  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  // Create modal
  const [showArchived, setShowArchived] = useState(false);
  const [archiveModal, setArchiveModal] = useState<{ id: string; name: string; restore?: boolean; permanentDelete?: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newStudent, setNewStudent] = useState({ fullName: '', dob: '', levelId: '', classId: '', notes: '' });
  const emptyParent = () => ({ fullName: '', email: '', phone: '', relation: 'γονέας' });
  const [newParents, setNewParents] = useState([emptyParent()]);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    Promise.all([
      studentsApi.list(schoolId, undefined, !showArchived ? true : false),
      classesApi.list(schoolId),
    ]).then(([s, c]: any[]) => {
      setStudents(Array.isArray(s) ? s : []);
      setClasses(Array.isArray(c) ? c : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schoolId, showArchived]);

  // Build teacher list from classes
  const teachers = useMemo(() => {
    const map = new Map<string, { userId: string; fullName: string }>();
    classes.forEach((cls) => {
      cls.teachers?.forEach((t: any) => {
        if (!map.has(t.userId)) map.set(t.userId, { userId: t.userId, fullName: t.user.fullName });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [classes]);

  // Class ids taught by selected teacher
  const teacherClassIds = useMemo(() => {
    if (!selectedTeacher) return null;
    return new Set(
      classes
        .filter((cls) => cls.teachers?.some((t: any) => t.userId === selectedTeacher))
        .map((cls) => cls.id),
    );
  }, [selectedTeacher, classes]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const currentEnrollment = s.enrollments?.find((e: any) => e.academicYear?.isCurrent);
      const currentClassId = currentEnrollment?.classId;

      if (search && !s.fullName.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedClass && currentClassId !== selectedClass) return false;
      if (teacherClassIds && (!currentClassId || !teacherClassIds.has(currentClassId))) return false;
      return true;
    });
  }, [students, search, selectedClass, teacherClassIds]);

  const hasFilters = search || selectedClass || selectedTeacher;

  function clearFilters() {
    setSearch('');
    setSelectedClass('');
    setSelectedTeacher('');
  }

  async function handleCreate() {
    if (!newStudent.fullName.trim()) return;
    setCreating(true);
    try {
      const cls = classes.find(c => c.id === newStudent.classId);
      const validParents = newParents.filter(p => p.fullName.trim());
      const created: any = await studentsApi.create(schoolId, {
        fullName: newStudent.fullName.trim(),
        dob: newStudent.dob || undefined,
        notes: newStudent.notes || undefined,
        classId: newStudent.classId || undefined,
        academicYearId: cls?.academicYearId || undefined,
        parents: validParents.length ? validParents.map(p => ({
          fullName: p.fullName.trim(),
          email: p.email.trim() || undefined,
          phone: p.phone.trim() || undefined,
          relation: p.relation || 'γονέας',
        })) : undefined,
      });
      setShowCreate(false);
      setNewStudent({ fullName: '', dob: '', levelId: '', classId: '', notes: '' });
      setNewParents([emptyParent()]);
      router.push(`/school/students/${created.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(studentId: string, archive: boolean) {
    await studentsApi.update(schoolId, studentId, { isActive: !archive });
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setArchiveModal(null);
  }

  async function handlePermanentDelete(studentId: string) {
    await studentsApi.permanentDelete(schoolId, studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setArchiveModal(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {showArchived ? 'Αρχειοθετημένοι Μαθητές' : 'Μαθητές'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? '...' : `${filtered.length} από ${students.length} μαθητές`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => { setShowArchived(v => !v); setSearch(''); setSelectedClass(''); setSelectedTeacher(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${showArchived ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? 'Ενεργοί Μαθητές' : 'Αρχείο'}
            </button>
          )}
          {isAdmin && !showArchived && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Νέος Μαθητής
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Αναζήτηση μαθητή..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          />
        </div>

        <select
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setSelectedTeacher(''); }}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-40"
        >
          <option value="">Όλες οι Τάξεις</option>
          {classes
            .filter((c) => c.academicYear?.isCurrent)
            .map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
        </select>

        <select
          value={selectedTeacher}
          onChange={(e) => { setSelectedTeacher(e.target.value); setSelectedClass(''); }}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-44"
        >
          <option value="">Όλοι οι Εκπαιδευτικοί</option>
          {teachers.map((t) => (
            <option key={t.userId} value={t.userId}>{t.fullName}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg bg-white hover:border-red-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Καθαρισμός
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedClass && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
              Τάξη: {classes.find((c) => c.id === selectedClass)?.name}
              <button onClick={() => setSelectedClass('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {selectedTeacher && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
              Εκπαιδευτικός: {teachers.find((t) => t.userId === selectedTeacher)?.fullName}
              <button onClick={() => setSelectedTeacher('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              Αναζήτηση: "{search}"
              <button onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-52 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <p className="text-gray-400">Δεν βρέθηκαν μαθητές</p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-2 text-indigo-600 text-xs hover:underline">
              Καθαρισμός φίλτρων
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((student) => {
            const currentClass = student.enrollments?.find((e: any) => e.academicYear?.isCurrent);
            const parentNames = student.parents?.map((p: any) => p.user.fullName).join(', ');
            return (
              <div key={student.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow flex flex-col">
                {/* Photo or gradient */}
                <Link href={`/school/students/${student.id}`} className="block">
                  {student.avatarUrl ? (
                    <img
                      src={student.avatarUrl}
                      alt={student.fullName}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                      <span className="text-white font-bold text-3xl">
                        {student.fullName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </Link>

                <div className="p-3 flex-1 flex flex-col">
                  <Link href={`/school/students/${student.id}`} className="font-semibold text-gray-900 text-sm leading-tight hover:text-indigo-700 line-clamp-2">
                    {student.fullName}
                  </Link>

                  <div className="mt-1.5 space-y-0.5">
                    {currentClass?.class?.name && (
                      <p className="text-xs text-indigo-600 font-medium truncate">{currentClass.class.name}</p>
                    )}
                    {student.dob && (
                      <p className="text-xs text-gray-400">{age(student.dob)}</p>
                    )}
                    {parentNames && (
                      <p className="text-xs text-gray-400 truncate">{parentNames}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-end gap-1">
                      {showArchived ? (
                        <>
                          <button
                            onClick={() => setArchiveModal({ id: student.id, name: student.fullName, restore: true })}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            title="Επαναφορά"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setArchiveModal({ id: student.id, name: student.fullName, permanentDelete: true })}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Οριστική διαγραφή"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setArchiveModal({ id: student.id, name: student.fullName })}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors"
                          title="Αρχειοθέτηση"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archive / Restore modal */}
      {archiveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {archiveModal.permanentDelete ? 'Οριστική Διαγραφή' : archiveModal.restore ? 'Επαναφορά Μαθητή' : 'Αρχειοθέτηση Μαθητή'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {archiveModal.permanentDelete
                ? `Ο μαθητής "${archiveModal.name}" θα διαγραφεί οριστικά μαζί με όλα τα δεδομένα του. Αυτή η ενέργεια δεν αναιρείται.`
                : archiveModal.restore
                ? `Θέλετε να επαναφέρετε τον μαθητή "${archiveModal.name}" στους ενεργούς;`
                : `Ο μαθητής "${archiveModal.name}" θα μεταφερθεί στο αρχείο και δεν θα εμφανίζεται στις λίστες. Μπορείτε να τον επαναφέρετε οποιαδήποτε στιγμή.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setArchiveModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Ακύρωση
              </button>
              <button
                onClick={() => archiveModal.permanentDelete ? handlePermanentDelete(archiveModal.id) : handleArchive(archiveModal.id, !archiveModal.restore)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white ${archiveModal.permanentDelete ? 'bg-red-600 hover:bg-red-700' : archiveModal.restore ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {archiveModal.permanentDelete ? 'Οριστική Διαγραφή' : archiveModal.restore ? 'Επαναφορά' : 'Αρχειοθέτηση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create student modal */}
      {showCreate && (() => {
        const currentClasses = classes.filter(c => c.academicYear?.isCurrent);
        const levels = Array.from(
          new Map(currentClasses.filter(c => c.level).map(c => [c.level.id, c.level])).values()
        ).sort((a: any, b: any) => a.name.localeCompare(b.name));
        const classesForLevel = newStudent.levelId
          ? currentClasses.filter(c => c.level?.id === newStudent.levelId)
          : [];
        const selectedClass = classes.find(c => c.id === newStudent.classId);
        const classTeachers: any[] = selectedClass?.teachers ?? [];
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-900">Νέος Μαθητής</h3>
                <button onClick={() => { setShowCreate(false); setNewParents([emptyParent()]); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ονοματεπώνυμο *</label>
                  <input
                    value={newStudent.fullName}
                    onChange={e => setNewStudent({ ...newStudent, fullName: e.target.value })}
                    placeholder="π.χ. Μαρία Παπαδοπούλου"
                    autoFocus
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ημερομηνία Γέννησης</label>
                  <input
                    type="date"
                    value={newStudent.dob}
                    onChange={e => setNewStudent({ ...newStudent, dob: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Βαθμίδα</label>
                  <select
                    value={newStudent.levelId}
                    onChange={e => setNewStudent({ ...newStudent, levelId: e.target.value, classId: '' })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">— Επιλέξτε βαθμίδα —</option>
                    {levels.map((lvl: any) => (
                      <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                    ))}
                  </select>
                </div>
                {newStudent.levelId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Τμήμα</label>
                    {classesForLevel.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">Δεν υπάρχουν τμήματα για αυτή τη βαθμίδα</p>
                    ) : (
                      <div className="space-y-2">
                        {classesForLevel.map((cls: any) => {
                          const isSelected = newStudent.classId === cls.id;
                          const clsTeachers = cls.teachers?.map((t: any) => t.user.fullName).join(', ') || '—';
                          return (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => setNewStudent({ ...newStudent, classId: cls.id })}
                              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="font-medium text-gray-900 text-sm">{cls.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {clsTeachers !== '—' ? `Εκπαιδευτικός: ${clsTeachers}` : 'Χωρίς εκπαιδευτικό'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {classTeachers.length > 0 && newStudent.classId && (
                  <div className="bg-emerald-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                      {classTeachers[0].user.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs text-emerald-700 font-medium">{classTeachers.map((t: any) => t.user.fullName).join(', ')}</div>
                      <div className="text-xs text-emerald-500">Εκπαιδευτικός τμήματος</div>
                    </div>
                  </div>
                )}
                {/* Parents */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-800">Γονείς / Κηδεμόνες</label>
                    {newParents.length < 2 && (
                      <button
                        type="button"
                        onClick={() => setNewParents([...newParents, emptyParent()])}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" /> Προσθήκη 2ου γονέα
                      </button>
                    )}
                  </div>
                  {newParents.map((parent, idx) => (
                    <div key={idx} className={`rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3 ${idx > 0 ? 'mt-3' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {idx === 0 ? 'Κύριος γονέας' : '2ος γονέας / Κηδεμόνας'}
                        </span>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => setNewParents(newParents.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        value={parent.fullName}
                        onChange={e => setNewParents(newParents.map((p, i) => i === idx ? { ...p, fullName: e.target.value } : p))}
                        placeholder="Ονοματεπώνυμο *"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={parent.email}
                          onChange={e => setNewParents(newParents.map((p, i) => i === idx ? { ...p, email: e.target.value } : p))}
                          placeholder="Email"
                          type="email"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <input
                          value={parent.phone}
                          onChange={e => setNewParents(newParents.map((p, i) => i === idx ? { ...p, phone: e.target.value } : p))}
                          placeholder="Τηλέφωνο"
                          type="tel"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                      <select
                        value={parent.relation}
                        onChange={e => setNewParents(newParents.map((p, i) => i === idx ? { ...p, relation: e.target.value } : p))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="γονέας">Γονέας</option>
                        <option value="πατέρας">Πατέρας</option>
                        <option value="μητέρα">Μητέρα</option>
                        <option value="κηδεμόνας">Κηδεμόνας</option>
                        <option value="παππούς/γιαγιά">Παππούς / Γιαγιά</option>
                      </select>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Σημειώσεις</label>
                  <input
                    value={newStudent.notes}
                    onChange={e => setNewStudent({ ...newStudent, notes: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
                <button onClick={() => { setShowCreate(false); setNewParents([emptyParent()]); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Ακύρωση
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newStudent.fullName.trim() || !newParents[0]?.fullName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? 'Δημιουργία...' : 'Δημιουργία'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
