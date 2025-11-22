#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Production smoke test for SabiScore deployment on Render + Vercel
.DESCRIPTION
    Validates production endpoints, API connectivity, and frontend-backend integration
#>

$ErrorActionPreference = "Continue"

Write-Host "[TEST] SabiScore Production Smoke Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$renderApiUrl = "https://sabiscore-api.onrender.com"
$vercelFrontendUrl = "https://sabiscore.vercel.app"
$testResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{ "Accept" = "application/json" },
        [int]$ExpectedStatus = 200
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            TimeoutSec = 15
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params['Body'] = ($Body | ConvertTo-Json)
            $params['Headers']['Content-Type'] = 'application/json'
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "   [OK] $Name" -ForegroundColor Green -NoNewline
            Write-Host " ($ExpectedStatus)" -ForegroundColor Gray
            
            # Try to parse JSON response
            try {
                $json = $response.Content | ConvertFrom-Json
                return @{ Success = $true; Data = $json; Status = $response.StatusCode }
            } catch {
                return @{ Success = $true; Data = $response.Content; Status = $response.StatusCode }
            }
        } else {
            Write-Host "   [!] $Name" -ForegroundColor Yellow -NoNewline
            Write-Host " (Expected: $ExpectedStatus, Got: $($response.StatusCode))" -ForegroundColor Gray
            return @{ Success = $false; Status = $response.StatusCode; Error = "Unexpected status code" }
        }
    } catch {
        Write-Host "   [X] $Name" -ForegroundColor Red -NoNewline
        Write-Host " - $($_.Exception.Message)" -ForegroundColor Gray
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# 1. Test Render Backend Health
Write-Host "1. Testing Render Backend..." -ForegroundColor Yellow

$healthResult = Test-Endpoint -Name "Backend Health" -Url "$renderApiUrl/health"
if ($healthResult.Success) {
    $health = $healthResult.Data
    Write-Host "      Status: $($health.status)" -ForegroundColor Gray
    Write-Host "      Version: $($health.version)" -ForegroundColor Gray
    Write-Host "      Uptime: $($health.uptime_seconds)s" -ForegroundColor Gray
    
    if ($health.components.database.status -eq "healthy") {
        Write-Host "      [OK] Database: Connected" -ForegroundColor Green
    } else {
        Write-Host "      [!] Database: $($health.components.database.status)" -ForegroundColor Yellow
    }
    
    if ($health.components.ml_models.status -eq "healthy") {
        Write-Host "      [OK] ML Models: Loaded" -ForegroundColor Green
    } else {
        Write-Host "      [!] ML Models: $($health.components.ml_models.status)" -ForegroundColor Yellow
    }
}

$testResults += @{ Test = "Backend Health"; Result = $healthResult }

$readyResult = Test-Endpoint -Name "Readiness Check" -Url "$renderApiUrl/health/ready"
$testResults += @{ Test = "Readiness Check"; Result = $readyResult }

$liveResult = Test-Endpoint -Name "Liveness Check" -Url "$renderApiUrl/health/live"
$testResults += @{ Test = "Liveness Check"; Result = $liveResult }

Write-Host ""

# 2. Test API v1 Endpoints
Write-Host "2. Testing API v1 Endpoints..." -ForegroundColor Yellow

$apiHealthResult = Test-Endpoint -Name "API v1 Health" -Url "$renderApiUrl/api/v1/health"
$testResults += @{ Test = "API v1 Health"; Result = $apiHealthResult }

# Test team search (validate autocomplete path)
$teamSearchUrl = "$renderApiUrl/api/v1/matches/teams/search?query=Chelsea&league=EPL&limit=5"
$teamSearchResult = Test-Endpoint -Name "Team Search" -Url $teamSearchUrl
if ($teamSearchResult.Success) {
    $teamsPayload = $teamSearchResult.Data
    if ($teamsPayload -is [System.Array]) {
        Write-Host "      Found $($teamsPayload.Length) teams" -ForegroundColor Gray
    } elseif ($teamsPayload -and $teamsPayload.teams) {
        Write-Host "      Found $($teamsPayload.teams.Count) teams" -ForegroundColor Gray
    } else {
        $payloadType = if ($null -ne $teamsPayload) { $teamsPayload.GetType().Name } else { "null" }
        Write-Host "      Payload returned (type: $payloadType)" -ForegroundColor Gray
    }
}
$testResults += @{ Test = "Team Search"; Result = $teamSearchResult }

Write-Host ""

# 3. Test Vercel Frontend
Write-Host "3. Testing Vercel Frontend..." -ForegroundColor Yellow

$frontendResult = Test-Endpoint -Name "Frontend Homepage" -Url $vercelFrontendUrl
$testResults += @{ Test = "Frontend Homepage"; Result = $frontendResult }

Write-Host ""

# 4. Test API Proxy through Vercel
Write-Host "4. Testing API Proxy through Vercel..." -ForegroundColor Yellow

$proxyHealthResult = Test-Endpoint -Name "Proxied Health Check" -Url "$vercelFrontendUrl/api/v1/health"
$testResults += @{ Test = "Proxied Health Check"; Result = $proxyHealthResult }

if ($proxyHealthResult.Success) {
    Write-Host "      [OK] Vercel successfully proxying API requests to Render" -ForegroundColor Green
}

Write-Host ""

# 5. Test CORS Configuration
Write-Host "5. Testing CORS Configuration..." -ForegroundColor Yellow

try {
    $corsResponse = Invoke-WebRequest -Uri "$renderApiUrl/health" -Method Options -Headers @{
        "Origin" = $vercelFrontendUrl
        "Access-Control-Request-Method" = "GET"
    } -UseBasicParsing -TimeoutSec 10
    
    $allowOrigin = $corsResponse.Headers['Access-Control-Allow-Origin']
    if ($allowOrigin -eq $vercelFrontendUrl -or $allowOrigin -eq "*") {
        Write-Host "   [OK] CORS configured correctly" -ForegroundColor Green
        Write-Host "      Allow-Origin: $allowOrigin" -ForegroundColor Gray
    } else {
        Write-Host "   [!] CORS may not be configured for Vercel" -ForegroundColor Yellow
        Write-Host "      Allow-Origin: $allowOrigin" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [!] Unable to verify CORS (non-critical)" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "===================================" -ForegroundColor Cyan
$successCount = ($testResults | Where-Object { $_.Result.Success }).Count
$totalCount = $testResults.Count
$successRate = [math]::Round(($successCount / $totalCount) * 100, 0)

if ($successRate -eq 100) {
    Write-Host "[OK] All Tests Passed ($successCount/$totalCount)" -ForegroundColor Green
} elseif ($successRate -ge 80) {
    Write-Host "[!] Most Tests Passed ($successCount/$totalCount - ${successRate}%)" -ForegroundColor Yellow
} else {
    Write-Host "[X] Multiple Failures ($successCount/$totalCount - ${successRate}%)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  • Visit $vercelFrontendUrl to test UI" -ForegroundColor Gray
Write-Host "  • Test match selector with team autocomplete" -ForegroundColor Gray
Write-Host "  • Generate match insights and verify predictions" -ForegroundColor Gray
Write-Host "  • Monitor Sentry for runtime errors" -ForegroundColor Gray
Write-Host "  • Check Render logs for any backend issues" -ForegroundColor Gray

Write-Host ""

# Return exit code based on success rate
if ($successRate -lt 80) {
    exit 1
}
