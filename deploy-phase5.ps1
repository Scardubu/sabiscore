#!/usr/bin/env pwsh
# SabiScore Phase 5: Edge Deployment Script
# Automates Cloudflare Pages + Prometheus + PWA setup

param(
    [string]$Mode = "setup",  # setup, deploy, monitor, test
    [string]$Environment = "production"  # development, staging, production
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "================================================================"
Write-Info "   SabiScore Phase 5: Edge Deployment Automation"
Write-Info "   Mode: $Mode | Environment: $Environment"
Write-Info "================================================================"

#──────────────────────────────────────────────────────────
# 1. SETUP MODE - Install dependencies & configure services
#──────────────────────────────────────────────────────────
if ($Mode -eq "setup") {
    Write-Info "`n[1/6] Installing Cloudflare CLI (Wrangler)..."
    if (!(Get-Command wrangler -ErrorAction SilentlyContinue)) {
        npm install -g wrangler
        Write-Success "Success: Wrangler installed"
    } else {
        Write-Success "Success: Wrangler already installed"
    }

    Write-Info "`n[2/6] Authenticating with Cloudflare..."
    Write-Info "-> Opening browser for authentication..."
    wrangler login

    Write-Info "`n[3/6] Creating Cloudflare KV Namespaces..."
    try {
        Write-Info "-> Creating production namespace..."
        wrangler kv:namespace create "SABISCORE_CACHE"
        Write-Info "-> Creating preview namespace..."
        wrangler kv:namespace create "SABISCORE_CACHE" --preview
        Write-Success "Success: KV namespaces created"
        Write-Warning "IMPORTANT: Copy the namespace IDs above and update wrangler.toml"
    } catch {
        Write-Warning "KV namespaces may already exist or creation failed"
        Write-Info "-> Check existing namespaces: wrangler kv:namespace list"
    }

    Write-Info "`n[4/6] Setting up Prometheus + Grafana..."
    if (Test-Path "./monitoring") {
        Write-Success "Success: Monitoring directory exists"
    } else {
        New-Item -ItemType Directory -Path "./monitoring" -Force | Out-Null
        New-Item -ItemType Directory -Path "./monitoring/grafana/datasources" -Force | Out-Null
        New-Item -ItemType Directory -Path "./monitoring/grafana/dashboards" -Force | Out-Null
        Write-Success "Success: Created monitoring directories"
    }

    # Create Prometheus config
    @"
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'sabiscore-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node_exporter:9100']
"@ | Out-File -FilePath "./monitoring/prometheus.yml" -Encoding UTF8
    Write-Success "Success: Created prometheus.yml"

    Write-Info "`n[5/6] Installing backend monitoring dependencies..."
    Set-Location backend
    pip install prometheus-client==0.19.0 --quiet
    Set-Location ..
    Write-Success "Success: Prometheus client installed"

    Write-Info "`n[6/6] Generating PWA assets..."
    if (!(Test-Path "./apps/web/public/manifest.json")) {
        @"
{
  "name": "SabiScore - Football Intelligence",
  "short_name": "SabiScore",
  "description": "Sub-150ms football predictions with +18% ROI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#10b981",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/logo-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/logo-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
"@ | Out-File -FilePath "./apps/web/public/manifest.json" -Encoding UTF8
        Write-Success "Success: Created manifest.json"
    } else {
        Write-Success "Success: manifest.json already exists"
    }

    Write-Success "`n=== Phase 5 setup complete! ==="
    Write-Info "`nNext steps:"
    Write-Info "  1. Update wrangler.toml with KV namespace IDs from above"
    Write-Info "  2. Configure production environment variables"
    Write-Info "  3. Run: .\deploy-phase5.ps1 -Mode deploy"
}

#──────────────────────────────────────────────────────────
# 2. DEPLOY MODE - Build and deploy to Cloudflare
#──────────────────────────────────────────────────────────
elseif ($Mode -eq "deploy") {
    Write-Info "`n[1/5] Building Next.js for production..."
    Set-Location apps/web
    $env:NODE_ENV = "production"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed!"
        Set-Location ../..
        exit 1
    }
    Write-Success "Success: Next.js build complete"

    Write-Info "`n[2/5] Optimizing bundle size..."
    $buildSize = (Get-ChildItem -Recurse .next | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Info "-> Build size: $([math]::Round($buildSize, 2)) MB"

    Write-Info "`n[3/5] Deploying to Cloudflare Pages..."
    if ($Environment -eq "production") {
        wrangler pages deploy .next --project-name=sabiscore-web --branch=main
    } else {
        wrangler pages deploy .next --project-name=sabiscore-web --branch=preview
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Cloudflare deployment failed!"
        Set-Location ../..
        exit 1
    }
    Write-Success "Success: Deployed to Cloudflare Pages"

    Set-Location ../..

    Write-Info "`n[4/5] Starting monitoring stack..."
    if (Test-Path "./docker-compose.monitoring.yml") {
        docker-compose -f docker-compose.monitoring.yml up -d
        Write-Success "Success: Prometheus + Grafana started"
        Write-Info "-> Grafana: http://localhost:3001 (admin/admin)"
        Write-Info "-> Prometheus: http://localhost:9090"
    } else {
        Write-Warning "docker-compose.monitoring.yml not found - skipping"
    }

    Write-Info "`n[5/5] Deploying backend API..."
    if (Get-Command railway -ErrorAction SilentlyContinue) {
        Set-Location backend
        railway up
        Set-Location ..
        Write-Success "Success: Backend deployed to Railway"
    } else {
        Write-Warning "Railway CLI not found - skipping backend deployment"
        Write-Info "-> Deploy manually: https://railway.app"
    }

    Write-Success "`n=== Phase 5 deployment complete! ==="
    Write-Info "`nProduction URLs:"
    Write-Info "  Frontend: https://sabiscore.pages.dev"
    Write-Info "  API: Check Railway dashboard"
    Write-Info "  Grafana: http://localhost:3001"
}

#──────────────────────────────────────────────────────────
# 3. MONITOR MODE - Open monitoring dashboards
#──────────────────────────────────────────────────────────
elseif ($Mode -eq "monitor") {
    Write-Info "Opening monitoring dashboards..."

    Start-Process "http://localhost:3001"  # Grafana
    Start-Process "http://localhost:9090"  # Prometheus
    Start-Process "https://dash.cloudflare.com"  # Cloudflare Analytics

    Write-Success "Success: Dashboards opened in browser"
}

#──────────────────────────────────────────────────────────
# 4. TEST MODE - Run performance tests
#──────────────────────────────────────────────────────────
elseif ($Mode -eq "test") {
    Write-Info "`n[1/4] Testing Edge Cache..."
    try {
        $response = Invoke-WebRequest -Uri "https://sabiscore.pages.dev/api/health" -Method GET
        $cacheStatus = $response.Headers["cf-cache-status"]
        Write-Info "-> Cache Status: $cacheStatus"
    } catch {
        Write-Warning "Could not test edge cache - site may not be deployed yet"
    }

    Write-Info "`n[2/4] Testing API Performance..."
    try {
        $start = Get-Date
        $apiResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/health" -Method GET
        $duration = ((Get-Date) - $start).TotalMilliseconds
        Write-Info "-> API Response Time: $([math]::Round($duration, 2))ms"

        if ($duration -lt 150) {
            Write-Success "Success: API latency within target (<150ms)"
        } else {
            Write-Warning "Warning: API latency above target: $([math]::Round($duration, 2))ms"
        }
    } catch {
        Write-Warning "API not accessible - may not be running"
    }

    Write-Info "`n[3/4] Testing WebSocket Connection..."
    Write-Info "-> Manual test: ws://localhost:8000/ws/edge/test-match-id"

    Write-Info "`n[4/4] Checking Prometheus Metrics..."
    try {
        $metrics = Invoke-RestMethod -Uri "http://localhost:8000/metrics" -Method GET
        if ($metrics -match "sabiscore_http_requests_total") {
            Write-Success "Success: Prometheus metrics exposed"
        }
    } catch {
        Write-Warning "Prometheus metrics endpoint unreachable"
    }

    Write-Success "`n=== Performance tests complete! ==="
}

#──────────────────────────────────────────────────────────
# Unknown mode
#──────────────────────────────────────────────────────────
else {
    Write-Error "Unknown mode: $Mode"
    Write-Info "Valid modes: setup, deploy, monitor, test"
    Write-Info "Example: .\deploy-phase5.ps1 -Mode setup"
    exit 1
}

Write-Info "`n================================================================"
Write-Info "Phase 5 Deployment Script Complete"
Write-Info "Documentation: PHASE_5_DEPLOYMENT_PLAN.md"
Write-Info "================================================================"
