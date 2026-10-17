# File operations stay inside their declared root, including removal entries.
function Resolve-ReleasePath {
    param([string]$Root, [string]$RelativePath)

    if ([string]::IsNullOrWhiteSpace($RelativePath) -or
        [IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath -match '[:*?"<>|\x00-\x1f]' -or
        @($RelativePath -split '[\\/]' | Where-Object { $_ -eq '' -or $_ -match '^\.{1,2}$' -or $_ -match '[ .]$' }).Count) {
        throw "Expected a relative file path: $RelativePath"
    }
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $full = [IO.Path]::GetFullPath([IO.Path]::Combine($base, $RelativePath))
    if (-not $full.StartsWith($base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "File path leaves its root: $RelativePath"
    }
    # Refuse junctions/symlinks so a lexical child cannot redirect a write outside.
    $probe = $full
    while ($probe.Length -ge $base.Length) {
        if (Test-Path -LiteralPath $probe) {
            $item = Get-Item -LiteralPath $probe -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Linked release paths are not supported: $probe"
            }
        }
        $probe = [IO.Path]::GetDirectoryName($probe)
        if (-not $probe) { break }
    }
    return $full
}

function New-ReleaseParent {
    param([string]$FilePath)
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($FilePath))
}
