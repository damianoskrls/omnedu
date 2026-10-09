/** Calendar day of an event stored as a date (UTC midnight of YYYY-MM-DD). */
export function eventDayYmd(eventDate: Date | string | null | undefined): string | null {
  if (!eventDate) return null;
  if (typeof eventDate === 'string') {
    const day = eventDate.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  }
  if (Number.isNaN(eventDate.getTime())) return null;
  return eventDate.toISOString().slice(0, 10);
}

export function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function childFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function eventKindLabel(eventType: string | null | undefined): string {
  if (eventType === 'excursion') return 'εκδρομή';
  if (eventType === 'theater') return 'θέατρο';
  return 'εκδήλωση';
}

/** "Αύριο η Ίριδα έχει εκδρομή." */
export function dayBeforeTitle(fullNames: string[], eventType: string | null | undefined): string {
  const kind = eventKindLabel(eventType);
  const names = fullNames.map(childFirstName).filter(Boolean);
  if (names.length === 0) return `Αύριο το παιδί σου έχει ${kind}.`;
  if (names.length === 1) return `Αύριο η ${names[0]} έχει ${kind}.`;
  const head = names.slice(0, -1).map((name) => `η ${name}`).join(', ');
  return `Αύριο ${head} και η ${names[names.length - 1]} έχουν ${kind}.`;
}

export function dayBeforeBody(event: {
  title?: string | null;
  description?: string | null;
  arriveBy?: string | null;
  busOperates?: boolean | null;
}): string {
  const description = (event.description ?? '').replace(/\s+/g, ' ').trim();
  const parts = [
    (event.title ?? '').trim(),
    event.arriveBy ? `Να είναι στο σχολείο το αργότερο έως τις ${event.arriveBy}.` : '',
    event.busOperates === false
      ? 'Το σχολικό δεν θα λειτουργήσει εκείνη την ημέρα.'
      : event.busOperates === true
        ? 'Το σχολικό θα λειτουργήσει κανονικά.'
        : '',
    description,
  ].filter(Boolean);
  return parts.join(' ').slice(0, 500);
}

/** Today in Athens, as YYYY-MM-DD. The school day changes at Greek midnight. */
export function athensTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Completed only after the calendar day of the event, never on the day itself. */
export function isAfterEventDay(eventDate: Date | string | null | undefined, now = new Date()): boolean {
  const day = eventDayYmd(eventDate);
  if (!day) return false;
  return day < athensTodayYmd(now);
}

/**
 * Draft and published are chosen by the school.
 * Completed is never taken from the client: a published event becomes completed
 * the day after it happens, and a completed event returns to published if the date moves forward.
 */
export function resolveEventStatus(
  requested: string | undefined,
  eventDate: Date | string | null | undefined,
  previous?: string,
  now = new Date(),
): string {
  let next = requested === 'completed' ? undefined : requested;
  if (next === undefined) next = previous ?? 'draft';
  if (next !== 'draft' && next !== 'published' && next !== 'completed') next = previous ?? 'draft';
  if (next === 'published' && isAfterEventDay(eventDate, now)) return 'completed';
  if (next === 'completed' && !isAfterEventDay(eventDate, now)) return 'published';
  return next;
}
