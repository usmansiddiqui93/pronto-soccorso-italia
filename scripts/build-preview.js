// Builds a single self-contained HTML file (data and styles inlined, no map tiles)
// for previewing the site without hosting it. Usage: node scripts/build-preview.js <leaflet.css> <out.html>
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [leafletCssPath, out] = process.argv.slice(2);
const docs = (p) => readFile(path.join(root, 'docs', p), 'utf8');

const [html, css, app, data, regions, leafletCss] = await Promise.all([
  docs('index.html'), docs('style.css'), docs('app.js'), docs('data/latest.json'), docs('data/italia-regioni.geojson'), readFile(leafletCssPath, 'utf8'),
]);
const body = html.split('<!--APP-->')[1].split('<!--/APP-->')[0];
const when = new Date(JSON.parse(data).generatedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });

const page = `<title>Pronto Soccorso Italia</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">
<style>${leafletCss.replace(/url\(images\/[^)]+\)/g, 'none')}</style>
<style>${css}
.preview-banner{background:var(--land-live);color:var(--text);font-size:13px;padding-block:6px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));border-bottom:1px solid var(--line)}
</style>
<div class="preview-banner">Anteprima con un'istantanea reale dei dati di Torino delle ${when}. Sul sito pubblicato i dati si aggiornano ogni 10 minuti e si vede anche la mappa stradale quando si ingrandisce.</div>
${body}
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>window.PSI_NO_TILES=true;window.PSI_INLINE={data:${data.trim()},regions:${regions.trim()}};</script>
<script>${app}</script>
`;
await writeFile(out, page);
console.log('Preview written to', out, `(${(page.length / 1024).toFixed(0)} KB)`);
