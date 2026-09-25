-- Initialize default subscription plans

INSERT INTO subscription_plan (name, display_name, description, monthly_price, annual_price, max_products, has_analytics, has_verified_badge, has_priority_ranking, has_custom_branding, has_bulk_import, has_marketing_codes, has_staff_accounts, has_email_support, has_priority_support, trial_days, is_active)
VALUES
  (
    'free',
    'Free Tier',
    'Start selling with basic features',
    0.0,
    0.0,
    30,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    0,
    TRUE
  ),
  (
    'pro',
    'Pro Shop',
    'Unlimited products and advanced seller tools',
    1000.0,
    11000.0,
    NULL,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    7,
    TRUE
  )
ON CONFLICT (name) DO NOTHING;
