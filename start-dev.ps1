# Sabiscore v3.0 Development Startup Script
# Run this script to start all services in development mode

Write-Host "🚀 Starting Sabiscore v3.0 Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if Python is installed
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python is not installed. Please install Python 3.11+ from https://python.org" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js version: $(node --version)" -ForegroundColor Green
Write-Host "✅ Python version: $(python --version)" -ForegroundColor Green
Write-Host ""

# Install root dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing root dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Install web app dependencies if needed
if (-not (Test-Path "apps\web\node_modules")) {
    Write-Host "📦 Installing web app dependencies..." -ForegroundColor Yellow
    cd apps\web
    npm install
    cd ..\..
    Write-Host ""
}

# Check if Python virtual environment exists
if (-not (Test-Path "backend\venv")) {
    Write-Host "🐍 Creating Python virtual environment..." -ForegroundColor Yellow
    cd backend
    python -m venv venv
    .\venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    cd ..
    Write-Host ""
}

# Check if .env exists
if (-not (Test-Path "apps\web\.env.local")) {
    Write-Host "⚙️  Creating .env.local from example..." -ForegroundColor Yellow
    Copy-Item "apps\web\.env.local.example" "apps\web\.env.local"
    Write-Host "✅ Created apps\web\.env.local - please review and update if needed" -ForegroundColor Green
    Write-Host ""
}

# Start services
Write-Host "🎯 Starting development servers..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  📱 Web App:  http://localhost:3000" -ForegroundColor Green
Write-Host "  🔌 API:      http://localhost:8000" -ForegroundColor Green
Write-Host "  📚 API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Start Next.js in background
Start-Job -Name "Sabiscore-Web" -ScriptBlock {
    Set-Location $using:PWD
    cd apps\web
    npm run dev
}

# Start FastAPI in background
Start-Job -Name "Sabiscore-API" -ScriptBlock {
    Set-Location $using:PWD
    cd backend
    .\venv\Scripts\Activate.ps1
    uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
}

# Wait for user to press Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Show job statuses
        $webJob = Get-Job -Name "Sabiscore-Web" -ErrorAction SilentlyContinue
        $apiJob = Get-Job -Name "Sabiscore-API" -ErrorAction SilentlyContinue
        
        if ($webJob -and $webJob.State -eq "Running" -and $apiJob -and $apiJob.State -eq "Running") {
            # Both jobs running
        } else {
            Write-Host ""
            Write-Host "⚠️  One or more services stopped unexpectedly" -ForegroundColor Yellow
            if ($webJob) { Write-Host "Web: $($webJob.State)" }
            if ($apiJob) { Write-Host "API: $($apiJob.State)" }
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow
    Stop-Job -Name "Sabiscore-Web" -ErrorAction SilentlyContinue
    Stop-Job -Name "Sabiscore-API" -ErrorAction SilentlyContinue
    Remove-Job -Name "Sabiscore-Web" -ErrorAction SilentlyContinue
    Remove-Job -Name "Sabiscore-API" -ErrorAction SilentlyContinue
    Write-Host "✅ All services stopped" -ForegroundColor Green
}
