import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCoords, parseView } from '../scripts/sources/sardegna-regione-monitorps.js';
import { totals } from '../scripts/lib.js';

const MAP = `var prontoSoccorsoData = [ { latitude: 40.58203, longitude: 8.3188719, number: 1, description: "<div class='infoWindow'>" + "<b>OSPEDALE CIVILE ALGHERO</b><br />" + "U.O. Pronto Soccorso Alghero Civile<br />" + "</div>" } ];`;

test('Sardegna monitor view parses units, rows, max waits, 118 arrivals and coordinates', async () => {
  const json = JSON.parse(await readFile(new URL('./fixtures/sardegna-view.json', import.meta.url)));
  const [u, ...rest] = parseView(json, parseCoords(MAP));
  assert.equal(rest.length, 0);
  assert.equal(u.id, '164');
  assert.equal(u.presidio, 'OSPEDALE CIVILE ALGHERO');
  assert.equal(u.city, 'Alghero');
  assert.equal(u.nota, 'Pronto Soccorso Generale');
  assert.deepEqual([u.lat, u.lon], [40.58203, 8.3188719]);
  assert.equal(u.updatedAt, '2026-10-20T23:49:47.000Z');
  assert.deepEqual(u.triage.azzurro, { waiting: 4, inTreatment: 2, minutes: 81 });
  assert.deepEqual(u.triage.verde, { waiting: 2, inTreatment: 3, minutes: 211 });
  assert.deepEqual(u.triage.rosso, { waiting: 0, inTreatment: 0, minutes: null });
  assert.deepEqual(totals(u.triage), { waiting: 7, inTreatment: 6 });
  assert.equal(u.arriving, 1);
});
