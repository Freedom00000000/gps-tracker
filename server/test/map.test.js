const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('coarse estimates render an uncertainty area, never a precise phone pin', () => {
  const state = { pins: 0, radius: 0, fit: 0 };
  const elements = { '#map-status': {}, '#fit-map': {}, '#map': { scrollIntoView() {} } };
  const shape = () => ({ addTo() { return this; }, setLatLng() { return this; }, bindPopup() { return this; }, setRadius(r) { state.radius = r; return this; }, setStyle() { return this; }, getBounds() { return {}; }, openPopup() {}, getLatLng() { return [0, 0]; } });
  const map = { setView() { return this; }, fitBounds() { state.fit++; } };
  const group = { addTo() { return this; }, removeLayer() {}, getBounds() { return {}; } };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../dashboard/map.js'), 'utf8'), {
    window, document: { querySelector: s => elements[s], createElement: () => ({}) },
    L: { map: () => map, featureGroup: () => group, tileLayer: () => ({ addTo() { return this; }, on() {} }), marker: () => { state.pins++; return shape(); }, circle: shape },
  });
  const point = { device_name: 'test', latitude: 56, longitude: 10, accuracy: 100000, timestamp: '2026-01-01T00:00:00Z' };
  window.gpsMap.update([point]);
  assert.equal(state.pins, 0);
  assert.equal(state.radius, 100000);
  assert.match(elements['#map-status'].textContent, /ikke som en præcis telefonmarkør/);
  window.gpsMap.focus('test');
  assert.equal(state.fit, 2);
  window.gpsMap.update([{ ...point, accuracy: 10 }]);
  assert.equal(state.pins, 1);
  assert.equal(state.radius, 10);
  window.gpsMap.update([]);
  assert.equal(elements['#fit-map'].disabled, true);
});
