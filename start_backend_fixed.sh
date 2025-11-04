#!/bin/bash
# Start SabiScore Backend

# Navigate to backend directory
cd "$(dirname "$0")/backend" || exit 1

# Set Python path
export PYTHONPATH="$PWD"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start the server
echo "Starting SabiScore Backend on port 8000..."
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000