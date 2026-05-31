require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const { Server } = require('socket.io');
const { pool }   = require('./db/pool');
const locationRoutes = require('./routes/locations');
const geofenceRoutes = require('./routes/geofences');
const alertRoutes    = require('./routes/alerts');
const ingestRoutes   = require('./routes/ingest');
const { initSocket } = require('./socket/handler');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use((req, _res, next) => { req.io = io; next(); });

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

app.use('/api/locations', locationRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/ingest',    ingestRoutes);

initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[SERVER] Listening on :${PORT}`));
