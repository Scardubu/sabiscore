# Start SabiScore Backend - PowerShell Script
<#
.SYNOPSIS
    Start the SabiScore backend with proper environment configuration
.DESCRIPTION
    This script sets up the Python path and starts the FastAPI backend server
    with all necessary environment variables and configurations.
#>

Write-Host "🚀 Starting SabiScore Backend..." -ForegroundColor Green

# Navigate to backend directory
Set-Location "$PSScriptRoot\backend"

# Set Python path to include the current directory
$env:PYTHONPATH = $PWD

# Check if virtual environment should be activated
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "📦 Activating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
}

# Install dependencies if needed
try {
    python -c "import uvicorn" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
        pip install -r requirements.txt
    }
} catch {
    Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# Start the server
Write-Host "🌟 Starting backend server on http://localhost:8000..." -ForegroundColor Cyan
Write-Host "📚 API documentation available at http://localhost:8000/docs" -ForegroundColor Gray

try {
    python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
} catch {
    Write-Host "❌ Failed to start backend server: $_" -ForegroundColor Red
    Write-Host "💡 Try: pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}