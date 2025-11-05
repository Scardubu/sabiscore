# 🚀 Git Push Instructions - Post LFS Migration

**Status:** ✅ Ready to push (awaiting network connectivity)  
**Date:** November 5, 2025  
**Branch:** main @ `45c985d65`

---

## ✅ What's Complete

### 1. Backend Unit Tests Stabilized ✅
- **Status:** 52 tests passing, 77% coverage (threshold: 60%)
- **Key Fixes:**
  - Pure-Python Sharpe ratio calculation (no numpy dependency)
  - NumPy shim for pytest.approx compatibility
  - JSON-safe caching with Pydantic validation
  - Graceful degradation for DB-dependent endpoints
  - `.coveragerc` configured to exclude integration modules

### 2. Git LFS Migration Complete ✅
- **Files Tracked:** 1,242 LFS objects (64.15 MB)
- **Patterns:** `*.pkl`, `*.onnx`, `*.bin`, `*.pt`, `*.csv`, `*.parquet`, `*.map`
- **History Rewritten:** 15 commits migrated to LFS
- **Repository Size:** Reduced via aggressive GC
- **Configuration:** `.lfsconfig` set to HTTPS endpoint

### 3. Commits Ready for Push ✅
```
45c985d65 - chore(lfs): configure SSH transport for LFS (reverted to HTTPS)
ec67b6f41 - chore(lfs): track large artifacts with Git LFS
ec79d14cb - test: stabilize backend unit tests; fix numpy stub issues
[...14 more commits rewritten by LFS migration]
```

---

## 🔧 Current Git Configuration

```powershell
# Remote
origin: https://github.com/Scardubu/sabiscore.git

# LFS Config
lfs.concurrenttransfers = 3
lfs.url = https://github.com/Scardubu/sabiscore.git/info/lfs

# HTTP Optimizations
http.postBuffer = 524288000 (500 MB)
http.timeout = 600 (10 minutes)

# Credential Helper
credential.helper = wincred
```

---

## 🚨 Known Issues

### Network Connectivity Required
- **Error:** `Could not resolve host: github.com`
- **Cause:** DNS resolution failing (no network connectivity)
- **Resolution:** Restore network connection before pushing

### Force Push Required
- **Why:** History rewritten by LFS migration
- **Safety:** Using `--force-with-lease` to prevent accidental overwrites
- **Impact:** Collaborators will need to:
  ```powershell
  git fetch origin
  git reset --hard origin/main
  git lfs pull
  ```

---

## 🎯 Push Commands (Execute After Network Restored)

### Option 1: Direct Push (Recommended)
```powershell
# Verify network connectivity first
Test-NetConnection github.com -Port 443

# Push with force-with-lease (safe force push)
git push --force-with-lease -u origin main

# Verify LFS objects uploaded
git lfs ls-files
```

### Option 2: SSH Push (If HTTPS Issues Persist)
```powershell
# Switch to SSH remote
git remote set-url origin git@github.com:Scardubu/sabiscore.git

# Update .lfsconfig for SSH
@"
[lfs]
    url = "git@github.com:Scardubu/sabiscore.git"
"@ | Out-File -FilePath .lfsconfig -Encoding utf8

# Commit config change
git add .lfsconfig
git commit -m "chore(lfs): switch to SSH transport"

# Push via SSH
git push --force-with-lease -u origin main
```

### Option 3: Push in Batches (If Timeout Issues)
```powershell
# Push git objects first (no LFS)
GIT_LFS_SKIP_SMUDGE=1 git push --force-with-lease origin main

# Then push LFS objects separately
git lfs push origin main --all
```

---

## ✅ Post-Push Verification

```powershell
# 1. Verify remote refs match local
git fetch origin
git log origin/main..main
# Should be empty (no commits ahead)

# 2. Verify LFS objects uploaded
git lfs ls-files --size
git lfs ls-files | wc -l
# Should show 1,242 files

# 3. Check GitHub UI
# - Visit: https://github.com/Scardubu/sabiscore
# - Confirm: Latest commit is 45c985d65
# - Check: LFS storage in repository settings
```

---

## 🔍 Troubleshooting

### "fatal: HttpRequestException encountered"
**Fix:** Check network connectivity:
```powershell
Test-NetConnection github.com -Port 443
ping github.com
```

### "fatal: The remote end hung up unexpectedly"
**Fix:** Increase timeouts and reduce concurrency:
```powershell
git config http.postBuffer 1048576000  # 1GB
git config lfs.concurrenttransfers 1   # Serial uploads
git push --force-with-lease origin main
```

### "batch request: ERROR: invalid repository"
**Fix:** Verify LFS endpoint configuration:
```powershell
git lfs env
# Ensure Endpoint matches your remote URL
```

### "Git credentials not found"
**Fix:** Configure credential helper:
```powershell
# Windows
git config --global credential.helper wincred

# Or use personal access token (PAT)
$token = "your_github_pat_here"
git remote set-url origin "https://${token}@github.com/Scardubu/sabiscore.git"
```

---

## 📊 Expected Push Output

```
Uploading LFS objects: 100% (1099/1099), 64 MB | 5.2 MB/s, done.
Enumerating objects: 83840, done.
Counting objects: 100% (83840/83840), done.
Delta compression using up to 4 threads
Compressing objects: 100% (81197/81197), done.
Writing objects: 100% (83840/83840), 45.32 MiB | 3.21 MiB/s, done.
Total 83840 (delta 24484), reused 54438 (delta 0)
remote: Resolving deltas: 100% (24484/24484), done.
To https://github.com/Scardubu/sabiscore.git
 + ec67b6f...950463c main -> main (forced update)
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

---

## 🎉 Success Criteria

- [ ] `git push` exits with code 0
- [ ] Remote shows latest commit `45c985d65`
- [ ] All 1,242 LFS objects uploaded (check GitHub LFS storage)
- [ ] GitHub Actions CI passes (if configured)
- [ ] Local `git status` shows "Your branch is up to date with 'origin/main'"

---

## 📚 Additional Resources

- **Git LFS Docs:** https://git-lfs.github.com/
- **GitHub LFS Guide:** https://docs.github.com/en/repositories/working-with-files/managing-large-files
- **Force Push Safety:** https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-leaseltrefnamegt

---

## 🔒 Security Notes

1. **Never commit credentials** to repository
2. **Use PAT for HTTPS** (not password)
3. **Protect main branch** in GitHub settings after push
4. **Review collaborators** before force push
5. **Backup critical data** before force operations

---

## 💡 Next Steps After Successful Push

1. **Verify Deployment Docs:** Ensure all paths reference correct commit
2. **Update CI/CD:** Configure GitHub Actions for automated tests
3. **Deploy Backend:** Follow `QUICK_DEPLOY.md` (7 minutes)
4. **Deploy Frontend:** Follow `VERCEL_DEPLOY_GUIDE.md` (5 minutes)
5. **Monitor Production:** Set up Sentry/Grafana alerts

---

**Ready to push when network is restored! 🚀**
