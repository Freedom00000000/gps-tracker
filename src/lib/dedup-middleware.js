/**
 * dedup-middleware.js — Cooldown Patch v1.2
 *
 * Dual-gate deduplication middleware:
 *   Gate 1: 250ms hard cooldown (time-based)
 *   Gate 2: 60s signature-hash dedup (content-based)
 *
 * lastFireAt is module-global — intentionally shared across all callers
 * so that concurrent components share a single cooldown state.
 */

// Module-global: intentionally shared — single cooldown state across all callers
let lastFireAt = 0;

const COOLDOWN_MS = 250;
const SIG_WINDOW_MS = 60 * 1000;

// Module-global signature cache — intentionally shared
const sigCache = new Map();

/**
 * Generate a stable hash for a given payload signature.
 * Used for the 60s content-based dedup gate.
 */
function buildSig({ topic = '', force = false, reason = '' }) {
  return `${topic}|${force}|${reason}`;
}

/**
 * shouldFire({ topic, force, reason })
 *
 * Returns true if the action is allowed to fire.
 * Returns false if intercepted by either gate.
 *
 * Validation rules:
 *   - topic must not be the default template string
 *   - if force === true, reason is required (min 8 chars)
 *   - generic sync pings are intercepted at doctrine layer
 */
export function shouldFire({ topic, force = false, reason = '' } = {}) {
  const now = Date.now();

  // Validation: topic must not be the default template string
  if (!topic || topic === 'string' || topic.trim() === '') {
    console.warn('[dedup] Blocked: topic is empty or default template string');
    return false;
  }

  // Validation: force requires a reason (min 8 chars)
  if (force === true && (!reason || reason.trim().length < 8)) {
    console.warn('[dedup] Blocked: force=true requires reason with min 8 chars');
    return false;
  }

  // Doctrine layer: intercept generic sync pings
  const genericPingPatterns = [
    /^sync up$/i,
    /^ping$/i,
    /^hello$/i,
    /^test$/i,
    /^check$/i,
  ];
  if (genericPingPatterns.some(rx => rx.test(topic.trim()))) {
    console.warn('[dedup] Blocked at doctrine layer: generic sync ping intercepted');
    return false;
  }

  // Gate 1: 250ms hard cooldown
  if (now - lastFireAt < COOLDOWN_MS) {
    console.warn(`[dedup] Blocked by Gate 1: ${now - lastFireAt}ms since last fire (cooldown: ${COOLDOWN_MS}ms)`);
    return false;
  }

  // Gate 2: 60s signature-hash dedup
  const sig = buildSig({ topic, force, reason });
  const lastSigFire = sigCache.get(sig);
  if (lastSigFire && now - lastSigFire < SIG_WINDOW_MS) {
    console.warn(`[dedup] Blocked by Gate 2: duplicate signature within ${SIG_WINDOW_MS / 1000}s window`);
    return false;
  }

  // All gates passed — update state
  lastFireAt = now;
  sigCache.set(sig, now);

  // Collect and evict expired sig cache keys (for...of mutation fix: collect first, then delete)
  const expiredKeys = [];
  for (const [key, ts] of sigCache.entries()) {
    if (now - ts >= SIG_WINDOW_MS) {
      expiredKeys.push(key);
    }
  }
  for (const key of expiredKeys) {
    sigCache.delete(key);
  }

  return true;
}
