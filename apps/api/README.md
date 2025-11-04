# Sabiscore API (FastAPI Backend)

This is a symbolic link to the main backend directory.

The actual FastAPI application lives in `../../backend/src/api/`

## Development

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r ../../backend/requirements.txt
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

## Production

```bash
docker-compose -f ../../docker-compose.prod.yml up api
```
