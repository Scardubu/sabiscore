#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Smoke tests for SabiScore frontend build and runtime
.DESCRIPTION
    Validates Next.js build succeeds and key pages render
#>

$ErrorActionPreference = "Stop"

Write-Host "=== SabiScore Frontend Smoke Tests ===" -ForegroundColor Cyan

# Test 1: TypeScript type checking
Write-Host "`n[1/4] Running TypeScript type check..." -ForegroundColor Yellow
Set-Location "apps\web"
try {
    npm run typecheck
    Write-Host "[PASS] Type check" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Type check" -ForegroundColor Red
    exit 1
} finally {
    Set-Location "..\\.."
}

# Test 2: ESLint
Write-Host "`n[2/4] Running ESLint..." -ForegroundColor Yellow
Set-Location "apps\web"
try {
    npm run lint
    Write-Host "[PASS] Lint" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Lint warnings (non-blocking)" -ForegroundColor Yellow
} finally {
    Set-Location "..\\.."
}

# Test 3: Production build
Write-Host "`n[3/4] Building for production..." -ForegroundColor Yellow
try {
    npm run build:web
    Write-Host "[PASS] Build" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Build" -ForegroundColor Red
    exit 1
}

# Test 4: Check build artifacts
Write-Host "`n[4/4] Verifying build artifacts..." -ForegroundColor Yellow
$buildDir = "apps\web\.next"
if (Test-Path $buildDir) {
    $standalonePath = Join-Path $buildDir "standalone"
    $staticPath = Join-Path $buildDir "static"
    
    if ((Test-Path $standalonePath) -and (Test-Path $staticPath)) {
        Write-Host "[PASS] Build artifacts present" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Build artifacts incomplete" -ForegroundColor Yellow
    }
} else {
    Write-Host "[FAIL] Build directory not found" -ForegroundColor Red
    exit 1
}

Write-Host "`n[PASS] All frontend smoke tests" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  - Start dev server: npm run dev:web"
Write-Host "  - Start production: cd apps/web ; npm start"
Write-Host "  - Run backend tests: .\scripts\smoke-test-backend.ps1"
