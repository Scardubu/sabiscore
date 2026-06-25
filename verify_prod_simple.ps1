# SabiScore Production Readiness Check - Simplified
Write-Host "`nSabiScore Production Readiness Verification" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0
$warnings = 0

# Check 1: Node.js
Write-Host "Checking Node.js..." -NoNewline
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host " OK ($nodeVersion)" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $failed++
}

# Check 2: Frontend dependencies
Write-Host "Checking frontend dependencies..." -NoNewline
if (Test-Path "apps\web\node_modules") {
    Write-Host " OK" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAILED (run: cd apps\web && npm install)" -ForegroundColor Red
    $failed++
}

# Check 3: Asset validation
Write-Host "Checking asset validation..." -NoNewline
Push-Location "apps\web"
$assetTest = npm run test:assets 2>&1
Pop-Location
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $failed++
}

# Check 4: TypeScript
Write-Host "Checking TypeScript..." -NoNewline
Push-Location "apps\web"
$tsCheck = npm run typecheck 2>&1
Pop-Location
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $failed++
}

# Check 5: Lint
Write-Host "Checking ESLint..." -NoNewline
Push-Location "apps\web"
$lintCheck = npm run lint 2>&1
Pop-Location
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $failed++
}

# Check 6: Team data files
Write-Host "Checking team data..." -NoNewline
if ((Test-Path "apps\web\src\lib\team-data.ts") -and (Test-Path "apps\web\src\components\team-display.tsx")) {
    Write-Host " OK" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $failed++
}

# Check 7: Validation script
Write-Host "Checking validation script..." -NoNewline
if (Test-Path "apps\web\scripts\validate-assets.js") {
    Write-Host " OK" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $failed++
}

# Summary
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Passed:   $passed" -ForegroundColor Green
Write-Host "Failed:   $failed" -ForegroundColor $(if($failed -eq 0){'Green'}else{'Red'})
Write-Host "Warnings: $warnings" -ForegroundColor Yellow

if ($failed -eq 0) {
    Write-Host "`nPRODUCTION READY!" -ForegroundColor Green
    Write-Host "All critical checks passed. Ready to deploy.`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nACTION REQUIRED" -ForegroundColor Red
    Write-Host "$failed critical checks failed. Resolve before deployment.`n" -ForegroundColor Red
    exit 1
}
