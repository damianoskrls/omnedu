'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { storeTokens } from '@/lib/auth';

const ORANGE = '#E95926';
const PURPLE = '#77328D';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res: any = await api.post('/auth/login', { email, password });
      storeTokens(res.accessToken, res.refreshToken);

      if (res.user.isSuperAdmin) {
        router.push('/super-admin/dashboard');
      } else {
        router.push('/school/dashboard');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Λάθος στοιχεία σύνδεσης');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(920px 520px at 8% 12%, #d7efb8 0%, transparent 68%), radial-gradient(720px 460px at 96% 0%, #ead8f4 0%, transparent 62%), radial-gradient(680px 420px at 92% 100%, #ffd8c8 0%, transparent 58%), linear-gradient(165deg, #f4fbea 0%, #fbf7fd 46%, #fff5f0 100%)',
        }}
      />
      <div className="pointer-events-none absolute -left-20 top-8 h-64 w-96 rounded-[50%] bg-[#cce3ac]/80 blur-2xl" />
      <div className="pointer-events-none absolute left-16 top-36 h-40 w-72 rounded-[50%] bg-[#e8f6d6] blur-xl" />
      <div className="pointer-events-none absolute -right-10 -top-8 h-56 w-56 rounded-full bg-[#77328d]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-10 h-52 w-72 rounded-full bg-[#e95926]/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-24px_rgba(119,50,141,0.45)]">
          <div
            className="h-1.5"
            style={{ background: `linear-gradient(90deg, ${ORANGE} 0%, #c46a3a 48%, ${PURPLE} 100%)` }}
          />

          <div className="px-7 pb-8 pt-5 sm:px-9">
            <img
              src="/oneirochora-logo.png"
              alt="Ονειροχώρα — Βρεφονηπιακός σταθμός και νηπιαγωγείο"
              className="mx-auto h-auto w-full"
            />

            <p className="mt-1 text-center text-sm font-medium tracking-wide text-[#5c534c]">
              Σύνδεση στο σύστημα
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#4a433f]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@oneirochora.gr"
                  className="w-full rounded-xl border border-[#e4d7ea] bg-white px-4 py-2.5 text-sm text-[#2f2a28] outline-none transition placeholder:text-[#b3a8a2] focus:border-[#77328D] focus:ring-2 focus:ring-[#77328D]/25"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#4a433f]">
                  Κωδικός
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#e4d7ea] bg-white px-4 py-2.5 text-sm text-[#2f2a28] outline-none transition placeholder:text-[#b3a8a2] focus:border-[#77328D] focus:ring-2 focus:ring-[#77328D]/25"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-[#f3c3b4] bg-[#fff1ec] px-4 py-3 text-sm text-[#c2410c]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#77328D] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#642678] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Σύνδεση...' : 'Σύνδεση'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
