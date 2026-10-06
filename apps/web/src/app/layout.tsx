import type { Metadata } from 'next';
import { Noto_Sans } from 'next/font/google';
import './globals.css';

const noto = Noto_Sans({
  subsets: ['latin', 'greek'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Ονειροχώρα',
  description: 'Σύστημα διαχείρισης του βρεφονηπιακού σταθμού και νηπιαγωγείου Ονειροχώρα',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className={noto.className}>{children}</body>
    </html>
  );
}
