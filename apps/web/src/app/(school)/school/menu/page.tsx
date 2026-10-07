'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { classesApi, dailyMenusApi, levelsApi, menuTemplatesApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { ChevronLeft, ChevronRight, Save, X, LayoutTemplate, Plus, Trash2, CheckCircle, Upload, Copy, Sparkles } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, getDay } from 'date-fns';
import { el } from 'date-fns/locale';
import { AudienceSelector, AudienceValue, audienceLabel } from '@/components/AudienceSelector';

type DayMenu = {
  id?: string;
  date: string;
  breakfast?: string;
  midMorning?: string;
  lunch?: string;
  afternoon?: string;
  notes?: string;
  audienceType?: string;
  audienceIds?: string;
};
type Template = {
  id: string;
  name: string;
  description?: string;
  kind?: string;
  sourceMonth?: string;
  audienceType?: string;
  audienceIds?: string;
  entries: { dayOfWeek: number; breakfast?: string; midMorning?: string; lunch?: string; afternoon?: string; notes?: string }[];
};
type ImportPreview = { month?: string; days: DayMenu[]; warnings?: string[] };

const DAYS_EL = ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ'];
const DOW_EL = ['', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή'];
const MEALS = [
  { key: 'breakfast', label: 'Πρωινό', color: 'text-amber-600' },
  { key: 'midMorning', label: 'Δεκατιανό', color: 'text-orange-600' },
  { key: 'lunch', label: 'Μεσημεριανό', color: 'text-green-700' },
  { key: 'afternoon', label: 'Απογ/νό', color: 'text-blue-600' },
] as const;

const emptyEntry = (dow: number) => ({ dayOfWeek: dow, breakfast: '', midMorning: '', lunch: '', afternoon: '', notes: '' });

function errorText(err: any) {
  const message = err?.message || err?.error;
  if (Array.isArray(message)) return message.join(' ');
  if (message === 'Internal server error') return 'Το διατροφολόγιο δεν ανέβηκε. Δοκίμασε μικρότερο JPG ή PDF.';
  return typeof message === 'string' ? message : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.';
}

export default function MenuPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [menus, setMenus] = useState<Record<string, DayMenu>>({});
  const [loading, setLoading] = useState(true);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DayMenu>>({});
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const [audience, setAudience] = useState<AudienceValue>({ audienceType: 'all', audienceIds: [] });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);

  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editTemplate, setEditTemplate] = useState<Partial<Template> | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const monthKey = format(currentMonth, 'yyyy-MM');
  const monthLabel = format(currentMonth, 'LLLL yyyy', { locale: el });
  const who = audienceLabel(audience.audienceType, audience.audienceIds, classes, levels);

  const loadMenus = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const data = await dailyMenusApi.list(schoolId, {
        from,
        to,
        audienceType: audience.audienceType,
        audienceIds: JSON.stringify(audience.audienceIds),
      }) as unknown as DayMenu[];
      const rows = Array.isArray(data) ? data : [];
      const map: Record<string, DayMenu> = {};
      rows.forEach((menu) => { map[String(menu.date).slice(0, 10)] = menu; });
      setMenus(map);
    } catch (err) {
      setPageError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [schoolId, currentMonth, audience]);

  const loadTemplates = useCallback(async () => {
    if (!schoolId) return;
    const data = await menuTemplatesApi.list(schoolId) as unknown as Template[];
    setTemplates(data);
  }, [schoolId]);

  useEffect(() => { loadMenus(); }, [loadMenus]);
  useEffect(() => { if (showTemplates) loadTemplates(); }, [showTemplates, loadTemplates]);
  useEffect(() => {
    if (!schoolId) return;
    Promise.all([classesApi.list(schoolId) as Promise<any>, levelsApi.list(schoolId) as Promise<any>])
      .then(([classRows, levelRows]) => {
        setClasses(Array.isArray(classRows) ? classRows : []);
        setLevels(Array.isArray(levelRows) ? levelRows : []);
      })
      .catch(() => undefined);
  }, [schoolId]);

  const openEdit = (dateStr: string) => {
    const existing = menus[dateStr] ?? {};
    setEditForm({
      date: dateStr,
      breakfast: existing.breakfast ?? '',
      midMorning: existing.midMorning ?? '',
      lunch: existing.lunch ?? '',
      afternoon: existing.afternoon ?? '',
      notes: existing.notes ?? '',
      id: existing.id,
    });
    setEditDay(dateStr);
  };

  const saveMenu = async () => {
    if (!editDay) return;
    setSaving(true);
    setPageError('');
    try {
      await dailyMenusApi.upsert(schoolId, { ...editForm, date: editDay, ...audience });
      setEditDay(null);
      loadMenus();
    } catch (err) {
      setPageError(errorText(err));
    } finally { setSaving(false); }
  };

  const deleteMenu = async () => {
    if (!editForm.id) return;
    setSaving(true);
    try {
      await dailyMenusApi.remove(schoolId, editForm.id);
      setEditDay(null);
      loadMenus();
    } catch (err) {
      setPageError(errorText(err));
    } finally { setSaving(false); }
  };

  const openNewTemplate = () => {
    setEditTemplate({ name: '', description: '', kind: 'week', entries: [1, 2, 3, 4, 5].map(emptyEntry) });
  };

  const openEditTemplate = (template: Template) => {
    if (template.kind === 'month') {
      setEditTemplate({ ...template });
      return;
    }
    const filled = [1, 2, 3, 4, 5].map((dow) => {
      const entry = template.entries.find((item) => item.dayOfWeek === dow);
      return entry ? { ...entry } : emptyEntry(dow);
    });
    setEditTemplate({ ...template, kind: 'week', entries: filled });
  };

  const saveTemplate = async () => {
    if (!editTemplate?.name) return;
    setSaving(true);
    setPageError('');
    try {
      const payload = editTemplate.kind === 'month'
        ? { name: editTemplate.name, description: editTemplate.description, ...audience }
        : { ...editTemplate, kind: 'week', ...audience };
      if (editTemplate.id) await menuTemplatesApi.update(schoolId, editTemplate.id, payload);
      else await menuTemplatesApi.create(schoolId, payload);
      setEditTemplate(null);
      loadTemplates();
    } catch (err) {
      setPageError(errorText(err));
    } finally { setSaving(false); }
  };

  const deleteTemplate = async (id: string) => {
    await menuTemplatesApi.remove(schoolId, id);
    loadTemplates();
  };

  const applyTemplate = async (id: string) => {
    setApplyingId(id);
    setPageError('');
    try {
      await menuTemplatesApi.apply(schoolId, id, monthKey, audience);
      setApplied(id);
      loadMenus();
      setTimeout(() => setApplied(null), 2000);
    } catch (err) {
      setPageError(errorText(err));
    } finally { setApplyingId(null); }
  };

  const saveMonthAsTemplate = async () => {
    setSaving(true);
    setPageError('');
    try {
      await menuTemplatesApi.fromMonth(schoolId, { month: monthKey, ...audience });
      setShowTemplates(true);
      loadTemplates();
    } catch (err) {
      setPageError(errorText(err));
    } finally { setSaving(false); }
  };

  const copyToNextMonth = async () => {
    const next = addMonths(currentMonth, 1);
    setSaving(true);
    setPageError('');
    try {
      await dailyMenusApi.copyMonth(schoolId, { from: monthKey, to: format(next, 'yyyy-MM'), ...audience });
      setCurrentMonth(next);
    } catch (err) {
      setPageError(errorText(err));
    } finally { setSaving(false); }
  };

  const loadSeptember = async () => {
    setSaving(true);
    setPageError('');
    try {
      const template = await menuTemplatesApi.ensureSeptember(schoolId, audience) as unknown as Template;
      await menuTemplatesApi.apply(schoolId, template.id, monthKey, audience);
      setShowTemplates(true);
      loadTemplates();
      loadMenus();
    } catch (err) {
      setPageError(errorText(err));
    } finally { setSaving(false); }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    setPageError('');
    setPreview(null);
    setImportOpen(true);
    try {
      const result = await dailyMenusApi.importFile(schoolId, file, monthKey) as unknown as ImportPreview;
      setPreview(result);
    } catch (err) {
      setPageError(errorText(err));
      setImportOpen(false);
    } finally { setImporting(false); }
  };

  const confirmImport = async () => {
    if (!preview?.days?.length) return;
    setSaving(true);
    setPageError('');
    try {
      await dailyMenusApi.bulk(schoolId, { days: preview.days, ...audience });
      if (preview.month && preview.month !== monthKey) {
        const [year, month] = preview.month.split('-').map(Number);
        setCurrentMonth(new Date(year, month - 1, 1));
      } else {
        loadMenus();
      }
      setImportOpen(false);
      setPreview(null);
    } catch (err) {
      setPageError(errorText(err));
    } finally { setSaving(false); }
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = (getDay(startOfMonth(currentMonth)) + 6) % 7;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Διατροφολόγιο</h1>
          <p className="text-sm text-gray-500 mt-1">Μηνιαίο πρόγραμμα για {who}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-[150px] text-center capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Για ποιους είναι αυτό το πρόγραμμα</p>
            <AudienceSelector value={audience} onChange={setAudience} classes={classes} levels={levels} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700">
              <Upload size={15} /> Ανέβασμα JPG / PDF
            </button>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button onClick={loadSeptember} disabled={saving} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
              <Sparkles size={15} /> Σεπτέμβριος 2026
            </button>
            <button onClick={saveMonthAsTemplate} disabled={saving} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <LayoutTemplate size={15} /> Αποθήκευση μήνα ως πρότυπο
            </button>
            <button onClick={copyToNextMonth} disabled={saving} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <Copy size={15} /> Αντιγραφή στον επόμενο μήνα
            </button>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showTemplates ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <LayoutTemplate size={15} /> Πρότυπα
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Το PDF με κείμενο συμπληρώνει τις ημέρες αυτόματα. Η φωτογραφία διαβάζεται με AI όταν υπάρχει OPENAI_API_KEY. Πριν την αποθήκευση βλέπεις προεπισκόπηση.
          </p>
        </div>
      )}

      {pageError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>}

      <div className={`flex gap-6 ${showTemplates ? 'items-start' : ''}`}>
        <div className="flex-1 min-w-0">
          {loading && <p className="text-xs text-gray-400 mb-2">Φόρτωση...</p>}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
            {DAYS_EL.map((day) => (
              <div key={day} className="bg-gray-50 text-center text-xs font-semibold text-gray-500 py-2">{day}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white min-h-[110px]" />
            ))}
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const menu = menus[dateStr];
              const today = isToday(day);
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;
              return (
                <div
                  key={dateStr}
                  onClick={() => isAdmin && !isWeekend && openEdit(dateStr)}
                  className={`bg-white min-h-[110px] p-2 ${isAdmin && !isWeekend ? 'cursor-pointer hover:bg-indigo-50/50' : ''} ${today ? 'ring-2 ring-indigo-400 ring-inset' : ''} ${isWeekend ? 'bg-gray-50/60' : ''}`}
                >
                  <div className={`text-sm font-medium mb-1.5 ${today ? 'text-indigo-600' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                  {menu && !isWeekend && (
                    <div className="space-y-0.5">
                      {MEALS.map(({ key, label, color }) =>
                        menu[key] ? (
                          <div key={key} className="text-[10px] leading-tight">
                            <span className={`font-medium ${color}`}>{label}: </span>
                            <span className="text-gray-600 line-clamp-1">{menu[key]}</span>
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
                  {isAdmin && !isWeekend && !menu && (
                    <div className="text-[10px] text-gray-300 mt-1">+ Προσθήκη</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showTemplates && isAdmin && (
          <div className="w-80 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-sm">Πρότυπα</h2>
              <button onClick={openNewTemplate} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                <Plus size={13} /> Εβδομάδα
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Η εφαρμογή γράφει το πρόγραμμα για {who}. Το εβδομαδιαίο πρότυπο επαναλαμβάνει Δευτέρα–Παρασκευή. Το μηνιαίο κρατά τις ημερομηνίες του και, σε άλλον μήνα, τη σειρά των σχολικών ημερών.</p>

            {templates.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Δεν υπάρχουν πρότυπα. Αποθήκευσε τον μήνα ή φόρτωσε τον Σεπτέμβριο 2026.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{template.name}</p>
                        <p className="text-[11px] text-indigo-600 mt-0.5">{template.kind === 'month' ? `Μήνας${template.sourceMonth ? ` · ${template.sourceMonth}` : ''}` : 'Εβδομάδα'}</p>
                        {template.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{template.description}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEditTemplate(template)} className="text-gray-400 hover:text-gray-600 p-0.5" title="Επεξεργασία">
                          <LayoutTemplate size={12} />
                        </button>
                        <button onClick={() => deleteTemplate(template.id)} className="text-gray-400 hover:text-red-500 p-0.5" title="Διαγραφή">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => applyTemplate(template.id)}
                      disabled={applyingId === template.id}
                      className={`mt-2 w-full text-xs py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        applied === template.id ? 'bg-green-50 text-green-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      } disabled:opacity-50`}
                    >
                      {applied === template.id ? <><CheckCircle size={12} /> Εφαρμόστηκε!</> : applyingId === template.id ? 'Εφαρμογή...' : `Εφαρμογή σε ${monthLabel}`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {editDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Γεύματα</h2>
                <p className="text-sm text-gray-500 capitalize">
                  {format(new Date(editDay + 'T12:00:00'), 'EEEE, d MMMM yyyy', { locale: el })} · {who}
                </p>
              </div>
              <button onClick={() => setEditDay(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {MEALS.map(({ key, label, color }) => (
                <div key={key}>
                  <label className={`block text-sm font-medium mb-1 ${color}`}>{label}</label>
                  <input
                    value={(editForm as any)[key] ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    placeholder={key === 'breakfast' ? 'Γάλα + δημητριακά' : key === 'midMorning' ? 'Φρούτο' : key === 'lunch' ? 'Κοτόπουλο ριζότο' : 'Γιαούρτι'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Σημείωση</label>
                <textarea value={editForm.notes ?? ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} placeholder="Αλλεργίες, συνοδευτικά..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {editForm.id && (
                <button onClick={deleteMenu} disabled={saving} className="border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50">
                  Διαγραφή
                </button>
              )}
              <button onClick={() => setEditDay(null)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">Άκυρο</button>
              <button onClick={saveMenu} disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} />
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">{editTemplate.id ? 'Επεξεργασία προτύπου' : 'Νέο εβδομαδιαίο πρότυπο'}</h2>
              <button onClick={() => setEditTemplate(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Όνομα *</label>
                  <input value={editTemplate.name ?? ''} onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })} placeholder="πχ. Εβδομάδα Α" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Περιγραφή</label>
                  <input value={editTemplate.description ?? ''} onChange={(e) => setEditTemplate({ ...editTemplate, description: e.target.value })} placeholder="Προαιρετική σημείωση" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {editTemplate.kind === 'month' ? (
                <div className="space-y-2">
                  {editTemplate.entries?.map((entry) => (
                    <div key={entry.dayOfWeek} className="border border-gray-100 rounded-xl p-3 text-xs text-gray-600">
                      <p className="font-semibold text-indigo-700 mb-1">Ημέρα {entry.dayOfWeek}</p>
                      <p>{entry.midMorning}</p>
                      <p>{entry.lunch}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {editTemplate.entries?.map((entry, idx) => (
                    <div key={entry.dayOfWeek} className="border border-gray-100 rounded-xl p-4">
                      <p className="text-sm font-semibold text-indigo-700 mb-3">{DOW_EL[entry.dayOfWeek]}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {MEALS.map(({ key, label, color }) => (
                          <div key={key}>
                            <label className={`block text-xs font-medium mb-0.5 ${color}`}>{label}</label>
                            <input
                              value={(entry as any)[key] ?? ''}
                              onChange={(e) => {
                                const newEntries = [...(editTemplate.entries ?? [])];
                                newEntries[idx] = { ...newEntries[idx], [key]: e.target.value };
                                setEditTemplate({ ...editTemplate, entries: newEntries });
                              }}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditTemplate(null)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">Άκυρο</button>
              <button onClick={saveTemplate} disabled={saving || !editTemplate.name} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} />
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ανάγνωση διατροφολόγιου</h2>
                <p className="text-sm text-gray-500">Θα αποθηκευτεί για {who}{preview?.month ? ` · ${preview.month}` : ''}</p>
              </div>
              <button onClick={() => { setImportOpen(false); setPreview(null); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {importing && <p className="text-sm text-gray-500">Διαβάζω το αρχείο...</p>}
            {preview && (
              <div className="space-y-3">
                {preview.warnings?.map((warning) => (
                  <p key={warning} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{warning}</p>
                ))}
                <div className="divide-y border border-gray-100 rounded-xl">
                  {preview.days.map((day) => (
                    <div key={day.date} className="px-3 py-2 text-sm">
                      <p className="font-medium text-gray-900">{day.date}</p>
                      {day.midMorning && <p className="text-gray-600"><span className="text-orange-600">Δεκατιανό:</span> {day.midMorning}</p>}
                      {day.lunch && <p className="text-gray-600"><span className="text-green-700">Μεσημεριανό:</span> {day.lunch}</p>}
                      {day.afternoon && <p className="text-gray-600"><span className="text-blue-600">Απογευματινό:</span> {day.afternoon}</p>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setImportOpen(false); setPreview(null); }} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm">Άκυρο</button>
                  <button onClick={confirmImport} disabled={saving || !preview.days.length} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                    {saving ? 'Αποθήκευση...' : `Αποθήκευση ${preview.days.length} ημερών`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
