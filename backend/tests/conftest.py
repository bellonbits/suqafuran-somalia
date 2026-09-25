"""
Pytest Configuration and Shared Fixtures
"""

import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Assuming these exist in your project
# from app.main import app
# from app.db.base import Base
# from app.api.deps import get_db


@pytest.fixture(scope="session")
def test_db():
    """Create test database"""
    # Use in-memory SQLite for tests
    SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

    # Create tables
    # Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup
    # Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_db):
    """Create new database session for test"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture
def client(db_session):
    """Create test client"""
    # def override_get_db():
    #     try:
    #         yield db_session
    #     finally:
    #         db_session.close()

    # app.dependency_overrides[get_db] = override_get_db
    # return TestClient(app)
    pass


@pytest.fixture
def admin_user(db_session):
    """Create admin test user"""
    # user = User(
    #     id="admin-1",
    #     email="admin@test.com",
    #     phone="+254712345678",
    #     full_name="Admin User",
    #     hashed_password="hashed_password",
    #     is_admin=True,
    #     is_active=True
    # )
    # db_session.add(user)
    # db_session.commit()
    # return user
    pass


# ============================================================================
# Test Database Configuration
# ============================================================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    """Set up test environment"""
    os.environ["ENVIRONMENT"] = "testing"
    os.environ["TESTING"] = "true"
    # Add other test env vars as needed
    yield


# ============================================================================
# Test Data Cleanup
# ============================================================================

@pytest.fixture(autouse=True)
def reset_db(db_session):
    """Reset database after each test"""
    yield
    # Clear tables
    # for table in reversed(Base.metadata.sorted_tables):
    #     db_session.execute(table.delete())
    # db_session.commit()


# ============================================================================
# Logging Configuration
# ============================================================================

@pytest.fixture(scope="session")
def caplog_handler():
    """Configure logging for tests"""
    import logging

    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    return logging.getLogger(__name__)
