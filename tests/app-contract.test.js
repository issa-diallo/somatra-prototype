'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname, '..');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

test('l’application ouvre directement l’espace magasinier sans interface financière', () => {
  assert.match(app, /showView\('warehouse'\);\s*$/);
  assert.doesNotMatch(`${app}\n${html}`, /CHF|chiffre d.affaires|tarif fictif|view-billing|invoice-dialog|export-csv/i);
});

test('les trois clés localStorage historiques sont les seules clés Somatra déclarées', () => {
  const keys = [...app.matchAll(/'somatra-demo-[^']+'/g)].map((match) => match[0]);
  assert.deepEqual([...new Set(keys)].sort(), ["'somatra-demo-clients-v1'", "'somatra-demo-entries-v1'", "'somatra-demo-open-preparations-v1'"]);
});

test('department reste une propriété additive et facultative pour les données legacy', () => {
  assert.match(app, /hasOwnProperty\.call\(task, 'department'\)/);
  assert.match(app, /delete entry\.department/);
  assert.match(html, /id="task-department"[^>]*maxlength="80"/);
});