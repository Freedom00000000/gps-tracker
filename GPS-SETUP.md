# GPS integration: current runnable version

Browser location estimates with unknown accuracy or uncertainty greater than
1 km are now rejected. The phone waits for a better estimate, and a rejected
reading never replaces an accepted reading. Older coarse readings show an orange
uncertainty area without a precise phone pin. High-accuracy mode cannot force a
GPS fix; on iPhone, use Safari and enable Precise Location.

The supported standalone path is `server/index.js`, `dashboard/index.html` and
`mobile/client.js`. The older Base44 React files are a separate prototype: this
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
GPS sharing and the map now share the same page at `/`; `/phone` redirects there
for compatibility. A device token can send and view that phone's own new reading
without administrator access. Expand the Administrator section to view all devices
on the same map with an administrator token. Stopping sharing and disconnecting
the administrator view are separate actions.
The dashboard includes an interactive Leaflet map with an OpenStreetMap
background, one marker per device and a reported-accuracy circle. Select a marker
or use "Vis på kort" in the table. "Vis alle enheder" fits the map to all readings.
Map tiles require Internet access and are requested from OpenStreetMap; Leaflet
code is served locally. No fabricated phone position appears when there is no GPS.
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
