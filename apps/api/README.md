# Legacy API Folder

`apps/api` is legacy-only and is not a production deployment target.

The canonical FastAPI application lives at:

```text
backend/src/api/main.py
```

Use:

```bash
cd backend
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

Production scripts, deploy configuration, and documentation should reference `backend/`, not `apps/api`.
