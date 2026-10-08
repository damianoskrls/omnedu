'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { ImagePlus, MessageSquare, Search, Send, Smile, Trash2 } from 'lucide-react';

const EMOJIS = ['😀', '😁', '😂', '😊', '😍', '🤗', '👍', '👏', '🙏', '❤️', '🎉', '🌟', '✅', '📷'];

type Person = { id: string; fullName: string; schoolMemberships?: { role: string }[] };
type Conversation = {
  id: string;
  unread?: boolean;
  startedByMe?: boolean;
  participants: { userId: string; lastReadAt?: string | null; user: Person }[];
  messages?: { body?: string; sentAt?: string; senderId?: string; mediaUrl?: string | null }[];
};
type ParentContact = { id: string; name: string; students?: string[] };
type TeacherContact = { id: string; name: string };

export default function MessagesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [parents, setParents] = useState<ParentContact[]>([]);
  const [teachers, setTeachers] = useState<TeacherContact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [emojisOpen, setEmojisOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState<{ conversationId: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingPost = useRef(0);

  const loadConversations = () => {
    if (!schoolId) return Promise.resolve();
    return api.get(`/schools/${schoolId}/conversations`).then((data: any) => {
      setConvos(Array.isArray(data) ? data : []);
    }).catch(() => setConvos([]));
  };

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      loadConversations(),
      api.get(`/schools/${schoolId}/conversations/contacts`).then((data: any) => {
        setParents(Array.isArray(data?.parents) ? data.parents : []);
        setTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
      }).catch(() => { setParents([]); setTeachers([]); }),
    ]).finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !activeId) return;
    let stopped = false;
    const refresh = () => {
      api.get(`/schools/${schoolId}/conversations/${activeId}/messages`).then((data: any) => {
        if (stopped) return;
        setMessages(Array.isArray(data) ? data : []);
        window.dispatchEvent(new Event('focus'));
      }).catch(() => {});
    };
    const timer = window.setInterval(refresh, 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [schoolId, activeId]);

  useEffect(() => {
    if (!schoolId) return;
    let stopped = false;
    const loadTyping = () => {
      api.get(`/schools/${schoolId}/conversations/typing`).then((data: any) => {
        if (!stopped) setTyping(Array.isArray(data) ? data : []);
      }).catch(() => {
        if (!stopped) setTyping([]);
      });
    };
    loadTyping();
    const timer = window.setInterval(loadTyping, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [schoolId]);

  const pulseTyping = (active: boolean) => {
    if (!schoolId || !activeId) return;
    const now = Date.now();
    if (active && now - lastTypingPost.current < 2000) return;
    lastTypingPost.current = active ? now : 0;
    api.post(`/schools/${schoolId}/conversations/${activeId}/typing`, { active }).catch(() => {});
  };

  const namesTyping = (conversationId: string | null) => {
    if (!conversationId) return [];
    const names: string[] = [];
    for (const row of typing) {
      if (row.conversationId === conversationId && row.name && !names.includes(row.name)) names.push(row.name);
    }
    return names;
  };

  const openConversation = async (id: string) => {
    setActiveId(id);
    setConvos((rows) => rows.map((row) => (row.id === id ? { ...row, unread: false } : row)));
    try {
      const data: any = await api.get(`/schools/${schoolId}/conversations/${id}/messages`);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    }
    await loadConversations();
    window.dispatchEvent(new Event('focus'));
  };

  const startWith = async (personId: string) => {
    const created: any = await api.post(`/schools/${schoolId}/conversations`, { kind: 'admin', withUserId: personId });
    await loadConversations();
    if (created?.id) openConversation(created.id);
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !image) || !activeId) return;
    setSending(true);
    try {
      if (image) {
        const form = new FormData();
        form.append('file', image);
        if (text) form.append('body', text);
        await api.post(`/schools/${schoolId}/conversations/${activeId}/messages/image`, form);
        clearImage();
      } else {
        await api.post(`/schools/${schoolId}/conversations/${activeId}/messages`, { body: text });
      }
      setDraft('');
      setEmojisOpen(false);
      pulseTyping(false);
      openConversation(activeId);
      loadConversations();
    } finally {
      setSending(false);
    }
  };

  const removeConversation = async (convo: Conversation) => {
    const everyone = convo.startedByMe === true;
    const accepted = window.confirm(
      everyone
        ? 'Την ξεκίνησες εσύ. Η συνομιλία θα σβηστεί για όλους όσοι συμμετέχουν.'
        : 'Την ξεκίνησε κάποιος άλλος. Η συνομιλία θα φύγει μόνο από τη δική σου λίστα.',
    );
    if (!accepted) return;
    await api.delete(`/schools/${schoolId}/conversations/${convo.id}`, { params: { scope: everyone ? 'everyone' : 'me' } });
    if (activeId === convo.id) {
      setActiveId(null);
      setMessages([]);
    }
    await loadConversations();
  };

  const peopleOf = (convo: Conversation) => {
    const people = others(convo, user?.id);
    const parentPeople = people.filter((person) => person.schoolMemberships?.some((row) => row.role === 'parent'));
    const named = parentPeople.length ? parentPeople : people.filter((person) => !person.schoolMemberships?.some((row) => row.role === 'school_admin'));
    return named.length ? named : people;
  };
  const titleOf = (convo: Conversation) => peopleOf(convo).map((person) => person.fullName).join(', ') || 'Συνομιλία';
  const tagsOf = (convo: Conversation) => {
    const tags = new Set<string>();
    for (const person of peopleOf(convo)) {
      const roles = new Set((person.schoolMemberships ?? []).map((row) => row.role));
      if (roles.has('parent') || parents.some((parent) => parent.id === person.id)) tags.add('Γονέας');
      if (roles.has('teacher') || teachers.some((teacher) => teacher.id === person.id)) tags.add('Εκπαιδευτικός');
      if (roles.has('school_admin') && !tags.has('Γονέας') && !tags.has('Εκπαιδευτικός')) tags.add('Διαχειριστής');
    }
    return ['Γονέας', 'Εκπαιδευτικός', 'Διαχειριστής'].filter((tag) => tags.has(tag));
  };
  const needle = query.trim().toLowerCase();
  const matches = (name: string, extra = '') => !needle || `${name} ${extra}`.toLowerCase().includes(needle);
  const visibleParents = parents.filter((parent) => matches(parent.name, parent.students?.join(' ') ?? ''));
  const visibleTeachers = teachers.filter((teacher) => matches(teacher.name));
  const visibleConvos = convos.filter((convo) => matches(titleOf(convo), tagsOf(convo).join(' ')));
  const active = convos.find((row) => row.id === activeId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Μηνύματα</h1>
        <p className="text-sm text-gray-500 mt-1">Επικοινωνία με γονείς και εκπαιδευτικούς. Οι συνομιλίες γονέα με τη δασκάλα δεν εμφανίζονται εδώ.</p>
      </div>
      <div className="grid h-[calc(100vh-11rem)] min-h-[36rem] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
        <div className="flex min-h-0 flex-col border-b border-gray-100 lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-gray-100 p-3">
            <p className="text-sm font-semibold text-gray-800">Με ποιον θέλεις να μιλήσεις</p>
            <label className="relative mt-2 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Αναζήτηση ονόματος ή παιδιού"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#77328D]"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-b border-gray-100">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Φόρτωση...</p>
            ) : visibleParents.length === 0 && visibleTeachers.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Δεν βρέθηκε κάποιος.</p>
            ) : (
              <>
                {visibleParents.length > 0 && <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#77328D]">Γονείς</p>}
                {visibleParents.map((parent) => (
                  <button key={parent.id} onClick={() => startWith(parent.id)} className="block w-full px-4 py-2 text-left hover:bg-[#faf5fc]">
                    <span className="block truncate text-sm font-medium text-gray-900">{parent.name}</span>
                    {!!parent.students?.length && <span className="block truncate text-xs text-gray-500">{parent.students.join(', ')}</span>}
                  </button>
                ))}
                {visibleTeachers.length > 0 && <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#E95926]">Εκπαιδευτικοί</p>}
                {visibleTeachers.map((teacher) => (
                  <button key={teacher.id} onClick={() => startWith(teacher.id)} className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-900 hover:bg-[#fff7f4]">
                    {teacher.name}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="shrink-0 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ανοιχτές συνομιλίες</p>
            {loading ? null : visibleConvos.length === 0 ? (
              <div className="px-6 py-6 text-center">
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-500">{convos.length === 0 ? 'Δεν έχεις ανοιχτή συνομιλία.' : 'Καμία ανοιχτή συνομιλία για αυτή την αναζήτηση.'}</p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 divide-y divide-gray-50 overflow-y-auto">
                {visibleConvos.map((convo) => {
                  const last = convo.messages?.[0];
                  const preview = last?.body || (last?.mediaUrl ? 'Εικόνα' : 'Χωρίς μήνυμα');
                  const live = namesTyping(convo.id);
                  return (
                    <button key={convo.id} onClick={() => openConversation(convo.id)} className={`flex w-full items-center gap-2 px-4 py-3 text-left ${activeId === convo.id ? 'bg-[#faf5fc]' : 'hover:bg-gray-50'}`}>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-gray-900">{titleOf(convo)}</span>
                          {tagsOf(convo).map((tag) => <RoleTag key={tag} tag={tag} />)}
                        </span>
                        {live.length > 0 ? (
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[#77328D]">
                            <TypingDots />
                            <span className="truncate">{typingPhrase(live)}</span>
                          </span>
                        ) : (
                          <span className="block truncate text-xs text-gray-500">{preview}</span>
                        )}
                      </span>
                      {convo.unread && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E95926] ring-4 ring-[#fff1ec]" aria-label="Αδιάβαστο" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex min-h-[24rem] flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Διάλεξε μια συνομιλία</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">
                <span className="truncate">{titleOf(active)}</span>
                {tagsOf(active).map((tag) => <RoleTag key={tag} tag={tag} />)}
                <button
                  type="button"
                  onClick={() => removeConversation(active)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {active.startedByMe ? 'Διαγραφή για όλους' : 'Διαγραφή για εμένα'}
                </button>
              </div>
              {namesTyping(active.id).length > 0 && (
                <div className="flex items-center gap-2 border-b border-gray-100 bg-[#faf5fc] px-5 py-2 text-sm font-medium text-[#77328D]">
                  <TypingDots />
                  <span>{typingPhrase(namesTyping(active.id))}</span>
                </div>
              )}
              <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                {messages.map((message) => {
                  const mine = message.senderId === user?.id;
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-[#77328D] text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {!mine && <div className="mb-0.5 text-[11px] font-semibold text-[#77328D]">{message.sender?.fullName}</div>}
                        {message.mediaUrl && (
                          <img src={message.mediaUrl} alt="" className="mb-1 max-h-52 w-full rounded-xl object-cover" />
                        )}
                        {message.body && <div className="whitespace-pre-wrap">{message.body}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-100 p-3">
                {emojisOpen && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => setDraft((value) => value + emoji)} className="rounded-lg px-1.5 py-1 text-xl hover:bg-gray-100">
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {imagePreview && (
                  <div className="relative mb-2 w-28">
                    <img src={imagePreview} alt="" className="h-20 w-28 rounded-lg object-cover" />
                    <button type="button" onClick={clearImage} className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white">×</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEmojisOpen((value) => !value)} className="rounded-xl border border-gray-200 px-2 text-[#77328D]">
                    <Smile className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-gray-200 px-2 text-[#E95926]">
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setImage(file);
                      setImagePreview((current) => {
                        if (current) URL.revokeObjectURL(current);
                        return file ? URL.createObjectURL(file) : '';
                      });
                      event.target.value = '';
                    }}
                  />
                  <input
                    value={draft}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft(value);
                      pulseTyping(value.trim().length > 0);
                    }}
                    onKeyDown={(event) => { if (event.key === 'Enter') send(); }}
                    placeholder="Γράψε μήνυμα"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button onClick={send} disabled={sending || (!draft.trim() && !image)} className="rounded-xl bg-[#77328D] px-3 text-white disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function typingPhrase(names: string[]) {
  if (names.length <= 1) return `${names[0] ?? 'Κάποιος'} γράφει τώρα`;
  if (names.length === 2) return `${names[0]} και ${names[1]} γράφουν τώρα`;
  return `${names[0]} και άλλοι γράφουν τώρα`;
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      <span className="typing-dot" />
      <span className="typing-dot" style={{ animationDelay: '0.15s' }} />
      <span className="typing-dot" style={{ animationDelay: '0.3s' }} />
    </span>
  );
}

function RoleTag({ tag }: { tag: string }) {
  const teacher = tag === 'Εκπαιδευτικός';
  const admin = tag === 'Διαχειριστής';
  const tone = teacher
    ? 'bg-[#fff1ec] text-[#E95926]'
    : admin
      ? 'bg-gray-100 text-gray-600'
      : 'bg-[#f3e8f7] text-[#77328D]';
  return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone}`}>{tag}</span>;
}

function others(convo: Conversation, userId?: string) {
  return convo.participants
    .map((person) => person.user)
    .filter((person) => person && person.id !== userId);
}
