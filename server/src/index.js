require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const mongoose = require('mongoose');
const { initWebSocket } = require('./ws/handler');
const locationRoutes = require('./routes/locations');

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());
app.use('/api/locations', locationRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gps_tracker';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[DB] MongoDB connected');
    initWebSocket(httpServer);
    httpServer.listen(PORT, () => {
      console.log(`[SERVER] HTTP + WebSocket listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  });
