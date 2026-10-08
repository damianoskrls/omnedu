'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AdminAlerts } from '@/components/layout/admin-alerts';
import { Sidebar } from '@/components/layout/sidebar';
import { useStoredUser } from '@/lib/auth';

export function AppShell({
  variant,
  children,
}: {
  variant: 'super-admin' | 'school';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const user = useStoredUser();
  const today = new Intl.DateTimeFormat('el-GR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="min-h-screen">
      <Sidebar variant={variant} open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#77328d]/10 bg-[#f7f4ef]/80 px-4 py-3 backdrop-blur-md sm:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-[#77328d]/15 bg-white p-2 text-[#642678] shadow-sm lg:hidden"
            aria-label="Άνοιγμα μενού"
          >
            <Menu className="h-4 w-4" />
          </button>
          <p className="hidden text-sm font-semibold capitalize text-[#6b625c] sm:block">{today}</p>
          <div className="ml-auto flex items-center gap-2">
            {variant === 'school' && <AdminAlerts />}
            <span className="hidden h-2 w-2 rounded-full bg-[#cce3ac] ring-4 ring-[#e7f3d4] sm:inline-block" />
            <p className="max-w-[14rem] truncate text-sm font-bold text-[#2f2a28]">
              {user?.fullName ?? 'Ονειροχώρα'}
            </p>
          </div>
        </header>
        <main className="app-main mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
