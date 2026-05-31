import { useState, useEffect, useCallback } from 'react';
import { GpsLocation } from '../api/entities';
import DeviceList from '../components/DeviceList';
import MapView from '../components/MapView';
import LiveFeed from '../components/LiveFeed';

// Poll interval in ms — configurable, default 5s
const DEFAULT_POLL_INTERVAL = 5000;

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await GpsLocation.list('-created_date', 500);
      setLocations(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError('Failed to fetch location data.');
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, pollInterval);
    return () => clearInterval(interval);
  }, [fetchLocations, pollInterval]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-950 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-lg font-bold tracking-tight">⌖ GPS Tracker</span>
          {lastUpdated && (
            <span className="text-gray-500 text-xs">
              Last sync: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {error && <span className="text-red-400 text-xs">{error}</span>}
        </div>

        {/* Poll interval control */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Poll:</span>
          {[2000, 5000, 10000, 30000].map((ms) => (
            <button
              key={ms}
              onClick={() => setPollInterval(ms)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                pollInterval === ms
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {ms / 1000}s
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — DeviceList */}
        <DeviceList
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
          pollInterval={pollInterval}
        />

        {/* Map + LiveFeed column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <MapView
            locations={locations}
            selectedDevice={selectedDevice}
            onSelectDevice={setSelectedDevice}
          />
          <LiveFeed
            readings={locations}
            selectedDevice={selectedDevice}
            maxRows={20}
          />
        </div>
      </div>
    </div>
  );
}
