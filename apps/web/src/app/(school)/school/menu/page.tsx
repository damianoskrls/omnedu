'use client';

import { useEffect, useState, useCallback } from 'react';
import { dailyMenusApi, menuTemplatesApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { ChevronLeft, ChevronRight, Save, X, LayoutTemplate, Plus, Trash2, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, getDay } from 'date-fns';
import { el } from 'date-fns/locale';

type DayMenu = { id?: string; date: string; breakfast?: string; midMorning?: string; lunch?: string; afternoon?: string; notes?: string };
type Template = { id: string; name: string; description?: string; entries: { dayOfWeek: number; breakfast?: string; midMorning?: string; lunch?: string; afternoon?: string; notes?: string }[] };

const DAYS_EL = ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ'];
const DOW_EL = ['', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή'];
const MEALS = [
  { key: 'breakfast', label: 'Πρωινό', color: 'text-amber-600' },
  { key: 'midMorning', label: 'Δεκατιανό', color: 'text-orange-600' },
  { key: 'lunch', label: 'Μεσημεριανό', color: 'text-green-700' },
  { key: 'afternoon', label: 'Απογ/νό', color: 'text-blue-600' },
] as const;

const emptyEntry = (dow: number) => ({ dayOfWeek: dow, breakfast: '', midMorning: '', lunch: '', afternoon: '', notes: '' });

export default function MenuPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin';

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [menus, setMenus] = useState<Record<string, DayMenu>>({});
  const [loading, setLoading] = useState(true);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DayMenu>>({});
  const [saving, setSaving] = useState(false);

  // Templates
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editTemplate, setEditTemplate] = useState<Partial<Template> | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const loadMenus = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const data = await dailyMenusApi.list(schoolId, { from, to }) as DayMenu[];
      const map: Record<string, DayMenu> = {};
      data.forEach((m) => { map[m.date.slice(0, 10)] = m; });
      setMenus(map);
    } finally {
      setLoading(false);
    }
  }, [schoolId, currentMonth]);

  const loadTemplates = useCallback(async () => {
    if (!schoolId) return;
    const data = await menuTemplatesApi.list(schoolId) as Template[];
    setTemplates(data);
  }, [schoolId]);

  useEffect(() => { loadMenus(); }, [loadMenus]);
  useEffect(() => { if (showTemplates) loadTemplates(); }, [showTemplates, loadTemplates]);

  const openEdit = (dateStr: string) => {
    const existing = menus[dateStr] ?? {};
    setEditForm({ date: dateStr, breakfast: existing.breakfast ?? '', midMorning: existing.midMorning ?? '', lunch: existing.lunch ?? '', afternoon: existing.afternoon ?? '', notes: existing.notes ?? '' });
    setEditDay(dateStr);
  };

  const saveMenu = async () => {
    if (!editDay) return;
    setSaving(true);
    try {
      await dailyMenusApi.upsert(schoolId, { ...editForm, date: editDay });
      setEditDay(null);
      loadMenus();
    } finally { setSaving(false); }
  };

  const openNewTemplate = () => {
    setEditTemplate({ name: '', description: '', entries: [1, 2, 3, 4, 5].map(emptyEntry) });
  };

  const openEditTemplate = (t: Template) => {
    const filled = [1, 2, 3, 4, 5].map(dow => {
      const e = t.entries.find(e => e.dayOfWeek === dow);
      return e ? { ...e } : emptyEntry(dow);
    });
    setEditTemplate({ ...t, entries: filled });
  };

  const saveTemplate = async () => {
    if (!editTemplate?.name) return;
    setSaving(true);
    try {
      if (editTemplate.id) {
        await menuTemplatesApi.update(schoolId, editTemplate.id, editTemplate);
      } else {
        await menuTemplatesApi.create(schoolId, editTemplate);
      }
      setEditTemplate(null);
      loadTemplates();
    } finally { setSaving(false); }
  };

  const deleteTemplate = async (id: string) => {
    await menuTemplatesApi.remove(schoolId, id);
    loadTemplates();
  };

  const applyTemplate = async (id: string) => {
    const month = format(currentMonth, 'yyyy-MM');
    setApplyingId(id);
    try {
      await menuTemplatesApi.apply(schoolId, id, month);
      setApplied(id);
      loadMenus();
      setTimeout(() => setApplied(null), 2000);
    } finally { setApplyingId(null); }
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = (getDay(startOfMonth(currentMonth)) + 6) % 7;
  const monthLabel = format(currentMonth, 'LLLL yyyy', { locale: el });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Διατροφολόγιο</h1>
          <p className="text-sm text-gray-500 mt-1">Μηνιαίο πρόγραμμα γευμάτων</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showTemplates ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <LayoutTemplate size={15} />
              Πρότυπα
            </button>
          )}
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-[140px] text-center capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className={`flex gap-6 ${showTemplates ? 'items-start' : ''}`}>
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
            {DAYS_EL.map((d) => (
              <div key={d} className="bg-gray-50 text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
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
                        menu[key as keyof DayMenu] ? (
                          <div key={key} className="text-[10px] leading-tight">
                            <span className={`font-medium ${color}`}>{label}: </span>
                            <span className="text-gray-600 line-clamp-1">{menu[key as keyof DayMenu] as string}</span>
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

        {/* Templates panel */}
        {showTemplates && isAdmin && (
          <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-sm">Πρότυπα εβδομάδας</h2>
              <button onClick={openNewTemplate} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                <Plus size={13} /> Νέο
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Δεν υπάρχουν πρότυπα.<br />Δημιουργήστε ένα και εφαρμόστε το στον μήνα.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                        {t.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEditTemplate(t)} className="text-gray-400 hover:text-gray-600 p-0.5" title="Επεξεργασία">
                          <LayoutTemplate size={12} />
                        </button>
                        <button onClick={() => deleteTemplate(t.id)} className="text-gray-400 hover:text-red-500 p-0.5" title="Διαγραφή">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => applyTemplate(t.id)}
                      disabled={applyingId === t.id}
                      className={`mt-2 w-full text-xs py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        applied === t.id ? 'bg-green-50 text-green-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      } disabled:opacity-50`}
                    >
                      {applied === t.id ? <><CheckCircle size={12} /> Εφαρμόστηκε!</> : applyingId === t.id ? 'Εφαρμογή...' : `Εφαρμογή σε ${monthLabel}`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day edit modal */}
      {editDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Γεύματα</h2>
                <p className="text-sm text-gray-500 capitalize">
                  {format(new Date(editDay + 'T12:00:00'), 'EEEE, d MMMM yyyy', { locale: el })}
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
                <textarea value={editForm.notes ?? ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} placeholder="Αλλεργίες, εναλλακτικά..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditDay(null)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">Άκυρο</button>
              <button onClick={saveMenu} disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} />
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template editor modal */}
      {editTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">{editTemplate.id ? 'Επεξεργασία προτύπου' : 'Νέο πρότυπο'}</h2>
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
    </div>
  );
}
