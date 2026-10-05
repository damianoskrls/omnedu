'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getStoredUser } from '@/lib/auth';
import { schoolsApi } from '@/lib/api';
import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen,
  MessageSquare, CreditCard, Settings, LogOut, ChevronRight,
  Layers, Utensils, ClipboardList, Pill, BellRing, Zap, Bus, Wrench, Newspaper, CalendarDays,
} from 'lucide-react';

interface SidebarProps {
  variant: 'super-admin' | 'school';
  schoolName?: string;
}

const superAdminNav = [
  { href: '/super-admin/dashboard', label: 'Επισκόπηση', icon: LayoutDashboard },
  { href: '/super-admin/schools', label: 'Σχολεία', icon: School },
  { href: '/super-admin/users', label: 'Χρήστες', icon: Users },
  { href: '/super-admin/settings', label: 'Ρυθμίσεις', icon: Settings },
];

const schoolNav = [
  { href: '/school/dashboard', label: 'Επισκόπηση', icon: LayoutDashboard },
  { href: '/school/students', label: 'Μαθητές', icon: GraduationCap },
  { href: '/school/classes', label: 'Τάξεις', icon: BookOpen },
  { href: '/school/levels', label: 'Βαθμίδες', icon: Layers },
  { href: '/school/staff', label: 'Προσωπικό', icon: Users },
  { href: '/school/menu', label: 'Διατροφολόγιο', icon: Utensils },
  { href: '/school/questionnaires', label: 'Ερωτηματολόγιο', icon: ClipboardList },
  { href: '/school/medications', label: 'Φάρμακα', icon: Pill },
  { href: '/school/activities', label: 'Δραστηριότητες', icon: Zap },
  { href: '/school/posts', label: 'Νέα & Εκδηλώσεις', icon: Newspaper },
  { href: '/school/events', label: 'Εκδρομές & Θέατρο', icon: CalendarDays },
  { href: '/school/routes', label: 'Σχολικό', icon: Bus },
  { href: '/school/services', label: 'Παροχές', icon: Wrench },
  { href: '/school/notifications', label: 'Ειδοποιήσεις', icon: BellRing },
  { href: '/school/messages', label: 'Μηνύματα', icon: MessageSquare },
  { href: '/school/billing', label: 'Οικονομικά', icon: CreditCard },
  { href: '/school/settings', label: 'Ρυθμίσεις', icon: Settings },
];

export function Sidebar({ variant, schoolName }: SidebarProps) {
  const pathname = usePathname();
  const nav = variant === 'super-admin' ? superAdminNav : schoolNav;

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

    // If no cached branding, fetch from API
    if (variant === 'school' && !cached.name && !cached.logoUrl) {
      const user = getStoredUser();
      if (user?.schoolId) {
        schoolsApi.get(user.schoolId).then((s: any) => {
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

  const displayName = variant === 'school' ? (branding.name || schoolName || 'omnedu') : 'omnedu';

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col min-h-screen">
      <div className="p-5 border-b border-gray-100">
        {variant === 'school' && branding.logoUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={branding.logoUrl}
              alt={displayName}
              className="h-9 w-9 object-contain rounded-lg shrink-0"
            />
            <span className="text-sm font-semibold text-gray-800 truncate">{displayName}</span>
          </div>
        ) : (
          <h1 className="text-xl font-bold text-indigo-600">omnedu</h1>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Αποσύνδεση
        </button>
      </div>
    </aside>
  );
}
