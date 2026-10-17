"""Build the mapped release, compress it at maximum ZIP level, then upload to COS."""

import argparse
from datetime import datetime
import json
import os
from pathlib import Path, PureWindowsPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

from cos_upload import UploadError, load_settings, upload_release
from release_version import parse_version, read_version, stamp_release


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def release_path(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative.strip():
        raise ValueError("Expected a nonempty relative file path.")
    parts = re.split(r"[\\/]", relative)
    if (PureWindowsPath(relative).drive or relative.startswith(("/", "\\"))
            or re.search(r'[:*?"<>|\x00-\x1f]', relative)
            or any(p in ("", ".", "..") or p.endswith((" ", ".")) for p in parts)):
        raise ValueError(f"Expected a relative file path: {relative}")
    root = root.absolute()
    target = root.joinpath(*parts)
    probe = target
    while True:
        if os.path.lexists(probe):
            info = probe.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise ValueError(f"Linked release paths are not supported: {probe}")
        if probe == root:
            break
        probe = probe.parent
    return target


def mapped_transfers(mapping: dict, roots: dict, output: Path) -> list:
    transfers, targets = [], set()
    for group, destination in (("files", output / "files"), ("packageFiles", output)):
        if not isinstance(mapping.get(group), list):
            raise ValueError(f"Release mapping requires an array: {group}")
        for entry in mapping[group]:
            if not isinstance(entry, dict) or entry.get("sourceRoot") not in roots:
                raise ValueError("Unknown or missing sourceRoot in release mapping.")
            source = release_path(roots[entry["sourceRoot"]], entry.get("source"))
            target = release_path(destination, entry.get("target"))
            name = target.relative_to(output).as_posix().casefold()
            if name == "release-files.json" or name in targets:
                raise ValueError(f"Repeated or reserved package target: {entry['target']}")
            if any(name.startswith(t + "/") or t.startswith(name + "/") for t in targets):
                raise ValueError(f"File/directory collision in package: {entry['target']}")
            if not source.is_file():
                raise ValueError(f"Mapped source is missing or is not a file: {source}")
            targets.add(name)
            transfers.append((source, target))
    return transfers


def find_seven_zip():
    executable = shutil.which("7z.exe") or shutil.which("7z")
    if executable:
        return executable
    for name in ("ProgramFiles", "ProgramFiles(x86)"):
        if os.environ.get(name):
            candidate = Path(os.environ[name]) / "7-Zip" / "7z.exe"
            if candidate.is_file():
                return str(candidate)
    return None


def compress_release(output: Path, archive: Path, files: list, tool: str):
    seven_zip = find_seven_zip() if tool in ("auto", "7zip") else None
    if tool == "7zip" and not seven_zip:
        raise ValueError("7-Zip was requested but 7z.exe was not found.")
    if seven_zip:
        list_path = None
        try:
            # Feed only mapped files to 7-Zip; never collect credentials or unrelated files.
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".txt", delete=False) as listing:
                list_path = Path(listing.name)
                for file in files:
                    listing.write(file.relative_to(output.parent).as_posix() + "\n")
            command = [seven_zip, "a", "-tzip", "-mx=9", "-mm=Deflate", "-mfb=258", "-mpass=15",
                       "-y", "-bso0", "-bsp0", "-scsUTF-8", str(archive), "@" + str(list_path)]
            result = subprocess.run(command, cwd=output.parent, capture_output=True)
            if result.returncode:
                raise RuntimeError(f"7-Zip compression failed (exit {result.returncode}).")
        finally:
            if list_path is not None:
                list_path.unlink(missing_ok=True)
        print("Compression: 7-Zip ZIP / Deflate, Ultra (-mx=9, -mfb=258, -mpass=15).", flush=True)
    else:
        with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
            for file in files:
                bundle.write(file, file.relative_to(output.parent).as_posix())
        print("Compression: Python ZIP / Deflate, maximum level 9.", flush=True)


def build_release(output: Path, sgsol: Path, tool: str, version=None) -> Path:
    mapping_path = PROJECT_ROOT / "release-files.json"
    mapping = json.loads(mapping_path.read_text(encoding="utf-8-sig"))
    version = version or read_version(PROJECT_ROOT / "version.json")
    parse_version(version)
    output = output.absolute()
    if not output.name or any(ord(c) < 32 for c in output.name):
        raise ValueError("Invalid release folder name.")
    archive = output.with_name(output.name + ".zip")
    if os.path.lexists(output) or os.path.lexists(archive):
        raise ValueError(f"Output folder or ZIP already exists. Use a new name: {output}")
    roots = {"repo": PROJECT_ROOT.parent, "sgsol": sgsol.absolute()}
    transfers = mapped_transfers(mapping, roots, output)
    output.mkdir(parents=True, exist_ok=False)
    for source, target in transfers:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    shutil.copyfile(mapping_path, output / "release-files.json")
    stamp_release(output, version)
    files = [target for _, target in transfers] + [output / "release-files.json"]
    compress_release(output, archive, files, tool)
    print(f"Packaged {len(mapping['files'])} business files.", flush=True)
    print(f"Release version: {version}", flush=True)
    print(f"Release folder: {output}", flush=True)
    print(f"ZIP archive: {archive} ({archive.stat().st_size:,} bytes)", flush=True)
    return archive


def show_archive(archive: Path):
    if os.name != "nt":
        return
    try:
        # Explorer owns the visible UI; the Python helper itself remains hidden.
        subprocess.Popen([str(Path(os.environ["WINDIR"]) / "explorer.exe"), f'/select,"{archive}"'])
    except OSError:
        print("The ZIP is available, but its folder could not be opened.", file=sys.stderr)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-directory", "-OutputDirectory", type=Path)
    parser.add_argument("--sgsol-directory", "-SgsolDirectory", type=Path,
                        default=Path(os.environ.get("APPDATA", str(Path.home()))) / "SGSOL")
    parser.add_argument("--compression-tool", "-CompressionTool", type=str.lower,
                        choices=("auto", "7zip", "python", "windows"), default="auto",
                        help="auto uses 7-Zip Ultra; python/windows uses Python Deflate level 9")
    parser.add_argument("--cos-config", type=Path, default=PROJECT_ROOT / "cos-upload.local.json")
    parser.add_argument("--no-upload", "-NoUpload", action="store_true", help="explicitly build a local package only")
    parser.add_argument("--version", help="override the staged release version without changing the working/local version")
    parser.add_argument("--upload-only", type=Path, help="retry uploading an existing ZIP without repackaging")
    parser.add_argument("--no-open", "-NoOpen", action="store_true")
    args = parser.parse_args(argv)
    if args.upload_only and (args.no_upload or args.output_directory or args.version):
        parser.error("--upload-only cannot be combined with --no-upload, --version or --output-directory")
    return args


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args(argv)
    archive = None
    try:
        if args.upload_only:
            archive = args.upload_only.absolute()
        else:
            output = args.output_directory or PROJECT_ROOT / "release" / ("xiaochao-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3])
            archive = build_release(output, args.sgsol_directory, args.compression_tool, args.version)
        if not args.no_upload:
            result = upload_release(archive, load_settings(args.cos_config))
            print("COS release and version manifest uploaded.", flush=True)
            print("Object URL: " + result["url"], flush=True)
            print("Version URL: " + result["manifest_url"], flush=True)
            print("Download access follows the bucket's existing permissions.", flush=True)
        else:
            print("Local package completed; COS upload explicitly disabled.", flush=True)
        return 0
    except UploadError as exc:
        print("Upload failed: " + str(exc), file=sys.stderr, flush=True)
        if archive and archive.is_file():
            print(f'ZIP retained. Retry: pack.cmd --upload-only "{archive}"', file=sys.stderr, flush=True)
        return 2
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        print("Package failed: " + str(exc), file=sys.stderr, flush=True)
        return 1
    finally:
        if archive and archive.is_file() and not args.no_open:
            show_archive(archive)


if __name__ == "__main__":
    raise SystemExit(main())
