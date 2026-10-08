'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Baby, ChevronRight, Search, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';

type Child = { id: string; fullName: string; className?: string; isActive?: boolean };
type ParentRow = {
  id: string;
  fullName: string;
  email?: string;
  phone?: string | null;
  children?: Child[];
};

function errorText(error: any) {
  const message = error?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || 'Το μήνυμα δεν στάλθηκε';
}

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

  useEffect(() => {
    if (!schoolId) return;
    api.get(`/schools/${schoolId}/parents`).then((data: any) => {
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
      setNote(errorText(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2f2a28]">Γονείς</h1>
          <p className="mt-1 text-sm text-[#6b625c]">{parents.length} γονείς</p>
        </div>
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
                    <Link href={`/school/parents/${parent.id}`} className="rounded-lg p-1 text-[#77328D] hover:bg-[#faf5fc]">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
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
    </div>
  );
}
