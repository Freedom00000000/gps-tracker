const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../mobile/client.js'), 'utf8');

test('sharing requires consent and sends accepted GPS readings to the same-page map', async () => {
  const elements = Object.fromEntries(['share-status', 'start', 'stop', 'share', 'share-consent', 'phone-device', 'phone-token'].map(id => [id, { value: '', checked: false, disabled: false, textContent: '' }]));
  elements['phone-device'].value = '+45 22 32 35 86';
  elements['phone-token'].value = ' device-key ';
  const requests = [], events = [], cleared = [];
  let success;
  const window = { isSecureContext: true, addEventListener() {}, dispatchEvent(event) { events.push(event); } };
  vm.runInNewContext(source, {
    document: { querySelector: selector => elements[selector.slice(1)] }, window,
    navigator: { geolocation: { watchPosition(callback) { success = callback; return 17; }, clearWatch(id) { cleared.push(id); } } },
    AbortController, Date, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true, status: 200, json: async () => ({ location: { device_name: '+4522323586', latitude: 0, longitude: 0, accuracy: 5, timestamp: '2026-01-01T00:00:00Z' } }) };
    },
  });
  assert.equal(requests.length, 0);
  await elements.share.onsubmit({ preventDefault() {} });
  assert.equal(requests.length, 0);
  elements['share-consent'].checked = true;
  await elements.share.onsubmit({ preventDefault() {} });
  assert.equal(requests[0].url, '/device-auth');
  assert.equal(requests[0].headers.Authorization, 'Bearer device-key');
  assert.equal(requests.length, 1); // No GPS sent just by logging in.
  await success({ coords: { latitude: 0, longitude: 0, accuracy: 5, altitude: null, speed: null } });
  assert.equal(requests[1].url, '/gps');
  assert.equal(events[0].type, 'gps-position');
  assert.equal(events[0].detail.latitude, 0);
  assert.match(elements['share-status'].textContent, /position vist på kortet/);
  elements.stop.onclick();
  assert.deepEqual(cleared, [17]);
  await success({ coords: { latitude: 1, longitude: 1 } });
  assert.equal(requests.length, 2); // Stale callbacks after Stop never transmit.
});
