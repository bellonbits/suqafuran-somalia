# Rider System Test Suite

Complete pytest test suite for Suqafuran Rider/Driver system (Sprints 1-4).

## Overview

- **Total Tests**: 30+ smoke tests
- **Coverage**: Sprints 1-4 endpoints
- **Framework**: pytest + FastAPI TestClient

## Test Structure

```
tests/
├── conftest.py              # Pytest configuration & fixtures
├── test_rider_system.py     # Main test suite
└── README.md               # This file
```

## Test Categories

### Sprint 1: Dashboard & Available Orders (2 tests)
- `test_get_rider_dashboard` - Fetch dashboard stats
- `test_get_available_deliveries` - Fetch nearby orders
- `test_get_available_deliveries_distance_filtering` - Distance filtering

### Sprint 2: Delivery Workflow (4 tests)
- `test_confirm_pickup` - Confirm pickup
- `test_start_delivery` - Start delivery transition
- `test_complete_delivery` - Complete delivery
- `test_earnings_calculation_on_completion` - Verify earnings

### Sprint 3: Earnings & Performance (8 tests)
- `test_get_earnings_daily` - Daily earnings
- `test_get_earnings_weekly` - Weekly earnings
- `test_get_earnings_monthly` - Monthly earnings
- `test_get_performance_metrics` - Performance stats
- `test_get_delivery_history` - Delivery history
- `test_request_withdrawal` - Withdrawal request
- `test_withdrawal_minimum_amount` - Minimum validation
- `test_withdrawal_insufficient_balance` - Balance validation
- `test_get_withdrawal_history` - Withdrawal history

### Sprint 4: Messaging & Documents (7 tests)
- `test_send_message` - Send message to customer
- `test_get_messages` - Retrieve messages
- `test_rate_customer` - Rate customer
- `test_rating_validation` - Rating validation
- `test_get_documents_expiry` - Document expiry
- `test_get_rider_profile` - Get profile
- `test_update_rider_profile` - Update profile

### Authentication & Validation (5 tests)
- `test_unauthenticated_access_denied` - Auth check
- `test_invalid_token_denied` - Token validation
- `test_non_rider_cannot_access` - Role checking
- `test_invalid_coordinates` - Coordinate validation
- `test_invalid_pagination` - Pagination validation

## Installation

### Prerequisites
```bash
# Python 3.11+
python --version

# PostgreSQL (for production tests)
psql --version
```

### Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install pytest pytest-asyncio pytest-cov
```

## Running Tests

### Run All Tests
```bash
cd backend
pytest tests/

# With verbose output
pytest tests/ -v

# With print statements
pytest tests/ -s

# With coverage report
pytest tests/ --cov=app --cov-report=html
```

### Run Specific Test Class
```bash
# Sprint 1 tests only
pytest tests/test_rider_system.py::TestRiderDashboard -v

# Sprint 2 tests only
pytest tests/test_rider_system.py::TestRiderDeliveryWorkflow -v

# Sprint 3 tests only
pytest tests/test_rider_system.py::TestRiderEarningsAndPerformance -v

# Sprint 4 tests only
pytest tests/test_rider_system.py::TestRiderMessaging -v
```

### Run Specific Test
```bash
pytest tests/test_rider_system.py::TestRiderDashboard::test_get_rider_dashboard -v
```

### Run with Markers
```bash
# Run only integration tests
pytest tests/ -m integration

# Run only unit tests
pytest tests/ -m unit

# Skip slow tests
pytest tests/ -m "not slow"
```

## Configuration

### pytest.ini
```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --strict-markers --tb=short
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow tests
    smoke: Smoke tests
```

### conftest.py
Configure:
- Database setup/teardown
- Test fixtures
- Authentication mocks
- Database session management

## Test Fixtures

### Database Fixtures
- `test_db` - Test database session
- `db_session` - Clean database per test

### User Fixtures
- `admin_user` - Admin test user
- `rider_user` - Rider test user
- `customer_user` - Customer test user

### Data Fixtures
- `active_delivery_assignment` - Active delivery
- `confirmed_delivery` - Confirmed delivery
- `in_transit_delivery` - In-transit delivery
- `completed_delivery` - Completed delivery
- `funded_rider` - Rider with earnings

### Client Fixtures
- `client` - Unauthenticated test client
- `authenticated_client` - Authenticated rider client
- `authenticated_admin_client` - Authenticated admin client

## Expected Results

### All Tests Passing
```
============================= test session starts ==============================
collected 30 items

tests/test_rider_system.py::TestRiderDashboard::test_get_rider_dashboard PASSED
tests/test_rider_system.py::TestRiderDashboard::test_get_available_deliveries PASSED
...

========================= 30 passed in 2.34s ==========================
```

### Coverage Report
```
Name                      Stmts   Miss  Cover   Missing
-----------------------------------------------------
app/routers/riders.py      350     25    93%    142-150, 200-210
app/models.py              200     10    95%
app/services/earnings.py   120      5    96%
-----------------------------------------------------
TOTAL                     1200     80    93%
```

## Common Issues

### ImportError: No module named 'app'
```bash
# Ensure app package is installed
pip install -e .
```

### Database locked error
```bash
# Clear test database
rm test.db

# Or use in-memory SQLite (automatic)
```

### Timeout on tests
```bash
# Add timeout
pytest tests/ --timeout=30

# Or increase timeout for specific test
@pytest.mark.timeout(60)
def test_long_running():
    pass
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: 3.11
      - run: pip install -r requirements.txt pytest pytest-cov
      - run: pytest tests/ --cov=app --cov-report=xml
      - uses: codecov/codecov-action@v2
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

cd backend
pytest tests/ -q
if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
```

## Performance Benchmarks

Target response times for tests:

| Endpoint | Expected | Target |
|----------|----------|--------|
| GET /dashboard | <100ms | <200ms |
| GET /available-deliveries | <150ms | <300ms |
| GET /earnings | <100ms | <200ms |
| GET /performance | <100ms | <200ms |
| POST /confirm-pickup | <50ms | <100ms |
| POST /complete-delivery | <100ms | <200ms |

## Coverage Goals

- **Overall**: 80%+ coverage
- **Critical endpoints**: 90%+ coverage
- **Models**: 95%+ coverage
- **Utils**: 85%+ coverage

## Contributing

When adding new tests:
1. Follow naming convention: `test_<feature>_<scenario>`
2. Add docstring explaining what's tested
3. Use fixtures from conftest.py
4. Keep tests independent (no dependencies between tests)
5. Run full suite before committing

## Documentation

- [pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-basics/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/14/orm/session.html)

## Next Steps

1. ✅ Create test suite
2. ⏳ Implement test fixtures
3. ⏳ Add database mocking
4. ⏳ Achieve 80%+ coverage
5. ⏳ Integrate with CI/CD

---

**Status**: Ready for implementation  
**Updated**: July 4, 2026  
**Maintainer**: QA Team
