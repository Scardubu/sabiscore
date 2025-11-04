# SabiScore Development Startup Script - Enhanced Version
# This script starts both frontend and backend services with better error handling

param(
    [switch]$Frontend,
    [switch]$Backend,
    [switch]$All = $true
)

# Function to test if a port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

function Start-Backend {
    Write-Host "🚀 Starting SabiScore Backend..." -ForegroundColor Green
    
    # Check if backend is already running
    if (Test-Port 8000) {
        Write-Host "✅ Backend already running on port 8000" -ForegroundColor Green
        return $true
    }
    
    # Navigate to backend directory
    Push-Location "$PSScriptRoot\backend"
    
    try {
        # Set Python path
        $env:PYTHONPATH = $PWD
        
        # Check if uvicorn is available
        try {
            python -c "import uvicorn" 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "📥 Installing backend dependencies..." -ForegroundColor Yellow
                pip install -r requirements.txt
            }
        } catch {
            Write-Host "📥 Installing backend dependencies..." -ForegroundColor Yellow
            pip install -r requirements.txt
        }
        
        Write-Host "🌟 Backend server starting on http://localhost:8000..." -ForegroundColor Cyan
        Write-Host "📚 API documentation: http://localhost:8000/docs" -ForegroundColor Gray
        
        # Start the server
        python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
        
    } catch {
        Write-Host "❌ Failed to start backend: $_" -ForegroundColor Red
        return $false
    } finally {
        Pop-Location
    }
}
        $uvicornCheck = python -m uvicorn --help 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: uvicorn not found. Please install it with: pip install uvicorn" -ForegroundColor Red
            return
        }
        
        # Start the backend server
        Write-Host "Backend starting on http://localhost:8000" -ForegroundColor Cyan
        python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
    }
    catch {
        Write-Host "Error starting backend: $_" -ForegroundColor Red
    }
    finally {
        Pop-Location
    }
}

function Start-Frontend {
    Write-Host "Starting SabiScore Frontend..." -ForegroundColor Green
    
    # Navigate to frontend directory
    Push-Location "$PSScriptRoot\frontend"
    
    try {
        # Check if node_modules exists
        if (!(Test-Path "node_modules")) {
            Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
            npm install
        }
        
        # Start the frontend server
        Write-Host "Frontend starting on http://localhost:3000" -ForegroundColor Cyan
        npm run dev
    }
    catch {
        Write-Host "Error starting frontend: $_" -ForegroundColor Red
    }
    finally {
        Pop-Location
    }
}

function Start-All {
    Write-Host "Starting SabiScore Full Stack Application..." -ForegroundColor Magenta
    Write-Host "=========================================" -ForegroundColor Magenta
    
    # Start backend in background
    Write-Host "1. Starting Backend..." -ForegroundColor Green
    Start-Job -Name "SabiScore-Backend" -ScriptBlock {
        Set-Location $using:PSScriptRoot
        & "$using:PSScriptRoot\start_backend_fixed.ps1"
    }
    
    # Wait a moment for backend to start
    Start-Sleep -Seconds 3
    
    # Start frontend
    Write-Host "2. Starting Frontend..." -ForegroundColor Green
    Start-Frontend
}

# Main execution
if ($Backend) {
    Start-Backend
} elseif ($Frontend) {
    Start-Frontend
} else {
    Start-All
}

Write-Host "To stop background jobs, run: Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Yellow