// Runs every source adapter and writes docs/data/latest.json.
// If a source fails, the previous data for that source is kept and marked stale,
// so one broken site never empties the map.

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'docs', 'data');
const outFile = path.join(outDir, 'latest.json');

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(outFile, 'utf8'));
  } catch {
    return { hospitals: [], sources: [] };
  }
}

async function main() {
  const prev = await loadPrevious();
  const files = (await readdir(path.join(here, 'sources'))).filter((f) => f.endsWith('.js')).sort();
  const now = new Date().toISOString();
  const hospitals = [];
  const sources = [];

  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(here, 'sources', f)).href);
    const { meta } = mod;
    try {
      const rows = await mod.fetchAll();
      for (const r of rows) hospitals.push({ ...r, sourceId: meta.id, fetchedAt: now, stale: false });
      sources.push({ ...meta, ok: true, count: rows.length, lastSuccess: now, error: null });
      console.log(`✓ ${meta.id}: ${rows.length} hospitals`);
    } catch (err) {
      const old = prev.hospitals.filter((h) => h.sourceId === meta.id);
      for (const r of old) hospitals.push({ ...r, stale: true });
      const prevSrc = prev.sources.find((s) => s.id === meta.id);
      sources.push({ ...meta, ok: false, count: old.length, lastSuccess: prevSrc?.lastSuccess ?? null, error: String(err.message || err) });
      console.error(`✗ ${meta.id}: ${err.message || err}`);
    }
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, JSON.stringify({ generatedAt: now, hospitals, sources }, null, 1) + '\n');
  console.log(`Wrote ${hospitals.length} hospitals from ${sources.length} sources.`);
  // Fail the run only if every source failed.
  if (sources.length && sources.every((s) => !s.ok)) process.exit(1);
}

main();
