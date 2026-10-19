'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, ChevronDown, Check, Plus } from 'lucide-react';
import { AdminAlerts } from '@/components/layout/admin-alerts';
import { Sidebar } from '@/components/layout/sidebar';
import { TopSearchBar } from '@/components/layout/top-search-bar';
import { useStoredUser } from '@/lib/auth';
import { AcademicYearProvider, useAcademicYear } from '@/contexts/AcademicYearContext';

function YearPicker() {
  const { years, selectedYear, setSelectedYear } = useAcademicYear();
  const [open, setOpen] = useState(false);

  if (years.length === 0) return null;

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-[#77328d]/20 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#642678] shadow-sm hover:bg-white transition-colors focus:outline-none"
      >
        {selectedYear?.label ?? '—'}
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
            <div className="border-b border-gray-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Σχολικό Έτος</p>
            </div>
            <div className="py-1.5">
              {years.map(y => {
                const isSelected = selectedYear?.id === y.id;
                return (
                  <button
                    key={y.id}
                    onClick={() => { setSelectedYear(y); setOpen(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-[#f3e8f7]' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`flex-1 text-sm font-semibold ${isSelected ? 'text-[#642678]' : 'text-gray-800'}`}>{y.label}</span>
                    {y.isCurrent && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Τρέχον</span>
                    )}
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[#642678]" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-gray-50 p-2">
              <Link
                href="/school/new-year"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#642678] transition-colors hover:bg-[#f3e8f7]"
              >
                <Plus className="h-4 w-4" />
                Νέα Σχολική Χρονιά
              </Link>
            </div>
          </div>
        </>
      )}
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
