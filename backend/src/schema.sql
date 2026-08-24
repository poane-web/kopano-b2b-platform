-- Kopano production schema (PostgreSQL 15+ / PGlite compatible)
-- Uses gen_random_uuid() instead of uuid-ossp

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('retail', 'beauty', 'food', 'construction', 'other')),
    location VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business')),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    total_savings DECIMAL(12,2) DEFAULT 0,
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'agent', 'supplier', 'admin')),
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'closed')),
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    supplier_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    commission_rate DECIMAL(5,2) DEFAULT 5.00,
    payment_terms_days INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buying_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id),
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    unit_price DECIMAL(10,2) NOT NULL,
    retail_price DECIMAL(10,2) NOT NULL,
    target_quantity INT NOT NULL,
    current_quantity INT DEFAULT 0,
    unit VARCHAR(50) NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('draft','open','filled','ordering','ordered','fulfilling','delivered','completed','cancelled')),
    pickup_location TEXT,
    delivery_fee DECIMAL(10,2) DEFAULT 15.00,
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    group_id UUID REFERENCES buying_groups(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    platform_fee DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending_payment' CHECK (status IN (
      'pending_payment', 'payment_initiated', 'paid', 'group_filling',
      'ordered', 'ready_pickup', 'delivered', 'cancelled', 'refunded', 'expired'
    )),
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    pickup_code VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    group_id UUID REFERENCES buying_groups(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('payment', 'refund', 'payout', 'fee', 'partial_refund', 'adjustment')),
    method VARCHAR(50) NOT NULL,
    external_reference VARCHAR(255),
    idempotency_key VARCHAR(64),
    provider VARCHAR(50),
    provider_payload JSONB DEFAULT '{}',
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
      'pending', 'initiated', 'awaiting_confirmation', 'completed', 'failed', 'reversed', 'cancelled', 'expired'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    tier VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    payment_reference VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    label VARCHAR(50),
    total_activations INT DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES users(id) NOT NULL,
    referred_id UUID REFERENCES users(id) NOT NULL UNIQUE,
    code_used VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'fraud_flagged')),
    first_order_at TIMESTAMPTZ,
    total_orders INT DEFAULT 0,
    total_gmv DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES users(id) NOT NULL,
    referred_id UUID REFERENCES users(id) NOT NULL,
    order_id UUID REFERENCES orders(id),
    type VARCHAR(30) NOT NULL CHECK (type IN ('activation_bonus', 'order_fee_share', 'subscription_share')),
    amount DECIMAL(10,2) NOT NULL,
    base_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'reversed')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) NOT NULL,
    region VARCHAR(100),
    active BOOLEAN DEFAULT true,
    total_activations INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) NOT NULL,
    shop_user_id UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    group_id UUID REFERENCES buying_groups(id),
    order_id UUID REFERENCES orders(id),
    status VARCHAR(30) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_role VARCHAR(20),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(64),
    meta JSONB DEFAULT '{}',
    ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_group ON orders(group_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_groups_status ON buying_groups(status);
CREATE INDEX IF NOT EXISTS idx_groups_supplier ON buying_groups(supplier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_idempotency
  ON transactions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_external_ref
  ON transactions (external_reference) WHERE external_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
