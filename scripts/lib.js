// Shared helpers: common record format + HTTP fetching.
//
// Every source adapter returns an array of hospital records shaped like this:
// {
//   id, name, city, region, lat, lon,
//   source,            // short source label, e.g. "AOU Città della Salute (Torino)"
//   sourceUrl,         // public page people can open
//   triage: { rosso, arancione, azzurro, verde, bianco },  // each { waiting, inTreatment } or null
//   waiting, inTreatment,   // totals (numbers, or null if unknown)
//   updatedAt,         // ISO time the source says the data refers to (null if not stated)
// }

export const TRIAGE_KEYS = ['rosso', 'arancione', 'azzurro', 'verde', 'bianco'];

const UA = 'pronto-soccorso-italia/0.1 (+https://github.com/)';

export async function getText(url, { timeoutMs = 20000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function getJson(url, opts) {
  return JSON.parse(await getText(url, opts));
}

export function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '' || s === '-') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Map the colour names used by different sources onto the 5 national codes.
export function normaliseColour(c) {
  const s = String(c || '').toLowerCase().trim();
  if (s.startsWith('ross') || s === 'red' || s === '1') return 'rosso';
  if (s.startsWith('aranc') || s === 'orange' || s === '2') return 'arancione';
  if (s.startsWith('azzur') || s === 'blue' || s === '3') return 'azzurro';
  if (s.startsWith('verd') || s === 'green' || s === '4') return 'verde';
  if (s.startsWith('bianc') || s === 'white' || s === '5') return 'bianco';
  if (s.startsWith('giall') || s === 'yellow') return 'arancione'; // old 4-colour scale: giallo ≈ urgent
  return null;
}

export function emptyTriage() {
  return Object.fromEntries(TRIAGE_KEYS.map((k) => [k, null]));
}

export function totals(triage) {
  let waiting = null;
  let inTreatment = null;
  for (const k of TRIAGE_KEYS) {
    const c = triage[k];
    if (!c) continue;
    if (c.waiting != null) waiting = (waiting ?? 0) + c.waiting;
    if (c.inTreatment != null) inTreatment = (inTreatment ?? 0) + c.inTreatment;
  }
  return { waiting, inTreatment };
}
