# Test Prediction Flow
# Runs end-to-end tests for the complete prediction pipeline

Write-Host "🧪 SabiScore 3.0 - E2E Test Runner" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Check if server is running
$serverUrl = "http://localhost:3000"
Write-Host "Checking if dev server is running at $serverUrl..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$serverUrl/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the dev server first:" -ForegroundColor Yellow
    Write-Host "  npm run dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use this command to start and test:" -ForegroundColor Yellow
    Write-Host "  npm run dev & Start-Sleep -Seconds 5; npm run test:e2e" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "Running end-to-end tests..." -ForegroundColor Yellow
Write-Host ""

# Run the test script using tsx (TypeScript execution)
npx tsx test-prediction-flow.ts

# Capture exit code
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Some tests failed" -ForegroundColor Red
}

Write-Host ""
exit $exitCode
