import { useEffect, useRef } from 'react';

// Lightweight map using OpenStreetMap + Leaflet (CDN loaded)
// No API key required.

export default function MapView({ locations, selectedDevice, onSelectDevice }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef({});

  // Bootstrap Leaflet from CDN once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeaflet = async () => {
      if (!window.L) {
        // Inject CSS
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }
        // Inject JS
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      if (!leafletMap.current && mapRef.current) {
        leafletMap.current = window.L.map(mapRef.current).setView([0, 0], 2);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(leafletMap.current);
      }
    };

    loadLeaflet();
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Update markers whenever locations change
  useEffect(() => {
    if (!leafletMap.current || !window.L) return;

    // Deduplicate — latest per device
    const deviceMap = {};
    for (const loc of locations) {
      if (!deviceMap[loc.device_name]) deviceMap[loc.device_name] = loc;
    }

    const deviceNames = Object.keys(deviceMap);

    // Remove stale markers
    for (const name of Object.keys(markersRef.current)) {
      if (!deviceMap[name]) {
        markersRef.current[name].remove();
        delete markersRef.current[name];
      }
    }

    // Add/update markers
    for (const [name, loc] of Object.entries(deviceMap)) {
      const isSelected = name === selectedDevice;
      const color = isSelected ? '#3b82f6' : '#6b7280';
      const icon = window.L.divIcon({
        className: '',
        html: `<div style="
          width:14px;height:14px;
          background:${color};
          border:2px solid white;
          border-radius:50%;
          box-shadow:0 0 6px ${color};
          cursor:pointer;
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      if (markersRef.current[name]) {
        markersRef.current[name]
          .setLatLng([loc.latitude, loc.longitude])
          .setIcon(icon);
      } else {
        const marker = window.L.marker([loc.latitude, loc.longitude], { icon })
          .addTo(leafletMap.current)
          .bindTooltip(name, { permanent: false, direction: 'top' })
          .on('click', () => onSelectDevice(name));
        markersRef.current[name] = marker;
      }
    }

    // Pan to selected device
    if (selectedDevice && deviceMap[selectedDevice]) {
      const loc = deviceMap[selectedDevice];
      leafletMap.current.setView([loc.latitude, loc.longitude], 14, { animate: true });
    } else if (deviceNames.length > 0) {
      const bounds = deviceNames.map((n) => [
        deviceMap[n].latitude,
        deviceMap[n].longitude,
      ]);
      leafletMap.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [locations, selectedDevice]);

  return (
    <div className="flex-1 relative">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      {locations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
          <span className="text-gray-400 text-sm">No location data yet. Waiting for devices...</span>
        </div>
      )}
    </div>
  );
}
