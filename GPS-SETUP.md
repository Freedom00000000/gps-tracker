# GPS integration: current runnable version

The supported standalone path is `server/index.js`, `dashboard/index.html` and
`mobile/index.html`. The older Base44 React files are a separate prototype: this
repository has no deployed Base44 app ID or `gpsReceiver` implementation.
The available Base44 app TelenorTrack has different entities and was not modified.

## Start locally

Requires Node 18+ (Node 24 recommended). Run `npm install` in `server`.
For automatic local setup, run `npm run start:local` in `server`. This generates
an administrator token and a token for `phone-1` in `.local/gps-config.json`,
which is ignored by Git. Enter the administrator token in the dashboard and
use the separate phone token on the phone page. Do not share the config file.
No credentials are printed in logs. The generated file persists across restarts.

For externally managed configuration instead:
Set `GPS_ADMIN_TOKEN` to a random secret of at least 32 characters.
Set `GPS_DEVICE_TOKENS` to a JSON object mapping anonymous device codes to
different random secrets of at least 32 characters. Example structure is in
`server/.env.example`; its placeholder values must be replaced. Secrets must
not be committed. Run `npm start` in `server`. Environment variables must be
supplied by your launcher: copying an .env file alone does not load it.

Open `http://127.0.0.1:3001` and enter the administrator token. The list is empty
until an enrolled device sends a genuine GPS reading. The phone page is `/phone`.
Enter that device's code and token, check the sharing consent box, press Start,
and grant the operating system's location permission. Stop ends new updates.
No phone number, identity lookup, Google/Apple credentials or health data is used.

## Real phones and hosting

The server binds to loopback only. To use an iPhone or Android on a different
device, deploy behind a trusted HTTPS reverse proxy forwarding HTTP and Socket.IO.
No public deployment is included. The dashboard and phone page use same-origin
requests; no permissive cross-origin access is enabled. Use strong per-device
tokens, restrict access to your own authorized devices and keep the server private.
For an installed-app experience, the page can be added to the home screen.
Browser background execution is not guaranteed; this is not a native background app.

Only the latest GPS point per device is kept in memory, with the server receipt
timestamp and accuracy. Restarting clears all points. An old timestamp is not a
live position. The admin can clear a point with authenticated
`DELETE /locations/<device_code>`. Remove a device token from configuration and
restart to revoke its access. Previously received points are cleared on restart.

Tests: `npm test` in `server`. They use synthetic coordinates, not a real person's
location. No real phone has been enrolled or located as part of these tests.
