'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname, '..');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');

test('la navigation mobile utilise des pictogrammes structurés et expose la destination active', () => {
  assert.match(app, /mobile-nav-icon/);
  assert.match(app, /setAttribute\('aria-current', 'page'\)/);
  assert.match(app, /removeAttribute\('aria-current'\)/);
});

test('le shell mobile respecte les safe areas et garde le CTA principal atteignable', () => {
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.timer-button\{[^}]*position:sticky/);
  assert.match(css, /\.mobile-nav button\[aria-current="page"\]/);
});

test('les contrôles mobiles restent tactiles et la carte web devient une surface d’app', () => {
  assert.match(css, /--mobile-control-height:52px/);
  assert.match(css, /\.task-panel\{[^}]*border:0[^}]*box-shadow:none/);
  assert.match(css, /\.scan-button span\{[^}]*font-size:22px/);
});
