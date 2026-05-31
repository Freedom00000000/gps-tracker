/**
 * GPS Tracker — Server Entry Point
 * Built by Mia | WebSocket real-time broadcast + REST receiver
 * Wired to gpsReceiver Base44 function for persistence
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// In-memory store: latest location per device
const deviceLocations = {};

/**
 * POST /gps
 * Receives GPS ping from mobile client
 * Body: { device_name, latitude, longitude, accuracy?, altitude?, speed? }
 */
app.post('/gps', (req, res) => {
  const { device_name, latitude, longitude, accuracy, altitude, speed } = req.body;

  if (!device_name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: device_name, latitude, longitude'
    });
  }

  const location = {
    device_name,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    altitude: altitude ?? null,
    speed: speed ?? null,
    timestamp: new Date().toISOString()
  };

  // Update in-memory store
  deviceLocations[device_name] = location;

  // Broadcast to all dashboard clients
  io.emit('location_update', location);

  console.log(`[GPS] ${device_name} @ ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
  res.json({ ok: true, location });
});

/**
 * GET /locations
 * Returns latest known location for all devices
 */
app.get('/locations', (_req, res) => {
  res.json({ devices: Object.values(deviceLocations) });
});

/**
 * GET /health
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    devices: Object.keys(deviceLocations).length,
    uptime: process.uptime()
  });
});

// WebSocket
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  // Send current snapshot immediately
  socket.emit('snapshot', Object.values(deviceLocations));

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n[GPS Server] ▶ Running on port ${PORT}`);
  console.log(`[GPS Server] POST /gps      — receive location ping`);
  console.log(`[GPS Server] GET  /locations — list all device locations`);
  console.log(`[GPS Server] GET  /health    — server health check\n`);
});
