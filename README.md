# ✴ GPS Tracker

Real-time GPS tracking dashboard built on the JARVIS/Mia stack.

## Stack
- **Frontend**: React + Tailwind + Leaflet (OpenStreetMap, no API key)
- **Backend**: Base44 serverless (`gpsReceiver` function)
- **Entity**: `GpsLocation` — stores pings from any device
- **Dedup**: `dedup-middleware` v1.2 — dual-gate cooldown + sig-hash

## Architecture

```
Mobile/IoT Device
  └── POST /api/functions/gpsReceiver
        { device_name, latitude, longitude, accuracy?, altitude?, speed? }
          ↓
      GpsLocation entity (Base44 DB)
          ↓
      Dashboard.jsx polls every N seconds
          ↓
      DeviceList | MapView | LiveFeed
```

## Sending GPS Pings

### curl
```bash
curl -X POST https://your-app.base44.app/api/functions/gpsReceiver \
  -H 'Content-Type: application/json' \
  -d '{"device_name":"my-phone","latitude":51.5074,"longitude":-0.1278,"accuracy":5,"speed":1.2}'
```

### JavaScript
```js
import { sendGpsPing } from './src/api/gpsReceiver';
await sendGpsPing({ device_name: 'my-phone', latitude: 51.5074, longitude: -0.1278 });
```

### Android (Kotlin)
```kotlin
val payload = JSONObject().apply {
  put("device_name", Build.MODEL)
  put("latitude", location.latitude)
  put("longitude", location.longitude)
  put("accuracy", location.accuracy.toDouble())
  put("speed", location.speed.toDouble())
  put("altitude", location.altitude)
}
OkHttpClient().newCall(Request.Builder()
  .url("https://your-app.base44.app/api/functions/gpsReceiver")
  .post(payload.toString().toRequestBody("application/json".toMediaType()))
  .build()).execute()
```

### iOS (Swift)
```swift
var req = URLRequest(url: URL(string: "https://your-app.base44.app/api/functions/gpsReceiver")!)
req.httpMethod = "POST"
req.setValue("application/json", forHTTPHeaderField: "Content-Type")
let body: [String: Any] = [
  "device_name": UIDevice.current.name,
  "latitude": location.coordinate.latitude,
  "longitude": location.coordinate.longitude,
  "accuracy": location.horizontalAccuracy,
  "speed": location.speed,
  "altitude": location.altitude
]
req.httpBody = try? JSONSerialization.data(withJSONObject: body)
URLSession.shared.dataTask(with: req).resume()
```

## Dashboard Features
- 🟢 Live device status dots (green <15s, yellow <60s, red = stale)
- 🗺️ Interactive map with click-to-select device pins (Leaflet + OSM)
- 📊 LiveFeed table: speed (km/h), altitude, accuracy, timestamp
- ⏱️ Configurable poll interval: 2s / 5s / 10s / 30s
- 🔗 Link Agents button wired with `shouldFire()` dedup middleware v1.2

## Key Files
```
src/
  lib/dedup-middleware.js   # Cooldown v1.2 — 250ms + 60s sig-hash gates
  api/entities.js           # GpsLocation entity client
  api/gpsReceiver.js        # GPS ping + fetch helpers
  pages/Dashboard.jsx       # Main dashboard + Link Agents wire-in
  components/DeviceList.jsx # Sidebar: devices + status dots
  components/MapView.jsx    # Leaflet map with live markers
  components/LiveFeed.jsx   # Scrollable readings table
```

## Built by
J.A.R.V.I.S. x Mia — autonomous build session, 31 May 2026
