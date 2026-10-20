# Pronto Soccorso Italia

A map of Italy showing live emergency room (pronto soccorso) crowding — patients waiting and being seen, by triage code — built from data that regions and hospitals already publish.

**Coverage so far:** Torino (AOU Città della Salute e della Scienza: Molinette, CTO, Sant'Anna, Regina Margherita). More cities are being added one source at a time.

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
