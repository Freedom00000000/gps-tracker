const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const Location = require('../models/Location');

// Connected clients map: device_id -> Set<ws>
const clients = new Map();

/**
 * WebSocket Event Spec
 * ====================
 * CLIENT -> SERVER:
 *   { type: 'REGISTER',  payload: { device_id, user_id, session_id } }
 *   { type: 'LOCATION',  payload: { device_id, user_id, session_id, coordinates: { lat, lng }, altitude, accuracy, timestamp } }
 *   { type: 'PING',      payload: {} }
 *   { type: 'LEAVE',     payload: { device_id, session_id } }
 *
 * SERVER -> CLIENT:
 *   { type: 'REGISTERED', payload: { device_id, session_id, ts } }
 *   { type: 'LOCATION',   payload: { ...locationDoc } }  <- broadcast to all watchers of device_id
 *   { type: 'PONG',       payload: { ts } }
 *   { type: 'ERROR',      payload: { message } }
 */

function initWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    ws._clientId = clientId;
    ws._deviceId = null;
    console.log(`[WS] Client connected: ${clientId}`);

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return send(ws, { type: 'ERROR', payload: { message: 'Invalid JSON' } });
      }

      const { type, payload = {} } = msg;

      switch (type) {
        case 'REGISTER': {
          const { device_id, user_id, session_id } = payload;
          if (!device_id) return send(ws, { type: 'ERROR', payload: { message: 'device_id required' } });
          ws._deviceId = device_id;
          if (!clients.has(device_id)) clients.set(device_id, new Set());
          clients.get(device_id).add(ws);
          send(ws, { type: 'REGISTERED', payload: { device_id, session_id, ts: new Date() } });
          console.log(`[WS] Registered device: ${device_id}`);
          break;
        }

        case 'LOCATION': {
          const { device_id, user_id, session_id, coordinates, altitude, accuracy, timestamp } = payload;
          if (!device_id || !coordinates?.lat || !coordinates?.lng) {
            return send(ws, { type: 'ERROR', payload: { message: 'device_id + coordinates.lat/lng required' } });
          }
          const doc = await Location.create({ device_id, user_id, session_id, coordinates, altitude, accuracy, timestamp: timestamp || new Date() });
          broadcast(device_id, { type: 'LOCATION', payload: doc.toObject() });
          break;
        }

        case 'PING':
          send(ws, { type: 'PONG', payload: { ts: new Date() } });
          break;

        case 'LEAVE':
          cleanup(ws);
          break;

        default:
          send(ws, { type: 'ERROR', payload: { message: `Unknown event: ${type}` } });
      }
    });

    ws.on('close', () => { console.log(`[WS] Disconnected: ${clientId}`); cleanup(ws); });
    ws.on('error', (err) => console.error(`[WS] Error ${clientId}:`, err.message));
  });

  console.log('[WS] WebSocket server on /ws');
  return wss;
}

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

function broadcast(device_id, msg) {
  const sockets = clients.get(device_id);
  if (!sockets) return;
  const payload = JSON.stringify(msg);
  for (const ws of sockets) if (ws.readyState === 1) ws.send(payload);
}

function cleanup(ws) {
  if (ws._deviceId) {
    const s = clients.get(ws._deviceId);
    if (s) { s.delete(ws); if (s.size === 0) clients.delete(ws._deviceId); }
  }
}

module.exports = { initWebSocket, broadcast };
