"""Version stamping is limited to the staged release; working files stay unchanged."""
import json
from pathlib import Path
import re
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
    patterns = (
        (r"(?m)^(//\s*@version\s+)[^\r\n]+", lambda m: m[1] + version),
        (r'(const _0x43f342 = ")[^"]+("[,]?)', lambda m: m[1] + version + m[2]),
        (r'(const _0x38a6c4 = ")[^"]+("[,]?)', lambda m: m[1] + version + m[2]),
    )
    for pattern, replacement in patterns:
        text, count = re.subn(pattern, replacement, text)
        if count != 1:
            raise ValueError("The userscript version marker is missing or duplicated.")
    return text


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
