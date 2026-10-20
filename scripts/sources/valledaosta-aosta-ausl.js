// Valle d'Aosta – Azienda USL della Valle d'Aosta (the region's only emergency department: Ospedale Parini, Aosta).
// Public page: homepage box "Il Pronto Soccorso in tempo reale" at https://www.ausl.vda.it/
// Server-rendered table .ps-table with rows Rosso/Arancione/Azzurro/Verde/Bianco and columns
// "In attesa" / "In visita", plus "Senza colore: N" (not yet triaged). No timestamp is published.

import { getText, toNum, normaliseColour, emptyTriage, totals } from '../lib.js';

export const PAGE = 'https://www.ausl.vda.it/';

export const meta = {
  id: 'valledaosta-aosta-ausl',
  region: "Valle d'Aosta",
  label: "Azienda USL Valle d'Aosta",
};

export function parse(html) {
  const start = html.search(/class="[^"]*ps-table/);
  if (start < 0) return null;
  const end = html.indexOf('</table>', start);
  const table = html.slice(start, end > 0 ? end : undefined);
  const triage = emptyTriage();
  let found = 0;
  for (const m of table.matchAll(/<tr[^>]*>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([^<]*?)\s*<\/td>\s*<td>\s*([^<]*?)\s*<\/td>/g)) {
    const key = normaliseColour(m[1]);
    if (!key) continue;
    triage[key] = { waiting: toNum(m[2]), inTreatment: toNum(m[3]) };
    found++;
  }
  if (!found) return null;
  const untriaged = toNum((html.slice(start).match(/Senza colore:\s*(\d+)/i) || [])[1]);
  return { triage, untriaged };
}

export async function fetchAll() {
  const p = parse(await getText(PAGE));
  if (!p) throw new Error('Emergency room table not found on homepage (layout changed?)');
  const t = totals(p.triage);
  return [{
    id: 'vda-parini',
    name: 'Ospedale Umberto Parini',
    city: 'Aosta',
    region: meta.region,
    lat: 45.7404,
    lon: 7.3138,
    source: meta.label,
    sourceUrl: PAGE,
    triage: p.triage,
    // Patients not yet triaged are waiting too.
    waiting: t.waiting == null ? null : t.waiting + (p.untriaged || 0),
    inTreatment: t.inTreatment,
    untriaged: p.untriaged,
    updatedAt: null, // not published; fetch time is shown instead
  }];
}
