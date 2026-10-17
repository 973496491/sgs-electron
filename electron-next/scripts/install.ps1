param(
    [string]$TargetDirectory = (Join-Path $env:APPDATA 'SGSOL'),
    [string]$ArchivePath,
    [string]$ExpectedVersion,
    [switch]$RecoverOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
. (Join-Path $PSScriptRoot 'release-common.ps1')

function Assert-Version([string]$Value) {
    if ($Value -notmatch '^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$') { throw 'invalid-version' }
}

function Resolve-BusinessPath([string]$Root, [string]$RelativePath) {
    $normalized = $RelativePath.Replace('\', '/')
    if ($normalized -match '(^|/)\.xiaochao-' -or $normalized -match '(^|/)(config\.json|cos-.*\.local\.json|app-log\.txt)$') {
        throw 'reserved-user-file'
    }
    return Resolve-ReleasePath $Root $RelativePath
}

function Copy-Atomic([string]$Source, [string]$Target) {
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

function Remove-OwnedWork([string]$Work) {
    $base = [IO.Path]::GetFullPath((Join-Path $script:installRoot '.xiaochao-install-work')).TrimEnd('\')
    $full = [IO.Path]::GetFullPath($Work).TrimEnd('\')
    if ([IO.Path]::GetDirectoryName($full) -ne $base -or [IO.Path]::GetFileName($full) -notmatch '^[0-9a-f]{32}$') { throw 'invalid-work-directory' }
    # Check the resolved path and reparse points before any recursive removal.
    [void](Resolve-ReleasePath $script:installRoot ('.xiaochao-install-work/' + [IO.Path]::GetFileName($full)))
    if (Test-Path -LiteralPath $full) {
        foreach ($item in @(Get-ChildItem -LiteralPath $full -Recurse -Force)) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'linked-work-directory' }
        }
        Remove-Item -LiteralPath $full -Recurse -Force
    }
}

function Restore-PendingInstall {
    if (-not [IO.File]::Exists($script:journalPath)) { return }
    $state = Get-Content -LiteralPath $script:journalPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($state.protocol -ne 1 -or $state.workId -notmatch '^[0-9a-f]{32}$') { throw 'invalid-recovery-state' }
    $work = Resolve-ReleasePath $script:installRoot ('.xiaochao-install-work/' + $state.workId)
    $records = @($state.records)
    foreach ($entry in @($records | Where-Object { $_.target -ne 'version.json' }) + @($records | Where-Object { $_.target -eq 'version.json' })) {
        $target = Resolve-BusinessPath $script:installRoot $entry.target
        if ($entry.existed) {
            $backup = Resolve-ReleasePath $work $entry.backup
            if (-not [IO.File]::Exists($backup)) { throw 'recovery-backup-missing' }
            Copy-Atomic $backup $target
        } elseif ([IO.File]::Exists($target)) {
            [IO.File]::Delete($target)
        } elseif ([IO.Directory]::Exists($target)) { throw 'recovery-target-is-directory' }
    }
    [IO.File]::Delete($script:journalPath)
    try { Remove-OwnedWork $work } catch { }
}

function Expand-CheckedArchive([string]$Archive, [string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($Archive))
    try {
        $roots = @{}
        $names = @{}
        $entries = @()
        [long]$total = 0
        if ($zip.Entries.Count -gt 5000) { throw 'too-many-archive-entries' }
        foreach ($entry in $zip.Entries) {
            $name = $entry.FullName
            if ($name.Contains('\')) { throw 'invalid-archive-path' }
            $relative = $name.TrimEnd('/')
            $target = Resolve-ReleasePath $Destination $relative
            $parts = $relative.Split('/')
            if ($parts.Length -lt 2 -and -not $name.EndsWith('/')) { throw 'archive-root-file' }
            $roots[$parts[0]] = $true
            if ($names.ContainsKey($relative)) { throw 'duplicate-archive-path' }
            $names[$relative] = $true
            $kind = ($entry.ExternalAttributes -shr 16) -band 61440
            if ($kind -notin @(0, 32768, 16384) -or ($entry.ExternalAttributes -band 1024)) { throw 'linked-archive-entry' }
            $total += $entry.Length
            if ($total -gt 536870912) { throw 'archive-too-large' }
            $entries += @{ Entry = $entry; Target = $target; Directory = $name.EndsWith('/') }
        }
        if ($roots.Count -ne 1) { throw 'archive-needs-one-root' }
        foreach ($item in $entries) {
            if ($item.Directory) { [void][IO.Directory]::CreateDirectory($item.Target); continue }
            New-ReleaseParent $item.Target
            $inputStream = $item.Entry.Open()
            try {
                $outputStream = [IO.File]::Open($item.Target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
                try {
                    $buffer = New-Object byte[] 65536
                    [long]$written = 0
                    while (($count = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                        $written += $count
                        if ($written -gt $item.Entry.Length) { throw 'archive-size-mismatch' }
                        $outputStream.Write($buffer, 0, $count)
                    }
                } finally { $outputStream.Dispose() }
            } finally { $inputStream.Dispose() }
            if ((Get-Item -LiteralPath $item.Target).Length -ne $item.Entry.Length) { throw 'archive-size-mismatch' }
        }
        return Resolve-ReleasePath $Destination ([string](@($roots.Keys)[0]))
    } finally { $zip.Dispose() }
}

$installRoot = [IO.Path]::GetFullPath($TargetDirectory).TrimEnd('\', '/')
$lock = $null
$work = $null
$journalPath = $null
$exitCode = 1
$result = @{ ok = $false; restored = $true; code = 'install-failed' }
try {
    [void][IO.Directory]::CreateDirectory($installRoot)
    $lockPath = Resolve-ReleasePath $installRoot '.xiaochao-install.lock'
    $journalPath = Resolve-ReleasePath $installRoot '.xiaochao-install-state.json'
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { $result.code = 'install-busy'; $exitCode = 2; throw 'install-busy' }
    Restore-PendingInstall
    if ($RecoverOnly) {
        $result = @{ ok = $true; recovered = $true }; $exitCode = 0
    } else {
        $workId = [Guid]::NewGuid().ToString('N')
        $work = Resolve-ReleasePath $installRoot ('.xiaochao-install-work/' + $workId)
        [void][IO.Directory]::CreateDirectory($work)
        $packageRoot = $PSScriptRoot
        if ($ArchivePath) { $packageRoot = Expand-CheckedArchive $ArchivePath (Join-Path $work 'extracted') }
        $mapping = Get-Content -LiteralPath (Join-Path $packageRoot 'release-files.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($ArchivePath -and (-not $mapping.PSObject.Properties['installProtocol'] -or $mapping.installProtocol -ne 1)) { throw 'unsupported-install-protocol' }
        $payloadRoot = Join-Path $packageRoot 'files'
        $targets = @{}
        $transfers = @()
        foreach ($entry in $mapping.files) {
            $sourcePath = Resolve-ReleasePath $payloadRoot $entry.target
            $targetPath = Resolve-BusinessPath $installRoot $entry.target
            if ($sourcePath -eq $targetPath) { throw 'package-inside-install-target' }
            if ($targets.ContainsKey($targetPath)) { throw 'duplicate-install-target' }
            if (-not [IO.File]::Exists($sourcePath)) { throw 'missing-package-file' }
            if ([IO.Directory]::Exists($targetPath)) { throw 'target-is-directory' }
            $targets[$targetPath] = $true
            $transfers += @{ Source = $sourcePath; Target = $targetPath; Relative = $entry.target.Replace('\', '/') }
        }
        $removals = @()
        foreach ($relativePath in $mapping.remove) {
            $obsoletePath = Resolve-BusinessPath $installRoot $relativePath
            if ($targets.ContainsKey($obsoletePath)) { throw 'remove-active-target' }
            if ([IO.Directory]::Exists($obsoletePath)) { throw 'remove-only-files' }
            $targets[$obsoletePath] = $true
            $removals += @{ Target = $obsoletePath; Relative = $relativePath.Replace('\', '/') }
        }
        $versionTransfer = @($transfers | Where-Object { $_.Relative -eq 'version.json' })
        $scriptTransfer = @($transfers | Where-Object { $_.Relative -eq '三国杀打小抄.js' })
        if ($versionTransfer.Count -ne 1 -or $scriptTransfer.Count -ne 1) { throw 'missing-version-or-script' }
        $version = (Get-Content -LiteralPath $versionTransfer[0].Source -Raw -Encoding UTF8 | ConvertFrom-Json).version
        Assert-Version $version
        $scriptText = [IO.File]::ReadAllText($scriptTransfer[0].Source, [Text.Encoding]::UTF8)
        $match = [regex]::Match($scriptText, '(?m)^//\s*@version\s+(\S+)')
        if (-not $match.Success -or $match.Groups[1].Value -ne $version) { throw 'script-version-mismatch' }
        if ($ExpectedVersion) {
            Assert-Version $ExpectedVersion
            if ($version -ne $ExpectedVersion) { throw 'unexpected-package-version' }
            if ([IO.File]::Exists($scriptTransfer[0].Target)) {
                $oldMatch = [regex]::Match([IO.File]::ReadAllText($scriptTransfer[0].Target, [Text.Encoding]::UTF8), '(?m)^//\s*@version\s+(\S+)')
                if ($oldMatch.Success) {
                    Assert-Version $oldMatch.Groups[1].Value
                    if ([Version]$oldMatch.Groups[1].Value -gt [Version]$version) { throw 'refuse-downgrade' }
                }
            }
        }
        $records = @()
        foreach ($item in @($transfers) + @($removals)) {
            $backupRelative = 'backup/' + $records.Count
            $exists = [IO.File]::Exists($item.Target)
            if ($exists) {
                $backup = Resolve-ReleasePath $work $backupRelative
                New-ReleaseParent $backup
                [IO.File]::Copy($item.Target, $backup, $false)
            }
            $records += @{ target = $item.Relative; existed = $exists; backup = $backupRelative }
        }
        $state = @{ protocol = 1; workId = $workId; records = @($records) }
        $journalTemp = Join-Path $work 'journal.json'
        [IO.File]::WriteAllText($journalTemp, ($state | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding($false)))
        [IO.File]::Move($journalTemp, $journalPath)
        foreach ($transfer in @($transfers | Where-Object { $_.Relative -notin @('version.json', '三国杀打小抄.js') })) {
            Copy-Atomic $transfer.Source $transfer.Target
        }
        foreach ($obsolete in $removals) { if ([IO.File]::Exists($obsolete.Target)) { [IO.File]::Delete($obsolete.Target) } }
        Copy-Atomic $scriptTransfer[0].Source $scriptTransfer[0].Target
        Copy-Atomic $versionTransfer[0].Source $versionTransfer[0].Target
        [IO.File]::Delete($journalPath)
        if (-not $ArchivePath) {
            foreach ($transfer in $transfers) { try { [IO.File]::Delete($transfer.Source) } catch { } }
        }
        $result = @{ ok = $true; version = $version; files = $transfers.Count; restartRequired = $true }
        $exitCode = 0
    }
} catch {
    if ($exitCode -ne 2) {
        $code = $_.Exception.Message
        $result.detail = $code
        $result.code = if ($code -match '^[a-z0-9-]+$') { $code } else { 'install-io-error' }
        if ($lock -and [IO.File]::Exists($journalPath)) {
            try { Restore-PendingInstall; $result.restored = $true }
            catch { $result.restored = $false; $result.code = 'recovery-failed'; $result.recoveryDetail = $_.Exception.Message; $exitCode = 3 }
        }
    }
} finally {
    if ($work -and -not [IO.File]::Exists((Join-Path $installRoot '.xiaochao-install-state.json'))) {
        try { Remove-OwnedWork $work } catch { }
    }
    if ($lock) { $lock.Dispose() }
}
try { [Console]::Out.WriteLine('XC_INSTALL_RESULT:' + ($result | ConvertTo-Json -Compress -Depth 5)) } catch { }
exit $exitCode
