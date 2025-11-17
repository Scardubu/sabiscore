How to run the backend locally

PowerShell (Windows)

1. From repository root (recommended):

```powershell
# helper created in repo root
.\start_backend.ps1
```

2. Manual (from `backend` folder):

```powershell
cd backend
$env:PYTHONPATH = "$PWD"
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

POSIX / macOS / Linux

```bash
# from repo root
cd backend
export PYTHONPATH="$PWD"
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

Notes

- The backend uses package imports like `src.api.main`, so your working directory or PYTHONPATH must include the `backend` folder.
- Use a virtual environment with the project's required packages installed (see `requirements.txt` or project docs).
- Health endpoint: `GET /api/v1/health` will show `model_loading` and `model_error` fields to help diagnose model warmup problems.
