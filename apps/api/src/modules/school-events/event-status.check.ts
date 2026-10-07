import assert from 'node:assert/strict';
import { isAfterEventDay, resolveEventStatus, eventDayYmd } from './event-status';

const oct16 = new Date('2026-10-16T00:00:00.000Z');
const morningOf16 = new Date('2026-10-16T06:00:00.000Z'); // 09:00 Athens
const morningOf17 = new Date('2026-10-17T06:00:00.000Z');

assert.equal(eventDayYmd(oct16), '2026-10-16');
assert.equal(eventDayYmd('2026-10-16'), '2026-10-16');
assert.equal(isAfterEventDay(oct16, morningOf16), false);
assert.equal(isAfterEventDay(oct16, morningOf17), true);
assert.equal(resolveEventStatus('published', oct16, 'draft', morningOf16), 'published');
assert.equal(resolveEventStatus('published', oct16, 'draft', morningOf17), 'completed');
assert.equal(resolveEventStatus('completed', oct16, 'published', morningOf16), 'published');
assert.equal(resolveEventStatus('draft', oct16, 'published', morningOf17), 'draft');
assert.equal(resolveEventStatus(undefined, oct16, 'completed', morningOf17), 'completed');
assert.equal(resolveEventStatus('published', null, 'draft', morningOf17), 'published');

console.log('event status ok');
