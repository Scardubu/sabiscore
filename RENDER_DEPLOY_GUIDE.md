# 🚀 Render Deployment Guide

## ✅ Prerequisites
- ✅ Render API Key: `rnd_ug52LYDsSEsMIOQz3gOoOuJBW0B1`
- ✅ Backend code ready
- ✅ Dependencies fixed (pydantic 2.9.2, ruamel.yaml 0.18.6)

---

## 📋 Render Dashboard Deployment (10 minutes)

### Step 1: Create Web Service

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub (if not connected):
   - Click "Connect GitHub"
   - Authorize Render
   - Select your sabiscore repository

### Step 2: Configure Service

```yaml
Name: sabiscore-api
Region: Oregon (US West)
Branch: main
Root Directory: backend
Runtime: Python 3
Build Command: pip install --upgrade pip && pip install -r requirements.txt
Start Command: uvicorn src.api.main:app --host 0.0.0.0 --port $PORT --workers 4
Instance Type: Free (or Starter $7/month for better performance)
```

### Step 3: Environment Variables

Add these in the Render dashboard:

```yaml
PYTHON_VERSION: 3.11
ENVIRONMENT: production
DATABASE_URL: (leave empty for now, uses SQLite)
REDIS_URL: (leave empty for now, uses dict cache)
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait 5-7 minutes for build
3. Once deployed, copy your URL:
   ```
   https://sabiscore-api.onrender.com
   ```

---

## 🔗 Connect to Vercel Frontend

### Step 1: Add Backend URL to Vercel

```powershell
# Set the backend URL
vercel env add NEXT_PUBLIC_API_URL production
# When prompted, paste: https://sabiscore-api.onrender.com/api/v1

# Redeploy frontend with new env
vercel --prod
```

### Step 2: Test the Connection

```powershell
# Test backend health
curl https://sabiscore-api.onrender.com/health

# Test frontend
start https://sabiscore-70xn1bfov-oversabis-projects.vercel.app
```

---

## 🔧 Alternative: Render CLI Deployment

```powershell
# Install Render CLI
pip install render-cli

# Login with API key
render login --api-key rnd_ug52LYDsSEsMIOQz3gOoOuJBW0B1

# Deploy from backend directory
cd backend
render deploy
```

---

## ⚠️ Common Issues & Fixes

### Issue 1: Pydantic Version Conflict
**Error:** `safety 3.5.1 requires pydantic<2.10.0,>=2.6.0, but you have pydantic 2.5.0`

**Fix:** ✅ Already fixed in requirements.txt
- Updated `pydantic==2.5.0` → `pydantic==2.9.2`
- Updated `ruamel.yaml` → `ruamel.yaml==0.18.6`

### Issue 2: Port Variable Not Set
**Error:** `Option '--port' requires an argument`

**Fix:** Use explicit port for local testing:
```powershell
# Local testing (port 8000)
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Render will automatically set $PORT variable
```

### Issue 3: Build Timeout
**Solution:** Render free tier has 10-minute build limit. If timeout:
1. Remove heavy dependencies temporarily
2. Use Starter plan ($7/month) for faster builds
3. Optimize requirements.txt

---

## 📊 Expected Build Output

```bash
==> Building...
==> Running: pip install --upgrade pip && pip install -r requirements.txt
Collecting fastapi==0.104.1
Collecting pydantic==2.9.2
...
Successfully installed [all packages]
==> Build successful!

==> Deploying...
==> Starting: uvicorn src.api.main:app --host 0.0.0.0 --port $PORT --workers 4
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
==> Deploy successful!
```

---

## ✅ Verification Steps

### 1. Check Render Logs
```
Dashboard → Your Service → Logs
Should see: "Application startup complete"
```

### 2. Test Backend Endpoints
```powershell
# Health check
curl https://sabiscore-api.onrender.com/health

# API docs
start https://sabiscore-api.onrender.com/docs
```

### 3. Test Frontend Integration
```powershell
# Should now load data from backend
start https://sabiscore-70xn1bfov-oversabis-projects.vercel.app
```

---

## 💰 Cost Breakdown

### Free Tier
```yaml
Monthly Hours: 750 hours
Cold Start: 30-60 seconds (after 15 min inactivity)
RAM: 512 MB
CPU: Shared
Cost: $0/month
```

### Starter Plan (Recommended)
```yaml
Monthly Hours: Unlimited
Cold Start: None (always running)
RAM: 512 MB
CPU: 0.5 vCPU
Cost: $7/month
```

---

## 🎯 Quick Start Commands

```powershell
# 1. Fix dependencies
cd backend
pip install -r requirements.txt

# 2. Test locally
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Go to Render dashboard
start https://dashboard.render.com/

# 4. Create Web Service (see Step 2 above)

# 5. Wait for deployment (5-7 minutes)

# 6. Add backend URL to Vercel
vercel env add NEXT_PUBLIC_API_URL production
# Paste: https://sabiscore-api.onrender.com/api/v1

# 7. Redeploy frontend
vercel --prod

# 8. Test!
start https://sabiscore-70xn1bfov-oversabis-projects.vercel.app
```

---

**Time:** 10 minutes  
**Cost:** $0/month (free) or $7/month (starter)  
**Result:** Full-stack production deployment ✅
