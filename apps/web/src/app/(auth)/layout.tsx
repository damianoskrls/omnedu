import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ονειροχώρα — Σύνδεση',
  description: 'Σύνδεση στο σύστημα του βρεφονηπιακού σταθμού και νηπιαγωγείου Ονειροχώρα',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
