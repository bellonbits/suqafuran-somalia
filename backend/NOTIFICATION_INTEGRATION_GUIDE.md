# User Email Notification Integration Guide

## Overview

User notifications have been integrated into the marketplace. Here's how to add notifications to different events:

## 1. Message Notifications ✅ (Integrated)

**When:** User receives a message from another user
**Location:** `/app/api/api_v1/endpoints/messages.py`
**Status:** Ready to use

**Example:**
```python
from app.services.user_notification_service import user_notification_service
from app.crud.crud_user import crud_user

receiver = crud_user.get(db, id=receiver_id)
if receiver:
    user_notification_service.notify_new_message(
        receiver=receiver,
        sender_name="John Doe",
        message_content="Are you still selling this item?",
    )
```

---

## 2. Offer Notifications (Needs Implementation)

**When:** Seller receives an offer on their listing
**Add to:** New offers endpoint or listing update endpoint

**Integration:**
```python
from app.services.user_notification_service import user_notification_service

seller = listing.owner  # Get listing owner
user_notification_service.notify_new_offer(
    seller=seller,
    item_title=listing.title_en,
    offer_amount="15,000",
    offer_id=offer.id,
)
```

---

## 3. Price Drop Notifications (Needs Implementation)

**When:** Watched item's price decreases
**Add to:** Listing update endpoint

**Integration:**
```python
from app.services.user_notification_service import user_notification_service

# When price is updated
if new_price < old_price:
    # Get all users watching this listing
    watchers = get_listing_watchers(db, listing_id)
    for watcher in watchers:
        user_notification_service.notify_price_drop(
            user=watcher,
            item_title=listing.title_en,
            old_price=f"{old_price:,.0f}",
            new_price=f"{new_price:,.0f}",
            listing_id=listing.id,
            image_url=listing.images[0] if listing.images else None,
        )
```

---

## 4. Saved Search Alerts (Needs Implementation)

**When:** New listings match user's saved search
**Best place:** Background job or Kafka consumer

**Integration:**
```python
from app.services.user_notification_service import user_notification_service

# When new listing created
matching_searches = find_matching_saved_searches(db, listing)
for search in matching_searches:
    user_notification_service.notify_saved_search_matches(
        user=search.user,
        search_query=search.query,
        matched_listings=[listing],
    )
```

---

## 5. Order Status Updates (Needs Implementation)

**When:** Order status changes (pending → confirmed → shipped → delivered)
**Add to:** Order/checkout status update endpoint

**Integration:**
```python
from app.services.user_notification_service import user_notification_service

user_notification_service.notify_order_status_update(
    user=order.buyer,
    order_id=f"ORD_{order.id}",
    item_title=order.listing.title_en,
    status="confirmed",
    delivery_estimate="2-3 business days",
)
```

---

## User Preference: Email Notifications

All notifications respect user preference:
- Users can toggle `email_notifications` in their profile
- If disabled, no emails will be sent
- In-app notifications and push notifications still work

**Schema:**
```python
# In User model
email_notifications: bool = True
```

---

## Implementation Checklist

- [x] Message notifications integrated
- [ ] Offer notifications (create endpoint if missing)
- [ ] Price drop tracking (need watchers table)
- [ ] Saved searches (need saved_searches table)
- [ ] Order status updates (integrate with checkout)
- [ ] User preference UI (settings page)

---

## Testing

Test message notifications:
1. Send a message to another user
2. Check recipient's inbox
3. Verify email arrives with message preview

To disable for testing:
```bash
# In .env
EMAIL_NOTIFICATIONS_ENABLED=false
```

---

## Email Templates Used

- `send_message_notification()` - New message alert
- `send_offer_received()` - New offer alert
- `send_price_drop_alert()` - Price decrease alert
- `send_saved_search_alert()` - Matching listings
- `send_order_confirmation()` - Order status update

All templates are styled with Suqafuran branding and support dark mode.
