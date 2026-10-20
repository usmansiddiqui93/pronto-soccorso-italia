# Pronto Soccorso Italia

A map of Italy showing live emergency room (pronto soccorso) crowding — patients waiting and being seen, by triage code — built from data that regions and hospitals already publish.

**Coverage so far:** Torino (AOU Città della Salute: Molinette, CTO, Sant'Anna, Regina Margherita) · Firenze, Prato, Pistoia, Empoli (Azienda USL Toscana Centro: 9 hospitals; Careggi and Meyer not included). · Liguria (Regione Liguria PS Live: all 18 sites, incl. Genova, Savona, La Spezia, Imperia). · Trentino (APSS open data, CC BY 4.0: 11 units in Trento, Rovereto, Arco, Cles, Tione, Borgo Valsugana, Cavalese). · Palermo province (ASP 6 Palermo: Ingrassia, Partinico, Corleone, Petralia Sottana, Termini Imerese). · Trapani province (ASP Trapani: 6 hospitals). · Agrigento province (ASP Agrigento: 5 hospitals, patients present only). · Varese area (ASST Valle Olona: Busto Arsizio, Gallarate incl. paediatric PS, Saronno; patients present + minutes). · Valle d'Aosta (AUSL VdA: Ospedale Parini, Aosta). · Friuli-Venezia Giulia (Regione FVG PS online: all 17 sites, with average waits). · Veneto (Regione del Veneto portal: ~55 sites, giallo shown as azzurro). More cities are added one source at a time.

## How it works

```
GitHub Action (every 10 min)
  └─ scripts/update.js runs every adapter in scripts/sources/
       └─ writes docs/data/latest.json
  └─ deploys docs/ to GitHub Pages
Browser
  └─ docs/index.html + app.js draw the map from latest.json
```

- No server or database: the Action fetches the data and GitHub Pages hosts the site for free.
- If a source is down, its last good data stays on the map, marked as not updated.
- Regional boundaries: ISTAT via [openpolis/geojson-italy](https://github.com/openpolis/geojson-italy) (CC BY 4.0). Street map: © OpenStreetMap contributors.

## Setup

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions** tab → "Update data and deploy map" → **Run workflow** (afterwards it runs by itself every 10 minutes).
4. The site appears at `https://<your-username>.github.io/<repo-name>/`.

Scheduled runs on GitHub can start a few minutes late, and GitHub pauses scheduled workflows in repositories with no activity for 60 days (re-enable them from the Actions tab).

## Adding a source

Create `scripts/sources/<region>-<city>-<operator>.js` exporting:

- `meta` — `{ id, region, label }`
- `fetchAll()` — returns an array of hospitals in the common format described in `scripts/lib.js`

Add a captured sample of the source's response to `test/fixtures/` and a test in `test/`, then run `npm test`. Run `npm run update` to fetch everything locally (needs Node 20+).

## Data use

The data belongs to the publishing regions and health authorities. Each hospital links to its official source. Ask each authority for permission before relying on its data at scale, and keep the emergency notice on the page: this site must never be used to decide where to go in an emergency — call 112.
