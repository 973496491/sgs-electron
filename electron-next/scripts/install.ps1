param(
    [string]$TargetDirectory = (Join-Path $env:APPDATA 'SGSOL'),
    [string]$ArchivePath,
    [string]$ExpectedVersion,
    [switch]$RecoverOnly,
    [switch]$ShowProgress
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
. (Join-Path $PSScriptRoot 'release-common.ps1')

$script:installLog = $null
$script:installStage = '准备安装'
function Write-InstallMessage([string]$Message) {
    if (-not $ShowProgress) { return }
    Write-Host $Message
    if ($script:installLog) {
        try {
            [IO.File]::AppendAllText($script:installLog, ('[{0:HH:mm:ss}] {1}{2}' -f (Get-Date), $Message, [Environment]::NewLine), (New-Object Text.UTF8Encoding($true)))
        } catch {
            $script:installLog = $null
            Write-Host '提示：无法继续写入安装日志，请保留当前窗口中的结果。'
        }
    }
}

function Write-InstallStage([int]$Number, [string]$Message) {
    $script:installStage = $Message
    Write-InstallMessage "`n[$Number/7] $Message"
}

function Get-InstallFailureHint([string]$Code) {
    switch ($Code) {
        'install-busy' { return '另一个安装程序正在运行，请等待它结束后再试。' }
        'missing-package-file' { return '安装包缺少文件；若此包已经安装过，请重新解压完整 ZIP 后运行 install.cmd。' }
        'missing-version-or-script' { return '安装包缺少主脚本或版本记录，请重新解压完整 ZIP。' }
        'script-version-mismatch' { return '安装包的主脚本与版本记录不一致，请使用完整的同一份安装包。' }
        'unexpected-package-version' { return '安装包版本与预期不一致。' }
        'refuse-downgrade' { return '已安装版本更新，本次自动安装已拒绝降级。' }
        'installed-file-mismatch' { return '安装后的文件内容与安装包不一致，已触发恢复。' }
        'obsolete-file-still-exists' { return '废弃文件未清理成功，已触发恢复。' }
        'recovery-failed' { return '原文件未能全部恢复，请保留日志和恢复资料，不要启动客户端。' }
        default { return '请检查上方原因；若文件被占用，请退出客户端后重试，并确认目标目录可写。' }
    }
}

function Assert-Version([string]$Value) {
    if ($Value -notmatch '^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$') { throw 'invalid-version' }
}

function Get-InstallFileHash([string]$FilePath) {
    # Use .NET directly: PowerShell 7 parents may pass a PSModulePath without the
    # Windows PowerShell Utility module, even though the installer uses PS 5.1.
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        $stream = [IO.File]::OpenRead($FilePath)
        try { return [BitConverter]::ToString($hasher.ComputeHash($stream)) }
        finally { $stream.Dispose() }
    } finally { $hasher.Dispose() }
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
    Write-InstallMessage '发现未完成的安装记录，正在恢复原文件...'
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
        Write-InstallMessage ('  已恢复：' + $entry.target)
    }
    [IO.File]::Delete($script:journalPath)
    try { Remove-OwnedWork $work } catch { }
    Write-InstallMessage '原文件恢复完成。'
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

$installRoot = $null
$lock = $null
$work = $null
$journalPath = $null
$exitCode = 1
$rollbackAttempted = $false
$result = @{ ok = $false; restored = $true; code = 'install-failed' }
Write-InstallMessage '========== 小抄安装程序 =========='
try {
    Write-InstallStage 1 '检查目标目录与安装状态'
    $installRoot = [IO.Path]::GetFullPath($TargetDirectory).TrimEnd('\', '/')
    [void][IO.Directory]::CreateDirectory($installRoot)
    if ($ShowProgress) {
        try {
            $logRelative = '.xiaochao-install-logs/install-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N') + '.log'
            $script:installLog = Resolve-ReleasePath $installRoot $logRelative
            New-ReleaseParent $script:installLog
        } catch {
            $script:installLog = $null
            Write-InstallMessage '提示：无法创建安装日志，安装结果仍会显示在此窗口。'
        }
    }
    Write-InstallMessage ('目标目录：' + $installRoot)
    if ($script:installLog) { Write-InstallMessage ('日志文件：' + $script:installLog) }
    $lockPath = Resolve-ReleasePath $installRoot '.xiaochao-install.lock'
    $journalPath = Resolve-ReleasePath $installRoot '.xiaochao-install-state.json'
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { $result.code = 'install-busy'; $exitCode = 2; throw 'install-busy' }
    Restore-PendingInstall
    if ($RecoverOnly) {
        $result = @{ ok = $true; recovered = $true }; $exitCode = 0
    } else {
        Write-InstallStage 2 '检查安装包与文件清单'
        $workId = [Guid]::NewGuid().ToString('N')
        $work = Resolve-ReleasePath $installRoot ('.xiaochao-install-work/' + $workId)
        [void][IO.Directory]::CreateDirectory($work)
        $packageRoot = $PSScriptRoot
        if ($ArchivePath) {
            Write-InstallMessage ('正在检查并解压：' + $ArchivePath)
            $packageRoot = Expand-CheckedArchive $ArchivePath (Join-Path $work 'extracted')
        }
        Write-InstallMessage ('安装包目录：' + $packageRoot)
        $mapping = Get-Content -LiteralPath (Join-Path $packageRoot 'release-files.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($ArchivePath -and (-not $mapping.PSObject.Properties['installProtocol'] -or $mapping.installProtocol -ne 1)) { throw 'unsupported-install-protocol' }
        $payloadRoot = Join-Path $packageRoot 'files'
        $targets = @{}
        $transfers = @()
        foreach ($entry in $mapping.files) {
            Write-InstallMessage ('  检查文件：' + $entry.target)
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
        Write-InstallStage 3 '核对安装版本'
        if ($versionTransfer.Count -ne 1 -or $scriptTransfer.Count -ne 1) { throw 'missing-version-or-script' }
        $version = (Get-Content -LiteralPath $versionTransfer[0].Source -Raw -Encoding UTF8 | ConvertFrom-Json).version
        Assert-Version $version
        Write-InstallMessage ('本次安装版本：' + $version)
        Write-InstallMessage ('待安装文件：' + $transfers.Count + ' 个；待清理旧文件：' + $removals.Count + ' 个')
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
        Write-InstallStage 4 '备份原有文件'
        $records = @()
        foreach ($item in @($transfers) + @($removals)) {
            $backupRelative = 'backup/' + $records.Count
            $exists = [IO.File]::Exists($item.Target)
            if ($exists) {
                $backup = Resolve-ReleasePath $work $backupRelative
                New-ReleaseParent $backup
                [IO.File]::Copy($item.Target, $backup, $false)
                Write-InstallMessage ('  已备份：' + $item.Relative)
            } else {
                Write-InstallMessage ('  无原文件，无需备份：' + $item.Relative)
            }
            $records += @{ target = $item.Relative; existed = $exists; backup = $backupRelative }
        }
        $state = @{ protocol = 1; workId = $workId; records = @($records) }
        $journalTemp = Join-Path $work 'journal.json'
        [IO.File]::WriteAllText($journalTemp, ($state | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding($false)))
        [IO.File]::Move($journalTemp, $journalPath)
        Write-InstallStage 5 '安装文件并清理废弃文件'
        $installedCount = 0
        foreach ($transfer in @($transfers | Where-Object { $_.Relative -notin @('version.json', '三国杀打小抄.js') })) {
            Write-InstallMessage ('  正在写入：' + $transfer.Relative)
            Copy-Atomic $transfer.Source $transfer.Target
            $installedCount++
            Write-InstallMessage ('  [' + $installedCount + '/' + $transfers.Count + '] 已写入：' + $transfer.Relative)
        }
        foreach ($obsolete in $removals) {
            if ([IO.File]::Exists($obsolete.Target)) {
                Write-InstallMessage ('  正在清理旧文件：' + $obsolete.Relative)
                [IO.File]::Delete($obsolete.Target)
                Write-InstallMessage ('  已清理旧文件：' + $obsolete.Relative)
            } else { Write-InstallMessage ('  旧文件不存在，跳过：' + $obsolete.Relative) }
        }
        foreach ($transfer in @($scriptTransfer[0], $versionTransfer[0])) {
            Write-InstallMessage ('  正在写入：' + $transfer.Relative)
            Copy-Atomic $transfer.Source $transfer.Target
            $installedCount++
            Write-InstallMessage ('  [' + $installedCount + '/' + $transfers.Count + '] 已写入：' + $transfer.Relative)
        }
        Write-InstallStage 6 '校验已安装文件'
        foreach ($transfer in $transfers) {
            Write-InstallMessage ('  正在校验：' + $transfer.Relative)
            if ((Get-InstallFileHash $transfer.Source) -ne (Get-InstallFileHash $transfer.Target)) {
                throw 'installed-file-mismatch'
            }
            Write-InstallMessage ('  校验通过：' + $transfer.Relative)
        }
        foreach ($obsolete in $removals) { if (Test-Path -LiteralPath $obsolete.Target) { throw 'obsolete-file-still-exists' } }
        Write-InstallStage 7 '完成安装并清理临时文件'
        [IO.File]::Delete($journalPath)
        if (-not $ArchivePath) {
            foreach ($transfer in $transfers) {
                try { [IO.File]::Delete($transfer.Source) }
                catch { Write-InstallMessage ('  提示：安装包内的源文件未能清理，不影响安装结果：' + $transfer.Relative) }
            }
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
            $rollbackAttempted = $true
            try { Restore-PendingInstall; $result.restored = $true }
            catch { $result.restored = $false; $result.code = 'recovery-failed'; $result.recoveryDetail = $_.Exception.Message; $exitCode = 3 }
        }
    }
} finally {
    if ($work -and -not [IO.File]::Exists((Join-Path $installRoot '.xiaochao-install-state.json'))) {
        try { Remove-OwnedWork $work } catch { Write-InstallMessage ('提示：临时目录未能清理：' + $work) }
    }
    if ($lock) { $lock.Dispose() }
}
if ($ShowProgress) {
    if ($exitCode -eq 0) {
        if ($RecoverOnly) { Write-InstallMessage "`n[恢复完成] 安装状态检查通过。" }
        else {
            Write-InstallMessage "`n========== 安装成功 =========="
            Write-InstallMessage ('已安装版本：' + $result.version)
            Write-InstallMessage ('安装目录：' + $installRoot)
            Write-InstallMessage ('文件结果：' + $result.files + ' 个文件全部写入并校验通过。')
            Write-InstallMessage '请完全退出并重新打开客户端，使新版本生效。'
            if (-not $ArchivePath) { Write-InstallMessage '如需再次安装，请重新解压原 ZIP；本次安装包内的业务文件已移动到安装目录。' }
        }
    } else {
        Write-InstallMessage "`n========== 安装失败，未完成安装 =========="
        Write-InstallMessage ('失败步骤：' + $script:installStage)
        Write-InstallMessage ('错误代码：' + $result.code)
        if ($result.ContainsKey('detail')) { Write-InstallMessage ('失败原因：' + $result.detail) }
        if ($result.ContainsKey('recoveryDetail')) { Write-InstallMessage ('恢复失败原因：' + $result.recoveryDetail) }
        if ($rollbackAttempted -and $result.restored) { Write-InstallMessage '已恢复原文件，本次更新未安装。' }
        elseif (-not $result.restored) { Write-InstallMessage '恢复尚未完成，已保留备份及恢复记录。' }
        elseif ($exitCode -eq 2) { Write-InstallMessage '本次未执行安装，其他安装进程的结果请在对应窗口查看。' }
        else { Write-InstallMessage '本次未写入安装文件。' }
        Write-InstallMessage (Get-InstallFailureHint $result.code)
    }
    if ($script:installLog) { Write-InstallMessage ('完整安装日志：' + $script:installLog) }
    Write-InstallMessage '安装程序已结束，可以关闭此窗口。'
} else {
    try { [Console]::Out.WriteLine('XC_INSTALL_RESULT:' + ($result | ConvertTo-Json -Compress -Depth 5)) } catch { }
}
exit $exitCode
