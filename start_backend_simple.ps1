# Start SabiScore Backend
Write-Host "Starting SabiScore Backend..." -ForegroundColor Green

# Set working directory
Set-Location "c:\Users\USR\Documents\SabiScore"

# Set environment variables
$env:PYTHONPATH = "c:\Users\USR\Documents\SabiScore"
$env:DATABASE_URL = "sqlite:///./backend/sabiscore.db"

# Kill any existing Python processes on port 8000
try {
    $process = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue |  
        Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped existing process on port 8000" -ForegroundColor Yellow
    }
} catch {
    # Port not in use
}

# Start the backend
Write-Host "Starting Uvicorn server on http://0.0.0.0:8000" -ForegroundColor Cyan
python -m uvicorn backend.src.api.main:app --host 0.0.0.0 --port 8000
