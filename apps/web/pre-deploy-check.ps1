#!/usr/bin/env pwsh
# SabiScore 3.0 - Pre-Deployment Verification
# Runs all checks before pushing to production

Write-Host "🔍 SabiScore 3.0 - Pre-Deployment Verification" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$checks = @()
$allPassed = $true

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Message = ""
    )
    
    $status = if ($Passed) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($Passed) { "Green" } else { "Red" }
    
    Write-Host "$status - $Name" -ForegroundColor $color
    if ($Message) {
        Write-Host "   $Message" -ForegroundColor Gray
    }
    
    $script:checks += [PSCustomObject]@{
        Check = $Name
        Status = $status
        Message = $Message
    }
    
    if (-not $Passed) {
        $script:allPassed = $false
    }
}

# 1. Check Node.js version
Write-Host "📦 Checking Environment..." -ForegroundColor Yellow
$nodeVersion = node --version
$nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
Add-Check "Node.js Version (>= 20)" ($nodeMajor -ge 20) "Found: $nodeVersion"

# 2. Check dependencies installed
$nodeModulesExists = Test-Path "node_modules"
Add-Check "Dependencies Installed" $nodeModulesExists

# 3. Check TypeScript compilation
Write-Host ""
Write-Host "🔨 Checking Build..." -ForegroundColor Yellow
$buildResult = npm run build 2>&1
$buildSuccess = $LASTEXITCODE -eq 0
Add-Check "Build Succeeds" $buildSuccess

# 4. Check for TypeScript errors
if ($buildSuccess) {
    $hasTypeErrors = $buildResult | Select-String -Pattern "Type error:" -Quiet
    Add-Check "No TypeScript Errors" (-not $hasTypeErrors)
}

# 5. Check critical files exist
Write-Host ""
Write-Host "📁 Checking Critical Files..." -ForegroundColor Yellow

$criticalFiles = @(
    "src/lib/ml/tfjs-ensemble-engine.ts",
    "src/lib/betting/kelly-optimizer.ts",
    "src/lib/betting/free-odds-aggregator.ts",
    "src/lib/monitoring/free-analytics.ts",
    "src/components/monitoring/performance-dashboard.tsx",
    "src/app/api/predict/route.ts",
    "src/app/api/kelly/route.ts",
    "src/app/api/health/route.ts",
    "src/app/monitoring/page.tsx"
)

foreach ($file in $criticalFiles) {
    $exists = Test-Path $file
    Add-Check "File: $(Split-Path $file -Leaf)" $exists $file
}

# 6. Check environment variables
Write-Host ""
Write-Host "🔐 Checking Environment..." -ForegroundColor Yellow

$envLocalExists = Test-Path ".env.local"
Add-Check ".env.local exists" $envLocalExists "Required for local development"

if ($envLocalExists) {
    $envContent = Get-Content ".env.local" -Raw
    $hasKVUrl = $envContent -match "KV_REST_API_URL"
    $hasKVToken = $envContent -match "KV_REST_API_TOKEN"
    
    Add-Check "KV_REST_API_URL configured" $hasKVUrl
    Add-Check "KV_REST_API_TOKEN configured" $hasKVToken
}

# 7. Check bundle size
Write-Host ""
Write-Host "📊 Checking Bundle Size..." -ForegroundColor Yellow

if (Test-Path ".next") {
    $buildManifest = Get-Content ".next/build-manifest.json" -Raw | ConvertFrom-Json
    $totalSize = ($buildManifest.rootMainFiles | Measure-Object -Sum).Sum
    
    # Check if bundle is reasonable (<500KB for main files)
    $bundleOK = $totalSize -lt 500
    Add-Check "Bundle Size Reasonable" $bundleOK "Main files: $totalSize KB"
}

# 8. Check for common issues
Write-Host ""
Write-Host "🔍 Checking Common Issues..." -ForegroundColor Yellow

# Check for console.log statements in production code
$hasConsoleLogs = Get-ChildItem -Path "src" -Recurse -Filter "*.ts" -File | 
    Select-String -Pattern "console\.(log|debug)" -Quiet

Add-Check "No Debug Console Logs" (-not $hasConsoleLogs) "Remove console.log() before production"

# Check for TODO comments
$hasTodos = Get-ChildItem -Path "src" -Recurse -Filter "*.ts" -File | 
    Select-String -Pattern "TODO:" -Quiet

if ($hasTodos) {
    Write-Host "   ⚠️  Warning: TODO comments found" -ForegroundColor Yellow
}

# 9. Check Git status
Write-Host ""
Write-Host "📝 Checking Git Status..." -ForegroundColor Yellow

$gitStatus = git status --porcelain 2>$null
$hasUncommitted = $gitStatus.Length -gt 0

if ($hasUncommitted) {
    Write-Host "   ⚠️  Warning: Uncommitted changes" -ForegroundColor Yellow
    Add-Check "Git Clean" $false "Commit changes before deploying"
} else {
    Add-Check "Git Clean" $true "No uncommitted changes"
}

# Summary
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "📊 Verification Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($checks | Where-Object { $_.Status -eq "✅ PASS" }).Count
$failed = ($checks | Where-Object { $_.Status -eq "❌ FAIL" }).Count
$total = $checks.Count

Write-Host "Total Checks: $total" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($allPassed) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Ready to deploy to production!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. git add ." -ForegroundColor Gray
    Write-Host "  2. git commit -m 'feat: SabiScore 3.0 production-ready'" -ForegroundColor Gray
    Write-Host "  3. git push origin main" -ForegroundColor Gray
    Write-Host "  4. Deploy to Vercel" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ SOME CHECKS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before deploying." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
