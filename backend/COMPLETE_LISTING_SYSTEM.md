# Complete Listing System: Moderation + Payment + Notifications

## Architecture Overview

Complete system integrating listing creation, moderation, featured listing payments, and notifications.

```
┌──────────────────────────────────────────────────────────────────┐
│                        SELLER APP                                │
├──────────────────────────────────────────────────────────────────┤
│  1. Create Listing Form                                          │
│     └─ Upload images → Select category → Enter price/description│
│                                                                   │
│  2. Track Moderation Status                                      │
│     └─ Pending... → Approved! → Can Feature                    │
│                                                                   │
│  3. Feature Listing (Paid Ad)                                    │
│     └─ Choose boost level → Pay via M-Pesa → Get analytics     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                         FastAPI Backend
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                                 │
├──────────────────────────────────────────────────────────────────┤
│  POST /listings
│    └─ Create listing (moderation_status=pending)
│       └─ Publish: catalog.product.created_pending_moderation
│       └─ Notify: seller (SMS), admins (email+push)
│
│  POST /listings/{id}/approve (admin only)
│    └─ Approve listing
│       └─ Publish: catalog.product.approved
│       └─ Notify: seller (email+SMS+push)
│
│  POST /listings/{id}/reject (admin only)
│    └─ Reject listing
│       └─ Publish: catalog.product.rejected
│       └─ Notify: seller (email+SMS)
│
│  POST /listings/{id}/feature (seller)
│    └─ Feature listing (create FeaturedListing, payment_status=pending)
│       └─ Publish: payments.featured_listing.initiated
│       └─ Notify: seller (SMS+push) payment prompt
│
│  POST /webhooks/payment-success
│    └─ M-Pesa payment succeeded
│       └─ Activate featured listing (boost_level set on Listing)
│       └─ Publish: payments.featured_listing.success
│       └─ Notify: seller (email+SMS+push) confirmation
│
│  POST /webhooks/payment-failed
│    └─ M-Pesa payment failed
│       └─ Keep featured listing as pending (allow retry)
│       └─ Publish: payments.featured_listing.failed
│       └─ Notify: seller (email+SMS+push) to retry
└──────────────────────────────────────────────────────────────────┘
                              ↓
                         Kafka & PostgreSQL
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    KAFKA TOPICS                                  │
├──────────────────────────────────────────────────────────────────┤
│  suqafuran.catalog.events
│    └─ catalog.product.created_pending_moderation
│    └─ catalog.product.approved
│    └─ catalog.product.rejected
│
│  suqafuran.payments.events
│    └─ payments.featured_listing.initiated
│    └─ payments.featured_listing.success
│    └─ payments.featured_listing.failed
│
│  suqafuran.notifications.dispatch
│    └─ Consumed by NotificationConsumer
│       └─ Triggers Celery tasks (Resend, Africa's Talking, Firebase)
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    Multiple Consumers
                              ↓
  ┌───────────────────┬──────────────────┬───────────────────┐
  ↓                   ↓                  ↓                   ↓
Search Index      Analytics         WebSocket          Notifications
(Elasticsearch)   (Metrics)         (Real-time)        (Email/SMS/Push)
                                                        
- Add to index    - Track new       - Broadcast to    - Resend
- Update filters  - Track featured  - Connected       - Africa's Talking
- Update scoring  - Revenue         - Customers       - Firebase
                    tracking
```

## Files Created/Modified

### Models
- ✅ `app/models/listing.py` - Added moderation fields
- ✅ `app/models/featured_listing.py` - New model for paid ads

### API Endpoints
- ✅ `app/api/api_v1/endpoints/listings_complete.py` - Full implementation

### Services
- ✅ `app/services/kafka_producer.py` - Event publishing
- ✅ `app/services/notification_consumer.py` - Event consumption
- ✅ `app/services/notification_config.py` - Event→notification mapping
- ✅ `app/tasks/notification_tasks.py` - Celery tasks

### Config
- ✅ `app/main.py` - Producer/consumer initialization
- ✅ `docker-compose.yml` - Kafka bootstrap servers

### Documentation
- ✅ `KAFKA_ARCHITECTURE.md` - Kafka producer/consumer guide
- ✅ `LISTING_WORKFLOW.md` - Complete listing workflow
- ✅ `COMPLETE_LISTING_SYSTEM.md` - This file

## Database Schema

### Listing Model (Modified)
```sql
Table: listing
├─ id (int, pk)
├─ owner_id (int, fk→user)
├─ title_en (str)
├─ title_so (str)
├─ description_en (text)
├─ description_so (text)
├─ price (float)
├─ location (str)
├─ condition (str)
├─ category_id (int, fk→category)
├─ subcategory_id (int, fk→subcategory)
├─ subsubcategory_id (int, fk→subsubcategory)
├─ images (json[])
├─ attributes (json)
├─ status (str) [pending|active|closed|deleted]
├─ moderation_status (str) [pending|approved|rejected] ← NEW
├─ moderated_at (datetime) ← NEW
├─ moderator_id (int, fk→user) ← NEW
├─ moderation_notes (str) ← NEW
├─ rejection_reason (str)
├─ admin_notes (json)
├─ boost_level (int) [0:none|1:basic|2:vip|3:diamond]
├─ boost_expires_at (datetime)
├─ is_sold (bool)
├─ sold_at (datetime)
├─ sold_via (str)
├─ fraud_risk_score (int)
├─ fraud_flags (json[])
├─ created_at (datetime)
└─ updated_at (datetime)
```

### FeaturedListing Model (New)
```sql
Table: featured_listing
├─ id (int, pk)
├─ listing_id (int, fk→listing)
├─ owner_id (int, fk→user)
├─ boost_level (str) [basic|vip|diamond]
├─ amount_paid (float)
├─ currency (str)
├─ duration_days (int)
├─ status (str) [pending|active|expired|cancelled]
├─ payment_status (str) [pending|processing|success|failed]
├─ payment_method (str) [mpesa|stripe|paypal]
├─ payment_reference (str)
├─ created_at (datetime)
├─ activated_at (datetime)
├─ expires_at (datetime)
├─ cancelled_at (datetime)
├─ impressions (int)
└─ clicks (int)
```

## Event Flow Examples

### Example 1: Create Listing → Approve → Feature

```
[Time: 10:00 AM]
SELLER: POST /api/v1/listings
├─ Upload: tv.jpg, tv2.jpg
├─ Data: Samsung TV, 45000 SOS, Mogadishu, Electronics
└─ Response: listing_id=789, status="pending"

EVENT: catalog.product.created_pending_moderation
├─ Kafka Topic: suqafuran.catalog.events
├─ Payload: listing_id, title, price, images, category
└─ Consumers: Search indexer (mark as pending), Analytics (log)

NOTIFICATION: catalog.product.created_pending_moderation
├─ Recipient: seller_123 (Seller)
├─ Channels: SMS, Push
├─ Template: "listing_submitted_for_review"
├─ Message: "Your listing 'Samsung TV' is under review. We'll notify you soon!"
└─ Service: Celery → Africa's Talking (SMS) + Firebase (Push)

NOTIFICATION: catalog.product.pending_moderation
├─ Recipient: admin_team (All admins)
├─ Channels: Email, Push
├─ Template: "admin_listing_requires_moderation"
├─ Message: "[REVIEW NEEDED] New listing: Samsung TV (45K) by @seller_123"
│           "Click to review: https://admin.suqafuran.com/mod/789"
└─ Service: Celery → Resend (Email) + Firebase (Push)

---

[Time: 11:30 AM - Admin Reviews]
ADMIN: POST /api/v1/listings/789/approve
├─ Notes: "Good product quality, competitive price"
└─ Response: {"status": "approved", "listing_id": 789}

EVENT: catalog.product.approved
├─ Kafka Topic: suqafuran.catalog.events
├─ Payload: listing_id, title, owner_id, approved_by, timestamp
└─ Consumers: Search indexer (mark as active+visible), Analytics (log)

LISTING UPDATE (Database)
├─ moderation_status: "pending" → "approved"
├─ status: "pending" → "active" ← NOW VISIBLE!
├─ moderated_at: 2026-07-15 11:30:00
└─ moderator_id: 456 (admin_user_id)

NOTIFICATION: catalog.product.approved
├─ Recipient: seller_123 (Seller)
├─ Channels: Email, SMS, Push
├─ Template: "listing_approved"
├─ Message: "Great news! 'Samsung TV' is now live! 📺 Customers can see and buy."
│           "Want more visibility? Feature it: [link]"
└─ Services: Resend (Email) + Africa's Talking (SMS) + Firebase (Push)

CUSTOMER EXPERIENCE
├─ Category page: "Samsung TV" now shows up
├─ Search results: Can find by "TV", "Samsung", "Electronics", "45000"
├─ Seller shop page: Listed in their products
└─ Real-time (WebSocket): Customers subscribed to category get notification

---

[Time: 2:00 PM - Seller Features]
SELLER: POST /api/v1/listings/789/feature
├─ Params: boost_level="vip", payment_method="mpesa"
└─ Response: {featured_listing_id: 456, amount: 15000 SOS, status: "pending"}

FEATURED_LISTING CREATED (Database)
├─ listing_id: 789
├─ owner_id: seller_123
├─ boost_level: "vip"
├─ amount_paid: 15000
├─ status: "pending"
├─ payment_status: "pending"
└─ created_at: 2026-07-15 14:00:00

EVENT: payments.featured_listing.initiated
├─ Kafka Topic: suqafuran.payments.events
├─ Payload: featured_listing_id, amount, boost_level, duration_days
└─ Consumers: Analytics (log revenue), Payment tracking system

NOTIFICATION: payments.featured_listing.initiated
├─ Recipient: seller_123 (Seller)
├─ Channels: SMS, Push
├─ Template: "feature_listing_payment_prompt"
├─ Message: "Complete payment to feature 'Samsung TV'!"
│           "VIP Boost: 15,000 SOS for 30 days"
│           "Tap to pay: [M-Pesa USSD link]"
└─ Services: Africa's Talking (SMS) + Firebase (Push)

---

[Time: 2:15 PM - Payment Success]
M-PESA CALLBACK: POST /api/v1/listings/webhooks/payment-success
├─ featured_listing_id: 456
├─ payment_reference: "MPA123456789"
├─ amount_paid: 15000
└─ Response: {"status": "activated"}

FEATURED_LISTING UPDATE (Database)
├─ status: "pending" → "active"
├─ payment_status: "pending" → "success"
├─ payment_reference: "MPA123456789"
├─ activated_at: 2026-07-15 14:15:00
└─ expires_at: 2026-08-15 14:15:00 (30 days later)

LISTING UPDATE (Database)
├─ boost_level: 0 → 2 (VIP)
└─ boost_expires_at: 2026-08-15 14:15:00

EVENT: payments.featured_listing.success
├─ Kafka Topic: suqafuran.payments.events
├─ Payload: featured_listing_id, listing_id, amount, expires_at
└─ Consumers: Analytics (track revenue success), Dashboard

NOTIFICATION: payments.featured_listing.success
├─ Recipient: seller_123 (Seller)
├─ Channels: Email, SMS, Push
├─ Template: "feature_listing_payment_confirmed"
├─ Message: "🎉 Payment confirmed! Samsung TV is now featured!"
│           "Your listing gets priority placement for 30 days (until Aug 15)"
│           "Track performance: [analytics link]"
└─ Services: Resend (Email) + Africa's Talking (SMS) + Firebase (Push)

CUSTOMER EXPERIENCE
├─ Featured listings page: "Samsung TV" at top with "VIP" badge
├─ Category pages: Shows in featured section (if viewing)
├─ Search results: Ranked higher (boost_level scoring)
└─ Analytics: Impressions/clicks tracked separately

---

[Time: 2:30 PM - Listing Status]
Database View:
├─ Listing 789:
│  ├─ status: "active" ← Visible
│  ├─ moderation_status: "approved"
│  ├─ boost_level: 2 (VIP)
│  └─ boost_expires_at: 2026-08-15
│
└─ FeaturedListing 456:
   ├─ status: "active"
   ├─ payment_status: "success"
   ├─ impressions: 0 (will track)
   └─ clicks: 0 (will track)

---

[Time: 2026-08-15 2:15 PM - Boost Expires]
BACKGROUND JOB: Check expired featured listings
├─ Query: FeaturedListing with expires_at < NOW
├─ Action: status="active" → "expired"
├─ Update Listing: boost_level=2 → 0 (remove boost)
└─ Notify seller: "Your VIP boost ended. Want to feature again?"

NOTIFICATION: (Optional) featured_listing.expired
├─ Recipient: seller_123
├─ Message: "Your feature boost for 'Samsung TV' has ended."
│           "Extend boost for 30 more days?"
└─ Link: [Feature again]
```

## Notification Mapping Configuration

These events trigger notifications automatically:

| Event Type | Recipient | Channels | Template | Notes |
|------------|-----------|----------|----------|-------|
| `catalog.product.created_pending_moderation` | Seller | SMS, Push | listing_submitted_for_review | Submission confirmation |
| `catalog.product.pending_moderation` | Admins | Email, Push | admin_listing_requires_moderation | Moderation alert |
| `catalog.product.approved` | Seller | Email, SMS, Push | listing_approved | Go live notification |
| `catalog.product.rejected` | Seller | Email, SMS | listing_rejected | With reason + appeal link |
| `payments.featured_listing.initiated` | Seller | SMS, Push | feature_listing_payment_prompt | Payment prompt |
| `payments.featured_listing.success` | Seller | Email, SMS, Push | feature_listing_payment_confirmed | Boost activated |
| `payments.featured_listing.failed` | Seller | Email, SMS, Push | feature_listing_payment_failed | Retry prompt |

## Integration with Existing Systems

### Search (Elasticsearch)
```python
# Consumer listens to catalog.product events
When "catalog.product.approved" arrives:
├─ Add to index (products)
├─ Set visible=true
└─ Update category counts

When "catalog.product.rejected" arrives:
├─ Remove from index OR mark visible=false
```

### Analytics
```python
# Separate consumer tracks metrics
When any catalog/payment event arrives:
├─ Track: new listings per hour
├─ Track: moderation time (approve - create)
├─ Track: feature revenue per seller
├─ Track: feature boost level distribution
└─ Dashboard: Admin monitoring
```

### WebSocket (Real-time Updates)
```python
# Consumer broadcasts to connected clients
When "catalog.product.approved" arrives:
├─ Broadcast to: customers in category
├─ Broadcast to: search results watchers
├─ Message: "New item available: Samsung TV"
├─ Auto-refresh: Category page in real-time
└─ No page reload needed for customers
```

## Payment Integration Checklist

- [x] Model structure (FeaturedListing)
- [x] API endpoints (create, success, failure webhooks)
- [x] Kafka event publishing
- [x] Notification templates
- [ ] M-Pesa integration (implement in `listings_complete.py`)
- [ ] Stripe integration (optional)
- [ ] PayPal integration (optional)
- [ ] Payment gateway abstraction layer
- [ ] Webhook signature verification
- [ ] Reconciliation logic (DB vs payment provider)
- [ ] Refund handling

## Moderation Integration Checklist

- [x] Model fields (moderation_status, moderator_id, etc.)
- [x] Admin endpoints (approve, reject)
- [x] Kafka events
- [x] Notifications
- [ ] Admin dashboard (UI to review pending listings)
- [ ] Fraud detection (image hashing, risk scoring)
- [ ] Appeal system
- [ ] Moderation metrics/SLA tracking
- [ ] Automated moderation (auto-approve low-risk items)

## Performance Considerations

### Database Indexes
```sql
CREATE INDEX idx_listing_moderation ON listing(moderation_status, created_at);
CREATE INDEX idx_listing_status ON listing(status, moderated_at);
CREATE INDEX idx_featured_listing_status ON featured_listing(status, expires_at);
```

### Kafka Partitioning
```
suqafuran.catalog.events: 3 partitions (partition by owner_id)
suqafuran.payments.events: 3 partitions (partition by owner_id)
suqafuran.notifications.dispatch: 3 partitions (partition by user_id)
```

### Caching
```python
# Cache listing moderation status (5 min TTL)
cache.set(f"listing:{id}:moderation", status, ttl=300)

# Cache featured listings (1 min TTL for real-time updates)
cache.set(f"featured_listings:active", [...], ttl=60)
```

## Testing Scenarios

### Scenario 1: Happy Path
1. Seller creates listing → SMS ✓
2. Admin reviews → Email ✓
3. Listing goes live → SMS + Push ✓
4. Seller features it → SMS ✓
5. Payment succeeds → Email + SMS + Push ✓

### Scenario 2: Rejection
1. Seller creates listing
2. Admin rejects with reason
3. Seller gets email + SMS with reason
4. Seller clicks appeal link
5. Appeal created in support system

### Scenario 3: Payment Failure
1. Seller features listing
2. Receives payment prompt (SMS + Push)
3. M-Pesa payment fails
4. Receives retry prompt (Email + SMS)
5. Retries payment
6. Payment succeeds

## Monitoring & Alerts

### Metrics to Track
- Listing creation rate
- Moderation approval rate
- Moderation rejection rate
- Average moderation time
- Featured listing revenue
- Payment success rate
- Notification delivery rate
- Kafka consumer lag

### Alerts to Set
- Moderation queue > 100 items
- Payment webhook failures > 5
- Notification dispatch failures > 10
- Featured listing payment failed for seller > 2x
- Kafka consumer lag > 1000 messages
