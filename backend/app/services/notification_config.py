"""
Notification Mapping Configuration

Config-driven mapping of events to notification channels and templates.
Adding new notifications is just updating this config dict, no code changes needed.

Format:
  event_type: {
    "channels": ["email", "sms", "push"],  # Which services to use
    "templates": {
      "email": "template_name_resend",     # Resend template ID
      "sms": "template_name_africastalking",
      "push": "template_name_firebase",
    },
    "enabled": True,
  }
"""

# NOTIFICATION_MAPPING is the single source of truth for what events trigger what notifications.
# When a domain event arrives at suqafuran.notifications.dispatch topic,
# the consumer looks it up here and queues the appropriate Celery tasks.

NOTIFICATION_MAPPING = {
    # ============== AUTH EVENTS ==============

    "auth.signup.success": {
        "channels": ["email", "sms"],
        "templates": {
            "email": "welcome_email",
            "sms": "welcome_sms",
        },
        "enabled": True,
    },

    "auth.signup.failed": {
        "channels": ["email"],
        "templates": {
            "email": "signup_failed",
        },
        "enabled": True,
    },

    "auth.login.success": {
        "channels": ["push"],
        "templates": {
            "push": "login_alert",
        },
        "enabled": True,
    },

    "auth.password_reset.requested": {
        "channels": ["email", "sms"],
        "templates": {
            "email": "password_reset_email",
            "sms": "password_reset_sms",
        },
        "enabled": True,
    },

    "auth.password_reset.completed": {
        "channels": ["email"],
        "templates": {
            "email": "password_reset_confirmed",
        },
        "enabled": True,
    },

    "auth.email_verified": {
        "channels": ["email"],
        "templates": {
            "email": "email_verified",
        },
        "enabled": True,
    },

    # ============== CATALOG EVENTS ==============

    "catalog.product.created": {
        "channels": ["push"],
        "templates": {
            "push": "product_created_notification",
        },
        "enabled": False,  # Optional - seller may not want these
    },

    "catalog.product.stock_low": {
        "channels": ["email", "push"],
        "templates": {
            "email": "low_stock_alert",
            "push": "low_stock_alert",
        },
        "enabled": True,
    },

    "catalog.product.out_of_stock": {
        "channels": ["email"],
        "templates": {
            "email": "out_of_stock_notice",
        },
        "enabled": True,
    },

    "catalog.shop.verified": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "shop_verified",
            "sms": "shop_verified_sms",
            "push": "shop_verified_push",
        },
        "enabled": True,
    },

    "catalog.shop.suspended": {
        "channels": ["email", "sms"],
        "templates": {
            "email": "shop_suspended",
            "sms": "shop_suspended_sms",
        },
        "enabled": True,
    },

    # ============== ORDER EVENTS ==============

    "orders.order.created": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "order_confirmation",
            "sms": "order_confirmation_sms",
            "push": "order_confirmation_push",
        },
        "enabled": True,
    },

    "orders.order.confirmed_by_seller": {
        "channels": ["sms", "push"],
        "templates": {
            "sms": "order_confirmed_sms",
            "push": "order_confirmed_push",
        },
        "enabled": True,
    },

    "orders.order.cancelled": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "order_cancelled",
            "sms": "order_cancelled_sms",
            "push": "order_cancelled_push",
        },
        "enabled": True,
    },

    "orders.order.rejected": {
        "channels": ["email", "push"],
        "templates": {
            "email": "order_rejected",
            "push": "order_rejected_push",
        },
        "enabled": True,
    },

    # ============== PAYMENT EVENTS ==============

    "payments.payment.initiated": {
        "channels": ["sms", "push"],
        "templates": {
            "sms": "payment_initiated_sms",
            "push": "payment_initiated_push",
        },
        "enabled": False,  # Only notify on success/failure
    },

    "payments.payment.success": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "payment_success",
            "sms": "payment_success_sms",
            "push": "payment_success_push",
        },
        "enabled": True,
    },

    "payments.payment.failed": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "payment_failed",
            "sms": "payment_failed_sms",
            "push": "payment_failed_push",
        },
        "enabled": True,
    },

    "payments.mpesa.initiated": {
        "channels": ["sms"],
        "templates": {
            "sms": "mpesa_prompt_sms",
        },
        "enabled": True,
    },

    "payments.mpesa.completed": {
        "channels": ["sms", "push"],
        "templates": {
            "sms": "mpesa_confirmed_sms",
            "push": "mpesa_confirmed_push",
        },
        "enabled": True,
    },

    "payments.mpesa.failed": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "mpesa_failed",
            "sms": "mpesa_failed_sms",
            "push": "mpesa_failed_push",
        },
        "enabled": True,
    },

    "payments.refund.initiated": {
        "channels": ["email", "sms"],
        "templates": {
            "email": "refund_initiated",
            "sms": "refund_initiated_sms",
        },
        "enabled": True,
    },

    "payments.refund.completed": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "refund_completed",
            "sms": "refund_completed_sms",
            "push": "refund_completed_push",
        },
        "enabled": True,
    },

    # ============== RIDER EVENTS ==============

    "riders.delivery.assigned": {
        "channels": ["sms", "push"],
        "templates": {
            "sms": "delivery_assigned_sms",
            "push": "delivery_assigned_push",
        },
        "enabled": True,
    },

    "riders.delivery.picked_up": {
        "channels": ["sms", "push"],
        "templates": {
            "sms": "delivery_picked_up_sms",
            "push": "delivery_picked_up_push",
        },
        "enabled": True,
    },

    "riders.delivery.in_transit": {
        "channels": ["push"],
        "templates": {
            "push": "delivery_in_transit",
        },
        "enabled": True,
    },

    "riders.delivery.completed": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "delivery_completed",
            "sms": "delivery_completed_sms",
            "push": "delivery_completed_push",
        },
        "enabled": True,
    },

    "riders.delivery.failed": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "delivery_failed",
            "sms": "delivery_failed_sms",
            "push": "delivery_failed_push",
        },
        "enabled": True,
    },

    "riders.rider.location_update": {
        "channels": [],  # Real-time via WebSocket instead
        "templates": {},
        "enabled": False,  # Don't send these as notifications
    },

    # ============== CATALOG: MODERATION & FEATURED LISTINGS ==============

    "catalog.product.pending_moderation": {
        "channels": ["email", "push"],
        "templates": {
            "email": "admin_listing_requires_moderation",
            "push": "admin_listing_requires_moderation",
        },
        "enabled": True,
    },

    "catalog.product.approved": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "listing_approved",
            "sms": "listing_approved_sms",
            "push": "listing_approved_push",
        },
        "enabled": True,
    },

    "catalog.product.rejected": {
        "channels": ["email", "sms"],
        "templates": {
            "email": "listing_rejected",
            "sms": "listing_rejected_sms",
        },
        "enabled": True,
    },

    "catalog.product.created_pending_moderation": {
        "channels": ["push", "sms"],
        "templates": {
            "push": "listing_submitted_for_review",
            "sms": "listing_submitted_for_review_sms",
        },
        "enabled": True,
    },

    # ============== FEATURED LISTINGS (PAID ADS) ==============

    "payments.featured_listing.initiated": {
        "channels": ["sms", "push"],
        "templates": {
            "sms": "feature_listing_payment_prompt_sms",
            "push": "feature_listing_payment_prompt",
        },
        "enabled": True,
    },

    "payments.featured_listing.success": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "feature_listing_payment_confirmed",
            "sms": "feature_listing_payment_confirmed_sms",
            "push": "feature_listing_payment_confirmed_push",
        },
        "enabled": True,
    },

    "payments.featured_listing.failed": {
        "channels": ["email", "sms", "push"],
        "templates": {
            "email": "feature_listing_payment_failed",
            "sms": "feature_listing_payment_failed_sms",
            "push": "feature_listing_payment_failed_push",
        },
        "enabled": True,
    },

    # ============== NOTIFICATION EVENTS ==============
    # These are meta-events for tracking notification status

    "notifications.dispatch.failed": {
        "channels": ["email"],  # Notify admin/support
        "templates": {
            "email": "notification_dispatch_failed",
        },
        "enabled": True,
    },

    "notifications.email.bounced": {
        "channels": ["email"],
        "templates": {
            "email": "email_bounced_alert",
        },
        "enabled": False,  # Optional admin alert
    },

    "notifications.sms.failed": {
        "channels": ["email"],
        "templates": {
            "email": "sms_failed_alert",
        },
        "enabled": False,  # Optional admin alert
    },
}


def get_notification_config(event_type: str) -> dict:
    """
    Get notification config for an event type.

    Args:
        event_type: Event type (e.g., "auth.signup.success")

    Returns:
        Config dict with channels, templates, enabled flag.
        Returns empty dict if not found.
    """
    return NOTIFICATION_MAPPING.get(event_type, {})


def is_notification_enabled(event_type: str) -> bool:
    """Check if notifications are enabled for an event."""
    config = get_notification_config(event_type)
    return config.get("enabled", False)


def get_channels_for_event(event_type: str) -> list:
    """Get list of channels to notify for an event."""
    config = get_notification_config(event_type)
    return config.get("channels", []) if config.get("enabled") else []


def get_templates_for_event(event_type: str) -> dict:
    """Get template names for each channel for an event."""
    config = get_notification_config(event_type)
    return config.get("templates", {}) if config.get("enabled") else {}


# Example usage in notification_consumer.py:
#
# async def handle_event(event):
#     event_type = event["payload"]["original_event_type"]
#     channels = get_channels_for_event(event_type)
#     templates = get_templates_for_event(event_type)
#
#     for channel in channels:
#         template = templates.get(channel)
#         if channel == "email":
#             send_email_task.delay(template=template, ...)
#         elif channel == "sms":
#             send_sms_task.delay(template=template, ...)
#         elif channel == "push":
#             send_push_notification_task.delay(template=template, ...)
