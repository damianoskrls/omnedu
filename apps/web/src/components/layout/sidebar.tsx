'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getStoredUser, useStoredUser } from '@/lib/auth';
import { schoolsApi } from '@/lib/api';
import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen, Baby,
  MessageSquare, CreditCard, Settings, LogOut,
  Layers, Utensils, ClipboardList, Pill, BellRing, Zap, Bus, Wrench, Newspaper, CalendarDays, ScrollText, NotebookPen, PartyPopper, TreePalm, BarChart3, Shirt,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  variant: 'super-admin' | 'school';
  schoolName?: string;
  open?: boolean;
  onClose?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const superAdminNav: NavGroup[] = [
  {
    label: 'Πλατφόρμα',
    items: [
      { href: '/super-admin/dashboard', label: 'Επισκόπηση', icon: LayoutDashboard },
      { href: '/super-admin/schools', label: 'Σχολεία', icon: School },
      { href: '/super-admin/users', label: 'Χρήστες', icon: Users },
      { href: '/super-admin/settings', label: 'Ρυθμίσεις', icon: Settings },
    ],
  },
];

const schoolNav: NavGroup[] = [
  {
    label: 'Καθημερινά',
    items: [
      { href: '/school/dashboard', label: 'Επισκόπηση', icon: LayoutDashboard },
      { href: '/school/students', label: 'Μαθητές', icon: GraduationCap },
      { href: '/school/parents', label: 'Γονείς', icon: Baby },
      { href: '/school/classes', label: 'Τάξεις', icon: BookOpen },
      { href: '/school/levels', label: 'Βαθμίδες', icon: Layers },
      { href: '/school/staff', label: 'Προσωπικό', icon: Users },
      { href: '/school/menu', label: 'Διατροφολόγιο', icon: Utensils },
      { href: '/school/thematic', label: 'Διαθεματικό', icon: NotebookPen },
      { href: '/school/medications', label: 'Φάρμακα', icon: Pill },
      { href: '/school/activities', label: 'Δραστηριότητες', icon: Zap },
    ],
  },
  {
    label: 'Ενημέρωση',
    items: [
      { href: '/school/found', label: 'Ευρήματα', icon: Shirt },
      { href: '/school/posts', label: 'Νέα & Εκδηλώσεις', icon: Newspaper },
      { href: '/school/events', label: 'Εκδρομές & Θέατρο', icon: CalendarDays },
      { href: '/school/celebrations', label: 'Γιορτές', icon: PartyPopper },
      { href: '/school/questionnaires', label: 'Ερωτηματολόγιο', icon: ClipboardList },
      { href: '/school/notifications', label: 'Ειδοποιήσεις', icon: BellRing },
      { href: '/school/messages', label: 'Μηνύματα', icon: MessageSquare },
    ],
  },
  {
    label: 'Λειτουργία',
    items: [
      { href: '/school/routes', label: 'Σχολικό', icon: Bus },
      { href: '/school/services', label: 'Παροχές', icon: Wrench },
      { href: '/school/reports', label: 'Αναφορές', icon: BarChart3 },
      { href: '/school/billing', label: 'Οικονομικά', icon: CreditCard },
      { href: '/school/regulations', label: 'Κανονισμοί', icon: ScrollText },
      { href: '/school/holidays', label: 'Σχολικές αργίες', icon: TreePalm },
      { href: '/school/settings', label: 'Ρυθμίσεις', icon: Settings },
    ],
  },
];

function initials(name?: string | null) {
  if (!name) return 'Ο';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'Ο';
}

export function Sidebar({ variant, schoolName, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = useStoredUser();
  const groups = variant === 'super-admin' ? superAdminNav : schoolNav;

  const [branding, setBranding] = useState<{ name: string; logoUrl: string; primaryColor: string }>({
    name: '', logoUrl: '', primaryColor: '',
  });

  useEffect(() => {
    const cached = {
      name: localStorage.getItem('school_name') ?? '',
      logoUrl: localStorage.getItem('school_logo_url') ?? '',
      primaryColor: localStorage.getItem('school_primary_color') ?? '',
    };
    setBranding(cached);
    if (cached.primaryColor) {
      document.documentElement.style.setProperty('--school-primary', cached.primaryColor);
    }

    if (variant === 'school' && !cached.name && !cached.logoUrl) {
      const stored = getStoredUser();
      if (stored?.schoolId) {
        schoolsApi.get(stored.schoolId).then((s: any) => {
          const name = s.name ?? '';
          const logoUrl = s.logoUrl ?? '';
          const primaryColor = s.primaryColor ?? '';
          if (name) localStorage.setItem('school_name', name);
          if (logoUrl) localStorage.setItem('school_logo_url', logoUrl);
          if (primaryColor) localStorage.setItem('school_primary_color', primaryColor);
          setBranding({ name, logoUrl, primaryColor });
          if (primaryColor) document.documentElement.style.setProperty('--school-primary', primaryColor);
        }).catch(() => {});
      }
    }
  }, [variant]);

  const displayName = variant === 'school' ? (branding.name || schoolName || 'Ονειροχώρα') : 'Ονειροχώρα';

  return (
    <>
      <button
        type="button"
        aria-label="Κλείσιμο μενού"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-[#2a0f33]/30 backdrop-blur-[2px] transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r border-[#77328d]/10 bg-white/95 shadow-[8px_0_40px_-28px_rgba(119,50,141,0.55)] backdrop-blur-md transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="h-1.5 bg-gradient-to-r from-[#E95926] via-[#c46a3a] to-[#77328D]" />

        <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <img
              src="/oneirochora-logo.png"
              alt="Ονειροχώρα"
              className="h-auto w-full"
            />
            {displayName !== 'Ονειροχώρα' && (
              <p className="mt-1 truncate px-1 text-center text-xs font-semibold text-[#5c534c]">
                {displayName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-lg p-1.5 text-[#6b625c] hover:bg-[#faf5fc] lg:hidden"
            aria-label="Κλείσιμο"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#a89890]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-[#f3e8f7] text-[#642678] shadow-sm'
                          : 'text-[#5c534c] hover:bg-[#faf6f2] hover:text-[#2f2a28]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg',
                          active ? 'bg-white text-[#77328D]' : 'bg-[#f6f1ea] text-[#8a756c]',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#77328d]/10 p-3">
          <div className="mb-1 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#77328D] text-xs font-extrabold text-white">
              {initials(user?.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#2f2a28]">{user?.fullName ?? 'Χρήστης'}</p>
              <p className="truncate text-xs text-[#8a756c]">{user?.email ?? displayName}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#6b625c] transition-colors hover:bg-[#fff1ec] hover:text-[#c2410c]"
          >
            <LogOut className="h-4 w-4" />
            Αποσύνδεση
          </button>
        </div>
      </aside>
    </>
  );
}
