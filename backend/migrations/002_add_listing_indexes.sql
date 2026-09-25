-- Add indexes to listing table for query optimization
CREATE INDEX IF NOT EXISTS idx_listing_status ON listing(status);
CREATE INDEX IF NOT EXISTS idx_listing_owner_id ON listing(owner_id);
CREATE INDEX IF NOT EXISTS idx_listing_category_id ON listing(category_id);
CREATE INDEX IF NOT EXISTS idx_listing_status_owner ON listing(status, owner_id);
CREATE INDEX IF NOT EXISTS idx_listing_status_category ON listing(status, category_id);
CREATE INDEX IF NOT EXISTS idx_listing_created_at ON listing(created_at DESC);

-- Also add index on user table for verification query
CREATE INDEX IF NOT EXISTS idx_user_is_verified ON "user"(is_verified) WHERE is_verified = true;
