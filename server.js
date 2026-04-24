require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Persistent community pins stored in a local JSON file
const PINS_FILE = path.join(__dirname, 'data', 'pins.json');

function loadPins() {
  try {
    if (!fs.existsSync(path.dirname(PINS_FILE))) {
      fs.mkdirSync(path.dirname(PINS_FILE), { recursive: true });
    }
    if (!fs.existsSync(PINS_FILE)) {
      fs.writeFileSync(PINS_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(PINS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function savePins(pins) {
  fs.writeFileSync(PINS_FILE, JSON.stringify(pins, null, 2));
}

// Decode a Valhalla-encoded polyline (precision 6) into GeoJSON [lng, lat] pairs
function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0;
  const coords = [];
  const factor = 1e6;
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

function valhallaToRoute(trip) {
  const coords = trip.legs.flatMap(leg => decodePolyline(leg.shape));
  return {
    geometry: { type: 'LineString', coordinates: coords },
    distance: trip.summary.length * 1000,
    duration: trip.summary.time
  };
}

// Proxy Valhalla pedestrian routing — follows footways, campus paths, and sidewalks
app.get('/api/route', async (req, res) => {
  const { startLat, startLng, endLat, endLng } = req.query;
  if (!startLat || !startLng || !endLat || !endLng) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  try {
    const body = {
      locations: [
        { lon: parseFloat(startLng), lat: parseFloat(startLat) },
        { lon: parseFloat(endLng),   lat: parseFloat(endLat)   }
      ],
      costing: 'pedestrian',
      costing_options: {
        pedestrian: {
          use_tracks: 1.0,
          use_living_streets: 1.0,
          use_hills: 0.5
        }
      },
      alternates: 3
    };

    const response = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();

    if (data.error || !data.trip) {
      return res.status(400).json({ error: data.error || 'No route found' });
    }

    const routes = [valhallaToRoute(data.trip)];
    if (data.alternates) {
      data.alternates.forEach(alt => routes.push(valhallaToRoute(alt.trip)));
    }

    res.json({ code: 'Ok', routes });
  } catch (err) {
    res.status(500).json({ error: 'Routing service unavailable', detail: err.message });
  }
});

// Geocoding proxy — Nominatim requires a valid User-Agent which browsers can't set
const UMD_VIEWBOX = '-76.9600,39.0020,-76.9290,38.9790';
app.get('/api/geocode', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const strategies = [
    `${q} University of Maryland College Park`,
    `${q} College Park MD`,
    q
  ];

  try {
    for (const query of strategies) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&viewbox=${UMD_VIEWBOX}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'TerpWalk/1.0 (UMD campus safety app)' }
      });
      const data = await response.json();
      if (data.length) return res.json(data);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: 'Geocoding unavailable', detail: err.message });
  }
});

// Community pins endpoints
app.get('/api/pins', (req, res) => {
  res.json(loadPins());
});

app.post('/api/pins', (req, res) => {
  const { lat, lng, type, description } = req.body;
  if (!lat || !lng || !type) {
    return res.status(400).json({ error: 'lat, lng, type required' });
  }
  const pins = loadPins();
  const pin = {
    id: Date.now().toString(),
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    type,
    description: description || '',
    timestamp: new Date().toISOString(),
    votes: 0
  };
  pins.push(pin);
  savePins(pins);
  res.status(201).json(pin);
});

app.patch('/api/pins/:id/vote', (req, res) => {
  const pins = loadPins();
  const pin = pins.find(p => p.id === req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  pin.votes = (pin.votes || 0) + 1;
  savePins(pins);
  res.json(pin);
});

app.delete('/api/pins/:id', (req, res) => {
  let pins = loadPins();
  pins = pins.filter(p => p.id !== req.params.id);
  savePins(pins);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`TerpWalk running at http://localhost:${PORT}`);
});
