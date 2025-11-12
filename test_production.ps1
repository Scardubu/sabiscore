# Production Deployment Test Script
# Tests both Vercel frontend and Render backend

Write-Host "`n🚀 SabiScore Production Deployment Tests`n" -ForegroundColor Cyan

# Test 1: Render Backend Health Check
Write-Host "Test 1: Render Backend Health Check" -ForegroundColor Yellow
try {
    $backend = Invoke-RestMethod -Uri "https://sabiscore-api.onrender.com/health" -Method Get -TimeoutSec 30
    Write-Host "✅ Backend Status: $($backend.status)" -ForegroundColor Green
    Write-Host "   Timestamp: $($backend.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backend Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This is expected if backend is still deploying..." -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# Test 2: Backend API Version
Write-Host "`nTest 2: Backend API Version" -ForegroundColor Yellow
try {
    $version = Invoke-RestMethod -Uri "https://sabiscore-api.onrender.com/api/v1/health" -Method Get -TimeoutSec 30
    Write-Host "✅ API Version: $($version.version)" -ForegroundColor Green
    Write-Host "   Environment: $($version.environment)" -ForegroundColor Gray
} catch {
    Write-Host "❌ API Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 3: Get Upcoming Matches
Write-Host "`nTest 3: Get Upcoming Matches (Real Data)" -ForegroundColor Yellow
try {
    $matches = Invoke-RestMethod -Uri "https://sabiscore-api.onrender.com/api/v1/matches/upcoming?limit=3" -Method Get -TimeoutSec 30
    Write-Host "✅ Fetched $($matches.total) matches" -ForegroundColor Green
    if ($matches.matches -and $matches.matches.Count -gt 0) {
        Write-Host "   First match: $($matches.matches[0].home_team) vs $($matches.matches[0].away_team)" -ForegroundColor Gray
        Write-Host "   League: $($matches.matches[0].league)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Matches Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 4: Vercel Frontend
Write-Host "`nTest 4: Vercel Frontend" -ForegroundColor Yellow
try {
    $frontend = Invoke-WebRequest -Uri "https://sabiscore-m3gd1at7h-oversabis-projects.vercel.app" -Method Get -TimeoutSec 30 -UseBasicParsing
    Write-Host "✅ Frontend Status: $($frontend.StatusCode)" -ForegroundColor Green
    $size = [math]::Round($frontend.RawContentLength / 1024, 2)
    Write-Host "   Page Size: $size KB" -ForegroundColor Gray
} catch {
    Write-Host "❌ Frontend Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n📊 Test Summary Complete`n" -ForegroundColor Cyan
Write-Host "Frontend URL: https://sabiscore-m3gd1at7h-oversabis-projects.vercel.app" -ForegroundColor Blue
Write-Host "Backend URL:  https://sabiscore-api.onrender.com" -ForegroundColor Blue
Write-Host "`nNote: If backend tests fail, Render may still be deploying (takes 5-10 min)" -ForegroundColor Yellow
