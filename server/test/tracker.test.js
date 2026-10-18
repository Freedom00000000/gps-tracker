const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTracker } = require('../index');

test('device isolation, private reads, validation and location deletion', async () => {
  const adminToken = 'a'.repeat(40), phone1 = 'b'.repeat(40), phone2 = 'c'.repeat(40);
  const { server, io } = createTracker({ adminToken, devices: { phone1, phone2, '+4522323586': 'd'.repeat(40) } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (route, token, method = 'GET', body) => fetch(base + route, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    assert.equal((await call('/locations')).status, 401);
    assert.equal((await call('/locations', phone1)).status, 401);
    assert.equal((await call('/device-auth', phone1, 'POST', {device_name:'phone1'})).status, 200);
    assert.equal((await call('/device-auth', phone2, 'POST', {device_name:'phone1'})).status, 401);
    assert.equal((await call('/device-auth', 'd'.repeat(40), 'POST', {device_name:' +45 22 32 35 86 '})).status, 200);
    assert.deepEqual((await (await call('/locations', adminToken)).json()).devices, []);
    const point = { device_name: 'phone1', latitude: 0, longitude: 0, accuracy: 5 };
    assert.equal((await call('/gps', phone2, 'POST', point)).status, 401);
    assert.equal((await call('/gps', adminToken, 'POST', point)).status, 401);
    assert.equal((await call('/gps', phone1, 'POST', { ...point, latitude: 91 })).status, 400);
    assert.equal((await call('/gps', phone1, 'POST', { ...point, latitude: '55' })).status, 400);
    assert.equal((await call('/gps', phone1, 'POST', { ...point, accuracy: 100000 })).status, 422);
    assert.equal((await call('/gps', phone1, 'POST', { ...point, accuracy: null })).status, 422);
    assert.equal((await call('/gps', phone1, 'POST', point)).status, 200);
    const saved = await (await call('/locations', adminToken)).json();
    assert.equal(saved.devices.length, 1);
    assert.equal(saved.devices[0].latitude, 0);
    assert.equal((await call('/gps', phone1, 'POST', { ...point, latitude: 56, accuracy: 100000 })).status, 422);
    assert.equal((await (await call('/locations', adminToken)).json()).devices[0].latitude, 0);
    assert.equal(JSON.stringify(saved).includes(phone1), false);
    assert.equal((await call('/locations/phone1', phone1, 'DELETE')).status, 401);
    assert.equal((await call('/locations/phone1', adminToken, 'DELETE')).status, 200);
    assert.deepEqual((await (await call('/locations', adminToken)).json()).devices, []);
    const phonePage = await (await fetch(base + '/phone')).text();
    assert.match(phonePage, /Stop GPS-deling/);
    assert.match(phonePage, /type="checkbox" required/);
    assert.equal(phonePage.includes(phone1), false);
  } finally {
    await new Promise(resolve => io.close(resolve));
  }
});

test('unsafe token configurations fail before listening', () => {
  assert.throws(() => createTracker({ adminToken: 'short' }));
  assert.throws(() => createTracker({ adminToken: 'a'.repeat(40), devices: { phone1: 'a'.repeat(40) } }));
  assert.throws(() => createTracker({ adminToken: 'a'.repeat(40), devices: { phone1: 'b'.repeat(40), phone2: 'b'.repeat(40) } }));
});
