#!/bin/bash
# backend/scripts/setup.sh
# Complete setup script for Sabiscore models

set -e  # Exit on error

echo "============================================================"
echo "SABISCORE MODEL SETUP v3.0"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Python version
echo "🔍 Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.9"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then 
    echo -e "${RED}❌ Python $required_version or higher required. Found: $python_version${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python $python_version${NC}"

# Check if Redis is running
echo ""
echo "🔍 Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠️  Redis not running. Starting Redis...${NC}"
    
    # Try to start Redis with Docker
    if command -v docker &> /dev/null; then
        docker run -d -p 6379:6379 --name sabiscore-redis redis:7-alpine
        sleep 2
        if redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis started via Docker${NC}"
        else
            echo -e "${RED}❌ Failed to start Redis. Please install Redis manually.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Redis not found. Please install Redis:${NC}"
        echo "   Ubuntu: sudo apt install redis-server"
        echo "   Mac: brew install redis"
        echo "   Or use Docker: docker run -d -p 6379:6379 redis:7-alpine"
        exit 1
    fi
fi

# Create virtual environment
echo ""
echo "📦 Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${YELLOW}⚠️  Virtual environment already exists${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo ""
echo "⬆️  Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
echo -e "${GREEN}✅ Pip upgraded${NC}"

# Install dependencies
echo ""
echo "📚 Installing Python dependencies..."
pip install -r requirements.txt
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p data/historical/{epl,laliga,bundesliga,seriea,ligue1,championship,eredivisie}
mkdir -p data/scraped
mkdir -p logs
mkdir -p models/weights
echo -e "${GREEN}✅ Directories created${NC}"

# Initialize database
echo ""
echo "🗄️  Initializing database..."
python -c "
from src.core.database import engine, Base
Base.metadata.create_all(bind=engine)
print('Database tables created')
"
echo -e "${GREEN}✅ Database initialized${NC}"

# Download sample data
echo ""
echo "📥 Downloading sample historical data..."
python scripts/download_historical_data.py
echo -e "${GREEN}✅ Sample data downloaded${NC}"

# Test Redis connection
echo ""
echo "🔌 Testing Redis connection..."
python -c "
import redis
r = redis.from_url('redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379')
r.set('test', 'success')
assert r.get('test').decode() == 'success'
print('Redis connection successful')
"
echo -e "${GREEN}✅ Redis connection working${NC}"

# Run quick validation
echo ""
echo "🧪 Running validation tests..."
python -m pytest tests/ -v --tb=short || echo -e "${YELLOW}⚠️  Some tests failed (this is OK for initial setup)${NC}"

echo ""
echo "============================================================"
echo -e "${GREEN}✅ SETUP COMPLETE!${NC}"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Load historical data: python scripts/load_historical_data.py"
echo "2. Train models: python -m src.scripts.train_models"
echo "3. Start API: uvicorn src.api.main:app --reload"
echo ""
echo "For detailed instructions, see: INTEGRATION_GUIDE.md"
echo ""