'use strict';

function ttlMinutes() {
  const n = parseInt(process.env.PAYMENT_RESERVATION_TTL_MINUTES || '20', 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/**
 * Always lock buying_groups before orders to avoid deadlocks with
 * expire-stale, cancel, confirm, and concurrent checkout.
 */
async function lockGroupAndOrder(client, orderId) {
  const peek = await client.query(`SELECT group_id FROM orders WHERE id = $1`, [orderId]);
  if (!peek.rows.length) return null;
  await client.query(`SELECT id FROM buying_groups WHERE id = $1 FOR UPDATE`, [peek.rows[0].group_id]);
  const orderRes = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
  return orderRes.rows[0] || null;
}

/**
 * Lock group row first, then expire stale reservations for that group.
 */
async function expireStaleReservations(client, groupId) {
  await client.query(`SELECT id FROM buying_groups WHERE id = $1 FOR UPDATE`, [groupId]);
  const stale = await client.query(
    `SELECT id FROM orders
     WHERE group_id = $1
       AND reservation_status = 'reserved'
       AND reserved_until IS NOT NULL
       AND reserved_until < NOW()
     FOR UPDATE`,
    [groupId]
  );
  let released = 0;
  for (const row of stale.rows) {
    const r = await releaseReservation(client, row.id, { newOrderStatus: 'expired' });
    if (r.released) released += r.quantity;
  }
  return { releasedCount: stale.rows.length, releasedQuantity: released };
}

async function expireAllStaleReservations(client) {
  const groups = await client.query(
    `SELECT DISTINCT group_id AS id FROM orders
     WHERE reservation_status = 'reserved'
       AND reserved_until IS NOT NULL
       AND reserved_until < NOW()`
  );
  let releasedCount = 0;
  let releasedQuantity = 0;
  for (const g of groups.rows) {
    const r = await expireStaleReservations(client, g.id);
    releasedCount += r.releasedCount;
    releasedQuantity += r.releasedQuantity;
  }
  return { releasedCount, releasedQuantity };
}

/**
 * Reserve `quantity` on an open group. Caller must be in a transaction
 * with the group already locked FOR UPDATE.
 * current_quantity = reserved_quantity + confirmed_quantity.
 */
async function reserveCapacity(client, { groupId, quantity, orderId }) {
  const upd = await client.query(
    `UPDATE buying_groups
     SET reserved_quantity = reserved_quantity + $1,
         current_quantity = current_quantity + $1,
         status = CASE WHEN current_quantity + $1 >= target_quantity THEN 'filled' ELSE status END,
         updated_at = NOW()
     WHERE id = $2
       AND status = 'open'
       AND current_quantity + $1 <= target_quantity
     RETURNING *`,
    [quantity, groupId]
  );
  if (!upd.rows.length) {
    return { ok: false, code: 'OVER_CAPACITY' };
  }
  if (orderId) {
    await client.query(
      `UPDATE orders
       SET reservation_status = 'reserved',
           reserved_until = NOW() + ($2 || ' minutes')::interval,
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, String(ttlMinutes())]
    );
  }
  return { ok: true, group: upd.rows[0] };
}

/**
 * Release a reserved order exactly once. Does not touch confirmed orders.
 * Uses GREATEST only as a floor; the WHERE reservation_status = 'reserved'
 * guard prevents double-release.
 */
async function releaseReservation(client, orderId, { newOrderStatus } = {}) {
  const order = await lockGroupAndOrder(client, orderId);
  if (!order) return { released: false, reason: 'not_found' };
  if (order.reservation_status !== 'reserved') {
    return { released: false, reason: 'not_reserved', status: order.reservation_status };
  }

  const upd = await client.query(
    `UPDATE orders
     SET reservation_status = 'released',
         status = COALESCE($2, status),
         reserved_until = NULL,
         updated_at = NOW()
     WHERE id = $1 AND reservation_status = 'reserved'
     RETURNING quantity, group_id`,
    [orderId, newOrderStatus || null]
  );
  if (!upd.rows.length) return { released: false, reason: 'lost_race' };

  const qty = upd.rows[0].quantity;
  const groupId = upd.rows[0].group_id;
  await client.query(
    `UPDATE buying_groups
     SET reserved_quantity = GREATEST(reserved_quantity - $1, 0),
         current_quantity = GREATEST(current_quantity - $1, 0),
         status = CASE
           WHEN status = 'filled' AND GREATEST(current_quantity - $1, 0) < target_quantity THEN 'open'
           ELSE status
         END,
         updated_at = NOW()
     WHERE id = $2`,
    [qty, groupId]
  );
  return { released: true, quantity: qty, groupId };
}

/**
 * Convert a reserved order into confirmed (paid) capacity.
 * current_quantity is unchanged (units move reserved → confirmed).
 * A late SUCCESS after expiry/cancel re-acquires capacity if still available;
 * it never oversells.
 */
async function confirmReservation(client, orderId) {
  const order = await lockGroupAndOrder(client, orderId);
  if (!order) return { confirmed: false, reason: 'not_found' };

  if (order.reservation_status === 'confirmed') {
    return { confirmed: true, duplicate: true, quantity: order.quantity };
  }

  if (order.reservation_status !== 'reserved') {
    const r = await reserveCapacity(client, {
      groupId: order.group_id,
      quantity: order.quantity,
      orderId: order.id,
    });
    if (!r.ok) return { confirmed: false, reason: 'NO_CAPACITY' };
  }

  const upd = await client.query(
    `UPDATE orders
     SET reservation_status = 'confirmed',
         reserved_until = NULL,
         updated_at = NOW()
     WHERE id = $1 AND reservation_status = 'reserved'
     RETURNING quantity, group_id`,
    [orderId]
  );
  if (!upd.rows.length) {
    const again = await client.query(`SELECT reservation_status, quantity FROM orders WHERE id = $1`, [orderId]);
    if (again.rows[0]?.reservation_status === 'confirmed') {
      return { confirmed: true, duplicate: true, quantity: again.rows[0].quantity };
    }
    return { confirmed: false, reason: 'lost_race' };
  }

  const qty = upd.rows[0].quantity;
  await client.query(
    `UPDATE buying_groups
     SET reserved_quantity = GREATEST(reserved_quantity - $1, 0),
         confirmed_quantity = confirmed_quantity + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [qty, upd.rows[0].group_id]
  );
  return { confirmed: true, duplicate: false, quantity: qty };
}

/**
 * Payment retry after a failed/expired reservation: re-hold capacity if still available.
 * Does not create a second hold when already reserved.
 */
async function ensureReservation(client, order) {
  if (order.reservation_status === 'confirmed') return { ok: true, alreadyConfirmed: true };
  if (order.reservation_status === 'reserved') return { ok: true, alreadyReserved: true };
  await expireStaleReservations(client, order.group_id);
  return reserveCapacity(client, {
    groupId: order.group_id,
    quantity: order.quantity,
    orderId: order.id,
  });
}

async function groupCapacity(client, groupId) {
  const r = await client.query(
    `SELECT id, status, target_quantity, current_quantity, reserved_quantity, confirmed_quantity,
            GREATEST(target_quantity - current_quantity, 0) AS available_quantity
     FROM buying_groups WHERE id = $1`,
    [groupId]
  );
  return r.rows[0] || null;
}

module.exports = {
  ttlMinutes,
  lockGroupAndOrder,
  expireStaleReservations,
  expireAllStaleReservations,
  reserveCapacity,
  releaseReservation,
  confirmReservation,
  ensureReservation,
  groupCapacity,
};
