'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';

type Child = {
  id: string;
  fullName: string;
  dob?: string | null;
  address?: string | null;
  allergies?: string | null;
  notes?: string | null;
  bloodType?: string | null;
  isActive?: boolean;
  relation?: string | null;
  className?: string;
};

function age(dob?: string | null) {
  if (!dob) return '';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  if (years > 0) return `${years} ετών`;
  return 'κάτω του έτους';
}

function errorText(error: any) {
  const message = error?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || 'Το μήνυμα δεν στάλθηκε';
}

export default function ParentDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [parent, setParent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!schoolId || !params.id) return;
    api.get(`/schools/${schoolId}/parents/${params.id}`).then(setParent).catch(() => setParent(null)).finally(() => setLoading(false));
  }, [schoolId, params.id]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !parent || !schoolId) return;
    setSending(true);
    setNote('');
    try {
      await api.post(`/schools/${schoolId}/conversations/broadcast`, { userIds: [parent.id], body: text });
      setDraft('');
      setNote('Το μήνυμα στάλθηκε');
    } catch (error: any) {
      setNote(errorText(error));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-sm text-[#8a756c]">Φόρτωση...</p>;
  if (!parent) return <p className="py-16 text-center text-sm text-[#8a756c]">Ο γονέας δεν βρέθηκε</p>;

  const children: Child[] = parent.children ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/school/parents" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-[#77328D]">
        <ChevronLeft className="h-4 w-4" /> Γονείς
      </Link>
      <div className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#2f2a28]">{parent.fullName}</h1>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-[#a89890]">Τηλέφωνο</dt>
            <dd className="text-sm font-semibold text-[#2f2a28]">{parent.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-[#a89890]">Email</dt>
            <dd className="break-all text-sm font-semibold text-[#2f2a28]">{parent.email || '—'}</dd>
          </div>
        </dl>
      </div>

      <h2 className="mb-3 mt-6 text-lg font-bold text-[#2f2a28]">Παιδιά</h2>
      <div className="space-y-3">
        {children.length === 0 && (
          <p className="rounded-2xl border border-[#77328d]/10 bg-white px-4 py-6 text-sm text-[#8a756c]">Δεν υπάρχουν συνδεδεμένα παιδιά</p>
        )}
        {children.map((child) => (
          <Link key={child.id} href={`/school/students/${child.id}`} className="block rounded-2xl border border-[#77328d]/10 bg-white p-4 shadow-sm hover:border-[#77328D]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-[#2f2a28]">{child.fullName}</p>
                <p className="text-sm text-[#6b625c]">
                  {[child.relation, child.className, age(child.dob), child.isActive === false ? 'ανενεργό' : ''].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {child.dob && (
                <div>
                  <dt className="text-xs text-[#a89890]">Γέννηση</dt>
                  <dd>{new Intl.DateTimeFormat('el-GR').format(new Date(child.dob))}</dd>
                </div>
              )}
              {child.address && (
                <div>
                  <dt className="text-xs text-[#a89890]">Διεύθυνση</dt>
                  <dd>{child.address}</dd>
                </div>
              )}
              {child.allergies && (
                <div>
                  <dt className="text-xs text-[#a89890]">Αλλεργίες</dt>
                  <dd>{child.allergies}</dd>
                </div>
              )}
              {child.bloodType && (
                <div>
                  <dt className="text-xs text-[#a89890]">Ομάδα αίματος</dt>
                  <dd>{child.bloodType}</dd>
                </div>
              )}
              {child.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[#a89890]">Σημειώσεις</dt>
                  <dd>{child.notes}</dd>
                </div>
              )}
            </dl>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-[#77328d]/10 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-[#2f2a28]">Μήνυμα στον γονέα</p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Γράψε ένα μήνυμα"
          className="mt-2 w-full resize-none rounded-xl border border-[#77328d]/15 px-3 py-2 text-sm outline-none focus:border-[#77328D]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E95926] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Αποστολή...' : 'Αποστολή'}
          </button>
          <Link href="/school/messages" className="text-sm font-bold text-[#77328D]">Άνοιγμα μηνυμάτων</Link>
          {note && <p className="text-sm text-[#6b625c]">{note}</p>}
        </div>
      </div>
    </div>
  );
}
