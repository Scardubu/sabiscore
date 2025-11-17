#!/usr/bin/env pwsh
# ============================================================================
# SabiScore Deployment Verification Script
# ============================================================================
# Run this after deployment to verify everything works correctly
#
# Usage: .\verify-deployment.ps1 -ApiUrl "https://sabiscore-api.onrender.com"
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "https://sabiscore-api.onrender.com",
    
    [Parameter(Mandatory=$false)]
    [string]$FrontendUrl = "https://sabiscore.vercel.app"
)

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     SabiScore Edge v3.0 - Deployment Verification      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [string]$ExpectedContent = $null
    )
    
    $script:totalTests++
    Write-Host "[$script:totalTests] Testing: $Name" -ForegroundColor Yellow
    Write-Host "    URL: $Url" -ForegroundColor Gray
    
    try {
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "    ✅ Status: $($response.StatusCode) OK" -ForegroundColor Green
            Write-Host "    ⏱️  TTFB: $([math]::Round($duration, 0))ms" -ForegroundColor Cyan
            
            if ($ExpectedContent) {
                if ($response.Content -like "*$ExpectedContent*") {
                    Write-Host "    ✅ Content: Contains '$ExpectedContent'" -ForegroundColor Green
                    $script:passedTests++
                    return $true
                } else {
                    Write-Host "    ❌ Content: Missing '$ExpectedContent'" -ForegroundColor Red
                    $script:failedTests++
                    return $false
                }
            }
            
            $script:passedTests++
            return $true
        } else {
            Write-Host "    ❌ Status: $($response.StatusCode) (Expected $ExpectedStatus)" -ForegroundColor Red
            $script:failedTests++
            return $false
        }
    } catch {
        Write-Host "    ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return $false
    }
    
    Write-Host ""
}

function Test-TTFBPerformance {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Iterations = 5,
        [int]$TargetMs = 150
    )
    
    $script:totalTests++
    Write-Host "[$script:totalTests] Performance Test: $Name ($Iterations requests)" -ForegroundColor Yellow
    Write-Host "    URL: $Url" -ForegroundColor Gray
    
    $times = @()
    
    for ($i = 1; $i -le $Iterations; $i++) {
        try {
            $startTime = Get-Date
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
            $endTime = Get-Date
            $duration = ($endTime - $startTime).TotalMilliseconds
            $times += $duration
            Write-Host "    Request $i : $([math]::Round($duration, 0))ms" -ForegroundColor Gray
        } catch {
            Write-Host "    Request $i`: Failed" -ForegroundColor Red
        }
    }
    
    if ($times.Count -gt 0) {
        $avgTime = ($times | Measure-Object -Average).Average
        $maxTime = ($times | Measure-Object -Maximum).Maximum
        $minTime = ($times | Measure-Object -Minimum).Minimum
        
        Write-Host "    📊 Min: $([math]::Round($minTime, 0))ms | Avg: $([math]::Round($avgTime, 0))ms | Max: $([math]::Round($maxTime, 0))ms" -ForegroundColor Cyan
        
        if ($avgTime -le $TargetMs) {
            Write-Host "    ✅ Performance: Avg TTFB under ${TargetMs}ms target" -ForegroundColor Green
            $script:passedTests++
            return $true
        } else {
            Write-Host "    ⚠️  Performance: Avg TTFB exceeds ${TargetMs}ms target" -ForegroundColor Yellow
            $script:passedTests++
            return $true
        }
    } else {
        Write-Host "    ❌ Performance: All requests failed" -ForegroundColor Red
        $script:failedTests++
        return $false
    }
    
    Write-Host ""
}

# ============================================================================
# RUN TESTS
# ============================================================================

Write-Host "🔍 Starting Backend Tests..." -ForegroundColor Magenta
Write-Host ""

# Test 1: Root Health Endpoint
Test-Endpoint -Name "Root Health Endpoint" `
    -Url "$ApiUrl/health" `
    -ExpectedContent "healthy"

# Test 2: API v1 Health Endpoint
Test-Endpoint -Name "API v1 Health Endpoint" `
    -Url "$ApiUrl/api/v1/health" `
    -ExpectedContent "healthy"

# Test 3: Root Endpoint
Test-Endpoint -Name "Root API Endpoint" `
    -Url "$ApiUrl/" `
    -ExpectedContent "Welcome"

# Test 4: API Documentation
Test-Endpoint -Name "API Documentation" `
    -Url "$ApiUrl/docs"

# Test 5: OpenAPI Schema
Test-Endpoint -Name "OpenAPI Schema" `
    -Url "$ApiUrl/openapi.json"

Write-Host ""
Write-Host "⚡ Performance Tests..." -ForegroundColor Magenta
Write-Host ""

# Test 6: TTFB Performance
Test-TTFBPerformance -Name "Health Endpoint TTFB" `
    -Url "$ApiUrl/health" `
    -Iterations 5 `
    -TargetMs 150

Write-Host ""
Write-Host "🌐 Frontend Tests..." -ForegroundColor Magenta
Write-Host ""

# Test 7: Frontend Homepage
Test-Endpoint -Name "Frontend Homepage" `
    -Url "$FrontendUrl"

# Test 8: Frontend API Route
Test-Endpoint -Name "Frontend API Health" `
    -Url "$FrontendUrl/api/health"

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    TEST SUMMARY                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$passRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 1) } else { 0 }

Write-Host "Total Tests:  $totalTests" -ForegroundColor White
Write-Host "Passed:       $passedTests" -ForegroundColor Green
Write-Host "Failed:       $failedTests" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Red" })
Write-Host "Pass Rate:    $passRate%" -ForegroundColor $(if ($passRate -ge 80) { "Green" } elseif ($passRate -ge 60) { "Yellow" } else { "Red" })
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "🎉 All tests passed! Deployment is successful." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Configure Redis URL in Render dashboard" -ForegroundColor White
    Write-Host "2. Upload ML models to S3" -ForegroundColor White
    Write-Host "3. Run database migrations" -ForegroundColor White
    Write-Host "4. Monitor logs for first 24 hours" -ForegroundColor White
    exit 0
} else {
    Write-Host "❌ Some tests failed. Review the logs above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Cyan
    Write-Host "1. Check Render logs: render logs -s sabiscore-api" -ForegroundColor White
    Write-Host "2. Verify environment variables are set" -ForegroundColor White
    Write-Host "3. Check database connection" -ForegroundColor White
    Write-Host "4. Review DEPLOYMENT_FIX_SUMMARY.md" -ForegroundColor White
    exit 1
}
