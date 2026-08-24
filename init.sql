-- Kopano Database Schema
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('retail', 'beauty', 'food', 'construction', 'other')),
    location VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business')),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    total_savings DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    commission_rate DECIMAL(5,2) DEFAULT 5.00,
    payment_terms_days INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buying groups
CREATE TABLE buying_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'filled', 'ordering', 'delivered', 'cancelled')),
    pickup_location TEXT,
    delivery_fee DECIMAL(10,2) DEFAULT 15.00,
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    group_id UUID REFERENCES buying_groups(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    platform_fee DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'group_filling', 'ordered', 'ready_pickup', 'delivered', 'cancelled', 'refunded')),
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    pickup_code VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items (for multi-item orders in future)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    group_id UUID REFERENCES buying_groups(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL
);

-- Transactions (payment ledger)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('payment', 'refund', 'payout', 'fee')),
    method VARCHAR(50) NOT NULL,
    external_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    tier VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    payment_reference VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_group ON orders(group_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_groups_status ON buying_groups(status);
CREATE INDEX idx_groups_category ON buying_groups(category);
CREATE INDEX idx_transactions_order ON transactions(order_id);

-- Trigger to update group quantity on order
CREATE OR REPLACE FUNCTION update_group_quantity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'paid' THEN
        UPDATE buying_groups 
        SET current_quantity = current_quantity + NEW.quantity,
            status = CASE 
                WHEN current_quantity + NEW.quantity >= target_quantity THEN 'filled'
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = NEW.group_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_group_quantity
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status != 'paid' AND NEW.status = 'paid')
EXECUTE FUNCTION update_group_quantity();

-- Seed data
INSERT INTO suppliers (name, contact_person, phone, commission_rate) VALUES
('Botswana Wholesale Distributors', 'Mr. Kgosi', '+267 390 1234', 5.00),
('Sefalana Cash & Carry', 'Ms. Mpho', '+267 397 5678', 6.00),
('PPC Botswana', 'Mr. Thabo', '+267 363 9012', 4.50);

INSERT INTO buying_groups (supplier_id, product_name, category, description, unit_price, retail_price, target_quantity, current_quantity, unit, deadline, pickup_location) VALUES
((SELECT id FROM suppliers WHERE name = 'Botswana Wholesale Distributors'), '25kg Rice — Royal Aroma', 'food', 'Premium long-grain rice, 25kg bag', 185.00, 240.00, 200, 156, 'bags', NOW() + INTERVAL '2 days', 'LEA Hub, Blue Jacket Street, Francistown'),
((SELECT id FROM suppliers WHERE name = 'Sefalana Cash & Carry'), '5L Cooking Oil x 4', 'food', 'Vegetable cooking oil, 5 litre bottles, pack of 4', 320.00, 420.00, 80, 80, 'crates', NOW() + INTERVAL '1 day', 'Sefalana Francistown, Industrial Area'),
((SELECT id FROM suppliers WHERE name = 'PPC Botswana'), 'Cement — PPC 50kg', 'construction', 'PPC Surebuild 50kg cement bags', 95.00, 125.00, 150, 43, 'bags', NOW() + INTERVAL '5 days', 'PPC Depot, Francistown'),
((SELECT id FROM suppliers WHERE name = 'Botswana Wholesale Distributors'), 'Hair Relaxer Kit', 'beauty', 'Motions professional hair relaxer kit', 145.00, 195.00, 60, 58, 'boxes', NOW() + INTERVAL '1 day', 'LEA Hub, Blue Jacket Street, Francistown');

INSERT INTO users (phone, pin_hash, business_name, category, location, subscription_tier, kyc_status, total_savings) VALUES
('+26771234567', '$2b$10$hashedpin', 'Tsholofelo Tuckshop', 'retail', 'Francistown', 'pro', 'verified', 4820.00),
('+26772345678', '$2b$10$hashedpin', 'Mmaabo Hair Salon', 'beauty', 'Gaborone', 'pro', 'verified', 3150.00),
('+26773456789', '$2b$10$hashedpin', 'Kgosi Construction', 'construction', 'Francistown', 'free', 'pending', 0.00),
('+26774567890', '$2b$10$hashedpin', 'Bontleng Caterers', 'food', 'Gaborone', 'business', 'verified', 6200.00);
-- Referral system
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    label VARCHAR(50),
    total_activations INT DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_id, status);

INSERT INTO referral_codes (owner_id, code, label)
SELECT id, 
       'KOP' || UPPER(SUBSTRING(MD5(id::text), 1, 5)),
       business_name || ' Code'
FROM users
ON CONFLICT DO NOTHING;
