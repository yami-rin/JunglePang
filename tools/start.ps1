$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodePath = $nodeCommand.Source
} else {
    $nodeCandidates = @(Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS*\node-*-win-x64\node.exe" -ErrorAction SilentlyContinue)
    if ($nodeCandidates.Count -eq 0) { throw 'Node.js LTS is required: https://nodejs.org/' }
    $nodePath = ($nodeCandidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}
$env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
$npmPath = Join-Path (Split-Path -Parent $nodePath) 'npm.cmd'
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\index.html'))) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
        & $npmPath ci --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    }
    & $npmPath run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}
$serverPort = if ($env:PORT) { $env:PORT } else { '5177' }
Write-Host "Open http://localhost:$serverPort/ in your browser."
& $nodePath (Join-Path $PSScriptRoot 'serve.mjs')
exit $LASTEXITCODE
