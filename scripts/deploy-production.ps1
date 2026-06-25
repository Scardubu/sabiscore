# SabiScore 3.0 - Production Deployment Automation
# This script automates the complete deployment process

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SabiScore 3.0 Deployment Automation  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$VERCEL_PROJECT = "sabiscore"
$BACKEND_SERVICE = "sabiscore-backend"

# Step 1: Pre-deployment checks
Write-Host "[1/7] Running pre-deployment checks..." -ForegroundColor Yellow

# Check if required tools are installed
$tools = @("vercel", "git", "node", "npm")
foreach ($tool in $tools) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "Error: $tool is not installed" -ForegroundColor Red
        exit 1
    }
}

# Check if environment variables are set
$required_vars = @(
    "NEXT_PUBLIC_API_URL",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "DATABASE_URL"
)

foreach ($var in $required_vars) {
    if (!(Test-Path env:$var)) {
        Write-Host "Warning: $var is not set" -ForegroundColor Yellow
    }
}

Write-Host "Pre-deployment checks passed" -ForegroundColor Green

# Step 2: Run tests
Write-Host ""
Write-Host "[2/7] Running tests..." -ForegroundColor Yellow

npm run test -- --run --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

Write-Host "All tests passed" -ForegroundColor Green

# Step 3: Build frontend
Write-Host ""
Write-Host "[3/7] Building frontend..." -ForegroundColor Yellow

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

Write-Host "Frontend build successful" -ForegroundColor Green

# Step 4: Deploy to Vercel
Write-Host ""
Write-Host "[4/7] Deploying to Vercel..." -ForegroundColor Yellow

# Deploy with production flag
vercel --prod --yes
if ($LASTEXITCODE -ne 0) {
    Write-Host "Vercel deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Vercel deployment successful" -ForegroundColor Green

# Step 5: Health check
Write-Host ""
Write-Host "[5/7] Running health checks..." -ForegroundColor Yellow

Start-Sleep -Seconds 10 # Wait for deployment to stabilize

# Check frontend health
$frontendUrl = $env:NEXT_PUBLIC_API_URL
if ($frontendUrl) {
    try {
        $response = Invoke-WebRequest -Uri $frontendUrl -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "Frontend health check passed" -ForegroundColor Green
        } else {
            Write-Host "Frontend health check failed: HTTP $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host "Frontend health check failed: $_" -ForegroundColor Red
    }
}

# Check backend health
if ($env:NEXT_PUBLIC_API_URL) {
    try {
        $backendUrl = "$($env:NEXT_PUBLIC_API_URL)/health"
        $response = Invoke-WebRequest -Uri $backendUrl -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "Backend health check passed" -ForegroundColor Green
        } else {
            Write-Host "Backend health check failed: HTTP $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host "Backend health check failed: $_" -ForegroundColor Red
    }
}

# Step 6: Smoke tests
Write-Host ""
Write-Host "[6/7] Running smoke tests..." -ForegroundColor Yellow

# Test prediction API
try {
    $testPayload = @{
        homeTeam = "Test Home"
        awayTeam = "Test Away"
        homeForm = @(1, 1, 0)
        awayForm = @(0, 0, 1)
        homeXg = 1.5
        awayXg = 1.2
    } | ConvertTo-Json

    $predictionUrl = "$($env:NEXT_PUBLIC_API_URL)/api/predict"
    $response = Invoke-WebRequest -Uri $predictionUrl -Method POST -Body $testPayload -ContentType "application/json" -TimeoutSec 15
    
    if ($response.StatusCode -eq 200) {
        Write-Host "Prediction API smoke test passed" -ForegroundColor Green
    } else {
        Write-Host "Prediction API smoke test failed" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Prediction API smoke test failed: $_" -ForegroundColor Yellow
}

# Step 7: Deployment summary
Write-Host ""
Write-Host "[7/7] Deployment Summary" -ForegroundColor Yellow
Write-Host "=========================" -ForegroundColor Yellow

# Get deployment info
$deploymentInfo = vercel ls $VERCEL_PROJECT --json | ConvertFrom-Json
if ($deploymentInfo -and $deploymentInfo.Count -gt 0) {
    $latestDeployment = $deploymentInfo[0]
    Write-Host "Deployment URL: $($latestDeployment.url)" -ForegroundColor Cyan
    Write-Host "Status: $($latestDeployment.state)" -ForegroundColor Cyan
    Write-Host "Created: $($latestDeployment.created)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment completed successfully!    " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Monitor deployment at: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Check logs: vercel logs" -ForegroundColor White
Write-Host "3. Run load tests: npm run test:load" -ForegroundColor White
Write-Host "4. Verify monitoring dashboard: $($env:NEXT_PUBLIC_API_URL)/monitoring" -ForegroundColor White
Write-Host ""
