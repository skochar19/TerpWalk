# TerpWalk 🐢

Built for the **Anthropic x University of Maryland Hackathon**.

TerpWalk is a campus safety app designed to help women feel safer walking — especially at night. It consolidates all of UMD's existing safety resources (emergency blue lights, campus police, safe routes) into a single, easy-to-use map so students never have to search multiple places for the information they need.

## Features

- **Route planning** — Find pedestrian routes between any two points on campus using Valhalla routing (follows footways, campus paths, and sidewalks)
- **Multiple routes** — Up to 4 alternate routes ranked by a safety score based on proximity to emergency blue lights
- **Emergency blue lights** — All UMD blue light phones shown on the map as a toggleable layer
- **Safety heatmap** — Visual overlay of community-reported incidents and unsafe areas
- **Community pins** — Report unsafe spots, broken lights, or safe locations; upvote existing reports
- **Walk timer** — Built-in timer with reminders to check in at blue light stations every 5 minutes
- **Location search** — Search by building name or address, with UMD-aware geocoding fallbacks

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Frontend | Vanilla JS + Leaflet.js |
| Routing | [Valhalla](https://valhalla.github.io/valhalla/) (OpenStreetMap) |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) |
| Data | Local JSON file (`data/pins.json`) |

## Getting Started

### Prerequisites

- Node.js 18+

### Install & Run

```bash
npm install
cp .env.example .env
npm start
```

Open [http://localhost:3000](http://localhost:3000).

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/route` | Get pedestrian routes between two coordinates |
| `GET` | `/api/geocode` | Search for a location by name |
| `GET` | `/api/pins` | List all community pins |
| `POST` | `/api/pins` | Create a new community pin |
| `PATCH` | `/api/pins/:id/vote` | Upvote a pin |
| `DELETE` | `/api/pins/:id` | Delete a pin |

### Route query params

```
GET /api/route?startLat=38.989&startLng=-76.945&endLat=38.983&endLng=-76.940
```

### Pin body (POST)

```json
{
  "lat": 38.989,
  "lng": -76.945,
  "type": "unsafe_area",
  "description": "Poorly lit at night"
}
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |

## Emergency Contacts

- **UMD Police:** (301) 405-4911
- **Emergency:** 911
