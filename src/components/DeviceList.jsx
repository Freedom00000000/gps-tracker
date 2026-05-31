import { useState, useEffect } from 'react';
import { GpsLocation } from '../api/entities';

const STATUS_DOT = (lastSeen) => {
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 15000) return 'bg-green-400';
  if (diff < 60000) return 'bg-yellow-400';
  return 'bg-red-400';
};

export default function DeviceList({ selectedDevice, onSelectDevice, pollInterval = 5000 }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    try {
      const locations = await GpsLocation.list('-created_date', 200);
      // Deduplicate — keep latest reading per device
      const map = {};
      for (const loc of locations) {
        if (!map[loc.device_name]) map[loc.device_name] = loc;
      }
      setDevices(Object.values(map));
    } catch (e) {
      console.error('DeviceList fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  if (loading) {
    return (
      <div className="w-64 bg-gray-900 border-r border-gray-700 p-4 flex items-center justify-center">
        <span className="text-gray-400 text-sm animate-pulse">Scanning devices...</span>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Devices</h2>
        <span className="text-gray-400 text-xs">{devices.length} tracked</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {devices.length === 0 && (
          <div className="p-4 text-gray-500 text-sm">No devices reporting.</div>
        )}
        {devices.map((device) => (
          <button
            key={device.device_name}
            onClick={() => onSelectDevice(device.device_name)}
            className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
              selectedDevice === device.device_name ? 'bg-gray-800 border-l-2 border-l-blue-400' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT(device.created_date)}`} />
              <span className="text-white text-sm font-medium truncate">{device.device_name}</span>
            </div>
            <div className="text-gray-400 text-xs">
              {device.latitude?.toFixed(5)}, {device.longitude?.toFixed(5)}
            </div>
            {device.speed != null && (
              <div className="text-gray-500 text-xs mt-1">
                {(device.speed * 3.6).toFixed(1)} km/h
              </div>
            )}
            <div className="text-gray-600 text-xs mt-1">
              {new Date(device.created_date).toLocaleTimeString()}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
