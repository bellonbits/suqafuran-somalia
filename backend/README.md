# Suqafuran Backend

FastAPI powered backend for the Suqafuran Marketplace.

## Prerequisites
- Windows Subsystem for Linux (WSL) - Ubuntu recommended
- Python 3.10+ (Inside WSL)
- PostgreSQL (Running on Windows or WSL)
- Redis (Install via `sudo apt install redis-server`)

## Setup Instructions (WSL)

### 1. Create a Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies
```bash
# High performance standard (uvloop support in WSL)
pip install -r requirements.txt
```

### 3. Environment Configuration
The project uses a `.env` file for configuration. One has already been created for you in the `backend/` directory. 
**Note:** Ensure your PostgreSQL and Redis services are running and the credentials in `.env` match your local setup.

### 4. Run Database Migrations
We use Alembic for auto-generating the database schema based on our SQLModel definitions.

```bash
# Initialize the database (run this first time)
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### 5. Run the Development Server
```bash
uvicorn app.main:app --reload
```

## API Documentation
Once the server is running, you can access the interactive API docs at:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## Project Structure
- `app/api/`: API endpoints and versioning.
- `app/core/`: Security, config, and global settings.
- `app/crud/`: Database abstraction/operations.
- `app/models/`: Database tables (SQLModel).
- `app/db/`: Database session management.
- `app/utils/`: Helper functions (Email, etc).
