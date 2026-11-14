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
      ['clerkF', 'front-days', 'tier1-clerk']
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
} finally {
  await env.cleanup();
}
console.log('\nRules tests:', passed, 'passed;', failed, 'failed.');
if (failed) process.exitCode = 1;
