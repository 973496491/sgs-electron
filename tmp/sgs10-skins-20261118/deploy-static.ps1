$ErrorActionPreference = 'Stop'
$repoRoot = 'C:\Users\97349\Downloads\electron'
$installRoot = Join-Path $env:APPDATA 'SGSOL'
. (Join-Path $repoRoot 'electron-next/scripts/release-common.ps1')
$mapping = Get-Content -LiteralPath (Join-Path $repoRoot 'electron-next/release-files.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$requested = @('modules/features/ten-year-skins.js', 'modules/features/ten-year-skin-catalog.js', '三国杀打小抄.js')
$lock = $null
$records = @()
$journalPath = Resolve-ReleasePath $installRoot '.xiaochao-install-state.json'
function Copy-TenYearAtomic([string]$Source, [string]$Target) {
    New-ReleaseParent $Target
    $temporary = Join-Path ([IO.Path]::GetDirectoryName($Target)) ('.xiaochao-write-' + [Guid]::NewGuid().ToString('N'))
    try {
        [IO.File]::Copy($Source, $temporary, $false)
        if ([IO.File]::Exists($Target)) { [IO.File]::Replace($temporary, $Target, [NullString]::Value) }
        else { [IO.File]::Move($temporary, $Target) }
    } finally {
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}
try {
    $lockPath = Resolve-ReleasePath $installRoot '.xiaochao-install.lock'
    $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    if ([IO.File]::Exists($journalPath)) { throw 'Existing installation transaction requires recovery; nothing was replaced.' }
    $mainTarget = Resolve-ReleasePath $installRoot '三国杀打小抄.js'
    $expected = '47D36BCE911E65D256C07C87F7F5B4B83CAC6882FB6F9F63B065A9A0ADD3EBCA'
    if ((Get-FileHash -LiteralPath $mainTarget -Algorithm SHA256).Hash -ne $expected) { throw 'Runtime script changed since inspection; refusing to overwrite.' }
    $workId = [Guid]::NewGuid().ToString('N')
    $work = Resolve-ReleasePath $installRoot ('.xiaochao-install-work/' + $workId)
    [void][IO.Directory]::CreateDirectory($work)
    $transfers = @()
    foreach ($relative in $requested) {
        $entry = @($mapping.files | Where-Object { $_.target -eq $relative })
        if ($entry.Count -ne 1 -or $entry[0].sourceRoot -ne 'repo') { throw "Invalid release mapping: $relative" }
        $source = Resolve-ReleasePath $repoRoot $entry[0].source
        $target = Resolve-ReleasePath $installRoot $relative
        $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
        $exists = [IO.File]::Exists($target)
        if ($exists -and (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $hash) { continue }
        $backupRelative = 'backup/' + $records.Count
        if ($exists) {
            $backup = Resolve-ReleasePath $work $backupRelative
            New-ReleaseParent $backup
            [IO.File]::Copy($target, $backup, $false)
        }
        $records += @{ target = $relative; existed = $exists; backup = $backupRelative }
        $transfers += @{ source = $source; target = $target; relative = $relative; sha256 = $hash }
    }
    $state = @{ protocol = 1; workId = $workId; records = @($records) }
    $journalTemp = Join-Path $work 'journal.json'
    [IO.File]::WriteAllText($journalTemp, ($state | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    [IO.File]::Move($journalTemp, $journalPath)
    foreach ($transfer in $transfers) { Copy-TenYearAtomic $transfer.source $transfer.target }
    foreach ($transfer in $transfers) {
        if ((Get-FileHash -LiteralPath $transfer.target -Algorithm SHA256).Hash -ne $transfer.sha256) { throw 'Installed hash mismatch' }
    }
    & node --check $mainTarget
    if ($LASTEXITCODE -ne 0) { throw 'Installed userscript syntax failed' }
    $result = @{ ok = $true; backupDirectory = $work; installed = $transfers; unchangedVersion = '1.0.11'; hotInjected = $false }
    [IO.File]::WriteAllText((Join-Path $work 'deployment.json'), ($result | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    [IO.File]::Delete($journalPath)
    $result | ConvertTo-Json -Depth 8
} catch {
    $failure = $_
    if ($lock -and [IO.File]::Exists($journalPath) -and $records.Count -gt 0) {
        foreach ($record in $records) {
            $target = Resolve-ReleasePath $installRoot $record.target
            if ($record.existed) { Copy-TenYearAtomic (Resolve-ReleasePath $work $record.backup) $target }
            elseif ([IO.File]::Exists($target)) { [IO.File]::Delete($target) }
        }
        [IO.File]::Delete($journalPath)
    }
    throw $failure
} finally { if ($lock) { $lock.Dispose() } }
