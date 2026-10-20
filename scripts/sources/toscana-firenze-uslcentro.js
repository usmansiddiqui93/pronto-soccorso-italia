// Firenze, Prato, Pistoia, Empoli – Azienda USL Toscana Centro (9 hospitals).
// Public page (server-rendered HTML): https://www.uslcentro.toscana.it/psstat/pronto-soccorso-pa.php
// For each hospital the page has a heading, then a "Pazienti in visita" row and a
// "Pazienti in attesa" row with five numbers each (codes 1–5).
// Not covered by this source: AOU Careggi and AOU Meyer (separate hospital trusts).

import { getText, toNum, romeToIso, emptyTriage, totals } from '../lib.js';

export const PAGE = 'https://www.uslcentro.toscana.it/psstat/pronto-soccorso-pa.php';
const CODE_KEYS = ['rosso', 'arancione', 'azzurro', 'verde', 'bianco']; // codes 1..5

// Matched against the hospital heading on the page (case-insensitive substring).
// Coordinates from OpenStreetMap.
const HOSPITALS = [
  { match: 'san jacopo', name: 'Ospedale San Jacopo', city: 'Pistoia', lat: 43.9181, lon: 10.9041 },
  { match: 'pacini', name: 'Ospedale Lorenzo Pacini', city: 'San Marcello Piteglio', lat: 44.0560, lon: 10.7885 },
  { match: 'pescia', name: 'Ospedale SS. Cosma e Damiano', city: 'Pescia', lat: 43.9033, lon: 10.6904 },
  { match: 'prato', name: 'Ospedale Santo Stefano', city: 'Prato', lat: 43.8904, lon: 11.0638 },
  { match: 'borgo s', name: 'Ospedale del Mugello', city: 'Borgo San Lorenzo', lat: 43.9582, lon: 11.3752 },
  { match: 'annunziata', name: 'Ospedale Santa Maria Annunziata', city: 'Bagno a Ripoli', lat: 43.7314, lon: 11.3061 },
  { match: 'maria nuova', name: 'Ospedale Santa Maria Nuova', city: 'Firenze', lat: 43.7736, lon: 11.2603 },
  { match: 'torregalli', name: 'Ospedale San Giovanni di Dio (Torregalli)', city: 'Firenze', lat: 43.7582, lon: 11.2040 },
  { match: 'empoli', name: 'Ospedale San Giuseppe', city: 'Empoli', lat: 43.7225, lon: 10.9335 },
];

export const meta = {
  id: 'toscana-firenze-uslcentro',
  region: 'Toscana',
  label: 'Azienda USL Toscana Centro',
};

export function parse(html) {
  const updatedAt = romeToIso((html.match(/Dati aggiornati il\s*([^<]+)/i) || [])[1]);
  // Hospital headings are <h4> inside a left-aligned <th>; numbers are <h4> elsewhere.
  const headingRe = /text-align:\s*left;[^>]*>\s*<h4>([^<]+)<\/h4>/gi;
  const heads = [...html.matchAll(headingRe)];
  const out = [];
  heads.forEach((h, i) => {
    const block = html.slice(h.index + h[0].length, i + 1 < heads.length ? heads[i + 1].index : undefined);
    const nums = [...block.matchAll(/<h4>\s*(\d+)/g)].map((m) => toNum(m[1]));
    if (nums.length < 10) return; // unexpected layout – skip rather than guess
    const triage = emptyTriage();
    CODE_KEYS.forEach((k, j) => { triage[k] = { inTreatment: nums[j], waiting: nums[5 + j] }; });
    out.push({ heading: h[1].trim(), triage });
  });
  return { updatedAt, hospitals: out };
}

export async function fetchAll() {
  const { updatedAt, hospitals } = parse(await getText(PAGE));
  if (!hospitals.length) throw new Error('No hospitals found on page (layout changed?)');
  const rows = [];
  for (const p of hospitals) {
    const h = HOSPITALS.find((x) => p.heading.toLowerCase().includes(x.match));
    if (!h) { console.warn(`  ! Toscana Centro: unknown hospital "${p.heading}" (no coordinates, skipped)`); continue; }
    rows.push({
      id: `tc-${h.match.replace(/\W+/g, '-')}`,
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
