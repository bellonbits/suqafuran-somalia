-- Add subscription feature tables and columns

-- Identity Verification
CREATE TABLE identity_verification (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id_type VARCHAR(50),
  id_number VARCHAR(255),
  id_image_url VARCHAR(255),
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_identity_verification_seller ON identity_verification(seller_id);
CREATE INDEX idx_identity_verification_status ON identity_verification(status);

-- Discount/Marketing Codes
CREATE TABLE discount_code (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20),
  discount_value DECIMAL(10, 2),
  min_purchase_amount DECIMAL(10, 2),
  expiry_date DATE,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_discount_code_seller ON discount_code(seller_id);
CREATE INDEX idx_discount_code_code ON discount_code(code);
CREATE INDEX idx_discount_code_active ON discount_code(is_active);

-- Analytics Events
CREATE TABLE analytics_event (
  id BIGSERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listing(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  source VARCHAR(50),
  search_query VARCHAR(255),
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_analytics_event_seller ON analytics_event(seller_id);
CREATE INDEX idx_analytics_event_listing ON analytics_event(listing_id);
CREATE INDEX idx_analytics_event_type ON analytics_event(event_type);
CREATE INDEX idx_analytics_event_created ON analytics_event(created_at);
CREATE INDEX idx_analytics_event_date_seller ON analytics_event(DATE(created_at), seller_id);

-- Shop Branding
CREATE TABLE shop_branding (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  banner_url VARCHAR(255),
  banner_alt_text VARCHAR(255),
  logo_url VARCHAR(255),
  brand_color VARCHAR(7),
  about_text TEXT,
  business_since VARCHAR(50),
  business_location VARCHAR(255),
  theme VARCHAR(20) DEFAULT 'light',
  featured_collection_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_shop_branding_seller ON shop_branding(seller_id);

-- Staff Accounts
CREATE TABLE staff_account (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role VARCHAR(50),
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_staff_account_seller ON staff_account(seller_id);
CREATE INDEX idx_staff_account_user ON staff_account(user_id);
CREATE INDEX idx_staff_account_active ON staff_account(is_active);

-- API Keys
CREATE TABLE api_key (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name VARCHAR(255),
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(50),
  scopes JSONB DEFAULT '[]'::jsonb,
  rate_limit INTEGER DEFAULT 10000,
  requests_today INTEGER DEFAULT 0,
  requests_total INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMP,
  last_used_ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);
CREATE INDEX idx_api_key_seller ON api_key(seller_id);
CREATE INDEX idx_api_key_hash ON api_key(key_hash);
CREATE INDEX idx_api_key_active ON api_key(is_active);

-- Custom Domains
CREATE TABLE custom_domain (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  domain VARCHAR(255) UNIQUE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_type VARCHAR(20) DEFAULT 'cname',
  ssl_status VARCHAR(20) DEFAULT 'pending',
  ssl_certificate_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_custom_domain_seller ON custom_domain(seller_id);
CREATE INDEX idx_custom_domain_domain ON custom_domain(domain);
CREATE INDEX idx_custom_domain_verified ON custom_domain(is_verified);

-- Advertising Credits
CREATE TABLE advertising_credit (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  month VARCHAR(7),
  balance_kes DECIMAL(10, 2) DEFAULT 0,
  total_allocated DECIMAL(10, 2),
  spent_kes DECIMAL(10, 2) DEFAULT 0,
  expires_at DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_advertising_credit_seller ON advertising_credit(seller_id);
CREATE INDEX idx_advertising_credit_month ON advertising_credit(month);

-- Add columns to existing tables
ALTER TABLE seller_subscription ADD COLUMN IF NOT EXISTS ranking_boost BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS account_manager_id INTEGER REFERENCES "user"(id);
