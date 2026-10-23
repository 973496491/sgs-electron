"""Read/stamp release metadata and explicitly save packaging edits to the project."""
import json
import os
from pathlib import Path
import re
import tempfile
import zipfile


def parse_version(value):
    if not isinstance(value, str) or not re.fullmatch(r"(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})", value):
        raise ValueError("Version must contain three numeric components, e.g. 1.0.0.")
    return tuple(map(int, value.split(".")))


def read_version(path: Path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or "version" not in data:
        raise ValueError("version.json must be an object containing version.")
    value = data["version"]
    parse_version(value)
    return value


def stamp_script(text: str, version: str):
    parse_version(version)
    patterns = [(r"(?m)^(//[ \t]*@version[ \t]+)[^\r\n]+", lambda m: m[1] + version)]
    if re.search(r"\bconst\s+XIAOCHAO_VERSION\b", text):
        if re.search(r"\bconst\s+(?:_0x43f342|_0x38a6c4)\b", text):
            raise ValueError("Mixed unified and legacy script version declarations.")
        patterns.append((r'(?m)^([ \t]*const XIAOCHAO_VERSION = ")[^"\r\n]+(";)',
                         lambda m: m[1] + version + m[2]))
    else:
        # Previously published packages still contain the two legacy constants.
        patterns.extend((
            (r'(const _0x43f342 = ")[^"]+("[,]?)', lambda m: m[1] + version + m[2]),
            (r'(const _0x38a6c4 = ")[^"]+("[,]?)', lambda m: m[1] + version + m[2]),
        ))
    for pattern, replacement in patterns:
        text, count = re.subn(pattern, replacement, text)
        if count != 1:
            raise ValueError("The userscript version marker is missing or duplicated.")
    return text


def update_notes_match(text: str):
    matches = list(re.finditer(
        r'(?m)^([ \t]*const _0x378fb5\s*=\s*)("(?:[^"\\\r\n]|\\.)*")(?=\s*\[)', text))
    if len(matches) != 1 or len(re.findall(r'\bconst\s+_0x378fb5\b', text)) != 1:
        raise ValueError("The userscript update-notes marker is missing or duplicated.")
    return matches[0]


def read_update_notes(text: str):
    return json.loads(update_notes_match(text)[2])


def stamp_update_notes(text: str, notes: str):
    match = update_notes_match(text)
    # JSON strings are JS string literals too; preserve the existing semicolon-to-<br> chain.
    literal = json.dumps(notes, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    return text[:match.start(2)] + literal + text[match.end(2):]


def write_bytes_atomic(path: Path, content: bytes):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def save_project_metadata(project: Path, version=None, notes=None):
    """Validate before writing; restore earlier writes if the version-record commit fails."""
    script = project / "resources" / "daxiaochao.user.js"
    original = script.read_bytes()
    text = original.decode("utf-8")
    changes = []
    if version is not None:
        text = stamp_script(text, version)
        record = project / "version.json"
        before = record.read_bytes()
        current = read_version(record)
        if current != version:
            data = json.loads(before.decode("utf-8-sig"))
            data["version"] = version
            content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
            if b"\r\n" in before:
                content = content.replace("\n", "\r\n")
            encoding = "utf-8-sig" if before.startswith(b"\xef\xbb\xbf") else "utf-8"
            changes.append((record, before, content.encode(encoding)))
    if notes is not None:
        text = stamp_update_notes(text, notes)
    if text.encode("utf-8") != original:
        changes.insert(0, (script, original, text.encode("utf-8")))
    committed = []
    try:
        for path, before, content in changes:
            write_bytes_atomic(path, content)
            committed.append((path, before))
    except BaseException:
        for path, before in reversed(committed):
            write_bytes_atomic(path, before)
        raise


def stamp_release(output: Path, version: str):
    script = output / "files" / "三国杀打小抄.js"
    record = output / "files" / "version.json"
    text = script.read_bytes().decode("utf-8")
    stamped = stamp_script(text, version)
    if stamped != text:
        script.write_bytes(stamped.encode("utf-8"))
    if read_version(record) != version:
        data = json.loads(record.read_text(encoding="utf-8-sig"))
        data["version"] = version
        record.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def archive_version(archive: Path):
    with zipfile.ZipFile(archive) as bundle:
        records = [name for name in bundle.namelist() if name.endswith("/files/version.json")]
        if len(records) != 1:
            raise ValueError("ZIP must contain exactly one installed version.json.")
        data = json.loads(bundle.read(records[0]).decode("utf-8-sig"))
        if not isinstance(data, dict) or "version" not in data:
            raise ValueError("Packaged version.json must be an object containing version.")
        version = data["version"]
        parse_version(version)
        script_name = records[0][:-len("version.json")] + "三国杀打小抄.js"
        script = bundle.read(script_name).decode("utf-8")
        if stamp_script(script, version) != script:
            raise ValueError("The packaged script and version.json do not match.")
        return version
