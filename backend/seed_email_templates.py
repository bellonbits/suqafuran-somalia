"""
One-off script: call every system email method with {{placeholder}} arguments,
capture what HTML/subject/title/subtitle it produces (by intercepting the
template-building calls instead of actually sending), and insert each as an
EmailTemplate row so they're visible/editable in the admin UI.

Run once: .venv/bin/python seed_email_templates.py
"""
from app.services.email_service import EmailService, email_service
from sqlalchemy import create_engine, text
from app.core.config import settings
import json
import re

captured_title_subtitle = []
captured_records = []

_orig_get_base_template = EmailService._get_base_template
_orig_send_and_log = EmailService._send_and_log


def patched_get_base_template(self, title, subtitle, content):
    captured_title_subtitle.append((title, subtitle))
    return _orig_get_base_template(self, title, subtitle, content)


def patched_send_and_log(self, email, subject, html_body, email_type, user_id=None, campaign_id=None, metadata=None):
    title, subtitle = captured_title_subtitle[-1] if captured_title_subtitle else ("", "")
    captured_records.append({
        "event_type": email_type,
        "title": title,
        "subtitle": subtitle,
        "subject": subject,
        "html_body": html_body,
    })
    return True  # pretend it sent


EmailService._get_base_template = patched_get_base_template
EmailService._send_and_log = patched_send_and_log

P = "{{name}}"  # generic placeholder for recipient name
EMAIL = "placeholder@example.com"

item = lambda i: {"title": f"{{{{item_{i}_title}}}}", "price": f"{{{{item_{i}_price}}}}", "id": 0, "location": f"{{{{item_{i}_location}}}}", "image_url": None}

calls = [
    lambda: email_service.send_welcome_email(EMAIL, P),
    lambda: email_service.send_complete_profile_email(EMAIL, P),
    lambda: email_service.send_first_action_prompt_email(EMAIL, P, "buyer"),
    lambda: email_service.send_new_listing_alert(EMAIL, P, "{{listing_title}}", "{{price}}", "{{location}}", "{{category}}", "{{listing_id}}"),
    lambda: email_service.send_saved_search_alert(EMAIL, P, "{{search_query}}", [item(1)]),
    lambda: email_service.send_price_drop_alert(EMAIL, P, "{{listing_title}}", "{{old_price}}", "{{new_price}}", "{{listing_id}}"),
    lambda: email_service.send_trending_items_email(EMAIL, P, "{{location}}", [item(1), item(2)]),
    lambda: email_service.send_message_notification(EMAIL, P, "{{sender_name}}", "{{message_excerpt}}", "{{chat_url}}"),
    lambda: email_service.send_offer_received(EMAIL, P, "{{item_title}}", "{{offer_amount}}", "{{offer_url}}"),
    lambda: email_service.send_offer_response(EMAIL, P, "{{item_title}}", "{{response_status}}", "{{response_amount}}"),
    lambda: email_service.send_deal_update(EMAIL, P, "{{item_title}}", "{{status}}"),
    lambda: email_service.send_suspicious_activity_alert(EMAIL, P, "{{ip}}", "{{device}}", "{{timestamp}}"),
    lambda: email_service.send_scam_warning_alert(EMAIL, P, "{{reason}}"),
    lambda: email_service.send_account_protection_alert(EMAIL, P, "{{action}}"),
    lambda: email_service.send_password_change_alert(EMAIL, P, "{{timestamp}}", "{{ip}}"),
    lambda: email_service.send_new_device_login_alert(EMAIL, P, "{{device}}", "{{location}}", "{{timestamp}}", "{{ip}}"),
    lambda: email_service.send_profile_updated_email(EMAIL, P, ["{{changed_field}}"], "{{timestamp}}"),
    lambda: email_service.send_account_deleted_email(EMAIL, P),
    lambda: email_service.send_account_deactivated_email(EMAIL, P, "{{reason}}"),
    lambda: email_service.send_new_follower_email(EMAIL, P, "{{follower_name}}", "{{follower_profile_url}}"),
    lambda: email_service.send_listing_removed_email(EMAIL, P, "{{listing_title}}", "{{removal_reason}}"),
    lambda: email_service.send_weekly_digest(EMAIL, P, "{{location}}", [item(1)], [{"name": "{{category_name}}"}]),
    lambda: email_service.send_reengagement_email(EMAIL, P, "{{reason}}", [item(1), item(2)]),
    lambda: email_service.send_abandoned_action_email(EMAIL, P, "listing"),
    lambda: email_service.send_recommended_items_email(EMAIL, P, [item(1), item(2)]),
    lambda: email_service.send_category_interest_email(EMAIL, P, "{{category_name}}", [item(1), item(2)]),
    lambda: email_service.send_market_summary_email(EMAIL, P, "{{location}}", "{{average_price_change}}", ["{{keyword_1}}", "{{keyword_2}}"]),
    lambda: email_service.send_seller_tips(EMAIL, P),
    lambda: email_service.send_listing_performance_email(EMAIL, P, "{{listing_title}}", 0, 0, 0),
    lambda: email_service.send_boost_listing_email(EMAIL, P, "{{listing_title}}", "{{listing_id}}", "{{current_views}}"),
    lambda: email_service.send_ai_pricing_suggestion_email(EMAIL, P, "{{listing_title}}", "{{current_price}}", "{{suggested_price}}", "{{price_difference}}", 0.0),
    lambda: email_service.send_seller_milestone_email(EMAIL, P, "{{milestone_type}}", "{{badge_earned}}", "{{reward_detail}}"),
    lambda: email_service.send_system_alert(EMAIL, "{{subject}}", "{{body}}"),
    lambda: email_service.system_status_email(EMAIL, "{{component}}", "operational", "{{details}}"),
    lambda: email_service.fraud_report_summary(EMAIL, 0, 0, 0),
    lambda: email_service.moderation_alert_email(EMAIL, P, "{{listing_title}}", "{{violation_reason}}", "{{listing_id}}"),
    lambda: email_service.analytics_summary_email(EMAIL, 0, 0, 0, 0.0),
]

for fn in calls:
    fn()

print(f"Captured {len(captured_records)} email templates")


def to_display_name(record):
    return record["title"] or record["event_type"].replace("_", " ").title()


def extract_variables(text_blob):
    return sorted(set(re.findall(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}', text_blob)))


LIST_BASED_TYPES = {
    "activity_saved_search", "activity_trending", "retention_reengagement",
    "retention_recommendations", "retention_category_interest", "engagement_weekly_digest",
}

engine = create_engine(settings.DATABASE_URL)
inserted = 0
skipped = 0
with engine.begin() as conn:
    for r in captured_records:
        existing = conn.execute(
            text("SELECT id FROM email_template WHERE event_type = :event_type"),
            {"event_type": r["event_type"]},
        ).first()
        if existing:
            skipped += 1
            continue

        variables = extract_variables(r["html_body"])
        is_list_based = any(k in r["html_body"] for k in ["item_1_title", "item_2_title", "keyword_1"])
        description = r["subtitle"] or ""
        if is_list_based:
            description = f"[System-generated, view only — uses dynamic item lists not supported by Send Test/Broadcast] {description}"

        conn.execute(
            text("""
                INSERT INTO email_template (event_type, name, subject, html_content, is_active, description, variables, created_at, updated_at)
                VALUES (:event_type, :name, :subject, :html_content, true, :description, :variables, now(), now())
            """),
            {
                "event_type": r["event_type"],
                "name": to_display_name(r),
                "subject": r["subject"],
                "html_content": r["html_body"],
                "description": description,
                "variables": json.dumps(variables),
            }
        )
        inserted += 1

print(f"Seed complete: {inserted} inserted, {skipped} already existed (skipped)")
