# Git history cleanup plan — remove large `.next` / build artifacts

Goal
---
Safely remove committed build artifacts (for example `.next/` or other large files) from repository history to reduce repo size and improve CI performance.

Overview
---
This document provides two safe approaches:

- Preferred: `git filter-repo` (fast, reliable, maintained). Works on Linux/macOS/Windows (requires Python and pip install).
- Alternative: BFG Repo Cleaner (Java-based). Simpler to use for common tasks.

Both approaches require a backup and coordinated force-push because this is a destructive rewrite of history. Follow the communication template below and require all contributors to re-clone or rebase after the rewrite.

Prerequisites
---
- Make a full backup of the repository (mirror clone) and optionally push to a temporary remote.
- Ensure you have admin rights to force-push to the target branch, or create a maintenance window.
- Notify all collaborators before proceeding.

Commands — Preparation (always do these first)
---
PowerShell (Windows) / Bash (Unix):

1) Create a local mirror backup (complete history):

```powershell
# from workspace root
git remote add backup <URL-to-backup-remote>   # optional: remote to push backup
git fetch --all --prune
# Create a bare mirror backup locally
git clone --mirror https://github.com/<owner>/<repo>.git ../sabiscore-backup.git
# (optional) push backup to another remote
cd ../sabiscore-backup.git
# git push --mirror <backup-remote-url>
```

2) Create working copy to run filter steps (safe):

```powershell
cd C:\Users\USR\Documents\SabiScore
git checkout --orphan cleanup-temp
git commit --allow-empty -m "temp root for cleanup"
git branch -M cleanup-temp
git checkout main
```

Method A — Using git-filter-repo (recommended)
---
Install:

```powershell
pip install --user git-filter-repo
# Ensure pip user bin is on PATH (Windows may need restart or add to PATH)
```

Dry-run: preview what would be removed (note: git-filter-repo doesn't have a built-in dry-run for everything, but you can test filtering to a clone):

```powershell
# Make a temporary clone
git clone --mirror . ../repo-temp-mirror.git
cd ../repo-temp-mirror.git
# Run the filter on the mirror (simulate by running on mirror copy)
git filter-repo --path .next --invert-paths --dry-run
# Note: if --dry-run is not available in your version, run on the temporary mirror without pushing to origin to inspect result.
```

Actual run (mirror):

```powershell
cd ../repo-temp-mirror.git
# Remove .next entirely from history
git filter-repo --invert-paths --path .next
# Inspect the repository to ensure objects removed and history rewritten
# When satisfied, push to remote (force)
git push --force --mirror origin
```

Important notes for git-filter-repo:
- Use the mirror clone approach above. That way you can safely inspect results before pushing.
- `--path` is relative to repo root. Use multiple `--path` flags to remove other directories.
- After pushing, all clones will need to be replaced (re-clone) or reset.

Method B — Using BFG Repo Cleaner (alternative)
---
Install (Java required):

```powershell
choco install bfg   # if using Chocolatey
# or download jar from https://rtyley.github.io/bfg-repo-cleaner/
```

Steps:

```powershell
# Create a bare clone
git clone --mirror https://github.com/<owner>/<repo>.git
cd <repo>.git
# Remove .next folder
bfg --delete-folders .next --delete-files '*.next' --no-blob-protection
# Clean and compact
git reflog expire --expire=now --all && git gc --prune=now --aggressive
# Push the cleaned mirror to origin
git push --force
```

Post-cleanup steps (must be communicated and enforced)
---
1) All contributors should delete their local clones and re-clone the repo.
2) If someone cannot re-clone, they can rebase their branches onto the new main with:

```powershell
# Save current work
git branch --show-current
git stash --include-untracked
# Rebase workflow
git fetch origin
git checkout main
git reset --hard origin/main
# Reapply changes (if needed)
```

3) Document the change in a repository `CLEANUP_NOTICE.md` and in the release notes. Include the date and affected branches.

Rollback plan
---
- If anything goes wrong, the mirror backup (created in preparation) can be restored by pushing it back to origin.
- Keep the backup for at least 30 days before deletion.

Communication template (PR/Issue/Email)
---
Subject: Planned repo history rewrite to remove large build artifacts (.next)

Hello team,

We found large committed build artifacts (e.g. `.next/`) inflating repository size and causing CI delays. We'll perform a controlled history rewrite to remove these files from Git history.

When: [date/time]
Impact:
- Branch history will be rewritten; affected branches will require re-cloning or a rebase.
- We will force-push cleaned branches to `origin/main`.

What you must do:
- Do not push changes from your local clones before the maintenance window ends.
- After the push, re-clone the repo or follow the instructions in `GIT_HISTORY_CLEANUP_PLAN.md` to rebase safely.

If you have active work in progress, please push it to a temporary branch or pause until after the maintenance window.

Questions? Reply here and tag @repo-admins

Acceptance criteria
---
- Large files removed from history.
- Repo size reduced and git clone is significantly smaller.
- CI runs faster and no regressions introduced.

---

If you'd like, I can prepare the exact commands for your current repo URL and create a PR that contains these instructions and a `CLEANUP_NOTICE.md` file. Tell me if you want me to proceed with generating the exact commands and a PR ready to be executed (I will not force-push without your confirmation).