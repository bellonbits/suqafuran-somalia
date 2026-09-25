"""
Background tasks for scheduled notifications and cleanup
Runs periodic checks for abandoned carts, delivery reminders, etc.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, select
from app.db import SessionLocal
from app.models.cart import Cart
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.services.notification_integration import (
    NotificationIntegrationService,
    AbandonedCartNotificationService,
)

logger = logging.getLogger(__name__)


class BackgroundTaskScheduler:
    """Scheduler for background notification tasks"""

    _running_tasks = set()

    @staticmethod
    async def start_background_tasks():
        """Start all background tasks"""
        logger.info("Starting background notification tasks")

        # Create task for abandoned carts check (every 1 hour)
        task1 = asyncio.create_task(
            BackgroundTaskScheduler._abandoned_carts_check_loop()
        )
        BackgroundTaskScheduler._running_tasks.add(task1)
        task1.add_done_callback(BackgroundTaskScheduler._running_tasks.discard)

        # Create task for delivery reminders check (every 30 minutes)
        task2 = asyncio.create_task(
            BackgroundTaskScheduler._delivery_reminders_loop()
        )
        BackgroundTaskScheduler._running_tasks.add(task2)
        task2.add_done_callback(BackgroundTaskScheduler._running_tasks.discard)

        # Create task for shop listing category sync (every 6 hours)
        task3 = asyncio.create_task(
            BackgroundTaskScheduler._sync_shop_listings_loop()
        )
        BackgroundTaskScheduler._running_tasks.add(task3)
        task3.add_done_callback(BackgroundTaskScheduler._running_tasks.discard)

        logger.info(f"Started {len(BackgroundTaskScheduler._running_tasks)} background tasks")

    @staticmethod
    async def _abandoned_carts_check_loop():
        """Check for abandoned carts every hour"""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour

                session = SessionLocal()
                try:
                    # Check carts abandoned for 2+ hours
                    await AbandonedCartNotificationService.check_and_notify_abandoned_carts(
                        session=session,
                        hours_threshold=2,
                    )
                finally:
                    session.close()

            except Exception as e:
                logger.error(f"Error in abandoned carts check loop: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes before retry

    @staticmethod
    async def _delivery_reminders_loop():
        """Send reminders for orders in transit"""
        while True:
            try:
                await asyncio.sleep(1800)  # Run every 30 minutes

                session = SessionLocal()
                try:
                    # Find orders in transit for >20 minutes
                    cutoff_time = datetime.utcnow() - timedelta(minutes=20)

                    in_transit_orders = session.exec(
                        select(Order)
                        .where(
                            (Order.status == OrderStatus.in_transit) &
                            (Order.updated_at < cutoff_time)
                        )
                    ).all()

                    for order in in_transit_orders:
                        # Send reminder notification
                        user = session.exec(
                            select(User).where(User.id == order.customer_id)
                        ).first()

                        if user:
                            extra_data = {
                                "rider_name": "Your rider",
                                "estimated_time": 15,
                            }

                            await NotificationIntegrationService.send_order_notification(
                                order=order,
                                notification_type="order_in_transit",
                                session=session,
                                extra_data=extra_data,
                            )

                    if in_transit_orders:
                        logger.info(f"Sent {len(in_transit_orders)} delivery reminders")

                finally:
                    session.close()

            except Exception as e:
                logger.error(f"Error in delivery reminders loop: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes before retry

    @staticmethod
    async def _sync_shop_listings_loop():
        """Sync shop listings to their primary categories every 6 hours"""
        while True:
            try:
                await asyncio.sleep(21600)  # Run every 6 hours

                session = SessionLocal()
                try:
                    from app.services.shop_listing_sync_service import sync_shop_listings_to_primary_category
                    stats = sync_shop_listings_to_primary_category(session)
                    logger.info(f"Shop listing sync: {stats['listings_migrated']} listings migrated across {stats['shops_updated']} shops")
                finally:
                    session.close()

            except Exception as e:
                logger.error(f"Error in shop listing sync loop: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes before retry


def init_background_tasks():
    """Initialize background tasks (call from main.py startup)"""
    loop = asyncio.get_event_loop()
    loop.create_task(BackgroundTaskScheduler.start_background_tasks())
    logger.info("Background tasks initialized")
