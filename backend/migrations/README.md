# Database Migrations - Rider System

## Overview
This directory contains SQL migrations for the Rider/Driver system. Migrations are versioned and should be applied in order.

## Current Migrations

### Migration 001: Create Rider System Tables
**File**: `001_create_rider_system.sql`  
**Status**: Ready for deployment  
**Tables Created**: 4
- `riders` - Main rider profiles
- `rider_earnings` - Earnings tracking
- `rider_withdrawals` - Withdrawal requests
- `messages` - Rider-customer messaging

## How to Apply Migrations

### Prerequisites
```bash
# PostgreSQL must be installed and running
# Database must exist
psql -U postgres -l  # List databases
```

### Option 1: Using psql (Recommended)
```bash
# Connect to your database
psql -U your_db_user -d suqafuran_db

# Run migration
\i backend/migrations/001_create_rider_system.sql

# Verify
\dt riders  # Should show riders table
```

### Option 2: Using Python Migration Script
```bash
cd backend
python -m alembic upgrade head
```

### Option 3: Using Docker
```bash
docker exec -it suqafuran_postgres psql -U postgres -d suqafuran_db -f /migrations/001_create_rider_system.sql
```

## Verification Checklist

After running migration, verify:

```bash
psql -U your_db_user -d suqafuran_db

-- List all tables
\dt

-- Check riders table structure
\d riders

-- Check indexes
\di public.idx_riders_*

-- Count records (should be 0 initially)
SELECT COUNT(*) FROM riders;
SELECT COUNT(*) FROM rider_earnings;
SELECT COUNT(*) FROM rider_withdrawals;
```

## Rollback Instructions

If you need to rollback:

```bash
-- Drop tables (WARNING: Data will be lost)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS rider_withdrawals CASCADE;
DROP TABLE IF EXISTS rider_earnings CASCADE;
DROP TABLE IF EXISTS riders CASCADE;

-- Drop types
DROP TYPE IF EXISTS rider_delivery_status CASCADE;
DROP TYPE IF EXISTS withdrawal_status CASCADE;
DROP TYPE IF EXISTS withdrawal_method CASCADE;
DROP TYPE IF EXISTS rider_availability_status CASCADE;
```

## Migration Checklist

- [ ] PostgreSQL 12+ running
- [ ] Database created
- [ ] users table exists (required for FK)
- [ ] delivery_assignments table exists (for extension)
- [ ] Run migration script
- [ ] Verify all tables created
- [ ] Check indexes created
- [ ] Test data inserts

## Environment Setup

### Development
```bash
# .env or .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/suqafuran_db_dev
```

### Production
```bash
# .env.production
DATABASE_URL=postgresql://user:password@prod-db-host:5432/suqafuran_db
```

## Performance Notes

### Indexes Created
- `idx_riders_user_id` - User lookup
- `idx_riders_is_active` - Active riders filter
- `idx_rider_earnings_rider_date` - Earnings analytics
- `idx_rider_withdrawals_status` - Withdrawal processing
- `idx_messages_read` - Unread message queries

### Partitioning (Optional for production)
For large deployments, consider partitioning:
- `rider_earnings` by date (monthly)
- `messages` by created_at (monthly)
- `rider_withdrawals` by requested_date

## Next Steps

1. **Apply Migration**
   ```bash
   psql -U postgres -d suqafuran_db -f backend/migrations/001_create_rider_system.sql
   ```

2. **Verify Creation**
   - Run verification queries above
   - Check PostgreSQL GUI (pgAdmin or DBeaver)

3. **Seed Data (Optional)**
   - Create test riders
   - Add sample earnings records
   - Create test messages

4. **Monitor**
   - Check table sizes
   - Monitor index performance
   - Backup database

## Support

For issues:
1. Check PostgreSQL logs
2. Verify database permissions
3. Ensure all dependencies exist (users, delivery_assignments tables)
4. Review migration SQL for syntax

---

**Last Updated**: July 4, 2026  
**Migration Version**: 001  
**Status**: Production Ready ✅
