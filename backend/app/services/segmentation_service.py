"""Customer segmentation service for targeting campaigns."""

import json
from typing import List
from sqlmodel import Session, select, func
from app.models.user import User
from app.models.customer_segment import CustomerSegment
from app.models.listing import Listing
from app.core.logging_config import get_logger

logger = get_logger("segmentation_service")


class SegmentationService:
    """Service for evaluating and managing customer segments."""

    @staticmethod
    def evaluate_user_against_criteria(user: User, criteria_dict: dict) -> bool:
        """
        Evaluate if a user matches segment criteria.

        Args:
            user: User object to evaluate
            criteria_dict: Dictionary of criteria rules

        Returns:
            True if user matches all criteria, False otherwise
        """
        try:
            # Get the rules (can be a single rule or list of rules)
            rules = criteria_dict.get("rules", [])
            operator = criteria_dict.get("operator", "and")  # and or or

            if not rules:
                return True

            results = []
            for rule in rules:
                field = rule.get("field")
                op = rule.get("operator")  # equals, contains, greater_than, less_than, in, not_in
                value = rule.get("value")

                # Evaluate individual rule
                rule_result = SegmentationService._evaluate_rule(user, field, op, value)
                results.append(rule_result)

            # Combine results based on operator
            if operator == "or":
                return any(results)
            else:  # default to "and"
                return all(results)

        except Exception as e:
            logger.warning(f"Error evaluating segment criteria: {e}")
            return False

    @staticmethod
    def _evaluate_rule(user: User, field: str, operator: str, value: any) -> bool:
        """Evaluate a single rule against a user."""
        try:
            # Special handling for is_seller (not a real field, derived from listings)
            if field == "is_seller":
                from sqlmodel import Session, select
                from app.db import engine
                from app.models.listing import Listing
                with Session(engine) as db:
                    has_listings = db.exec(
                        select(Listing).where(
                            Listing.owner_id == user.id,
                            Listing.approval_status == 'approved'
                        )
                    ).first() is not None
                user_value = has_listings
            else:
                # Get user attribute value
                user_value = getattr(user, field, None)

            if user_value is None and field != "is_seller":
                return False

            # Apply operator logic
            if operator == "equals":
                return user_value == value
            elif operator == "not_equals":
                return user_value != value
            elif operator == "contains":
                return str(value).lower() in str(user_value).lower()
            elif operator == "not_contains":
                return str(value).lower() not in str(user_value).lower()
            elif operator == "greater_than":
                return user_value > value
            elif operator == "less_than":
                return user_value < value
            elif operator == "greater_equal":
                return user_value >= value
            elif operator == "less_equal":
                return user_value <= value
            elif operator == "in":
                return user_value in value if isinstance(value, list) else user_value in [value]
            elif operator == "not_in":
                return user_value not in value if isinstance(value, list) else user_value not in [value]
            else:
                return False

        except Exception as e:
            logger.warning(f"Error evaluating rule {field} {operator} {value}: {e}")
            return False

    @staticmethod
    def get_segment_members(
        db: Session,
        segment: CustomerSegment,
        limit: int = 1000,
        offset: int = 0
    ) -> tuple[list[User], int]:
        """
        Get users matching a segment's criteria.

        Args:
            db: Database session
            segment: CustomerSegment object
            limit: Max users to return
            offset: Pagination offset

        Returns:
            Tuple of (matching_users, total_count)
        """
        try:
            criteria = json.loads(segment.criteria)

            # Get all users
            query = select(User).where(User.is_active == True)
            all_users = db.exec(query).all()

            # Filter by criteria
            matching_users = [
                user for user in all_users
                if SegmentationService.evaluate_user_against_criteria(user, criteria)
            ]

            total_count = len(matching_users)

            # Apply pagination
            paginated = matching_users[offset : offset + limit]

            return paginated, total_count

        except Exception as e:
            logger.error(f"Failed to get segment members: {e}")
            return [], 0

    @staticmethod
    def update_segment_member_count(db: Session, segment: CustomerSegment) -> int:
        """
        Update the member count cache for a segment.

        Args:
            db: Database session
            segment: CustomerSegment object

        Returns:
            Updated member count
        """
        try:
            _, count = SegmentationService.get_segment_members(db, segment, limit=10000)
            segment.member_count = count
            db.add(segment)
            db.commit()
            return count

        except Exception as e:
            logger.error(f"Failed to update segment member count: {e}")
            return 0

    @staticmethod
    def get_predefined_segments() -> list[dict]:
        """Get predefined segment templates for quick creation."""
        return [
            {
                "name": "Active Sellers",
                "description": "Users with at least 1 active listing",
                "criteria": {
                    "operator": "and",
                    "rules": [
                        {"field": "is_seller", "operator": "equals", "value": True},
                        {"field": "is_active", "operator": "equals", "value": True}
                    ]
                }
            },
            {
                "name": "Verified Users",
                "description": "Email and phone verified users",
                "criteria": {
                    "operator": "and",
                    "rules": [
                        {"field": "email_verified", "operator": "equals", "value": True},
                        {"field": "phone_verified", "operator": "equals", "value": True}
                    ]
                }
            },
            {
                "name": "Inactive Users",
                "description": "Users who haven't been active",
                "criteria": {
                    "operator": "and",
                    "rules": [
                        {"field": "is_active", "operator": "equals", "value": False}
                    ]
                }
            },
            {
                "name": "Premium Tier",
                "description": "Users with tier2 or tier3 verification",
                "criteria": {
                    "operator": "and",
                    "rules": [
                        {"field": "verified_level", "operator": "in", "value": ["tier2", "tier3"]}
                    ]
                }
            },
            {
                "name": "Buyers",
                "description": "Users who are not sellers",
                "criteria": {
                    "operator": "and",
                    "rules": [
                        {"field": "is_seller", "operator": "equals", "value": False}
                    ]
                }
            }
        ]


segmentation_service = SegmentationService()
