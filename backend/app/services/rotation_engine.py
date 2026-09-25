"""Selects which campaigns (if any) a user is due for on a given run.

Enforces:
  - EmailPreference opt-outs (per-campaign field where one exists, otherwise
    the general promotional_emails toggle for promotional campaigns).
  - A weekly cap on promotional sends per user (WEEKLY_PROMO_CAP).
  - A per-campaign-type cooldown (no repeating the same campaign_type for a
    user within CampaignDefinition.cooldown_days).
  - A per-run cap on total sends per user (MAX_SENDS_PER_RUN = 1), so a user
    eligible for several campaigns at once still only gets one email from a
    single run -- the others wait for a later run rather than all landing
    back-to-back the same day.

Round-robins subject-line variants per user+campaign_type based on how many
times that pair has been sent before, and hands campaign_selector_fn a
lookback window it can use to avoid repeating the same categories/shops too
soon (via CampaignSendLog.category_id / shop_ids).
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from sqlmodel import Session, select, func

from app.models.user import User
from app.models.marketing import EmailPreference
from app.models.campaign_send_log import CampaignSendLog
from app.services.campaign_catalog import CATALOG, CampaignDefinition

WEEKLY_PROMO_CAP = 3
MAX_SENDS_PER_RUN = 1

# Campaigns with their own dedicated EmailPreference field, checked instead
# of (not in addition to) promotional_emails for non-promotional entries.
_LIFECYCLE_PREFERENCE_FIELD = {
    "weekly_digest": "marketplace_digest",
    "reengagement": "promotional_emails",
    "saved_search_match": "saved_search_matches",
}


@dataclass
class SelectedCampaign:
    campaign_type: str
    subject: str
    content: Dict[str, Any]
    send_fn: Callable[[str, str, str, Dict[str, Any]], bool]


def _get_preference(db: Session, user_id: int) -> EmailPreference:
    preference = db.exec(select(EmailPreference).where(EmailPreference.user_id == user_id)).first()
    return preference or EmailPreference(user_id=user_id)


def _is_gated_out(definition: CampaignDefinition, preference: EmailPreference) -> bool:
    field = _LIFECYCLE_PREFERENCE_FIELD.get(definition.campaign_type)
    if field:
        return not getattr(preference, field, True)
    if definition.is_promotional:
        return not preference.promotional_emails
    return False


def _last_sent_at(db: Session, user_id: int, campaign_type: str) -> Optional[datetime]:
    row = db.exec(
        select(func.max(CampaignSendLog.sent_at)).where(
            CampaignSendLog.user_id == user_id, CampaignSendLog.campaign_type == campaign_type
        )
    ).first()
    return row


def _prior_send_count(db: Session, user_id: int, campaign_type: str) -> int:
    return db.exec(
        select(func.count()).where(
            CampaignSendLog.user_id == user_id, CampaignSendLog.campaign_type == campaign_type
        )
    ).one() or 0


def _promo_sent_this_week(db: Session, user_id: int) -> int:
    since = datetime.utcnow() - timedelta(days=7)
    promo_types = [c for c, d in CATALOG.items() if d.is_promotional]
    if not promo_types:
        return 0
    return db.exec(
        select(func.count()).where(
            CampaignSendLog.user_id == user_id,
            CampaignSendLog.campaign_type.in_(promo_types),
            CampaignSendLog.sent_at >= since,
        )
    ).one() or 0


def select_campaigns_for_user(db: Session, user: User) -> List[SelectedCampaign]:
    preference = _get_preference(db, user.id)
    promo_remaining = WEEKLY_PROMO_CAP - _promo_sent_this_week(db, user.id)

    candidates: List[tuple] = []  # (last_sent_at or None, definition)
    for definition in CATALOG.values():
        if _is_gated_out(definition, preference):
            continue
        if definition.is_promotional and promo_remaining <= 0:
            continue

        last_sent = _last_sent_at(db, user.id, definition.campaign_type)
        if last_sent and (datetime.utcnow() - last_sent) < timedelta(days=definition.cooldown_days):
            continue
        if not definition.eligibility_fn(db, user):
            continue

        candidates.append((last_sent, definition))

    # Never-sent campaigns (None) first, then longest-since-sent.
    candidates.sort(key=lambda pair: pair[0] or datetime.min)

    selected: List[SelectedCampaign] = []
    for _, definition in candidates:
        if len(selected) >= MAX_SENDS_PER_RUN:
            break
        if definition.is_promotional and promo_remaining <= 0:
            continue

        content = definition.content_selector_fn(db, user)
        if not content:
            continue  # nothing worth sending right now, try the next candidate

        variant_index = _prior_send_count(db, user.id, definition.campaign_type) % len(definition.subject_variants)
        subject = definition.subject_variants[variant_index]

        selected.append(SelectedCampaign(
            campaign_type=definition.campaign_type,
            subject=subject,
            content=content,
            send_fn=definition.send_fn,
        ))
        if definition.is_promotional:
            promo_remaining -= 1

    return selected


def record_send(db: Session, user_id: int, selected: SelectedCampaign, email_log_id: Optional[int]) -> None:
    listing_ids = selected.content.get("listing_ids") or []
    shop_ids = selected.content.get("shop_ids") or []
    db.add(CampaignSendLog(
        user_id=user_id,
        campaign_type=selected.campaign_type,
        subject_variant=selected.subject,
        category_id=selected.content.get("category_id"),
        listing_ids=json.dumps(listing_ids) if listing_ids else None,
        shop_ids=json.dumps(shop_ids) if shop_ids else None,
        email_log_id=email_log_id,
    ))
    db.commit()
