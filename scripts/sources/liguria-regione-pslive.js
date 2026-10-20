// Liguria – Regione Liguria "PS Live" (all 18 emergency sites in the region:
// PS, DEA, first-aid points and low-complexity clinics; ASL1–5, San Martino, Galliera, Gaslini, Evangelico).
// Public page: https://pslive.regione.liguria.it/
// JSON feed used by that page: https://pslive.regione.liguria.it/api/prontosoccorso/all
// Per site: numAtt* (waiting) and numTra* (being treated) for Ros/Ara/Azz/Ver/Bia,
// indGda (crowding index, %), dataRil (Rome local time of the reading), coordinates, opening hours.

import { getJson, toNum, emptyTriage, totals, romeToIso } from '../lib.js';

const FEED = 'https://pslive.regione.liguria.it/api/prontosoccorso/all';
const SUFFIX = { rosso: 'Ros', arancione: 'Ara', azzurro: 'Azz', verde: 'Ver', bianco: 'Bia' };

export const meta = {
  id: 'liguria-regione-pslive',
  region: 'Liguria',
  label: 'Regione Liguria – PS Live',
};

// "2026-10-21T00:35:00" (Rome local time, no zone) -> ISO UTC
function rilToIso(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? romeToIso(`${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6] || '00'}`) : null;
}

export function parse(list) {
  return (Array.isArray(list) ? list : []).filter((x) => x && x.codOsp).map((x) => {
    const a = x.prontoSoccorsoAffollamento;
    let triage = emptyTriage();
    if (a) {
      for (const [k, s] of Object.entries(SUFFIX)) triage[k] = { waiting: toNum(a['numAtt' + s]), inTreatment: toNum(a['numTra' + s]) };
    }
    const kind = [x.classificazione, x.dettaglioClassificazione].filter(Boolean).join(' · ');
    return {
      id: `lig-${x.codOsp}`,
      name: x.breveOsp || x.descOsp,
      city: x.comune,
      region: meta.region,
      lat: toNum(x.latitudine),
      lon: toNum(x.longitudine),
      kind: kind || null,
      hours: x.open && x.close && !(x.open === '00:00' && x.close === '23:59') ? `${x.open}–${x.close}` : null,
      closed: !!x.nowClosed,
      crowdingPct: a ? toNum(a.indGda) : null,
      source: meta.label,
      sourceUrl: `https://pslive.regione.liguria.it/dettaglio/${x.codOsp}`,
      triage,
      ...totals(triage),
      updatedAt: a ? rilToIso(a.dataRil) : null,
    };
  });
}

export async function fetchAll() {
  const rows = parse(await getJson(FEED));
  if (!rows.length) throw new Error('Empty feed');
  return rows;
}
