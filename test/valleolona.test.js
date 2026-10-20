import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/lombardia-varese-valleolona.js';

test('ASST Valle Olona page groups rows by unit, with minutes and patient counts', async () => {
  const html = await readFile(new URL('./fixtures/valleolona.html', import.meta.url), 'utf8');
  const { updatedAt, units } = parse(html);
  assert.equal(updatedAt, '2026-10-20T22:50:52.000Z');
  assert.equal(units.length, 2);
  const ped = units.find((u) => u.heading === 'PS PEDIATRICO - Gallarate');
  assert.deepEqual(ped.triage.verde, { waiting: null, inTreatment: null, present: 1, minutes: 12 });
  assert.equal(ped.present, 1);
  const gen = units.find((u) => u.heading === 'PRONTO SOCCORSO GENERALE - Gallarate');
  assert.equal(gen.present, 25);
  assert.equal(gen.triage.azzurro.minutes, 322);
  assert.equal(gen.triage.bianco.present, 0); // not listed = no patients
  assert.equal(gen.triage.bianco.minutes, null);
});
