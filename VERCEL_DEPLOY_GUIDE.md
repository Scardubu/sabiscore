# 🚀 Vercel Production Deploy - 5 Minutes to Live

## ✅ What This Fixes
- ❌ Cloudflare Pages: Static-only, no API routes
- ✅ Vercel: Full Next.js 15 support (SSR, ISR, API routes, Edge Runtime)

---

## 📋 Prerequisites
- [x] Vercel account (free tier works)
- [x] GitHub/GitLab repo (optional, but recommended)
- [x] Backend API deployed (Railway/Render) OR running locally for testing

---

## 🎯 Option 1: Deploy via Vercel CLI (Fastest - 5 min)

### Step 1: Install Vercel CLI
```powershell
npm install -g vercel@latest
```

### Step 2: Login to Vercel
```powershell
vercel login
```
**Opens browser** → Sign in with GitHub/GitLab/Email

### Step 3: Deploy from Root
```powershell
# From C:\Users\USR\Documents\SabiScore
vercel --prod
```

**Follow prompts:**
```
Set up and deploy "SabiScore"? [Y/n] Y
Which scope? → Your username
Link to existing project? [y/N] N
What's your project's name? → sabiscore
In which directory is your code located? → ./
```

**Vercel will:**
1. Detect Next.js 15 ✅
2. Build `apps/web` automatically
3. Deploy to global edge network
4. Return URL: `https://sabiscore-{hash}.vercel.app`

### Step 4: Configure Environment Variables
```powershell
# Set backend API URL
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://your-backend-api.railway.app

# Set revalidation secret
vercel env add REVALIDATE_SECRET production
# Enter: your-secret-token-here

# Set Sentry DSN (optional)
vercel env add NEXT_PUBLIC_SENTRY_DSN production
# Enter: https://c6916240a502e784eda3f658973e7506@o4510211912761344.ingest.de.sentry.io/4510350290124880
```

### Step 5: Redeploy with Env Vars
```powershell
vercel --prod
```

---

## 🎯 Option 2: Deploy via GitHub (Recommended for CI/CD)

### Step 1: Push to GitHub
```powershell
git add .
git commit -m "feat: enable Vercel deployment with full Next.js 15 support"
git push origin main
```

### Step 2: Import Project in Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your SabiScore repo
4. **Framework Preset:** Next.js (auto-detected)
5. **Root Directory:** `apps/web` ← **IMPORTANT**
6. **Build Command:** `npm run build` (auto-filled)
7. **Output Directory:** `.next` (auto-filled)

### Step 3: Add Environment Variables (in dashboard)
```env
NEXT_PUBLIC_API_URL=https://your-backend-api.railway.app
REVALIDATE_SECRET=your-secret-token-here
NEXT_PUBLIC_SENTRY_DSN=https://c6916240a502e784eda3f658973e7506@o4510211912761344.ingest.de.sentry.io/4510350290124880
```

### Step 4: Click Deploy
- ⏱️ Build time: ~2 minutes
- ✅ Result: `https://sabiscore.vercel.app` (custom domain setup available)

---

## 🔧 Backend API Deployment Options

### Option A: Railway (Recommended)
```powershell
# Install Railway CLI
npm install -g railway

# Login
railway login

# Deploy backend
cd backend
railway init
railway up

# Get API URL
railway domain
# Result: https://sabiscore-api-production.up.railway.app
```

**Cost:** ~$5/month (500 hours free trial)

---

### Option B: Render
1. Go to [render.com/new/webservice](https://render.com/new/webservice)
2. Connect GitHub repo
3. **Root Directory:** `backend`
4. **Build Command:** `pip install -r requirements.txt`
5. **Start Command:** `uvicorn src.api.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from `.env`
7. Deploy

**Cost:** Free tier available (spins down after 15min inactivity)

---

### Option C: Fly.io
```powershell
# Install Fly CLI
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login

# Deploy backend
cd backend
fly launch --name sabiscore-api --region iad
fly deploy

# Get URL
fly status
```

**Cost:** $5/month (free allowances included)

---

## 📊 Expected Performance After Deploy

### Before (Cloudflare Static)
```yaml
TTFB: N/A (API routes broken)
Dynamic Pages: Broken
ISR Revalidation: Not working
```

### After (Vercel)
```yaml
TTFB: 20-45ms ⚡ (Edge network)
Dynamic Pages: Working ✅
ISR Revalidation: Working ✅
API Routes: Working ✅
WebSocket: Works via backend
Geographic: 300+ POPs worldwide 🌍
```

---

## 🎯 Post-Deploy Verification

### 1. Test Homepage
```powershell
curl https://sabiscore.vercel.app
# Should return HTML with Sabiscore branding
```

### 2. Test API Route
```powershell
curl https://sabiscore.vercel.app/api/revalidate
# Should return: {"status":"ready","endpoint":"/api/revalidate"}
```

### 3. Test Dynamic Page
```powershell
start https://sabiscore.vercel.app/match/12345
# Should render match insights page (or 404 if match doesn't exist)
```

### 4. Test ISR Revalidation
```powershell
curl -X POST https://sabiscore.vercel.app/api/revalidate `
  -H "Content-Type: application/json" `
  -d '{"secret":"your-secret-token","path":"/match/12345"}'
# Should return: {"revalidated":true}
```

---

## 🔒 Security Checklist

- [ ] `REVALIDATE_SECRET` set (prevents unauthorized cache purging)
- [ ] Backend API has CORS configured for Vercel domain
- [ ] Environment variables stored in Vercel dashboard (not in code)
- [ ] Sentry DSN configured for error tracking
- [ ] Custom domain with HTTPS (optional: `sabiscore.io`)

---

## 🚨 Troubleshooting

### Build Failed: "Cannot find module 'next'"
**Fix:** Vercel needs `next` in root `package.json`
```powershell
# Add to root package.json dependencies
npm install next@latest --save --workspace=root
vercel --prod
```

### API Routes Return 404
**Fix:** Remove `output: 'export'` from `next.config.js` (already done ✅)

### Environment Variables Not Working
**Fix:** Redeploy after adding env vars
```powershell
vercel env pull .env.production.local
vercel --prod
```

### CORS Errors from Backend
**Fix:** Update backend CORS config
```python
# backend/src/api/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sabiscore.vercel.app",
        "https://sabiscore-*.vercel.app",  # Preview deployments
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📈 Monitoring & Analytics

### Vercel Analytics (Included Free)
- Real-time traffic
- Core Web Vitals (LCP, FID, CLS)
- Edge function logs
- Build logs

**Access:** [vercel.com/dashboard/analytics](https://vercel.com/dashboard/analytics)

### Sentry Integration
```typescript
// apps/web/src/app/layout.tsx
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENV || 'production',
    tracesSampleRate: 0.1, // 10% performance sampling
  });
}
```

---

## 🎉 Success Indicators

You'll know deployment is successful when:

✅ `vercel --prod` completes without errors  
✅ You receive a `https://sabiscore-*.vercel.app` URL  
✅ Opening URL shows Sabiscore homepage  
✅ `/api/revalidate` returns `{"status":"ready"}`  
✅ Dynamic routes like `/match/12345` render (or 404 gracefully)  
✅ Vercel dashboard shows green deployment status  

---

## 💰 Cost Breakdown

### Vercel Pro Plan (if needed)
```yaml
Free Tier:
  - 100 GB bandwidth/month
  - 6,000 build minutes/month
  - Unlimited API executions
  - Edge middleware included
  
Pro Plan ($20/month):
  - 1 TB bandwidth
  - Unlimited builds
  - Team collaboration
  - Custom domains (10)
  - Priority support
```

**Recommendation:** Start with **Free Tier** (sufficient for 10k CCU with good caching)

---

## 🚀 Next Steps

1. **Deploy Backend API** (Railway/Render/Fly.io)
2. **Run:** `vercel --prod`
3. **Add Environment Variables**
4. **Test:** Homepage, API routes, dynamic pages
5. **Custom Domain** (optional): `vercel domains add sabiscore.io`
6. **Enable Monitoring:** Vercel Analytics + Sentry

---

## 📞 Support

**Vercel Docs:** https://vercel.com/docs/frameworks/nextjs  
**Railway Docs:** https://docs.railway.app  
**Issue Tracker:** Check Vercel deployment logs  
**Status:** Ready to deploy ✅

---

**Current Status:** 🟢 Ready to deploy  
**Expected Deploy Time:** 5-10 minutes  
**Next Command:** `vercel --prod`

---

**Ship it.** 🚀
