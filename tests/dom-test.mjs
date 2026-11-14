import fs from 'node:fs';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../vulcan.html', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('../vulcan-app.js', import.meta.url), 'utf8');
const htmlIds = [...html.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]);
const refs = [...code.matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, 'Duplicate HTML ids');
for (const id of refs) assert.ok(htmlIds.includes(id), `Missing HTML element #${id}`);
for (const pillar of ['lives','drops','transships']) {
  assert.ok(html.includes(`data-tab="${pillar}"`), `Missing navigation tab ${pillar}`);
}
assert.ok(html.includes('src="./vulcan-pillars.js"') || code.includes('"./vulcan-pillars.js"'), 'Pillar schema not imported');
console.log(`DOM contract passed: ${refs.length} element references matched, ${htmlIds.length} unique ids.`);
