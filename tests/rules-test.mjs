import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set, query, orderByChild, equalTo, serverTimestamp } from 'firebase/database';

const projectId = 'demo-vulcan-auth-tests';
const rules = fs.readFileSync(new URL('../database.rules.proposed.json', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({
  projectId,
  database: { host: '127.0.0.1', port: 9000, rules }
});
let passed = 0;
let failed = 0;
const timestamp = () => Date.now();
const auth = (uid, verified = true) => env.authenticatedContext(uid, {
  email: uid + '@example.test', email_verified: verified
}).database();
const noAuth = env.unauthenticatedContext().database();
const request = (uid, shift, role) => ({
  uid, homeShift: shift, role, requesterName: uid,
  status: 'pending', createdAt: serverTimestamp()
});
const record = (uid, fields, version = 1, archived = false, created = uid) => ({
  fields, version, archived, createdBy: created, createdAt: serverTimestamp(),
  updatedBy: uid, updatedAt: serverTimestamp()
});
async function test(name, success, run) {
  let outcome;
  try { await run(); outcome = true; }
  catch (error) { outcome = false; if (success) console.error('  cause:', error.message); }
  if (outcome === success) { passed++; console.log('PASS', name); }
  else { failed++; console.error('FAIL', name, 'expected', success ? 'allow' : 'deny'); }
}
try {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await set(ref(db, 'admins/admin'), true);
    for (const [uid, homeShift, role] of [
      ['admin', 'back-nights', 'admin'],
      ['clerkB', 'back-nights', 'tier1-clerk'],
      ['managerB', 'back-nights', 'manager'],
      ['clerkF', 'front-days', 'tier1-clerk'],
      ['viewerB', 'back-nights', 'tier1'],
      ['seniorB', 'back-nights', 'senior-operations-manager']
    ]) {
      await set(ref(db, 'memberships/' + uid), {
        homeShift, role, active: true, approvedBy: 'BOOTSTRAP', approvedAt: timestamp()
      });
    }
  });

  await test('anonymous cannot read existing membership', false, () => get(ref(noAuth, 'memberships/admin')));
  await test('anonymous cannot send an access request', false, () => set(ref(noAuth, 'homeRequests/x'), request('x', 'back-nights', 'tier1')));
  await test('unverified email cannot submit request', false, () => set(ref(auth('unverified', false), 'homeRequests/unverified'), request('unverified', 'back-nights', 'tier1')));
  await test('verified user can submit home request', true, () => set(ref(auth('newclerk'), 'homeRequests/newclerk'), request('newclerk', 'back-nights', 'pa-clerk')));
  await test('cannot submit a second initial home request', false, () => set(ref(auth('newclerk'), 'homeRequests/newclerk'), request('newclerk', 'back-nights', 'admin')));
  await test('cannot self-assign a membership', false, () => set(ref(auth('newclerk'), 'memberships/newclerk'), {homeShift:'back-nights',role:'admin',active:true,approvedBy:'newclerk',approvedAt:serverTimestamp()}));
  await test('same-shift tier1 clerk may approve PA clerk', true, () => set(ref(auth('clerkB'), 'memberships/newclerk'), {homeShift:'back-nights',role:'pa-clerk',active:true,approvedBy:'clerkB',approvedAt:serverTimestamp()}));
  await test('approved member cannot change their own role', false, () => set(ref(auth('newclerk'), 'memberships/newclerk'), {homeShift:'back-nights',role:'admin',active:true,approvedBy:'newclerk',approvedAt:serverTimestamp()}));
  await test('cross-shift requests cannot be read without a matching query', false, () => get(ref(auth('clerkB'), 'homeRequests')));
  await test('same-shift reviewer may list filtered requests', true, () => get(query(ref(auth('clerkB'), 'homeRequests'), orderByChild('homeShift'), equalTo('back-nights'))));
  await test('reviewer cannot list other shift requests', false, () => get(query(ref(auth('clerkB'), 'homeRequests'), orderByChild('homeShift'), equalTo('front-days'))));
  await test('requester cannot read another user request', false, () => get(ref(auth('newclerk'), 'homeRequests/admin')));
  await test('tier1 clerk cannot approve manager', true, () => set(ref(auth('managerApplicant'), 'homeRequests/managerApplicant'), request('managerApplicant','back-nights','manager')));
  await test('tier1 role ceiling applies', false, () => set(ref(auth('clerkB'), 'memberships/managerApplicant'), {homeShift:'back-nights',role:'manager',active:true,approvedBy:'clerkB',approvedAt:serverTimestamp()}));
  await test('manager can approve another manager', true, () => set(ref(auth('managerB'), 'memberships/managerApplicant'), {homeShift:'back-nights',role:'manager',active:true,approvedBy:'managerB',approvedAt:serverTimestamp()}));
  await test('requester can request administrator role', true, () => set(ref(auth('adminApplicant'), 'homeRequests/adminApplicant'), request('adminApplicant','back-nights','admin')));
  await test('manager cannot grant administrator', false, () => set(ref(auth('managerB'), 'memberships/adminApplicant'), {homeShift:'back-nights',role:'admin',active:true,approvedBy:'managerB',approvedAt:serverTimestamp()}));
  await test('backend seeded administrator may approve admin', true, () => set(ref(auth('admin'), 'memberships/adminApplicant'), {homeShift:'back-nights',role:'admin',active:true,approvedBy:'admin',approvedAt:serverTimestamp()}));
  await test('member cannot add arbitrary privileged profile field', false, () => set(ref(auth('newclerk'), 'profiles/newclerk'), {setupComplete:true,displayName:'Name',pronunciation:'',about:'',color:'#f5a451',status:'active',role:'admin'}));
  await test('member can save allowed profile', true, () => set(ref(auth('newclerk'), 'profiles/newclerk'), {setupComplete:true,displayName:'Name',pronunciation:'',about:'',color:'#f5a451',status:'active'}));
  await test('member cannot save unbounded widgets', false, () => set(ref(auth('newclerk'), 'preferences/newclerk/widgets'), ['lives','drops','transships','dwells','fifo','reports','other']));
  await test('member can save a valid widget list', true, () => set(ref(auth('newclerk'), 'preferences/newclerk/widgets'), ['lives','fifo']));
  await test('approved helper can request a different shift', true, () => set(ref(auth('newclerk'), 'otRequestsByShift/front-days/newclerk'), {uid:'newclerk',targetShift:'front-days',createdAt:serverTimestamp()}));
  await test('requester cannot grant their own temporary access', false, () => set(ref(auth('newclerk'), 'otGrants/front-days/newclerk'), {approvedBy:'newclerk',issuedAt:serverTimestamp(),expiresAt:timestamp()+86400000}));
  await test('home-shift clerk cannot approve another shift coverage', false, () => set(ref(auth('clerkB'), 'otGrants/front-days/newclerk'), {approvedBy:'clerkB',issuedAt:serverTimestamp(),expiresAt:timestamp()+86400000}));
  await test('target-shift clerk can approve 24 hour coverage', true, () => set(ref(auth('clerkF'), 'otGrants/front-days/newclerk'), {approvedBy:'clerkF',issuedAt:serverTimestamp(),expiresAt:timestamp()+86400000}));
  await test('existing active coverage cannot be overwritten by the worker', false, () => set(ref(auth('newclerk'), 'otGrants/front-days/newclerk'), {approvedBy:'newclerk',issuedAt:serverTimestamp(),expiresAt:timestamp()+86400000}));
  await test('existing chat messages remain protected', false, () => get(ref(auth('newclerk'), 'messages')));

  // Fictional records only. Production work data is never loaded into test runners.
  const livePath = 'operational/back-nights/lives/testLive';
  const testLive = { A: 'FICTIONAL-ISA-01', B: 'DOOR-TEST', C: 'ARRIVED', G: 12, O: 'Test note' };
  await test('anonymous cannot list operational records', false, () => get(ref(noAuth, 'operational/back-nights/lives')));
  await test('even a member cannot list all shifts at database root', false, () => get(ref(auth('clerkB'), 'operational')));
  await test('home clerk can create a Lives record', true, () => set(ref(auth('clerkB'), livePath), record('clerkB', testLive)));
  await test('home clerk can read their Lives pillar', true, () => get(ref(auth('clerkB'), 'operational/back-nights/lives')));
  await test('other shift cannot read the Lives pillar', false, () => get(ref(auth('clerkF'), 'operational/back-nights/lives')));
  await test('tier 1 viewer may read home-shift records', true, () => get(ref(auth('viewerB'), livePath)));
  await test('senior operations manager may read home-shift records', true, () => get(ref(auth('seniorB'), livePath)));
  await test('tier 1 viewer cannot edit records', false, () => set(ref(auth('viewerB'), 'operational/back-nights/lives/viewerAttempt'), record('viewerB', {A:'NO'})));
  await test('senior operations manager cannot edit three pillars', false, () => set(ref(auth('seniorB'), 'operational/back-nights/lives/seniorAttempt'), record('seniorB', {A:'NO'})));
  await test('other shift cannot create records', false, () => set(ref(auth('clerkF'), 'operational/back-nights/drops/crossShift'), record('clerkF', {A:'NO'})));
  await test('cannot write extra fields to Lives', false, () => set(ref(auth('clerkB'), 'operational/back-nights/lives/extra'), record('clerkB', {A:'TEST', ADMIN:'true'})));
  await test('cannot set a negative unit count', false, () => set(ref(auth('clerkB'), 'operational/back-nights/lives/negative'), record('clerkB', {A:'TEST', G:-1})));
  await test('cannot save unsupported status', false, () => set(ref(auth('clerkB'), 'operational/back-nights/lives/status'), record('clerkB', {A:'TEST', C:'MADE_UP'})));
  await test('cannot impersonate creator', false, () => set(ref(auth('clerkB'), 'operational/back-nights/lives/forged'), record('clerkB', {A:'TEST'}, 1, false, 'admin')));
  await test('cannot add privileged top-level field', false, () => set(ref(auth('clerkB'), 'operational/back-nights/lives/privileged'), {...record('clerkB', {A:'TEST'}), role:'admin'}));
  await test('cannot directly delete a record', false, () => set(ref(auth('clerkB'), livePath), null));
  await test('cannot overwrite without increasing version', false, () => set(ref(auth('clerkB'), livePath), record('clerkB', {A:'CHANGED'}, 1)));
  await test('cannot replace original creator on update', false, () => set(ref(auth('managerB'), livePath), record('managerB', {A:'CHANGED'}, 2)));
  const original = (await get(ref(auth('clerkB'), livePath))).val();
  await test('can update Lives with version increment', true, () => set(ref(auth('managerB'), livePath), {...original, fields:{...testLive, G:13},version:2,updatedBy:'managerB',updatedAt:serverTimestamp()}));
  await test('archiving is allowed and preserves data', true, async () => {
    const previous = (await get(ref(auth('clerkB'), livePath))).val();
    await set(ref(auth('clerkB'), livePath), {...previous, archived:true, version:3,updatedBy:'clerkB',updatedAt:serverTimestamp()});
  });
  await test('archived record can be restored', true, async () => {
    const previous = (await get(ref(auth('clerkB'), livePath))).val();
    await set(ref(auth('clerkB'), livePath), {...previous, archived:false, version:4,updatedBy:'clerkB',updatedAt:serverTimestamp()});
  });
  await test('home clerk can create Drops record with matching schema', true, () => set(ref(auth('clerkB'), 'operational/back-nights/drops/testDrop'), record('clerkB', {A:'FICTIONAL-ISA-02', D:'ARRIVED', N:5})));
  await test('home clerk can create Transships record with matching schema', true, () => set(ref(auth('clerkB'), 'operational/back-nights/transships/testTransship'), record('clerkB', {A:'FICTIONAL-VRID-02', G:'PALLETIZED', R:7})));
  await test('approved overtime user can read target shift pillar', true, () => get(ref(auth('newclerk'), 'operational/front-days/lives')));
  await test('approved overtime PA clerk may edit target shift', true, () => set(ref(auth('newclerk'), 'operational/front-days/lives/overtime'), record('newclerk', {A:'FICTIONAL-OVERTIME'})));
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await set(ref(db, 'otGrants/front-days/newclerk/expiresAt'), timestamp() - 1000);
  });
  await test('expired overtime cannot read target shift', false, () => get(ref(auth('newclerk'), 'operational/front-days/lives')));
  await test('expired overtime cannot edit target shift', false, () => set(ref(auth('newclerk'), 'operational/front-days/drops/expired'), record('newclerk', {A:'NO'})));
  await test('expired overtime user retains home access', true, () => get(ref(auth('newclerk'), 'operational/back-nights/lives')));
} finally {
  await env.cleanup();
}
console.log('\nRules tests:', passed, 'passed;', failed, 'failed.');
if (failed) process.exitCode = 1;
