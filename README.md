# GPS Tracker

Real-time GPS tracking system.

## Stack
- **Frontend**: React Native + @rnmapbox/maps
- **Backend**: Node.js + WebSocket (ws) + Express
- **Database**: MongoDB (2dsphere geospatial indexing)
- **Maps**: Mapbox GL

## Structure
```
gps-tracker/
├── server/          # Node.js + WebSocket backend
│   ├── src/
│   │   ├── index.js
│   │   ├── ws/
│   │   │   └── handler.js
│   │   ├── models/
│   │   │   └── Location.js
│   │   └── routes/
│   │       └── locations.js
│   ├── package.json
│   └── .env.example
├── mobile/          # React Native app
│   ├── src/
│   │   ├── App.js
│   │   ├── screens/
│   │   │   ├── MapScreen.js
│   │   │   └── DeviceListScreen.js
│   │   ├── services/
│   │   │   ├── websocket.js
│   │   │   └── gps.js
│   │   └── components/
│   │       └── TrackerMap.js
│   └── package.json
└── docker-compose.yml
```

## Quick Start
```bash
# Backend
cd server && npm install && npm run dev

# Mobile
cd mobile && npm install && npx react-native run-android
```
