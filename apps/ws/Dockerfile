FROM python:3.11-slim AS base
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Production stage referenced by docker-compose.prod.yml (target: production).
# Port aligned to compose WS_PORT=8001; CMD honors the env override.
FROM base AS production
ENV WS_PORT=8001
EXPOSE 8001
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${WS_PORT:-8001}"]
