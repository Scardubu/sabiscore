# Phase 2 Setup Script
# Automates the complete Phase 2 data pipeline setup

Write-Host "🚀 Sabiscore Phase 2 Setup" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "backend/requirements.txt")) {
    Write-Host "❌ Error: Please run this script from the Sabiscore root directory" -ForegroundColor Red
    exit 1
}

# Step 1: Python dependencies
Write-Host "📦 Step 1/5: Installing Python dependencies..." -ForegroundColor Yellow
Set-Location backend

try {
    pip install -r requirements.txt --quiet
    Write-Host "✅ Python dependencies installed`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
    exit 1
}

# Step 2: Playwright browsers
Write-Host "🎭 Step 2/5: Installing Playwright browsers..." -ForegroundColor Yellow
try {
    playwright install chromium
    Write-Host "✅ Playwright chromium installed`n" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Warning: Playwright install failed. xG scraping may not work." -ForegroundColor Yellow
}

# Step 3: Initialize database
Write-Host "🗄️  Step 3/5: Initializing database schema..." -ForegroundColor Yellow
try {
    python -m src.cli.data_pipeline init-db
    Write-Host "✅ Database schema initialized`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to initialize database" -ForegroundColor Red
    exit 1
}

# Step 4: Prompt for data loading
Write-Host "📥 Step 4/5: Load historical data?" -ForegroundColor Yellow
Write-Host "This will download ~2,280 matches (EPL, La Liga, Bundesliga - last 2 seasons)"
Write-Host "Expected time: 15-20 minutes`n"

$loadData = Read-Host "Load now? (y/n)"

if ($loadData -eq "y" -or $loadData -eq "Y") {
    Write-Host "`nStarting historical data load..." -ForegroundColor Cyan
    
    try {
        python -m src.cli.data_pipeline load-historical -l E0 -l SP1 -l D1 -s 2324 -s 2425
        Write-Host "`n✅ Historical data loaded`n" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to load historical data" -ForegroundColor Red
    }
    
    # Step 4b: Generate features
    Write-Host "🔬 Generating features for first 100 matches..." -ForegroundColor Yellow
    
    try {
        python -m src.cli.data_pipeline enrich-features --limit 100
        Write-Host "✅ Features generated`n" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Warning: Feature generation failed" -ForegroundColor Yellow
    }
} else {
    Write-Host "Skipped. You can load data later with:" -ForegroundColor Gray
    Write-Host "  python -m src.cli.data_pipeline load-historical -l E0 -s 2324`n" -ForegroundColor Gray
}

# Step 5: Pipeline status
Write-Host "📊 Step 5/5: Checking pipeline status..." -ForegroundColor Yellow
try {
    python -m src.cli.data_pipeline pipeline-status
    Write-Host ""
} catch {
    Write-Host "⚠️  Could not retrieve pipeline status" -ForegroundColor Yellow
}

# Setup complete
Set-Location ..
Write-Host "✨ Phase 2 Setup Complete!`n" -ForegroundColor Green

Write-Host "Quick Commands:" -ForegroundColor Cyan
Write-Host "  cd backend" -ForegroundColor Gray
Write-Host "  python -m src.cli.data_pipeline load-historical -l E0 -s 2324" -ForegroundColor Gray
Write-Host "  python -m src.cli.data_pipeline scrape-xg --days 7" -ForegroundColor Gray
Write-Host "  python -m src.cli.data_pipeline enrich-features --limit 100" -ForegroundColor Gray
Write-Host "  python -m src.cli.data_pipeline poll-live --league EPL`n" -ForegroundColor Gray

Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  PHASE_2_QUICK_START.md - Quick reference" -ForegroundColor Gray
Write-Host "  PHASE_2_COMPLETE.md - Full documentation" -ForegroundColor Gray
Write-Host "  PHASE_2_SUMMARY.md - Implementation summary`n" -ForegroundColor Gray

Write-Host "🚀 Ready to proceed with Phase 3: ML Model Ops!" -ForegroundColor Green
