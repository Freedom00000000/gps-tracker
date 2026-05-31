import { useState, useEffect, useCallback } from 'react';
import { GpsLocation } from '../api/entities';
import DeviceList from '../components/DeviceList';
import MapView from '../components/MapView';
import LiveFeed from '../components/LiveFeed';
import { shouldFire } from '@/lib/dedup-middleware';

// Poll interval in ms — configurable, default 5s
const DEFAULT_POLL_INTERVAL = 5000;

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Link Agents state
  const [linkTopic, setLinkTopic] = useState('');
  const [linkForce, setLinkForce] = useState(false);
  const [linkReason, setLinkReason] = useState('');
  const [linkStatus, setLinkStatus] = useState(null);
  const [linking, setLinking] = useState(false);

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

  /**
   * Link Agents handler — shouldFire() wired per contract:
   *   { topic: string, force?: boolean, reason?: string }
   *
   * Gate 1: 250ms cooldown
   * Gate 2: 60s signature-hash dedup
   * Validation: topic must not be default template string;
   *             force=true requires reason (min 8 chars);
   *             generic sync pings intercepted at doctrine layer.
   */
  const handleLinkAgents = () => {
    if (!shouldFire({ topic: linkTopic, force: linkForce, reason: linkReason })) {
      setLinkStatus({ type: 'blocked', message: 'Blocked by dedup middleware — check console for gate details.' });
      return;
    }

    setLinking(true);
    setLinkStatus(null);

    linkAgents({ topic: linkTopic, force: linkForce, reason: linkReason })
      .then((result) => {
        setLinkStatus({ type: 'success', message: `Agents linked. Channel: ${result?.channel_id || 'active'}` });
      })
      .catch((err) => {
        setLinkStatus({ type: 'error', message: err?.message || 'Link failed.' });
      })
      .finally(() => setLinking(false));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-950 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-lg font-bold tracking-tight">✴ GPS Tracker</span>
          {lastUpdated && (
            <span className="text-gray-500 text-xs">
              Last sync: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {error && <span className="text-red-400 text-xs">{error}</span>}
        </div>

        <div className="flex items-center gap-4">
          {/* Link Agents button — shouldFire() wired */}
          <button
            onClick={handleLinkAgents}
            disabled={linking}
            className="px-3 py-1.5 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {linking ? 'Linking...' : 'Link Agents'}
          </button>

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
        </div>
      </header>

      {/* Link Agents status bar */}
      {linkStatus && (
        <div
          className={`px-6 py-2 text-xs shrink-0 ${
            linkStatus.type === 'success'
              ? 'bg-green-900/40 text-green-400 border-b border-green-800'
              : linkStatus.type === 'blocked'
              ? 'bg-yellow-900/40 text-yellow-400 border-b border-yellow-800'
              : 'bg-red-900/40 text-red-400 border-b border-red-800'
          }`}
        >
          {linkStatus.message}
        </div>
      )}

      {/* Link Agents config panel — shown when force is needed */}
      {linkForce && (
        <div className="flex items-center gap-4 px-6 py-2 bg-gray-850 border-b border-gray-700 shrink-0">
          <input
            type="text"
            value={linkTopic}
            onChange={(e) => setLinkTopic(e.target.value)}
            placeholder="Topic..."
            className="flex-1 px-2 py-1 rounded text-xs bg-gray-800 border border-gray-600 text-white"
          />
          <input
            type="text"
            value={linkReason}
            onChange={(e) => setLinkReason(e.target.value)}
            placeholder="Reason (min 8 chars, required for force)..."
            className="flex-1 px-2 py-1 rounded text-xs bg-gray-800 border border-gray-600 text-white"
          />
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={linkForce}
              onChange={(e) => setLinkForce(e.target.checked)}
              className="h-3 w-3"
            />
            Force
          </label>
        </div>
      )}

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
