import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/sicilia-trapani-asp.js';
import { totals } from '../scripts/lib.js';

test('ASP Trapani dashboard parses panels, rows and timestamp', async () => {
  const html = await readFile(new URL('./fixtures/trapani.html', import.meta.url), 'utf8');
  const { updatedAt, hospitals } = parse(html);
  assert.equal(updatedAt, '2026-10-20T22:47:00.000Z');
  assert.equal(hospitals.length, 1);
  assert.equal(hospitals[0].heading, 'PRONTO SOCCORSO - ALCAMO');
  assert.deepEqual(hospitals[0].triage.arancione, { waiting: 0, inTreatment: 4 });
  assert.deepEqual(hospitals[0].triage.bianco, { waiting: 0, inTreatment: 0 });
  assert.deepEqual(totals(hospitals[0].triage), { waiting: 0, inTreatment: 9 });
});
