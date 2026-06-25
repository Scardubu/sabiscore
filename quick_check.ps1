Write-Host "SabiScore Production Readiness Check" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$passed = 0
$failed = 0

Write-Host "`nChecking Node.js..." -NoNewline
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host " PASS" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAIL" -ForegroundColor Red
    $failed++
}

Write-Host "Checking Python..." -NoNewline
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host " PASS" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAIL" -ForegroundColor Red
    $failed++
}

Write-Host "Checking Frontend..." -NoNewline
if (Test-Path "apps\web\node_modules") {
    Write-Host " PASS" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAIL" -ForegroundColor Red
    $failed++
}

Write-Host "Checking Components..." -NoNewline
if ((Test-Path "apps\web\src\components\match-selector.tsx") -and (Test-Path "apps\web\src\components\insights-display.tsx")) {
    Write-Host " PASS" -ForegroundColor Green
    $passed++
} else {
    Write-Host " FAIL" -ForegroundColor Red
    $failed++
}

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor $(if($failed -eq 0){'Green'}else{'Yellow'})

if ($failed -eq 0) {
    Write-Host "`nPRODUCTION READY!" -ForegroundColor Green
} else {
    Write-Host "`nSome checks failed" -ForegroundColor Yellow
}
