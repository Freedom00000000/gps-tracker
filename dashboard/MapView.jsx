/**
 * GPS Tracker — Dashboard MapView
 * Real-time device location display via WebSocket
 * Built by Mia
 */

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.REACT_APP_GPS_SERVER || 'http://localhost:3001';

export default function MapView() {
  const [devices, setDevices] = useState({});
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('[MapView] Connected to GPS server');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Full snapshot on first connect
    socket.on('snapshot', (locations) => {
      const map = {};
      locations.forEach(loc => { map[loc.device_name] = loc; });
      setDevices(map);
    });

    // Incremental updates
    socket.on('location_update', (loc) => {
      setDevices(prev => ({ ...prev, [loc.device_name]: loc }));
      setLastUpdate(new Date().toLocaleTimeString());
    });

    return () => socket.disconnect();
  }, []);

  const deviceList = Object.values(devices);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GPS Tracker</h1>
          <p className="text-gray-400 text-sm">Live device locations</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Device Cards */}
      {deviceList.length === 0 ? (
        <div className="text-center text-gray-500 mt-20">
          <p className="text-lg">No devices broadcasting</p>
          <p className="text-sm mt-1">Waiting for GPS pings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deviceList.map(device => (
            <DeviceCard key={device.device_name} device={device} />
          ))}
        </div>
      )}

      {lastUpdate && (
        <p className="mt-6 text-xs text-gray-600">Last update: {lastUpdate}</p>
      )}
    </div>
  );
}

function DeviceCard({ device }) {
  const mapsUrl = `https://www.google.com/maps?q=${device.latitude},${device.longitude}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-500 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">{device.device_name}</h3>
        <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">Active</span>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Lat</span>
          <span className="text-gray-200 font-mono">{device.latitude.toFixed(6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Lng</span>
          <span className="text-gray-200 font-mono">{device.longitude.toFixed(6)}</span>
        </div>
        {device.accuracy && (
          <div className="flex justify-between">
            <span className="text-gray-500">Accuracy</span>
            <span className="text-gray-200">{device.accuracy}m</span>
          </div>
        )}
        {device.speed && (
          <div className="flex justify-between">
            <span className="text-gray-500">Speed</span>
            <span className="text-gray-200">{(device.speed * 3.6).toFixed(1)} km/h</span>
          </div>
        )}
        {device.altitude && (
          <div className="flex justify-between">
            <span className="text-gray-500">Altitude</span>
            <span className="text-gray-200">{device.altitude}m</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between items-center">
        <span className="text-xs text-gray-600">
          {device.timestamp ? new Date(device.timestamp).toLocaleTimeString() : 'N/A'}
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Open in Maps →
        </a>
      </div>
    </div>
  );
}
