<# 
.SYNOPSIS
    SabiScore Deployment Diagnostic Tool
.DESCRIPTION
    Comprehensive diagnostic script to test frontend/backend deployments,
    collect HTTP response headers, and identify deployment issues.
#>

param(
    [string]$FrontendUrl = "https://sabiscore-m3gd1at7h-oversabis-projects.vercel.app",
    [string]$BackendUrl = "https://sabiscore-api.onrender.com"
)

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = "deployment_diagnostic_$timestamp.log"

function Write-Log {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
    Add-Content -Path $logFile -Value $Message
}

function Write-Header {
    param($Title)
    $line = "=" * 70
    Write-Log "`n$line" -Color "Cyan"
    Write-Log "  $Title" -Color "White"
    Write-Log "$line" -Color "Cyan"
}

function Test-HttpEndpoint {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [string]$Description
    )
    
    Write-Log "`nTesting: $Description" -Color "Yellow"
    Write-Log "  URL: $Url" -Color "Gray"
    Write-Log "  Method: $Method" -Color "Gray"
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -TimeoutSec 30 -ErrorAction Stop
        
        Write-Log "  Status: $($response.StatusCode) $($response.StatusDescription)" -Color "Green"
        Write-Log "  Content-Length: $($response.RawContentLength) bytes" -Color "Gray"
        Write-Log "  Server: $($response.Headers['Server'])" -Color "Gray"
        
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Headers = $response.Headers
        }
    }
    catch {
        $statusCode = "N/A"
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        Write-Log "  Status: FAILED ($statusCode)" -Color "Red"
        Write-Log "  Error: $($_.Exception.Message)" -Color "Red"
        
        return @{
            Success = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
        }
    }
}

# ============================================================================
# MAIN DIAGNOSTIC
# ============================================================================

Write-Host @"

╔═══════════════════════════════════════════════════════════════════╗
║          SABISCORE DEPLOYMENT DIAGNOSTIC TOOL                     ║
║                 Comprehensive Status Check                        ║
╚═══════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Start-Transcript -Path $logFile -Append

# 1. GIT STATUS
Write-Header "1. GIT REPOSITORY STATUS"
try {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    $commit = git rev-parse --short HEAD 2>$null
    $commitMsg = git log -1 --pretty=%s 2>$null
    
    Write-Log "  Branch: $branch" -Color "Gray"
    Write-Log "  Commit: $commit" -Color "Gray"
    Write-Log "  Message: $commitMsg" -Color "Gray"
}
catch {
    Write-Log "  Error getting Git status: $($_.Exception.Message)" -Color "Red"
}

# 2. DNS RESOLUTION
Write-Header "2. DNS RESOLUTION"
$frontendHost = ([System.Uri]$FrontendUrl).Host
$backendHost = ([System.Uri]$BackendUrl).Host

Write-Log "`nFrontend ($frontendHost):" -Color "Yellow"
try {
    $dns = Resolve-DnsName -Name $frontendHost -ErrorAction Stop
    Write-Log "  DNS: OK" -Color "Green"
}
catch {
    Write-Log "  DNS: FAILED - $($_.Exception.Message)" -Color "Red"
}

Write-Log "`nBackend ($backendHost):" -Color "Yellow"
try {
    $dns = Resolve-DnsName -Name $backendHost -ErrorAction Stop
    Write-Log "  DNS: OK" -Color "Green"
}
catch {
    Write-Log "  DNS: FAILED - $($_.Exception.Message)" -Color "Red"
}

# 3. FRONTEND TESTS
Write-Header "3. FRONTEND ENDPOINT TESTS"
$frontendHead = Test-HttpEndpoint -Url $FrontendUrl -Method "HEAD" -Description "Frontend HEAD Request"
$frontendGet = Test-HttpEndpoint -Url $FrontendUrl -Method "GET" -Description "Frontend GET Request"

# 4. BACKEND HEALTH TESTS
Write-Header "4. BACKEND HEALTH TESTS"
$backendHealth = Test-HttpEndpoint -Url "$BackendUrl/health" -Method "GET" -Description "Backend /health"
$backendApiHealth = Test-HttpEndpoint -Url "$BackendUrl/api/v1/health" -Method "GET" -Description "Backend /api/v1/health"

# 5. BACKEND API TESTS
Write-Header "5. BACKEND API ENDPOINT TESTS"
$matchesApi = Test-HttpEndpoint -Url "$BackendUrl/api/v1/matches/upcoming?limit=3" -Method "GET" -Description "Upcoming Matches API"
$valueBetsApi = Test-HttpEndpoint -Url "$BackendUrl/api/v1/predictions/value-bets/today?min_edge=0.042" -Method "GET" -Description "Value Bets API"

# 6. SUMMARY
Write-Header "6. DIAGNOSTIC SUMMARY"

$frontendHealthy = ($frontendGet.StatusCode -eq 200)
$backendHealthy = (($backendHealth.StatusCode -eq 200) -or ($backendApiHealth.StatusCode -eq 200))

Write-Host @"

╔═══════════════════════════════════════════════════════════════════╗
║                      DEPLOYMENT STATUS                            ║
╠═══════════════════════════════════════════════════════════════════╣
║  Frontend (Vercel):     $(if ($frontendHealthy) { "✅ HEALTHY" } else { "❌ UNHEALTHY" })
║  Backend (Render):      $(if ($backendHealthy) { "✅ HEALTHY" } else { "❌ UNHEALTHY" })
║                                                                   
║  Git Branch:            $branch
║  Git Commit:            $commit
╚═══════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor White

# 7. ISSUES & RECOMMENDATIONS
Write-Header "7. ISSUES & RECOMMENDATIONS"

$issues = @()

if ($frontendHead.StatusCode -eq 401 -or $frontendGet.StatusCode -eq 401) {
    $issues += "❌ Frontend returning 401 Unauthorized"
    Write-Log "`nFrontend 401 Error Detected" -Color "Red"
    Write-Log "Possible causes:" -Color "Yellow"
    Write-Log "  1. Vercel Deployment Protection enabled" -Color "Gray"
    Write-Log "  2. Preview Protection requiring password" -Color "Gray"
    Write-Log "  3. Authentication middleware in app" -Color "Gray"
    Write-Log "`nActions:" -Color "Yellow"
    Write-Log "  • Check: https://vercel.com/oversabis-projects/sabiscore/settings" -Color "Gray"
    Write-Log "  • Disable 'Vercel Authentication' if enabled" -Color "Gray"
    Write-Log "  • Review deployment logs for errors" -Color "Gray"
}

if (-not $backendHealthy) {
    $issues += "❌ Backend health checks failing"
    Write-Log "`nBackend Health Check Failing" -Color "Red"
    Write-Log "Possible causes:" -Color "Yellow"
    Write-Log "  1. Deployment still in progress (wait 5-10 min)" -Color "Gray"
    Write-Log "  2. Build or runtime errors in FastAPI" -Color "Gray"
    Write-Log "  3. Database connection issues" -Color "Gray"
    Write-Log "`nActions:" -Color "Yellow"
    Write-Log "  • Check: https://dashboard.render.com" -Color "Gray"
    Write-Log "  • Review deployment logs for Python errors" -Color "Gray"
    Write-Log "  • Verify environment variables" -Color "Gray"
}

if ($issues.Count -eq 0) {
    Write-Log "`n✅ No critical issues detected!" -Color "Green"
    Write-Log "Both frontend and backend are healthy and responding correctly." -Color "Gray"
}

Stop-Transcript

Write-Log "`n✅ Diagnostic complete! Results saved to: $logFile" -Color "Green"
Write-Log "`nFor detailed logs, check Render and Vercel dashboards:" -Color "Yellow"
Write-Log "  • Vercel: https://vercel.com/oversabis-projects/sabiscore" -Color "Gray"
Write-Log "  • Render: https://dashboard.render.com" -Color "Gray"
