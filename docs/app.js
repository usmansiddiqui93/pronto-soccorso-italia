(function () {
  'use strict';

  // Inline data (used by the single-file preview) or files next to the page (GitHub Pages).
  var INLINE = window.PSI_INLINE || null;
  var SHOW_TILES = !window.PSI_NO_TILES;

  var CODES = [
    { key: 'rosso', label: 'Rosso', hex: '#d62828', css: 'var(--t-rosso)' },
    { key: 'arancione', label: 'Arancione', hex: '#f07c00', css: 'var(--t-arancione)' },
    { key: 'azzurro', label: 'Azzurro', hex: '#2b8fd6', css: 'var(--t-azzurro)' },
    { key: 'verde', label: 'Verde', hex: '#2e9e4f', css: 'var(--t-verde)' },
    { key: 'bianco', label: 'Bianco', hex: '#b9c2cc', css: 'var(--t-bianco)' },
  ];
  var LEVEL_HEX = { low: '#1f9d6b', mid: '#e3a008', high: '#d1343e', na: '#94a3b3' };
  var CITY_ZOOM = 11; // below this zoom, hospitals in the same city are shown as one marker

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  var HOME = { center: [42.2, 12.5], zoom: 5.75 };
  var map = L.map('map', { zoomSnap: 0.25, minZoom: 5, maxZoom: 17, zoomControl: true, attributionControl: true })
    .setView(HOME.center, HOME.zoom);
  map.setMaxBounds([[33.5, 2.5], [48.5, 22.5]]);
  map.attributionControl.setPrefix(false);

  var tiles = null;
  if (SHOW_TILES) {
    tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, opacity: 0.85,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
  }

  var state = { hospitals: [], regionsGeo: null, regionLayer: null, markerLayer: L.layerGroup().addTo(map), markers: {}, q: '', region: '', liveRegions: {} };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Sources that only publish patients present (waiting + being seen) use a higher scale.
  function levelPresent(p) {
    if (p == null) return 'na';
    if (p >= 35) return 'high';
    if (p >= 15) return 'mid';
    return 'low';
  }
  function hLevel(h) {
    if (h.closed) return 'na';
    if (h.waiting != null) return level(h.waiting);
    return levelPresent(h.present);
  }
  function level(w) {
    if (w == null) return 'na';
    if (w >= 25) return 'high';
    if (w >= 10) return 'mid';
    return 'low';
  }
  function n(v) { return v == null ? '–' : v; }
  function timeAgo(iso) {
    if (!iso) return 'n.d.';
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'adesso';
    if (mins < 60) return mins + ' min fa';
    var h = Math.floor(mins / 60);
    if (h < 24) return h + ' h fa';
    return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  }
  function regionName(feature) { return String(feature.properties.reg_name).split('/')[0]; }

  // ---------- Regions (the base map) ----------
  function regionStyle(feature) {
    var live = !!state.liveRegions[regionName(feature)];
    var selected = state.region && state.region === regionName(feature);
    return {
      color: selected ? cssVar('--accent') : cssVar('--border'),
      weight: selected ? 2 : 1,
      fillColor: live ? cssVar('--land-live') : cssVar('--land'),
      fillOpacity: tiles && map.getZoom() >= 9 ? 0.15 : 1,
    };
  }
  function drawRegions() {
    if (!state.regionsGeo) return;
    if (state.regionLayer) map.removeLayer(state.regionLayer);
    state.regionLayer = L.geoJSON(state.regionsGeo, {
      style: regionStyle,
      onEachFeature: function (f, layer) {
        var name = regionName(f);
        layer.bindTooltip(name, { permanent: true, direction: 'center', className: 'region-label', interactive: false });
        layer.on('click', function () {
          var sel = document.getElementById('region');
          var live = state.liveRegions[name];
          state.region = live ? name : '';
          sel.value = state.region;
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
          if (!live) layer.bindPopup('<div class="pop"><h3>' + esc(name) + '</h3><div class="meta">Dati in tempo reale non ancora disponibili su questa mappa.</div></div>').openPopup();
          render();
        });
      },
    }).addTo(map);
    state.regionLayer.bringToBack();
    updateLabels();
  }
  function updateLabels() {
    if (!state.regionLayer) return;
    var show = map.getZoom() >= 6 && map.getZoom() < 9;
    state.regionLayer.eachLayer(function (l) { var t = l.getTooltip(); if (t) t.setOpacity(show ? 1 : 0); });
  }

  // ---------- Popups / list ----------
  function triageTable(rows, minLabel) {
    return '<table><thead><tr><th>Codice</th><th>In attesa</th><th>In visita</th>' + (minLabel ? '<th>' + esc(minLabel) + '</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function fmtMin(m) {
    if (m == null) return '–';
    if (m < 60) return m + "'";
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + "'";
  }
  function where(h) {
    return esc(h.city) + ' · ' + esc(h.region) + (h.kind ? ' · ' + esc(h.kind) : '');
  }
  function openNote(h) {
    if (h.closed) return '<div class="closed">Chiuso ora' + (h.hours ? ' · aperto ' + esc(h.hours) : '') + '</div>';
    if (h.hours) return '<div class="hours">Aperto ' + esc(h.hours) + '</div>';
    return '';
  }
  function presentOnly(h) { return h.waiting == null && h.present != null; }
  function popupHtml(h) {
    if (presentOnly(h)) {
      var hasMin = h.minutesLabel && CODES.some(function (c) { var t = h.triage && h.triage[c.key]; return t && t.minutes != null; });
      var prow = CODES.map(function (c) {
        var t = h.triage && h.triage[c.key];
        return '<tr><td><span class="sw" style="background:' + c.hex + '"></span>' + c.label + '</td><td>' + n(t && t.present) + '</td>' +
          (hasMin ? '<td>' + fmtMin(t ? t.minutes : null) + '</td>' : '') + '</tr>';
      }).join('') + '<tr><td><b>Totale</b></td><td><b>' + n(h.present) + '</b></td>' + (hasMin ? '<td></td>' : '') + '</tr>';
      return '<div class="pop"><h3>' + esc(h.name) + '</h3><div class="meta">' + where(h) + '</div>' + openNote(h) +
        '<table><thead><tr><th>Codice</th><th>Presenti in PS</th>' + (hasMin ? '<th>' + esc(h.minutesLabel) + '</th>' : '') + '</tr></thead><tbody>' + prow + '</tbody></table>' +
        '<div class="meta">Questa fonte non distingue i pazienti in attesa da quelli in visita.</div>' +
        (h.stale ? '<div class="stale">Fonte non raggiungibile: dati non aggiornati.</div>' : '') +
        '<div class="meta">Aggiornato ' + esc(timeAgo(h.updatedAt || h.fetchedAt)) + ' · <a href="' + esc(h.sourceUrl) + '" target="_blank" rel="noopener">Fonte ufficiale</a></div></div>';
    }
    var mins = h.minutesLabel && CODES.some(function (c) { var t = h.triage && h.triage[c.key]; return t && t.minutes != null; });
    var rows = CODES.map(function (c) {
      var t = h.triage && h.triage[c.key];
      return '<tr><td><span class="sw" style="background:' + c.hex + '"></span>' + c.label + '</td><td>' + n(t && t.waiting) + '</td><td>' + n(t && t.inTreatment) + '</td>' +
        (mins ? '<td>' + (t && t.minutes ? fmtMin(t.minutes) : '–') + '</td>' : '') + '</tr>';
    }).join('') + '<tr><td><b>Totale</b></td><td><b>' + n(h.waiting) + '</b></td><td><b>' + n(h.inTreatment) + '</b></td>' + (mins ? '<td></td>' : '') + '</tr>';
    return '<div class="pop"><h3>' + esc(h.name) + '</h3><div class="meta">' + where(h) + '</div>' + openNote(h) +
      triageTable(rows, mins ? h.minutesLabel : null) +
      (h.note ? '<div class="meta">' + esc(h.note) + '</div>' : '') +
      (h.untriaged ? '<div class="meta">In attesa di triage (senza codice): <b>' + h.untriaged + '</b>, inclusi nel totale in attesa</div>' : '') +
      (h.observation != null ? '<div class="meta">In osservazione (OBI): <b>' + h.observation + '</b></div>' : '') +
      (h.crowdingPct != null ? '<div class="meta">Indice di affollamento: <b>' + h.crowdingPct + '%</b></div>' : '') +
      (h.stale ? '<div class="stale">Fonte non raggiungibile: dati non aggiornati.</div>' : '') +
      '<div class="meta">Aggiornato ' + esc(timeAgo(h.updatedAt || h.fetchedAt)) + ' · <a href="' + esc(h.sourceUrl) + '" target="_blank" rel="noopener">Fonte ufficiale</a></div></div>';
  }
  function cityPopupHtml(city, list) {
    var rows = list.map(function (h) {
      if (presentOnly(h)) return '<tr><td>' + esc(h.name) + '</td><td colspan="2">' + h.present + ' presenti*</td></tr>';
      return '<tr><td>' + esc(h.name) + (h.closed ? ' <i>(chiuso)</i>' : '') + '</td><td>' + n(h.waiting) + '</td><td>' + n(h.inTreatment) + '</td></tr>';
    }).join('');
    return '<div class="pop"><h3>' + esc(city) + '</h3><div class="meta">' + list.length + ' pronto soccorso · ingrandisci per i dettagli</div>' +
      '<table><thead><tr><th>Ospedale</th><th>In attesa</th><th>In visita</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function itemHtml(h) {
    var lv = hLevel(h);
    var po = presentOnly(h);
    var badge = h.closed ? 'chiuso' : po ? h.present + ' in PS' : (h.waiting == null ? 'n.d.' : h.waiting + ' in attesa');
    var codes = CODES.map(function (c) {
      var t = h.triage && h.triage[c.key];
      if (po) return '<div class="code" style="--c:' + c.css + '" title="' + c.label + ': presenti in PS"><b>' + n(t && t.present) + '</b><span>&nbsp;</span></div>';
      return '<div class="code" style="--c:' + c.css + '" title="' + c.label + ': in attesa / in visita"><b>' + n(t && t.waiting) + '</b><span>' + n(t && t.inTreatment) + '</span></div>';
    }).join('');
    return '<div class="item-head"><div><h3>' + esc(h.name) + '</h3><div class="where">' + where(h) + '</div>' + openNote(h) + '</div>' +
      '<span class="badge ' + lv + '" title="' + (po ? 'Pazienti presenti in pronto soccorso' : 'Pazienti in attesa') + '">' + badge + '</span></div>' +
      '<div class="codes">' + codes + '</div>' +
      '<div class="codes-key"><span>' + (po ? 'presenti per codice (attesa e visita non distinti)' : 'in attesa / in visita per codice: rosso → bianco') + '</span></div>' +
      (h.stale ? '<div class="stale">Dati non aggiornati: fonte non raggiungibile</div>' : '');
  }

  function visible() {
    var q = state.q.toLowerCase();
    return state.hospitals.filter(function (h) {
      if (state.region && h.region !== state.region) return false;
      if (q && (h.name + ' ' + h.city).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) {
      if (!!a.closed !== !!b.closed) return a.closed ? 1 : -1; // closed sites last
      return (b.waiting == null ? -1 : b.waiting) - (a.waiting == null ? -1 : a.waiting);
    });
  }

  // ---------- Markers ----------
  function circle(latlng, waiting, stale, label, closed, present) {
    var m;
    if (!closed && waiting == null && present != null) {
      // "Patients present" sources: a coloured ring, sized on the present count.
      var col = LEVEL_HEX[levelPresent(present)];
      m = L.circleMarker(latlng, { radius: Math.min(22, 7 + Math.sqrt(present) * 1.6), color: col, weight: 4, fillColor: col, fillOpacity: stale ? 0.15 : 0.3 });
    } else {
      var r = closed || waiting == null ? 7 : Math.min(24, 8 + Math.sqrt(waiting) * 2.2);
      m = L.circleMarker(latlng, { radius: r, color: '#ffffff', weight: 2, fillColor: LEVEL_HEX[closed ? 'na' : level(waiting)], fillOpacity: stale || closed ? 0.45 : 0.92 });
    }
    if (label != null) m.bindTooltip(String(label), { permanent: true, direction: 'center', className: 'region-label', opacity: 1 });
    return m;
  }
  function drawMarkers(rows) {
    state.markerLayer.clearLayers();
    state.markers = {};
    if (map.getZoom() >= CITY_ZOOM) {
      // Units in the same building (e.g. general + paediatric ER) share coordinates: fan them out slightly.
      var same = {};
      rows.forEach(function (h) { var k = h.lat.toFixed(4) + ',' + h.lon.toFixed(4); (same[k] = same[k] || []).push(h.id); });
      rows.forEach(function (h) {
        var group = same[h.lat.toFixed(4) + ',' + h.lon.toFixed(4)];
        var ll = [h.lat, h.lon];
        if (group.length > 1) {
          var i = group.indexOf(h.id), ang = (2 * Math.PI * i) / group.length;
          var meters = 45 * Math.pow(2, 15 - Math.min(map.getZoom(), 17)) / 2 + 20;
          ll = [h.lat + (meters / 111320) * Math.sin(ang), h.lon + (meters / (111320 * Math.cos(h.lat * Math.PI / 180))) * Math.cos(ang)];
        }
        var m = circle(ll, h.waiting, h.stale, null, h.closed, h.present).bindPopup(popupHtml(h));
        state.markers[h.id] = m;
        m.addTo(state.markerLayer);
      });
      return;
    }
    var cities = {};
    rows.forEach(function (h) { (cities[h.city] = cities[h.city] || []).push(h); });
    Object.keys(cities).forEach(function (city) {
      var list = cities[city];
      var lat = 0, lon = 0, w = null, stale = false;
      list.forEach(function (h) { lat += h.lat; lon += h.lon; if (h.waiting != null) w = (w || 0) + h.waiting; stale = stale || h.stale; });
      var ll = [lat / list.length, lon / list.length];
      var m;
      var pres = null;
      if (w == null) list.forEach(function (h) { if (h.present != null) pres = (pres || 0) + h.present; });
      if (list.length === 1) m = circle(ll, w, stale, null, list[0].closed, list[0].present).bindPopup(popupHtml(list[0]));
      else {
        m = circle(ll, w, stale, null, false, pres).bindPopup(cityPopupHtml(city, list));
        m.on('dblclick', function () { map.setView(ll, CITY_ZOOM + 1); });
      }
      list.forEach(function (h) { state.markers[h.id] = m; });
      m.addTo(state.markerLayer);
    });
  }

  function render() {
    var rows = visible();
    var list = document.getElementById('list');
    list.innerHTML = '';
    if (!rows.length) list.innerHTML = '<li class="item empty">Nessun pronto soccorso trovato.</li>';
    rows.forEach(function (h) {
      var li = document.createElement('li');
      li.className = 'item';
      li.tabIndex = 0;
      li.innerHTML = itemHtml(h);
      if (h.id === state.activeId) li.classList.add('active');
      var go = function () {
        state.activeId = h.id;
        Array.prototype.forEach.call(list.children, function (c) { c.classList.remove('active'); });
        li.classList.add('active');
        // On phones the map sits above the list: bring it into view.
        if (window.matchMedia('(max-width: 820px)').matches) document.querySelector('.mapwrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
        map.setView([h.lat, h.lon], Math.max(map.getZoom(), 14));
        setTimeout(function () { if (state.markers[h.id]) state.markers[h.id].openPopup(); }, 250);
      };
      li.addEventListener('click', go);
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      list.appendChild(li);
    });
    drawMarkers(rows);
    if (state.regionLayer) state.regionLayer.setStyle(regionStyle);
    updateBack();
  }

  // "Back to the Italy map": shown whenever the view is zoomed in or filtered.
  var backBtn = document.getElementById('back');
  function updateBack() {
    backBtn.hidden = !(map.getZoom() > HOME.zoom + 0.5 || state.region || state.q);
  }
  function goHome() {
    state.region = '';
    state.q = '';
    state.activeId = null;
    document.getElementById('region').value = '';
    document.getElementById('q').value = '';
    map.closePopup();
    map.setView(HOME.center, HOME.zoom);
    render();
  }
  backBtn.addEventListener('click', goHome);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !backBtn.hidden) goHome(); });

  function renderCoverage(data) {
    var live = Object.keys(state.liveRegions).sort();
    document.getElementById('coverage').innerHTML =
      '<b>' + live.length + ' di 20 regioni</b> con dati in tempo reale' +
      '<br><span class="sw-live"></span>' + (live.join(', ') || 'nessuna') +
      '<br><span class="sw-none"></span>altre regioni: in arrivo';
  }

  function applyData(data) {
    state.hospitals = (data.hospitals || []).filter(function (h) { return h.lat && h.lon; });
    state.liveRegions = {};
    state.hospitals.forEach(function (h) { state.liveRegions[h.region] = true; });

    var sel = document.getElementById('region');
    var regions = Object.keys(state.liveRegions).sort();
    sel.innerHTML = '<option value="">Tutte le regioni</option>' + regions.map(function (r) {
      return '<option' + (r === state.region ? ' selected' : '') + '>' + esc(r) + '</option>';
    }).join('');

    document.getElementById('updated').textContent = state.hospitals.length + ' pronto soccorso · dati di ' + timeAgo(data.generatedAt);
    document.getElementById('sources').innerHTML = 'Fonti: ' + (data.sources || []).map(function (s) {
      return esc(s.label) + (s.ok ? '' : ' (non raggiungibile)');
    }).join(' · ');
    renderCoverage(data);
    render();
  }

  function loadJson(url) { return fetch(url + '?t=' + Date.now()).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  function loadData() {
    var p = INLINE ? Promise.resolve(INLINE.data) : loadJson('data/latest.json');
    return p.then(applyData).catch(function () {
      document.getElementById('updated').textContent = 'Impossibile caricare i dati. Riprova tra qualche minuto.';
    });
  }

  map.on('zoomend', function () {
    if (tiles) {
      var z = map.getZoom();
      if (z >= 9 && !map.hasLayer(tiles)) tiles.addTo(map);
      if (z < 9 && map.hasLayer(tiles)) map.removeLayer(tiles);
      if (state.regionLayer) state.regionLayer.setStyle(regionStyle);
    }
    updateLabels();
    drawMarkers(visible());
    updateBack();
  });

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  document.getElementById('region').addEventListener('change', function (e) {
    state.region = e.target.value;
    render();
    if (state.region && state.regionLayer) {
      state.regionLayer.eachLayer(function (l) { if (regionName(l.feature) === state.region) map.fitBounds(l.getBounds(), { padding: [20, 20] }); });
    } else map.setView(HOME.center, HOME.zoom);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (state.regionLayer) state.regionLayer.setStyle(regionStyle); });

  var geo = INLINE ? Promise.resolve(INLINE.regions) : loadJson('data/italia-regioni.geojson');
  geo.then(function (g) { state.regionsGeo = g; drawRegions(); })
    .catch(function () { /* map still works without region shapes */ })
    .then(loadData);
  setInterval(loadData, 5 * 60 * 1000);
})();
