param(
    [string]$TargetDirectory = (Join-Path $env:APPDATA 'SGSOL')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

try {
    . (Join-Path $PSScriptRoot 'release-common.ps1')
    $mapping = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release-files.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $payloadRoot = Join-Path $PSScriptRoot 'files'
    $installRoot = [IO.Path]::GetFullPath($TargetDirectory)
    $targets = @{}
    $transfers = @(
        foreach ($entry in $mapping.files) {
            $sourcePath = Resolve-ReleasePath $payloadRoot $entry.target
            $targetPath = Resolve-ReleasePath $installRoot $entry.target
            if ($sourcePath -eq $targetPath) { throw 'The install folder must differ from the package payload.' }
            if ($targets.ContainsKey($targetPath)) { throw "Repeated install target: $($entry.target)" }
            $targets[$targetPath] = $true
            if ((Get-Item -LiteralPath $sourcePath -Force).PSIsContainer) {
                throw "Expected a file: $sourcePath"
            }
            @{ Source = $sourcePath; Target = $targetPath }
        }
    )
    $removals = @(
        foreach ($relativePath in $mapping.remove) {
            $obsoletePath = Resolve-ReleasePath $installRoot $relativePath
            if ($targets.ContainsKey($obsoletePath)) { throw "An active target is also in remove: $relativePath" }
            if ((Test-Path -LiteralPath $obsoletePath) -and (Get-Item -LiteralPath $obsoletePath -Force).PSIsContainer) {
                throw "remove only accepts individual files: $relativePath"
            }
            $obsoletePath
        }
    )
    foreach ($transfer in $transfers) {
        New-ReleaseParent $transfer.Target
        Move-Item -LiteralPath $transfer.Source -Destination $transfer.Target -Force
    }
    foreach ($obsoletePath in $removals) {
        if (Test-Path -LiteralPath $obsoletePath) {
            Remove-Item -LiteralPath $obsoletePath -Force
        }
    }
    Write-Host ('Installed {0} business files to: {1}' -f $transfers.Count, $installRoot)
    Write-Host 'Files were moved out of this package. Reopen the game to use the installed script.'
} catch {
    [Console]::Error.WriteLine('Install failed: ' + $_.Exception.Message)
    exit 1
}
