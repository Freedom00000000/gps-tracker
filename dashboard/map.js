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
    const approximate = [...markers.values()].filter(item => !item.precise).length;
    status.textContent = markers.size
      ? `${markers.size} enhed(er) · seneste modtagne positioner. Klik på en markør for detaljer.`
      : 'Venter på positioner. Der vises ingen telefonplacering endnu.';
    if (approximate) status.textContent += ` ${approximate} upræcis(e) måling(er): området vises som en orange cirkel, ikke som en præcis telefonmarkør. Afventer bedre GPS.`;
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
        if (!names.has(name)) { if(item.marker)layer.removeLayer(item.marker); layer.removeLayer(item.circle); markers.delete(name); }
      }
      for (const point of items) {
        const latlng = [point.latitude, point.longitude];
        const precise = Number.isFinite(point.accuracy) && point.accuracy <= 1000;
        const text = document.createElement('span');
        text.textContent = `${point.device_name}\n${precise ? 'Rapporteret position' : 'UPRÆCIST OMRÅDE · centrum er ikke telefonens præcise placering'}\n${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}\nNøjagtighed: ${point.accuracy === null ? 'ukendt' : point.accuracy + ' m'}\nModtaget: ${new Date(point.timestamp).toLocaleString()}`;
        let item = markers.get(point.device_name);
        if (!item) {
          item = {
            marker: null,
            circle: L.circle(latlng, { radius: 0, weight: 1, fillOpacity: 0.12 }).addTo(layer),
          };
          markers.set(point.device_name, item);
        }
        item.precise = precise;
        if(precise){
          if(!item.marker)item.marker=L.marker(latlng,{title:point.device_name,alt:point.device_name}).addTo(layer);
          item.marker.setLatLng(latlng).bindPopup(text);
        }else if(item.marker){layer.removeLayer(item.marker);item.marker=null;}
        item.circle.setLatLng(latlng).setRadius(point.accuracy ?? 0).setStyle({color:precise?'#1389c9':'#f0a12b'}).bindPopup(text);
      }
      fitButton.disabled = !markers.size;
      if (!markers.size) { firstPosition = true; map.setView([56, 10], 6); }
      else if (firstPosition) { fit(); firstPosition = false; }
      mapStatus();
    },
    focus(name) {
      const item = markers.get(name);
      if (!item) return;
      if(item.marker){map.setView(item.marker.getLatLng(),16);item.marker.openPopup();}
      else{map.fitBounds(item.circle.getBounds(),{padding:[35,35],maxZoom:8});item.circle.openPopup();}
      document.querySelector('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };
})();
