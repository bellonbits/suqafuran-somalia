from prometheus_client import Counter, Histogram, Gauge

# Business Metrics
LISTINGS_CREATED_TOTAL = Counter(
    "suqafuran_listings_created_total", 
    "Total number of listings created", 
    ["category", "location"]
)

USER_REGISTRATIONS_TOTAL = Counter(
    "suqafuran_user_registrations_total", 
    "Total number of new user registrations",
    ["method"] # e.g., email, google, github
)

SUCCESSFUL_LOGINS_TOTAL = Counter(
    "suqafuran_successful_logins_total", 
    "Total number of successful user logins"
)

# AI Service Metrics
AI_PROCESSING_TIME = Histogram(
    "suqafuran_ai_processing_seconds", 
    "Time spent processing listings with AI",
    ["task_type"] # e.g., translation, tagging, fraud_check
)

AI_FAILURE_TOTAL = Counter(
    "suqafuran_ai_failure_total", 
    "Total number of AI processing failures",
    ["task_type", "error_code"]
)

# Payment Metrics
TRANSACTIONS_TOTAL = Counter(
    "suqafuran_transactions_total", 
    "Total number of transaction attempts",
    ["status", "provider"] # e.g., success/failed, mpesa/card
)

# Queue Metrics (tracked via app instrumentation)
ACTIVE_WEBSOCKET_CONNECTIONS = Gauge(
    "suqafuran_active_websocket_connections",
    "Number of currently active websocket connections"
)
