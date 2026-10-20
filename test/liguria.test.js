import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/liguria-regione-pslive.js';

test('Liguria feed parses counts, closed sites and missing data', async () => {
  const list = JSON.parse(await readFile(new URL('./fixtures/liguria.json', import.meta.url)));
  const rows = parse(list);
  assert.equal(rows.length, 4);

  const sm = rows.find((r) => r.id === 'lig-07090100');
  assert.equal(sm.city, 'Genova');
  assert.deepEqual(sm.triage.rosso, { waiting: 0, inTreatment: 3 });
  assert.deepEqual(sm.triage.azzurro, { waiting: 9, inTreatment: 21 });
  assert.equal(sm.waiting, 11);
  assert.equal(sm.inTreatment, 53);
  assert.equal(sm.crowdingPct, 58);
  assert.equal(sm.closed, false);
  assert.equal(sm.updatedAt, '2026-10-20T22:35:00.000Z');

  const micone = rows.find((r) => r.id === 'lig-07030103');
  assert.equal(micone.closed, true);
  assert.equal(micone.hours, '08:00–20:00');

  const gallino = rows.find((r) => r.id === 'lig-07030105');
  assert.equal(gallino.waiting, null);
  assert.equal(gallino.updatedAt, null);

  assert.equal(rows.find((r) => r.id === 'lig-07094000').kind, 'DEA II · Pediatrico');
});
