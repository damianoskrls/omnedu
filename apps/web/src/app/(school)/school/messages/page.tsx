'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { ImagePlus, MessageSquare, Send, Smile } from 'lucide-react';

const EMOJIS = ['😀', '😁', '😂', '😊', '😍', '🤗', '👍', '👏', '🙏', '❤️', '🎉', '🌟', '✅', '📷'];

type Person = { id: string; fullName: string; schoolMemberships?: { role: string }[] };
type Conversation = {
  id: string;
  participants: { userId: string; user: Person }[];
  messages?: { body?: string; sentAt?: string }[];
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
  const [picking, setPicking] = useState<'parents' | 'teachers' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const openConversation = (id: string) => {
    setActiveId(id);
    setPicking(false);
    api.get(`/schools/${schoolId}/conversations/${id}/messages`).then((data: any) => {
      setMessages(Array.isArray(data) ? data : []);
    }).catch(() => setMessages([]));
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
      openConversation(activeId);
      loadConversations();
    } finally {
      setSending(false);
    }
  };

  const active = convos.find((row) => row.id === activeId);
  const titleOf = (convo: Conversation) => {
    const people = others(convo, user?.id);
    const parents = people.filter((person) => person.schoolMemberships?.some((row) => row.role === 'parent'));
    const named = parents.length ? parents : people.filter((person) => !person.schoolMemberships?.some((row) => row.role === 'school_admin'));
    return named.map((person) => person.fullName).join(', ') || 'Συνομιλία';
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Μηνύματα</h1>
        <p className="text-sm text-gray-500 mt-1">Επικοινωνία με γονείς και εκπαιδευτικούς. Οι συνομιλίες γονέα με τη δασκάλα δεν εμφανίζονται εδώ.</p>
      </div>
      <div className="grid min-h-[32rem] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:grid-cols-[320px_1fr]">
        <div className="border-b border-gray-100 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">Συνομιλίες</span>
            <div className="flex gap-2">
              <button onClick={() => setPicking((value) => value === 'parents' ? null : 'parents')} className="text-xs font-semibold text-[#77328D]">Γονέας</button>
              <button onClick={() => setPicking((value) => value === 'teachers' ? null : 'teachers')} className="text-xs font-semibold text-[#E95926]">Εκπαιδευτικός</button>
            </div>
          </div>
          {picking === 'parents' && (
            <div className="max-h-48 overflow-y-auto border-t border-gray-50">
              {parents.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">Δεν υπάρχουν γονείς.</p>
              ) : parents.map((parent) => (
                <button key={parent.id} onClick={() => startWith(parent.id)} className="block w-full px-4 py-2 text-left hover:bg-[#faf5fc]">
                  <span className="block text-sm font-medium text-gray-900">{parent.name}</span>
                  {!!parent.students?.length && <span className="block text-xs text-gray-500">{parent.students.join(', ')}</span>}
                </button>
              ))}
            </div>
          )}
          {picking === 'teachers' && (
            <div className="max-h-48 overflow-y-auto border-t border-gray-50">
              {teachers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">Δεν υπάρχουν εκπαιδευτικοί.</p>
              ) : teachers.map((teacher) => (
                <button key={teacher.id} onClick={() => startWith(teacher.id)} className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-900 hover:bg-[#fff7f4]">
                  {teacher.name}
                </button>
              ))}
            </div>
          )}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Φόρτωση...</p>
          ) : convos.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">Δεν υπάρχουν μηνύματα από γονείς.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {convos.map((convo) => {
                const last = convo.messages?.[0];
                return (
                  <button key={convo.id} onClick={() => openConversation(convo.id)} className={`block w-full px-4 py-3 text-left ${activeId === convo.id ? 'bg-[#faf5fc]' : 'hover:bg-gray-50'}`}>
                    <span className="block truncate text-sm font-semibold text-gray-900">{titleOf(convo)}</span>
                    <span className="block truncate text-xs text-gray-500">{last?.body || ((last as { mediaUrl?: string })?.mediaUrl ? 'Εικόνα' : 'Χωρίς μήνυμα')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex min-h-[24rem] flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Διάλεξε μια συνομιλία</div>
          ) : (
            <>
              <div className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">{titleOf(active)}</div>
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
                    onChange={(event) => setDraft(event.target.value)}
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

function others(convo: Conversation, userId?: string) {
  return convo.participants
    .map((person) => person.user)
    .filter((person) => person && person.id !== userId);
}
