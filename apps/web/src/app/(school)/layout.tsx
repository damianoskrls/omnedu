import { AppShell } from '@/components/layout/app-shell';

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="school">{children}</AppShell>;
}
