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

// Proxy OSRM routing to avoid CORS issues and add safety scoring
app.get('/api/route', async (req, res) => {
  const { startLat, startLng, endLat, endLng } = req.query;
  if (!startLat || !startLng || !endLat || !endLng) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full&alternatives=true&steps=true`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Routing service unavailable', detail: err.message });
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
