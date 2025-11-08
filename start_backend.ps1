<#
PowerShell helper to start the backend from the repository root.
Usage: From repository root run `.\start_backend.ps1`
This script will:
 - cd into the `backend` folder
 - ensure PYTHONPATH includes the backend path so `src.*` imports work
 - launch uvicorn via `python -m uvicorn` (uses current Python in PATH)
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendPath = Join-Path $ScriptDir 'backend'

if (-not (Test-Path $BackendPath)) {
    Write-Error "Expected backend folder not found at $BackendPath"
    exit 1
}

# Change to backend directory
Push-Location -Path $BackendPath

# Ensure PYTHONPATH includes the backend package so `src` package is importable
if ($env:PYTHONPATH) {
    if ($env:PYTHONPATH -notlike "*$BackendPath*") {
        $env:PYTHONPATH = "$BackendPath;$env:PYTHONPATH"
    }
} else {
    $env:PYTHONPATH = $BackendPath
}

Write-Host "Starting backend from: $BackendPath"
Write-Host "PYTHONPATH=$env:PYTHONPATH"

# Use python -m uvicorn to ensure it uses the same interpreter
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Restore original location
Pop-Location
