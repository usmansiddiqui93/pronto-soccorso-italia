import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePage } from '../scripts/sources/veneto-regione-portale.js';
import { totals } from '../scripts/lib.js';

test('Veneto results page parses sites, both rows, coordinates and time', async () => {
  const html = await readFile(new URL('./fixtures/veneto-page.html', import.meta.url), 'utf8');
  const { total, sites } = parsePage(html);
  assert.equal(total, 7);
  assert.equal(sites.length, 2);

  const cit = sites[0];
  assert.equal(cit.name, 'Pronto Soccorso Cittadella');
  assert.equal(cit.city, 'Cittadella');
  assert.equal(cit.lat, 45.647487);
  assert.equal(cit.updatedAt, '2026-10-20T23:15:04.000Z');
  assert.deepEqual(cit.triage.azzurro, { waiting: 2, inTreatment: 4 }); // GIALLO column
  assert.deepEqual(cit.triage.bianco, { waiting: 1, inTreatment: 0 });
  assert.deepEqual(totals(cit.triage), { waiting: 3, inTreatment: 11 });

  const sa = sites[1];
  assert.equal(sa.name, "Pronto Soccorso Ospedale Sant'Antonio"); // entity + escaped quote both decoded
  assert.equal(sa.city, 'Padova');
  assert.equal(sa.lon, 11.8914708);
});
