# Suqafuran Backend Setup Guide

## Prerequisites

- Python 3.9+
- PostgreSQL 12+
- Redis 6.0+
- M-Pesa Daraja test account (https://developer.safaricom.co.ke/)

## Installation

### 1. Create Virtual Environment

```bash
cd /Users/mac/suqafuran/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Key variables to update:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Change to a secure random string
- `MPESA_CONSUMER_KEY` & `MPESA_CONSUMER_SECRET`: Get from Daraja dashboard
- `SMTP_*`: Email configuration
- `AFRICASTALKING_*`: SMS provider credentials

### 4. Initialize Database

```bash
# Create database
createdb suqafuran

# Run migrations (if using Alembic)
# alembic upgrade head

# Or create tables manually:
python -c "from database import engine; from models import Base; Base.metadata.create_all(engine)"
```

### 5. Run Development Server

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit http://localhost:8000/docs for interactive API documentation.

## Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration and settings
├── database.py          # Database setup and session management
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic validation schemas
├── routers/             # API route handlers
│   ├── payments.py      # Payment & M-Pesa integration
│   ├── sellers.py       # Seller management
│   └── riders.py        # Rider management
├── utils/
│   └── security.py      # JWT & password utilities
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variables template
└── SETUP.md            # This file
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Create user account
- `POST /api/v1/auth/login` - Login with email/password

### Orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - List user orders
- `GET /api/v1/orders/{id}` - Get order details
- `POST /api/v1/orders/{id}/rate-delivery` - Rate delivery
- `POST /api/v1/orders/{id}/report-issue` - Report issue

### Sellers
- `POST /api/v1/sellers/register` - Register seller
- `GET /api/v1/sellers/me` - Get seller profile
- `PATCH /api/v1/sellers/me` - Update seller profile
- `POST /api/v1/sellers/verify-mpesa` - Verify M-Pesa number
- `GET /api/v1/sellers/me/orders` - Get seller orders
- `GET /api/v1/sellers/me/earnings` - Get earnings summary
- `POST /api/v1/sellers/me/withdrawals` - Request withdrawal

### Payments
- `POST /api/v1/payments/mpesa/initiate` - Initiate M-Pesa payment
- `GET /api/v1/payments/{order_id}/status` - Check payment status
- `POST /api/v1/payments/{order_id}/refund` - Refund payment

### Riders
- `POST /api/v1/riders/register` - Register as rider
- `POST /api/v1/riders/{id}/location` - Update rider location
- `POST /api/v1/riders/assignments/assign` - Assign delivery

## Database Models

### User
User authentication and profile data

### Seller
Shop information and earnings tracking

### Order
Customer orders with items and pricing

### Payment
Payment records and M-Pesa integration

### Rider
Delivery partner profiles and assignments

### Issue
Dispute resolution system

## Authentication

All protected endpoints require Bearer token:

```
Authorization: Bearer {access_token}
```

Get token by signing up or logging in:

```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "phone": "+254712345678",
    "full_name": "John Doe",
    "password": "secure_password"
  }'
```

## M-Pesa Integration

The system uses M-Pesa Daraja API for payments:

1. **STK Push**: Prompts customer to enter M-Pesa PIN
2. **Callback**: M-Pesa sends payment confirmation
3. **Payment Splitting**: Automatic distribution to seller, Suqafuran, and rider

### Testing M-Pesa

Use sandbox credentials and test phone numbers:
- Test Phone: 254708374149
- Test Amount: Any amount between 10-150,000 KSh

## Performance Tips

- Use connection pooling for database
- Cache frequently accessed data with Redis
- Implement pagination for large lists
- Add database indexes for common queries

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running
- Verify `DATABASE_URL` in `.env`
- Ensure database exists: `createdb suqafuran`

### M-Pesa Integration Issues
- Verify sandbox credentials
- Check callback URL is publicly accessible
- Review M-Pesa Daraja logs

### JWT Token Errors
- Ensure `SECRET_KEY` matches between auth and validation
- Check token expiration time
- Verify bearer token format: `Authorization: Bearer <token>`

## Next Steps

1. Set up Alembic for database migrations
2. Implement admin dashboard endpoints
3. Add WebSocket support for real-time delivery tracking
4. Create test suite for all endpoints
5. Deploy to production environment

## Support

For issues or questions, check:
- FastAPI documentation: https://fastapi.tiangolo.com/
- M-Pesa Daraja docs: https://developer.safaricom.co.ke/
- SQLAlchemy docs: https://docs.sqlalchemy.org/
