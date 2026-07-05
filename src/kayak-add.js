// src/kayak-add.js
// Add-trip form — two ways to set location (current GPS position, or paste
// a Maps link / coordinates), USGS gauge auto-fetch, and a save to Supabase.

import { supabase } from './supabase.js';

const USGS_BASE = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections';

let currentMatch = null; // { gauge, riverName, distanceMi, lat, lon }

export function renderKayakAdd(container, onBack) {
  container.innerHTML = `
    <div class="kayak-header">
      <span class="kayak-back-link" style="cursor:pointer" onclick="history.back()">&larr; Back to log</span>
      <h1>Log a trip</h1>
      <p class="kayak-tagline">Set the location two ways: use your current spot, or paste a Maps link / coordinates.</p>
    </div>

    <div class="kayak-card">
      <div class="kayak-location-tabs">
        <button class="kayak-tab active" data-tab="gps" type="button">Current location</button>
        <button class="kayak-tab" data-tab="link" type="button">Paste link / coordinates</button>
      </div>

      <div class="kayak-tab-panel" id="kayak-tab-gps">
        <button class="btn-secondary kayak-geo-btn" id="kayak-geo-btn" type="button">Use my current location</button>
        <div class="kayak-hint" id="kayak-geo-hint"></div>
      </div>

      <div class="kayak-tab-panel" id="kayak-tab-link" style="display:none">
        <label for="kayak-maps-link">Google Maps link or "lat, lon"</label>
        <input id="kayak-maps-link" type="text" placeholder="maps.app.goo.gl/… or 39.898, -85.991">
        <div class="kayak-hint" id="kayak-link-hint"></div>
      </div>

      <div class="kayak-row">
        <div><label for="kayak-lat">Latitude</label><input id="kayak-lat" type="number" step="0.000001" readonly></div>
        <div><label for="kayak-lon">Longitude</label><input id="kayak-lon" type="number" step="0.000001" readonly></div>
      </div>

      <div class="kayak-row">
        <div><label for="kayak-date">Date</label><input id="kayak-date" type="date"></div>
        <div><label for="kayak-time">Time</label><input id="kayak-time" type="time"></div>
      </div>

      <button class="btn-secondary kayak-find-btn" id="kayak-find-btn" type="button">Find nearest gauge &amp; pull reading</button>
      <div class="kayak-hint" id="kayak-find-hint"></div>
      <div class="kayak-match-card" id="kayak-match-card"></div>

      <div class="kayak-row">
        <div><label for="kayak-height">Height (ft)</label><input id="kayak-height" type="number" step="0.01" placeholder="—"></div>
        <div><label for="kayak-discharge">Discharge (ft³/s)</label><input id="kayak-discharge" type="number" step="1" placeholder="—"></div>
      </div>

      <div class="kayak-row">
        <div><label for="kayak-kayakers">Kayakers</label><input id="kayak-kayakers" type="number" min="0" value="0"></div>
        <div><label for="kayak-beginners">Beginners</label><input id="kayak-beginners" type="number" min="0" value="0"></div>
      </div>

      <details class="kayak-details">
        <summary>More details (optional)</summary>
        <label for="kayak-duration">Duration</label>
        <input id="kayak-duration" type="text" placeholder="e.g. 2.5 hours">
        <label for="kayak-notes">Notes</label>
        <textarea id="kayak-notes" placeholder="Conditions, wildlife, how it felt…"></textarea>
        <label>Rating</label>
        <div class="kayak-stars" id="kayak-stars">
          ${[1,2,3,4,5].map(n => `<span class="kayak-star" data-val="${n}">★</span>`).join('')}
        </div>
      </details>

      <div id="kayak-form-msg"></div>
      <button class="btn-primary kayak-submit-btn" id="kayak-submit-btn" type="button">Log trip</button>
    </div>
  `;

  wireTabs(container);
  wireGeolocation(container);
  wireLinkInput(container);
  wireFindButton(container);
  wireStars(container);
  wireSubmit(container);
}

function wireTabs(container) {
  const tabs = container.querySelectorAll('.kayak-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      container.querySelector('#kayak-tab-gps').style.display = tab.dataset.tab === 'gps' ? '' : 'none';
      container.querySelector('#kayak-tab-link').style.display = tab.dataset.tab === 'link' ? '' : 'none';
    });
  });
}

function setCoords(container, lat, lon, msg, hintEl) {
  container.querySelector('#kayak-lat').value = lat.toFixed(6);
  container.querySelector('#kayak-lon').value = lon.toFixed(6);
  currentMatch = null;
  hintEl.className = 'kayak-hint kayak-hint-ok';
  hintEl.textContent = msg;
}

function wireGeolocation(container) {
  const btn = container.querySelector('#kayak-geo-btn');
  const hint = container.querySelector('#kayak-geo-hint');
  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      hint.className = 'kayak-hint kayak-hint-err';
      hint.textContent = 'Geolocation not available in this browser.';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords(container, pos.coords.latitude, pos.coords.longitude, 'Current location set.', hint);
        btn.disabled = false;
        btn.textContent = 'Use my current location';
      },
      err => {
        hint.className = 'kayak-hint kayak-hint-err';
        hint.textContent = `Couldn't get location: ${err.message}`;
        btn.disabled = false;
        btn.textContent = 'Use my current location';
      }
    );
  });
}

function extractCoordsFromText(text) {
  let m = text.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) m = text.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (!m) m = text.match(/(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

function wireLinkInput(container) {
  const input = container.querySelector('#kayak-maps-link');
  const hint = container.querySelector('#kayak-link-hint');

  const handle = async () => {
    const raw = input.value.trim();
    if (!raw) { hint.textContent = ''; return; }

    const direct = extractCoordsFromText(raw);
    if (direct) {
      setCoords(container, direct[0], direct[1], `Parsed — ${direct[0].toFixed(4)}, ${direct[1].toFixed(4)}`, hint);
      return;
    }

    const isShortLink = /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(raw);
    if (isShortLink) {
      hint.className = 'kayak-hint';
      hint.textContent = 'Resolving link…';
      try {
        const res = await fetch('/api/resolve-maps-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: raw })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setCoords(container, data.lat, data.lon, `Resolved — ${data.lat.toFixed(4)}, ${data.lon.toFixed(4)}`, hint);
      } catch (e) {
        hint.className = 'kayak-hint kayak-hint-err';
        hint.textContent = `Couldn't resolve link (${e.message}). Try typing lat/lon directly.`;
      }
      return;
    }

    hint.className = 'kayak-hint kayak-hint-err';
    hint.textContent = 'No coordinates found. Try a full Maps URL or "lat, lon".';
  };

  input.addEventListener('change', handle);
  input.addEventListener('paste', () => setTimeout(handle, 80));
}

async function fetchParam(gauge, code, start, end, target) {
  const url = `${USGS_BASE}/continuous/items?f=json&skipGeometry=true&properties=value,time` +
    `&monitoring_location_id=USGS-${encodeURIComponent(gauge)}&parameter_code=${code}&time=${start}/${end}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  let best = null, bestDiff = Infinity;
  for (const f of data.features || []) {
    const diff = Math.abs(new Date(f.properties.time) - target);
    if (diff < bestDiff) { bestDiff = diff; best = { ...f.properties, diffMin: Math.round(diff / 60000) }; }
  }
  return best;
}

function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function searchNearestWithData(lat, lon, target, setStatus) {
  const start = new Date(target.getTime() - 90 * 60000).toISOString();
  const end = new Date(target.getTime() + 90 * 60000).toISOString();
  const tried = new Set();

  for (const d of [0.15, 0.35, 0.7]) {
    const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
    setStatus(`Searching within ~${Math.round(d * 69)} mi…`);
    let data;
    try {
      const res = await fetch(`${USGS_BASE}/monitoring-locations/items?f=json&bbox=${bbox}&limit=100`);
      if (!res.ok) continue;
      data = await res.json();
    } catch { continue; }

    const candidates = (data.features || [])
      .filter(f => !tried.has(f.properties.monitoring_location_id))
      .map(f => {
        const [flon, flat] = f.geometry.coordinates;
        return {
          id: f.properties.monitoring_location_id,
          name: f.properties.monitoring_location_name,
          type: f.properties.site_type,
          dist: distanceMiles(lat, lon, flat, flon)
        };
      })
      .filter(c => !c.type || !/well|lake|reservoir|spring/i.test(c.type))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8);

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      tried.add(c.id);
      setStatus(`Checking ${c.name} (${c.dist.toFixed(1)} mi)… [${i + 1}/${candidates.length}]`);
      const gaugeId = c.id.replace(/^USGS-/, '');
      const [height, discharge] = await Promise.all([
        fetchParam(gaugeId, '00065', start, end, target),
        fetchParam(gaugeId, '00060', start, end, target)
      ]);
      if (height || discharge) {
        return { gauge: gaugeId, riverName: c.name, distanceMi: c.dist, height, discharge };
      }
    }
  }
  return null;
}

function wireFindButton(container) {
  const btn = container.querySelector('#kayak-find-btn');
  btn.addEventListener('click', async () => {
    const lat = parseFloat(container.querySelector('#kayak-lat').value);
    const lon = parseFloat(container.querySelector('#kayak-lon').value);
    const date = container.querySelector('#kayak-date').value;
    const time = container.querySelector('#kayak-time').value;
    const hint = container.querySelector('#kayak-find-hint');
    const matchCard = container.querySelector('#kayak-match-card');

    if (isNaN(lat) || isNaN(lon) || !date || !time) {
      hint.className = 'kayak-hint kayak-hint-err';
      hint.textContent = 'Set a location, date, and time first.';
      return;
    }

    const target = new Date(`${date}T${time}:00`);
    btn.disabled = true;
    matchCard.classList.remove('show');
    hint.className = 'kayak-hint';

    const result = await searchNearestWithData(lat, lon, target, t => { hint.textContent = t; });
    btn.disabled = false;

    if (!result) {
      hint.className = 'kayak-hint kayak-hint-err';
      hint.textContent = 'No gauge with data found nearby. Enter height/discharge manually.';
      return;
    }

    currentMatch = { gauge: result.gauge, riverName: result.riverName, distanceMi: result.distanceMi, lat, lon };
    if (result.height) container.querySelector('#kayak-height').value = parseFloat(result.height.value).toFixed(2);
    if (result.discharge) container.querySelector('#kayak-discharge').value = Math.round(parseFloat(result.discharge.value));

    matchCard.classList.add('show');
    matchCard.innerHTML = `<b>${result.riverName}</b><br>USGS-${result.gauge} · ${result.distanceMi.toFixed(1)} mi from pin`;
    const ref = result.height || result.discharge;
    hint.className = 'kayak-hint kayak-hint-ok';
    hint.textContent = ref ? `Reading matched — ~${ref.diffMin} min off target time.` : 'Matched station, no reading in range — enter manually.';
  });
}

function wireStars(container) {
  const stars = container.querySelectorAll('.kayak-star');
  let selected = 0;
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selected = parseInt(star.dataset.val);
      stars.forEach(s => s.classList.toggle('lit', parseInt(s.dataset.val) <= selected));
      container.querySelector('#kayak-stars').dataset.selected = selected;
    });
  });
}

function wireSubmit(container) {
  const btn = container.querySelector('#kayak-submit-btn');
  btn.addEventListener('click', async () => {
    const msgEl = container.querySelector('#kayak-form-msg');
    const date = container.querySelector('#kayak-date').value;
    const time = container.querySelector('#kayak-time').value;
    const kayakers = parseInt(container.querySelector('#kayak-kayakers').value) || 0;
    const beginners = parseInt(container.querySelector('#kayak-beginners').value) || 0;
    const height = container.querySelector('#kayak-height').value;
    const discharge = container.querySelector('#kayak-discharge').value;
    const duration = container.querySelector('#kayak-duration').value.trim();
    const notes = container.querySelector('#kayak-notes').value.trim();
    const rating = parseInt(container.querySelector('#kayak-stars').dataset.selected || '0');

    if (!date || !time) { msgEl.innerHTML = `<div class="kayak-form-error">Date and time are required.</div>`; return; }
    if (kayakers === 0 && beginners === 0) { msgEl.innerHTML = `<div class="kayak-form-error">Log at least one paddler.</div>`; return; }
    if (!currentMatch) { msgEl.innerHTML = `<div class="kayak-form-error">Find the nearest gauge before logging.</div>`; return; }

    const { error } = await supabase.from('kayak_trips').insert({
      river_name: currentMatch.riverName,
      gauge_id: currentMatch.gauge,
      lat: currentMatch.lat,
      lon: currentMatch.lon,
      distance_mi: currentMatch.distanceMi,
      trip_date: date,
      trip_time: time,
      kayakers, beginners,
      height_ft: height ? parseFloat(height) : null,
      discharge_cfs: discharge ? parseFloat(discharge) : null,
      duration: duration || null,
      notes: notes || null,
      rating: rating || null
    });

    if (error) {
      msgEl.innerHTML = `<div class="kayak-form-error">Couldn't save: ${error.message}</div>`;
      return;
    }

    msgEl.innerHTML = `<div class="kayak-form-ok">Trip logged.</div>`;
    setTimeout(() => { onBack(); }, 700);
  });
}
