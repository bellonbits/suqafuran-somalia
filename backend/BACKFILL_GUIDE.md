# Primary Category Backfill Guide

## Overview

This guide explains how to backfill the `primary_category_id` field for existing shops based on their listing distribution.

## Setup

1. **Database Migration**: The migration `add_primary_category_to_users.py` has been created and will add the `primary_category_id` column to the `users` table when you run:

   ```bash
   alembic upgrade head
   ```

2. **Verify the schema change**:
   ```bash
   psql your_database_url
   \d user  # Check that primary_category_id column exists
   ```

## Running the Backfill

### Option 1: Backfill All Shops (Recommended for first-time setup)

```bash
python -m app.cli.backfill_primary_categories
```

### Option 2: Backfill with Limit

Useful if you want to test on a subset first:

```bash
python -m app.cli.backfill_primary_categories --limit 100
```

### Option 3: Dry Run

See what would be updated without making changes:

```bash
python -m app.cli.backfill_primary_categories --dry-run
```

## How It Works

1. For each shop (user with active listings):
   - Counts active listings in each category
   - Identifies the category with the most listings
   - Sets `primary_category_id` to that category

2. Shops with no active listings will have `primary_category_id = NULL`

3. When a shop posts a new listing, `primary_category_id` automatically updates

## After Backfill

### Shops Page Behavior

- When viewing a category (e.g., `/shops?category_id=1`), shops are now filtered by `primary_category_id`
- Each shop appears only once (in their primary category)
- Shops still have all their listings across multiple categories
- The `listing_count` shown reflects their total listings (across all categories)

### Example

**Before:**
- Beauty Palace appears in "Beauty" category (120 listings)
- Beauty Palace appears in "Cosmetics" category (20 listings)
- Beauty Palace appears in "Health" category (10 listings)

**After:**
- Beauty Palace appears only in "Beauty" category (primary)
- Shows "150 items" as total listing count
- Still sells in Cosmetics and Health, but only listed once

## Automatic Updates

Whenever a listing is created or updated, the shop's `primary_category_id` is automatically recalculated. This ensures accuracy as inventory changes.

## Troubleshooting

### No shops were updated

- Ensure the database migration ran successfully
- Check that shops have active listings: 
  ```sql
  SELECT owner_id, COUNT(*) FROM listing WHERE status = 'active' GROUP BY owner_id;
  ```

### Incorrect primary category

If a shop appears in the wrong category:

1. Check their listing distribution:
   ```sql
   SELECT category_id, COUNT(*) FROM listing 
   WHERE owner_id = <user_id> AND status = 'active'
   GROUP BY category_id ORDER BY COUNT(*) DESC;
   ```

2. Re-run the backfill for that shop (creates new listing to trigger auto-update)

## Query to Verify Results

After backfill, verify primary categories were set:

```sql
SELECT u.id, u.business_name, u.primary_category_id, c.name_en, COUNT(l.id) as listing_count
FROM "user" u
LEFT JOIN category c ON c.id = u.primary_category_id
LEFT JOIN listing l ON l.owner_id = u.id AND l.status = 'active'
WHERE u.is_verified = true
GROUP BY u.id, u.business_name, u.primary_category_id, c.name_en
ORDER BY COUNT(l.id) DESC;
```
