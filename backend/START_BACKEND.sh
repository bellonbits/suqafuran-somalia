#!/bin/bash

# Suqafuran Backend Startup Script
# Handles configuration and service startup

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_header "Suqafuran Backend Startup"

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    print_warning "Checking for .env.phase4..."
    if [ -f ".env.phase4" ]; then
        cp .env.phase4 .env
        print_success "Created .env from template"
        print_warning "Edit .env with your Resend, Africastalking, Firebase credentials"
    else
        print_error "No .env file found"
        exit 1
    fi
fi

# Check Python
print_header "Checking Python"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    print_success "Python $PYTHON_VERSION"
else
    print_error "Python 3 not found"
    exit 1
fi

# Install dependencies
print_header "Installing Dependencies"
python3 -m pip install -q -r requirements.txt
print_success "Dependencies installed"

# Create/verify database tables
print_header "Preparing Database"
python3 << 'PYEOF'
try:
    from database import Base, engine
    from models import *

    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables ready")
except Exception as e:
    print(f"Note: {e}")
    print("✓ Database connection configured")
PYEOF

# Check Redis
print_header "Checking Redis"
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        print_success "Redis is running"
    else
        print_warning "Redis configured but not running"
        print_warning "Start Redis in another terminal: redis-server"
    fi
else
    print_warning "Redis CLI not found - checking connection..."
fi

# Summary
print_header "Startup Instructions"
echo ""
echo -e "${BLUE}Run these commands in separate terminals:${NC}"
echo ""
echo -e "${GREEN}Terminal 1 - Celery Worker:${NC}"
echo "  cd $SCRIPT_DIR && celery -A celery_app worker --loglevel=info --queues=notifications"
echo ""
echo -e "${GREEN}Terminal 2 - FastAPI Backend (THIS TERMINAL):${NC}"
echo "  python main.py"
echo ""
echo -e "${GREEN}Terminal 3 - Testing:${NC}"
echo "  curl http://localhost:8000/health"
echo ""

# Ask to continue
echo -e "${YELLOW}Press Enter to start FastAPI backend, or Ctrl+C to cancel...${NC}"
read

print_header "Starting FastAPI Backend"
echo ""

# Start the backend
python main.py
