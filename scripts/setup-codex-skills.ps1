$ErrorActionPreference = "Stop"

try {
    $root = (git rev-parse --show-toplevel).Trim()
} catch {
    $root = (Get-Location).Path
}

$source = Join-Path $root ".ai\skills"
$parent = Join-Path $root ".agents"
$dest = Join-Path $parent "skills"

if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Canonical skill directory not found: $source"
}

New-Item -ItemType Directory -Force -Path $parent | Out-Null

if (Test-Path -LiteralPath $dest) {
    throw "$dest already exists. Back it up or remove it before creating the Codex junction."
}

New-Item -ItemType Junction -Path $dest -Target $source | Out-Null
Write-Host "Created Codex skill junction: $dest -> $source"
Write-Host "Restart Codex/VS Code if /skills does not refresh automatically."
