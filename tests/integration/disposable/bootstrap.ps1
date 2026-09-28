param([switch]$Execute, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$manifest = Get-Content (Join-Path $repo 'tests/fixtures/applied-migrations-001-007.json') -Raw | ConvertFrom-Json
$files = @($manifest.PSObject.Properties | Sort-Object Name)
if ($files.Count -ne 7) { throw 'Expected exactly seven immutable migrations.' }
$rawHashes = @{}
foreach ($entry in $files) {
    if ($entry.Name -notmatch '^supabase/migrations/\d{9}00[1-7]_[a-z_]+\.sql$') { throw 'Unexpected migration allowlist entry.' }
    $path = Join-Path $repo $entry.Name
    $bytes = [Text.Encoding]::UTF8.GetBytes([IO.File]::ReadAllText($path).Replace("`r`n", "`n"))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
    if ($hash -cne $entry.Value) { throw "Immutable fingerprint mismatch: $($entry.Name)" }
    $rawHashes[$entry.Name] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
Write-Output 'IMMUTABLE FINGERPRINTS 001-007: PASS'
if ($CheckOnly) { return }
if (-not $Execute) { throw 'Explicit -Execute is required; creates a NEW disposable local stack.' }
# Never inherit application, remote CLI, Docker override, or PostgreSQL connection settings.
$blocked = @(Get-ChildItem Env: | Where-Object { $_.Name -match '^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|PG|DATABASE_URL$|DOCKER_HOST$|DOCKER_CONTEXT$|DOCKER_TLS)' })
if ($blocked.Count) { throw 'Connection-related environment variables present. Use a clean terminal; values were not read or printed.' }
$requiredPorts = @(56320, 56321, 56322, 56324, 56325, 56326)
$unavailablePorts = @()
foreach ($port in $requiredPorts) {
    $probe = $null
    try {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
        $probe.Start()
    } catch {
        $unavailablePorts += $port
    } finally {
        if ($null -ne $probe) { $probe.Stop() }
    }
}
if ($unavailablePorts.Count) {
    throw "Required disposable TCP ports are occupied or unavailable: $($unavailablePorts -join ', '). No process or container was stopped."
}
$endpoint = (& docker context inspect --format '{{.Endpoints.docker.Host}}' 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $endpoint -notmatch '^npipe:/+\./pipe/dockerDesktopLinuxEngine$') { throw 'Only the local Docker Desktop Linux named pipe is supported.' }
$project = 'simkb-disposable-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
$workspace = Join-Path ([IO.Path]::GetTempPath()) $project
if (Test-Path -LiteralPath $workspace) { throw 'Workspace already exists.' }
$created = [DateTime]::UtcNow
[void][IO.Directory]::CreateDirectory((Join-Path $workspace 'supabase'))
[IO.File]::WriteAllText((Join-Path $workspace 'disposable-owner.txt'), $project)
$config = @"
project_id = "$project"
[api]
enabled = true
port = 56321
[db]
port = 56322
shadow_port = 56320
major_version = 17
[db.migrations]
enabled = false
[db.seed]
enabled = false
[studio]
enabled = false
[local_smtp]
enabled = true
port = 56324
smtp_port = 56325
pop3_port = 56326
[analytics]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
[storage]
enabled = true
"@
[IO.File]::WriteAllText((Join-Path $workspace 'supabase/config.toml'), $config)
function Assert-Workspace {
    if ([IO.File]::ReadAllText((Join-Path $workspace 'disposable-owner.txt')) -cne $project) { throw 'Disposable ownership marker mismatch.' }
    if ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/config.toml')) -cne $config) { throw 'Isolated configuration changed.' }
    foreach ($name in @('.env','supabase/.env','supabase/.temp/project-ref','supabase/migrations','supabase/seed.sql')) {
        if (Test-Path -LiteralPath (Join-Path $workspace $name)) { throw 'Unexpected linked, migration, seed or environment state.' }
    }
    if ($config.Contains('lyjkujvuadykpncwwuqb') -or $config.Contains('supabase.co')) { throw 'Remote target rejected.' }
}
Assert-Workspace
# CLI output includes local keys: capture in memory, never emit or persist it.
Write-Output "Starting fresh isolated Supabase stack: $project"
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$cliOutput = & npx.cmd --yes supabase@2.118.0 start --workdir $workspace 2>&1
$cliExit = $LASTEXITCODE
$ErrorActionPreference = $oldPreference
if ($cliExit -ne 0) {
    $diagnostic = (($cliOutput | ForEach-Object { [string]$_ }) -join "`n") -replace "`e\[[0-9;]*m", ''
    $lines = @($diagnostic -split "`r?`n" | Where-Object { $_ -match '(?i)(error|failed|failure|unable|cannot|port|bind|docker|daemon|invalid|permission|timed out|timeout|pull|network|config)' } | Select-Object -First 8)
    if (-not $lines.Count) { $lines = @('No safe diagnostic lines were available from the CLI.') }
    Write-Output 'Supabase CLI startup diagnostics (sanitized):'
    foreach ($line in $lines) {
        $safeLine = $line.Trim()
        $safeLine = [regex]::Replace($safeLine, '(?i)\b(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b', '[REDACTED]')
        $safeLine = [regex]::Replace($safeLine, '(?i)(\b(?:SUPABASE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)|(?:anon|service_role|publishable|secret)[ _-]*(?:api[ _-]*)?key)\s*[:=]\s*)\S+', '$1[REDACTED]')
        $safeLine = [regex]::Replace($safeLine, '(?i)(\bBearer\s+)\S+', '$1[REDACTED]')
        if ($safeLine.Length -gt 500) { $safeLine = $safeLine.Substring(0, 500) }
        Write-Output "  $safeLine"
    }
    $cliOutput = $null
    throw "Supabase local startup failed (exit $cliExit); no application migration executed. Workspace: $workspace"
}
$cliOutput = $null
$containerName = 'supabase_db_' + $project
$container = (& docker inspect --format '{{.Id}}' $containerName 2>$null | Out-String).Trim()
if ($container -notmatch '^[a-f0-9]{64}$') { throw 'Cannot identify fresh database container.' }
function Assert-Target {
    Assert-Workspace
    $currentEndpoint = (& docker context inspect --format '{{.Endpoints.docker.Host}}' 2>$null | Out-String).Trim()
    if ($currentEndpoint -cne $endpoint) { throw 'Docker endpoint changed.' }
    $proof = & docker inspect --format '{{json .Created}}|{{json .Config.Labels}}|{{json .State.Running}}|{{json .Config.Image}}' $container 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Disposable container unavailable.' }
    $parts = $proof -split '\|'
    if ($parts.Count -ne 4 -or ([DateTime]($parts[0] | ConvertFrom-Json)).ToUniversalTime() -lt $created -or $parts[2] -ne 'true') { throw 'Container freshness/running proof failed.' }
    $labels = $parts[1] | ConvertFrom-Json
    if ($labels.'com.supabase.cli.project' -cne $project -or $parts[3] -notmatch 'supabase/postgres:') { throw 'Supabase disposable ownership proof failed.' }
    # psql always connects to loopback INSIDE this positively identified local container.
}
Assert-Target
Write-Output 'DISPOSABLE TARGET VERIFIED'
function Invoke-SqlFile([string]$Path, [string]$Step, [bool]$Transaction = $true) {
    Assert-Target
    $remote = '/tmp/simkb-disposable-input.sql'
    $copyOutput = & docker cp $Path "${container}:$remote" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "$Step : file transfer failed." }
    $copyHash = (& docker exec $container sha256sum $remote 2>$null | Out-String).Split(' ')[0].Trim()
    if ($copyHash -cne (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "$Step : byte fidelity check failed." }
    $arguments = @('exec', $container, 'psql', '-X', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-f', $remote)
    if ($Transaction) { $arguments += '--single-transaction' }
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $result = & docker @arguments 2>&1
    $sqlExit = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    if ($sqlExit -ne 0) {
        $safe = [regex]::Match(($result | Out-String), 'ERROR:\s+([A-Z0-9]{5})').Groups[1].Value
        throw "$Step FAILED: psql exit $sqlExit; SQLSTATE $safe. STOP; no automatic repair."
    }
    Write-Output "$Step PASS"
}
Invoke-SqlFile (Join-Path $PSScriptRoot 'preflight.sql') 'FRESH SUPABASE SCHEMAS'
foreach ($entry in $files) {
    $path = Join-Path $repo $entry.Name
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $rawHashes[$entry.Name]) { throw 'Migration changed after fingerprint validation.' }
    $number = [IO.Path]::GetFileName($path).Substring(9,3)
    # 007 has its own BEGIN/COMMIT; do not wrap it in a nested transaction.
    Invoke-SqlFile $path "SOURCE MIGRATION $number" ($number -ne '007')
    if ($number -eq '001') {
        $compat = Join-Path $workspace 'enum-compatibility.sql'
        [IO.File]::WriteAllText($compat, "ALTER TYPE public.membership_status ADD VALUE IF NOT EXISTS 'active';`n")
        Invoke-SqlFile $compat 'TEST-ONLY ENUM COMPATIBILITY COMMIT'
    }
}
Invoke-SqlFile (Join-Path $PSScriptRoot 'validate.sql') 'BASELINE CATALOG VALIDATION'
[IO.File]::WriteAllText((Join-Path $workspace 'baseline-ready.txt'), "001-007 source fingerprints verified; enum compatibility committed separately; 008 NOT EXECUTED; migration ledger intentionally unpopulated.")
Write-Output "Disposable workspace retained: $workspace"
Write-Output 'MIGRATION 008 STATUS: DRAFT - NOT EXECUTED'
Write-Output 'MIGRATIONS 001-007: UNMODIFIED'
Write-Output 'DISPOSABLE BASELINE 001-007: READY'
