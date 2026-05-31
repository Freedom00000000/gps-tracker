/**
 * Socket.io Event Spec
 * ====================
 * CLIENT -> SERVER (emit):
 *   'register'   { device_id, user_id, session_id }
 *   'location'   { device_id, user_id, session_id, lat, lng, altitude, accuracy, speed, heading, timestamp }
 *   'watch'      { device_id }   <- viewer subscribes to a device's location stream
 *   'unwatch'    { device_id }
 *   'ping'       {}
 *
 * SERVER -> CLIENT (emit):
 *   'registered' { device_id, session_id, ts }
 *   'location'   { ...locationRow }             <- broadcast to room `device:{device_id}`
 *   'alert'      { ...alertRow }                <- broadcast on geofence trigger
 *   'pong'       { ts }
 *   'error'      { message }
 */

const { pool } = require('../db/pool');

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[IO] Connected: ${socket.id}`);

    socket.on('register', ({ device_id, user_id, session_id }) => {
      if (!device_id) return socket.emit('error', { message: 'device_id required' });
      socket.data.device_id = device_id;
      socket.join(`device:${device_id}`);
      socket.emit('registered', { device_id, session_id, ts: new Date() });
      console.log(`[IO] Device registered: ${device_id}`);
    });

    socket.on('watch', ({ device_id }) => {
      if (!device_id) return socket.emit('error', { message: 'device_id required' });
      socket.join(`device:${device_id}`);
      console.log(`[IO] ${socket.id} watching device: ${device_id}`);
    });

    socket.on('unwatch', ({ device_id }) => {
      socket.leave(`device:${device_id}`);
    });

    socket.on('location', async (payload) => {
      const { device_id, user_id, session_id, lat, lng, altitude, accuracy, speed, heading, timestamp } = payload;
      if (!device_id || lat == null || lng == null) {
        return socket.emit('error', { message: 'device_id, lat, lng required' });
      }

      try {
        // Insert location — PostGIS point is (lng, lat)
        const { rows } = await pool.query(
          `INSERT INTO locations
             (device_id, user_id, session_id, geom, altitude, accuracy, speed, heading, raw_payload, timestamp)
           VALUES
             ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326), $6, $7, $8, $9, $10, COALESCE($11, NOW()))
           RETURNING id, device_id, user_id, session_id,
                     ST_X(geom) AS lng, ST_Y(geom) AS lat,
                     altitude, accuracy, speed, heading, timestamp`,
          [device_id, user_id, session_id, lat, lng, altitude, accuracy, speed, heading,
           JSON.stringify(payload), timestamp || null]
        );

        const locationRow = rows[0];

        // Broadcast to all watchers of this device
        io.to(`device:${device_id}`).emit('location', locationRow);

        // Check geofence transitions
        const { rows: transitions } = await pool.query(
          'SELECT * FROM check_geofence_transitions($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326))',
          [device_id, locationRow.id, lat, lng]
        );

        for (const t of transitions) {
          const { rows: alertRows } = await pool.query(
            `INSERT INTO alerts (device_id, geofence_id, location_id, type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [device_id, t.geofence_id, locationRow.id, t.alert_type]
          );
          // Broadcast alert to device room
          io.to(`device:${device_id}`).emit('alert', alertRows[0]);
          console.log(`[GEOFENCE] ${t.alert_type} alert → device ${device_id}, fence ${t.geofence_id}`);
        }

      } catch (err) {
        console.error('[IO] location error:', err.message);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('ping', () => socket.emit('pong', { ts: new Date() }));

    socket.on('disconnect', () => {
      console.log(`[IO] Disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };
