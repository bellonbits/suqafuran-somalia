from fastapi import APIRouter
from app.api.api_v1.endpoints import marketing, auth, users, listings, admin, favorites, notifications, dashboard, verifications, wallet, boosts, interactions, meetings, deals, trust_ops, promotions, login, mobile_money, audit, kh, messages, translate, feedback, follows, content, ai, marketing, support, verification_check, seo, businesses, addresses, payments, sellers, diagnostics, analytics, analytics_tracking, bulk_products, delivery_zones, reviews, campaigns, seller_profile, seller_settings, conversations, reports, subcategories, attributes, category_attributes, search, offers, price_alerts, saved_searches, notification_preferences, chat_ws, subscriptions, featured_advertising, discount_codes, analytics_sellers, notifications_ws, advertising, admin_advertising, advertising_public, admin_email_analytics, admin_system_messaging, tracking, email_templates, customer_segments, lifecycle_analytics, checkout_receipts
from app.api.api_v1.admin import monitoring_router

# Import Phase 4 routers from root routers directory
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
try:
    from routers import payments as phase4_payments, sellers as phase4_sellers, riders as phase4_riders, orders as phase4_orders, websocket_routes, seller_endpoints as phase2_seller_endpoints
except ImportError:
    phase4_payments = None
    phase4_sellers = None
    phase4_riders = None
    phase4_orders = None
    websocket_routes = None
    phase2_seller_endpoints = None

api_router = APIRouter()

# Phase 4 Core Endpoints
if phase4_payments:
    api_router.include_router(phase4_payments.router, tags=["payments"])
if phase4_orders:
    api_router.include_router(phase4_orders.router, tags=["orders"])
# Skip phase4_sellers - uses incompatible database schema
# if phase4_sellers:
#     api_router.include_router(phase4_sellers.router, tags=["sellers"])
if phase4_riders:
    api_router.include_router(phase4_riders.router, tags=["riders"])
if websocket_routes:
    api_router.include_router(websocket_routes.router, tags=["websocket"])

# Phase 2 Seller Endpoints (disabled - using API v1 sellers.py instead)
# if phase2_seller_endpoints:
#     api_router.include_router(phase2_seller_endpoints.router, tags=["sellers"])

# Comprehensive API Endpoints
api_router.include_router(login.router, tags=["login"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(payments.router, tags=["payments"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(listings.router, prefix="/listings", tags=["listings"])

# Shop Subscription Features (must come before admin to match /admin/shops/search before /admin/shops/{shop_id})
api_router.include_router(marketing.router, tags=['marketing'])
api_router.include_router(subscriptions.router, tags=["subscriptions"])

api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(monitoring_router.router, tags=["admin-monitoring"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(chat_ws.router, tags=["chat"])
api_router.include_router(notifications_ws.router, tags=["notifications-ws"])
api_router.include_router(favorites.router, prefix="/favorites", tags=["favorites"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(verifications.router, prefix="/verifications", tags=["verifications"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(wallet.router, prefix="/wallet", tags=["wallet"])
api_router.include_router(boosts.router, prefix="/boosts", tags=["boosts"])
api_router.include_router(interactions.router, prefix="/interactions", tags=["interactions"])
api_router.include_router(checkout_receipts.router, prefix="/checkout-receipts", tags=["checkout-receipts"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
api_router.include_router(deals.router, prefix="/deals", tags=["deals"])
api_router.include_router(trust_ops.router, prefix="/trust_ops", tags=["trust"])
api_router.include_router(promotions.router, prefix="/promotions", tags=["promotions"])
api_router.include_router(mobile_money.router, prefix="/mobile-money", tags=["mobile-money"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(kh.router, prefix="/kh", tags=["kaalay-heedhe"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(follows.router, prefix="/follows", tags=["follows"])
api_router.include_router(translate.router, tags=["translate"])
api_router.include_router(content.router, prefix="/content", tags=["content"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(marketing.router, prefix="/marketing", tags=["marketing"])
api_router.include_router(support.router, prefix="/support", tags=["support"])
api_router.include_router(verification_check.router, prefix="/ai/verifications", tags=["ai-verifications"])
api_router.include_router(seo.router, prefix="/seo", tags=["seo"])
api_router.include_router(businesses.router, prefix="/businesses", tags=["businesses"])
api_router.include_router(addresses.router, prefix="/addresses", tags=["addresses"])
api_router.include_router(sellers.router, prefix="/sellers", tags=["sellers"])
api_router.include_router(diagnostics.router, tags=["diagnostics"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(analytics_tracking.router, prefix="/analytics", tags=["analytics-tracking"])
api_router.include_router(analytics_sellers.router, tags=["analytics-sellers"])
api_router.include_router(bulk_products.router, prefix="/listings", tags=["bulk-products"])
api_router.include_router(delivery_zones.router, prefix="/delivery-zones", tags=["delivery-zones"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
api_router.include_router(seller_profile.router, prefix="/seller/profile", tags=["seller-profile"])
api_router.include_router(seller_settings.router, prefix="/seller/settings", tags=["seller-settings"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(subcategories.router, prefix="/subcategories", tags=["subcategories"])
api_router.include_router(attributes.router, prefix="/attributes", tags=["attributes"])
api_router.include_router(category_attributes.router, prefix="/category-attributes", tags=["category-attributes"])
api_router.include_router(search.router, tags=["search"])

# Discount Codes / Marketing Codes
api_router.include_router(discount_codes.router, tags=["discount-codes"])

# Featured Advertising Features
api_router.include_router(featured_advertising.router, tags=["featured-advertising"])

# Advertising System (new comprehensive advertising platform)
# advertising_public must be registered before advertising: both mount under
# /advertising, and advertising's "/{ad_id}" catches static paths like
# "/active-banners" first if it's registered earlier (Starlette matches
# routes in registration order).
api_router.include_router(advertising_public.router, tags=["advertising-public"])
api_router.include_router(advertising.router, prefix="/advertising", tags=["advertising"])
api_router.include_router(admin_advertising.router, prefix="/admin/advertising", tags=["admin-advertising"])

# Email Analytics Dashboard
api_router.include_router(admin_email_analytics.router, prefix="/admin/email-analytics", tags=["admin-email-analytics"])

# System Messaging (Suqafuran announcements)
api_router.include_router(admin_system_messaging.router, prefix="/admin/system-messages", tags=["admin-system-messages"])

# Email Tracking (opens and clicks)
api_router.include_router(tracking.router, prefix="/tracking", tags=["email-tracking"])

# Email Template Management
api_router.include_router(email_templates.router, prefix="/admin/email-templates", tags=["admin-email-templates"])

# Customer Segmentation
api_router.include_router(customer_segments.router, prefix="/admin/segments", tags=["admin-segments"])

# Lifecycle Analytics
api_router.include_router(lifecycle_analytics.router, prefix="/admin/lifecycle", tags=["admin-lifecycle"])

# Marketplace Features Endpoints
api_router.include_router(offers.router, prefix="/offers", tags=["offers"])
api_router.include_router(price_alerts.router, prefix="/price-alerts", tags=["price-alerts"])
api_router.include_router(saved_searches.router, prefix="/saved-searches", tags=["saved-searches"])
api_router.include_router(notification_preferences.router, prefix="/notification-preferences", tags=["notification-preferences"])

