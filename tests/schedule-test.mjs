import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../vulcan-app.js', import.meta.url), 'utf8');
const start = source.indexOf('export function scheduledShifts');
const end = source.indexOf('\nasync function startForSignedIn', start);
assert.ok(start >= 0 && end > start, 'schedule function must exist');
const fragment = source.slice(start, end).replace('export function', 'function');
const scheduledShifts = new Function('TIMEZONE', fragment + '\nreturn scheduledShifts;')('America/Los_Angeles');

const cases = [
  ['Sunday daytime', '2026-11-15T20:00:00Z', ['front-days']],
  ['Wednesday daytime overlap', '2026-11-18T20:00:00Z', ['front-days', 'back-days']],
  ['Wednesday night overlap', '2026-11-19T02:00:00Z', ['front-nights', 'back-nights']],
  ['Friday night', '2026-11-14T06:00:00Z', ['back-nights']],
  ['Sunday 02:00 carryover from Saturday night', '2026-11-15T10:00:00Z', ['back-nights']],
  ['Thursday 04:45 shift handoff', '2026-11-19T12:45:00Z', ['back-days', 'front-nights', 'back-nights']],
  ['Sunday 05:15 after Saturday night ends', '2026-11-15T13:15:00Z', ['front-days']],
  ['Saturday daytime', '2026-11-14T23:00:00Z', ['back-days']]
];
for (const [name, when, expected] of cases) {
  assert.deepEqual(scheduledShifts(new Date(when)).sort(), expected.slice().sort(), name);
  console.log('PASS', name);
}
console.log('Shift schedule tests:', cases.length, 'passed.');
