"""
Promotion background tasks:
- expire_stale_promotions: marks old unpaid promotions as EXPIRED (runs hourly via beat)
- retry_failed_stk_pushes: retries STK pushes not yet linked (runs every 5 min via beat)
- initiate_stk_push_task: async STK push with exponential-backoff retry (called directly)
"""
from datetime import datetime, timedelta
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(name="app.tasks.promotion_tasks.expire_stale_promotions")
def expire_stale_promotions():
    """
    Hourly beat task: mark WAITING_FOR_PAYMENT promotions older than 2 hours as EXPIRED.
    """
    from sqlmodel import Session, select, update
    from app.db.session import engine
    from app.models.promotion import Promotion, PromotionStatus

    cutoff = datetime.utcnow() - timedelta(hours=2)
    with Session(engine) as db:
        result = db.exec(
            update(Promotion)
            .where(Promotion.status == PromotionStatus.WAITING_FOR_PAYMENT)
            .where(Promotion.created_at < cutoff)
            .values(status=PromotionStatus.EXPIRED, updated_at=datetime.utcnow())
        )
        db.commit()
        logger.info(f"Expired {result.rowcount} stale promotions")


@shared_task(name="app.tasks.promotion_tasks.retry_failed_stk_pushes")
def retry_failed_stk_pushes():
    """
    Every-5-min beat task: retry STK pushes for promotions that are still
    WAITING_FOR_PAYMENT and have no lipana_tx_id (push never fired).

    Deliberately does NOT hold a DB session open across the external Lipana
    API call (initiate_stk_push has timeout=30, so a slow/hanging gateway
    response used to hold a pooled connection checked out for up to 30s per
    promo, sequentially, every 5 minutes -- a real contributor to production
    latency spikes since celery-worker shares the DB's max_connections
    budget with the web backend). Fetch the candidate list, close the
    session, make the external calls, then a fresh short-lived session per
    successful result just to persist it.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.promotion import Promotion, PromotionStatus
    from app.services import lipana as lipana_service
    from app.models.listing import Listing

    cutoff = datetime.utcnow() - timedelta(minutes=30)  # Only retry if < 30 min old

    with Session(engine) as db:
        promos = db.exec(
            select(Promotion).where(
                Promotion.status == PromotionStatus.WAITING_FOR_PAYMENT,
                Promotion.lipana_tx_id.is_(None),
                Promotion.created_at > cutoff,
            )
        ).all()
        # Snapshot everything the external call needs before the session
        # (and its pooled connection) closes. Listing has title_en/title_so,
        # not .title -- the pre-refactor version referenced .title here too,
        # silently caught by the try/except below every time a promo had a
        # real listing; fixed properly now that this runs outside that
        # per-promo exception handler.
        candidates = []
        for promo in promos:
            listing = db.get(Listing, promo.listing_id) if promo.listing_id else None
            candidates.append({
                "id": promo.id,
                "payment_phone": promo.payment_phone,
                "amount": promo.amount,
                "listing_title": (listing.title_en if listing else None) or "Ad",
            })

    for c in candidates:
        try:
            result = lipana_service.initiate_stk_push(
                phone=c["payment_phone"],
                amount=c["amount"],
                reference=f"Promo {c['id']} (retry)",
                description=f"Boost: {c['listing_title'] or 'Ad'}",
            )
            data = result.get("data", result)
            tx_id = data.get("transactionId") or data.get("transaction_id")
            if tx_id:
                with Session(engine) as db:
                    promo = db.get(Promotion, c["id"])
                    if promo:
                        promo.lipana_tx_id = tx_id
                        db.add(promo)
                        db.commit()
                logger.info(f"Retry STK push success for promo {c['id']}: {tx_id}")
        except Exception as exc:
            logger.warning(f"Retry STK push failed for promo {c['id']}: {exc}")


@shared_task(
    name="app.tasks.promotion_tasks.initiate_stk_push_task",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="promotions",
)
def initiate_stk_push_task(self, promo_id: int, phone: str, amount: float, description: str):
    """
    Async STK push with exponential-backoff retry.
    Called from the /promotions/ endpoint instead of blocking.
    """
    from sqlmodel import Session
    from app.db.session import engine
    from app.models.promotion import Promotion
    from app.services import lipana as lipana_service

    try:
        result = lipana_service.initiate_stk_push(
            phone=phone,
            amount=amount,
            reference=f"Promo {promo_id}",
            description=description,
        )
        data = result.get("data", result)
        tx_id = data.get("transactionId") or data.get("transaction_id")
        if tx_id:
            with Session(engine) as db:
                promo = db.get(Promotion, promo_id)
                if promo:
                    promo.lipana_tx_id = tx_id
                    db.add(promo)
                    db.commit()
        logger.info(f"STK push fired for promo {promo_id}: {tx_id}")
        return {"success": True, "tx_id": tx_id}
    except Exception as exc:
        countdown = 2 ** self.request.retries * 30  # 30s, 60s, 120s
        logger.warning(f"STK push failed for promo {promo_id} (attempt {self.request.retries}): {exc}")
        raise self.retry(exc=exc, countdown=countdown)
