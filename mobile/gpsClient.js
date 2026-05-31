/**
 * GPS Tracker — Mobile Client
 * Polls device GPS and sends location pings to the server
 * Works in React Native or plain browser context
 * Built by Mia
 */

const SERVER_URL = process.env.GPS_SERVER_URL || 'http://localhost:3001';
const DEVICE_NAME = process.env.DEVICE_NAME || 'mobile-device-1';
const PING_INTERVAL_MS = 5000; // 5 seconds

let watchId = null;
let intervalId = null;
let lastPosition = null;

/**
 * Start broadcasting GPS location to server
 */
export function startTracking(deviceName = DEVICE_NAME, serverUrl = SERVER_URL) {
  if (!navigator.geolocation) {
    console.error('[GPS Client] Geolocation not supported');
    return;
  }

  console.log(`[GPS Client] Starting tracking for device: ${deviceName}`);

  // Watch position continuously
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      lastPosition = {
        device_name: deviceName,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        speed: position.coords.speed,
      };
    },
    (err) => {
      console.error('[GPS Client] Geolocation error:', err.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    }
  );

  // Ping server on interval
  intervalId = setInterval(async () => {
    if (!lastPosition) return;

    try {
      const res = await fetch(`${serverUrl}/gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lastPosition),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('[GPS Client] Server error:', err);
      } else {
        console.log(`[GPS Client] Pinged server @ ${lastPosition.latitude}, ${lastPosition.longitude}`);
      }
    } catch (e) {
      console.error('[GPS Client] Network error:', e.message);
    }
  }, PING_INTERVAL_MS);
}

/**
 * Stop broadcasting
 */
export function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  lastPosition = null;
  console.log('[GPS Client] Tracking stopped');
}

/**
 * Get last known position
 */
export function getLastPosition() {
  return lastPosition;
}
