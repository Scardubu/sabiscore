# SabiScore 3.0 - Environment Setup Guide
# Use this script to validate and configure environment variables

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SabiScore 3.0 Environment Setup      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Required environment variables
$required = @{
    "NEXT_PUBLIC_API_URL" = "Frontend URL (e.g., https://sabiscore.vercel.app)"
    "KV_REST_API_URL" = "Vercel KV Redis REST API URL"
    "KV_REST_API_TOKEN" = "Vercel KV Redis authentication token"
    "DATABASE_URL" = "PostgreSQL connection string"
    "KV_REST_API_READ_ONLY_TOKEN" = "Vercel KV read-only token (optional)"
}

# Optional environment variables
$optional = @{
    "REDIS_URL" = "Redis Cloud connection URL (production)"
    "NEXT_PUBLIC_ENABLE_ANALYTICS" = "Enable analytics (true/false)"
    "VERCEL_PROJECT_ID" = "Vercel project ID for deployments"
    "VERCEL_ORG_ID" = "Vercel organization ID"
}

Write-Host "Checking required environment variables..." -ForegroundColor Yellow
Write-Host ""

$missing = @()
$configured = @()

foreach ($var in $required.Keys) {
    $value = [Environment]::GetEnvironmentVariable($var)
    
    if ($value) {
        Write-Host "[OK] $var" -ForegroundColor Green
        $configured += $var
        
        # Show masked value
        if ($var -like "*TOKEN*" -or $var -like "*PASSWORD*" -or $var -like "*SECRET*") {
            $masked = $value.Substring(0, [Math]::Min(10, $value.Length)) + "..."
            Write-Host "     Value: $masked" -ForegroundColor Gray
        } else {
            Write-Host "     Value: $value" -ForegroundColor Gray
        }
    } else {
        Write-Host "[MISSING] $var" -ForegroundColor Red
        Write-Host "          Description: $($required[$var])" -ForegroundColor Gray
        $missing += $var
    }
    Write-Host ""
}

Write-Host "Checking optional environment variables..." -ForegroundColor Yellow
Write-Host ""

foreach ($var in $optional.Keys) {
    $value = [Environment]::GetEnvironmentVariable($var)
    
    if ($value) {
        Write-Host "[OK] $var" -ForegroundColor Green
        Write-Host "     Description: $($optional[$var])" -ForegroundColor Gray
    } else {
        Write-Host "[NOT SET] $var" -ForegroundColor Yellow
        Write-Host "          Description: $($optional[$var])" -ForegroundColor Gray
    }
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Required: $($configured.Count)/$($required.Count) configured" -ForegroundColor $(if ($missing.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host "Optional: $($optional.Keys | Where-Object { [Environment]::GetEnvironmentVariable($_) }).Count/$($optional.Count) configured" -ForegroundColor Cyan
Write-Host ""

if ($missing.Count -gt 0) {
    Write-Host "Missing variables:" -ForegroundColor Red
    foreach ($var in $missing) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "To set environment variables:" -ForegroundColor Yellow
    Write-Host "  1. Create a .env.local file in the project root" -ForegroundColor White
    Write-Host "  2. Add each variable in the format: VAR_NAME=value" -ForegroundColor White
    Write-Host "  3. Or set system environment variables using:" -ForegroundColor White
    Write-Host "     [Environment]::SetEnvironmentVariable('VAR_NAME', 'value', 'User')" -ForegroundColor Gray
    Write-Host ""
    
    # Offer to create .env.local template
    $create = Read-Host "Create .env.local template? (y/n)"
    if ($create -eq 'y') {
        $template = @"
# SabiScore 3.0 Environment Configuration
# Copy this file to .env.local and fill in your values

# Required Variables
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app
KV_REST_API_URL=https://your-kv-instance.kv.vercel-storage.com
KV_REST_API_TOKEN=your-kv-token
DATABASE_URL=postgresql://user:password@host:port/database

# Optional Variables
REDIS_URL=redis://default:password@host:port
NEXT_PUBLIC_ENABLE_ANALYTICS=false
VERCEL_PROJECT_ID=your-project-id
VERCEL_ORG_ID=your-org-id
"@
        
        $template | Out-File -FilePath ".env.local.template" -Encoding UTF8
        Write-Host ""
        Write-Host "Template created: .env.local.template" -ForegroundColor Green
        Write-Host "Rename to .env.local and fill in your values" -ForegroundColor Green
    }
} else {
    Write-Host "All required environment variables are configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Run: npm install" -ForegroundColor White
    Write-Host "  2. Run: npm run dev" -ForegroundColor White
    Write-Host "  3. Visit: http://localhost:3000" -ForegroundColor White
}

Write-Host ""
