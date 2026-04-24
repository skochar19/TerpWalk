// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  map: null,
  startMarker: null,
  endMarker: null,
  routeLayers: [],
  blueLightMarkers: [],
  communityMarkers: [],
  heatLayer: null,
  activeRoute: null,
  walkTimer: null,
  walkSeconds: 0,
  walkStarted: false,
  placingPin: false,
  blueLightCheckInterval: null,
  lastBlueLightAlert: 0,
  safeZoneCircles: []
};

// ─── Map Init ─────────────────────────────────────────────────────────────────
function initMap() {
  state.map = L.map('map', {
    center: UMD_CENTER,
    zoom: 15,
    minZoom: 14,
    maxZoom: 19,
    maxBounds: [
      [UMD_BOUNDS.south - 0.005, UMD_BOUNDS.west - 0.005],
      [UMD_BOUNDS.north + 0.005, UMD_BOUNDS.east + 0.005]
    ],
    maxBoundsViscosity: 0.8
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(state.map);

  renderBlueLights();
  setupMapClickHandler();
  loadCommunityPins();
}

// ─── Blue Light Rendering ─────────────────────────────────────────────────────
function renderBlueLights() {
  const blueLightIcon = L.divIcon({
    className: '',
    html: `<div class="blue-light-marker"><div class="blue-light-pulse"></div><span>🔵</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  BLUE_LIGHTS.forEach(bl => {
    const marker = L.marker([bl.lat, bl.lng], { icon: blueLightIcon, zIndexOffset: 100 })
      .bindPopup(`
        <div class="popup-content">
          <h4>🔵 Emergency Blue Light</h4>
          <p><strong>${bl.name}</strong></p>
          <p class="popup-subtitle">UMD Emergency: <a href="tel:3014054911">(301) 405-4911</a></p>
          <p class="popup-subtitle">Call 911 in emergencies</p>
        </div>
      `);
    marker.addTo(state.map);
    state.blueLightMarkers.push({ marker, data: bl });
  });
}

// ─── Map Click (place start/end or pin) ──────────────────────────────────────
function setupMapClickHandler() {
  state.map.on('click', (e) => {
    if (state.placingPin) {
      openPinForm(e.latlng);
      return;
    }

    const mode = document.getElementById('click-mode').value;
    if (mode === 'start') {
      setStartPoint(e.latlng);
    } else if (mode === 'end') {
      setEndPoint(e.latlng);
    }
  });
}

// ─── Geocoding ────────────────────────────────────────────────────────────────
async function geocode(query) {
  const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  return resp.json();
}

async function geocodeAndSet(inputId, type) {
  const query = document.getElementById(inputId).value.trim();
  if (!query) return;

  showStatus('Searching...', 'info');
  try {
    const results = await geocode(query);
    if (!results.length) {
      showStatus('Location not found. Try clicking the map or a more specific name.', 'error');
      return;
    }
    const { lat, lon, display_name } = results[0];
    const latlng = L.latLng(parseFloat(lat), parseFloat(lon));
    if (type === 'start') {
      document.getElementById(inputId).value = display_name.split(',')[0];
      setStartPoint(latlng);
    } else {
      document.getElementById(inputId).value = display_name.split(',')[0];
      setEndPoint(latlng);
    }
  } catch {
    showStatus('Search failed. Try clicking on the map instead.', 'error');
  }
}

// ─── Markers ──────────────────────────────────────────────────────────────────
function setStartPoint(latlng) {
  if (state.startMarker) state.map.removeLayer(state.startMarker);
  const icon = L.divIcon({
    className: '',
    html: `<div class="route-marker start-marker">A</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
  state.startMarker = L.marker(latlng, { icon, draggable: true })
    .addTo(state.map)
    .bindPopup('Start point');
  state.startMarker.on('dragend', () => {
    if (state.activeRoute) findRoute();
  });
  document.getElementById('start-coords').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

function setEndPoint(latlng) {
  if (state.endMarker) state.map.removeLayer(state.endMarker);
  const icon = L.divIcon({
    className: '',
    html: `<div class="route-marker end-marker">B</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
  state.endMarker = L.marker(latlng, { icon, draggable: true })
    .addTo(state.map)
    .bindPopup('Destination');
  state.endMarker.on('dragend', () => {
    if (state.activeRoute) findRoute();
  });
  document.getElementById('end-coords').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

// ─── Safety Scoring ───────────────────────────────────────────────────────────
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreRoute(coords) {
  // Sample every ~20 points for performance
  const step = Math.max(1, Math.floor(coords.length / 40));
  const sampled = coords.filter((_, i) => i % step === 0);

  let totalDist = 0;
  let blueLightCount = 0;
  let parkingPointCount = 0;

  sampled.forEach(([lng, lat]) => {
    const nearest = BLUE_LIGHTS.reduce((best, bl) => {
      const d = distanceMeters(lat, lng, bl.lat, bl.lng);
      return d < best.d ? { d, bl } : best;
    }, { d: Infinity, bl: null });

    totalDist += nearest.d;
    if (nearest.d < 100) blueLightCount++;

    const inParking = PARKING_CENTERS.some(p => distanceMeters(lat, lng, p.lat, p.lng) < 120);
    if (inParking) parkingPointCount++;
  });

  const avgDist = totalDist / sampled.length;
  const blueLightCoverage = (blueLightCount / sampled.length) * 100;
  const parkingPct = (parkingPointCount / sampled.length) * 100;

  let score = 100;
  score -= Math.min(50, avgDist / 8);
  score += Math.min(20, blueLightCoverage * 0.5);
  score -= Math.min(30, parkingPct * 0.6);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    avgDistToBlueLight: Math.round(avgDist),
    blueLightCoverage: Math.round(blueLightCoverage)
  };
}

function scoreLabel(score) {
  if (score >= 80) return { label: 'Very Safe', color: '#22c55e' };
  if (score >= 60) return { label: 'Mostly Safe', color: '#86efac' };
  if (score >= 40) return { label: 'Moderate', color: '#facc15' };
  if (score >= 20) return { label: 'Use Caution', color: '#f97316' };
  return { label: 'Unsafe', color: '#ef4444' };
}

// ─── Routing ──────────────────────────────────────────────────────────────────
async function findRoute() {
  if (!state.startMarker || !state.endMarker) {
    showStatus('Set both a start point and destination first.', 'error');
    return;
  }

  showStatus('Finding safest route...', 'info');
  clearRoutes();

  const start = state.startMarker.getLatLng();
  const end = state.endMarker.getLatLng();

  try {
    const resp = await fetch(
      `/api/route?startLat=${start.lat}&startLng=${start.lng}&endLat=${end.lat}&endLng=${end.lng}`
    );
    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      showStatus('No route found. Both points must be on walkable paths on UMD campus.', 'error');
      return;
    }

    // Score all returned routes, sort safest first
    const scored = data.routes.map((route, i) => ({
      route,
      index: i,
      ...scoreRoute(route.geometry.coordinates)
    })).sort((a, b) => b.score - a.score);

    // Draw routes (safest on top)
    scored.forEach((s, displayIdx) => {
      const isRecommended = displayIdx === 0;
      const sl = scoreLabel(s.score);
      const layer = L.geoJSON(s.route.geometry, {
        style: {
          color: isRecommended ? sl.color : '#f87171',
          weight: isRecommended ? 6 : 4,
          opacity: isRecommended ? 0.95 : 0.6,
          dashArray: isRecommended ? null : '10,7'
        }
      }).addTo(state.map);

      layer.bindPopup(`
        <div class="popup-content">
          <h4>${isRecommended ? '★ Recommended Route' : `Alternative Route ${displayIdx}`}</h4>
          <p>Safety Score: <strong style="color:${sl.color}">${s.score}/100 — ${sl.label}</strong></p>
          <p>Avg distance to blue light: ${s.avgDistToBlueLight}m</p>
          <p>Blue light coverage: ${s.blueLightCoverage}%</p>
          <p>Walk time: ~${Math.max(1, Math.round(s.route.distance / 72))} min</p>
        </div>
      `);

      state.routeLayers.push(layer);
    });

    // Fit map to route
    state.map.fitBounds(L.geoJSON(scored[0].route.geometry).getBounds().pad(0.15));

    // Show safe zone circles along best route
    showSafeZones(scored[0].route.geometry.coordinates);

    // Update sidebar
    displayRouteInfo(scored[0]);

    state.activeRoute = scored[0];
    showStatus('', '');
  } catch (err) {
    showStatus('Routing error: ' + err.message, 'error');
  }
}

function clearRoutes() {
  state.routeLayers.forEach(l => state.map.removeLayer(l));
  state.routeLayers = [];
  state.safeZoneCircles.forEach(c => state.map.removeLayer(c));
  state.safeZoneCircles = [];
  state.activeRoute = null;
  document.getElementById('route-info').style.display = 'none';
  document.getElementById('walk-controls').style.display = 'none';
}

function showSafeZones(coords) {
  // Find blue lights within 100m of route every ~300m
  const interval = Math.max(1, Math.floor(coords.length / 15));
  coords.filter((_, i) => i % interval === 0).forEach(([lng, lat]) => {
    const nearest = BLUE_LIGHTS.reduce((best, bl) => {
      const d = distanceMeters(lat, lng, bl.lat, bl.lng);
      return d < best.d ? { d, bl } : best;
    }, { d: Infinity, bl: null });

    if (nearest.d < 120) {
      const circle = L.circle([nearest.bl.lat, nearest.bl.lng], {
        radius: 80,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '4,4'
      }).addTo(state.map);
      state.safeZoneCircles.push(circle);
    }
  });
}

// ─── Route Info Panel ─────────────────────────────────────────────────────────
function displayRouteInfo(scored) {
  const sl = scoreLabel(scored.score);
  const mins = Math.max(1, Math.round(scored.route.distance / 72));
  const dist = (scored.route.distance / 1000).toFixed(2);

  document.getElementById('route-info').style.display = 'block';
  document.getElementById('route-score').innerHTML = `
    <span style="color:${sl.color};font-size:2rem;font-weight:700">${scored.score}</span>
    <span style="color:${sl.color};font-size:0.9rem">/100 — ${sl.label}</span>
  `;
  document.getElementById('route-stats').innerHTML = `
    <div class="stat-row"><span>🕐 Walk time</span><strong>~${mins} min</strong></div>
    <div class="stat-row"><span>📏 Distance</span><strong>${dist} km</strong></div>
    <div class="stat-row"><span>🔵 Avg to blue light</span><strong>${scored.avgDistToBlueLight}m</strong></div>
    <div class="stat-row"><span>🛡️ Blue light coverage</span><strong>${scored.blueLightCoverage}%</strong></div>
  `;

  document.getElementById('walk-controls').style.display = 'block';
  document.getElementById('walk-duration').textContent = `~${mins} min`;
}

// ─── Walk Timer ───────────────────────────────────────────────────────────────
function startWalk() {
  if (state.walkStarted) return;
  state.walkStarted = true;
  state.walkSeconds = 0;
  state.lastBlueLightAlert = 0;

  document.getElementById('btn-start-walk').style.display = 'none';
  document.getElementById('btn-stop-walk').style.display = 'inline-flex';
  document.getElementById('timer-display').style.display = 'block';

  state.walkTimer = setInterval(() => {
    state.walkSeconds++;
    updateTimerDisplay();

    // Every 5 minutes, remind to check nearest blue light
    const fiveMinMark = Math.floor(state.walkSeconds / 300);
    if (fiveMinMark > state.lastBlueLightAlert && state.walkSeconds >= 300) {
      state.lastBlueLightAlert = fiveMinMark;
      triggerBlueLightReminder();
    }
  }, 1000);
}

function stopWalk() {
  if (!state.walkStarted) return;
  clearInterval(state.walkTimer);
  state.walkStarted = false;
  document.getElementById('btn-start-walk').style.display = 'inline-flex';
  document.getElementById('btn-stop-walk').style.display = 'none';
  showNotification('✅ Walk completed! Stay safe.', 'success');
}

function updateTimerDisplay() {
  const m = Math.floor(state.walkSeconds / 60).toString().padStart(2, '0');
  const s = (state.walkSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timer-clock').textContent = `${m}:${s}`;
}

function triggerBlueLightReminder() {
  // Find nearest blue light to current route midpoint (approximate)
  if (!state.activeRoute) return;
  const coords = state.activeRoute.route.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  const nearest = BLUE_LIGHTS.reduce((best, bl) => {
    const d = distanceMeters(mid[1], mid[0], bl.lat, bl.lng);
    return d < best.d ? { d, bl } : best;
  }, { d: Infinity, bl: null });

  showNotification(
    `🔵 5-min check: Nearest blue light is "${nearest.bl.name}" (~${Math.round(nearest.d)}m away). Stay aware!`,
    'info'
  );
}

// ─── Community Pins ───────────────────────────────────────────────────────────
async function loadCommunityPins() {
  try {
    const resp = await fetch('/api/pins');
    const pins = await resp.json();
    pins.forEach(pin => renderPin(pin));
  } catch {
    // Silently fail — community pins are optional
  }
}

function renderPin(pin) {
  const typeInfo = PIN_TYPES[pin.type] || PIN_TYPES.unsafe;
  const icon = L.divIcon({
    className: '',
    html: `<div class="community-pin" style="background:${typeInfo.color}" title="${typeInfo.label}">${typeInfo.icon}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const timeAgo = timeSince(pin.timestamp);
  const marker = L.marker([pin.lat, pin.lng], { icon })
    .addTo(state.map)
    .bindPopup(`
      <div class="popup-content">
        <h4>${typeInfo.icon} ${typeInfo.label}</h4>
        ${pin.description ? `<p>${pin.description}</p>` : ''}
        <p class="popup-subtitle">Reported ${timeAgo} · ${pin.votes || 0} upvotes</p>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="popup-btn" onclick="votePin('${pin.id}')">👍 Upvote</button>
          <button class="popup-btn danger" onclick="deletePin('${pin.id}')">🗑 Remove</button>
        </div>
      </div>
    `);

  state.communityMarkers.push({ marker, pin });
}

async function submitPin(latlng, type, description) {
  try {
    const resp = await fetch('/api/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: latlng.lat, lng: latlng.lng, type, description })
    });
    const pin = await resp.json();
    renderPin(pin);
    showNotification('📍 Report submitted. Thank you!', 'success');
  } catch {
    showNotification('Failed to submit report.', 'error');
  }
}

async function votePin(id) {
  await fetch(`/api/pins/${id}/vote`, { method: 'PATCH' });
  showNotification('👍 Upvoted!', 'success');
  reloadPins();
}

async function deletePin(id) {
  await fetch(`/api/pins/${id}`, { method: 'DELETE' });
  reloadPins();
}

function reloadPins() {
  state.communityMarkers.forEach(({ marker }) => state.map.removeLayer(marker));
  state.communityMarkers = [];
  loadCommunityPins();
}

// ─── Pin Placement UI ─────────────────────────────────────────────────────────
function openPinForm(latlng) {
  state.placingPin = false;
  state.map.getContainer().classList.remove('pin-cursor');
  document.getElementById('btn-add-pin').classList.remove('active');

  const typeOptions = Object.entries(PIN_TYPES)
    .map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`)
    .join('');

  const popup = L.popup({ maxWidth: 280 })
    .setLatLng(latlng)
    .setContent(`
      <div class="popup-content">
        <h4>📍 Report This Location</h4>
        <select id="pin-type-select" style="width:100%;margin:8px 0;padding:6px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#f1f5f9">
          ${typeOptions}
        </select>
        <textarea id="pin-desc" placeholder="Optional description..." style="width:100%;margin-top:4px;padding:6px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;resize:vertical;min-height:60px"></textarea>
        <button class="popup-btn" style="margin-top:8px;width:100%" onclick="submitPin(L.latLng(${latlng.lat},${latlng.lng}), document.getElementById('pin-type-select').value, document.getElementById('pin-desc').value)">
          Submit Report
        </button>
      </div>
    `)
    .openOn(state.map);
}

function togglePinMode() {
  state.placingPin = !state.placingPin;
  const btn = document.getElementById('btn-add-pin');
  const modeEl = document.getElementById('click-mode');
  if (state.placingPin) {
    btn.classList.add('active');
    state.map.getContainer().classList.add('pin-cursor');
    showNotification('Click anywhere on the map to report a location.', 'info');
    modeEl.value = 'none';
  } else {
    btn.classList.remove('active');
    state.map.getContainer().classList.remove('pin-cursor');
    modeEl.value = 'start';
  }
}

// ─── Layer Toggles ────────────────────────────────────────────────────────────
function toggleBlueLights(visible) {
  state.blueLightMarkers.forEach(({ marker }) => {
    if (visible) marker.addTo(state.map);
    else state.map.removeLayer(marker);
  });
}

function toggleHeatmap(visible) {
  if (!L.heatLayer) return; // plugin not loaded

  if (visible) {
    if (state.heatLayer) { state.heatLayer.addTo(state.map); return; }
    // Use blue light locations as heat source (safety density)
    const points = BLUE_LIGHTS.map(bl => [bl.lat, bl.lng, 0.8]);
    state.heatLayer = L.heatLayer(points, {
      radius: 60, blur: 40, maxZoom: 17,
      gradient: { 0.2: '#3b82f6', 0.5: '#22c55e', 1.0: '#86efac' }
    }).addTo(state.map);
  } else {
    if (state.heatLayer) state.map.removeLayer(state.heatLayer);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function showStatus(msg, type) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = 'status-msg ' + (type || '');
  el.style.display = msg ? 'block' : 'none';
}

function showNotification(msg, type) {
  const container = document.getElementById('notifications');
  const el = document.createElement('div');
  el.className = `notification ${type || 'info'}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 400);
  }, 4000);
}

function timeSince(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMap();

  // Click mode selector
  document.getElementById('click-mode').addEventListener('change', () => {
    if (state.placingPin) togglePinMode();
  });

  // Search buttons
  document.getElementById('btn-search-start').addEventListener('click', () =>
    geocodeAndSet('input-start', 'start'));
  document.getElementById('btn-search-end').addEventListener('click', () =>
    geocodeAndSet('input-end', 'end'));

  document.getElementById('input-start').addEventListener('keydown', e => {
    if (e.key === 'Enter') geocodeAndSet('input-start', 'start');
  });
  document.getElementById('input-end').addEventListener('keydown', e => {
    if (e.key === 'Enter') geocodeAndSet('input-end', 'end');
  });

  // Route buttons
  document.getElementById('btn-find-route').addEventListener('click', findRoute);
  document.getElementById('btn-clear-route').addEventListener('click', clearRoutes);

  // Walk controls
  document.getElementById('btn-start-walk').addEventListener('click', startWalk);
  document.getElementById('btn-stop-walk').addEventListener('click', stopWalk);

  // Community pins
  document.getElementById('btn-add-pin').addEventListener('click', togglePinMode);

  // Layer toggles
  document.getElementById('toggle-blue-lights').addEventListener('change', e =>
    toggleBlueLights(e.target.checked));
  document.getElementById('toggle-heatmap').addEventListener('change', e =>
    toggleHeatmap(e.target.checked));
});
