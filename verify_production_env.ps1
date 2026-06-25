#!/usr/bin/env pwsh
# ==============================================================================
# SabiScore 3.0 - Production Environment Verification Script
# ==============================================================================
# Purpose: Validates all environment variables and API endpoints before deployment
# Usage: .\verify_production_env.ps1 [-Url "https://your-app.vercel.app"]
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Url = "http://localhost:3000",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipApiTests = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"
$script:PassCount = 0
$script:FailCount = 0
$script:WarnCount = 0

# ==============================================================================
# Helper Functions
# ==============================================================================

function Write-TestHeader {
    param([string]$Title)
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)
    Write-Host "  ✅ PASS: $Message" -ForegroundColor Green
    $script:PassCount++
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  ❌ FAIL: $Message" -ForegroundColor Red
    $script:FailCount++
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  ⚠️  WARN: $Message" -ForegroundColor Yellow
    $script:WarnCount++
}

function Write-Info {
    param([string]$Message)
    if ($Verbose) {
        Write-Host "  ℹ️  INFO: $Message" -ForegroundColor Gray
    }
}

function Test-EnvVariable {
    param(
        [string]$Name,
        [string]$Description,
        [bool]$Required = $false,
        [string]$Pattern = "",
        [int]$MinLength = 0
    )
    
    $value = [Environment]::GetEnvironmentVariable($Name)
    
    if ([string]::IsNullOrWhiteSpace($value)) {
        if ($Required) {
            Write-Fail "$Name is not set (REQUIRED: $Description)"
        } else {
            Write-Warn "$Name is not set (Optional: $Description)"
        }
        return $false
    }
    
    if ($MinLength -gt 0 -and $value.Length -lt $MinLength) {
        Write-Fail "$Name is too short (minimum $MinLength characters)"
        return $false
    }
    
    if ($Pattern -and $value -notmatch $Pattern) {
        Write-Fail "$Name format is invalid (expected pattern: $Pattern)"
        return $false
    }
    
    $maskedValue = if ($value.Length -gt 8) { 
        $value.Substring(0, 4) + "****" + $value.Substring($value.Length - 4) 
    } else { 
        "****" 
    }
    
    Write-Pass "$Name is set ($maskedValue)"
    Write-Info "  → $Description"
    return $true
}

function Test-ApiEndpoint {
    param(
        [string]$Path,
        [string]$Description,
        [int]$ExpectedStatus = 200,
        [string]$ExpectedContentType = "application/json",
        [scriptblock]$ValidateResponse = $null,
        [hashtable]$Headers = @{}
    )
    
    $fullUrl = "$Url$Path"
    Write-Info "Testing: $fullUrl"
    
    try {
        $response = Invoke-WebRequest -Uri $fullUrl -Method Get -Headers $Headers -TimeoutSec 10 -ErrorAction Stop
        
        if ($response.StatusCode -ne $ExpectedStatus) {
            Write-Fail "$Description - Expected status $ExpectedStatus, got $($response.StatusCode)"
            return $false
        }
        
        if ($ExpectedContentType -and $response.Headers["Content-Type"] -notlike "*$ExpectedContentType*") {
            Write-Warn "$Description - Expected content type $ExpectedContentType, got $($response.Headers['Content-Type'])"
        }
        
        if ($ValidateResponse) {
            $json = $response.Content | ConvertFrom-Json
            $validationResult = & $ValidateResponse $json
            if (-not $validationResult) {
                Write-Fail "$Description - Response validation failed"
                return $false
            }
        }
        
        Write-Pass "$Description (${ExpectedStatus}, $($response.Content.Length) bytes)"
        return $true
        
    } catch {
        Write-Fail "$Description - $($_.Exception.Message)"
        return $false
    }
}

function Get-SecretStrength {
    param([string]$Secret)
    
    if ([string]::IsNullOrWhiteSpace($Secret)) { return "NONE" }
    if ($Secret.Length -lt 16) { return "WEAK" }
    if ($Secret.Length -lt 24) { return "FAIR" }
    if ($Secret.Length -lt 32) { return "GOOD" }
    return "STRONG"
}

# ==============================================================================
# Test Suite
# ==============================================================================

Write-Host @"

╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ███████╗ █████╗ ██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗     ║
║   ██╔════╝██╔══██╗██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝     ║
║   ███████╗███████║██████╔╝██║███████╗██║     ██║   ██║██████╔╝█████╗       ║
║   ╚════██║██╔══██║██╔══██╗██║╚════██║██║     ██║   ██║██╔══██╗██╔══╝       ║
║   ███████║██║  ██║██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║███████╗     ║
║   ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝     ║
║                                                                              ║
║              Production Environment Verification v1.0                        ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Host "Target URL: $Url" -ForegroundColor White
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor White

# ==============================================================================
# 1. Check Required Environment Variables
# ==============================================================================

Write-TestHeader "1️⃣  Required Environment Variables"

Test-EnvVariable -Name "CRON_SECRET" `
    -Description "Authenticates Vercel cron job requests" `
    -Required $true `
    -MinLength 24

Test-EnvVariable -Name "NEXT_PUBLIC_API_URL" `
    -Description "Backend API endpoint" `
    -Required $false `
    -Pattern "^https?://"

Test-EnvVariable -Name "NEXT_PUBLIC_CURRENCY" `
    -Description "Betting currency code" `
    -Required $false `
    -Pattern "^[A-Z]{3}$"

# ==============================================================================
# 2. Check Optional Enhancement Variables
# ==============================================================================

Write-TestHeader "2️⃣  Optional Enhancement Variables"

$hasWebhook = Test-EnvVariable -Name "ALERT_WEBHOOK_URL" `
    -Description "Discord/Slack webhook for critical drift alerts" `
    -Required $false `
    -Pattern "^https://"

$hasFootballData = Test-EnvVariable -Name "FOOTBALL_DATA_API_KEY" `
    -Description "Football-data.org API for upcoming matches" `
    -Required $false `
    -MinLength 20

$hasWarmup = Test-EnvVariable -Name "WARMUP_SECRET" `
    -Description "Authenticates forced model warmup requests" `
    -Required $false `
    -MinLength 16

Test-EnvVariable -Name "ODDS_API_KEY" `
    -Description "The Odds API for live betting odds (deprecated - free sources preferred)" `
    -Required $false

# ==============================================================================
# 3. Check Configuration Variables
# ==============================================================================

Write-TestHeader "3️⃣  Configuration Variables"

Test-EnvVariable -Name "NEXT_PUBLIC_BASE_BANKROLL" `
    -Description "Starting bankroll for Kelly Criterion" `
    -Required $false

Test-EnvVariable -Name "NEXT_PUBLIC_KELLY_FRACTION" `
    -Description "Kelly fraction (0.125 = conservative)" `
    -Required $false

Test-EnvVariable -Name "NEXT_PUBLIC_MIN_EDGE_NGN" `
    -Description "Minimum edge required to recommend bet" `
    -Required $false

Test-EnvVariable -Name "DRIFT_SENSITIVITY" `
    -Description "Brier score drift threshold for alerts" `
    -Required $false

# ==============================================================================
# 4. Security Assessment
# ==============================================================================

Write-TestHeader "4️⃣  Security Assessment"

$cronSecret = [Environment]::GetEnvironmentVariable("CRON_SECRET")
$cronStrength = Get-SecretStrength -Secret $cronSecret

if ($cronStrength -eq "STRONG") {
    Write-Pass "CRON_SECRET strength: $cronStrength (≥32 characters)"
} elseif ($cronStrength -eq "GOOD") {
    Write-Pass "CRON_SECRET strength: $cronStrength (24-31 characters)"
} elseif ($cronStrength -eq "FAIR") {
    Write-Warn "CRON_SECRET strength: $cronStrength (16-23 characters, consider increasing)"
} elseif ($cronStrength -eq "WEAK") {
    Write-Fail "CRON_SECRET strength: $cronStrength (<16 characters, INSECURE)"
} else {
    Write-Fail "CRON_SECRET is not set"
}

if ($hasWarmup) {
    $warmupSecret = [Environment]::GetEnvironmentVariable("WARMUP_SECRET")
    $warmupStrength = Get-SecretStrength -Secret $warmupSecret
    
    if ($warmupStrength -in @("STRONG", "GOOD")) {
        Write-Pass "WARMUP_SECRET strength: $warmupStrength"
    } else {
        Write-Warn "WARMUP_SECRET strength: $warmupStrength (consider regenerating with 24+ chars)"
    }
}

if ($hasWebhook) {
    $webhookUrl = [Environment]::GetEnvironmentVariable("ALERT_WEBHOOK_URL")
    if ($webhookUrl -like "*discord.com*") {
        Write-Pass "Webhook type detected: Discord"
    } elseif ($webhookUrl -like "*slack.com*") {
        Write-Pass "Webhook type detected: Slack"
    } else {
        Write-Warn "Webhook type unknown (ensure Discord/Slack compatible format)"
    }
}

# ==============================================================================
# 5. API Endpoint Tests
# ==============================================================================

if (-not $SkipApiTests) {
    Write-TestHeader "5️⃣  API Endpoint Tests"
    
    # Health Check
    Test-ApiEndpoint -Path "/api/health" `
        -Description "Health Check Endpoint" `
        -ValidateResponse {
            param($json)
            return $json.status -eq "healthy" -and $json.timestamp
        }
    
    # Metrics Endpoint
    Test-ApiEndpoint -Path "/api/metrics" `
        -Description "Aggregated Metrics Endpoint" `
        -ValidateResponse {
            param($json)
            return $json.metrics -and $json.health -and $json.drift
        }
    
    # Warmup Endpoint (GET)
    Test-ApiEndpoint -Path "/api/warmup" `
        -Description "Model Warmup Endpoint (GET)" `
        -ValidateResponse {
            param($json)
            return $json.success -ne $null
        }
    
    # Drift Detection Data
    Test-ApiEndpoint -Path "/api/drift" `
        -Description "Drift Detection Endpoint" `
        -ValidateResponse {
            param($json)
            return $json.predictionCount -ge 0 -and $json.severity
        }
    
    # Monitoring Export (Check OPTIONS)
    try {
        $response = Invoke-WebRequest -Uri "$Url/api/monitoring/export?format=json" `
            -Method Options -TimeoutSec 5 -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 200) {
            Write-Pass "Monitoring Export Endpoint (OPTIONS allowed)"
        }
    } catch {
        Write-Info "Monitoring Export Endpoint (OPTIONS check skipped)"
    }
    
} else {
    Write-Info "API endpoint tests skipped (use without -SkipApiTests to run)"
}

# ==============================================================================
# 6. Cron Job Configuration
# ==============================================================================

Write-TestHeader "6️⃣  Cron Job Configuration"

$vercelConfigPath = Join-Path $PSScriptRoot "vercel.json"

if (Test-Path $vercelConfigPath) {
    try {
        $vercelConfig = Get-Content $vercelConfigPath | ConvertFrom-Json
        
        if ($vercelConfig.crons -and $vercelConfig.crons.Count -gt 0) {
            Write-Pass "Found $($vercelConfig.crons.Count) cron job(s) in vercel.json"
            
            foreach ($cron in $vercelConfig.crons) {
                Write-Info "  → $($cron.path) - Schedule: $($cron.schedule)"
            }
        } else {
            Write-Warn "No cron jobs defined in vercel.json"
        }
        
    } catch {
        Write-Fail "Failed to parse vercel.json: $($_.Exception.Message)"
    }
} else {
    Write-Fail "vercel.json not found at $vercelConfigPath"
}

# ==============================================================================
# 7. File Structure Validation
# ==============================================================================

Write-TestHeader "7️⃣  File Structure Validation"

$requiredFiles = @(
    @{ Path = "apps/web/src/app/api/health/route.ts"; Description = "Health Check API" },
    @{ Path = "apps/web/src/app/api/metrics/route.ts"; Description = "Metrics Aggregation API" },
    @{ Path = "apps/web/src/app/api/warmup/route.ts"; Description = "Model Warmup API" },
    @{ Path = "apps/web/src/app/api/drift/route.ts"; Description = "Drift Detection API" },
    @{ Path = "apps/web/src/app/api/cron/drift-check/route.ts"; Description = "Drift Check Cron" },
    @{ Path = "apps/web/src/app/api/cron/update-odds/route.ts"; Description = "Odds Update Cron" },
    @{ Path = "apps/web/src/app/api/monitoring/export/route.ts"; Description = "Monitoring Export API" },
    @{ Path = "apps/web/next.config.js"; Description = "Next.js Configuration" },
    @{ Path = "vercel.json"; Description = "Vercel Deployment Config" }
)

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $PSScriptRoot $file.Path
    
    if (Test-Path $fullPath) {
        $fileSize = (Get-Item $fullPath).Length
        Write-Pass "$($file.Description) exists ($fileSize bytes)"
    } else {
        Write-Fail "$($file.Description) not found at $($file.Path)"
    }
}

# ==============================================================================
# 8. Performance Optimizations Check
# ==============================================================================

Write-TestHeader "8️⃣  Performance Optimizations Check"

$nextConfigPath = Join-Path $PSScriptRoot "apps/web/next.config.js"

if (Test-Path $nextConfigPath) {
    $nextConfigContent = Get-Content $nextConfigPath -Raw
    
    $optimizations = @(
        @{ Pattern = "splitChunks"; Description = "Webpack chunk splitting" },
        @{ Pattern = "cacheGroups"; Description = "Cache group configuration" },
        @{ Pattern = "tensorflow"; Description = "TensorFlow.js chunk optimization" },
        @{ Pattern = "Content-Security-Policy"; Description = "CSP headers" },
        @{ Pattern = "deterministic"; Description = "Deterministic module IDs" }
    )
    
    foreach ($opt in $optimizations) {
        if ($nextConfigContent -match $opt.Pattern) {
            Write-Pass "$($opt.Description) configured"
        } else {
            Write-Warn "$($opt.Description) not found in next.config.js"
        }
    }
} else {
    Write-Fail "next.config.js not found"
}

# Check layout.tsx for resource hints
$layoutPath = Join-Path $PSScriptRoot "apps/web/src/app/layout.tsx"

if (Test-Path $layoutPath) {
    $layoutContent = Get-Content $layoutPath -Raw
    
    if ($layoutContent -match "preconnect" -and $layoutContent -match "dns-prefetch") {
        Write-Pass "Resource hints (preconnect/dns-prefetch) configured"
    } else {
        Write-Warn "Resource hints not found in layout.tsx"
    }
}

# ==============================================================================
# 9. Deployment Readiness Summary
# ==============================================================================

Write-TestHeader "9️⃣  Deployment Readiness Summary"

$totalTests = $script:PassCount + $script:FailCount + $script:WarnCount
$passRate = if ($totalTests -gt 0) { [math]::Round(($script:PassCount / $totalTests) * 100, 1) } else { 0 }

Write-Host "  📊 Test Results:" -ForegroundColor White
Write-Host "     ✅ Passed:  $($script:PassCount)" -ForegroundColor Green
Write-Host "     ❌ Failed:  $($script:FailCount)" -ForegroundColor Red
Write-Host "     ⚠️  Warnings: $($script:WarnCount)" -ForegroundColor Yellow
Write-Host "     📈 Pass Rate: $passRate%`n" -ForegroundColor White

if ($script:FailCount -eq 0) {
    Write-Host "  🎉 READY FOR PRODUCTION DEPLOYMENT!" -ForegroundColor Green -BackgroundColor DarkGreen
    Write-Host ""
    Write-Host "  Next Steps:" -ForegroundColor Cyan
    Write-Host "     1. Deploy to Vercel: vercel --prod" -ForegroundColor White
    Write-Host "     2. Test cron endpoints manually with CRON_SECRET" -ForegroundColor White
    Write-Host "     3. Verify webhook alerts with test drift scenario" -ForegroundColor White
    Write-Host "     4. Monitor first 24 hours in Vercel dashboard" -ForegroundColor White
} elseif ($script:FailCount -le 2) {
    Write-Host "  ⚠️  DEPLOYMENT POSSIBLE WITH WARNINGS" -ForegroundColor Yellow -BackgroundColor DarkYellow
    Write-Host ""
    Write-Host "  Action Required:" -ForegroundColor Cyan
    Write-Host "     • Review and fix failed checks above" -ForegroundColor White
    Write-Host "     • Re-run verification script after fixes" -ForegroundColor White
    Write-Host "     • Consider addressing warnings for optimal production performance" -ForegroundColor White
} else {
    Write-Host "  ❌ NOT READY FOR PRODUCTION" -ForegroundColor Red -BackgroundColor DarkRed
    Write-Host ""
    Write-Host "  Critical Issues:" -ForegroundColor Cyan
    Write-Host "     • $($script:FailCount) critical checks failed" -ForegroundColor White
    Write-Host "     • Review errors above and address before deployment" -ForegroundColor White
    Write-Host "     • Refer to ENVIRONMENT_VARIABLES.md for detailed setup guide" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Exit with appropriate code
if ($script:FailCount -gt 0) {
    exit 1
} else {
    exit 0
}
