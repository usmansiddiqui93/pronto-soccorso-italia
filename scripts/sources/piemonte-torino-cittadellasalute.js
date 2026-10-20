// Torino – AOU Città della Salute e della Scienza (4 hospitals).
// Public page: https://www.cittadellasalute.to.it/index.php?option=com_content&view=article&id=6786
// Each hospital panel (listeps.cittadellasalute.to.it/?id=...) loads JSON from gtotal.php?id=...
// Response: {"colors":[{"colore":"rosso","attesa":"0","visita":"4"}, ...]}
// Note: the feed also returns an entry with colore=null; the official panel does not show it,
// so it is ignored here (meaning not documented by the source).

import { getJson, toNum, normaliseColour, emptyTriage, totals } from '../lib.js';

const BASE = 'https://listeps.cittadellasalute.to.it';

// Coordinates from OpenStreetMap (hospital points / street addresses).
const HOSPITALS = [
  { code: '01090101', name: 'Ospedale Molinette', lat: 45.0395, lon: 7.6744 },
  { code: '01090201', name: 'CTO', lat: 45.0334, lon: 7.6745 },
  { code: '01090301', name: "Ospedale Sant'Anna (ostetrico-ginecologico)", lat: 45.0361, lon: 7.6740 },
  { code: '01090302', name: 'Ospedale Infantile Regina Margherita (pediatrico)', lat: 45.0347, lon: 7.6749 },
];

export const meta = {
  id: 'piemonte-torino-cittadellasalute',
  region: 'Piemonte',
  label: 'AOU Città della Salute e della Scienza di Torino',
};

export function parse(json) {
  // The feed only lists codes that have patients, so a missing code means zero.
  const triage = Object.fromEntries(Object.keys(emptyTriage()).map((k) => [k, { waiting: 0, inTreatment: 0 }]));
  for (const row of json?.colors ?? []) {
    const key = normaliseColour(row.colore);
    if (!key) continue;
    triage[key] = { waiting: toNum(row.attesa), inTreatment: toNum(row.visita) };
  }
  return triage;
}

export async function fetchAll() {
  return Promise.all(
    HOSPITALS.map(async (h) => {
      const triage = parse(await getJson(`${BASE}/gtotal.php?id=${h.code}`));
      return {
        id: `to-cds-${h.code}`,
        name: h.name,
        city: 'Torino',
        region: meta.region,
        lat: h.lat,
        lon: h.lon,
        source: meta.label,
        sourceUrl: `${BASE}/?id=${h.code}`,
        triage,
        ...totals(triage),
        updatedAt: null, // the feed has no timestamp; fetch time is used instead
      };
    }),
  );
}
