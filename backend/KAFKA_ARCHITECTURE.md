# Suqafuran Kafka Architecture

Complete event-driven architecture using Kafka as the central event bus for domain events and notifications.

## Architecture Overview

```
FastAPI Endpoints
    ↓
    ├─→ kafka_producer.publish_event()  [Domain Events]
    │   └─→ Kafka Topics (auth, catalog, orders, payments, riders)
    │       └─→ Event Consumers (WebSocket bridge, analytics, etc)
    │
    └─→ Business Logic
        ↓
        └─→ Determine what to notify
            └─→ publish_notification_dispatch()
                └─→ suqafuran.notifications.dispatch topic
                    └─→ NotificationConsumer
                        └─→ Look up config in NOTIFICATION_MAPPING
                            └─→ Trigger Celery tasks
                                ├─→ send_email_task  (Resend)
                                ├─→ send_sms_task    (Africa's Talking)
                                └─→ send_push_notification_task (Firebase)
```

## Components

### 1. Kafka Producer Wrapper (`kafka_producer.py`)

Publishes domain events with standard envelope format.

**Key Files:**
- `app/services/kafka_producer.py` - Producer implementation
- `app/core/config.py` - Should have `KAFKA_BOOTSTRAP_SERVERS` setting

**Standard Event Envelope:**
```python
{
    "event_id": "uuid",                    # Unique event identifier
    "event_type": "auth.signup.success",   # domain.entity.outcome
    "timestamp": "2026-07-15T...",         # ISO 8601 timestamp
    "user_id": "user_123",                 # Who this event is about
    "source": "api",                       # Origin: api, scheduled, internal
    "correlation_id": "uuid",              # Trace ID for distributed tracing
    "payload": {...},                      # Event-specific data
    "metadata": {"ip": "...", ...}         # Additional context
}
```

**Usage in Endpoints:**

```python
from app.services.kafka_producer import (
    publish_auth_event,
    publish_order_event,
    publish_payment_event,
    publish_notification_dispatch,
)

# Auth signup - publish event BEFORE returning to client
@router.post("/auth/signup")
async def signup(data: SignupRequest):
    user = create_user(data)
    
    # Publish signup event
    await publish_auth_event(
        event_type="signup.success",
        payload={
            "user_id": user.id,
            "email": user.email,
            "country": user.country,
        },
        user_id=str(user.id),
    )
    
    # Also trigger notification dispatch
    await publish_notification_dispatch(
        user_id=str(user.id),
        event_type="auth.signup.success",
        channels=["email", "sms"],
        template="welcome",
        data={"name": user.name, "email": user.email},
    )
    
    return user

# Order creation
@router.post("/orders")
async def create_order(data: OrderRequest):
    order = db.create_order(data)
    
    await publish_order_event(
        event_type="order.created",
        payload={
            "order_id": order.id,
            "buyer_id": data.buyer_id,
            "total": order.total,
            "items": [item.to_dict() for item in order.items],
        },
        order_id=order.id,
        user_id=str(data.buyer_id),
    )
    
    # Notify buyer
    await publish_notification_dispatch(
        user_id=str(data.buyer_id),
        event_type="orders.order.created",
        channels=["email", "sms", "push"],
        template="order_confirmation",
        data={
            "order_id": order.id,
            "amount": order.total,
            "eta": "45 mins",
        },
    )
    
    return order
```

### 2. Notification Consumer (`notification_consumer.py`)

Reads from `suqafuran.notifications.dispatch` topic and triggers Celery tasks.

**Key Files:**
- `app/services/notification_consumer.py` - Consumer implementation
- `app/services/notification_config.py` - Event → channels + templates mapping

**How it Works:**

1. Listens to `suqafuran.notifications.dispatch` topic
2. Receives notification dispatch events
3. Looks up event type in `NOTIFICATION_MAPPING`
4. For each enabled channel, triggers corresponding Celery task
5. Each task handles external API communication (Resend, Africa's Talking, Firebase)

**Starting the Consumer:**

Add to `main.py` startup (already done):

```python
from app.services.notification_consumer import notification_consumer
import asyncio

@app.on_event("startup")
async def start_notification_consumer():
    # In a real deployment, run this in a separate worker process/container
    # For development, you can run it in the same process:
    asyncio.create_task(notification_consumer.process_events())
```

For production, run as a separate Celery worker:

```bash
# Terminal 1: API
python -m uvicorn app.main:app

# Terminal 2: Notification Consumer (separate process)
celery -A app.tasks.celery_app worker -Q notifications -l info
```

### 3. Notification Config (`notification_config.py`)

Central mapping of event types to notification channels and templates.

**Adding New Notifications - No Code Required!**

Just add an entry to `NOTIFICATION_MAPPING`:

```python
"payments.refund.completed": {
    "channels": ["email", "sms", "push"],
    "templates": {
        "email": "refund_completed",
        "sms": "refund_completed_sms",
        "push": "refund_completed_push",
    },
    "enabled": True,
},
```

**Config Structure:**

```python
NOTIFICATION_MAPPING = {
    "event.type.here": {
        "channels": ["email", "sms", "push"],  # Which services to use
        "templates": {
            "email": "resend_template_id",      # Service-specific template IDs
            "sms": "africastalking_template",
            "push": "firebase_title_body",
        },
        "enabled": True/False,                  # Toggle notifications on/off
    }
}
```

## Kafka Topics

These should be created before deployment:

```bash
# Inside the kafka container, or via kafka-topics CLI

# Domain event topics (retention: 7 days)
kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.auth.events \
  --partitions 3 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.catalog.events \
  --partitions 3 --replication-factor 1

kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.orders.events \
  --partitions 5 --replication-factor 1

kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.payments.events \
  --partitions 3 --replication-factor 1

kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.riders.events \
  --partitions 3 --replication-factor 1

# Notification topics
kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.notifications.dispatch \
  --partitions 3 --replication-factor 1

kafka-topics --bootstrap-server localhost:29092 --create \
  --topic suqafuran.notifications.status \
  --partitions 3 --replication-factor 1
```

## Celery Tasks

Three core notification tasks are defined in `app/tasks/notification_tasks.py`:

### `send_email_task`
```python
@shared_task(bind=True, max_retries=3)
def send_email_task(
    user_id: str,
    template: str,
    template_data: Dict,
    correlation_id: str,
):
    # TODO: Implement Resend API call
    # Uses template names from notification_config.py
```

### `send_sms_task`
```python
@shared_task(bind=True, max_retries=3)
def send_sms_task(
    user_id: str,
    template: str,
    template_data: Dict,
    correlation_id: str,
):
    # TODO: Implement Africa's Talking API call
```

### `send_push_notification_task`
```python
@shared_task(bind=True, max_retries=3)
def send_push_notification_task(
    user_id: str,
    template: str,
    template_data: Dict,
    correlation_id: str,
):
    # TODO: Implement Firebase Cloud Messaging API call
```

## Event Types Reference

### Auth Events
- `auth.signup.success` - User registered
- `auth.signup.failed` - Registration failed
- `auth.login.success` - User logged in
- `auth.password_reset.requested` - Password reset initiated
- `auth.password_reset.completed` - Password reset finished

### Catalog Events
- `catalog.product.stock_low` - Low inventory alert
- `catalog.product.out_of_stock` - Product unavailable
- `catalog.shop.verified` - Shop approved
- `catalog.shop.suspended` - Shop banned

### Order Events
- `orders.order.created` - Order placed
- `orders.order.confirmed_by_seller` - Seller accepted
- `orders.order.cancelled` - Order cancelled
- `orders.order.rejected` - Seller rejected

### Payment Events
- `payments.payment.success` - Payment processed
- `payments.payment.failed` - Payment declined
- `payments.mpesa.initiated` - M-Pesa prompt sent
- `payments.mpesa.completed` - M-Pesa confirmed
- `payments.mpesa.failed` - M-Pesa failed
- `payments.refund.initiated` - Refund processing
- `payments.refund.completed` - Refund finished

### Rider Events
- `riders.delivery.assigned` - Rider assigned
- `riders.delivery.picked_up` - Package picked up
- `riders.delivery.in_transit` - En route
- `riders.delivery.completed` - Delivered
- `riders.delivery.failed` - Delivery failed

## Implementation Checklist

- [x] Create producer wrapper (`kafka_producer.py`)
- [x] Create consumer skeleton (`notification_consumer.py`)
- [x] Create notification config (`notification_config.py`)
- [x] Create Celery tasks (`notification_tasks.py`)
- [x] Integrate producer into app startup
- [ ] Create Kafka topics in production
- [ ] Implement Resend email integration
- [ ] Implement Africa's Talking SMS integration
- [ ] Implement Firebase Cloud Messaging integration
- [ ] Add event publishing to all domain endpoints
- [ ] Test end-to-end: Event → Kafka → Consumer → Celery → External Service
- [ ] Monitor consumer lag via Kafdrop dashboard

## Testing

### Test Producer
```python
import asyncio
from app.services.kafka_producer import kafka_producer, publish_order_event

async def test():
    await kafka_producer.start()
    
    # Publish test event
    await publish_order_event(
        event_type="order.created",
        payload={
            "order_id": "test-123",
            "amount": 100,
        },
        order_id="test-123",
        user_id="user-1",
    )
    
    await kafka_producer.stop()

asyncio.run(test())
```

### Test Consumer
```python
# Run notification consumer in background
# Then send notification dispatch event
# Verify Celery tasks are queued

from app.services.kafka_producer import publish_notification_dispatch

await publish_notification_dispatch(
    user_id="user-123",
    event_type="auth.signup.success",
    channels=["email", "sms"],
    template="welcome",
    data={"name": "John"},
)

# Check Celery queue: should see send_email_task and send_sms_task
```

### Monitor via Kafdrop

Open http://localhost:9000 (Kafdrop UI) to:
- View all topics and messages
- Check consumer group lag
- See event payloads in real-time

## Production Deployment

### 1. Run API normally:
```bash
docker-compose up backend
```

### 2. Run notification consumer in separate container/process:
```bash
# Option A: Separate Celery worker for notifications
celery -A app.tasks.celery_app worker \
  -Q notifications \
  -l info \
  --concurrency=4

# Option B: Dedicated Python process
python -c "
import asyncio
from app.services.notification_consumer import notification_consumer
asyncio.run(notification_consumer.process_events())
"
```

### 3. Monitor:
- Kafdrop UI: http://localhost:9000
- Celery Flower: http://localhost:5555
- Application logs: Check CloudWatch/ELK/Datadog

## Scaling Considerations

- **Producer**: Runs in main API, scales with API instances
- **Consumer**: Single consumer group reads all notifications, can scale with multiple instances
- **Kafka Partitions**: 3 partitions per topic for reasonable throughput
- **Celery Workers**: Scale based on message rate and external API latency

## Fault Tolerance

- **Producer**: Gracefully handles Kafka unavailability (logs warning, skips event)
- **Consumer**: Auto-retry with exponential backoff on failures
- **Tasks**: Celery retry logic with max_retries=3
- **Partition Key**: Ensures order guarantee for same entity (same partition)

## Next Steps

1. Implement external service integrations:
   - Resend API for emails
   - Africa's Talking API for SMS
   - Firebase Admin SDK for push

2. Add monitoring/observability:
   - Track consumer lag
   - Monitor Celery queue depths
   - Alert on task failures

3. Create database schema for:
   - User contact preferences (opt-in/out)
   - Notification history (for audit/support)
   - Template management (if moving templates to DB)
