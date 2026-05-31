/**
 * LinkAgentsButton — Dashboard component
 * Contract: { topic: string, force?: boolean, reason?: string }
 * shouldFire() guard: prevents duplicate/rapid fire calls
 * Built by Mia
 */

import { useState, useRef, useCallback } from 'react';

const COOLDOWN_MS = 8000; // 8s cooldown between link calls

/**
 * shouldFire()
 * Returns true if the button is allowed to trigger a link session.
 * Guards against: cooldown window, already-running session, missing topic.
 */
function shouldFire({ topic, isRunning, lastFiredAt, force = false }) {
  if (force) return { ok: true, reason: null };

  if (!topic?.trim()) {
    return { ok: false, reason: 'Topic is required to link agents.' };
  }

  if (isRunning) {
    return { ok: false, reason: 'A link session is already running.' };
  }

  if (lastFiredAt) {
    const elapsed = Date.now() - lastFiredAt;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return { ok: false, reason: `Cooldown active — ${remaining}s remaining.` };
    }
  }

  return { ok: true, reason: null };
}

export default function LinkAgentsButton({
  topic = '',
  force = false,
  reason = '',
  onResult,
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'error'|'success'|'info', message: string }
  const lastFiredAt = useRef(null);

  const handleClick = useCallback(async () => {
    const guard = shouldFire({
      topic,
      isRunning,
      lastFiredAt: lastFiredAt.current,
      force,
    });

    if (!guard.ok) {
      setStatus({ type: 'error', message: guard.reason });
      return;
    }

    // Fire
    setIsRunning(true);
    setStatus({ type: 'info', message: 'Linking agents...' });
    lastFiredAt.current = Date.now();

    try {
      // Call agentChannel — contract: { topic, force?, reason? }
      const res = await fetch('/api/agent-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, force, reason }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Link session failed');
      }

      setStatus({ type: 'success', message: `Linked ✓ — session ${data.channel_id || 'active'}` });
      onResult?.(data);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsRunning(false);
    }
  }, [topic, isRunning, force, reason, onResult]);

  const btnBase = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const btnState = isRunning
    ? 'bg-indigo-800 text-indigo-300 cursor-not-allowed opacity-70'
    : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer focus:ring-indigo-500';

  return (
    <div className="flex flex-col gap-2">
      <button
        className={`${btnBase} ${btnState}`}
        onClick={handleClick}
        disabled={isRunning}
        aria-label="Link JARVIS and Mia agents"
      >
        {isRunning ? (
          <>
            <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            Linking...
          </>
        ) : (
          <>
            <span>⛓</span>
            Link Agents
          </>
        )}
      </button>

      {status && (
        <p className={`text-xs px-1 ${
          status.type === 'error' ? 'text-red-400' :
          status.type === 'success' ? 'text-green-400' :
          'text-indigo-300'
        }`}>
          {status.message}
        </p>
      )}
    </div>
  );
}

// Named export for testing
export { shouldFire };
