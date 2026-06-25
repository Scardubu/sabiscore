# Requires PowerShell 7+.
# Execute with: pwsh -File scripts/start-platform.ps1 [options]

param(
    [switch]$Detached,
    [switch]$Rebuild,
    [switch]$SeedData,
    [switch]$FollowLogs,
    [int]$StartupTimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-WarningMessage {
    param([string]$Message)
    Write-Warning "[WARN] $Message"
}

function Write-ErrorMessage {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Resolve repository root based on script location
$scriptPath = Split-Path -Parent (Resolve-Path $MyInvocation.MyCommand.Path)
$repoRoot = Resolve-Path (Join-Path $scriptPath '..')
Set-Location $repoRoot

Write-Info "Starting SabiScore platform from $repoRoot"

# Ensure docker is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ErrorMessage "Docker CLI not found. Install Docker Desktop and ensure 'docker' is on PATH."
    exit 1
}

# Determine docker compose invocation
$composePrefix = @()
$composeDetected = $false
try {
    docker compose version | Out-Null
    $composeDetected = $true
} catch {
    $composeDetected = $false
}

if ($composeDetected) {
    $composeCommand = 'docker'
    $composePrefix = @('compose')
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $composeCommand = 'docker-compose'
} else {
    Write-ErrorMessage "Neither 'docker compose' nor 'docker-compose' is available."
    exit 1
}

function Invoke-Compose {
    param([string[]]$ComposeArgs)
    if ($composeCommand -eq 'docker') {
        & $composeCommand @($composePrefix + $ComposeArgs)
    } else {
        & $composeCommand @ComposeArgs
    }
}

# Validate compose file
$composeFile = Join-Path $repoRoot 'docker-compose.yml'
if (-not (Test-Path $composeFile)) {
    Write-ErrorMessage "docker-compose.yml not found at $composeFile"
    exit 1
}

# Warn if .env missing
$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path $envFile)) {
    Write-WarningMessage "No .env file detected. Using defaults baked into docker-compose.yml"
}

# Ensure models directory exists
$modelsDir = Join-Path $repoRoot 'models'
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir | Out-Null
    Write-Info "Created models directory at $modelsDir"
}

# Build compose arguments
$composeArgs = @('up')
if ($Detached.IsPresent) {
    $composeArgs += '-d'
}
if ($Rebuild.IsPresent) {
    $composeArgs += '--build'
}
$composeArgs += '--remove-orphans'

Write-Info "Launching services via docker compose..."
Invoke-Compose $composeArgs
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMessage "docker compose up failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Wait for backend health if timeout specified
if ($StartupTimeoutSeconds -gt 0) {
    $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    $healthUrl = 'http://localhost:8000/api/v1/health'
    Write-Info "Waiting for backend health endpoint $healthUrl"
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                $healthy = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 5
        }
    }
    if ($healthy) {
        Write-Info "Backend reported healthy."
    } else {
        Write-WarningMessage "Backend health endpoint did not report 200 within $StartupTimeoutSeconds seconds."
    }
}

# Optionally seed database
if ($SeedData.IsPresent) {
    Write-Info "Seeding database with sample data"
    Invoke-Compose @('exec', 'backend', 'python', 'scripts/init_db.py')
    if ($LASTEXITCODE -ne 0) {
        Write-WarningMessage "Database initialization returned exit code $LASTEXITCODE"
    }
    Invoke-Compose @('exec', 'backend', 'python', 'scripts/populate_db.py')
    if ($LASTEXITCODE -ne 0) {
        Write-WarningMessage "Database population returned exit code $LASTEXITCODE"
    }
}

# Optionally follow logs
if ($FollowLogs.IsPresent -and -not $Detached.IsPresent) {
    Write-Info "Following compose logs (Ctrl+C to detach)"
    Invoke-Compose @('logs', '--tail', '100', '--follow')
}

Write-Host ""  # spacing
Write-Info "SabiScore platform started successfully."
Write-Host "Backend API:    http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend SPA:   http://localhost:3000" -ForegroundColor Green
Write-Host "Stop services:  run 'docker compose down' from repo root" -ForegroundColor Yellow
