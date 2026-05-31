export default function LiveFeed({ readings, selectedDevice, maxRows = 20 }) {
  const filtered = selectedDevice
    ? readings.filter((r) => r.device_name === selectedDevice)
    : readings;

  const display = filtered.slice(0, maxRows);

  return (
    <div className="h-48 bg-gray-950 border-t border-gray-700 flex flex-col">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <span className="text-gray-400 text-xs uppercase tracking-wider">
          Live Feed {selectedDevice ? `— ${selectedDevice}` : '— All Devices'}
        </span>
        <span className="text-gray-600 text-xs">{display.length} readings</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {display.length === 0 ? (
          <div className="p-4 text-gray-600 text-xs">No readings yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-950">
              <tr className="text-gray-500 text-left">
                <th className="px-4 py-1">Device</th>
                <th className="px-4 py-1">Lat</th>
                <th className="px-4 py-1">Lng</th>
                <th className="px-4 py-1">Speed</th>
                <th className="px-4 py-1">Accuracy</th>
                <th className="px-4 py-1">Altitude</th>
                <th className="px-4 py-1">Time</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r, i) => (
                <tr
                  key={r.id || i}
                  className={`border-t border-gray-800 hover:bg-gray-900 ${
                    i === 0 ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  <td className="px-4 py-1 font-medium">{r.device_name}</td>
                  <td className="px-4 py-1">{r.latitude?.toFixed(6)}</td>
                  <td className="px-4 py-1">{r.longitude?.toFixed(6)}</td>
                  <td className="px-4 py-1">
                    {r.speed != null ? `${(r.speed * 3.6).toFixed(1)} km/h` : '—'}
                  </td>
                  <td className="px-4 py-1">
                    {r.accuracy != null ? `±${r.accuracy.toFixed(0)}m` : '—'}
                  </td>
                  <td className="px-4 py-1">
                    {r.altitude != null ? `${r.altitude.toFixed(0)}m` : '—'}
                  </td>
                  <td className="px-4 py-1">
                    {new Date(r.created_date).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
