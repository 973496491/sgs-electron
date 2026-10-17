param(
    [string]$OutputDirectory,
    [string]$SgsolDirectory = (Join-Path $env:APPDATA 'SGSOL'),
    [ValidateSet('Auto', '7Zip', 'Windows')]
    [string]$CompressionTool = 'Auto',
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

try {
    . (Join-Path $PSScriptRoot 'release-common.ps1')
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $repoRoot = Split-Path -Parent $projectRoot
    $mappingPath = Join-Path $projectRoot 'release-files.json'
    $mapping = Get-Content -LiteralPath $mappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $sourceRoots = @{ repo = $repoRoot; sgsol = $SgsolDirectory }

    if (-not $OutputDirectory) {
        $OutputDirectory = Join-Path $projectRoot ('release\xiaochao-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    }
    $outputRoot = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\', '/')
    $zipPath = $outputRoot + '.zip'
    if ((Test-Path -LiteralPath $outputRoot) -or (Test-Path -LiteralPath $zipPath)) {
        throw "Output folder or ZIP already exists. Use a new name: $outputRoot"
    }
    [void][IO.Directory]::CreateDirectory($outputRoot)
    $groups = @(
        @{ Entries = @($mapping.files); Root = (Join-Path $outputRoot 'files') },
        @{ Entries = @($mapping.packageFiles); Root = $outputRoot }
    )
    foreach ($group in $groups) {
        foreach ($entry in $group.Entries) {
            if (-not $sourceRoots.ContainsKey([string]$entry.sourceRoot)) {
                throw "Unknown sourceRoot: $($entry.sourceRoot)"
            }
            $sourcePath = Resolve-ReleasePath $sourceRoots[$entry.sourceRoot] $entry.source
            $targetPath = Resolve-ReleasePath $group.Root $entry.target
            New-ReleaseParent $targetPath
            [IO.File]::Copy($sourcePath, $targetPath, $false)
        }
    }
    [IO.File]::Copy($mappingPath, (Join-Path $outputRoot 'release-files.json'), $false)

    $sevenZip = $null
    if ($CompressionTool -ne 'Windows') {
        $zipCommand = Get-Command 7z.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($zipCommand) { $sevenZip = $zipCommand.Source }
        if (-not $sevenZip) {
            foreach ($programRoot in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
                if (-not $programRoot) { continue }
                $candidate = Join-Path $programRoot '7-Zip\7z.exe'
                if (Test-Path -LiteralPath $candidate -PathType Leaf) { $sevenZip = $candidate; break }
            }
        }
    }
    if ($CompressionTool -eq '7Zip' -and -not $sevenZip) { throw '7-Zip was requested but 7z.exe was not found.' }
    if ($sevenZip) {
        # Relative directory input keeps exactly one top-level release folder in the ZIP.
        Push-Location -LiteralPath (Split-Path -Parent $outputRoot)
        try {
            & $sevenZip a -tzip -mx=1 -y -bso0 -bsp0 $zipPath -- (Split-Path -Leaf $outputRoot)
            if ($LASTEXITCODE -ne 0) { throw "7-Zip failed with exit code $LASTEXITCODE" }
        } finally {
            Pop-Location
        }
        Write-Host 'Compression: 7-Zip ZIP, fast (-mx=1).'
    } else {
        Compress-Archive -LiteralPath $outputRoot -DestinationPath $zipPath -CompressionLevel Fastest
        Write-Host 'Compression: Windows ZIP, Fastest.'
    }
    Write-Host ('Packaged {0} business files.' -f @($mapping.files).Count)
    Write-Host ('Release folder: ' + $outputRoot)
    Write-Host ('ZIP archive: ' + $zipPath)
    Write-Host 'Extract the ZIP, then run install.cmd inside the release folder to install.'
    if (-not $NoOpen) {
        try {
            Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList ('/select,"{0}"' -f $zipPath)
        } catch {
            Write-Warning ('The ZIP was created, but its folder could not be opened: ' + $_.Exception.Message)
        }
    }
} catch {
    [Console]::Error.WriteLine('Package failed: ' + $_.Exception.Message)
    exit 1
}
