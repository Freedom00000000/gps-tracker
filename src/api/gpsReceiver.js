/**
 * gpsReceiver.js — Client-side helper for GPS data submission.
 * Wraps the gpsReceiver serverless function.
 *
 * Usage (from a mobile client or IoT device):
 *   import { sendGpsPing } from './gpsReceiver';
 *   await sendGpsPing({ device_name: 'my-phone', latitude: 51.5, longitude: -0.1 });
 */

const GPS_FUNCTION_URL = '/api/functions/gpsReceiver';

/**
 * Send a GPS ping to the receiver.
 * @param {{ device_name: string, latitude: number, longitude: number, accuracy?: number, altitude?: number, speed?: number }} payload
 */
export async function sendGpsPing(payload) {
  const res = await fetch(GPS_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `GPS ping failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch all GPS locations from the receiver.
 */
export async function fetchGpsLocations() {
  const res = await fetch(GPS_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' }),
  });
  if (!res.ok) throw new Error(`Failed to fetch locations: ${res.status}`);
  const data = await res.json();
  return data.locations || [];
}
