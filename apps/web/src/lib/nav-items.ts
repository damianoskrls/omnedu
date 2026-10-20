import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen, Baby,
  MessageSquare, CreditCard, Settings,
  Layers, Utensils, ClipboardList, Pill, BellRing, Zap, Bus, Wrench,
  Newspaper, CalendarDays, ScrollText, NotebookPen, PartyPopper, TreePalm,
  BarChart3, Shirt, FileText, CalendarPlus, Cake,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const superAdminNav: NavGroup[] = [
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

export const schoolNav: NavGroup[] = [
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
      { href: '/school/assignments', label: 'Εργασίες', icon: FileText },
      { href: '/school/medications', label: 'Φάρμακα', icon: Pill },
      { href: '/school/activities', label: 'Δραστηριότητες', icon: Zap },
    ],
  },
  {
    label: 'Ενημέρωση',
    items: [
      { href: '/school/found', label: 'Ευρήματα', icon: Shirt },
      { href: '/school/posts', label: 'Ανακοινώσεις', icon: Newspaper },
      { href: '/school/events', label: 'Εκδρομές & Εκδηλώσεις', icon: CalendarDays },
      { href: '/school/celebrations', label: 'Γιορτές', icon: PartyPopper },
      { href: '/school/party-invitations', label: 'Προσκλήσεις Πάρτυ', icon: Cake },
      { href: '/school/questionnaires', label: 'Ερωτηματολόγιο', icon: ClipboardList },
      { href: '/school/notifications', label: 'Ειδοποιήσεις', icon: BellRing },
      { href: '/school/messages', label: 'Μηνύματα', icon: MessageSquare },
    ],
  },
  {
    label: 'Λειτουργία',
    items: [
      { href: '/school/new-year', label: 'Νέα Σχολική Χρονιά', icon: CalendarPlus },
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

export interface SearchItem extends NavItem {
  category: string;
}

export function navGroupsToSearchItems(groups: NavGroup[]): SearchItem[] {
  return groups.flatMap((g) => g.items.map((item) => ({ ...item, category: g.label })));
}
