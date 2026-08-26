-- Reservation model: distinguish reserved vs confirmed vs released capacity
ALTER TABLE buying_groups ADD COLUMN IF NOT EXISTS reserved_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE buying_groups ADD COLUMN IF NOT EXISTS confirmed_quantity INT NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS reservation_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notif_token VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pay_token VARCHAR(255);

UPDATE orders SET reservation_status = 'confirmed'
  WHERE status = 'paid' AND (reservation_status IS NULL OR reservation_status = 'none');
UPDATE orders SET reservation_status = 'reserved'
  WHERE status IN ('pending_payment', 'payment_initiated')
    AND (reservation_status IS NULL OR reservation_status = 'none');
UPDATE orders SET reservation_status = 'released'
  WHERE status IN ('cancelled', 'expired', 'refunded')
    AND (reservation_status IS NULL OR reservation_status = 'none');

UPDATE buying_groups bg SET confirmed_quantity = COALESCE((
  SELECT SUM(quantity) FROM orders o WHERE o.group_id = bg.id AND o.reservation_status = 'confirmed'
), 0);
UPDATE buying_groups bg SET reserved_quantity = COALESCE((
  SELECT SUM(quantity) FROM orders o WHERE o.group_id = bg.id AND o.reservation_status = 'reserved'
), 0);
UPDATE buying_groups SET current_quantity = reserved_quantity + confirmed_quantity;

CREATE INDEX IF NOT EXISTS idx_orders_reservation ON orders(group_id, reservation_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_notif_token
  ON transactions (notif_token) WHERE notif_token IS NOT NULL;
