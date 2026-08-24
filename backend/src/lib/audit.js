'use strict';

async function audit(db, { actorId, actorRole, action, resourceType, resourceId, meta, ip }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, meta, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        actorId || null,
        actorRole || null,
        action,
        resourceType || null,
        resourceId ? String(resourceId) : null,
        JSON.stringify(meta || {}),
        ip || null,
      ]
    );
  } catch (err) {
    console.error('audit_log_failed', err.message);
  }
}

module.exports = { audit };
