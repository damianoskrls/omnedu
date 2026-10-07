/** Today in Athens, as YYYY-MM-DD. */
export function athensTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Status shown in the UI. Completed follows the day after the event, even if the API still says published. */
export function eventDisplayStatus(
  status: string | null | undefined,
  eventDate: string | null | undefined,
  now = new Date(),
): string {
  const base = status || 'draft';
  if (base === 'draft' || !eventDate) return base === 'completed' ? 'published' : base;
  const day = String(eventDate).slice(0, 10);
  const today = athensTodayYmd(now);
  if ((base === 'published' || base === 'completed') && day < today) return 'completed';
  if (base === 'completed' && day >= today) return 'published';
  return base;
}
