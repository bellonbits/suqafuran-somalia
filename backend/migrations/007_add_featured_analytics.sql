-- Add analytics and enhanced fields to featured_selling table

ALTER TABLE featured_selling ADD COLUMN campaign_name VARCHAR(255);
ALTER TABLE featured_selling ADD COLUMN market_id INTEGER;

-- Analytics columns
ALTER TABLE featured_selling ADD COLUMN views INTEGER DEFAULT 0;
ALTER TABLE featured_selling ADD COLUMN shop_visits INTEGER DEFAULT 0;
ALTER TABLE featured_selling ADD COLUMN product_clicks INTEGER DEFAULT 0;
ALTER TABLE featured_selling ADD COLUMN whatsapp_clicks INTEGER DEFAULT 0;
ALTER TABLE featured_selling ADD COLUMN call_clicks INTEGER DEFAULT 0;
ALTER TABLE featured_selling ADD COLUMN message_clicks INTEGER DEFAULT 0;
ALTER TABLE featured_selling ADD COLUMN followers_gained INTEGER DEFAULT 0;
ALTER TABLE featured_selling ADD COLUMN conversions INTEGER DEFAULT 0;

-- Create index on analytics for better query performance
CREATE INDEX idx_featured_selling_views ON featured_selling(views DESC);
CREATE INDEX idx_featured_selling_shop_visits ON featured_selling(shop_visits DESC);
