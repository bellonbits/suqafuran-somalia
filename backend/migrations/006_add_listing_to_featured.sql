-- Add listing_id to featured_selling table for featured product placements

ALTER TABLE featured_selling ADD COLUMN listing_id INTEGER;
ALTER TABLE featured_selling ADD FOREIGN KEY (listing_id) REFERENCES listing(id) ON DELETE CASCADE;
CREATE INDEX idx_featured_selling_listing_id ON featured_selling(listing_id);
