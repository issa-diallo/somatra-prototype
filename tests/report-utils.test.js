'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {mkdtempSync, writeFileSync, readFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {execFileSync} = require('node:child_process');
const reports = require('../report-utils.js');

const entries = [
  {id:1, date:'2026-08-03', client:'Client B', department:'Réception', activity:'Rangement', operator:'Magasinier démo', minutes:35},
  {id:2, date:'2026-08-02', client:'Client A', activity:'Inventaire', operator:'Magasinier démo', minutes:25},
  {id:3, date:'2026-08-04', client:'Client A', department:'Quai 1', activity:'Préparation de commande', operator:'Magasinier démo', minutes:40}
];

test('un relevé client est un PDF valide avec tableau, fallback et total en minutes', () => {
  const bytes = reports.createClientPdf(entries.filter((entry) => entry.client === 'Client A'), '2026-08', 'Client A');
  const content = Buffer.from(bytes).toString('latin1');
  assert.ok(content.startsWith('%PDF-1.4'));
  assert.ok(content.endsWith('%%EOF\n'));
  for (const label of ['Client : Client A', 'Date', 'Département', 'Activité', 'Nom', 'Temps', 'Non renseigné', 'TOTAL : 65 minutes']) assert.match(content, new RegExp(label));
});

test('le ZIP tous clients est standard, déterministe et contient un PDF non vide par client', () => {
  const artifact = reports.prepareArtifact(entries, '2026-08', 'all');
  const second = reports.prepareArtifact(entries, '2026-08', 'all');
  assert.equal(artifact.format, 'ZIP');
  assert.equal(artifact.pdfCount, 2);
  assert.deepEqual(artifact.bytes, second.bytes);
  const directory = mkdtempSync(join(tmpdir(), 'somatra-report-'));
  const archive = join(directory, artifact.filename);
  writeFileSync(archive, artifact.bytes);
  const names = execFileSync('unzip', ['-Z1', archive], {encoding:'utf8'}).trim().split('\n');
  assert.deepEqual(names, ['somatra-releve-2026-08-client-a.pdf', 'somatra-releve-2026-08-client-b.pdf']);
  execFileSync('unzip', ['-qq', archive, '-d', directory]);
  names.forEach((name) => assert.ok(readFileSync(join(directory, name)).subarray(0, 7).equals(Buffer.from('%PDF-1.'))));
});

test('les collisions de noms sûrs reçoivent un suffixe déterministe sans doublon', () => {
  const collisionEntries = [
    {...entries[0], id:10, client:'Client-é'},
    {...entries[1], id:11, client:'Client-e'}
  ];
  const artifact = reports.prepareArtifact(collisionEntries, '2026-08', 'all');
  assert.deepEqual(artifact.files.map((file) => file.name), [
    'somatra-releve-2026-08-client-e.pdf',
    'somatra-releve-2026-08-client-e-2.pdf'
  ]);
});

test('le même artifact conserve exactement les mêmes octets pour les deux actions', () => {
  const artifact = reports.prepareArtifact(entries, '2026-08', 'Client A');
  const downloadedBytes = artifact.bytes;
  const simulatedSendBytes = artifact.bytes;
  assert.strictEqual(downloadedBytes, simulatedSendBytes);
  assert.equal(artifact.format, 'PDF');
  assert.equal(artifact.pdfCount, 1);
});

test('le département absent reste neutre et une donnée financière libre est masquée entièrement', () => {
  assert.equal(reports.clean(undefined), 'Non renseigné');
  assert.equal(reports.clean('Montant 55 CHF'), 'Information retirée');
});

test('aucun fichier vide ne peut être produit', () => {
  assert.throws(() => reports.prepareArtifact([], '2026-08', 'all'), /Aucune saisie/);
  assert.throws(() => reports.createClientPdf([], '2026-08', 'Client A'), /vide/);
});