import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/sicilia-palermo-asp.js';

test('ASP Palermo page parses waiting, treatment, observation, index and time', async () => {
  const html = await readFile(new URL('./fixtures/palermo.html', import.meta.url), 'utf8');
  const [ing, ...rest] = parse(html);
  assert.equal(rest.length, 0);
  assert.equal(ing.heading, 'PRONTO SOCCORSO - INGRASSIA DI PALERMO');
  assert.deepEqual(ing.triage.rosso, { waiting: 0, inTreatment: 2 });
  assert.deepEqual(ing.triage.arancione, { waiting: 0, inTreatment: 10 });
  assert.deepEqual(ing.triage.azzurro, { waiting: 2, inTreatment: 9 });
  assert.deepEqual(ing.triage.verde, { waiting: 1, inTreatment: 1 });
  assert.equal(ing.observation, 4);
  assert.equal(ing.crowdingPct, 223);
  assert.equal(ing.updatedAt, '2026-10-20T22:41:17.000Z'); // 0:41:17 Rome summer time
});
