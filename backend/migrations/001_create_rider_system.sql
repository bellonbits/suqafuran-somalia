-- Rider System Tables - Migration 001
-- Created: 2026-07-04
-- Description: Complete Rider/Driver system tables and relationships

-- ============================================================================
-- ENUMS (Create types first)
-- ============================================================================

CREATE TYPE rider_availability_status AS ENUM (
    'online',
    'offline',
    'on_delivery'
);

CREATE TYPE withdrawal_method AS ENUM (
    'mpesa',
    'bank'
);

CREATE TYPE withdrawal_status AS ENUM (
    'pending',
    'completed',
    'rejected'
);

CREATE TYPE rider_delivery_status AS ENUM (
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled'
);

-- ============================================================================
-- RIDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS riders (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50),
    vehicle_plate VARCHAR(20),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),

    -- Banking Information
    bank_account VARCHAR(100),
    bank_name VARCHAR(100),
    mpesa_number VARCHAR(20),
    mpesa_verified BOOLEAN DEFAULT false,

    -- Performance Metrics
    availability_status rider_availability_status DEFAULT 'offline',
    total_deliveries INTEGER DEFAULT 0,
    completed_deliveries INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2) DEFAULT 5.0,
    response_time_minutes INTEGER DEFAULT 0,
    on_time_percentage DECIMAL(5, 2) DEFAULT 100.0,

    -- Document Tracking
    document_expiry TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_riders_user_id ON riders(user_id);
CREATE INDEX idx_riders_phone ON riders(phone);
CREATE INDEX idx_riders_is_active ON riders(is_active);
CREATE INDEX idx_riders_availability ON riders(availability_status);

-- ============================================================================
-- RIDER EARNINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rider_earnings (
    id VARCHAR(36) PRIMARY KEY,
    rider_id VARCHAR(36) NOT NULL,
    delivery_id VARCHAR(36) NOT NULL,

    -- Earning Breakdown
    base_fee DECIMAL(10, 2) NOT NULL,
    distance_bonus DECIMAL(10, 2) DEFAULT 0,
    speed_bonus DECIMAL(10, 2) DEFAULT 0,
    rating_bonus DECIMAL(10, 2) DEFAULT 0,
    total_earned DECIMAL(10, 2) NOT NULL,

    -- Metadata
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
);

CREATE INDEX idx_rider_earnings_rider_id ON rider_earnings(rider_id);
CREATE INDEX idx_rider_earnings_date ON rider_earnings(date);
CREATE INDEX idx_rider_earnings_rider_date ON rider_earnings(rider_id, date);

-- ============================================================================
-- RIDER WITHDRAWALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rider_withdrawals (
    id VARCHAR(36) PRIMARY KEY,
    rider_id VARCHAR(36) NOT NULL,

    -- Withdrawal Details
    amount DECIMAL(10, 2) NOT NULL,
    method withdrawal_method NOT NULL,
    status withdrawal_status DEFAULT 'pending',

    -- Dates and Tracking
    requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_date TIMESTAMP,
    transaction_id VARCHAR(100),
    reason_rejected VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
);

CREATE INDEX idx_rider_withdrawals_rider_id ON rider_withdrawals(rider_id);
CREATE INDEX idx_rider_withdrawals_requested_date ON rider_withdrawals(requested_date);
CREATE INDEX idx_rider_withdrawals_status ON rider_withdrawals(status);
CREATE INDEX idx_rider_withdrawals_rider_date ON rider_withdrawals(rider_id, requested_date);

-- ============================================================================
-- EXTEND DELIVERY_ASSIGNMENTS TABLE (if exists)
-- ============================================================================

ALTER TABLE delivery_assignments
    ADD COLUMN IF NOT EXISTS pickup_confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS delivery_completed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS proof_of_delivery_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS rider_rating_of_customer INTEGER CHECK (rider_rating_of_customer BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS estimated_earnings DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS final_earnings DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);

-- ============================================================================
-- MESSAGES TABLE (for rider-customer messaging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(36) PRIMARY KEY,
    sender_id VARCHAR(36) NOT NULL,
    recipient_id VARCHAR(36) NOT NULL,
    sender_type VARCHAR(20),
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_read ON messages(read);

-- ============================================================================
-- GRANTS & PERMISSIONS
-- ============================================================================

-- Grant permissions to app user (replace 'app_user' with actual username)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================

-- Show created tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('riders', 'rider_earnings', 'rider_withdrawals', 'messages')
ORDER BY table_name;
