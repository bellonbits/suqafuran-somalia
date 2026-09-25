# Complete Listing (Ad) Creation Workflow

Full end-to-end workflow when a seller creates a product listing on Suqafuran, including moderation, notifications, and optional featured listing (paid ad) promotion.

## Overview

```
Seller Creates Listing
    ↓
POST /api/v1/listings
    ├─→ Upload images to S3
    ├─→ Create Listing in DB (moderation_status="pending", status="pending")
    ├─→ Publish Kafka event: "catalog.product.created_pending_moderation"
    │   └─→ Notify admins (email + push)
    ├─→ Send seller confirmation (SMS + push)
    └─→ Return listing ID (but NOT visible yet)
    
[ADMIN REVIEWS - Usually 1-4 hours]
    ↓
Admin Approves OR Rejects
    ├─→ Publish Kafka event: "catalog.product.approved/rejected"
    ├─→ Notify seller (email + SMS)
    └─→ If approved:
        ├─→ Listing becomes visible in search/category pages
        ├─→ Customers see the listing
        └─→ Seller can now feature it (pay for ad boost)

[OPTIONAL: SELLER FEATURES THE LISTING]
    ↓
Seller Chooses Boost Level & Pays
    ├─→ POST /api/v1/listings/{id}/feature
    ├─→ Choose boost: basic (5K SOS), vip (15K SOS), diamond (50K SOS)
    ├─→ Select payment method: M-Pesa, Stripe, PayPal
    ├─→ Create FeaturedListing record (payment_status="pending")
    ├─→ Send payment prompt (SMS + push)
    └─→ Return payment details
    
[PAYMENT PROCESSING]
    ↓
M-Pesa Payment Success/Failure
    ├─→ Webhook callback
    ├─→ Update FeaturedListing status="active" (success) or "failed"
    ├─→ Set boost_level and boost_expires_at on Listing
    ├─→ Publish payment event
    └─→ Notify seller (email + SMS)

[LISTING ACTIVE & POSSIBLY FEATURED]
    ↓
Customers See Listing
    ├─→ Regular listings: shown in category/search with normal prominence
    ├─→ Featured listings: get banner, priority position, more visibility
    └─→ Analytics tracked (impressions, clicks)
```

## Database Changes

### Updated: Listing Model

Added moderation fields:

```python
class Listing(SQLModel, table=True):
    # ... existing fields ...
    
    # NEW: Moderation tracking
    moderation_status: str  # "pending", "approved", "rejected"
    moderated_at: Optional[datetime]
    moderator_id: Optional[int]  # Which admin reviewed it
    moderation_notes: Optional[str]  # Why rejected
    
    # EXISTING: Activation/Visibility
    status: str  # "pending", "active", "closed", "deleted"
```

### New: FeaturedListing Model

```python
class FeaturedListing(SQLModel, table=True):
    id: int (primary key)
    listing_id: int (foreign key → Listing)
    owner_id: int (seller)
    boost_level: str  # "basic", "vip", "diamond"
    amount_paid: float  # 5000, 15000, or 50000
    duration_days: int  # Usually 30
    status: str  # "pending", "active", "expired", "cancelled"
    payment_status: str  # "pending", "processing", "success", "failed"
    payment_method: str  # "mpesa", "stripe", etc
    payment_reference: str  # Transaction ID
    
    created_at: datetime
    activated_at: Optional[datetime]  # When payment succeeded
    expires_at: Optional[datetime]  # When boost ends
    
    impressions: int  # Analytics
    clicks: int  # Analytics
```

## API Endpoints

### 1. Create Listing (Seller)

```bash
POST /api/v1/listings
Content-Type: multipart/form-data

{
  "title_en": "Samsung 65-inch Smart TV",
  "title_so": "Telefishin Samsung 65-inch",
  "description_en": "Brand new, with warranty...",
  "price": 45000,
  "location": "Mogadishu",
  "condition": "New",
  "category_id": 5,
  "subcategory_id": 12,
  "images": [file1.jpg, file2.jpg, file3.jpg]
}

Response:
{
  "id": 789,
  "status": "pending",
  "moderation_status": "pending",
  "message": "Listing submitted for review. You'll be notified within 4 hours."
}
```

**Events Published:**
- `catalog.product.created_pending_moderation` → Notify admins
- Seller gets SMS/push: "Your listing is being reviewed..."

### 2. Admin Approves Listing

```bash
POST /api/v1/listings/{listing_id}/approve
Content-Type: application/json

{
  "moderation_notes": "Product photo quality good, price reasonable"
}

Response:
{
  "status": "approved",
  "listing_id": 789
}
```

**What Happens:**
- Listing status → "active" (now visible)
- Moderation status → "approved"
- Seller notified: "Your listing is live!" (email + SMS + push)
- Customers can now see it in category pages and search

**Events Published:**
- `catalog.product.approved` → Notify seller

### 3. Admin Rejects Listing

```bash
POST /api/v1/listings/{listing_id}/reject
Content-Type: application/json

{
  "rejection_reason": "Violates pricing policy - too high for this category",
  "moderation_notes": "Price is 3x market average. Ask seller to adjust."
}

Response:
{
  "status": "rejected",
  "listing_id": 789,
  "reason": "Violates pricing policy - too high for this category"
}
```

**What Happens:**
- Listing status → "deleted" (hidden from search)
- Moderation status → "rejected"
- Seller notified with reason and appeal link (email + SMS)
- Seller can edit and resubmit

**Events Published:**
- `catalog.product.rejected` → Notify seller with appeal instructions

### 4. Feature Listing (Paid Ad)

```bash
POST /api/v1/listings/{listing_id}/feature
Content-Type: application/json

{
  "boost_level": "vip",  # "basic", "vip", or "diamond"
  "payment_method": "mpesa"  # "mpesa", "stripe", or "paypal"
}

Response:
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

**Boost Pricing:**
- **Basic**: 5,000 SOS / 30 days (slight priority in listings)
- **VIP**: 15,000 SOS / 30 days (featured banner, top positions)
- **Diamond**: 50,000 SOS / 30 days (prominent placement, all pages)

**Events Published:**
- `payments.featured_listing.initiated` → Prompt seller to pay (SMS + push)

### 5. Payment Callback (M-Pesa Webhook)

**Success:**
```bash
POST /api/v1/listings/webhooks/payment-success
{
  "featured_listing_id": 456,
  "payment_reference": "MPA123456789",
  "amount_paid": 15000
}

Response:
{
  "status": "activated"
}
```

**What Happens:**
- FeaturedListing status → "active"
- Listing boost_level → 2 (vip)
- Listing boost_expires_at → 30 days from now
- Seller notified: "Your listing is now featured!" (email + SMS + push)

**Events Published:**
- `payments.featured_listing.success` → Notify seller

---

**Failure:**
```bash
POST /api/v1/listings/webhooks/payment-failed
{
  "featured_listing_id": 456,
  "failure_reason": "Insufficient funds"
}

Response:
{
  "status": "failed",
  "reason": "Insufficient funds"
}
```

**What Happens:**
- FeaturedListing payment_status → "failed"
- FeaturedListing remains "pending" (allow retry)
- Seller notified: "Payment failed. Retry here: [link]" (email + SMS)

**Events Published:**
- `payments.featured_listing.failed` → Notify seller to retry

---

## Notifications Sent

### To Seller

| Trigger | Channels | Template | Content |
|---------|----------|----------|---------|
| Listing submitted | SMS, Push | `listing_submitted_for_review` | "Your listing is being reviewed..." |
| Listing approved | Email, SMS, Push | `listing_approved` | "Great! Your listing is live. Start selling!" |
| Listing rejected | Email, SMS | `listing_rejected` | "Your listing was rejected: [reason]. Appeal: [link]" |
| Feature payment prompt | SMS, Push | `feature_listing_payment_prompt` | "Boost your listing visibility? Tap to feature: [link]" |
| Feature payment success | Email, SMS, Push | `feature_listing_payment_confirmed` | "Featured! Your listing gets priority placement for 30 days." |
| Feature payment failed | Email, SMS, Push | `feature_listing_payment_failed` | "Payment failed. Retry here: [link]" |

### To Admins

| Trigger | Channels | Template | Content |
|---------|----------|----------|---------|
| Listing pending review | Email, Push | `admin_listing_requires_moderation` | "New listing to review: [seller_name] - [title]. [link to review]" |

## Kafka Events Published

All events published with standard envelope (event_id, timestamp, correlation_id, etc.):

```python
"catalog.product.created_pending_moderation": {
    "listing_id": "789",
    "owner_id": "seller_123",
    "title": "Samsung TV",
    "price": 45000,
    "category_id": 5,
}

"catalog.product.approved": {
    "listing_id": "789",
    "owner_id": "seller_123",
    "title": "Samsung TV",
    "approved_by": "Admin Name",
}

"catalog.product.rejected": {
    "listing_id": "789",
    "owner_id": "seller_123",
    "rejection_reason": "Violates policy",
    "rejected_by": "Admin Name",
}

"payments.featured_listing.initiated": {
    "featured_listing_id": "456",
    "listing_id": "789",
    "seller_id": "seller_123",
    "boost_level": "vip",
    "amount": 15000,
}

"payments.featured_listing.success": {
    "featured_listing_id": "456",
    "listing_id": "789",
    "seller_id": "seller_123",
    "amount": 15000,
    "expires_at": "2026-08-15T...",
}

"payments.featured_listing.failed": {
    "featured_listing_id": "456",
    "listing_id": "789",
    "failure_reason": "Insufficient funds",
}
```

## Timeline Example

```
2026-07-15 10:00 AM
  └─ Seller creates listing "Samsung TV"
     └─ Status: pending
     └─ Moderation: pending
     └─ SMS: "Your listing is being reviewed..."

2026-07-15 11:30 AM
  └─ Admin reviews & approves
     └─ Status: active (now visible!)
     └─ Moderation: approved
     └─ Email + SMS: "Your listing is live!"
     └─ Customers see it in category pages

2026-07-15 02:00 PM
  └─ Seller decides to feature it
     └─ Selects "VIP" boost (15,000 SOS)
     └─ Pays via M-Pesa
     └─ SMS: "Complete payment: [USSD link]"

2026-07-15 02:15 PM
  └─ Payment succeeds
     └─ FeaturedListing: active
     └─ Listing: boost_level=2 (vip)
     └─ Email + SMS: "Featured for 30 days!"
     └─ Listing now appears with VIP badge

2026-08-15 02:15 PM
  └─ Featured period expires
     └─ Listing goes back to regular visibility
     └─ Optional: SMS reminder "Feature expired. Boost again?"
```

## Integration Checklist

- [x] Updated Listing model with moderation fields
- [x] Created FeaturedListing model for paid ads
- [x] Created complete API endpoints (create, approve, reject, feature)
- [x] Added Kafka events for all workflow stages
- [x] Added notification templates in config
- [x] Payment webhook handling (success/failure)
- [ ] Create moderation admin dashboard to review pending listings
- [ ] Implement S3 image upload in `upload_image_to_s3()`
- [ ] Implement payment processing integration (M-Pesa, Stripe, PayPal)
- [ ] Add analytics tracking (impressions, clicks for featured listings)
- [ ] Create appeal system for rejected listings
- [ ] Set up background job to expire featured listings after duration_days

## Features Enabled

✅ **Seller Controls:**
- Create listings (submitted for review)
- See moderation status
- Receive notifications on approval/rejection
- Appeal rejections
- Pay to feature listings
- Track ad performance (impressions, clicks)

✅ **Admin Controls:**
- Review pending listings
- Approve/reject with notes
- Track moderation metrics
- See fraud risk scores

✅ **Customer Experience:**
- See only approved listings
- See featured listings with priority/banner
- Real-time visibility when listings go live
- Trust in platform quality (everything is moderated)

✅ **Monetization:**
- Featured listing fees (basic/vip/diamond)
- Flexible duration (30, 60, 90 days, etc.)
- Payment processing for multiple methods
- Revenue tracking per seller

✅ **Safety:**
- All listings reviewed before visibility
- Fraud detection (image hashing, risk scoring)
- Appeal process for false rejections
- Audit trail (who approved/rejected, when, why)
