#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Local integration test for SabiScore backend-frontend connectivity
.DESCRIPTION
    Tests API endpoints and frontend API client to verify full-stack integration
#>

$ErrorActionPreference = "Continue"

Write-Host "[TEST] SabiScore Integration Test" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

# Check if backend is running
Write-Host "1. Testing Backend Health Endpoints..." -ForegroundColor Yellow

try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 5
    Write-Host "   [OK] /health endpoint:" -ForegroundColor Green -NoNewline
    Write-Host " Status=$($healthResponse.status)" -ForegroundColor White
    
    if ($healthResponse.components.database.status -eq "healthy") {
        Write-Host "   [OK] Database: Connected" -ForegroundColor Green
    } else {
        Write-Host "   [!] Database: $($healthResponse.components.database.status)" -ForegroundColor Yellow
    }
    
    if ($healthResponse.components.cache.status -eq "healthy") {
        Write-Host "   [OK] Cache: Connected" -ForegroundColor Green
    } else {
        Write-Host "   [!] Cache: $($healthResponse.components.cache.status)" -ForegroundColor Yellow
    }
    
    if ($healthResponse.components.ml_models.status -eq "healthy") {
        Write-Host "   [OK] ML Models: Loaded" -ForegroundColor Green
    } else {
        Write-Host "   [!] ML Models: $($healthResponse.components.ml_models.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [X] Backend not responding at http://localhost:8000" -ForegroundColor Red
    Write-Host "   [i] Start backend with: cd backend; uvicorn src.api.main:app --reload --port 8000" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# Test API v1 health endpoint
Write-Host "2. Testing API v1 Endpoints..." -ForegroundColor Yellow

try {
    $apiHealthResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/health" -Method Get -TimeoutSec 5
    Write-Host "   [OK] /api/v1/health endpoint: Status=$($apiHealthResponse.status)" -ForegroundColor Green
} catch {
    Write-Host "   [X] /api/v1/health not accessible" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check frontend environment configuration
Write-Host "3. Verifying Frontend Configuration..." -ForegroundColor Yellow

$envFile = "apps/web/.env.local"
if (Test-Path $envFile) {
    $apiUrl = Get-Content $envFile | Select-String "NEXT_PUBLIC_API_URL" | ForEach-Object { $_.Line.Split("=")[1].Trim() }
    if ($apiUrl) {
        Write-Host "   [OK] Local API URL configured: $apiUrl" -ForegroundColor Green
    } else {
        Write-Host "   [!] NEXT_PUBLIC_API_URL not set in .env.local" -ForegroundColor Yellow
        Write-Host "   [i] Expected: NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" -ForegroundColor Gray
    }
} else {
    Write-Host "   [!] .env.local not found" -ForegroundColor Yellow
    Write-Host "   [i] Create apps/web/.env.local with:" -ForegroundColor Gray
    Write-Host "      NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" -ForegroundColor Gray
}

$envProdFile = "apps/web/.env.production"
if (Test-Path $envProdFile) {
    $prodApiUrl = Get-Content $envProdFile | Select-String "NEXT_PUBLIC_API_URL" | ForEach-Object { $_.Line.Split("=")[1].Trim() }
    if ($prodApiUrl) {
        Write-Host "   [OK] Production API URL: $prodApiUrl" -ForegroundColor Green
        if (-not $prodApiUrl.EndsWith("/api/v1")) {
            Write-Host "   [!] Production URL missing /api/v1 suffix!" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# Test team search endpoint
Write-Host "4. Testing Team Search Endpoint..." -ForegroundColor Yellow

try {
    $teamSearchResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/matches/teams/search?query=Chelsea" -Method Get -TimeoutSec 5
    if ($teamSearchResponse.teams -and $teamSearchResponse.teams.Count -gt 0) {
        Write-Host "   [OK] Team search working: Found $($teamSearchResponse.teams.Count) teams" -ForegroundColor Green
        Write-Host "      Sample: $($teamSearchResponse.teams[0])" -ForegroundColor Gray
    } else {
        Write-Host "   [!] Team search returned no results" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [!] Team search endpoint not available (may need database seed)" -ForegroundColor Yellow
}

Write-Host ""

# Check if frontend is running
Write-Host "5. Testing Frontend Server..." -ForegroundColor Yellow

try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -Method Get -TimeoutSec 5 -UseBasicParsing
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "   [OK] Frontend responding at http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "   [!] Frontend not responding at http://localhost:3000" -ForegroundColor Yellow
    Write-Host "   [i] Start frontend with: cd apps/web; npm run dev" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "[OK] Integration Test Complete" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  - Ensure both backend and frontend are running" -ForegroundColor Gray
Write-Host "  - Visit http://localhost:3000 to test UI" -ForegroundColor Gray
Write-Host "  - Check browser console for API errors" -ForegroundColor Gray
Write-Host "  - Test match selector with team autocomplete" -ForegroundColor Gray
Write-Host ""
