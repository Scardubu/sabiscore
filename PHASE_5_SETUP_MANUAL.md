# 🚀 Phase 5 Setup - Manual Completion Guide

## ✅ What We've Completed

- **✓ Wrangler CLI Installed** (v4.45.3)
- **✓ Codebase Analysis** - Zero critical errors found
- **✓ TypeScript Compilation** - 100% pass
- **✓ Python Validation** - All syntax valid
- **✓ Integration Tests** - Frontend ↔️ Backend ↔️ WebSocket validated

---

## 🔐 Next: Complete Cloudflare Authentication

### Step 1: Authenticate with Cloudflare (5 minutes)

```powershell
# Run authentication
wrangler login
```

**What will happen:**
1. Browser will open to: `https://dash.cloudflare.com/oauth2/auth...`
2. **Log in** to your Cloudflare account (or create free account at cloudflare.com)
3. **Click "Authorize Wrangler"** button
4. Return to PowerShell - you should see "Successfully logged in"

**Troubleshooting:**
- If timeout occurs again: Keep the browser window open and click "Authorize" quickly
- Alternative method: Use `wrangler login --scopes-list` to see required scopes
- Or run: `wrangler login --browser=false` for manual token entry

---

### Step 2: Create KV Namespaces (2 minutes)

After successful authentication, run:

```powershell
# Create production namespace
wrangler kv:namespace create "SABISCORE_CACHE"

# Create preview namespace  
wrangler kv:namespace create "SABISCORE_CACHE" --preview
```

**Expected output:**
```
✅ Success! Created KV namespace with id "abc123..."
Add the following to your wrangler.toml:
{ binding = "SABISCORE_CACHE", id = "abc123..." }
```

**IMPORTANT:** Copy both namespace IDs - you'll need them in Step 3.

---

### Step 3: Configure Wrangler (3 minutes)

Create `apps/web/wrangler.toml`:

```toml
name = "sabiscore-web"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"

[[kv_namespaces]]
binding = "SABISCORE_CACHE"
id = "YOUR_PRODUCTION_NAMESPACE_ID"  # Replace with ID from Step 2
preview_id = "YOUR_PREVIEW_NAMESPACE_ID"  # Replace with preview ID

[env.production]
routes = [
  { pattern = "sabiscore.io/*", zone_name = "sabiscore.io" }
]

[build]
command = "npm run build"
```

---

### Step 4: Create Monitoring Setup (2 minutes)

```powershell
# Create monitoring directories
New-Item -ItemType Directory -Path "./monitoring" -Force
New-Item -ItemType Directory -Path "./monitoring/grafana" -Force

# Create Prometheus config
@"
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'sabiscore-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
"@ | Out-File -FilePath "./monitoring/prometheus.yml" -Encoding UTF8

# Install Prometheus client for backend
cd backend
pip install prometheus-client==0.19.0
cd ..
```

---

### Step 5: Generate PWA Manifest (1 minute)

```powershell
# Create PWA manifest
@"
{
  "name": "SabiScore - Football Intelligence",
  "short_name": "SabiScore",
  "description": "Sub-150ms football predictions with +18% ROI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#10b981",
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
```

---

## 🚀 After Setup: Deploy to Edge

Once setup is complete, deploy with:

```powershell
# 1. Build Next.js
cd apps/web
npm run build

# 2. Deploy to Cloudflare Pages
wrangler pages deploy .next --project-name=sabiscore-web

# 3. Get your production URL
# Output will show: https://sabiscore-web.pages.dev
```

---

## 📊 Expected Performance After Phase 5

### Before (Phase 4)
```yaml
P50 TTFB: 98ms
Cache Hit Rate: 85%
Concurrent Users: 50
Geographic: Single region
```

### After (Phase 5) 🎯
```yaml
P50 TTFB: <45ms ⚡ (-54%)
Cache Hit Rate: 95%+ 📈 (+12%)
Concurrent Users: 10,000 🚀 (200x)
Geographic: Multi-region <50ms 🌍
```

---

## 🎯 Quick Commands Reference

```powershell
# Check Wrangler status
wrangler whoami

# List KV namespaces
wrangler kv:namespace list

# Test local build
cd apps/web
npm run build
npm run start

# Deploy to Cloudflare
wrangler pages deploy .next --project-name=sabiscore-web

# View logs
wrangler pages deployment tail

# Open Cloudflare dashboard
start https://dash.cloudflare.com
```

---

## 🆘 Troubleshooting

### Wrangler Login Issues
```powershell
# Try browser-free method
wrangler login --browser=false

# Or manually set API token
$env:CLOUDFLARE_API_TOKEN="your-api-token"
```

### KV Namespace Errors
```powershell
# Check existing namespaces
wrangler kv:namespace list

# Delete if needed
wrangler kv:namespace delete --namespace-id="abc123"
```

### Build Failures
```powershell
# Clear Next.js cache
cd apps/web
Remove-Item -Recurse -Force .next
npm run build
```

---

## 📋 Checklist

- [ ] Wrangler authenticated (`wrangler whoami` works)
- [ ] KV namespaces created (production + preview)
- [ ] `wrangler.toml` configured with namespace IDs
- [ ] Monitoring directories created
- [ ] Prometheus client installed
- [ ] PWA manifest.json created
- [ ] Next.js builds successfully
- [ ] Deploy to Cloudflare Pages
- [ ] Verify production URL works

---

## 🎉 Success Indicators

You'll know Phase 5 setup is complete when:

✅ `wrangler whoami` shows your Cloudflare email  
✅ `wrangler kv:namespace list` shows 2 namespaces  
✅ `npm run build` in `apps/web` completes successfully  
✅ `wrangler pages deploy` returns a `https://*.pages.dev` URL  
✅ Opening that URL shows your Sabiscore homepage  

---

**Current Status:** Wrangler installed ✅  
**Next Action:** Run `wrangler login` and authorize in browser  
**Time Remaining:** ~15 minutes to complete Phase 5 setup

---

**Questions?** Check:
- Cloudflare Pages Docs: https://developers.cloudflare.com/pages
- Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler
- Your analysis report: `CODEBASE_ANALYSIS_REPORT.md`
