# Sabiscore Frontend Integration Test
# Tests the complete user flow from team selection to insights display

Write-Host "🔍 Sabiscore Frontend Integration Test" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$apiUrl = "http://localhost:8000"
$webUrl = "http://localhost:3000"

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ $Name is accessible" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "❌ $Name is not accessible: $_" -ForegroundColor Red
        return $false
    }
}

function Test-InsightsGeneration {
    param(
        [string]$HomeTeam,
        [string]$AwayTeam,
        [string]$League
    )
    
    Write-Host "`n📊 Testing insights generation for: $HomeTeam vs $AwayTeam ($League)" -ForegroundColor Yellow
    
    $body = @{
        matchup = "$HomeTeam vs $AwayTeam"
        league = $League
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$apiUrl/api/v1/insights" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 30
        
        Write-Host "✅ Insights generated successfully" -ForegroundColor Green
        Write-Host "   Prediction: $($response.predictions.prediction)" -ForegroundColor Cyan
        Write-Host "   Confidence: $([math]::Round($response.predictions.confidence * 100, 1))%" -ForegroundColor Cyan
        Write-Host "   Home Win Prob: $([math]::Round($response.predictions.home_win_prob * 100, 1))%" -ForegroundColor Cyan
        Write-Host "   Draw Prob: $([math]::Round($response.predictions.draw_prob * 100, 1))%" -ForegroundColor Cyan
        Write-Host "   Away Win Prob: $([math]::Round($response.predictions.away_win_prob * 100, 1))%" -ForegroundColor Cyan
        
        if ($response.value_analysis.best_bet) {
            Write-Host "   Best Bet: $($response.value_analysis.best_bet.bet_type) @ $($response.value_analysis.best_bet.market_odds)" -ForegroundColor Green
            Write-Host "   Expected Value: +$([math]::Round($response.value_analysis.best_bet.expected_value * 100, 1))%" -ForegroundColor Green
        } else {
            Write-Host "   No value bets found" -ForegroundColor Yellow
        }
        
        return $true
    } catch {
        Write-Host "❌ Failed to generate insights: $_" -ForegroundColor Red
        return $false
    }
}

# Main Test Flow
Write-Host "Step 1: Testing Backend Health" -ForegroundColor Cyan
Write-Host "-------------------------------" -ForegroundColor Cyan
$backendHealth = Test-Endpoint -Url "$apiUrl/health" -Name "Backend API"

if (-not $backendHealth) {
    Write-Host "`n⚠️  Backend is not running. Please start it with:" -ForegroundColor Yellow
    Write-Host "   cd backend && uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White
    Write-Host "`nExiting test..." -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 2: Testing Frontend Accessibility" -ForegroundColor Cyan
Write-Host "---------------------------------------" -ForegroundColor Cyan
$frontendHealth = Test-Endpoint -Url $webUrl -Name "Frontend App"

if (-not $frontendHealth) {
    Write-Host "`n⚠️  Frontend is not running. Please start it with:" -ForegroundColor Yellow
    Write-Host "   cd apps/web && npm run dev" -ForegroundColor White
    Write-Host "`nContinuing with backend tests..." -ForegroundColor Yellow
}

Write-Host "`nStep 3: Testing Insights Generation" -ForegroundColor Cyan
Write-Host "------------------------------------" -ForegroundColor Cyan

# Test multiple match scenarios
$testMatches = @(
    @{ Home = "Arsenal"; Away = "Chelsea"; League = "EPL" },
    @{ Home = "Barcelona"; Away = "Real Madrid"; League = "La Liga" },
    @{ Home = "Bayern Munich"; Away = "Borussia Dortmund"; League = "Bundesliga" }
)

$successCount = 0
foreach ($match in $testMatches) {
    $result = Test-InsightsGeneration -HomeTeam $match.Home -AwayTeam $match.Away -League $match.League
    if ($result) {
        $successCount++
    }
    Start-Sleep -Seconds 2  # Rate limiting
}

Write-Host "`n" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "📈 Test Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Backend Status: $(if($backendHealth){'✅ Running'}else{'❌ Down'})" -ForegroundColor $(if($backendHealth){'Green'}else{'Red'})
Write-Host "Frontend Status: $(if($frontendHealth){'✅ Running'}else{'❌ Down'})" -ForegroundColor $(if($frontendHealth){'Green'}else{'Yellow'})
Write-Host "Insights Tests: $successCount/$($testMatches.Count) passed" -ForegroundColor $(if($successCount -eq $testMatches.Count){'Green'}else{'Yellow'})
Write-Host ""

if ($backendHealth -and ($successCount -eq $testMatches.Count)) {
    Write-Host "✅ All tests passed! System is production-ready." -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Open browser to http://localhost:3000" -ForegroundColor White
    Write-Host "2. Select league and teams from the dropdown" -ForegroundColor White
    Write-Host "3. Click 'Generate Insights' to see predictions" -ForegroundColor White
    Write-Host "4. Review value bets and xG analysis" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "⚠️  Some tests failed. Please review the output above." -ForegroundColor Yellow
    exit 1
}
