(() => {
  const status = document.querySelector('#map-status');
  const fitButton = document.querySelector('#fit-map');
  const markers = new Map();
  let firstPosition = true;
  let tilesFailed = false;
  if (typeof L === 'undefined') {
    status.textContent = 'Kortet kunne ikke indlæses. Koordinaterne vises stadig i tabellen.';
    window.gpsMap = { available: false, update() {}, focus() {} };
    return;
  }
  const map = L.map('map').setView([56, 10], 6);
  const layer = L.featureGroup().addTo(map);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    referrerPolicy: 'strict-origin-when-cross-origin',
  }).addTo(map);
  function mapStatus() {
    status.textContent = markers.size
      ? `${markers.size} enhed(er) · seneste modtagne positioner. Klik på en markør for detaljer.`
      : 'Venter på positioner. Der vises ingen telefonplacering endnu.';
    if (tilesFailed) status.textContent += ' Kortbaggrunden kunne ikke indlæses; GPS-markører og koordinater er stadig tilgængelige.';
  }
  tiles.on('tileerror', () => { tilesFailed = true; mapStatus(); });
  function fit() {
    if (markers.size) map.fitBounds(layer.getBounds(), { padding: [35, 35], maxZoom: 16 });
  }
  fitButton.onclick = fit;
  window.gpsMap = {
    available: true,
    update(items) {
      const names = new Set(items.map(p => p.device_name));
      for (const [name, item] of markers) {
        if (!names.has(name)) { layer.removeLayer(item.marker); layer.removeLayer(item.circle); markers.delete(name); }
      }
      for (const point of items) {
        const latlng = [point.latitude, point.longitude];
        const text = document.createElement('span');
        text.textContent = `${point.device_name}\n${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}\nNøjagtighed: ${point.accuracy === null ? 'ukendt' : point.accuracy + ' m'}\nModtaget: ${new Date(point.timestamp).toLocaleString()}`;
        let item = markers.get(point.device_name);
        if (!item) {
          item = {
            marker: L.marker(latlng, { title: point.device_name, alt: point.device_name }).addTo(layer),
            circle: L.circle(latlng, { radius: 0, color: '#1389c9', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(layer),
          };
          markers.set(point.device_name, item);
        }
        item.marker.setLatLng(latlng).bindPopup(text);
        item.circle.setLatLng(latlng).setRadius(point.accuracy ?? 0);
      }
      fitButton.disabled = !markers.size;
      if (!markers.size) { firstPosition = true; map.setView([56, 10], 6); }
      else if (firstPosition) { fit(); firstPosition = false; }
      mapStatus();
    },
    focus(name) {
      const item = markers.get(name);
      if (!item) return;
      map.setView(item.marker.getLatLng(), 16);
      item.marker.openPopup();
      document.querySelector('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };
})();
