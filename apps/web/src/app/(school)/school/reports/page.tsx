'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { schoolReportsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Search } from 'lucide-react';

const MONTHS = ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

function money(value: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

type Report = {
  month: number;
  year: number;
  schoolYear: string;
  counts: Record<string, number>;
  classes: { id: string; name: string; level: string; capacity: number | null; students: number }[];
  unassigned: { id: string; fullName: string }[];
  siblings: { children: { id: string; fullName: string; className: string }[] }[];
  allergies: { id: string; fullName: string; className: string; allergies: string | null }[];
  bus: { id: string; fullName: string; className: string }[];
  finances: Record<string, number>;
  owing: { id: string; fullName: string; className: string; status: string; remaining: number; totalDue: number; paidAmount: number }[];
};

export default function ReportsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    schoolReportsApi.overview(schoolId).then((data: any) => {
      setReport(data);
    }).catch((err: any) => {
      setError(typeof err?.message === 'string' ? err.message : 'Η αναφορά δεν φορτώθηκε');
    }).finally(() => setLoading(false));
  }, [schoolId]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!report) return null;
    const hit = (text: string) => !needle || text.toLowerCase().includes(needle);
    return {
      siblings: report.siblings.filter((family) => hit(family.children.map((child) => `${child.fullName} ${child.className}`).join(' '))),
      owing: report.owing.filter((row) => hit(`${row.fullName} ${row.className}`)),
      allergies: report.allergies.filter((row) => hit(`${row.fullName} ${row.className} ${row.allergies ?? ''}`)),
      bus: report.bus.filter((row) => hit(`${row.fullName} ${row.className}`)),
      unassigned: report.unassigned.filter((row) => hit(row.fullName)),
    };
  }, [report, needle]);

  if (loading) return <p className="py-16 text-center text-sm text-[#8a756c]">Φόρτωση αναφοράς...</p>;
  if (!report || !filtered) return <p className="py-16 text-center text-sm text-red-600">{error || 'Η αναφορά δεν φορτώθηκε'}</p>;

  const cards = [
    ['Ενεργοί μαθητές', report.counts.students],
    ['Τάξεις', report.counts.classes],
    ['Γονείς', report.counts.parents],
    ['Προσωπικό', report.counts.staff],
    ['Οικογένειες με αδέλφια', report.counts.siblingFamilies],
    ['Σχολικό', report.counts.onBus],
    ['Με αλλεργίες', report.counts.withAllergies],
    ['Χωρίς τάξη', report.counts.unassigned],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2f2a28]">Αναφορές</h1>
          <p className="mt-1 text-sm text-[#6b625c]">Σχολικό έτος {report.schoolYear} · {MONTHS[report.month]} {report.year}</p>
        </div>
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-[#77328d]/15 bg-white px-3 py-2 text-sm font-semibold text-[#642678]">
          Εκτύπωση
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#77328d]/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#a89890]">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-[#2f2a28]">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#2f2a28]">Μαθητές ανά τάξη</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-[#a89890]">
                <th className="py-2 pr-3">Τάξη</th>
                <th className="py-2 pr-3">Βαθμίδα</th>
                <th className="py-2 pr-3">Μαθητές</th>
                <th className="py-2">Χωρητικότητα</th>
              </tr>
            </thead>
            <tbody>
              {report.classes.map((row) => (
                <tr key={row.id} className="border-b border-[#f3ece6]">
                  <td className="py-2 pr-3 font-semibold"><Link href={`/school/classes/${row.id}`} className="text-[#642678]">{row.name}</Link></td>
                  <td className="py-2 pr-3 text-[#6b625c]">{row.level || '—'}</td>
                  <td className="py-2 pr-3">{row.students}</td>
                  <td className="py-2">{row.capacity ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#2f2a28]">Οικονομικά</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Money label={`Οφειλή ${MONTHS[report.month]}`} value={report.finances.monthDue} />
          <Money label="Εισπράχθηκαν" value={report.finances.monthPaid} />
          <Money label="Υπόλοιπο μήνα" value={report.finances.monthRemaining} />
          <Money label={`Έτος ${report.schoolYear}`} value={report.finances.yearDue} />
          <Money label="Εισπράξεις έτους" value={report.finances.yearPaid} />
          <Money label="Επιδοτήσεις έτους" value={report.finances.yearSubsidies} />
        </div>
        <p className="mt-3 text-xs text-[#8a756c]">
          Δίδακτρα {money(report.finances.schoolFees)} · σχολικό {money(report.finances.busFees)} · δραστηριότητες {money(report.finances.activityFees)}
        </p>
        <h3 className="mb-2 mt-5 text-sm font-bold text-[#2f2a28]">Ανοιχτοί λογαριασμοί του μήνα</h3>
        {filtered.owing.length === 0 ? <Empty text="Δεν υπάρχουν ανοιχτές οφειλές." /> : (
          <ul className="divide-y divide-[#f3ece6]">
            {filtered.owing.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/school/students/${row.id}`} className="font-semibold text-[#2f2a28]">{row.fullName}</Link>
                <span className="text-[#6b625c]">{row.className}</span>
                <span className="font-bold text-[#E95926]">{money(row.remaining)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89890]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Αναζήτηση σε αδέλφια, οφειλές, αλλεργίες και σχολικό"
          className="w-full rounded-xl border border-[#77328d]/15 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#77328D]"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#2f2a28]">Αδέλφια</h2>
          {filtered.siblings.length === 0 ? <Empty text="Δεν βρέθηκαν αδέλφια." /> : (
            <ul className="mt-3 space-y-3">
              {filtered.siblings.map((family) => (
                <li key={family.children.map((child) => child.id).join('-')} className="rounded-xl bg-[#faf5fc] px-3 py-2">
                  {family.children.map((child) => (
                    <Link key={child.id} href={`/school/students/${child.id}`} className="block text-sm font-semibold text-[#2f2a28]">
                      {child.fullName}{child.className ? <span className="font-normal text-[#6b625c]"> · {child.className}</span> : null}
                    </Link>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#2f2a28]">Αλλεργίες</h2>
          {filtered.allergies.length === 0 ? <Empty text="Δεν υπάρχουν καταχωρημένες αλλεργίες." /> : (
            <ul className="mt-3 divide-y divide-[#f3ece6]">
              {filtered.allergies.map((row) => (
                <li key={row.id} className="py-2 text-sm">
                  <Link href={`/school/students/${row.id}`} className="font-semibold text-[#2f2a28]">{row.fullName}</Link>
                  <span className="text-[#8a756c]"> {row.className ? `· ${row.className}` : ''}</span>
                  <p className="text-[#6b625c]">{row.allergies}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#2f2a28]">Σχολικό</h2>
          {filtered.bus.length === 0 ? <Empty text="Κανείς δεν είναι στο σχολικό." /> : (
            <ul className="mt-3 divide-y divide-[#f3ece6]">
              {filtered.bus.map((row) => (
                <li key={row.id} className="flex justify-between py-2 text-sm">
                  <Link href={`/school/students/${row.id}`} className="font-semibold text-[#2f2a28]">{row.fullName}</Link>
                  <span className="text-[#6b625c]">{row.className}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#77328d]/10 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#2f2a28]">Χωρίς τάξη</h2>
          {filtered.unassigned.length === 0 ? <Empty text="Όλοι οι ενεργοί μαθητές είναι σε τάξη." /> : (
            <ul className="mt-3 divide-y divide-[#f3ece6]">
              {filtered.unassigned.map((row) => (
                <li key={row.id} className="py-2 text-sm">
                  <Link href={`/school/students/${row.id}`} className="font-semibold text-[#642678]">{row.fullName}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#faf6f2] px-3 py-2">
      <p className="text-xs text-[#8a756c]">{label}</p>
      <p className="text-lg font-extrabold text-[#2f2a28]">{money(value)}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 text-sm text-[#8a756c]">{text}</p>;
}
