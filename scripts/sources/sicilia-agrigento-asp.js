// Agrigento province – ASP Agrigento "Monitoraggio in tempo reale afflusso" (5 hospitals).
// Public page (server-rendered HTML, refreshes every 2 min): https://www.aspag.it/monitoraggio-afflusso-ps/
// This source gives only the number of patients PRESENT per code (waiting and being seen are not
// separated), with columns Rosso, Arancione, Giallo, Verde, Azzurro, Bianco and a total.
// "Giallo" is the old 4-colour code; it is added to Arancione (closest equivalent).

import { getText, toNum, normaliseColour, emptyTriage, romeToIso } from '../lib.js';

export const PAGE = 'https://www.aspag.it/monitoraggio-afflusso-ps/';

// Matched against the hospital name on the page. Coordinates from OpenStreetMap.
const HOSPITALS = [
  { match: 'agrigento', name: 'Ospedale San Giovanni di Dio', city: 'Agrigento', lat: 37.3519, lon: 13.6075 },
  { match: 'sciacca', name: 'Ospedale Giovanni Paolo II', city: 'Sciacca', lat: 37.5259, lon: 13.0736 },
  { match: 'licata', name: 'Ospedale San Giacomo d\'Altopasso', city: 'Licata', lat: 37.1071, lon: 13.9251 },
  { match: 'canicatt', name: 'Ospedale Barone Lombardo', city: 'Canicattì', lat: 37.3529, lon: 13.8340 },
  { match: 'ribera', name: 'Ospedale Fratelli Parlapiano', city: 'Ribera', lat: 37.4921, lon: 13.2689 },
];

export const meta = {
  id: 'sicilia-agrigento-asp',
  region: 'Sicilia',
  label: 'ASP Agrigento',
};

export function parse(html) {
  const ts = (html.match(/Ultimo aggiornamento:\s*([0-9/]+\s+[0-9:]+)/i) || [])[1];
  const updatedAt = ts ? romeToIso(ts) : null;
  const firstRow = html.indexOf('class="lap-row"');
  const headerPart = firstRow > 0 ? html.slice(0, firstRow) : html;
  const columns = [...headerPart.matchAll(/class="lap-pill-hd"[^>]*>\s*([^<]+?)\s*</g)].map((m) => normaliseColour(m[1]));
  if (!columns.length) return { updatedAt, hospitals: [] };

  const rows = html.split('class="lap-row"').slice(1);
  const hospitals = rows.map((r) => {
    const name = (r.match(/class="lap-hosp-link"[^>]*>\s*([^<]+?)\s*<\/a>/) || [])[1];
    const vals = [...r.matchAll(/class="lap-badge[^"]*"[^>]*>\s*([^<]*?)\s*<\/div>/g)].map((m) => toNum(m[1]));
    if (!name || vals.length !== columns.length) return null;
    const triage = emptyTriage();
    let present = null;
    columns.forEach((key, j) => {
      if (!key || vals[j] == null) return;
      const prev = triage[key]?.present ?? 0;
      triage[key] = { waiting: null, inTreatment: null, present: prev + vals[j] };
      present = (present ?? 0) + vals[j];
    });
    return { heading: name, triage, present };
  }).filter(Boolean);
  return { updatedAt, hospitals };
}

export async function fetchAll() {
  const { updatedAt, hospitals } = parse(await getText(PAGE));
  if (!hospitals.length) throw new Error('No hospitals found on page (layout changed?)');
  const rows = [];
  for (const p of hospitals) {
    const h = HOSPITALS.find((x) => p.heading.toLowerCase().includes(x.match));
    if (!h) { console.warn(`  ! ASP Agrigento: unknown hospital "${p.heading}" (no coordinates, skipped)`); continue; }
    rows.push({
      id: `ag-${h.match}`,
      name: h.name,
      city: h.city,
      region: meta.region,
      lat: h.lat,
      lon: h.lon,
      source: meta.label,
      sourceUrl: PAGE,
      triage: p.triage,
      waiting: null,
      inTreatment: null,
      present: p.present,
      updatedAt,
    });
  }
  return rows;
}
