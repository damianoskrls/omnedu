'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';

type Notice = {
  id: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  sentAt: string;
  type?: string;
  data?: { conversationId?: string; screen?: string } | null;
};

function badge(count: number) {
  if (!count) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E95926] px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-[#f7f4ef]">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function AdminAlerts() {
  const user = useStoredUser();
  const router = useRouter();
  const schoolId = user?.role === 'school_admin' ? user.schoolId : '';
  const [messages, setMessages] = useState(0);
  const [updates, setUpdates] = useState(0);
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const panel = useRef<HTMLDivElement>(null);

  const loadCounts = useCallback(() => {
    if (!schoolId) return;
    api.get(`/schools/${schoolId}/conversations/unread-count`).then((data: any) => {
      setMessages(Number(data?.count) || 0);
    }).catch(() => {});
    api.get(`/schools/${schoolId}/notifications/unread-count`).then((data: any) => {
      setUpdates(Number(data?.count) || 0);
    }).catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    loadCounts();
    const timer = window.setInterval(loadCounts, 30000);
    window.addEventListener('focus', loadCounts);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', loadCounts);
    };
  }, [loadCounts]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openUpdates = async () => {
    const next = !open;
    setOpen(next);
    if (!next || !schoolId) return;
    const data: any = await api.get(`/schools/${schoolId}/notifications/inbox`).catch(() => []);
    setNotices(Array.isArray(data) ? data : []);
  };

  const markOne = async (notice: Notice) => {
    if (!schoolId) return;
    if (!notice.isRead) {
      await api.post(`/schools/${schoolId}/notifications/inbox/${notice.id}/read`).catch(() => {});
      setNotices((rows) => rows.map((row) => (row.id === notice.id ? { ...row, isRead: true } : row)));
      setUpdates((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    if (notice.type === 'message' || notice.data?.screen === 'message') router.push('/school/messages');
  };

  const markAll = async () => {
    if (!schoolId) return;
    await api.post(`/schools/${schoolId}/notifications/inbox/read-all`).catch(() => {});
    setNotices((rows) => rows.map((row) => ({ ...row, isRead: true })));
    setUpdates(0);
  };

  if (!schoolId) return null;

  return (
    <div className="flex items-center gap-1.5" ref={panel}>
      <Link
        href="/school/messages"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#77328d]/15 bg-white text-[#642678] shadow-sm hover:bg-[#faf5fc]"
        aria-label="Μηνύματα"
      >
        <MessageSquare className="h-4 w-4" />
        {badge(messages)}
      </Link>
      <button
        type="button"
        onClick={openUpdates}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#77328d]/15 bg-white text-[#642678] shadow-sm hover:bg-[#faf5fc]"
        aria-label="Ενημερώσεις"
      >
        <Bell className="h-4 w-4" />
        {badge(updates)}
      </button>
      {open && (
        <div className="absolute right-4 top-16 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#77328d]/10 bg-white shadow-xl sm:right-8">
          <div className="flex items-center justify-between border-b border-[#77328d]/10 px-4 py-3">
            <p className="text-sm font-extrabold text-[#2f2a28]">Ενημερώσεις</p>
            {updates > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-bold text-[#77328D] hover:underline">
                Όλα διαβασμένα
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notices.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#8a756c]">Δεν υπάρχουν ενημερώσεις</p>
            ) : notices.map((notice) => (
              <button
                key={notice.id}
                type="button"
                onClick={() => markOne(notice)}
                className={`block w-full border-b border-[#f3ece6] px-4 py-3 text-left last:border-0 hover:bg-[#faf6f2] ${notice.isRead ? '' : 'bg-[#faf5fc]'}`}
              >
                <p className="text-sm font-bold text-[#2f2a28]">{notice.title}</p>
                {notice.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#6b625c]">{notice.body}</p>}
                <p className="mt-1 text-[11px] text-[#a89890]">
                  {new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(notice.sentAt))}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
