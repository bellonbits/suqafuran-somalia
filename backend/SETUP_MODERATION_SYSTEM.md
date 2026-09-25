# Setup: Moderation & Featured Listing System

## Quick Setup Guide

Everything is now integrated into the backend. Here's what was done:

### Files Modified/Created

✅ **Models**
- `app/models/listing.py` - Added: `moderation_status`, `moderated_at`, `moderator_id`, `moderation_notes`
- `app/models/featured_listing.py` - New: FeaturedListing model for paid ads
- `app/models/__init__.py` - Updated imports

✅ **API Endpoints**
- `app/api/api_v1/endpoints/listings.py` - Added:
  - `POST /listings/` - Updated to set moderation_status=pending, publish Kafka events
  - `POST /listings/{id}/approve` - Admin approves listing
  - `POST /listings/{id}/reject` - Admin rejects with reason
  - `GET /listings/{id}/moderation-status` - Check status
  - `POST /listings/{id}/feature` - Pay to feature listing
  - `POST /listings/webhooks/featured-payment-success` - Payment success callback
  - `POST /listings/webhooks/featured-payment-failed` - Payment failure callback

✅ **Services** (Already created in previous steps)
- `app/services/kafka_producer.py` - Publishes domain events
- `app/services/notification_consumer.py` - Consumes notification events
- `app/services/notification_config.py` - Event→channel mapping (6 new events added)
- `app/tasks/notification_tasks.py` - Celery tasks for Resend/SMS/Firebase

✅ **Database Migration**
- `alembic/versions/001_add_moderation_and_featured_listing.py` - Creates tables and fields

## Step 1: Apply Database Migration

```bash
cd /Users/mac/suqafuran/backend

# Apply the migration
alembic upgrade head

# Verify (should show the migration applied)
alembic current
```

## Step 2: Update Environment Variables

Ensure `.env` has Kafka configured:

```bash
# Already set from previous work
KAFKA_BOOTSTRAP_SERVERS=kafka:29092
KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
```

## Step 3: Start Services

```bash
# Terminal 1: Start Docker services
cd /Users/mac/suqafuran
docker-compose up

# Terminal 2: Start backend API
cd /Users/mac/suqafuran/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Start Celery worker (for notifications)
celery -A app.tasks.celery_app worker -Q notifications -l info

# Terminal 4 (optional): Monitor Kafka via Kafdrop
# Open browser: http://localhost:9000
```

## Step 4: Test the Workflow

### A. Create a Listing (Seller)

```bash
curl -X POST http://localhost:8000/api/v1/listings \
  -H "Authorization: Bearer {seller_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title_en": "Samsung TV",
    "description_en": "65-inch smart TV with warranty",
    "price": 45000,
    "location": "Mogadishu",
    "condition": "New",
    "category_id": 5,
    "images": ["url1", "url2"]
  }'

# Response:
# {
#   "id": 789,
#   "status": "pending",
#   "moderation_status": "pending"
# }
```

**Expected Events Published:**
- `catalog.product.created_pending_moderation` → Kafka
- Seller gets SMS: "Your listing is under review..."
- Admins get email + push: "[REVIEW] New listing by @seller_name"

### B. Admin Reviews (Approve)

```bash
curl -X POST http://localhost:8000/api/v1/listings/789/approve \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "moderation_notes": "Good product, approved"
  }'

# Response:
# {
#   "status": "approved",
#   "listing_id": 789
# }
```

**Expected Events Published:**
- `catalog.product.approved` → Kafka
- Seller gets email + SMS + push: "Your listing is live!"

### C. Admin Rejects (Alternative)

```bash
curl -X POST http://localhost:8000/api/v1/listings/789/reject \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "rejection_reason": "Price too high for category",
    "moderation_notes": "Seller should reduce price by 20%"
  }'

# Response:
# {
#   "status": "rejected",
#   "listing_id": 789,
#   "reason": "Price too high for category"
# }
```

**Expected Events Published:**
- `catalog.product.rejected` → Kafka
- Seller gets email + SMS: "Reason: [reason]"

### D. Feature Listing (Seller)

```bash
curl -X POST http://localhost:8000/api/v1/listings/789/feature \
  -H "Authorization: Bearer {seller_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "boost_level": "vip",
    "payment_method": "mpesa"
  }'

# Response:
# {
#   "featured_listing_id": 456,
#   "status": "pending",
#   "payment_required": {
#     "amount": 15000,
#     "currency": "SOS",
#     "boost_level": "vip",
#     "duration_days": 30
#   },
#   "next_step": "Complete payment via mpesa"
# }
```

**Expected Events Published:**
- `payments.featured_listing.initiated` → Kafka
- Seller gets SMS + push: "Complete payment: [link]"

### E. Payment Success (Webhook)

```bash
curl -X POST http://localhost:8000/api/v1/listings/webhooks/featured-payment-success \
  -H "Content-Type: application/json" \
  -d '{
    "featured_listing_id": 456,
    "payment_reference": "MPA123456789",
    "amount_paid": 15000
  }'

# Response:
# {
#   "status": "activated"
# }
```

**Expected Events Published:**
- `payments.featured_listing.success` → Kafka
- Seller gets email + SMS + push: "Featured! 30 days of priority placement"
- Listing now has `boost_level=2` (vip)

### F. Payment Failure (Webhook)

```bash
curl -X POST http://localhost:8000/api/v1/listings/webhooks/featured-payment-failed \
  -H "Content-Type: application/json" \
  -d '{
    "featured_listing_id": 456,
    "failure_reason": "Insufficient funds"
  }'

# Response:
# {
#   "status": "failed",
#   "reason": "Insufficient funds"
# }
```

**Expected Events Published:**
- `payments.featured_listing.failed` → Kafka
- Seller gets email + SMS + push: "Payment failed. Retry: [link]"

## Step 5: Monitor Events

### Via Kafdrop (Web UI)
- Open http://localhost:9000
- View topics:
  - `suqafuran.catalog.events`
  - `suqafuran.payments.events`
  - `suqafuran.notifications.dispatch`
- See messages in real-time

### Via Kafka CLI
```bash
# Inside Kafka container
docker exec -it suqafuran-kafka bash

# List topics
kafka-topics --bootstrap-server localhost:29092 --list

# Read from topic
kafka-console-consumer --bootstrap-server localhost:29092 \
  --topic suqafuran.catalog.events --from-beginning
```

### Via Logs
```bash
# API logs
docker logs -f suqafuran-backend

# Celery worker logs
# (In terminal 3)

# Kafka logs
docker logs -f suqafuran-kafka
```

## Step 6: Verify Notifications

### Check Email Logs (Resend)
```bash
# Celery task should call Resend API
# Check task status in Celery Flower (if running)
# or check logs for send_email_task
```

### Check SMS Logs (Africa's Talking)
```bash
# Celery task should call Africa's Talking API
# Check task logs or SMS history
```

### Check Push Notifications (Firebase)
```bash
# Celery task should call Firebase API
# Check device notifications in app
```

## Troubleshooting

### Issue: "Kafka not available" warning
**Cause:** Kafka not running or bootstrap servers misconfigured
**Fix:**
```bash
# Check Kafka is running
docker ps | grep kafka

# Check .env has KAFKA_BOOTSTRAP_SERVERS=kafka:29092
cat .env | grep KAFKA_BOOTSTRAP_SERVERS

# Restart containers
docker-compose down && docker-compose up
```

### Issue: Kafka topics not created
**Cause:** Auto-create not enabled or topics already exist
**Fix:**
```bash
# Create topics manually
docker exec suqafuran-kafka kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.catalog.events --partitions 3

docker exec suqafuran-kafka kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.payments.events --partitions 3

docker exec suqafuran-kafka kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.notifications.dispatch --partitions 3
```

### Issue: Notifications not sent
**Cause:** Celery not running or tasks not in queue
**Fix:**
```bash
# Check Celery is running
ps aux | grep celery

# Check Redis is running
redis-cli ping

# Restart Celery worker
celery -A app.tasks.celery_app worker -Q notifications -l info
```

### Issue: Import errors in listings.py
**Cause:** FeaturedListing not imported or Kafka producer not available
**Fix:**
```bash
# Check imports are added
grep -n "from app.models.featured_listing" app/api/api_v1/endpoints/listings.py

# Check Kafka producer module exists
ls -la app/services/kafka_producer.py

# Restart backend
# (Restart terminal 2)
```

## Database Schema

### Listing Table (Modified)
```sql
ALTER TABLE listing ADD COLUMN moderation_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE listing ADD COLUMN moderated_at TIMESTAMP;
ALTER TABLE listing ADD COLUMN moderator_id INTEGER REFERENCES "user"(id);
ALTER TABLE listing ADD COLUMN moderation_notes VARCHAR(500);

CREATE INDEX idx_listing_moderation ON listing(moderation_status, created_at);
```

### FeaturedListing Table (New)
```sql
CREATE TABLE featured_listing (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing(id),
  owner_id INTEGER NOT NULL REFERENCES "user"(id),
  boost_level VARCHAR(50) NOT NULL,
  amount_paid FLOAT NOT NULL,
  currency VARCHAR(3) DEFAULT 'SOS',
  duration_days INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50) NOT NULL,
  payment_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  activated_at TIMESTAMP,
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0
);

CREATE INDEX idx_featured_listing_status ON featured_listing(status, expires_at);
```

## API Documentation

### Create Listing
**Endpoint:** `POST /api/v1/listings`
**Auth:** Required (seller)
**Status Before:** None
**Status After:** `status=pending`, `moderation_status=pending`
**Events:** `catalog.product.created_pending_moderation`

### Approve Listing
**Endpoint:** `POST /api/v1/listings/{id}/approve`
**Auth:** Required (admin)
**Status Before:** `moderation_status=pending`
**Status After:** `status=active`, `moderation_status=approved`
**Events:** `catalog.product.approved`
**Response:**
```json
{
  "status": "approved",
  "listing_id": 789
}
```

### Reject Listing
**Endpoint:** `POST /api/v1/listings/{id}/reject`
**Auth:** Required (admin)
**Body:**
```json
{
  "rejection_reason": "string (required)",
  "moderation_notes": "string (optional)"
}
```
**Status Before:** `moderation_status=pending`
**Status After:** `status=deleted`, `moderation_status=rejected`
**Events:** `catalog.product.rejected`
**Response:**
```json
{
  "status": "rejected",
  "listing_id": 789,
  "reason": "Price too high"
}
```

### Get Moderation Status
**Endpoint:** `GET /api/v1/listings/{id}/moderation-status`
**Auth:** Required (owner or admin)
**Response:**
```json
{
  "listing_id": 789,
  "moderation_status": "approved",
  "status": "active",
  "moderated_at": "2026-07-15T11:30:00Z",
  "rejection_reason": null,
  "moderation_notes": "Admin notes (admin only)"
}
```

### Feature Listing
**Endpoint:** `POST /api/v1/listings/{id}/feature`
**Auth:** Required (seller)
**Body:**
```json
{
  "boost_level": "basic|vip|diamond",
  "payment_method": "mpesa|stripe|paypal"
}
```
**Response:**
```json
{
  "featured_listing_id": 456,
  "status": "pending",
  "payment_required": {
    "amount": 15000,
    "currency": "SOS",
    "boost_level": "vip",
    "duration_days": 30
  },
  "next_step": "Complete payment via mpesa"
}
```

### Payment Success Webhook
**Endpoint:** `POST /api/v1/listings/webhooks/featured-payment-success`
**Auth:** Internal (M-Pesa/Stripe)
**Body:**
```json
{
  "featured_listing_id": 456,
  "payment_reference": "MPA123456789",
  "amount_paid": 15000
}
```
**Response:**
```json
{
  "status": "activated"
}
```

### Payment Failure Webhook
**Endpoint:** `POST /api/v1/listings/webhooks/featured-payment-failed`
**Auth:** Internal (M-Pesa/Stripe)
**Body:**
```json
{
  "featured_listing_id": 456,
  "failure_reason": "Insufficient funds"
}
```
**Response:**
```json
{
  "status": "failed",
  "reason": "Insufficient funds"
}
```

## Event Types Reference

### Catalog Events (`suqafuran.catalog.events`)
- `catalog.product.created_pending_moderation` - Listing submitted, pending review
- `catalog.product.approved` - Listing approved by admin, now active
- `catalog.product.rejected` - Listing rejected, with reason

### Payment Events (`suqafuran.payments.events`)
- `payments.featured_listing.initiated` - Feature payment started
- `payments.featured_listing.success` - Feature payment completed
- `payments.featured_listing.failed` - Feature payment failed

### Notification Events (`suqafuran.notifications.dispatch`)
- Automatically routed based on event type in `NOTIFICATION_MAPPING`
- Consumers trigger Celery tasks for email/SMS/push

## Next Steps

1. **Implement Payment Integration**
   - M-Pesa integration in payment processor
   - Stripe integration (optional)
   - Webhook signature verification

2. **Implement External Services**
   - Resend email templates
   - Africa's Talking SMS templates
   - Firebase Cloud Messaging setup

3. **Create Admin Dashboard**
   - List pending listings for review
   - Approve/reject UI
   - Moderation metrics/SLA tracking

4. **Add Analytics**
   - Featured listing impressions tracking
   - Featured listing clicks tracking
   - Revenue tracking per seller
   - Moderation metrics (average time, approval rate)

5. **Test End-to-End**
   - Seller creates listing
   - Admin approves
   - Seller features it
   - Payment succeeds
   - Verify notifications received
   - Check search/analytics updated

## Support

For issues or questions:
1. Check logs: `docker logs suqafuran-backend`
2. Check Kafka: http://localhost:9000 (Kafdrop)
3. Check database: psql or database viewer
4. Review documentation: `LISTING_WORKFLOW.md`, `COMPLETE_LISTING_SYSTEM.md`
