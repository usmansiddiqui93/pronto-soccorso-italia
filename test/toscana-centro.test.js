import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '../scripts/sources/toscana-firenze-uslcentro.js';
import { romeToIso, totals } from '../scripts/lib.js';

test('Toscana Centro page parses hospitals, codes and timestamp', async () => {
  const html = await readFile(new URL('./fixtures/toscana-centro.html', import.meta.url), 'utf8');
  const { updatedAt, hospitals } = parse(html);
  assert.equal(updatedAt, '2026-10-20T22:25:01.000Z'); // 00:25:01 Rome summer time = 22:25:01 UTC
  assert.equal(hospitals.length, 2);
  assert.equal(hospitals[0].heading, 'Ospedale San Jacopo (PT)');
  const prato = hospitals[1].triage;
  assert.deepEqual(prato.rosso, { inTreatment: 2, waiting: 0 });
  assert.deepEqual(prato.azzurro, { inTreatment: 75, waiting: 6 });
  assert.deepEqual(prato.verde, { inTreatment: 6, waiting: 2 });
  assert.deepEqual(totals(prato), { waiting: 8, inTreatment: 111 });
});

test('romeToIso handles winter time', () => {
  assert.equal(romeToIso('15/01/2026 10:00'), '2026-01-15T09:00:00.000Z');
});
