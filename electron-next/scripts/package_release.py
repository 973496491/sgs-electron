"""Build the mapped release, compress at maximum ZIP level, and optionally upload to COS."""

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


def validate_card_theme_resources(mapping: dict, roots: dict):
    entries = {entry["target"].replace("\\", "/"): entry for entry in mapping["files"]}
    manifests, references = 0, set()
    for target, entry in entries.items():
        if not re.fullmatch(r"card-themes/[^/]+/manifest\.json", target):
            continue
        source = release_path(roots[entry["sourceRoot"]], entry["source"])
        data = json.loads(source.read_text(encoding="utf-8-sig"))
        if not isinstance(data, dict) or data.get("schemaVersion") != 1:
            raise ValueError(f"Unsupported card theme manifest: {target}")
        groups = [data.get(name) for name in ("faces", "ranks", "suits")]
        if any(not isinstance(group, dict) for group in groups):
            raise ValueError(f"Invalid card theme groups: {target}")
        refs = list(groups[1].values()) + list(groups[2].values())
        for variants in groups[0].values():
            if not isinstance(variants, dict):
                raise ValueError(f"Invalid face variants: {target}")
            refs.extend(variants.values())
        prefix = target.rsplit("/", 1)[0] + "/"
        for relative in refs:
            if relative is None or relative == "":
                continue  # An intentional native-layer fallback is not a missing release asset.
            if not isinstance(relative, str) or not re.fullmatch(r"(?:faces|ranks|suits)/[A-Za-z0-9_-]+\.png", relative):
                raise ValueError(f"Invalid card theme resource reference in {target}: {relative}")
            resource_target = prefix + relative
            if resource_target not in entries:
                raise ValueError(f"Card theme resource missing from release-files.json: {resource_target}")
            references.add(resource_target)
        manifests += 1
    if manifests:
        print(f"Card theme resources verified: {manifests} manifest(s), {len(references)} PNG file(s).", flush=True)


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
    validate_card_theme_resources(mapping, roots)
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


def select_archive_in_explorer(archive: Path):
    # Use a Unicode item ID instead of Explorer command-line quoting. With cidl=0,
    # SHOpenFolderAndSelectItems opens the parent and selects this exact item.
    import ctypes
    ole32 = ctypes.WinDLL("ole32")
    shell32 = ctypes.WinDLL("shell32")
    ole32.CoInitialize.argtypes = [ctypes.c_void_p]
    ole32.CoInitialize.restype = ctypes.c_long
    ole32.CoUninitialize.argtypes = []
    ole32.CoUninitialize.restype = None
    ole32.CoTaskMemFree.argtypes = [ctypes.c_void_p]
    ole32.CoTaskMemFree.restype = None
    shell32.SHParseDisplayName.argtypes = [ctypes.c_wchar_p, ctypes.c_void_p,
                                         ctypes.POINTER(ctypes.c_void_p), ctypes.c_uint, ctypes.c_void_p]
    shell32.SHParseDisplayName.restype = ctypes.c_long
    shell32.SHOpenFolderAndSelectItems.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_void_p, ctypes.c_uint]
    shell32.SHOpenFolderAndSelectItems.restype = ctypes.c_long

    def check(result):
        if result < 0:
            raise OSError(f"Windows Shell HRESULT 0x{result & 0xffffffff:08X}")

    initialized = ole32.CoInitialize(None)
    # A caller that already initialized COM in another mode can still use it.
    if initialized != -2147417850:  # RPC_E_CHANGED_MODE
        check(initialized)
    item = ctypes.c_void_p()
    try:
        check(shell32.SHParseDisplayName(str(archive), None, ctypes.byref(item), 0, None))
        check(shell32.SHOpenFolderAndSelectItems(item, 0, None, 0))
    finally:
        if item.value:
            ole32.CoTaskMemFree(item)
        if initialized >= 0:
            ole32.CoUninitialize()


def show_archive(archive: Path):
    if os.name != "nt":
        return
    archive = archive.absolute()
    try:
        select_archive_in_explorer(archive)
        print(f"已打开输出目录并选中 ZIP：{archive}", flush=True)
    except OSError as exc:
        try:
            os.startfile(str(archive.parent))
            print(f"未能选中 ZIP，已打开所在目录：{archive.parent}\nZIP 文件：{archive.name}", flush=True)
        except OSError:
            print(f"打开目录失败，请手动打开：{archive.parent}\nZIP 文件：{archive.name}\n原因：{exc}",
                  file=sys.stderr, flush=True)


def choose_upload(choice, upload_only=False):
    if upload_only or choice is not None:
        return upload_only or choice
    if sys.stdin is None or not sys.stdin.isatty():
        print("当前没有交互输入，仅在本机打包；自动上传请显式使用 --upload。", flush=True)
        return False
    print("\n本次打包是否上传到云端？\n  1. 仅本地打包（默认）\n  2. 打包并上传到云端", flush=True)
    while True:
        try:
            answer = input("请选择 1 / 2，直接回车选 1：").strip().lower()
        except EOFError:
            return False
        if answer in ("", "1", "n", "no", "否"):
            return False
        if answer in ("2", "y", "yes", "是"):
            return True
        print("请输入 1（仅本地）或 2（上传云端）。", flush=True)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-directory", "-OutputDirectory", type=Path)
    parser.add_argument("--sgsol-directory", "-SgsolDirectory", type=Path,
                        default=Path(os.environ.get("APPDATA", str(Path.home()))) / "SGSOL")
    parser.add_argument("--compression-tool", "-CompressionTool", type=str.lower,
                        choices=("auto", "7zip", "python", "windows"), default="auto",
                        help="auto uses 7-Zip Ultra; python/windows uses Python Deflate level 9")
    parser.add_argument("--cos-config", type=Path, default=PROJECT_ROOT / "cos-upload.local.json")
    upload = parser.add_mutually_exclusive_group()
    upload.add_argument("--upload", "-Upload", dest="upload", action="store_true", help="upload to COS without prompting")
    upload.add_argument("--no-upload", "-NoUpload", dest="upload", action="store_false", help="build locally without prompting")
    parser.set_defaults(upload=None)
    parser.add_argument("--version", help="override the staged release version without changing the working/local version")
    parser.add_argument("--upload-only", type=Path, help="retry uploading an existing ZIP without repackaging")
    parser.add_argument("--no-open", "-NoOpen", action="store_true")
    args = parser.parse_args(argv)
    if args.upload_only and (args.upload is False or args.output_directory or args.version):
        parser.error("--upload-only cannot be combined with --no-upload, --version or --output-directory")
    return args


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args(argv)
    archive = None
    try:
        should_upload = choose_upload(args.upload, bool(args.upload_only))
        print("本次模式：上传现有 ZIP。" if args.upload_only else
              "本次模式：打包并上传到云端。" if should_upload else "本次模式：仅本地打包，不上传云端。", flush=True)
        if args.upload_only:
            archive = args.upload_only.absolute()
        else:
            output = args.output_directory or PROJECT_ROOT / "release" / ("xiaochao-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3])
            archive = build_release(output, args.sgsol_directory, args.compression_tool, args.version)
        # Reveal the completed local archive immediately, even if cloud upload is slow or fails.
        if archive.is_file() and not args.no_open:
            show_archive(archive)
        if should_upload:
            result = upload_release(archive, load_settings(args.cos_config))
            print("COS release and version manifest uploaded.", flush=True)
            print("Object URL: " + result["url"], flush=True)
            print("Version URL: " + result["manifest_url"], flush=True)
            print("Download access follows the bucket's existing permissions.", flush=True)
        else:
            print("本地打包完成，未上传云端。", flush=True)
        return 0
    except UploadError as exc:
        print("Upload failed: " + str(exc), file=sys.stderr, flush=True)
        if archive and archive.is_file():
            print(f'ZIP retained. Retry: pack.cmd --upload-only "{archive}"', file=sys.stderr, flush=True)
        return 2
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        print("Package failed: " + str(exc), file=sys.stderr, flush=True)
        return 1
    except KeyboardInterrupt:
        print("\n已取消。", file=sys.stderr, flush=True)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
