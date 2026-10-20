import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/piemonte-torino-cittadellasalute.js';
import { totals } from '../scripts/lib.js';

test('Torino feed parses into the common triage format', async () => {
  const json = JSON.parse(await readFile(new URL('./fixtures/torino-gtotal.json', import.meta.url)));
  const t = parse(json);
  assert.deepEqual(t.rosso, { waiting: 0, inTreatment: 4 });
  assert.deepEqual(t.arancione, { waiting: 0, inTreatment: 15 });
  assert.deepEqual(t.azzurro, { waiting: 2, inTreatment: 27 });
  assert.deepEqual(t.verde, { waiting: 9, inTreatment: 10 });
  assert.deepEqual(t.bianco, { waiting: 0, inTreatment: 0 });
  assert.deepEqual(totals(t), { waiting: 11, inTreatment: 56 });
});
