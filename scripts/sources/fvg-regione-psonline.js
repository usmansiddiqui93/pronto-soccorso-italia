// Friuli-Venezia Giulia – Regione FVG / Insiel "Pronto soccorso online" (all 17 emergency sites in the region).
// Public page: https://servizionline.sanita.fvg.it/psonline/#/index
// JSON feed used by that page: https://servizionline.sanita.fvg.it/tempiAttesaService/tempiAttesaPs
// Per site: coordinates, and per colour numeroPazientiInAttesa / numeroPazientiInVisita / mediaAttesa ("HH:MM").
// dataAggiornamento is a Unix timestamp in milliseconds.

import { getJson, toNum, normaliseColour, emptyTriage, totals } from '../lib.js';

const FEED = 'https://servizionline.sanita.fvg.it/tempiAttesaService/tempiAttesaPs';
const PAGE = 'https://servizionline.sanita.fvg.it/psonline/#/index';

export const meta = {
  id: 'fvg-regione-psonline',
  region: 'Friuli-Venezia Giulia',
  label: 'Regione FVG – Pronto soccorso online',
};

function hhmmToMin(s) {
  const m = String(s || '').match(/^(\d+):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function shortName(descr) {
  // "Pronto Soccorso Pediatrico Udine" -> "PS Pediatrico Udine"; keep "Punto di Primo Intervento ..." as is.
  return String(descr || '').replace(/^Pronto Soccorso\s+/i, 'PS ').trim();
}

export function parse(data) {
  const updatedAt = toNum(data?.dataAggiornamento) ? new Date(toNum(data.dataAggiornamento)).toISOString() : null;
  const rows = [];
  for (const az of data?.aziende ?? []) {
    for (const ps of az.prontoSoccorsi ?? []) {
      for (const d of ps.dipartimenti ?? []) {
        if (!d?.id) continue;
        const triage = emptyTriage();
        for (const c of d.codiciColore ?? []) {
          const key = normaliseColour(c.descrizione);
          const s = c.situazionePazienti;
          if (!key || !s) continue;
          triage[key] = {
            waiting: toNum(s.numeroPazientiInAttesa),
            inTreatment: toNum(s.numeroPazientiInVisita),
            minutes: hhmmToMin(s.mediaAttesa),
          };
        }
        const isPPI = /primo intervento/i.test(d.descrizione);
        const isPed = /pediatric/i.test(d.descrizione);
        rows.push({
          id: `fvg-${d.id}`,
          name: shortName(d.descrizione),
          city: d.comune,
          region: meta.region,
          lat: toNum(d.latitudine),
          lon: toNum(d.longitudine),
          kind: isPPI ? 'Punto di primo intervento' : isPed ? 'Pronto soccorso pediatrico' : null,
          note: d.info ? String(d.info).replace(/\s+/g, ' ').trim() : null,
          source: meta.label,
          sourceUrl: PAGE,
          triage,
          ...totals(triage),
          minutesLabel: 'Attesa media (min)',
          updatedAt,
        });
      }
    }
  }
  return rows;
}

export async function fetchAll() {
  const rows = parse(await getJson(`${FEED}?datetime=${Date.now()}`));
  if (!rows.length) throw new Error('Empty feed');
  return rows;
}
