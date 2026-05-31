const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ── DB ──────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gps-tracker')
  .then(() => console.log('[DB] Connected to MongoDB'))
  .catch(err => console.error('[DB] Error:', err));

const LocationSchema = new mongoose.Schema({
  deviceId:  { type: String, required: true, index: true },
  latitude:  { type: Number, required: true },
  longitude: { type: Number, required: true },
  altitude:  Number,
  accuracy:  Number,
  speed:     Number,
  heading:   Number,
  timestamp: { type: Date, default: Date.now },
});
const Location = mongoose.model('Location', LocationSchema);

// ── REST ─────────────────────────────────────────────
// POST /location — receive GPS ping from device
app.post('/location', async (req, res) => {
  try {
    const loc = await Location.create(req.body);
    // Broadcast to all connected dashboard clients
    broadcast({ type: 'location', data: loc });
    res.json({ ok: true, id: loc._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /locations/:deviceId — last 200 points for a device
app.get('/locations/:deviceId', async (req, res) => {
  const points = await Location.find({ deviceId: req.params.deviceId })
    .sort({ timestamp: -1 }).limit(200).lean();
  res.json(points);
});

// GET /devices — list unique active devices (last 24h)
app.get('/devices', async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const devices = await Location.distinct('deviceId', { timestamp: { $gte: since } });
  res.json(devices);
});

// DELETE /locations/:deviceId — wipe history
app.delete('/locations/:deviceId', async (req, res) => {
  await Location.deleteMany({ deviceId: req.params.deviceId });
  res.json({ ok: true });
});

// ── WebSocket ─────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  console.log('[WS] Client connected. Total:', clients.size);
  ws.on('close', () => { clients.delete(ws); });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
