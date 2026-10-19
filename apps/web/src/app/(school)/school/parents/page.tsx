'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Baby, ChevronRight, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { parentsApi, api } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';

type Child = { id: string; fullName: string; className?: string; isActive?: boolean };
type ParentRow = {
  id: string;
  fullName: string;
  email?: string;
  phone?: string | null;
  children?: Child[];
};

function errText(error: any) {
  const message = error?.response?.data?.message ?? error?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || 'Σφάλμα';
}

const emptyForm = () => ({ fullName: '', email: '', phone: '' });

export default function ParentsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit
  const [editTarget, setEditTarget] = useState<ParentRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ParentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    if (!schoolId) return;
    parentsApi.list(schoolId).then((data: any) => {
      setParents(Array.isArray(data) ? data : []);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!schoolId) return;
    parentsApi.list(schoolId).then((data: any) => {
      setParents(Array.isArray(data) ? data : []);
    }).catch(() => setParents([])).finally(() => setLoading(false));
  }, [schoolId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return parents;
    return parents.filter((parent) => {
      const haystack = [
        parent.fullName,
        parent.email,
        parent.phone,
        ...(parent.children ?? []).map((child) => `${child.fullName} ${child.className ?? ''}`),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [parents, search]);

  const allChecked = filtered.length > 0 && filtered.every((parent) => selected.includes(parent.id));

  const toggleAll = () => {
    const ids = filtered.map((parent) => parent.id);
    setSelected((current) => (allChecked
      ? current.filter((id) => !ids.includes(id))
      : Array.from(new Set(current.concat(ids)))));
  };

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]));
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !selected.length || !schoolId) return;
    setSending(true);
    setNote('');
    try {
      const result: any = await api.post(`/schools/${schoolId}/conversations/broadcast`, {
        userIds: selected,
        body: text,
      });
      setDraft('');
      setSelected([]);
      setNote(`Στάλθηκε σε ${result?.sent ?? selected.length} γονείς`);
    } catch (error: any) {
      setNote(errText(error));
    } finally {
      setSending(false);
    }
  };

  const doCreate = async () => {
    if (!createForm.fullName.trim()) { setCreateError('Συμπληρώστε ονοματεπώνυμο'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await parentsApi.create(schoolId, {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
      });
      setShowCreate(false);
      setCreateForm(emptyForm());
      reload();
    } catch (error: any) {
      setCreateError(errText(error));
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (parent: ParentRow) => {
    setEditTarget(parent);
    setEditForm({ fullName: parent.fullName, email: parent.email ?? '', phone: parent.phone ?? '' });
    setEditError('');
  };

  const doEdit = async () => {
    if (!editTarget || !editForm.fullName.trim()) { setEditError('Συμπληρώστε ονοματεπώνυμο'); return; }
    setSaving(true);
    setEditError('');
    try {
      await parentsApi.update(schoolId, editTarget.id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
      });
      setEditTarget(null);
      reload();
    } catch (error: any) {
      setEditError(errText(error));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await parentsApi.delete(schoolId, deleteTarget.id);
      setDeleteTarget(null);
      setParents((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2f2a28]">Γονείς</h1>
          <p className="mt-1 text-sm text-[#6b625c]">{parents.length} γονείς</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(true); setCreateForm(emptyForm()); setCreateError(''); }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#77328D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#642678]"
        >
          <Plus className="h-4 w-4" /> Νέος Γονέας
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89890]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Αναζήτηση ονόματος, τηλεφώνου, email ή παιδιού"
            className="w-full rounded-xl border border-[#77328d]/15 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#77328D]"
          />
        </label>
        <button
          type="button"
          onClick={toggleAll}
          className="rounded-xl border border-[#77328d]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#642678]"
        >
          {allChecked ? 'Αποεπιλογή' : 'Επιλογή όλων'}
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-[#77328d]/10 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-[#2f2a28]">
          Μαζικό μήνυμα {selected.length ? `· ${selected.length} επιλεγμένοι` : ''}
        </p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Γράψε το μήνυμα που θα λάβουν οι επιλεγμένοι γονείς"
          className="mt-2 w-full resize-none rounded-xl border border-[#77328d]/15 px-3 py-2 text-sm outline-none focus:border-[#77328D]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim() || !selected.length}
            className="inline-flex items-center gap-2 rounded-xl bg-[#77328D] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Αποστολή...' : 'Αποστολή'}
          </button>
          {note && <p className="text-sm text-[#6b625c]">{note}</p>}
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-[#8a756c]">Φόρτωση...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#77328d]/10 bg-white py-16 text-center text-sm text-[#8a756c]">
          Δεν βρέθηκαν γονείς
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((parent) => {
            const checked = selected.includes(parent.id);
            const children = parent.children ?? [];
            return (
              <div key={parent.id} className="flex gap-3 rounded-2xl border border-[#77328d]/10 bg-white p-4 shadow-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(parent.id)}
                  aria-label={`Επιλογή ${parent.fullName}`}
                  className="mt-1 h-4 w-4 accent-[#77328D]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#2f2a28]">{parent.fullName}</p>
                      <p className="truncate text-sm text-[#6b625c]">{parent.phone || 'Χωρίς τηλέφωνο'}</p>
                      <p className="truncate text-xs text-[#a89890]">{parent.email}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(parent)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-[#faf5fc] hover:text-[#77328D]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(parent)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <Link href={`/school/parents/${parent.id}`} className="rounded-lg p-1 text-[#77328D] hover:bg-[#faf5fc]">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {children.length === 0 ? (
                      <span className="text-xs text-[#a89890]">Χωρίς παιδί</span>
                    ) : children.map((child) => (
                      <span key={child.id} className="inline-flex items-center gap-1 rounded-full bg-[#f3e8f7] px-2 py-0.5 text-xs font-semibold text-[#642678]">
                        <Baby className="h-3 w-3" />
                        {child.fullName}{child.className ? ` · ${child.className}` : ''}
                        {child.isActive === false ? ' · ανενεργό' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Νέος Γονέας</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ονοματεπώνυμο *</label>
                <input
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="π.χ. Μαρία Παπαδοπούλου"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && doCreate()}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Τηλέφωνο</label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="69xxxxxxxx"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {createError && <p className="text-sm text-red-500">{createError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Ακύρωση</button>
              <button
                onClick={doCreate}
                disabled={creating}
                className="px-4 py-2 bg-[#77328D] text-white text-sm font-bold rounded-xl hover:bg-[#642678] disabled:opacity-50"
              >
                {creating ? 'Δημιουργία...' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Επεξεργασία Γονέα</h3>
              <button onClick={() => setEditTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ονοματεπώνυμο *</label>
                <input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Τηλέφωνο</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {editError && <p className="text-sm text-red-500">{editError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Ακύρωση</button>
              <button
                onClick={doEdit}
                disabled={saving}
                className="px-4 py-2 bg-[#77328D] text-white text-sm font-bold rounded-xl hover:bg-[#642678] disabled:opacity-50"
              >
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Διαγραφή Γονέα</h3>
            <p className="text-sm text-gray-600 mb-6">
              Θέλεις σίγουρα να διαγράψεις τον <strong>{deleteTarget.fullName}</strong>; Η ενέργεια δεν αναιρείται.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Ακύρωση</button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Διαγραφή...' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
