# 🔐 SabiScore 3.0 Environment Variables Guide

**Last Updated**: December 10, 2025  
**Status**: PRODUCTION READY ✅

## 📋 Quick Reference - Production Values

Copy these values to your Vercel Dashboard:

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | `oy2UwS0F+QR2oWg602cm5Bj76Hh5kLiLVXpvSc7YhrA=` |
| `WARMUP_SECRET` | `zQAMRYnfxIALMcgvti1IytFKJMGy5B8Q` |
| `FOOTBALL_DATA_API_KEY` | `eeda2b3c9da04ad6aa2c469e694b733b` |
| `ODDS_API_KEY` | `000974fa1984eddc45c57d6217cb43bb` |

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Required Variables](#required-variables)
3. [Optional Variables](#optional-variables)
4. [Production Deployment](#production-deployment)
5. [Security Best Practices](#security-best-practices)

---

## Overview

SabiScore 3.0 uses environment variables for configuration. Variables are categorized by requirement level:

- **🔴 REQUIRED**: Must be set for production deployment
- **🟡 OPTIONAL**: Has sensible defaults, can be customized
- **🟢 AUTO-SET**: Automatically configured by deployment platform

---

## Required Variables

### 🔴 CRON_SECRET
**Purpose**: Authenticates Vercel cron job requests to prevent unauthorized execution

**Production Value**: `oy2UwS0F+QR2oWg602cm5Bj76Hh5kLiLVXpvSc7YhrA=`

**How to Generate** (if you need a new one):
```bash
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Bash/macOS
openssl rand -base64 32
```

**Where to Set**:
- Vercel Dashboard → Project Settings → Environment Variables
- Add to all environments (Production, Preview, Development)

**Used By**:
- `/api/cron/drift-check` - Runs every 6 hours
- `/api/cron/update-odds` - Runs every 30 minutes

---

### 🟡 ALERT_WEBHOOK_URL
**Purpose**: Webhook URL for sending critical drift alerts (Discord/Slack compatible)

**Required**: No (drift detection still runs without it)

**Format**: 
- Discord: `https://discord.com/api/webhooks/{webhook_id}/{token}`
- Slack: `https://hooks.slack.com/services/{T...}/{B...}/{...}`

**How to Get**:

**Discord**:
1. Server Settings → Integrations → Webhooks
2. Create New Webhook
3. Copy Webhook URL

**Slack**:
1. Browse Apps → Incoming Webhooks
2. Add to Workspace
3. Copy Webhook URL

**Alert Triggers**:
- Brier Score drift ≥ 0.10 (Critical)
- Brier Score drift ≥ 0.05 (Significant)

**Example Payload**:
```json
{
  "embeds": [{
    "title": "🚨 Critical Model Drift Detected",
    "color": 15548997,
    "fields": [
      {"name": "Current Brier", "value": "0.287", "inline": true},
      {"name": "Baseline", "value": "0.215", "inline": true},
      {"name": "Drift", "value": "+0.072 (33.5%)", "inline": true}
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }]
}
```

---

### 🟢 FOOTBALL_DATA_API_KEY
**Purpose**: Fetches upcoming match schedules from football-data.org API

**Production Value**: `eeda2b3c9da04ad6aa2c469e694b733b`

**Required**: No (fallback mode uses cached/sample data)

**Free Tier Limits**:
- 10 requests/minute
- 12 requests/hour  
- Competitions: PL, BL1, SA, PD, FL1, CL

**Used By**:
- `/api/cron/update-odds` - Fetches next 20 upcoming matches
- Cache: 30 minutes

**Fallback Behavior**:
- Returns sample fixtures if API key missing
- Odds cron continues with manual match entry workflow

---

### 🟢 WARMUP_SECRET
**Purpose**: Authenticates forced model warmup requests (POST /api/warmup)

**Production Value**: `zQAMRYnfxIALMcgvti1IytFKJMGy5B8Q`

**Required**: No (GET endpoint works without auth)

**Usage**:
```bash
# Force warmup (bypasses 5-minute cooldown)
curl -X POST https://sabiscore.vercel.app/api/warmup \
  -H "Authorization: Bearer zQAMRYnfxIALMcgvti1IytFKJMGy5B8Q"
```

**Warmup Details**:
- Initializes TensorFlow.js ensemble (Dense, LSTM, CNN)
- Reduces first prediction latency from ~3s to ~500ms
- Cooldown: 5 minutes (GET), none (POST with auth)

---

### 🟢 ODDS_API_KEY
**Purpose**: Fetches live betting odds from The Odds API

**Production Value**: `000974fa1984eddc45c57d6217cb43bb`

**Required**: No (manual odds entry still works)

**How to Get**:
1. Visit https://the-odds-api.com/
2. Sign up for free account
3. Copy API key from dashboard

**Free Tier Limits**:
- 500 requests/month
- ~16 requests/day
- Update frequency: Every 30 minutes = 48/day ❌

**⚠️ Recommendation**: 
- Use free aggregator sources (current implementation)
- Reserve Odds API for premium features only

**Alternative Sources** (No API Key):
- OddsPortal scraping (current implementation)
- BetExplorer aggregation
- FlashScore public data

---

## Optional Variables

### Build Configuration

#### NEXT_TELEMETRY_DISABLED
**Default**: `1` (disabled)
**Purpose**: Disables Next.js anonymous telemetry collection

#### NODE_OPTIONS
**Default**: `--max-old-space-size=8192`
**Purpose**: Allocates 8GB heap for TensorFlow.js model training

---

### API Configuration

#### NEXT_PUBLIC_API_URL
**Default**: `https://sabiscore-api.onrender.com`
**Purpose**: Backend API endpoint for health checks

#### NEXT_PUBLIC_WS_URL
**Default**: `wss://sabiscore-api.onrender.com`
**Purpose**: WebSocket endpoint for real-time updates (future feature)

---

### Betting Configuration

#### NEXT_PUBLIC_CURRENCY
**Default**: `NGN` (Nigerian Naira)
**Options**: `NGN`, `USD`, `EUR`, `GBP`

#### NEXT_PUBLIC_CURRENCY_SYMBOL
**Default**: `₦`
**Linked to**: `NEXT_PUBLIC_CURRENCY`

#### NEXT_PUBLIC_BASE_BANKROLL
**Default**: `10000` (₦10,000)
**Purpose**: Starting bankroll for Kelly Criterion calculations

#### NEXT_PUBLIC_KELLY_FRACTION
**Default**: `0.125` (1/8 Kelly)
**Options**:
- `0.125` - Conservative (recommended)
- `0.25` - Moderate
- `0.5` - Aggressive (full Kelly)

#### NEXT_PUBLIC_MIN_EDGE_NGN
**Default**: `66` (6.6% edge)
**Purpose**: Minimum expected value to recommend bet
**Calculation**: 6.6% of ₦1,000 stake = ₦66 profit

---

### Monitoring Configuration

#### DRIFT_SENSITIVITY
**Default**: `0.05` (5% drift threshold)
**Purpose**: Brier score change threshold for alerts

#### MONITORING_RETENTION_DAYS
**Default**: `90` days
**Purpose**: localStorage data retention period

---

## Production Deployment

### Vercel Setup

1. **Connect Repository**:
   ```bash
   vercel link
   ```

2. **Set Required Variables**:
   ```bash
   # Generate secrets
   $CRON_SECRET = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   
   # Set in Vercel
   vercel env add CRON_SECRET
   # Paste generated secret
   # Select: Production, Preview, Development
   ```

3. **Set Optional Variables** (Recommended):
   ```bash
   vercel env add ALERT_WEBHOOK_URL
   vercel env add FOOTBALL_DATA_API_KEY
   vercel env add WARMUP_SECRET
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

---

### Environment Checklist

#### Before First Deploy:
- [ ] `CRON_SECRET` generated and set in Vercel
- [ ] `ALERT_WEBHOOK_URL` configured (Discord/Slack)
- [ ] `FOOTBALL_DATA_API_KEY` obtained and set
- [ ] `WARMUP_SECRET` generated and set

#### After Deploy:
- [ ] Test drift-check cron: `curl https://your-app.vercel.app/api/cron/drift-check?secret=YOUR_CRON_SECRET`
- [ ] Test odds cron: `curl https://your-app.vercel.app/api/cron/update-odds?secret=YOUR_CRON_SECRET`
- [ ] Test warmup: `curl https://your-app.vercel.app/api/warmup`
- [ ] Verify webhook alert (trigger drift manually)

---

## Security Best Practices

### ✅ DO

1. **Use Strong Secrets**:
   - Minimum 32 bytes (256 bits)
   - Cryptographically random
   - Base64 encoded

2. **Rotate Regularly**:
   - `CRON_SECRET`: Every 90 days
   - `WARMUP_SECRET`: Every 90 days
   - `ALERT_WEBHOOK_URL`: After team changes

3. **Limit Scope**:
   - Use read-only API keys when possible
   - Set shortest TTL on tokens
   - Use separate keys per environment

4. **Monitor Usage**:
   - Check API quota consumption
   - Review webhook delivery logs
   - Track cron execution frequency

### ❌ DON'T

1. **Never Commit Secrets**:
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   .env.*.local
   ```

2. **Never Log Secrets**:
   ```typescript
   // ❌ BAD
   console.log('Cron secret:', process.env.CRON_SECRET)
   
   // ✅ GOOD
   console.log('Cron secret:', process.env.CRON_SECRET ? '[REDACTED]' : 'NOT SET')
   ```

3. **Never Share Webhook URLs**:
   - Webhook URLs contain authentication tokens
   - Revoke and regenerate if leaked
   - Use separate webhooks per environment

4. **Never Use Default Values**:
   - Change all `your_*_here` placeholders
   - Generate unique secrets per deployment
   - Don't reuse secrets across projects

---

## Troubleshooting

### Cron Jobs Not Running

**Symptoms**: Drift checks not executing, odds not updating

**Check**:
```bash
# Test cron endpoint manually
curl https://your-app.vercel.app/api/cron/drift-check?secret=YOUR_CRON_SECRET

# Expected response
{"success": true, "message": "Drift check completed"}
```

**Solutions**:
1. Verify `CRON_SECRET` matches between vercel.json and environment
2. Check Vercel Deployments → Functions → Logs
3. Ensure cron schedule is valid (crontab format)

---

### Webhook Alerts Not Sending

**Symptoms**: No Discord/Slack messages on drift detection

**Check**:
```bash
# Test webhook directly
curl -X POST https://discord.com/api/webhooks/YOUR_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

**Solutions**:
1. Verify `ALERT_WEBHOOK_URL` format (must include full URL with token)
2. Check webhook is not rate limited
3. Ensure drift threshold is exceeded (≥5% for significant, ≥10% for critical)
4. Review Vercel function logs for errors

---

### Football Data API Failing

**Symptoms**: No upcoming matches in odds update cron

**Check**:
```bash
# Test API key
curl https://api.football-data.org/v4/matches \
  -H "X-Auth-Token: YOUR_API_KEY"
```

**Solutions**:
1. Verify API key is valid (not expired)
2. Check rate limits (10 req/min)
3. Ensure competitions are in free tier (PL, BL1, SA, PD, FL1, CL)
4. Fallback: Remove `FOOTBALL_DATA_API_KEY` to use manual entry mode

---

### Model Warmup Timeout

**Symptoms**: Warmup endpoint returns 504 timeout

**Solutions**:
1. Increase Vercel function timeout (max 60s for Hobby tier)
2. Use warmup scheduling (not on-demand during traffic)
3. Check TensorFlow.js model files are accessible
4. Review IndexedDB model cache status

---

## Additional Resources

- **Vercel Environment Variables**: https://vercel.com/docs/environment-variables
- **Cron Job Format**: https://crontab.guru/
- **Discord Webhooks**: https://discord.com/developers/docs/resources/webhook
- **Slack Webhooks**: https://api.slack.com/messaging/webhooks
- **Football Data API**: https://www.football-data.org/documentation/quickstart
- **The Odds API**: https://the-odds-api.com/liveapi/guides/v4/

---

## Summary

### Minimum Production Setup (3 variables):
```bash
CRON_SECRET=<generated-32-byte-secret>
ALERT_WEBHOOK_URL=<discord-or-slack-webhook>
FOOTBALL_DATA_API_KEY=<football-data-org-key>
```

### Full Production Setup (6 variables):
```bash
# Required
CRON_SECRET=<generated-32-byte-secret>

# Highly Recommended
ALERT_WEBHOOK_URL=<discord-or-slack-webhook>
FOOTBALL_DATA_API_KEY=<football-data-org-key>
WARMUP_SECRET=<generated-24-byte-secret>

# Optional
NEXT_PUBLIC_BASE_BANKROLL=10000
NEXT_PUBLIC_KELLY_FRACTION=0.125
```

All other variables have production-ready defaults and do not require configuration.
