// Generate credentials locally without printing them or committing them.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createTracker } = require('./index');
const directory = path.resolve(__dirname, '../.local');
const file = path.join(directory, 'gps-config.json');
fs.mkdirSync(directory, { recursive: true });
if (!fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify({
    adminToken: crypto.randomBytes(32).toString('base64url'),
    devices: { 'phone-1': crypto.randomBytes(32).toString('base64url') },
  }, null, 2), { flag: 'wx', mode: 0o600 });
}
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const { server } = createTracker(config);
server.listen(process.env.PORT || 3001, '127.0.0.1', () => {
  console.log('GPS Tracker started locally: http://127.0.0.1:' + server.address().port);
  console.log('Credentials are in .local/gps-config.json; never upload or share this file.');
});
