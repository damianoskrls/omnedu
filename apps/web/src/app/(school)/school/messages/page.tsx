'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { MessageSquare, Plus } from 'lucide-react';

interface Conversation {
  id: string;
  title?: string;
  participants: { user: { id: string; fullName: string } }[];
  messages?: { content: string; createdAt: string }[];
}

export default function MessagesPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    api.get(`/schools/${schoolId}/conversations`).then((data: any) => {
      setConvos(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schoolId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500 text-sm mt-1">Conversations with parents and staff</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> New Conversation
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading...</p>
      ) : convos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No conversations yet</p>
          <p className="text-gray-400 text-sm mt-1">Start a conversation with a parent or colleague</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {convos.map((convo) => {
            const others = convo.participants
              .filter((p) => p.user.id !== user?.sub)
              .map((p) => p.user.fullName)
              .join(', ');
            const lastMsg = convo.messages?.[0];
            return (
              <div key={convo.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
                  {(others || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{convo.title || others || 'Conversation'}</div>
                  {lastMsg && (
                    <div className="text-sm text-gray-400 truncate">{lastMsg.content}</div>
                  )}
                </div>
                {lastMsg && (
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(lastMsg.createdAt).toLocaleDateString('el-GR')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
