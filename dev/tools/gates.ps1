# LIES 248.2 port static gates.
# Run from the repo root or anywhere; writes dev/reports/static-gates.md.

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Workspace = (Resolve-Path (Join-Path $RepoRoot '..\..')).Path
$Luajit = Join-Path $Workspace 'tools\luajit\luajit.exe'
$ReportDir = Join-Path $RepoRoot 'dev\reports'
$Report = Join-Path $ReportDir 'static-gates.md'
New-Item -ItemType Directory -Force $ReportDir | Out-Null

$lines = @()
$lines += '# LIES 248.2 static gates'
$lines += ''
$lines += ('Generated: ' + (Get-Date).ToString('u'))
$lines += ''
$failed = $false

function Add-Section([string]$Title, [string]$Body, [bool]$Ok) {
    $script:lines += "## $Title"
    $script:lines += ''
    $script:lines += ('Result: ' + ($(if ($Ok) { 'PASS' } else { 'FAIL' })))
    $script:lines += ''
    if ($Body) { $script:lines += $Body; $script:lines += '' }
    if (-not $Ok) { $script:failed = $true }
}

# Node tests
$testFiles = @(Get-ChildItem (Join-Path $RepoRoot 'dev\tools\test') -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)
$nodeOut = & node --test $testFiles 2>&1 | Out-String
$nodeOk = $LASTEXITCODE -eq 0
$nodeSummary = (($nodeOut -split "`n") | Where-Object { $_.Trim() } | Select-Object -Last 6) -join "`n"
Add-Section 'Node tool tests' $nodeSummary $nodeOk

# Lua parser test
$luaTest = Join-Path $RepoRoot 'dev\test-harness\test\test_commands.lua'
$luaOut = & $Luajit $luaTest 2>&1 | Out-String
$luaOk = $LASTEXITCODE -eq 0
Add-Section 'Test-harness parser' $luaOut.Trim() $luaOk

# LuaJIT compile all runtime Lua
$luaFiles = @(Get-ChildItem $RepoRoot -Recurse -Filter '*.lua' | Where-Object { $_.FullName -notmatch '\\dev\\' -and $_.FullName -notmatch '\\dist\\' })
$compileFailures = @()
foreach ($file in $luaFiles) {
    & $Luajit -bl $file.FullName > $null 2>&1
    if ($LASTEXITCODE -ne 0) { $compileFailures += $file.FullName.Substring($RepoRoot.Length + 1) }
}
$compileBody = "Files: $($luaFiles.Count)`nFailures: $($compileFailures.Count)"
if ($compileFailures.Count) { $compileBody += "`n" + ($compileFailures -join "`n") }
Add-Section 'LuaJIT syntax (runtime files)' $compileBody ($compileFailures.Count -eq 0)

# Regenerate ledger + audit
$ledgerOut = & node (Join-Path $RepoRoot 'dev\tools\fn-ledger.mjs') --mod $RepoRoot --out (Join-Path $ReportDir '..\port-248-ledger.md') --json (Join-Path $ReportDir 'port-248-ledger.json') 2>&1 | Out-String
$ledgerOk = $LASTEXITCODE -eq 0
Add-Section 'Function ledger' $ledgerOut.Trim() $ledgerOk

$auditOut = & node (Join-Path $RepoRoot 'dev\tools\api-audit.mjs') --mod $RepoRoot --out (Join-Path $ReportDir 'api-audit.md') --json (Join-Path $ReportDir 'api-audit.json') 2>&1 | Out-String
$auditOk = $LASTEXITCODE -eq 0
Add-Section 'API audit' $auditOut.Trim() $auditOk

$lines | Set-Content -LiteralPath $Report -Encoding utf8
Write-Host ("wrote " + $Report)
if ($failed) { exit 1 }
