// Varese area – ASST Valle Olona (Busto Arsizio, Gallarate incl. paediatric PS, Saronno).
// Public page (server-rendered HTML, auto-refresh 5 min): https://www.asst-valleolona.it/tempi_ps.php
// One row per unit and colour: "Trattamento/Attesa (min.)" and "Numero pazienti".
// The source does not say whether patients are waiting or being seen, so counts are shown as
// "present"; codes not listed for a unit have no patients. Minutes are kept as published.

import { getText, toNum, normaliseColour, emptyTriage, romeToIso } from '../lib.js';

export const PAGE = 'https://www.asst-valleolona.it/tempi_ps.php';
const INFO = 'https://www.asst-valleolona.it/tempi-dattesa-in-pronto-soccorso/';

// Matched against the unit name (case-insensitive substring); first match wins. Coordinates from OpenStreetMap.
const UNITS = [
  { match: 'pediatrico - gallarate', key: 'gallarate-ped', name: "Ospedale Sant'Antonio Abate – PS Pediatrico", city: 'Gallarate', lat: 45.6563, lon: 8.7923, kind: 'Pronto soccorso pediatrico' },
  { match: 'gallarate', key: 'gallarate', name: "Ospedale Sant'Antonio Abate", city: 'Gallarate', lat: 45.6563, lon: 8.7923 },
  { match: 'saronno', key: 'saronno', name: 'Ospedale di Saronno', city: 'Saronno', lat: 45.6301, lon: 9.0398 },
  { match: 'busto', key: 'busto', name: 'Ospedale di Circolo', city: 'Busto Arsizio', lat: 45.6219, lon: 8.8470 },
];

export const meta = {
  id: 'lombardia-varese-valleolona',
  region: 'Lombardia',
  label: 'ASST Valle Olona',
};

export function parse(html) {
  const ts = (html.match(/Ultimo aggiornamento:\s*(?:<[^>]+>\s*)*([0-9/]+\s+[0-9:]+)/i) || [])[1];
  const updatedAt = ts ? romeToIso(ts) : null;
  const units = new Map();
  const rowRe = /<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*<strong>\s*([A-Za-zÀ-ú]+)\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>/g;
  for (const m of html.matchAll(rowRe)) {
    const key = normaliseColour(m[2]);
    if (!key) continue;
    const unit = m[1].trim();
    if (!units.has(unit)) units.set(unit, {});
    units.get(unit)[key] = { minutes: toNum(m[3]), present: toNum(m[4]) };
  }
  const out = [];
  for (const [unit, codes] of units) {
    const triage = emptyTriage();
    let present = 0;
    for (const k of Object.keys(triage)) {
      const c = codes[k];
      triage[k] = { waiting: null, inTreatment: null, present: c?.present ?? 0, minutes: c?.minutes ?? null };
      present += c?.present ?? 0;
    }
    out.push({ heading: unit, triage, present });
  }
  return { updatedAt, units: out };
}

export async function fetchAll() {
  const { updatedAt, units } = parse(await getText(PAGE));
  if (!units.length) throw new Error('No units found on page (layout changed?)');
  const rows = [];
  for (const p of units) {
    const u = UNITS.find((x) => p.heading.toLowerCase().includes(x.match));
    if (!u) { console.warn(`  ! ASST Valle Olona: unknown unit "${p.heading}" (no coordinates, skipped)`); continue; }
    rows.push({
      id: `vo-${u.key}`,
      name: u.name,
      city: u.city,
      region: meta.region,
      lat: u.lat,
      lon: u.lon,
      kind: u.kind || null,
      source: meta.label,
      sourceUrl: INFO,
      triage: p.triage,
      waiting: null,
      inTreatment: null,
      present: p.present,
      minutesLabel: 'Trattamento/attesa (min)',
      updatedAt,
    });
  }
  return rows;
}
