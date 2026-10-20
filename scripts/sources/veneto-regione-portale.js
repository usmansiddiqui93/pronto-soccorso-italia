// Veneto – Regione del Veneto, Portale Sanità "Situazione nei Pronto Soccorso" (about 55 sites).
// Public page: https://salute.regione.veneto.it/servizi/situazione-nei-pronto-soccorso
// The page is a search form: results are returned for one province at a time (POST), 5 per page
// (&page=N). Each result has the site name, address, "Ultimo aggiornamento" (Rome local time) and two
// rows of numbers: "in attesa" and "in visita" for ROSSO / ARANCIONE / GIALLO / VERDE / BIANCO.
// Coordinates come from the map data embedded in the same response.
// Veneto's five codes use GIALLO for the middle level (urgenza differibile), shown here as azzurro.

import { postForm, toNum, romeToIso, decodeEntities, emptyTriage, totals } from '../lib.js';

const PAGE = 'https://salute.regione.veneto.it/servizi/situazione-nei-pronto-soccorso';
const ACTION = PAGE + '?p_p_id=PRONTOSOCCORSO_WAR_portalprontosoccorso_INSTANCE_o0QZ&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_count=1';
const PROVINCES = ['BL', 'PD', 'RO', 'TV', 'VE', 'VR', 'VI'];
const COLS = [['psRosso', 'rosso'], ['psArancione', 'arancione'], ['psGiallo', 'azzurro'], ['psVerde', 'verde'], ['psBianco', 'bianco']];
const PER_PAGE = 5;

export const meta = {
  id: 'veneto-regione-portale',
  region: 'Veneto',
  label: 'Regione del Veneto – Portale Sanità',
};

function cell(row, cls) {
  return [...row.matchAll(new RegExp('class="' + cls + '">\\s*([^<]*?)\\s*<', 'g'))].map((m) => toNum(m[1]));
}

// Parse one results page. Returns { total, sites: [...] }.
export function parsePage(html) {
  const total = toNum((html.match(/(\d+)\s*elementi trovati/) || [])[1]) ?? 0;
  const cj = (html.match(/parseJSON\('(\[.*?\])'\)/) || [])[1];
  let coords = [];
  try { coords = cj ? JSON.parse(cj.replace(/\\'/g, "'")) : []; } catch { coords = []; }
  const coordByTitle = new Map(coords.map((c) => [decodeEntities(c.title), c]));

  const sites = html.split(/<tr class="(?:pari|dispari)">/).slice(1).map((row) => {
    const get = (cls) => decodeEntities((row.match(new RegExp('class="' + cls + '">([^<]*)<')) || [])[1] || '').trim();
    const name = get('psNomePs');
    if (!name) return null;
    const triage = emptyTriage();
    for (const [cls, key] of COLS) {
      const [waiting, inTreatment] = cell(row, cls); // first row "in attesa", second row "in visita"
      triage[key] = { waiting: waiting ?? null, inTreatment: inTreatment ?? null };
    }
    const addr = get('psIndirizzo');
    const parts = addr.split(',').map((s) => s.trim());
    const city = parts.length >= 3 ? parts[parts.length - 3] : null;
    const ts = get('psUltimoAggiornamento').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    const c = coordByTitle.get(name);
    return {
      name,
      ulss: get('psUlss'),
      city,
      lat: c ? toNum(c.lat) : null,
      lon: c ? toNum(c.lng) : null,
      triage,
      updatedAt: ts ? romeToIso(`${ts[3]}/${ts[2]}/${ts[1]} ${ts[4]}:${ts[5]}:${ts[6]}`) : null,
    };
  }).filter(Boolean);
  return { total, sites };
}

function displayName(name) {
  return name.replace(/^Pronto Soccorso\s+/i, 'PS ').replace(/^Punto Primo Intervento\s+/i, 'Punto di primo intervento ').trim();
}

export async function fetchAll() {
  const rows = [];
  const seen = new Set();
  for (const prov of PROVINCES) {
    const fields = { ulss: '', provincia: prov, nomePs: '', rossoInAttesa: '', arancioneInAttesa: '', gialloInAttesa: '', verdeInAttesa: '', biancoInAttesa: '' };
    for (let page = 1; page <= 10; page++) {
      const { total, sites } = parsePage(await postForm(ACTION + (page > 1 ? `&page=${page}` : ''), fields));
      for (const s of sites) {
        if (seen.has(s.name) || s.lat == null) continue;
        seen.add(s.name);
        rows.push({
          id: 'ven-' + s.name.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, ''),
          name: displayName(s.name),
          city: s.city,
          region: meta.region,
          lat: s.lat,
          lon: s.lon,
          kind: /primo intervento/i.test(s.name) ? 'Punto di primo intervento' : /pediatric/i.test(s.name) ? 'Pronto soccorso pediatrico' : null,
          source: meta.label,
          sourceUrl: PAGE,
          triage: s.triage,
          ...totals(s.triage),
          updatedAt: s.updatedAt,
        });
      }
      if (page * PER_PAGE >= total || !sites.length) break;
    }
  }
  if (!rows.length) throw new Error('No sites found (form or layout changed?)');
  return rows;
}
