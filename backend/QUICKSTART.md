# Suqafuran Backend - Quick Start

## 30-Second Setup

### 1. Install & Configure

```bash
cd /Users/mac/suqafuran/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your PostgreSQL URL (minimum):
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/suqafuran
```

### 2. Initialize Database

```bash
createdb suqafuran
python -c "from database import engine; from models import Base; Base.metadata.create_all(engine)"
```

### 3. Run Server

```bash
python -m uvicorn main:app --reload
```

Visit: **http://localhost:8000/docs**

## Test It Out

### Sign Up

```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "+254712345678",
    "full_name": "John Doe",
    "password": "password123"
  }'
```

Copy the `access_token` from response.

### Create Order

```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product_id": "prod_1",
        "title": "Milk",
        "quantity": 2,
        "price": 150
      }
    ],
    "delivery_option": "delivery",
    "delivery_address": "123 Main St",
    "phone_number": "+254712345678",
    "courier_tip": 50,
    "location": {
      "latitude": -1.2921,
      "longitude": 36.8219
    }
  }'
```

### Check Order

```bash
curl -X GET http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Key Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI application |
| `models.py` | Database tables |
| `schemas.py` | Request/response validation |
| `routers/payments.py` | M-Pesa integration |
| `routers/sellers.py` | Seller management |
| `routers/riders.py` | Rider management |
| `config.py` | Settings & credentials |
| `.env` | Sensitive configuration |

## API Documentation

Automatic OpenAPI docs: **http://localhost:8000/docs**

Manual endpoint list in `BACKEND_API_SPEC.md`

## Common Issues

### Port Already in Use
```bash
python -m uvicorn main:app --reload --port 8001
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
psql -U postgres

# Create database if missing
createdb suqafuran
```

### Import Errors
Ensure you're in the virtual environment:
```bash
source venv/bin/activate
```

## Next Steps

1. ✅ **Backend running** - You are here
2. 🔄 **Test M-Pesa** - Update `.env` with sandbox credentials
3. 🔄 **Connect Frontend** - Configure API base URL in Next.js
4. 🔄 **Add WebSocket** - Real-time delivery tracking
5. 🔄 **Deploy** - Docker/production setup

## Documentation

- **Setup Guide**: `SETUP.md`
- **API Spec**: `BACKEND_API_SPEC.md` (in parent)
- **Status**: `IMPLEMENTATION_STATUS.md`
- **Architecture**: `README_BACKEND_SETUP.md`

## Debugging

Enable detailed logging:
```python
# In main.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check database:
```bash
psql suqafuran
\dt  # List tables
SELECT * FROM users;  # Check data
```

## Support Files

- `requirements.txt` - Python packages
- `SETUP.md` - Detailed installation
- `.env.example` - Configuration template
- `docker-compose.yml` - (TODO) Local development stack

---

**You're ready!** Server is now running at http://localhost:8000 🚀
