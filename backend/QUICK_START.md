# Quick Start: Moderation & Featured Listings

## TL;DR - 5 Minute Setup

```bash
# 1. Apply database migration
cd /Users/mac/suqafuran/backend
alembic upgrade head

# 2. Start Docker (Terminal 1)
cd /Users/mac/suqafuran
docker-compose up

# 3. Start backend (Terminal 2)
cd /Users/mac/suqafuran/backend
python -m uvicorn app.main:app --reload

# 4. Start Celery (Terminal 3)
celery -A app.tasks.celery_app worker -Q notifications -l info

# 5. Monitor Kafka (Terminal 4, optional)
# Open browser: http://localhost:9000
```

## What Was Added

### Moderation Workflow
1. Seller creates listing → `status=pending, moderation_status=pending`
2. Admin reviews → `/listings/{id}/approve` or `/listings/{id}/reject`
3. Listing goes live (if approved) → `status=active, moderation_status=approved`

### Featured Listing (Paid Ad)
1. Seller calls → `POST /listings/{id}/feature` with `boost_level` and `payment_method`
2. FeaturedListing created with `payment_status=pending`
3. Seller pays via M-Pesa/Stripe/PayPal
4. Webhook callback → `/webhooks/featured-payment-success`
5. Listing boost activated → `boost_level=2, boost_expires_at=+30days`

### Notifications
- SMS to seller: "Submitted for review..."
- Email+Push to admins: "[REVIEW] New listing"
- Email+SMS+Push to seller: "Your listing is live!"
- SMS+Push to seller: "Complete payment to feature"
- Email+SMS+Push to seller: "Featured! 30 days priority"

## New Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/listings/` | Seller | Create listing (auto publish events) |
| POST | `/listings/{id}/approve` | Admin | Approve listing |
| POST | `/listings/{id}/reject` | Admin | Reject listing |
| GET | `/listings/{id}/moderation-status` | Seller/Admin | Check status |
| POST | `/listings/{id}/feature` | Seller | Pay to feature listing |
| POST | `/listings/webhooks/featured-payment-success` | Internal | M-Pesa success callback |
| POST | `/listings/webhooks/featured-payment-failed` | Internal | M-Pesa failure callback |

## Test Scenario

### Create Listing (Seller)
```bash
curl -X POST http://localhost:8000/api/v1/listings \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title_en": "iPhone 13",
    "description_en": "Mint condition",
    "price": 80000,
    "location": "Mogadishu",
    "condition": "New",
    "category_id": 5,
    "images": ["url1", "url2"]
  }'
# Response: {"id": 789, "status": "pending", "moderation_status": "pending"}
```

✓ Seller gets SMS: "Submitted for review..."
✓ Admins get Email+Push: "[REVIEW] New listing: iPhone 13"

### Approve (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/listings/789/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"moderation_notes": "Good product"}'
# Response: {"status": "approved", "listing_id": 789}
```

✓ Listing now `status=active` (VISIBLE!)
✓ Seller gets Email+SMS+Push: "Your listing is live!"

### Feature Listing (Seller)
```bash
curl -X POST http://localhost:8000/api/v1/listings/789/feature \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"boost_level": "vip", "payment_method": "mpesa"}'
# Response: {"featured_listing_id": 456, "status": "pending", "payment_required": {...}}
```

✓ Seller gets SMS+Push: "Complete payment: [link]"

### Payment Success (Webhook)
```bash
curl -X POST http://localhost:8000/api/v1/listings/webhooks/featured-payment-success \
  -H "Content-Type: application/json" \
  -d '{"featured_listing_id": 456, "payment_reference": "MPA123", "amount_paid": 15000}'
# Response: {"status": "activated"}
```

✓ FeaturedListing now `status=active`
✓ Listing has `boost_level=2` (vip)
✓ Seller gets Email+SMS+Push: "Featured! 30 days priority"

## Check Kafka Events

```bash
# Via Kafdrop Web UI
# http://localhost:9000

# Via Kafka CLI
docker exec suqafuran-kafka kafka-console-consumer \
  --bootstrap-server localhost:29092 \
  --topic suqafuran.catalog.events \
  --from-beginning

docker exec suqafuran-kafka kafka-console-consumer \
  --bootstrap-server localhost:29092 \
  --topic suqafuran.payments.events \
  --from-beginning

docker exec suqafuran-kafka kafka-console-consumer \
  --bootstrap-server localhost:29092 \
  --topic suqafuran.notifications.dispatch \
  --from-beginning
```

## Check Notifications

### Console/Logs
```bash
# Celery task logs (Terminal 3)
# You'll see: "SMS notification queued" or "Email notification queued"

# Backend logs (Terminal 2)
# You'll see: "Published catalog.product.created_pending_moderation"
```

### Database Queries
```bash
# Check listing status
SELECT id, status, moderation_status, moderated_at FROM listing WHERE id=789;

# Check featured listing
SELECT id, status, payment_status, activated_at FROM featured_listing WHERE id=456;

# Check audit log
SELECT * FROM audit_log WHERE resource_type='listing' ORDER BY created_at DESC LIMIT 5;
```

## File Locations

| File | Purpose |
|------|---------|
| `app/api/api_v1/endpoints/listings.py` | All 7 endpoints |
| `app/models/listing.py` | Listing model (moderation fields) |
| `app/models/featured_listing.py` | FeaturedListing model |
| `app/services/kafka_producer.py` | Publish events |
| `app/services/notification_consumer.py` | Consume events |
| `app/services/notification_config.py` | Event→notification mapping |
| `alembic/versions/001_add_moderation_and_featured_listing.py` | DB migration |

## Documentation

| Doc | Purpose |
|-----|---------|
| `QUICK_START.md` | This file (5 min overview) |
| `SETUP_MODERATION_SYSTEM.md` | Step-by-step setup + troubleshooting |
| `LISTING_WORKFLOW.md` | Complete workflow with examples |
| `COMPLETE_LISTING_SYSTEM.md` | Full architecture + event flows |
| `IMPLEMENTATION_SUMMARY.md` | High-level summary |

## Common Issues

**Q: Kafka not found**
```bash
# Make sure Docker is running
docker-compose up

# Check Kafka is running
docker ps | grep kafka
```

**Q: Database tables not created**
```bash
# Run migration
alembic upgrade head

# Verify
alembic current
```

**Q: Notifications not being sent**
```bash
# Make sure Celery is running (Terminal 3)
celery -A app.tasks.celery_app worker -Q notifications -l info

# Check Redis is running
redis-cli ping
```

**Q: Events not showing in Kafka**
```bash
# Check producer is initialized
# (Should see "Kafka Producer connected" in backend logs)

# Check topics exist
docker exec suqafuran-kafka kafka-topics \
  --bootstrap-server localhost:29092 --list | grep suqafuran
```

## Next Steps

1. ✅ Run migrations
2. ✅ Start services
3. ✅ Test create → approve → feature flow
4. **Implement payment integration** (M-Pesa/Stripe)
5. **Implement email/SMS templates** (Resend/Africa's Talking)
6. **Create admin dashboard** for moderation UI
7. **Add analytics** for featured listings

---

**Ready to test!** Follow the "Test Scenario" section above.
