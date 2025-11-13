param(
    [string]$BaseUrl = "https://sabiscore.vercel.app"
)

Write-Host ""
Write-Host "Smoke testing Vercel frontend: $BaseUrl" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Path,
        [string]$Description
    )
    
    $url = "$BaseUrl$Path"
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq 200) {
            Write-Host "OK $Description ($Path): $statusCode" -ForegroundColor Green
            $script:passed++
            return @{ success = $true; status = $statusCode }
        } else {
            Write-Host "FAIL $Description ($Path): $statusCode" -ForegroundColor Red
            $script:failed++
            return @{ success = $false; status = $statusCode }
        }
    } catch {
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
        Write-Host "FAIL $Description ($Path): $statusCode" -ForegroundColor Red
        $script:failed++
        return @{ success = $false; status = $statusCode }
    }
}

Write-Host "Testing Routes..." -ForegroundColor Yellow
Test-Endpoint "/" "Homepage"
Test-Endpoint "/favicon.ico" "Favicon"
Test-Endpoint "/icon" "Dynamic Icon"

Write-Host ""
Write-Host "Testing API Proxy..." -ForegroundColor Yellow
Test-Endpoint "/api/v1/matches/upcoming" "API Proxy"

Write-Host ""
Write-Host "Tests Passed: $passed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
Write-Host "Tests Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failed -gt 0) {
    exit 1
}

exit 0
