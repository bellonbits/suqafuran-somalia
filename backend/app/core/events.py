from typing import Any, Dict, Optional
from app.tasks.email_tasks import dispatch_growth_email_task
from app.services.kafka_service import kafka_service


def trigger_event(
    event_name: str,
    payload: Dict[str, Any],
    user_id: Optional[int] = None,
    campaign_id: Optional[str] = None
) -> None:
    """
    Unified operational Event Bus to trigger enterprise growth campaigns, transactional receipts,
    moderation actions, and security warning alerts across the Suqafuran ecosystem.
    Delegates all dispatches asynchronously to background Celery / Redis queues.
    Also streams events in real-time to Confluent Kafka event brokers.
    """
    # Stream event in real-time to Confluent Kafka
    business_id = payload.get("business_id")
    kafka_service.send_event(
        event_type=event_name,
        payload=payload,
        key=str(business_id) if business_id else (str(user_id) if user_id else None)
    )

    email = payload.get("email")
    if not email:
        return

    # Onboarding Activation Triggers
    if event_name == "USER_REGISTERED":
        # Immediate welcome email
        dispatch_growth_email_task.delay(
            email_type="welcome",
            email=email,
            context={"name": payload.get("name", "there")},
            user_id=user_id,
            campaign_id=campaign_id or "onb_welcome_v1"
        )
        # Schedule completion warning: 2 hours later
        dispatch_growth_email_task.apply_async(
            kwargs={
                "email_type": "complete_profile",
                "email": email,
                "context": {"name": payload.get("name", "there")},
                "user_id": user_id,
                "campaign_id": campaign_id or "onb_profile_v1"
            },
            countdown=7200
        )
        # Schedule seller first action nudge: 24 hours later
        dispatch_growth_email_task.apply_async(
            kwargs={
                "email_type": "first_action",
                "email": email,
                "context": {"name": payload.get("name", "there"), "user_type": payload.get("user_type", "seller")},
                "user_id": user_id,
                "campaign_id": campaign_id or "onb_first_action_v1"
            },
            countdown=86400
        )

    # Trust, Safety and Account Actions
    elif event_name == "SECURITY_ALERT_SUSPICIOUS":
        dispatch_growth_email_task.delay(
            email_type="suspicious",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "ip": payload.get("ip", "unknown"),
                "device": payload.get("device", "unknown"),
                "timestamp": payload.get("timestamp", "just now")
            },
            user_id=user_id,
            campaign_id="sec_susp_alert"
        )
    elif event_name == "SECURITY_PASSWORD_CHANGE":
        dispatch_growth_email_task.delay(
            email_type="password_change",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "ip": payload.get("ip", "unknown"),
                "timestamp": payload.get("timestamp", "just now")
            },
            user_id=user_id,
            campaign_id="sec_pwd_alert"
        )
    elif event_name == "SECURITY_NEW_DEVICE":
        dispatch_growth_email_task.delay(
            email_type="new_device",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "device": payload.get("device", "unknown"),
                "location": payload.get("location", "unknown"),
                "timestamp": payload.get("timestamp", "just now"),
                "ip": payload.get("ip", "unknown")
            },
            user_id=user_id,
            campaign_id="sec_device_alert"
        )
    elif event_name == "SCAM_WARNING":
        dispatch_growth_email_task.delay(
            email_type="scam_warning",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "reason": payload.get("reason", "Suspicious transaction parameters flagged.")
            },
            user_id=user_id,
            campaign_id="sec_scam_warning"
        )

    # Core Marketplace Activity & Conversions
    elif event_name == "PRICE_CHANGED":
        dispatch_growth_email_task.delay(
            email_type="price_drop",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "listing_title": payload.get("listing_title"),
                "old_price": payload.get("old_price"),
                "new_price": payload.get("new_price"),
                "listing_id": payload.get("listing_id"),
                "image_url": payload.get("image_url")
            },
            user_id=user_id,
            campaign_id="mkt_price_drop"
        )
    elif event_name == "NEW_LISTING_MATCH":
        dispatch_growth_email_task.delay(
            email_type="new_listing",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "listing_title": payload.get("listing_title"),
                "price": payload.get("price"),
                "location": payload.get("location"),
                "category": payload.get("category"),
                "listing_id": payload.get("listing_id"),
                "image_url": payload.get("image_url")
            },
            user_id=user_id,
            campaign_id="mkt_new_listing_alert"
        )

    # Transactional Dispatches
    elif event_name == "PAYMENT_RECEIPT":
        dispatch_growth_email_task.delay(
            email_type="receipt",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "items": payload.get("items", []),
                "total_amount": payload.get("total_amount"),
                "tx_ref": payload.get("tx_ref"),
                "payment_method": payload.get("payment_method")
            },
            user_id=user_id,
            campaign_id="tx_receipt"
        )
    elif event_name == "ORDER_CONFIRMED":
        dispatch_growth_email_task.delay(
            email_type="order_confirmation",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "order_id": payload.get("order_id"),
                "item_title": payload.get("item_title"),
                "seller_name": payload.get("seller_name"),
                "delivery_estimate": payload.get("delivery_estimate")
            },
            user_id=user_id,
            campaign_id="tx_order_confirm"
        )
    elif event_name == "MESSAGE_RECEIVED":
        dispatch_growth_email_task.delay(
            email_type="message",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "sender_name": payload.get("sender_name"),
                "message_excerpt": payload.get("message_excerpt"),
                "chat_url": payload.get("chat_url")
            },
            user_id=user_id,
            campaign_id="tx_chat_msg"
        )
    elif event_name == "OFFER_RECEIVED":
        dispatch_growth_email_task.delay(
            email_type="offer_received",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "item_title": payload.get("item_title"),
                "offer_amount": payload.get("offer_amount"),
                "offer_url": payload.get("offer_url")
            },
            user_id=user_id,
            campaign_id="tx_offer_rcvd"
        )
    elif event_name == "OFFER_RESPONSE":
        dispatch_growth_email_task.delay(
            email_type="offer_response",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "item_title": payload.get("item_title"),
                "response_status": payload.get("response_status"),
                "response_amount": payload.get("response_amount")
            },
            user_id=user_id,
            campaign_id="tx_offer_resp"
        )

    # Moderation & Catalog Violations
    elif event_name == "LISTING_MODERATED":
        dispatch_growth_email_task.delay(
            email_type="moderation_alert",
            email=email,
            context={
                "name": payload.get("name", "there"),
                "listing_title": payload.get("listing_title"),
                "violation_reason": payload.get("violation_reason"),
                "listing_id": payload.get("listing_id")
            },
            user_id=user_id,
            campaign_id="mod_violation_alert"
        )
