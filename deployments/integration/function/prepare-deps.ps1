param(
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$depsProject = Join-Path $root 'deps.csproj'
$publishDir = Join-Path $root '.deps_publish'
$binDir = Join-Path $root 'bin'

if (-not (Test-Path $depsProject)) {
    throw "Dependency project not found: $depsProject"
}

Write-Host "Preparing Function dependencies (publishing $depsProject)..." -ForegroundColor Cyan

if (Test-Path $publishDir) {
    Remove-Item $publishDir -Recurse -Force
}

# Publish a 'dummy' project just to materialize NuGet DLLs.
# We copy the resulting DLLs into wwwroot/bin so C# scripts can reference them.
dotnet publish $depsProject -c $Configuration -o $publishDir | Out-Null

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir | Out-Null
}

# Copy all published files (including runtimes/ folder) into bin.
Copy-Item -Path "$publishDir\*" -Destination $binDir -Recurse -Force

Write-Host "Dependencies copied to: $binDir" -ForegroundColor Green
