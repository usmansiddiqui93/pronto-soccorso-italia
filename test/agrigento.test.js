import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/sicilia-agrigento-asp.js';

test('ASP Agrigento page parses patients present per code, folding giallo into arancione', async () => {
  const html = await readFile(new URL('./fixtures/agrigento.html', import.meta.url), 'utf8');
  const { updatedAt, hospitals } = parse(html);
  assert.equal(updatedAt, '2026-10-20T22:45:02.000Z');
  assert.equal(hospitals.length, 1);
  const ag = hospitals[0];
  assert.equal(ag.heading, 'Ospedale di Agrigento');
  assert.equal(ag.triage.rosso.present, 1);
  assert.equal(ag.triage.arancione.present, 24); // 22 arancione + 2 giallo (fixture value)
  assert.equal(ag.triage.verde.present, 10);
  assert.equal(ag.triage.azzurro.present, 5);
  assert.equal(ag.triage.bianco.present, 0);
  assert.equal(ag.triage.arancione.waiting, null);
  assert.equal(ag.present, 40);
});
