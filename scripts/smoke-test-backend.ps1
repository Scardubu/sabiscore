#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Smoke tests for SabiScore backend API endpoints
.DESCRIPTION
    Validates core backend functionality: health, matches, predictions, odds
    Target: All endpoints respond < 500ms with valid JSON
#>

$ErrorActionPreference = "Stop"
$API_URL = if ([string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_API_URL)) {
    "http://localhost:8000"
} else {
    $env:NEXT_PUBLIC_API_URL
}
$BASE_URL = "$API_URL/api/v1"

Write-Host "=== SabiScore Backend Smoke Tests ===" -ForegroundColor Cyan
Write-Host "Target: $BASE_URL`n"

$passed = 0
$failed = 0
$results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [int]$ExpectedStatus = 200,
        [int]$TimeoutMs = 5000
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        $start = Get-Date
        
        $params = @{
            Uri = $Url
            Method = $Method
            TimeoutSec = $TimeoutMs / 1000
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        $elapsed = (Get-Date) - $start
        $elapsedMs = [int]$elapsed.TotalMilliseconds
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            # Validate JSON response
            $json = $response.Content | ConvertFrom-Json
            
            Write-Host (" [PASS] ({0} ms)" -f $elapsedMs) -ForegroundColor Green
            $script:passed++
            
            return @{
                Name = $Name
                Status = "PASS"
                Time = $elapsedMs
                StatusCode = $response.StatusCode
            }
        } else {
            Write-Host " [FAIL] (Status: $($response.StatusCode))" -ForegroundColor Red
            $script:failed++
            
            return @{
                Name = $Name
                Status = "FAIL"
                Time = $elapsedMs
                StatusCode = $response.StatusCode
                Error = "Unexpected status code"
            }
        }
    }
    catch {
        Write-Host " [FAIL]" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
        $script:failed++
        
        return @{
            Name = $Name
            Status = "FAIL"
            Time = 0
            Error = $_.Exception.Message
        }
    }
}

# Test 1: Health Check
$results += Test-Endpoint `
    -Name "Health Check" `
    -Method "GET" `
    -Url "$BASE_URL/health"

# Test 2: OpenAPI Schema
$results += Test-Endpoint `
    -Name "OpenAPI Schema" `
    -Method "GET" `
    -Url "$API_URL/openapi.json"

# Test 3: Upcoming Matches
$results += Test-Endpoint `
    -Name "Upcoming Matches" `
    -Method "GET" `
    -Url "$BASE_URL/matches/upcoming"

# Test 4: Today's Value Bets
$results += Test-Endpoint `
    -Name "Value Bets (Today)" `
    -Method "GET" `
    -Url "$BASE_URL/predictions/value-bets/today"

# Test 5: Create Prediction (Mock)
$predictionBody = @{
    home_team = "Arsenal"
    away_team = "Chelsea"
    league = "EPL"
    match_id = "test_$(Get-Date -Format 'yyyyMMddHHmmss')"
}

$results += Test-Endpoint `
    -Name "Create Prediction" `
    -Method "POST" `
    -Url "$BASE_URL/predictions/" `
    -Body $predictionBody

# Test 6: Predict Alias Endpoint
$results += Test-Endpoint `
    -Name "Predict Alias" `
    -Method "POST" `
    -Url "$BASE_URL/predictions/predict" `
    -Body $predictionBody

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Total: $($passed + $failed) | Passed: $passed | Failed: $failed"

if ($failed -eq 0) {
    Write-Host "`n[PASS] All backend tests" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[FAIL] $failed test(s)" -ForegroundColor Red
    exit 1
}
