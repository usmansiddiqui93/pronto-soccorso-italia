// Palermo province – ASP 6 Palermo (5 hospitals: Ingrassia, Partinico, Corleone, Petralia Sottana, Termini Imerese).
// Public page (server-rendered HTML): https://www.asppalermo.org/attese_ps/index_mod2.php
// Per hospital: heading, "Aggiornato al: DD/MM/YY - H:MM:SS", overcrowding index (%), and rows
// Attesa / Trattam. / Osservaz. with five cells each (Rosso, Arancione, Azzurro, Verde, Bianco).
// Not covered by this source: ARNAS Civico, Villa Sofia-Cervello, Policlinico (separate trusts).

import { getText, toNum, emptyTriage, totals, romeToIso } from '../lib.js';

export const PAGE = 'https://www.asppalermo.org/attese_ps/index_mod2.php';
const CODE_KEYS = ['rosso', 'arancione', 'azzurro', 'verde', 'bianco'];

// Matched against the hospital heading (case-insensitive substring). Coordinates from OpenStreetMap.
const HOSPITALS = [
  { match: 'ingrassia', name: 'Ospedale G. F. Ingrassia', city: 'Palermo', lat: 38.0930, lon: 13.3108 },
  { match: 'partinico', name: 'Ospedale Civico di Partinico', city: 'Partinico', lat: 38.0375, lon: 13.1154 },
  { match: 'corleone', name: 'Ospedale dei Bianchi', city: 'Corleone', lat: 37.8167, lon: 13.2988 },
  { match: 'petralia', name: "Ospedale Madonna SS. dell'Alto", city: 'Petralia Sottana', lat: 37.8189, lon: 14.0910 },
  { match: 'termini', name: 'Ospedale S. Cimino', city: 'Termini Imerese', lat: 37.9833, lon: 13.6860 },
];

export const meta = {
  id: 'sicilia-palermo-asp',
  region: 'Sicilia',
  label: 'ASP 6 Palermo',
};

function row(block, label) {
  const m = block.match(new RegExp('<th[^>]*>\\s*' + label + '[^<]*<\\/th>((?:\\s*<td[^>]*>[^<]*<\\/td>){5})', 'i'));
  return m ? [...m[1].matchAll(/<td[^>]*>\s*([^<]*?)\s*<\/td>/g)].map((x) => toNum(x[1])) : null;
}

export function parse(html) {
  const heads = [...html.matchAll(/nome-presidio"[^>]*>([^<]+)<\/h5>/gi)];
  return heads.map((h, i) => {
    const block = html.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : undefined);
    const ts = (block.match(/Aggiornato al:\s*<span[^>]*>\s*([^<]+)</i) || [])[1];
    const idx = (block.match(/Sovraffollamento:\s*<span[^>]*>\s*([\d.,]+)/i) || [])[1];
    const att = row(block, 'Attesa'), tra = row(block, 'Trattam'), oss = row(block, 'Osservaz');
    if (!att || !tra) return null; // unexpected layout – skip rather than guess
    const triage = emptyTriage();
    CODE_KEYS.forEach((k, j) => { triage[k] = { waiting: att[j], inTreatment: tra[j] }; });
    return {
      heading: h[1].trim(),
      triage,
      observation: oss ? oss.reduce((s, v) => (v == null ? s : (s ?? 0) + v), null) : null,
      crowdingPct: idx != null && toNum(idx) != null ? Math.round(toNum(idx)) : null,
      updatedAt: ts ? romeToIso(ts.replace(/\s+-\s+/, ' ')) : null,
    };
  }).filter(Boolean);
}

export async function fetchAll() {
  const parsed = parse(await getText(PAGE));
  if (!parsed.length) throw new Error('No hospitals found on page (layout changed?)');
  const rows = [];
  for (const p of parsed) {
    const h = HOSPITALS.find((x) => p.heading.toLowerCase().includes(x.match));
    if (!h) { console.warn(`  ! ASP Palermo: unknown hospital "${p.heading}" (no coordinates, skipped)`); continue; }
    rows.push({
      id: `pa-${h.match}`,
      name: h.name,
      city: h.city,
      region: meta.region,
      lat: h.lat,
      lon: h.lon,
      source: meta.label,
      sourceUrl: PAGE,
      triage: p.triage,
      ...totals(p.triage),
      observation: p.observation,
      crowdingPct: p.crowdingPct,
      updatedAt: p.updatedAt,
    });
  }
  return rows;
}
