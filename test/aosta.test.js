import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/valledaosta-aosta-ausl.js';
import { totals } from '../scripts/lib.js';

test('AUSL Valle d\'Aosta homepage box parses codes and untriaged patients', async () => {
  const html = await readFile(new URL('./fixtures/aosta.html', import.meta.url), 'utf8');
  const p = parse(html);
  assert.deepEqual(p.triage.verde, { waiting: 2, inTreatment: 7 });
  assert.deepEqual(p.triage.arancione, { waiting: 0, inTreatment: 2 });
  assert.deepEqual(totals(p.triage), { waiting: 2, inTreatment: 16 });
  assert.equal(p.untriaged, 1); // fixture value; total on page = 2 + 16 + 1 = 19
  assert.equal(parse('<html>no table</html>'), null);
});
