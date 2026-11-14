import assert from 'node:assert/strict';
import { PILLARS, editableRole, normalizePillarFields } from '../vulcan-pillars.js';

assert.deepEqual(Object.fromEntries(Object.entries(PILLARS).map(([k, v]) => [k, v.fields.length])), {
  lives: 15, drops: 36, transships: 58
});
for (const [pillar, schema] of Object.entries(PILLARS)) {
  const codes = schema.fields.map((field) => field.code);
  assert.equal(new Set(codes).size, codes.length, pillar + ' has duplicate Excel column codes');
  assert.equal(codes[0], 'A', pillar + ' does not start at column A');
}
assert.deepEqual(normalizePillarFields('lives', {
  A: '  TEST-ISA  ', C: 'ARRIVED', G: '15', F: '2026-11-14T04:30', O: ''
}), { A: 'TEST-ISA', C: 'ARRIVED', G: 15, F: new Date('2026-11-14T04:30').toISOString() });
assert.throws(() => normalizePillarFields('lives', {C:'UNRECOGNIZED'}), /invalid selection/);
assert.throws(() => normalizePillarFields('lives', {G:'-2'}), /non-negative/);
assert.throws(() => normalizePillarFields('drops', {N:'abc'}), /non-negative/);
assert.throws(() => normalizePillarFields('transships', {}), /at least one field/);
assert.equal(editableRole('tier1-clerk'), true);
assert.equal(editableRole('pa-clerk'), true);
assert.equal(editableRole('manager'), true);
assert.equal(editableRole('senior-operations-manager'), false);
assert.equal(editableRole('pa'), false);
assert.equal(editableRole('tier1'), false);
console.log('Pillar schema tests passed: 15 Lives, 36 Drops, 58 Transships, typed validation and roles.');
