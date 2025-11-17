# SabiScore Deployment Monitor - November 12, 2025
# Monitors Render and Vercel deployments after fixes applied

param(
    [int]$IntervalSeconds = 30,
    [int]$MaxAttempts = 20
)

Write-Host "`n╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          SABISCORE DEPLOYMENT MONITOR                               ║" -ForegroundColor Cyan
Write-Host "║         Monitoring Post-Fix Deployments (c67dad037)                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$backendUrl = "https://sabiscore-api.onrender.com/health"
$frontendUrl = "https://sabiscore-m3gd1at7h-oversabis-projects.vercel.app"

$backendSuccess = $false
$frontendSuccess = $false
$attempt = 0

$message = "`nChecking every {0} seconds - up to {1} attempts...`n" -f $IntervalSeconds, $MaxAttempts
Write-Host $message -ForegroundColor Yellow

while ($attempt -lt $MaxAttempts -and (-not $backendSuccess -or -not $frontendSuccess)) {
    $attempt++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] Attempt $attempt/$MaxAttempts" -ForegroundColor Gray
    Write-Host "───────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    # Check Backend (Render)
    if (-not $backendSuccess) {
        try {
            $response = Invoke-RestMethod -Uri $backendUrl -TimeoutSec 10 -ErrorAction Stop
            if ($response.status -eq "healthy") {
                Write-Host "   🟢 BACKEND: LIVE & HEALTHY" -ForegroundColor Green
                Write-Host "      Status: $($response.status)" -ForegroundColor White
                Write-Host "      Version: $($response.version)" -ForegroundColor White
                if ($response.database) { Write-Host "      Database: $($response.database)" -ForegroundColor White }
                if ($response.redis) { Write-Host "      Redis: $($response.redis)" -ForegroundColor White }
                $backendSuccess = $true
            } else {
                Write-Host "   🟡 BACKEND: UP (status: $($response.status))" -ForegroundColor Yellow
            }
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode) {
                Write-Host "   🔴 BACKEND: ERROR $statusCode" -ForegroundColor Red
            } else {
                Write-Host "   ⏳ BACKEND: NOT READY (deploying...)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ BACKEND: Already verified" -ForegroundColor Green
    }
    
    # Check Frontend (Vercel)
    if (-not $frontendSuccess) {
        try {
            $response = Invoke-WebRequest -Uri $frontendUrl -Method Head -TimeoutSec 10 -ErrorAction Stop
            $statusCode = $response.StatusCode
            
            if ($statusCode -eq 200) {
                Write-Host "   🟢 FRONTEND: LIVE (HTTP 200)" -ForegroundColor Green
                Write-Host "      Server: $($response.Headers['Server'])" -ForegroundColor White
                Write-Host "      Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor White
                $frontendSuccess = $true
                
                # Check if 401 error is resolved
                Write-Host "      ✅ 401 ERROR RESOLVED!" -ForegroundColor Green
            } elseif ($statusCode -eq 401) {
                Write-Host "   🟡 FRONTEND: UP (HTTP 401 - auth issue)" -ForegroundColor Yellow
                Write-Host "      Server: $($response.Headers['Server'])" -ForegroundColor White
            } else {
                Write-Host "   🟡 FRONTEND: UP (HTTP $statusCode)" -ForegroundColor Yellow
            }
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 401) {
                Write-Host "   🟡 FRONTEND: UP (HTTP 401 - auth issue persists)" -ForegroundColor Yellow
            } elseif ($statusCode) {
                Write-Host "   🔴 FRONTEND: ERROR $statusCode" -ForegroundColor Red
            } else {
                Write-Host "   ⏳ FRONTEND: NOT READY (deploying...)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ FRONTEND: Already verified" -ForegroundColor Green
    }
    
    Write-Host ""
    
    # If both successful, break early
    if ($backendSuccess -and $frontendSuccess) {
        Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "║                 🎉 DEPLOYMENTS SUCCESSFUL 🎉                        ║" -ForegroundColor Green
        Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
        Write-Host ""
        Write-Host "✅ Backend: https://sabiscore-api.onrender.com" -ForegroundColor Green
        Write-Host "✅ Frontend: https://sabiscore-m3gd1at7h-oversabis-projects.vercel.app" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Test matches endpoint:" -ForegroundColor White
        Write-Host "     Invoke-RestMethod -Uri 'https://sabiscore-api.onrender.com/api/v1/matches/upcoming?limit=5'" -ForegroundColor Gray
        Write-Host "  2. Test predictions:" -ForegroundColor White
        Write-Host "     Invoke-RestMethod -Uri 'https://sabiscore-api.onrender.com/api/v1/predictions/value-bets/today'" -ForegroundColor Gray
        Write-Host "  3. Visit frontend homepage:" -ForegroundColor White
        Write-Host "     Start-Process 'https://sabiscore-m3gd1at7h-oversabis-projects.vercel.app'" -ForegroundColor Gray
        Write-Host ""
        break
    }
    
    # Wait before next check
    if ($attempt -lt $MaxAttempts) {
        Write-Host "Waiting $IntervalSeconds seconds before next check...`n" -ForegroundColor Gray
        Start-Sleep -Seconds $IntervalSeconds
    }
}

# Final status
if (-not $backendSuccess -or -not $frontendSuccess) {
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║                    ⏰ TIMEOUT REACHED                                ║" -ForegroundColor Yellow
    Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
    Write-Host ""
    
    if (-not $backendSuccess) {
        Write-Host "⏳ Backend: Still deploying or failed" -ForegroundColor Yellow
        Write-Host "   Check Render dashboard: https://dashboard.render.com/" -ForegroundColor Gray
        Write-Host "   Expected deployment time: 5-10 minutes" -ForegroundColor Gray
    }
    
    if (-not $frontendSuccess) {
        Write-Host "⏳ Frontend: Still deploying or has issues" -ForegroundColor Yellow
        Write-Host "   Check Vercel dashboard: https://vercel.com/oversabis-projects/sabiscore" -ForegroundColor Gray
        Write-Host "   Expected deployment time: 2-5 minutes" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "Retry this monitor in a few minutes:" -ForegroundColor Cyan
    Write-Host "powershell -ExecutionPolicy Bypass -File .\monitor_deployment.ps1" -ForegroundColor Gray
    Write-Host ""
}

# Performance summary
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Deployment Monitor Summary:" -ForegroundColor White
Write-Host "  Total attempts: $attempt" -ForegroundColor White
Write-Host "  Time elapsed: $($attempt * $IntervalSeconds) seconds" -ForegroundColor White
Write-Host "  Backend status: $(if ($backendSuccess) { '✅ SUCCESS' } else { '⏳ PENDING' })" -ForegroundColor $(if ($backendSuccess) { 'Green' } else { 'Yellow' })
Write-Host "  Frontend status: $(if ($frontendSuccess) { '✅ SUCCESS' } else { '⏳ PENDING' })" -ForegroundColor $(if ($frontendSuccess) { 'Green' } else { 'Yellow' })
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
