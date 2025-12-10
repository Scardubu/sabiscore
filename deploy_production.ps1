#!/usr/bin/env pwsh
# ==============================================================================
# SabiScore 3.0 - Quick Production Deployment Script
# ==============================================================================
# Purpose: Automated one-command deployment to Vercel production
# Usage: .\deploy_production.ps1
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipVerification = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$ForceRedeploy = $false
)

$ErrorActionPreference = "Stop"

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
║                     Production Deployment v1.0                               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Host "🚀 Starting production deployment process..." -ForegroundColor White
Write-Host ""

# ==============================================================================
# Step 1: Pre-deployment verification
# ==============================================================================

if (-not $SkipVerification) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  Step 1: Pre-deployment Verification" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if verification script exists
    $verifyScript = Join-Path $PSScriptRoot "verify_production_env.ps1"
    
    if (Test-Path $verifyScript) {
        Write-Host "  Running environment verification..." -ForegroundColor Yellow
        
        try {
            & $verifyScript -SkipApiTests
            
            if ($LASTEXITCODE -ne 0) {
                Write-Host ""
                Write-Host "  ❌ Pre-deployment verification failed!" -ForegroundColor Red
                Write-Host "  Please fix the issues above before deploying." -ForegroundColor Red
                Write-Host ""
                exit 1
            }
        } catch {
            Write-Host "  ⚠️  Verification script encountered an error: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "  Continuing with deployment..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  Verification script not found, skipping..." -ForegroundColor Yellow
    }
    
    Write-Host ""
} else {
    Write-Host "  ⏭️  Skipping pre-deployment verification (use without -SkipVerification to enable)" -ForegroundColor Yellow
    Write-Host ""
}

# ==============================================================================
# Step 2: Build verification
# ==============================================================================

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Step 2: Build Verification" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Write-Host "  📦 Running production build..." -ForegroundColor Yellow

try {
    Set-Location (Join-Path $PSScriptRoot "apps\web")
    
    $buildOutput = npm run build 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  ❌ Build failed!" -ForegroundColor Red
        Write-Host "  Error output:" -ForegroundColor Red
        Write-Host $buildOutput -ForegroundColor Red
        Write-Host ""
        exit 1
    }
    
    Write-Host "  ✅ Build succeeded!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "  ❌ Build error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
} finally {
    Set-Location $PSScriptRoot
}

Write-Host ""

# ==============================================================================
# Step 3: Check Vercel CLI
# ==============================================================================

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Step 3: Vercel CLI Check" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "  ❌ Vercel CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Install with: npm install -g vercel" -ForegroundColor Yellow
    Write-Host ""
    
    $install = Read-Host "  Would you like to install Vercel CLI now? (y/N)"
    
    if ($install -eq 'y' -or $install -eq 'Y') {
        Write-Host "  📦 Installing Vercel CLI..." -ForegroundColor Yellow
        npm install -g vercel
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Failed to install Vercel CLI" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "  ✅ Vercel CLI installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "  Deployment cancelled." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ✅ Vercel CLI found: $(vercel --version)" -ForegroundColor Green
}

Write-Host ""

# ==============================================================================
# Step 4: Deploy to Vercel
# ==============================================================================

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Step 4: Deploy to Vercel" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

if (-not $ForceRedeploy) {
    Write-Host "  🎯 Deploying to production..." -ForegroundColor Yellow
    Write-Host ""
    
    $confirm = Read-Host "  This will deploy to PRODUCTION. Are you sure? (y/N)"
    
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host ""
        Write-Host "  Deployment cancelled." -ForegroundColor Yellow
        Write-Host ""
        exit 0
    }
}

Write-Host ""
Write-Host "  🚀 Starting Vercel deployment..." -ForegroundColor Yellow
Write-Host ""

try {
    vercel --prod
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  ❌ Deployment failed!" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
    
    Write-Host ""
    Write-Host "  ✅ Deployment successful!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "  ❌ Deployment error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host ""

# ==============================================================================
# Step 5: Post-deployment verification
# ==============================================================================

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Step 5: Post-deployment Verification" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$deploymentUrl = Read-Host "  Enter your deployment URL (e.g., https://sabiscore.vercel.app)"

if ([string]::IsNullOrWhiteSpace($deploymentUrl)) {
    Write-Host "  ⚠️  No URL provided, skipping post-deployment checks" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "  Testing deployment endpoints..." -ForegroundColor Yellow
    Write-Host ""
    
    $endpoints = @(
        @{ Path = "/api/health"; Name = "Health Check" },
        @{ Path = "/api/metrics"; Name = "Metrics" },
        @{ Path = "/api/drift"; Name = "Drift Detection" },
        @{ Path = "/api/warmup"; Name = "Model Warmup" }
    )
    
    $passed = 0
    $failed = 0
    
    foreach ($endpoint in $endpoints) {
        $fullUrl = "$deploymentUrl$($endpoint.Path)"
        
        try {
            $response = Invoke-WebRequest -Uri $fullUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
            
            if ($response.StatusCode -eq 200) {
                Write-Host "  ✅ $($endpoint.Name): OK" -ForegroundColor Green
                $passed++
            } else {
                Write-Host "  ❌ $($endpoint.Name): HTTP $($response.StatusCode)" -ForegroundColor Red
                $failed++
            }
        } catch {
            Write-Host "  ❌ $($endpoint.Name): $($_.Exception.Message)" -ForegroundColor Red
            $failed++
        }
    }
    
    Write-Host ""
    Write-Host "  📊 Results: $passed passed, $failed failed" -ForegroundColor White
}

Write-Host ""

# ==============================================================================
# Deployment Summary
# ==============================================================================

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Deployment Summary" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Write-Host "  🎉 Production deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next Steps:" -ForegroundColor Cyan
Write-Host "     1. Monitor Vercel dashboard for errors" -ForegroundColor White
Write-Host "     2. Test cron endpoints with CRON_SECRET" -ForegroundColor White
Write-Host "     3. Verify webhook alerts are working" -ForegroundColor White
Write-Host "     4. Check application performance in production" -ForegroundColor White
Write-Host ""
Write-Host "  Useful Commands:" -ForegroundColor Cyan
Write-Host "     • View logs: vercel logs" -ForegroundColor White
Write-Host "     • Check env vars: vercel env ls" -ForegroundColor White
Write-Host "     • Re-run verification: .\verify_production_env.ps1 -Url `"$deploymentUrl`"" -ForegroundColor White
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

exit 0
