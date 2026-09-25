"""Email background tasks."""
from celery import shared_task
from celery.utils.log import get_task_logger
from typing import Optional, Any, Dict

logger = get_task_logger(__name__)

# Maps dispatch_growth_email_task's email_type keys to the EmailTemplate rows
# seeded from these same methods (see seed_email_templates.py), so an admin
# edit in /admin-dashboard/email-templates actually changes what gets sent.
#
# Deliberately excludes types whose original method renders a dynamic list of
# items in a loop (saved_search, trending, weekly_digest, reengagement,
# recommended, category_interest, market_summary, receipt) — the simple
# {{variable}} Jinja2 substitution here can't reproduce a per-item loop, so
# those always fall through to the hardcoded method below.
DB_TEMPLATE_EVENT_TYPES = {
    "welcome": "onboarding_welcome",
    "complete_profile": "onboarding_complete_profile",
    "first_action": "onboarding_first_action",
    "new_listing": "activity_new_listing",
    "price_drop": "activity_price_drop",
    "message": "transaction_message",
    "offer_received": "transaction_offer",
    "offer_response": "transaction_offer_response",
    "deal_update": "transaction_deal_update",
    "suspicious": "safety_suspicious_login",
    "scam_warning": "safety_scam_warning",
    "account_protection": "safety_protection",
    "password_change": "safety_password_change",
    "new_device": "safety_new_device",
    "abandoned_action": "retention_abandoned_action",
    "seller_tips": "seller_growth_tips",
    "listing_performance": "seller_growth_listing_performance",
    "boost_listing": "seller_growth_boost_listing",
    "ai_pricing": "seller_growth_ai_pricing",
    "seller_milestone": "seller_growth_milestone",
    "system_alert": "admin_system_alert",
    "system_status": "admin_system_status",
    "fraud_report": "admin_fraud_report",
    "moderation_alert": "admin_moderation_alert",
}


def _try_send_from_db_template(email_type: str, email: str, context: Dict[str, Any], user_id: Optional[int], campaign_id: Optional[str]) -> bool:
    """Render + send an active admin-edited EmailTemplate for this event_type,
    if one exists. Returns True if it handled the send (caller should skip the
    hardcoded fallback), False if there's no template to use."""
    event_type = DB_TEMPLATE_EVENT_TYPES.get(email_type)
    if not event_type:
        return False

    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.email_template import EmailTemplate
    from app.services.email_service import email_service
    from jinja2 import Template
    import datetime

    with Session(engine) as db:
        template = db.exec(
            select(EmailTemplate).where(
                EmailTemplate.event_type == event_type,
                EmailTemplate.is_active == True,
            )
        ).first()

    if not template:
        return False

    render_ctx = {**context, "email": email, "date": datetime.date.today().strftime("%B %d, %Y")}
    try:
        subject = Template(template.subject).render(**render_ctx)
        html_body = Template(template.html_content).render(**render_ctx)
    except Exception as exc:
        logger.warning(f"DB template render failed for '{event_type}' (id={template.id}): {exc} — falling back to hardcoded email")
        return False

    email_service._send_and_log(email, subject, html_body, event_type, user_id, campaign_id=campaign_id)
    logger.info(f"Sent '{email_type}' using admin-edited DB template (id={template.id})")
    return True


@shared_task(name="app.tasks.email_tasks.send_verification_email", bind=True, max_retries=2)
def send_verification_email_task(self, email: str, code: str):
    from app.services.email_service import email_service
    try:
        email_service.send_verification_code(email)
        logger.info(f"Verification email sent to {email}")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@shared_task(name="app.tasks.email_tasks.send_password_reset", bind=True, max_retries=2)
def send_password_reset_task(self, email: str, code: str):
    from app.services.email_service import email_service
    try:
        email_service.send_reset_code(email, code)
        logger.info(f"Password reset email sent to {email}")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@shared_task(name="app.tasks.email_tasks.dispatch_growth_email", bind=True, max_retries=3)
def dispatch_growth_email_task(
    self,
    email_type: str,
    email: str,
    context: Dict[str, Any],
    user_id: Optional[int] = None,
    campaign_id: Optional[str] = None
):
    """
    Highly scalable, asynchronous Celery task routing to dispatch any of the 30+
    Suqafuran growth, marketing, transactional, or moderation email campaigns.
    """
    from app.services.email_service import email_service
    logger.info(f"Dispatching async email type '{email_type}' to '{email}'")

    if _try_send_from_db_template(email_type, email, context, user_id, campaign_id):
        return

    try:
        # 1. Onboarding & Activation
        if email_type == "welcome":
            email_service.send_welcome_email(email, name=context["name"], user_id=user_id)
        elif email_type == "complete_profile":
            email_service.send_complete_profile_email(email, name=context["name"], user_id=user_id)
        elif email_type == "first_action":
            email_service.send_first_action_prompt_email(
                email, name=context["name"], user_type=context["user_type"], user_id=user_id
            )

        # 2. Marketplace Activity & Growth
        elif email_type == "new_listing":
            email_service.send_new_listing_alert(
                email,
                name=context["name"],
                listing_title=context["listing_title"],
                price=context["price"],
                location=context["location"],
                category=context["category"],
                listing_id=context["listing_id"],
                image_url=context.get("image_url"),
                user_id=user_id
            )
        elif email_type == "saved_search":
            email_service.send_saved_search_alert(
                email,
                name=context["name"],
                search_query=context["search_query"],
                matched_listings=context["matched_listings"],
                user_id=user_id
            )
        elif email_type == "price_drop":
            email_service.send_price_drop_alert(
                email,
                name=context["name"],
                listing_title=context["listing_title"],
                old_price=context["old_price"],
                new_price=context["new_price"],
                listing_id=context["listing_id"],
                image_url=context.get("image_url"),
                user_id=user_id
            )
        elif email_type == "trending":
            email_service.send_trending_items_email(
                email,
                name=context["name"],
                location=context["location"],
                listings=context["listings"],
                user_id=user_id
            )

        # 3. Transactional
        elif email_type == "message":
            email_service.send_message_notification(
                email,
                name=context["name"],
                sender_name=context["sender_name"],
                message_excerpt=context["message_excerpt"],
                chat_url=context["chat_url"],
                user_id=user_id
            )
        elif email_type == "offer_received":
            email_service.send_offer_received(
                email,
                name=context["name"],
                item_title=context["item_title"],
                offer_amount=context["offer_amount"],
                offer_url=context["offer_url"],
                user_id=user_id
            )
        elif email_type == "offer_response":
            email_service.send_offer_response(
                email,
                name=context["name"],
                item_title=context["item_title"],
                response_status=context["response_status"],
                response_amount=context.get("response_amount"),
                user_id=user_id
            )
        elif email_type == "deal_update":
            email_service.send_deal_update(
                email,
                name=context["name"],
                item_title=context["item_title"],
                status=context["status"],
                user_id=user_id
            )
        # 4. Trust & Safety
        elif email_type == "suspicious":
            email_service.send_suspicious_activity_alert(
                email,
                name=context["name"],
                ip=context["ip"],
                device=context["device"],
                timestamp=context["timestamp"],
                user_id=user_id
            )
        elif email_type == "scam_warning":
            email_service.send_scam_warning_alert(
                email,
                name=context["name"],
                reason=context["reason"],
                user_id=user_id
            )
        elif email_type == "account_protection":
            email_service.send_account_protection_alert(
                email,
                name=context["name"],
                action=context["action"],
                user_id=user_id
            )
        elif email_type == "password_change":
            email_service.send_password_change_alert(
                email,
                name=context["name"],
                timestamp=context["timestamp"],
                ip=context["ip"],
                user_id=user_id
            )
        elif email_type == "new_device":
            email_service.send_new_device_login_alert(
                email,
                name=context["name"],
                device=context["device"],
                location=context["location"],
                timestamp=context["timestamp"],
                ip=context["ip"],
                user_id=user_id
            )

        # 5. Engagement & Retention
        elif email_type == "weekly_digest":
            email_service.send_weekly_digest(
                email,
                name=context["name"],
                location=context["location"],
                items=context["items"],
                categories=context["categories"],
                user_id=user_id
            )
        elif email_type == "reengagement":
            email_service.send_reengagement_email(
                email,
                name=context["name"],
                reason=context["reason"],
                featured_items=context["featured_items"],
                user_id=user_id
            )
        elif email_type == "abandoned_action":
            email_service.send_abandoned_action_email(
                email,
                name=context["name"],
                action=context["action"],
                user_id=user_id
            )
        elif email_type == "recommended":
            email_service.send_recommended_items_email(
                email,
                name=context["name"],
                items=context["items"],
                user_id=user_id
            )
        elif email_type == "category_interest":
            email_service.send_category_interest_email(
                email,
                name=context["name"],
                category_name=context["category_name"],
                items=context["items"],
                user_id=user_id
            )
        elif email_type == "market_summary":
            email_service.send_market_summary_email(
                email,
                name=context["name"],
                location=context["location"],
                average_price_change=context["average_price_change"],
                popular_keywords=context["popular_keywords"],
                user_id=user_id
            )

        # 6. Seller Growth
        elif email_type == "seller_tips":
            email_service.send_seller_tips(email, name=context["name"], user_id=user_id)
        elif email_type == "listing_performance":
            email_service.send_listing_performance_email(
                email,
                name=context["name"],
                listing_title=context["listing_title"],
                views=context["views"],
                clicks=context["clicks"],
                inquiries=context["inquiries"],
                user_id=user_id
            )
        elif email_type == "boost_listing":
            email_service.send_boost_listing_email(
                email,
                name=context["name"],
                listing_title=context["listing_title"],
                listing_id=context["listing_id"],
                current_views=context["current_views"],
                boost_multiplier=context.get("boost_multiplier", 10),
                user_id=user_id
            )
        elif email_type == "ai_pricing":
            email_service.send_ai_pricing_suggestion_email(
                email,
                name=context["name"],
                listing_title=context["listing_title"],
                current_price=context["current_price"],
                suggested_price=context["suggested_price"],
                price_difference=context["price_difference"],
                confidence_score=context["confidence_score"],
                user_id=user_id
            )
        elif email_type == "seller_milestone":
            email_service.send_seller_milestone_email(
                email,
                name=context["name"],
                milestone_type=context["milestone_type"],
                badge_earned=context["badge_earned"],
                reward_detail=context["reward_detail"],
                user_id=user_id
            )

        # 7. Admin & Platform
        elif email_type == "system_alert":
            email_service.send_system_alert(
                email,
                subject=context["subject"],
                body=context["body"],
                user_id=user_id
            )
        elif email_type == "system_status":
            email_service.system_status_email(
                email,
                component=context["component"],
                status=context["status"],
                details=context["details"],
                user_id=user_id
            )
        elif email_type == "fraud_report":
            email_service.fraud_report_summary(
                email,
                report_count=context["report_count"],
                pending_reviews=context["pending_reviews"],
                active_suspensions=context["active_suspensions"],
                user_id=user_id
            )
        elif email_type == "moderation_alert":
            email_service.moderation_alert_email(
                email,
                name=context["name"],
                listing_title=context["listing_title"],
                violation_reason=context["violation_reason"],
                listing_id=context["listing_id"],
                user_id=user_id
            )
        elif email_type == "analytics_summary":
            email_service.analytics_summary_email(
                email,
                active_users=context["active_users"],
                listings_created=context["listings_created"],
                transactions_completed=context["transactions_completed"],
                open_rate=context["open_rate"],
                user_id=user_id
            )
        elif email_type == "crm_manual":
            email_service.send_custom_manual_email(
                email,
                subject=context["subject"],
                title=context["title"],
                subtitle=context.get("subtitle"),
                content_html=context["content_html"],
                action_text=context.get("action_text"),
                action_url=context.get("action_url"),
                campaign_id=campaign_id,
                user_id=user_id
            )
        else:
            logger.error(f"Unknown async email_type: '{email_type}' requested.")

    except Exception as exc:
        logger.error(f"Task failed for email_type '{email_type}': {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(name="app.tasks.email_tasks.run_promotional_rotation", acks_late=False)
def run_promotional_rotation_task():
    """
    Runs on a daily beat schedule (see celery_app.py). For each active user,
    picks whichever promotional/lifecycle campaigns they're due for (rotation
    engine handles cooldowns, weekly caps, and preference gating), sends them,
    and logs each send to CampaignSendLog so future runs know not to repeat
    them too soon.

    acks_late=False (overriding the celery_app.py default) is deliberate: this
    task loops over every user and can run long. With acks_late, a worker
    restart mid-run (e.g. during a deploy) leaves the message unacked, and the
    next worker that starts redelivers and reruns the WHOLE task from
    scratch -- duplicate sends to everyone already processed, not just a
    resumed tail. This job is inherently self-healing (cooldowns mean anyone
    missed just gets picked up on tomorrow's run), so losing an interrupted
    run is far safer than redelivering it.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.user import User
    from app.models.email_log import EmailLog
    from app.services.rotation_engine import select_campaigns_for_user, record_send

    BATCH_SIZE = 500
    total_users = 0
    total_sent = 0
    offset = 0

    while True:
        with Session(engine) as db:
            users = db.exec(
                select(User).where(
                    User.is_active == True,  # noqa: E712
                    User.email.isnot(None),
                    User.email.notlike("%@suqafuran.local"),
                )
                .order_by(User.id).offset(offset).limit(BATCH_SIZE)
            ).all()
            if not users:
                break

            for user in users:
                total_users += 1
                try:
                    selected = select_campaigns_for_user(db, user)
                except Exception as exc:
                    logger.warning(f"Rotation selection failed for user {user.id}: {exc}")
                    continue

                for campaign in selected:
                    try:
                        campaign.send_fn(user.email, user.full_name or "Customer", campaign.subject, campaign.content)
                        log_row = db.exec(
                            select(EmailLog).where(EmailLog.user_id == user.id)
                            .order_by(EmailLog.sent_at.desc()).limit(1)
                        ).first()
                        record_send(db, user.id, campaign, log_row.id if log_row else None)
                        total_sent += 1
                    except Exception as exc:
                        logger.warning(f"Campaign '{campaign.campaign_type}' failed for user {user.id}: {exc}")

        offset += BATCH_SIZE

    logger.info(f"Promotional rotation run complete: {total_users} users evaluated, {total_sent} emails sent")
    return {"users_evaluated": total_users, "emails_sent": total_sent}


@shared_task(name="app.tasks.email_tasks.send_viewed_no_contact_reminders", acks_late=False)
def send_viewed_no_contact_reminders_task():
    """
    Runs hourly (see celery_app.py). Finds listings someone viewed 3-24
    hours ago and never messaged the seller about, and sends one reminder
    per (user, listing) pair, ever -- logged to CampaignSendLog so it never
    repeats. The 3h floor gives them a real chance to message on their own
    first; the 24h ceiling keeps the nudge timely instead of stale.

    acks_late=False for the same reason as run_promotional_rotation_task:
    this loops over potentially many views and is safe to just re-run
    tomorrow if interrupted, so losing a partial run beats redelivering and
    reprocessing everyone already handled.
    """
    import json
    from datetime import datetime, timedelta
    from sqlmodel import Session, select
    from app.core.config import settings
    from app.db.session import engine
    from app.models.marketing import UserBrowsingHistory, EmailPreference
    from app.models.marketplace_conversation import MarketplaceConversation
    from app.models.campaign_send_log import CampaignSendLog
    from app.models.listing import Listing
    from app.models.user import User
    from app.services.email_service import email_service

    CAMPAIGN_TYPE = "viewed_no_contact"
    now = datetime.utcnow()
    window_start = now - timedelta(hours=24)
    window_end = now - timedelta(hours=3)

    sent = 0
    evaluated = 0

    with Session(engine) as db:
        views = db.exec(
            select(UserBrowsingHistory)
            .where(
                UserBrowsingHistory.listing_id.isnot(None),
                UserBrowsingHistory.viewed_at >= window_start,
                UserBrowsingHistory.viewed_at <= window_end,
            )
            .order_by(UserBrowsingHistory.viewed_at.desc())
        ).all()

        seen_pairs = set()  # de-dupe repeat views of the same listing within this run

        for view in views:
            pair = (view.user_id, view.listing_id)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            evaluated += 1

            try:
                listing = db.get(Listing, view.listing_id)
                if not listing or listing.status != "active" or listing.owner_id == view.user_id:
                    continue

                user = db.get(User, view.user_id)
                if not user or not user.email or user.email.endswith("@suqafuran.local") or not user.is_active:
                    continue

                already_contacted = db.exec(
                    select(MarketplaceConversation.id).where(
                        MarketplaceConversation.buyer_id == view.user_id,
                        MarketplaceConversation.seller_id == listing.owner_id,
                        MarketplaceConversation.listing_id == listing.id,
                    )
                ).first()
                if already_contacted:
                    continue

                listing_ids_key = json.dumps([listing.id])
                already_reminded = db.exec(
                    select(CampaignSendLog.id).where(
                        CampaignSendLog.user_id == view.user_id,
                        CampaignSendLog.campaign_type == CAMPAIGN_TYPE,
                        CampaignSendLog.listing_ids == listing_ids_key,
                    )
                ).first()
                if already_reminded:
                    continue

                preference = db.exec(select(EmailPreference).where(EmailPreference.user_id == view.user_id)).first()
                if preference and not preference.listing_updates:
                    continue

                success = email_service.send_viewed_no_contact_reminder(
                    user.email,
                    (user.full_name or "there").split()[0],
                    listing.title_en,
                    f"{listing.currency} {listing.price:,.0f}",
                    (listing.images or [None])[0],
                    f"{settings.FRONTEND_URL}/listing/{listing.id}",
                    user.id,
                )
                if success:
                    sent += 1
                    db.add(CampaignSendLog(
                        user_id=view.user_id,
                        campaign_type=CAMPAIGN_TYPE,
                        subject_variant="default",
                        listing_ids=listing_ids_key,
                        template_event_type="viewed_listing_no_contact",
                    ))
                    db.commit()
            except Exception as exc:
                logger.warning(f"Viewed-no-contact check failed for user {view.user_id}, listing {view.listing_id}: {exc}")
                db.rollback()

    logger.info(f"Viewed-no-contact reminders: {evaluated} views evaluated, {sent} sent")
    return {"views_evaluated": evaluated, "emails_sent": sent}


@shared_task(name="app.tasks.email_tasks.process_broadcast_jobs", acks_late=False)
def process_broadcast_jobs_task():
    """
    Runs every 30 minutes (see celery_app.py). For each in-progress
    BroadcastJob, sends up to `daily_limit` more recipients -- counting only
    what's already gone out today for that job -- so a broadcast to a large
    user base drips out under a sending provider's daily quota instead of
    firing everyone at once. Marks a job "completed" once every recipient
    has been attempted.

    acks_late=False, and each recipient's "sent" status is committed
    individually rather than once at the end of the batch -- both for the
    same reason as run_promotional_rotation_task: a worker restart mid-batch
    under acks_late redelivers the message and resends the entire batch,
    including recipients already emailed but not yet committed as "sent".
    """
    from datetime import datetime
    from sqlmodel import Session, select, func
    from app.db.session import engine
    from app.models.broadcast_job import BroadcastJob, BroadcastJobRecipient
    from app.services.email_service import email_service

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    jobs_processed = 0
    total_sent = 0

    with Session(engine) as db:
        jobs = db.exec(select(BroadcastJob).where(BroadcastJob.status == "in_progress")).all()

        for job in jobs:
            sent_today = db.exec(
                select(func.count()).where(
                    BroadcastJobRecipient.job_id == job.id,
                    BroadcastJobRecipient.status == "sent",
                    BroadcastJobRecipient.sent_at >= today_start,
                )
            ).one() or 0

            remaining_today = job.daily_limit - sent_today
            if remaining_today <= 0:
                continue

            batch = db.exec(
                select(BroadcastJobRecipient)
                .where(BroadcastJobRecipient.job_id == job.id, BroadcastJobRecipient.status == "pending")
                .limit(remaining_today)
            ).all()

            for recipient in batch:
                try:
                    email_service.send_custom_manual_email(
                        recipient.email,
                        subject=job.subject,
                        title=job.title,
                        subtitle=job.subtitle,
                        content_html=job.content_html,
                        action_text=job.action_text,
                        action_url=job.action_url,
                        campaign_id=job.campaign_id,
                        user_id=recipient.user_id,
                    )
                    recipient.status = "sent"
                    recipient.sent_at = datetime.utcnow()
                    job.sent_count += 1
                    total_sent += 1
                except Exception as exc:
                    recipient.status = "failed"
                    recipient.failed_reason = str(exc)
                    job.failed_count += 1
                    logger.warning(f"Broadcast job {job.id} failed to send to {recipient.email}: {exc}")
                db.add(recipient)
                db.add(job)
                db.commit()

            remaining_pending = db.exec(
                select(func.count()).where(
                    BroadcastJobRecipient.job_id == job.id, BroadcastJobRecipient.status == "pending"
                )
            ).one() or 0
            if remaining_pending == 0:
                job.status = "completed"

            job.updated_at = datetime.utcnow()
            db.add(job)
            db.commit()
            jobs_processed += 1

    logger.info(f"Broadcast job processing complete: {jobs_processed} job(s) processed, {total_sent} emails sent")
    return {"jobs_processed": jobs_processed, "emails_sent": total_sent}
