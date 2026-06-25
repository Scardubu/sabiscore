# Load Testing Script for SabiScore 3.0
# Tests system performance under load

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SabiScore 3.0 Load Testing            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$API_URL = $env:NEXT_PUBLIC_API_URL
$NUM_REQUESTS = 100
$CONCURRENT_REQUESTS = 10

if (!$API_URL) {
    Write-Host "Error: NEXT_PUBLIC_API_URL not set" -ForegroundColor Red
    exit 1
}

Write-Host "Target: $API_URL" -ForegroundColor Cyan
Write-Host "Total Requests: $NUM_REQUESTS" -ForegroundColor Cyan
Write-Host "Concurrent: $CONCURRENT_REQUESTS" -ForegroundColor Cyan
Write-Host ""

# Test data
$testPayload = @{
    homeTeam = "Manchester City"
    awayTeam = "Liverpool"
    homeForm = @(1, 1, 0, 1, 1)
    awayForm = @(1, 0, 1, 1, 0)
    homeXg = 2.1
    awayXg = 1.8
    league = "Premier League"
    venue = "Home"
    weather = "Clear"
} | ConvertTo-Json

# Results tracking
$results = @{
    successful = 0
    failed = 0
    totalTime = 0
    times = @()
}

Write-Host "Starting load test..." -ForegroundColor Yellow
$startTime = Get-Date

# Create job pool
$jobs = @()

for ($i = 0; $i -lt $NUM_REQUESTS; $i++) {
    # Wait if too many concurrent jobs
    while (($jobs | Where-Object { $_.State -eq 'Running' }).Count -ge $CONCURRENT_REQUESTS) {
        Start-Sleep -Milliseconds 100
        
        # Collect completed jobs
        $completed = $jobs | Where-Object { $_.State -eq 'Completed' }
        foreach ($job in $completed) {
            $result = Receive-Job $job
            Remove-Job $job
            $jobs = $jobs | Where-Object { $_.Id -ne $job.Id }
            
            if ($result.Success) {
                $results.successful++
                $results.times += $result.Duration
            } else {
                $results.failed++
            }
        }
    }
    
    # Start new job
    $job = Start-Job -ScriptBlock {
        param($url, $payload)
        
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        
        try {
            $response = Invoke-WebRequest -Uri "$url/api/predict" -Method POST `
                -Body $payload -ContentType "application/json" -TimeoutSec 30
            
            $sw.Stop()
            
            return @{
                Success = $response.StatusCode -eq 200
                Duration = $sw.ElapsedMilliseconds
            }
        } catch {
            $sw.Stop()
            return @{
                Success = $false
                Duration = $sw.ElapsedMilliseconds
            }
        }
    } -ArgumentList $API_URL, $testPayload
    
    $jobs += $job
    
    # Progress indicator
    if (($i + 1) % 10 -eq 0) {
        Write-Host "." -NoNewline -ForegroundColor Yellow
    }
}

# Wait for remaining jobs
Write-Host ""
Write-Host "Waiting for remaining requests..." -ForegroundColor Yellow

$jobs | Wait-Job | ForEach-Object {
    $result = Receive-Job $_
    Remove-Job $_
    
    if ($result.Success) {
        $results.successful++
        $results.times += $result.Duration
    } else {
        $results.failed++
    }
}

$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalSeconds

# Calculate statistics
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Load Test Results                    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Total Requests: $NUM_REQUESTS" -ForegroundColor White
Write-Host "Successful: $($results.successful)" -ForegroundColor Green
Write-Host "Failed: $($results.failed)" -ForegroundColor $(if ($results.failed -gt 0) { "Red" } else { "Green" })
Write-Host "Success Rate: $([math]::Round(($results.successful / $NUM_REQUESTS) * 100, 2))%" -ForegroundColor Cyan
Write-Host ""

Write-Host "Total Duration: $([math]::Round($totalDuration, 2))s" -ForegroundColor White
Write-Host "Requests/sec: $([math]::Round($NUM_REQUESTS / $totalDuration, 2))" -ForegroundColor Cyan
Write-Host ""

if ($results.times.Count -gt 0) {
    $sortedTimes = $results.times | Sort-Object
    $avgTime = ($sortedTimes | Measure-Object -Average).Average
    $minTime = $sortedTimes[0]
    $maxTime = $sortedTimes[-1]
    $p50 = $sortedTimes[[math]::Floor($sortedTimes.Count * 0.5)]
    $p95 = $sortedTimes[[math]::Floor($sortedTimes.Count * 0.95)]
    $p99 = $sortedTimes[[math]::Floor($sortedTimes.Count * 0.99)]
    
    Write-Host "Response Times (ms):" -ForegroundColor Yellow
    Write-Host "  Min: $minTime" -ForegroundColor White
    Write-Host "  Avg: $([math]::Round($avgTime, 2))" -ForegroundColor White
    Write-Host "  Max: $maxTime" -ForegroundColor White
    Write-Host "  P50: $p50" -ForegroundColor Cyan
    Write-Host "  P95: $p95" -ForegroundColor Cyan
    Write-Host "  P99: $p99" -ForegroundColor Cyan
}

Write-Host ""

# Performance assessment
if ($results.failed -eq 0 -and $avgTime -lt 2000) {
    Write-Host "PASS: System performing well under load" -ForegroundColor Green
} elseif ($results.failed -gt 0 -or $avgTime -gt 5000) {
    Write-Host "FAIL: Performance issues detected" -ForegroundColor Red
} else {
    Write-Host "WARNING: Performance acceptable but could be improved" -ForegroundColor Yellow
}

Write-Host ""
