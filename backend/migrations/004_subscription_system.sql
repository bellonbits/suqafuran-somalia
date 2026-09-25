-- Migration: Add Subscription System Tables
-- Date: 2026-07-26
-- Description: Creates tables for seller subscriptions, billing, and feature access

-- SubscriptionPlan: Defines subscription tiers
CREATE TABLE IF NOT EXISTS subscription_plan (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price FLOAT NOT NULL DEFAULT 0.0,
    annual_price FLOAT NOT NULL DEFAULT 0.0,
    max_products INTEGER,
    has_analytics BOOLEAN DEFAULT FALSE,
    has_verified_badge BOOLEAN DEFAULT FALSE,
    has_priority_ranking BOOLEAN DEFAULT FALSE,
    has_custom_branding BOOLEAN DEFAULT FALSE,
    has_bulk_import BOOLEAN DEFAULT FALSE,
    has_marketing_codes BOOLEAN DEFAULT FALSE,
    has_staff_accounts BOOLEAN DEFAULT FALSE,
    max_staff_accounts INTEGER,
    has_email_support BOOLEAN DEFAULT FALSE,
    has_priority_support BOOLEAN DEFAULT FALSE,
    trial_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SellerSubscription: Track active subscriptions per seller
CREATE TABLE IF NOT EXISTS seller_subscription (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plan(id),
    billing_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',

    -- Trial period
    trial_started_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    is_trial_active BOOLEAN DEFAULT FALSE,

    -- Billing cycle
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP NOT NULL,
    renews_at TIMESTAMP,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,

    -- Cancellation
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SellerBilling: Track M-Pesa payment transactions
CREATE TABLE IF NOT EXISTS seller_billing (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES seller_subscription(id),
    seller_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

    -- Payment details
    amount_kes FLOAT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    mpesa_request_id VARCHAR(100) UNIQUE,
    mpesa_checkout_request_id VARCHAR(100) UNIQUE,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- M-Pesa response (JSON)
    mpesa_response JSON,

    -- Invoice
    invoice_number VARCHAR(100) UNIQUE,

    -- Dates
    payment_date TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    next_billing_date TIMESTAMP,

    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SellerFeatureAccess: Cache feature permissions
CREATE TABLE IF NOT EXISTS seller_feature_access (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    subscription_id INTEGER NOT NULL REFERENCES seller_subscription(id),

    -- Feature flags
    has_analytics BOOLEAN DEFAULT FALSE,
    has_verified_badge BOOLEAN DEFAULT FALSE,
    has_priority_ranking BOOLEAN DEFAULT FALSE,
    has_custom_branding BOOLEAN DEFAULT FALSE,
    has_bulk_import BOOLEAN DEFAULT FALSE,
    has_marketing_codes BOOLEAN DEFAULT FALSE,
    has_staff_accounts BOOLEAN DEFAULT FALSE,
    has_email_support BOOLEAN DEFAULT FALSE,
    has_priority_support BOOLEAN DEFAULT FALSE,

    -- Limits
    max_products INTEGER,
    max_staff_accounts INTEGER,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FeaturedSelling: Premium placements (add-on)
CREATE TABLE IF NOT EXISTS featured_selling (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

    -- Placement type
    placement_type VARCHAR(50) NOT NULL,
    category_id INTEGER REFERENCES category(id),

    -- Duration
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,

    -- Payment
    price_kes FLOAT NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    billing_id INTEGER REFERENCES seller_billing(id),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_subscription_plan_id ON seller_subscription(plan_id);
CREATE INDEX IF NOT EXISTS idx_seller_subscription_seller_id ON seller_subscription(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_subscription_started_at ON seller_subscription(started_at);
CREATE INDEX IF NOT EXISTS idx_seller_subscription_status ON seller_subscription(status);
CREATE INDEX IF NOT EXISTS idx_seller_subscription_is_active ON seller_subscription(is_active);
CREATE INDEX IF NOT EXISTS idx_seller_billing_subscription_id ON seller_billing(subscription_id);
CREATE INDEX IF NOT EXISTS idx_seller_billing_seller_id ON seller_billing(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_billing_phone_number ON seller_billing(phone_number);
CREATE INDEX IF NOT EXISTS idx_seller_billing_status ON seller_billing(status);
CREATE INDEX IF NOT EXISTS idx_seller_billing_checkout_request_id ON seller_billing(mpesa_checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_seller_feature_access_subscription_id ON seller_feature_access(subscription_id);
CREATE INDEX IF NOT EXISTS idx_featured_selling_seller_id ON featured_selling(seller_id);
CREATE INDEX IF NOT EXISTS idx_featured_selling_starts_at ON featured_selling(starts_at);
CREATE INDEX IF NOT EXISTS idx_featured_selling_ends_at ON featured_selling(ends_at);
CREATE INDEX IF NOT EXISTS idx_featured_selling_is_active ON featured_selling(is_active);
