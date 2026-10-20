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

// POST a form (application/x-www-form-urlencoded) and return the response text.
export async function postForm(url, fields, { timeoutMs = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à').replace(/&ograve;/g, 'ò').replace(/&ugrave;/g, 'ù').replace(/&igrave;/g, 'ì').replace(/&eacute;/g, 'é')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&nbsp;/g, ' ');
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

// Convert an Italian local date/time (Europe/Rome) to an ISO string in UTC.
// Accepts "DD/MM/YYYY HH:MM[:SS]" (also with 2-digit year).
export function romeToIso(text) {
  const m = String(text || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  let [, d, mo, y, h, mi, s = '0'] = m;
  if (y.length === 2) y = '20' + y;
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // Find Rome's offset at that moment (handles summer/winter time).
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(asUtc))
    .reduce((o, p) => ((o[p.type] = p.value), o), {});
  const romeAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(asUtc - (romeAsUtc - asUtc)).toISOString();
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
