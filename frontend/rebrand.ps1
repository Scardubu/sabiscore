# SABISCORE Rebrand - Global Find & Replace Script
# Replaces old branding references with new SABISCORE identity
# Run from: frontend/ directory

Write-Host "SABISCORE Rebrand Script - Starting..." -ForegroundColor Cyan
Write-Host ""

$rootPath = $PSScriptRoot
$totalReplacements = 0

# Simple replacements
$files = Get-ChildItem -Path "$rootPath\src" -Recurse -Include *.html,*.tsx,*.ts,*.jsx,*.js -File -ErrorAction SilentlyContinue

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
    
    if ($content) {
        $modified = $false
        
        if ($content -like "*SabiScore Intelligence Hub*") {
            $content = $content -replace "SabiScore Intelligence Hub", "SABISCORE"
            $modified = $true
            Write-Host "  Updated: $($file.Name)" -ForegroundColor Green
            $totalReplacements++
        }
        
        if ($content -like "*Loading SabiScore...*") {
            $content = $content -replace "Loading SabiScore\.\.\.", "Loading SABISCORE..."
            $modified = $true
            Write-Host "  Updated: $($file.Name)" -ForegroundColor Green
            $totalReplacements++
        }
        
        if ($modified) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
        }
    }
}

Write-Host ""
Write-Host "Rebrand Complete!" -ForegroundColor Green
Write-Host "Replacements Made: $totalReplacements" -ForegroundColor White
Write-Host ""
