-- Ownership and integrity constraints (idempotent)
CREATE INDEX IF NOT EXISTS idx_users_supplier ON users(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_activations_pair ON agent_activations (agent_id, shop_user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier ON deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
