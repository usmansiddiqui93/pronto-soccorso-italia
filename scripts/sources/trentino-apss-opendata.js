// Trentino – APSS / ASUIT, open data "Visualizzazione presenze nei Pronto Soccorso" (licence CC BY 4.0).
// Dataset: https://dati.trentino.it/dataset/visualizzazione-presenze-nei-pronto-soccorso
// Feed:    https://servizi.apss.tn.it/opendata/STATOPS001.json
// Per unit: attesa (waiting), ambulatorio (being seen), osservazione (in observation), each by colour,
// and timestamp "YYYYMMDD HHMMSS" (Rome local time). The "attesa-media" values are fixed targets, not
// real waits, so they are not used.

import { getJson, toNum, normaliseColour, emptyTriage, totals, romeToIso } from '../lib.js';

const FEED = 'https://servizi.apss.tn.it/opendata/STATOPS001.json';
const DATASET = 'https://dati.trentino.it/dataset/visualizzazione-presenze-nei-pronto-soccorso';

// Unit code prefix = hospital. Coordinates from OpenStreetMap.
const SITES = {
  '001': { hospital: 'Ospedale Santa Chiara', city: 'Trento', lat: 46.0563, lon: 11.1333 },
  '004': { hospital: 'Ospedale San Lorenzo', city: 'Borgo Valsugana', lat: 46.0570, lon: 11.4638 },
  '005': { hospital: 'Ospedale Valli del Noce', city: 'Cles', lat: 46.3609, lon: 11.0327 },
  '006': { hospital: 'Ospedale Santa Maria del Carmine', city: 'Rovereto', lat: 45.8821, lon: 11.0416 },
  '007': { hospital: 'Ospedale di Tione', city: 'Tione di Trento', lat: 46.0435, lon: 10.7249 },
  '010': { hospital: 'Ospedale di Arco', city: 'Arco', lat: 45.9195, lon: 10.8749 },
  '014': { hospital: 'Ospedale di Fiemme', city: 'Cavalese', lat: 46.2884, lon: 11.4553 },
};
// Specialist units at Santa Chiara (code suffix).
const UNIT = { PS: null, PSP: 'Pediatrico', PSO: 'Chirurgico-Traumatologico', PSG: 'Ginecologico', PSC: 'Oculistico' };

export const meta = {
  id: 'trentino-apss-opendata',
  region: 'Trentino-Alto Adige',
  label: 'APSS Trento – open data (CC BY 4.0)',
};

function byColour(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = normaliseColour(k);
    if (key) out[key] = toNum(v);
  }
  return out;
}

// "20261021 003504" -> ISO UTC
function tsToIso(s) {
  const m = String(s || '').match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})/);
  return m ? romeToIso(`${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}`) : null;
}

export function parse(list) {
  const rows = [];
  for (const item of Array.isArray(list) ? list : []) {
    const r = item?.risposta;
    const rep = r?.pronto_soccorso?.reparto;
    if (!r || r.tipo !== 'OK' || !rep?.codice) continue;
    const [prefix, , suffix] = rep.codice.split('-');
    const site = SITES[prefix];
    if (!site) { console.warn(`  ! Trentino: unknown unit ${rep.codice} "${rep.descrizione}" (no coordinates, skipped)`); continue; }
    const att = byColour(rep.attesa), amb = byColour(rep.ambulatorio), oss = byColour(rep.osservazione);
    const triage = emptyTriage();
    for (const k of Object.keys(triage)) triage[k] = { waiting: att[k] ?? null, inTreatment: amb[k] ?? null };
    const obs = Object.values(oss).reduce((s, v) => (v == null ? s : (s ?? 0) + v), null);
    const unit = UNIT[suffix] ?? null;
    rows.push({
      id: `tn-${rep.codice}`,
      name: unit ? `${site.hospital} – PS ${unit}` : site.hospital,
      city: site.city,
      region: meta.region,
      lat: site.lat,
      lon: site.lon,
      kind: unit ? `Pronto soccorso ${unit.toLowerCase()}` : 'Pronto soccorso generale',
      observation: obs,
      source: meta.label,
      sourceUrl: DATASET,
      triage,
      ...totals(triage),
      updatedAt: tsToIso(r.timestamp),
    });
  }
  return rows;
}

export async function fetchAll() {
  const rows = parse(await getJson(FEED));
  if (!rows.length) throw new Error('Empty feed');
  return rows;
}
