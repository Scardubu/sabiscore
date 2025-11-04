# ⚡ QUICKEST DEPLOYMENT PATH - 10 MINUTES

## 🎯 The Situation

✅ **Vercel authenticated** - Ready to deploy frontend  
⚠️ **Railway needs payment** - Requires $5/month  
✅ **Backend works locally** - Running on localhost:8000

---

## 🚀 **FASTEST PATH: Deploy Frontend Only (5 minutes)**

### Deploy frontend to Vercel, keep backend local for testing:

```powershell
# 1. Navigate to apps/web
cd apps/web

# 2. Deploy to Vercel
vercel --prod

# When prompted:
# "Set up and deploy apps/web?" → Y
# "Which scope?" → Oversabi's projects
# "Link to existing project?" → N
# "Project name?" → sabiscore-web
# "Override settings?" → N

# 3. Wait for build (3-4 minutes)
# You'll get: https://sabiscore-web.vercel.app

# 4. For now, frontend will call localhost:8000
# This works for local testing
```

**Result:** Frontend live on Vercel, backend stays local

---

## 💰 **PRODUCTION PATH: Add Backend Hosting**

Once you're ready to pay for backend hosting:

### Option A: Railway ($5/month - Fastest)
```powershell
# Add payment method at railway.com/account/plans
cd backend
railway up
# Get URL: https://sabiscore-api-production.up.railway.app

# Update Vercel env
vercel env add NEXT_PUBLIC_API_URL production
# Paste Railway URL
vercel --prod
```

### Option B: Render (Free 750hr/month)
```powershell
# Sign up at render.com
# Create new "Web Service"
# Connect GitHub repo
# Root directory: backend
# Build: pip install -r requirements.txt
# Start: uvicorn src.api.main:app --host 0.0.0.0 --port $PORT
# Get URL: https://sabiscore-api.onrender.com

# Update Vercel
vercel env add NEXT_PUBLIC_API_URL production
# Paste Render URL
vercel --prod
```

### Option C: Fly.io (Free 3 VMs)
```powershell
# Install flyctl
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
flyctl auth login

# Deploy
cd backend
flyctl launch
# Get URL: https://sabiscore-api.fly.dev

# Update Vercel
vercel env add NEXT_PUBLIC_API_URL production
# Paste Fly URL
vercel --prod
```

---

## 🎯 **RECOMMENDED: Start with Frontend Only**

```powershell
# From project root
cd apps/web

# Deploy frontend
vercel --prod

# Test locally:
# 1. Start backend: cd backend && uvicorn src.api.main:app --reload
# 2. Visit: https://sabiscore-web.vercel.app
# 3. API calls go to localhost:8000 (CORS already configured)
```

---

## 📊 Cost Comparison

| Platform | Free Tier | Paid | Cold Start | Uptime |
|----------|-----------|------|------------|--------|
| **Render** | 750hr/mo | $7/mo | 30-60s | 99% |
| **Railway** | None | $5/mo | <1s | 99.9% |
| **Fly.io** | 3 VMs | $5/mo | <1s | 99.9% |
| **Local** | Free | $0 | 0s | N/A |

---

## ✅ What To Do Right Now

```powershell
# Option 1: Deploy frontend only (5 min, $0)
cd apps/web
vercel --prod

# Option 2: Add Railway ($5/mo, 15 min total)
# Add payment at railway.com/account/plans
cd backend
railway up
cd ../apps/web
vercel --prod
vercel env add NEXT_PUBLIC_API_URL production

# Option 3: Use Render (15 min, $0)
# Go to render.com → New Web Service → Connect repo
cd apps/web
vercel --prod
vercel env add NEXT_PUBLIC_API_URL production
```

**My recommendation:** Deploy frontend now ($0), add backend hosting when you're ready to go live ($5-7/month).

---

## 🚀 Next Command

```powershell
cd apps/web
vercel --prod
```

This will:
1. Build Next.js app
2. Deploy to Vercel CDN (300+ locations)
3. Give you live URL in 4 minutes
4. Frontend calls your local backend (localhost:8000)

**Ready to run it?** 🎯
