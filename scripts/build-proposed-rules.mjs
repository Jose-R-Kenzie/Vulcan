// Regenerate ONLY the proposed local emulator rules. Never deploy from this script.
import fs from 'node:fs';
import { PILLARS } from '../vulcan-pillars.js';

const filename = new URL('../database.rules.proposed.json', import.meta.url);
const { rules } = JSON.parse(fs.readFileSync(filename, 'utf8'));
const active = "root.child('memberships').child(auth.uid).child('active').val() === true";
const home = "root.child('memberships').child(auth.uid).child('homeShift').val() === $shift";
const ot = "root.child('otGrants').child($shift).child(auth.uid).child('expiresAt').val() > now";
const admin = "root.child('admins').child(auth.uid).val() === true";
const editor = "(root.child('memberships').child(auth.uid).child('role').val() === 'manager' || root.child('memberships').child(auth.uid).child('role').val() === 'pa-clerk' || root.child('memberships').child(auth.uid).child('role').val() === 'tier1-clerk')";
const read = `auth !== null && auth.token.email_verified === true && (${admin} || (${active} && (${home} || ${ot})))`;
const write = `auth !== null && auth.token.email_verified === true && newData.exists() && (${admin} || (${active} && ${editor} && (${home} || ${ot})))`;
const record = [
  "newData.hasChildren(['fields','version','archived','createdBy','createdAt','updatedBy','updatedAt'])",
  "newData.child('createdBy').isString()",
  "newData.child('updatedBy').val() === auth.uid",
  "newData.child('archived').isBoolean()",
  "newData.child('version').isNumber()",
  "newData.child('version').val() === (data.exists() ? data.child('version').val() + 1 : 1)",
  "newData.child('createdAt').isNumber()",
  "newData.child('updatedAt').isNumber()",
  "newData.child('updatedAt').val() <= now",
  "newData.child('updatedAt').val() > now - 300000",
  "(data.exists() ? (newData.child('createdBy').val() === data.child('createdBy').val() && newData.child('createdAt').val() === data.child('createdAt').val()) : (newData.child('createdBy').val() === auth.uid && newData.child('createdAt').val() <= now && newData.child('createdAt').val() > now - 300000))"
].join(' && ');
const childAlways = { '.validate': 'true' };

function fieldRule(field) {
  if (field.kind === 'number') return 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000000';
  const base = `newData.isString() && newData.val().length > 0 && newData.val().length <= ${field.kind === 'note' ? 2000 : field.kind === 'datetime' ? 50 : 250}`;
  if (field.kind === 'select') return base + ' && (' + field.choices.map((v) => `newData.val() === ${JSON.stringify(v)}`).join(' || ') + ')';
  return base;
}
const operational = { '$shift': {} };
for (const [name, schema] of Object.entries(PILLARS)) {
  const fields = {};
  for (const field of schema.fields) fields[field.code] = { '.validate': fieldRule(field) };
  fields.$other = { '.validate': 'false' };
  operational.$shift[name] = {
    '.read': read,
    '$recordId': {
      '.write': write,
      '.validate': record,
      fields: { '.validate': 'newData.exists()', ...fields },
      version: childAlways, archived: childAlways,
      createdBy: childAlways, createdAt: childAlways,
      updatedBy: childAlways, updatedAt: childAlways,
      '$other': { '.validate': 'false' }
    }
  };
}
rules.operational = operational;
fs.writeFileSync(filename, JSON.stringify({ rules }, null, 2) + '\n');
