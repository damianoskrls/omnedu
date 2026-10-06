import { AppShell } from '@/components/layout/app-shell';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="super-admin">{children}</AppShell>;
}
