# Suqafuran Backend Setup Guide

## Phase 1: Backend API + Database

This backend implements a production-ready FastAPI application with:
- PostgreSQL database with 10 SQLAlchemy models
- JWT authentication
- Order management system
- Seller management with M-Pesa verification
- Payment processing infrastructure
- Issue/dispute resolution
- Rider delivery system

## Files Created

```
backend/
├── requirements.txt          # Python dependencies
├── config.py                 # Configuration management
├── database.py               # SQLAlchemy setup
├── models.py                 # Database models (10 models)
├── schemas.py                # Pydantic schemas (create this next)
├── main.py                   # FastAPI app entry point (create this next)
├── routers/
│   ├── auth.py              # Authentication endpoints
│   ├── orders.py            # Order endpoints
│   ├── payments.py          # Payment & M-Pesa endpoints
│   ├── sellers.py           # Seller endpoints
│   └── riders.py            # Rider endpoints
├── services/
│   ├── mpesa.py             # M-Pesa integration
│   ├── payment_splitter.py  # Payment splitting logic
│   └── notifications.py     # Email/SMS/Push notifications
├── alembic/                 # Database migrations
└── .env.example             # Environment variables template
```

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Up Environment Variables
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

### 3. Create Database
```bash
# Using PostgreSQL
psql -U postgres -c "CREATE DATABASE suqafuran;"
```

### 4. Run Migrations
```bash
alembic upgrade head
```

### 5. Start Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Database Models

### Users
- id (PK)
- email, phone, full_name
- hashed_password
- is_active, is_verified
- timestamps

### Sellers
- id (PK)
- user_id (FK)
- shop_name, owner_name, category
- mpesa_number, mpesa_verified
- location_lat, location_lng
- verification_status (pending/verified/rejected)
- timestamps

### Orders
- id (PK)
- user_id (FK), seller_id (FK)
- status (pending/payment_pending/confirmed/preparing/ready_for_pickup/in_delivery/delivered/cancelled)
- delivery_option (delivery/pickup)
- delivery_address, phone_number
- total_amount, platform_fee, seller_amount, courier_tip
- payment_status
- location_lat, location_lng
- timestamps

### OrderItems
- id (PK)
- order_id (FK)
- product_id, title, quantity, price

### Payments
- id (PK)
- order_id (FK)
- amount, status
- mpesa_reference, merchant_request_id, checkout_request_id

### Issues
- id (PK)
- order_id (FK)
- issue_type (item_mismatch/damaged/missing_items/other)
- description, status (under_review/resolved/rejected)
- resolution_type (refund/replacement)

### Riders
- id (PK)
- user_id (FK)
- phone, vehicle_type, vehicle_plate
- is_verified, is_active
- current_lat, current_lng

### DeliveryAssignments
- id (PK)
- order_id (FK), rider_id (FK)
- status (assigned/picked_up/delivered)

## API Endpoints

### Auth
- POST /api/v1/auth/signup
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh-token

### Orders (Customer)
- POST /api/v1/orders - Create order
- GET /api/v1/orders - List orders
- GET /api/v1/orders/{order_id} - Get order
- PATCH /api/v1/orders/{order_id} - Update status
- POST /api/v1/orders/{order_id}/cancel
- POST /api/v1/orders/{order_id}/rate-delivery
- POST /api/v1/orders/{order_id}/report-issue

### Payments
- POST /api/v1/payments/mpesa/initiate
- GET /api/v1/payments/{order_id}/status
- POST /api/v1/payments/mpesa/callback
- POST /api/v1/payments/{order_id}/refund

### Sellers
- POST /api/v1/sellers/register
- GET /api/v1/sellers/me
- PATCH /api/v1/sellers/me
- POST /api/v1/sellers/verify-mpesa
- GET /api/v1/sellers/me/orders
- GET /api/v1/sellers/me/earnings
- POST /api/v1/sellers/me/withdrawals

### Riders
- POST /api/v1/riders/register
- GET /api/v1/riders/assignments
- PATCH /api/v1/riders/assignments/{assignment_id}

## Next Steps

1. **Create schemas.py** - Pydantic models for request/response validation
2. **Create main.py** - FastAPI application entry point
3. **Create routers/** - API endpoint implementations
4. **Implement M-Pesa integration** in services/mpesa.py
5. **Set up database migrations** with Alembic
6. **Add authentication** with JWT tokens
7. **Implement notifications** (email, SMS, push)

## Environment Variables (.env)

```
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/suqafuran

# JWT
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# M-Pesa
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_BUSINESS_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_ENVIRONMENT=sandbox

# Redis
REDIS_URL=redis://localhost:6379

# Other
DEBUG=true
```

## Running Tests

```bash
pytest tests/ -v
pytest tests/ --cov=. --cov-report=html
```

## Deployment

See DEPLOYMENT_GUIDE.md for production setup instructions.

