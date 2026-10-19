'use client';

import { useState } from 'react';
import { Menu, ChevronDown } from 'lucide-react';
import { AdminAlerts } from '@/components/layout/admin-alerts';
import { Sidebar } from '@/components/layout/sidebar';
import { TopSearchBar } from '@/components/layout/top-search-bar';
import { useStoredUser } from '@/lib/auth';
import { AcademicYearProvider, useAcademicYear } from '@/contexts/AcademicYearContext';

function YearPicker() {
  const { years, selectedYear, setSelectedYear } = useAcademicYear();
  if (years.length <= 1) return null;
  return (
    <div className="relative hidden sm:flex items-center">
      <select
        value={selectedYear?.id ?? ''}
        onChange={e => {
          const y = years.find(yr => yr.id === e.target.value);
          if (y) setSelectedYear(y);
        }}
        className="appearance-none cursor-pointer rounded-xl border border-[#77328d]/20 bg-white/80 pl-3 pr-7 py-1.5 text-xs font-semibold text-[#642678] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#77328d]/30"
      >
        {years.map(y => (
          <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? ' ✓' : ''}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-[#642678]" />
    </div>
  );
}

function AppShellInner({
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
          {variant === 'school' && <YearPicker />}
          <TopSearchBar variant={variant} />
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

export function AppShell({
  variant,
  children,
}: {
  variant: 'super-admin' | 'school';
  children: React.ReactNode;
}) {
  const user = useStoredUser();
  const schoolId = variant === 'school' ? (user?.schoolId ?? '') : '';

  if (variant === 'school') {
    return (
      <AcademicYearProvider schoolId={schoolId}>
        <AppShellInner variant={variant}>{children}</AppShellInner>
      </AcademicYearProvider>
    );
  }

  return <AppShellInner variant={variant}>{children}</AppShellInner>;
}
