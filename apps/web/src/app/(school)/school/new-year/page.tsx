'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { classesApi, studentsApi, levelsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { ChevronRight, ChevronLeft, Check, GraduationCap, Users, Sparkles, BookOpen, Plus, X } from 'lucide-react';

type Student = { id: string; fullName: string; avatarUrl?: string; isActive: boolean };
type Level = { id: string; name: string };
type Class = { id: string; name: string; academicYearId: string; level?: { id: string; name: string } };
type AcademicYear = { id: string; label: string; isCurrent: boolean; startsOn?: string; endsOn?: string };

const STEPS = [
  { id: 1, label: 'Νέο Σχολικό Έτος', icon: Sparkles },
  { id: 2, label: 'Μαθητές', icon: Users },
  { id: 3, label: 'Τάξεις', icon: BookOpen },
  { id: 4, label: 'Ολοκλήρωση', icon: Check },
];

function NewYearWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — new year data
  const [yearForm, setYearForm] = useState({ label: '', startsOn: '', endsOn: '' });
  const [newYearId, setNewYearId] = useState('');
  const [existingYearWarning, setExistingYearWarning] = useState<AcademicYear | null>(null);

  // Step 2 — students
  const [students, setStudents] = useState<Student[]>([]);
  const [continuing, setContinuing] = useState<Set<string>>(new Set());

  // Step 3 — class assignments + inline class creation
  const [levels, setLevels] = useState<Level[]>([]);
  const [newClasses, setNewClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // studentId → classId
  const [existingYears, setExistingYears] = useState<AcademicYear[]>([]);
  const [addClassName, setAddClassName] = useState('');
  const [addClassLevel, setAddClassLevel] = useState('');
  const [addingClass, setAddingClass] = useState(false);

  // Step 3 — copy from previous year
  const [prevYearClasses, setPrevYearClasses] = useState<Class[]>([]);
  const [prevYearLabel, setPrevYearLabel] = useState('');
  const [copySelections, setCopySelections] = useState<Record<string, { checked: boolean; name: string; levelId: string }>>({});
  const [copyingClasses, setCopyingClasses] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      studentsApi.list(schoolId, undefined, true) as Promise<any>,
      levelsApi.list(schoolId) as Promise<any>,
      classesApi.academicYears(schoolId) as Promise<any>,
    ]).then(([s, l, y]) => {
      setStudents(Array.isArray(s) ? s : []);
      setContinuing(new Set((Array.isArray(s) ? s : []).map((st: Student) => st.id)));
      setLevels(Array.isArray(l) ? l : []);
      setExistingYears(Array.isArray(y) ? y : []);
    });

    // Support resuming setup of an existing year via ?yearId=...&yearLabel=...
    const resumeId = searchParams.get('yearId');
    const resumeLabel = searchParams.get('yearLabel');
    if (resumeId && resumeLabel) {
      setNewYearId(resumeId);
      setYearForm(p => ({ ...p, label: resumeLabel }));
      classesApi.list(schoolId).then((allClasses: any) => {
        const yearClasses = Array.isArray(allClasses) ? allClasses.filter((c: any) => c.academicYearId === resumeId) : [];
        setNewClasses(yearClasses);
        setStep(2);
      });
    }
  }, [schoolId, searchParams]);

  // Load classes from the most recent OTHER year when entering Step 3
  useEffect(() => {
    if (step !== 3 || !schoolId || !newYearId || existingYears.length === 0) return;
    const prevYear = existingYears.find(y => y.id !== newYearId);
    if (!prevYear) return;
    setPrevYearLabel(prevYear.label);
    classesApi.list(schoolId).then((allClasses: any) => {
      const prev = Array.isArray(allClasses) ? allClasses.filter((c: any) => c.academicYearId === prevYear.id) : [];
      setPrevYearClasses(prev);
      setCopySelections(Object.fromEntries(
        prev.map((c: any) => [c.id, { checked: true, name: c.name, levelId: c.level?.id || '' }])
      ));
    });
  }, [step, schoolId, newYearId, existingYears]);

  const suggestLabel = () => {
    const latest = existingYears[0];
    if (!latest) return '';
    const match = latest.label.match(/(\d{4})-(\d{4})/);
    if (match) return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
    return '';
  };

  const handleStep1 = async () => {
    if (!yearForm.label || !yearForm.startsOn || !yearForm.endsOn) { setError('Συμπλήρωσε όλα τα πεδία'); return; }
    const duplicate = existingYears.find(y => y.label.trim() === yearForm.label.trim());
    if (duplicate) { setExistingYearWarning(duplicate); return; }
    await doCreateYear();
  };

  const doCreateYear = async (existingId?: string) => {
    if (existingId) {
      setNewYearId(existingId);
      setExistingYearWarning(null);
      setError('');
      const allClasses = await classesApi.list(schoolId) as unknown as any[];
      const yearClasses = Array.isArray(allClasses) ? allClasses.filter((c: any) => c.academicYearId === existingId) : [];
      setNewClasses(yearClasses);
      setStep(2);
      return;
    }
    setSaving(true); setError('');
    try {
      const res = await classesApi.createAcademicYear(schoolId, { ...yearForm, isCurrent: false }) as any;
      setNewYearId(res.id);
      const allClasses = await classesApi.list(schoolId) as unknown as any[];
      const yearClasses = Array.isArray(allClasses) ? allClasses.filter((c: any) => c.academicYearId === res.id) : [];
      setNewClasses(yearClasses);
      setStep(2);
    } catch (e: any) { setError(e?.message || 'Σφάλμα δημιουργίας'); }
    finally { setSaving(false); }
  };

  const handleStep2 = () => { setError(''); setStep(3); };

  const handleAddClass = async () => {
    if (!addClassName.trim() || !newYearId) return;
    setAddingClass(true);
    try {
      await classesApi.create(schoolId, {
        name: addClassName.trim(),
        academicYearId: newYearId,
        ...(addClassLevel ? { levelId: addClassLevel } : {}),
      });
      setAddClassName('');
      setAddClassLevel('');
      await refreshClasses();
    } catch (_) {}
    finally { setAddingClass(false); }
  };

  const refreshClasses = async () => {
    if (!newYearId) return;
    const allClasses = await classesApi.list(schoolId) as unknown as any[];
    const yearClasses = Array.isArray(allClasses) ? allClasses.filter((c: any) => c.academicYearId === newYearId) : [];
    setNewClasses(yearClasses);
  };

  const handleCopyClasses = async () => {
    const toCopy = prevYearClasses.filter(c => copySelections[c.id]?.checked);
    if (!toCopy.length || !newYearId) return;
    setCopyingClasses(true);
    try {
      for (const c of toCopy) {
        const sel = copySelections[c.id];
        const alreadyExists = newClasses.some(nc => nc.name.trim().toLowerCase() === sel.name.trim().toLowerCase());
        if (alreadyExists) continue;
        await classesApi.create(schoolId, {
          name: sel.name.trim(),
          academicYearId: newYearId,
          ...(sel.levelId ? { levelId: sel.levelId } : {}),
        });
      }
      await refreshClasses();
    } catch (_) {}
    finally { setCopyingClasses(false); }
  };

  const handleDeleteClass = async (classId: string) => {
    setDeletingClassId(classId);
    try {
      await classesApi.remove(schoolId, classId);
      await refreshClasses();
      setAssignments(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (n[k] === classId) delete n[k]; }); return n; });
    } catch (_) {}
    finally { setDeletingClassId(null); }
  };

  const handleStep3 = () => {
    const continuingList = students.filter(s => continuing.has(s.id));
    const unassigned = continuingList.filter(s => !assignments[s.id]);
    if (unassigned.length > 0) { setError(`${unassigned.length} μαθητές δεν έχουν τάξη. Ανάθεσε τάξη σε όλους ή επέστρεψε να τους αφαιρέσεις.`); return; }
    setError(''); setStep(4);
  };

  const handleFinish = async () => {
    setSaving(true); setError('');
    try {
      const continuingIds = new Set(continuing);
      const studentRollovers = students
        .filter(s => continuingIds.has(s.id) && assignments[s.id])
        .map(s => ({ studentId: s.id, newClassId: assignments[s.id] }));
      const deactivateStudentIds = students.filter(s => !continuingIds.has(s.id)).map(s => s.id);
      await classesApi.rollover(schoolId, newYearId, { studentRollovers, deactivateStudentIds, activate: true });
      router.push('/school/students');
    } catch (e: any) { setError(e?.message || 'Σφάλμα ολοκλήρωσης'); }
    finally { setSaving(false); }
  };

  const continuingStudents = students.filter(s => continuing.has(s.id));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Νέα Σχολική Χρονιά</h1>
        <p className="text-sm text-gray-500 mt-1">Δημιουργία νέου σχολικού έτους και μετάβαση μαθητών</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                done ? 'bg-emerald-50 text-emerald-700' : active ? 'bg-[#f3e8f7] text-[#642678]' : 'bg-gray-50 text-gray-400'
              }`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-[#642678] text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* ── Step 1: New year ── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-900">Στοιχεία Σχολικού Έτους</h2>
            {existingYearWarning && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                <p className="text-sm text-amber-800">
                  Το έτος <strong>{existingYearWarning.label}</strong> υπάρχει ήδη. Θέλεις να συνεχίσεις τη ρύθμισή του;
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => doCreateYear(existingYearWarning.id)}
                    className="px-4 py-2 bg-[#642678] text-white rounded-lg text-sm font-semibold hover:bg-[#4e1d5e]"
                  >
                    Συνέχεια ρύθμισης &rarr;
                  </button>
                  <button
                    onClick={() => setExistingYearWarning(null)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Άκυρο
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Τίτλος (π.χ. 2025-2026) *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30"
                value={yearForm.label}
                onChange={e => { setYearForm(p => ({ ...p, label: e.target.value })); setExistingYearWarning(null); }}
                placeholder={suggestLabel() || '2025-2026'}
              />
              {suggestLabel() && (
                <button className="mt-1 text-xs text-[#642678] hover:underline" onClick={() => setYearForm(p => ({ ...p, label: suggestLabel() }))}>
                  Χρήση &ldquo;{suggestLabel()}&rdquo;
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Έναρξη *</label>
                <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30"
                  value={yearForm.startsOn} onChange={e => setYearForm(p => ({ ...p, startsOn: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Λήξη *</label>
                <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30"
                  value={yearForm.endsOn} onChange={e => setYearForm(p => ({ ...p, endsOn: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleStep1} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#642678] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1d5e] disabled:opacity-50">
                {saving ? 'Δημιουργία...' : 'Επόμενο'} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Students ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Μαθητές που συνεχίζουν</h2>
              <span className="text-xs text-gray-500">{continuing.size} / {students.length} επιλεγμένοι</span>
            </div>
            <p className="text-sm text-gray-500">Αποεπίλεξε τους μαθητές που δεν θα συνεχίσουν (π.χ. αποφοίτησαν).</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {students.map(s => {
                const on = continuing.has(s.id);
                return (
                  <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${on ? 'border-[#77328d]/30 bg-[#faf5fc]' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <input type="checkbox" checked={on} onChange={() => {
                      setContinuing(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
                      setAssignments(prev => { const n = { ...prev }; delete n[s.id]; return n; });
                    }} className="rounded accent-[#642678]" />
                    <GraduationCap className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-800">{s.fullName}</span>
                    {!on && <span className="ml-auto text-xs text-red-500 font-medium">Αποχωρεί</span>}
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" /> Πίσω
              </button>
              <button onClick={handleStep2} className="flex items-center gap-2 px-5 py-2.5 bg-[#642678] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1d5e]">
                Επόμενο <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Class assignments + inline class creation ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900">Ανάθεση Τάξεων</h2>

            {/* Copy from previous year */}
            {prevYearClasses.length > 0 && (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Αντέγραψε τάξεις από {prevYearLabel}
                </p>
                <div className="space-y-2 max-h-[24vh] overflow-y-auto">
                  {prevYearClasses.map(c => {
                    const sel = copySelections[c.id] ?? { checked: false, name: c.name, levelId: c.level?.id || '' };
                    const alreadyCopied = newClasses.some(nc => nc.name.trim().toLowerCase() === c.name.trim().toLowerCase());
                    return (
                      <div key={c.id} className={`flex items-center gap-2 p-2 rounded-lg ${alreadyCopied ? 'opacity-40' : ''}`}>
                        <input
                          type="checkbox"
                          checked={sel.checked && !alreadyCopied}
                          disabled={alreadyCopied}
                          onChange={() => setCopySelections(p => ({ ...p, [c.id]: { ...sel, checked: !sel.checked } }))}
                          className="rounded accent-[#642678] shrink-0"
                        />
                        <input
                          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30 bg-white disabled:bg-gray-50"
                          value={sel.name}
                          disabled={alreadyCopied}
                          onChange={e => setCopySelections(p => ({ ...p, [c.id]: { ...sel, name: e.target.value } }))}
                        />
                        {c.level && <span className="text-xs text-gray-400 shrink-0">{c.level.name}</span>}
                        {alreadyCopied && <span className="text-xs text-emerald-600 font-medium shrink-0">✓ Αντιγράφηκε</span>}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleCopyClasses}
                  disabled={copyingClasses || !prevYearClasses.some(c => copySelections[c.id]?.checked && !newClasses.some(nc => nc.name.trim().toLowerCase() === c.name.trim().toLowerCase()))}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  {copyingClasses ? 'Αντιγραφή...' : 'Αντιγραφή επιλεγμένων'}
                </button>
              </div>
            )}

            {/* Inline class creation */}
            <div className="rounded-xl bg-[#faf5fc] border border-[#e9d5f5] p-4 space-y-3">
              <p className="text-xs font-semibold text-[#642678] uppercase tracking-wide">Δημιούργησε τάξη για το έτος {yearForm.label}</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30 bg-white"
                  placeholder="π.χ. Α1, Νηπιαγωγείο..."
                  value={addClassName}
                  onChange={e => setAddClassName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddClass(); }}
                />
                {levels.length > 0 && (
                  <select
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30 bg-white"
                    value={addClassLevel}
                    onChange={e => setAddClassLevel(e.target.value)}
                  >
                    <option value="">Επίπεδο</option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
                <button
                  onClick={handleAddClass}
                  disabled={addingClass || !addClassName.trim()}
                  className="flex items-center gap-1 px-3 py-2 bg-[#642678] text-white rounded-lg text-sm font-semibold hover:bg-[#4e1d5e] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {addingClass ? '...' : 'Προσθήκη'}
                </button>
              </div>
              {newClasses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newClasses.map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#c4a1d9] rounded-lg text-xs font-medium text-[#642678]">
                      {c.name}{c.level ? ` · ${c.level.name}` : ''}
                      <button
                        onClick={() => handleDeleteClass(c.id)}
                        disabled={deletingClassId === c.id}
                        className="ml-1 text-[#c4a1d9] hover:text-red-500 disabled:opacity-40"
                        title="Διαγραφή τάξης"
                      >
                        {deletingClassId === c.id ? '...' : <X className="h-3 w-3" />}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Student → class assignment */}
            {continuingStudents.length > 0 && newClasses.length > 0 && (
              <div className="space-y-2 max-h-[35vh] overflow-y-auto">
                {continuingStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <GraduationCap className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 flex-1">{s.fullName}</span>
                    <select
                      value={assignments[s.id] ?? ''}
                      onChange={e => setAssignments(p => ({ ...p, [s.id]: e.target.value }))}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#77328d]/30 bg-white"
                    >
                      <option value="">Επιλογή τάξης...</option>
                      {newClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level.name})` : ''}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            {continuingStudents.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Δεν υπάρχουν μαθητές που συνεχίζουν.</p>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" /> Πίσω
              </button>
              <button
                onClick={handleStep3}
                disabled={continuingStudents.length > 0 && newClasses.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#642678] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1d5e] disabled:opacity-50"
              >
                Επόμενο <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Summary & confirm ── */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-900">Επισκόπηση & Ολοκλήρωση</h2>
            <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600">Νέο σχολικό έτος</span>
                <span className="text-sm font-semibold text-gray-900">{yearForm.label}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600">Μαθητές που συνεχίζουν</span>
                <span className="text-sm font-semibold text-emerald-700">{continuing.size}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600">Μαθητές που αποχωρούν</span>
                <span className="text-sm font-semibold text-red-600">{students.length - continuing.size}</span>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Με την ολοκλήρωση: το νέο έτος <strong>{yearForm.label}</strong> θα οριστεί ως τρέχον, και οι {students.length - continuing.size} μαθητές που δεν συνεχίζουν θα αρχειοθετηθούν.
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(3)} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" /> Πίσω
              </button>
              <button onClick={handleFinish} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Αποθήκευση...' : 'Ολοκλήρωση'} <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewYearWizardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-gray-400">Φόρτωση...</div>}>
      <NewYearWizardContent />
    </Suspense>
  );
}
