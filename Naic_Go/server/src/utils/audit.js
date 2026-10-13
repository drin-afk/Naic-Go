const { query } = require('../config/db');

const SENSITIVE_KEYS = /pass(word)?|token|secret|hash|cookie|authorization/i;

/** Remove anything that looks like a credential before writing to audit logs. */
function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrub);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k)) continue;
    out[k] = typeof v === 'object' ? scrub(v) : v;
  }
  return out;
}

/**
 * Record an administrative / security-relevant action.
 * Never throws: audit failures are logged but must not break the request.
 */
async function audit(req, action, entityType = null, entityId = null, details = null, conn) {
  try {
    const text = details ? JSON.stringify(scrub(details)).slice(0, 4000) : null;
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req?.user?.id || null, action, entityType, entityId, text,
       req?.ip || null, (req?.get?.('user-agent') || '').slice(0, 255) || null],
      conn
    );
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { audit, scrub };
