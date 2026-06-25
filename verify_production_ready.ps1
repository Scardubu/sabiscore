# SabiScore Production Readiness - Quick Verification
# Run this script to validate all systems are ready for deployment

Write-Host "
  ███████╗ █████╗ ██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗
  ██╔════╝██╔══██╗██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
  ███████╗███████║██████╔╝██║███████╗██║     ██║   ██║██████╔╝█████╗  
  ╚════██║██╔══██║██╔══██╗██║╚════██║██║     ██║   ██║██╔══██╗██╔══╝  
  ███████║██║  ██║██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║███████╗
  ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝
  
  Production Readiness Verification v3.0
  " -ForegroundColor Cyan

$results = @{
    Passed = @()
    Failed = @()
    Warnings = @()
}

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$PassMessage,
        [string]$FailMessage,
        [bool]$Critical = $true
    )
    
    Write-Host "`n🔍 Testing: $Name" -ForegroundColor Yellow
    try {
        $result = & $Test
        if ($result) {
            Write-Host "   ✅ $PassMessage" -ForegroundColor Green
            $results.Passed += $Name
            return $true
        } else {
            if ($Critical) {
                Write-Host "   ❌ $FailMessage" -ForegroundColor Red
                $results.Failed += $Name
            } else {
                Write-Host "   ⚠️  $FailMessage" -ForegroundColor Yellow
                $results.Warnings += $Name
            }
            return $false
        }
    } catch {
        if ($Critical) {
            Write-Host "   ❌ Error: $_" -ForegroundColor Red
            $results.Failed += $Name
        } else {
            Write-Host "   ⚠️  Error: $_" -ForegroundColor Yellow
            $results.Warnings += $Name
        }
        return $false
    }
}

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Phase 1: Environment Checks" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan

Test-Check -Name "Node.js Installation" -Test {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "   Version: $nodeVersion" -ForegroundColor Gray
        return $true
    }
    return $false
} -PassMessage "Node.js is installed" -FailMessage "Node.js not found - install from nodejs.org"

Test-Check -Name "Python Installation" -Test {
    $pythonVersion = python --version 2>$null
    if ($pythonVersion) {
        Write-Host "   Version: $pythonVersion" -ForegroundColor Gray
        return $true
    }
    return $false
} -PassMessage "Python is installed" -FailMessage "Python not found - install from python.org"

Test-Check -Name "Frontend Dependencies" -Test {
    Test-Path "apps\web\node_modules"
} -PassMessage "node_modules found" -FailMessage "Run: cd apps\web; npm install"

Test-Check -Name "Backend Dependencies" -Test {
    Test-Path "backend\src"
} -PassMessage "Backend source code found" -FailMessage "Backend directory missing"

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Phase 2: Code Quality Checks" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan

Test-Check -Name "Frontend Build" -Test {
    Push-Location "apps\web"
    $buildOutput = npm run build 2>&1
    Pop-Location
    return $buildOutput -like "*Build succeeded*" -or $buildOutput -like "*Compiled successfully*"
} -PassMessage "Frontend builds successfully" -FailMessage "Build failed - check npm run build output"

Test-Check -Name "TypeScript Types" -Test {
    Test-Path "apps\web\src\types\value-bet.ts"
} -PassMessage "Type definitions present" -FailMessage "Type files missing"

Test-Check -Name "Component Files" -Test {
    $components = @(
        "apps\web\src\components\match-selector.tsx",
        "apps\web\src\components\team-autocomplete.tsx",
        "apps\web\src\components\insights-display.tsx",
        "apps\web\src\components\ValueBetCard.tsx"
    )
    $missing = $components | Where-Object { -not (Test-Path $_) }
    if ($missing.Count -eq 0) {
        return $true
    } else {
        Write-Host "   Missing: $($missing -join ', ')" -ForegroundColor Red
        return $false
    }
} -PassMessage "All core components present" -FailMessage "Component files missing"

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Phase 3: Configuration Checks" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan

Test-Check -Name "Environment Variables" -Test {
    if (Test-Path "apps\web\.env.local") {
        $envContent = Get-Content "apps\web\.env.local" -Raw
        return $envContent -like "*NEXT_PUBLIC_API_URL*"
    }
    return $false
} -PassMessage ".env.local configured" -FailMessage "Create apps\web\.env.local with API_URL" -Critical $false

Test-Check -Name "API Configuration" -Test {
    Test-Path "apps\web\src\lib\api.ts"
} -PassMessage "API client configured" -FailMessage "API client missing"

Test-Check -Name "Team Data" -Test {
    if (Test-Path "apps\web\src\lib\team-data.ts") {
        $teamData = Get-Content "apps\web\src\lib\team-data.ts" -Raw
        return $teamData -like "*EPL*" -and $teamData -like "*La Liga*"
    }
    return $false
} -PassMessage "League team data loaded" -FailMessage "Team data configuration missing"

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Phase 4: Integration Checks" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan

Test-Check -Name "Backend Connectivity" -Test {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
} -PassMessage "Backend API is reachable at http://localhost:8000" -FailMessage "Backend not running - start with: cd backend; python -m uvicorn src.api.main:app --reload" -Critical $false

Test-Check -Name "Frontend Server" -Test {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
} -PassMessage "Frontend is accessible at http://localhost:3000" -FailMessage "Frontend not running - start with: cd apps\web; npm run dev" -Critical $false

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Phase 5: Documentation Checks" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan

Test-Check -Name "Deployment Guides" -Test {
    (Test-Path "PRODUCTION_READY_FINAL_VERIFICATION.md") -and (Test-Path "START_PRODUCTION_READY.bat")
} -PassMessage "Deployment documentation available" -FailMessage "Documentation missing" -Critical $false

Test-Check -Name "README Files" -Test {
    Test-Path "README.md"
} -PassMessage "README.md present" -FailMessage "README.md missing" -Critical $false

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📊 VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan

$totalTests = $results.Passed.Count + $results.Failed.Count + $results.Warnings.Count
$passRate = if ($totalTests -gt 0) { [math]::Round(($results.Passed.Count / $totalTests) * 100, 1) } else { 0 }

Write-Host "`n✅ Passed:   $($results.Passed.Count)" -ForegroundColor Green
Write-Host "❌ Failed:   $($results.Failed.Count)" -ForegroundColor $(if($results.Failed.Count -eq 0){'Green'}else{'Red'})
Write-Host "⚠️  Warnings: $($results.Warnings.Count)" -ForegroundColor Yellow
Write-Host "`nPass Rate:  $passRate%" -ForegroundColor $(if($passRate -ge 80){'Green'}elseif($passRate -ge 60){'Yellow'}else{'Red'})

if ($results.Failed.Count -eq 0) {
    Write-Host "`n════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  🎉 PRODUCTION READY!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "`n✅ All critical checks passed!" -ForegroundColor Green
    Write-Host "`n🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Review PRODUCTION_READY_FINAL_VERIFICATION.md" -ForegroundColor White
    Write-Host "   2. Run: .\START_PRODUCTION_READY.bat" -ForegroundColor White
    Write-Host "   3. Test full user flow in browser" -ForegroundColor White
    Write-Host "   4. Deploy to production" -ForegroundColor White
    
    if ($results.Warnings.Count -gt 0) {
        Write-Host "`n⚠️  Note: $($results.Warnings.Count) non-critical warnings detected" -ForegroundColor Yellow
        Write-Host "   These can be addressed post-launch" -ForegroundColor Gray
    }
    
    exit 0
} else {
    Write-Host "`n════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ⚠️  ACTION REQUIRED" -ForegroundColor Red
    Write-Host "════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "`n❌ Critical issues found:" -ForegroundColor Red
    $results.Failed | ForEach-Object {
        Write-Host "   • $_" -ForegroundColor Red
    }
    Write-Host "`nPlease resolve these issues before deployment." -ForegroundColor Yellow
    Write-Host "Refer to the error messages above for resolution steps." -ForegroundColor Gray
    exit 1
}
