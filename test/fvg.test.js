import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/fvg-regione-psonline.js';

test('FVG feed parses sites, counts, average waits and notes', async () => {
  const rows = parse(JSON.parse(await readFile(new URL('./fixtures/fvg.json', import.meta.url))));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].updatedAt, '2026-10-20T22:50:20.000Z');

  const pn = rows.find((r) => r.id === 'fvg-32487');
  assert.equal(pn.name, 'PS Pordenone');
  assert.equal(pn.city, 'Pordenone');
  assert.deepEqual(pn.triage.azzurro, { waiting: 7, inTreatment: 11, minutes: 106 });
  assert.deepEqual(pn.triage.verde, { waiting: 3, inTreatment: 2, minutes: 202 });
  assert.equal(pn.waiting, 12);
  assert.equal(pn.inTreatment, 23);

  const mag = rows.find((r) => r.id === 'fvg-61860');
  assert.equal(mag.note, 'Orario di apertura: dalle 08:00 alle 19:30');
  assert.equal(mag.waiting, null); // no colour data
});
