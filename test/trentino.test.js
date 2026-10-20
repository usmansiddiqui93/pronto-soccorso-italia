import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/trentino-apss-opendata.js';

test('Trentino open data parses units, codes, observation and timestamp', async () => {
  const rows = parse(JSON.parse(await readFile(new URL('./fixtures/trentino.json', import.meta.url))));
  assert.equal(rows.length, 3); // the "KO" entry is skipped

  const trento = rows.find((r) => r.id === 'tn-001-PS-PS');
  assert.equal(trento.name, 'Ospedale Santa Chiara');
  assert.equal(trento.city, 'Trento');
  assert.deepEqual(trento.triage.verde, { waiting: 12, inTreatment: 8 });
  assert.deepEqual(trento.triage.arancione, { waiting: 0, inTreatment: 14 });
  assert.equal(trento.waiting, 15);
  assert.equal(trento.inTreatment, 33);
  assert.equal(trento.observation, 12);
  assert.equal(trento.updatedAt, '2026-10-20T22:35:03.000Z');

  const ped = rows.find((r) => r.id === 'tn-001-PS-PSP');
  assert.equal(ped.name, 'Ospedale Santa Chiara – PS Pediatrico');
  assert.equal(ped.lat, trento.lat);

  assert.equal(rows.find((r) => r.id === 'tn-006-PS-PS').city, 'Rovereto');
});
