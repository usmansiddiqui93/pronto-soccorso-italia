// Sardegna – Regione Sardegna "Monitor Pronto Soccorso" (all 26 emergency units on the island).
// Public page: https://monitorps.sardegnasalute.it/monitorps/
// Data: the page's own refresh call (POST MonitorServlet with xhr=true) returns {lastRefresh, view}, where
// view is HTML with one table per unit: rows "Pazienti in visita", "Pazienti in arrivo da 118",
// "Pazienti in attesa di visita", "Tempo massimo di attesa di visita attuale" (H:MM) for codes 1..5.
// Coordinates come from the official map page (page=mappa), matched by hospital (presidio) name.

import { postForm, toNum, romeToIso, decodeEntities, emptyTriage, totals } from '../lib.js';

const SERVLET = 'https://monitorps.sardegnasalute.it/monitorps/MonitorServlet';
const PAGE = 'https://monitorps.sardegnasalute.it/monitorps/';
const CODE_KEYS = ['rosso', 'arancione', 'azzurro', 'verde', 'bianco'];

export const meta = {
  id: 'sardegna-regione-monitorps',
  region: 'Sardegna',
  label: 'Regione Sardegna – Monitor Pronto Soccorso',
};

const norm = (s) => decodeEntities(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const title = (s) => decodeEntities(s).toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|[\s'(.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

function hmToMin(s) {
  const m = String(s || '').match(/^(\d+):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function parseCoords(mapHtml) {
  const coords = new Map();
  for (const m of mapHtml.matchAll(/latitude:\s*([\d.]+),\s*longitude:\s*([\d.]+),[\s\S]*?<b>([^<]+)<\/b>/g)) {
    coords.set(norm(m[3]), [toNum(m[1]), toNum(m[2])]);
  }
  return coords;
}

export function parseView(json, coords) {
  const ts = String(json?.lastRefresh || '').match(/(\d{1,2}):(\d{2}):(\d{2})\s+del\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const updatedAt = ts ? romeToIso(`${ts[4]}/${ts[5]}/${ts[6]} ${ts[1]}:${ts[2]}:${ts[3]}`) : null;
  const v = String(json?.view || '');
  const heads = [...v.matchAll(/titprimopiano">([^<]+)</g)].map((m) => ({ i: m.index, name: m[1].trim() }));
  const out = [];
  for (const m of v.matchAll(/<span class="titoloparagrafo">([^<]+)<\/span>/g)) {
    const end = v.indexOf('</table>', m.index);
    const block = v.slice(m.index, end > 0 ? end : undefined);
    const presidio = heads.filter((h) => h.i < m.index).pop()?.name;
    const id = (block.match(/id="mappa_(\d+)"/) || [])[1];
    if (!presidio || !id) continue;
    const rows = {};
    for (const r of block.matchAll(/&nbsp;([^<]+?)<\/td>((?:\s*<td[^>]*>[^<]*(?:<!--[^>]*-->)?<\/td>)+)/g)) {
      rows[r[1].trim().toLowerCase()] = [...r[2].matchAll(/<td[^>]*>([^<]*)/g)].map((x) => x[1].trim());
    }
    const pick = (start) => Object.entries(rows).find(([k]) => k.startsWith(start))?.[1] || [];
    const visita = pick('pazienti in visita'), arrivo = pick('pazienti in arrivo'), attesa = pick('pazienti in attesa'), maxw = pick('tempo massimo');
    const triage = emptyTriage();
    CODE_KEYS.forEach((k, j) => {
      triage[k] = { waiting: toNum(attesa[j]), inTreatment: toNum(visita[j]), minutes: hmToMin(maxw[j]) };
    });
    const arriving = arrivo.reduce((s, x) => (toNum(x) == null ? s : (s ?? 0) + toNum(x)), null);
    const addr = decodeEntities((block.match(/Indirizzo: <\/span>([^<]*)</) || [])[1] || '');
    const city = (addr.split(' - ').pop() || '').replace(/\b\d{5}\b/g, '').replace(/\s+[A-Z]{2}\s*$/, '').trim();
    const nota = decodeEntities((block.match(/Nota: <\/span>([^']*)'/) || [])[1] || '').trim();
    const c = coords.get(norm(presidio));
    out.push({ id, presidio, reparto: m[1].trim(), nota, city: city ? title(city) : null, lat: c?.[0] ?? null, lon: c?.[1] ?? null, triage, arriving, updatedAt });
  }
  return out;
}

export async function fetchAll() {
  const coords = parseCoords(await postForm(SERVLET, { page: 'mappa', tipoProntoSoccorso: 'TUTTI' }));
  const json = JSON.parse(await postForm(SERVLET, {
    idMacroArea: 'null', codiceAziendaSanitaria: 'null', idAreaVasta: 'null', idPresidio: 'null',
    idProntoSoccorso: 'null', tipoProntoSoccorso: 'TUTTI', vicini: 'null', xhr: 'true',
  }));
  const units = parseView(json, coords);
  if (!units.length) throw new Error('No units in response (layout changed?)');
  return units.filter((u) => u.lat != null).map((u) => {
    const special = u.nota && !/generale/i.test(u.nota) ? u.nota : null;
    return {
      id: `sar-${u.id}`,
      name: title(u.presidio) + (special ? ` – ${special}` : ''),
      city: u.city,
      region: meta.region,
      lat: u.lat,
      lon: u.lon,
      kind: u.nota || null,
      arriving118: u.arriving,
      source: meta.label,
      sourceUrl: PAGE,
      triage: u.triage,
      ...totals(u.triage),
      minutesLabel: 'Attesa massima attuale',
      updatedAt: u.updatedAt,
    };
  });
}
