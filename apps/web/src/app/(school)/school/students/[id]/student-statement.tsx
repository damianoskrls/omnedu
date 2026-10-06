'use client';

const MONTHS = ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

const money = (value: number) => `€${Math.abs(value).toFixed(2)}`;

function statusLabel(status: string, totalDue?: number) {
  if (status === 'paid' && Number(totalDue ?? 0) === 0) return { text: 'Καλύπτεται', className: 'bg-emerald-100 text-emerald-700' };
  if (status === 'paid') return { text: 'Εξοφλήθη', className: 'bg-green-100 text-green-700' };
  if (status === 'partial') return { text: 'Μερική πληρωμή', className: 'bg-blue-100 text-blue-700' };
  if (status === 'upcoming') return { text: 'Δεν έχει ανοίξει', className: 'bg-gray-100 text-gray-500' };
  return { text: 'Αναμονή πληρωμής', className: 'bg-amber-100 text-amber-800' };
}

export function StudentStatement({
  statement,
  isAdmin,
  saving,
  onPayMonth,
  onUndoMonth,
  onPayExtra,
}: {
  statement: any;
  isAdmin: boolean;
  saving: boolean;
  onPayMonth: (chargeId: string, amount: number) => void;
  onUndoMonth: (chargeId: string) => void;
  onPayExtra: (extra: any) => void;
}) {
  const current = statement.current;
  const owed = Number(statement.pendingNow ?? 0);

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl px-5 py-4 text-white ${owed > 0 ? 'bg-[#77328D]' : 'bg-emerald-600'}`}>
        <p className="text-sm text-white/80">Σύνολο που εκκρεμεί τώρα</p>
        <p className="text-3xl font-extrabold tracking-tight">{owed > 0 ? money(owed) : 'Τίποτα'}</p>
        <p className="text-xs text-white/75 mt-1">Ανοιχτοί μήνες, γραφική ύλη και εκδρομές που δεν έχουν εξοφληθεί.</p>
      </div>

      {current && (
        <div className="bg-white rounded-2xl border border-[#e6d0ee] shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#77328D]">Τρέχων μήνας</p>
              <h3 className="text-xl font-bold text-gray-900">{MONTHS[current.month]} {current.year}</h3>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-gray-900">{money(Number(current.totalDue))}</div>
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusLabel(current.status, Number(current.totalDue)).className}`}>
                {statusLabel(current.status, Number(current.totalDue)).text}
              </span>
            </div>
          </div>
          <LineList lines={current.lines} />
          <ExtraList extras={current.extras} isAdmin={isAdmin} saving={saving} onPayExtra={onPayExtra} />
          {isAdmin && current.chargeId && current.status !== 'paid' && current.status !== 'upcoming' && (
            <button
              onClick={() => onPayMonth(current.chargeId, Number(current.totalDue))}
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-[#77328D] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Εξόφληση μήνα
            </button>
          )}
        </div>
      )}

      {statement.stationery && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Έναρξη χρονιάς</p>
            <h3 className="font-bold text-gray-900">{statement.stationery.description}</h3>
            <p className="text-xs text-gray-500">Μία φορά για τη σχολική χρονιά {statement.schoolYear}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold">{money(Number(statement.stationery.amount))}</div>
            <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusLabel(statement.stationery.status).className}`}>
              {statement.stationery.status === 'paid' ? 'Πληρώθηκε' : 'Δεν έχει πληρωθεί'}
            </span>
          </div>
          {isAdmin && statement.stationery.status !== 'paid' && (
            <button
              onClick={() => onPayExtra({ id: statement.stationery.id, kind: 'once', amount: statement.stationery.amount })}
              disabled={saving}
              className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
            >
              Πληρώθηκε
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Σχολικό έτος {statement.schoolYear}</h3>
          <p className="text-xs text-gray-500">Κάθε μήνας δείχνει φοίτηση, σχολικό και δραστηριότητες που ίσχυαν τότε. Ένα voucher αφαιρείται από τους μήνες που δεν έχουν εξοφληθεί.</p>
        </div>
        <div className="divide-y divide-gray-50">
          {(statement.months ?? []).map((month: any) => {
            const badge = statusLabel(month.status, Number(month.totalDue));
            const quiet = month.status === 'upcoming';
            return (
              <div key={`${month.year}-${month.month}`} className={`px-5 py-4 ${quiet ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-36 shrink-0">
                    <p className="font-semibold text-gray-900">{MONTHS[month.month]}</p>
                    <p className="text-xs text-gray-400">{month.year}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <LineList lines={month.lines} compact />
                    <ExtraList extras={month.extras} isAdmin={isAdmin && !quiet} saving={saving} onPayExtra={onPayExtra} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-extrabold text-gray-900">{money(Number(month.totalDue))}</p>
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>
                    {isAdmin && month.chargeId && month.status !== 'paid' && month.status !== 'upcoming' && (
                      <button onClick={() => onPayMonth(month.chargeId, Number(month.totalDue))} className="block ml-auto mt-2 text-xs font-semibold text-[#77328D]">Εξόφληση</button>
                    )}
                    {isAdmin && month.chargeId && month.status === 'paid' && Number(month.totalDue) > 0 && (
                      <button onClick={() => onUndoMonth(month.chargeId)} className="block ml-auto mt-2 text-xs text-gray-400">Αναίρεση</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LineList({ lines, compact }: { lines?: { label: string; amount: number }[]; compact?: boolean }) {
  if (!lines?.length) return <p className="text-sm text-gray-400">Δεν υπάρχει μηνιαία χρέωση.</p>;
  return (
    <ul className={compact ? 'space-y-0.5' : 'mt-4 divide-y divide-gray-50 rounded-xl border border-gray-100'}>
      {lines.map((line) => (
        <li key={line.label} className={`flex justify-between gap-3 text-sm ${compact ? 'py-0.5' : 'px-3 py-2'}`}>
          <span className="text-gray-700">{line.label}</span>
          <span className={line.amount < 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-gray-900'}>
            {line.amount < 0 ? `−${money(line.amount)}` : money(line.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExtraList({
  extras,
  isAdmin,
  saving,
  onPayExtra,
}: {
  extras?: any[];
  isAdmin: boolean;
  saving: boolean;
  onPayExtra: (extra: any) => void;
}) {
  if (!extras?.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {extras.map((extra) => {
        const badge = statusLabel(extra.status === 'pending_payment' ? 'unpaid' : extra.status);
        return (
          <div key={extra.id} className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm">
            <span className="flex-1 text-gray-800">{extra.kind === 'event' ? `Εκδρομή · ${extra.title}` : extra.title}</span>
            <span className="font-semibold">{money(Number(extra.amount))}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>
            {isAdmin && extra.status !== 'paid' && (
              <button onClick={() => onPayExtra(extra)} disabled={saving} className="text-xs font-semibold text-green-700">Πληρώθηκε</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
