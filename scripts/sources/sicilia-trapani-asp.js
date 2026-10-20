// Trapani province – ASP Trapani "PS - Dashboard Attese e Trattamenti" (6 hospitals).
// Public page (server-rendered PrimeFaces HTML): https://monitor.asptrapani.it/
// Per hospital: a panel titled "PRONTO SOCCORSO - <PLACE>" with rows Rosso/Arancione/Azzurro/Verde/Bianco
// and columns "In attesa" / "In visita". One timestamp for the page: "Data ultimo aggiornamento: DD/MM/YYYY HH:MM".

import { getText, toNum, normaliseColour, emptyTriage, totals, romeToIso } from '../lib.js';

export const PAGE = 'https://monitor.asptrapani.it/';

// Matched against the panel title. Coordinates from OpenStreetMap.
const HOSPITALS = [
  { match: 'alcamo', name: 'Ospedale San Vito e Santo Spirito', city: 'Alcamo', lat: 37.9823, lon: 12.9606 },
  { match: 'castelvetrano', name: 'Ospedale Vittorio Emanuele II', city: 'Castelvetrano', lat: 37.6743, lon: 12.7965 },
  { match: 'marsala', name: 'Ospedale Paolo Borsellino', city: 'Marsala', lat: 37.7949, lon: 12.4986 },
  { match: 'mazara', name: 'Ospedale Abele Ajello', city: 'Mazara del Vallo', lat: 37.6572, lon: 12.6004 },
  { match: 'pantelleria', name: 'Ospedale Bernardo Nagar', city: 'Pantelleria', lat: 36.8347, lon: 11.9449 },
  { match: 'trapani', name: "Ospedale Sant'Antonio Abate", city: 'Trapani', lat: 38.0280, lon: 12.5499 },
];

export const meta = {
  id: 'sicilia-trapani-asp',
  region: 'Sicilia',
  label: 'ASP Trapani',
};

export function parse(html) {
  const ts = (html.match(/aggiornamento:?[^0-9]{0,80}(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})/i) || [])[1];
  const updatedAt = ts ? romeToIso(ts) : null;
  const heads = [...html.matchAll(/ui-panel-title">\s*(PRONTO SOCCORSO[^<]*)<\/span>/gi)];
  const hospitals = heads.map((h, i) => {
    const block = html.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : undefined);
    const triage = emptyTriage();
    let found = 0;
    for (const m of block.matchAll(/class="col-level">\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>/g)) {
      const key = normaliseColour(m[1]);
      if (!key) continue;
      triage[key] = { waiting: toNum(m[2]), inTreatment: toNum(m[3]) };
      found++;
    }
    return found ? { heading: h[1].trim(), triage } : null;
  }).filter(Boolean);
  return { updatedAt, hospitals };
}

export async function fetchAll() {
  const { updatedAt, hospitals } = parse(await getText(PAGE));
  if (!hospitals.length) throw new Error('No hospitals found on page (layout changed?)');
  const rows = [];
  for (const p of hospitals) {
    const h = HOSPITALS.find((x) => p.heading.toLowerCase().includes(x.match));
    if (!h) { console.warn(`  ! ASP Trapani: unknown hospital "${p.heading}" (no coordinates, skipped)`); continue; }
    rows.push({
      id: `tp-${h.match}`,
      name: h.name,
      city: h.city,
      region: meta.region,
      lat: h.lat,
      lon: h.lon,
      source: meta.label,
      sourceUrl: PAGE,
      triage: p.triage,
      ...totals(p.triage),
      updatedAt,
    });
  }
  return rows;
}
