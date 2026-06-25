# SabiScore 3.0 - Complete Endpoint Verification Script
# Tests all API endpoints and reports status

Write-Host "🧪 SabiScore 3.0 - Endpoint Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Body = @{}
    )
    
    Write-Host "Testing $Name..." -NoNewline
    
    try {
        $params = @{
            Uri = "$baseUrl$Url"
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 30
        }
        
        if ($Body.Count -gt 0) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host " ✅ OK" -ForegroundColor Green
            $results += [PSCustomObject]@{
                Endpoint = $Name
                Status = "✅ Pass"
                StatusCode = $response.StatusCode
                ResponseTime = "OK"
            }
            return $true
        } else {
            Write-Host " ⚠️ $($response.StatusCode)" -ForegroundColor Yellow
            $results += [PSCustomObject]@{
                Endpoint = $Name
                Status = "⚠️ Warn"
                StatusCode = $response.StatusCode
                ResponseTime = "OK"
            }
            return $false
        }
    } catch {
        Write-Host " ❌ FAIL" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $results += [PSCustomObject]@{
            Endpoint = $Name
            Status = "❌ Fail"
            StatusCode = "Error"
            ResponseTime = $_.Exception.Message
        }
        return $false
    }
}

# Test all endpoints
Write-Host "📡 Testing API Endpoints..." -ForegroundColor Cyan
Write-Host ""

# Health & Monitoring
Test-Endpoint -Name "Health Check" -Url "/api/health"
Test-Endpoint -Name "Metrics" -Url "/api/metrics"
Test-Endpoint -Name "Drift Detection" -Url "/api/drift"

# Prediction & Betting
Test-Endpoint -Name "Prediction API" -Url "/api/predict" -Method "POST" -Body @{
    homeTeam = "Arsenal"
    awayTeam = "Chelsea"
    league = "Premier League"
}

Test-Endpoint -Name "Kelly Optimizer" -Url "/api/kelly" -Method "POST" -Body @{
    homeWin = 0.45
    draw = 0.28
    awayWin = 0.27
    confidence = 0.73
    odds = @{
        home = 2.20
        draw = 3.40
        away = 3.00
    }
}

# Odds APIs
Test-Endpoint -Name "Odds API" -Url "/api/odds/odds-api" -Method "POST" -Body @{
    homeTeam = "Arsenal"
    awayTeam = "Chelsea"
}

Test-Endpoint -Name "Football Data" -Url "/api/odds/football-data" -Method "POST" -Body @{
    homeTeam = "Arsenal"
    awayTeam = "Chelsea"
}

Test-Endpoint -Name "Oddsportal" -Url "/api/odds/oddsportal" -Method "POST" -Body @{
    homeTeam = "Arsenal"
    awayTeam = "Chelsea"
}

# Pages
Write-Host ""
Write-Host "📄 Testing Pages..." -ForegroundColor Cyan
Write-Host ""

Test-Endpoint -Name "Home Page" -Url "/"
Test-Endpoint -Name "Monitoring Dashboard" -Url "/monitoring"
Test-Endpoint -Name "Match Page" -Url "/match"
Test-Endpoint -Name "Docs Page" -Url "/docs"

# Summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$results | Format-Table -AutoSize

$passed = ($results | Where-Object { $_.Status -eq "✅ Pass" }).Count
$warned = ($results | Where-Object { $_.Status -eq "⚠️ Warn" }).Count
$failed = ($results | Where-Object { $_.Status -eq "❌ Fail" }).Count
$total = $results.Count

Write-Host ""
Write-Host "Total Tests: $total" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Warned: $warned" -ForegroundColor Yellow
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ All critical tests passed!" -ForegroundColor Green
    Write-Host "🚀 Ready for production deployment!" -ForegroundColor Green
} else {
    Write-Host "❌ Some tests failed. Please review errors above." -ForegroundColor Red
}

Write-Host ""
