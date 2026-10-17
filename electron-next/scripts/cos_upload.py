"""Upload release ZIPs with Tencent's official COS SDK; never log credentials."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import io
import json
import logging
import os
from pathlib import Path
import re
import time
from urllib.parse import quote
import zipfile

from release_version import archive_version, parse_version


class UploadError(Exception):
    pass


@dataclass(frozen=True)
class UploadSettings:
    bucket: str
    region: str
    prefix: str
    secret_id: str = field(repr=False)
    secret_key: str = field(repr=False)


def load_settings(config_path: Path) -> UploadSettings:
    data = {}
    if config_path.exists():
        try:
            data = json.loads(config_path.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as exc:
            raise UploadError(f"COS configuration could not be read: {config_path}") from exc
        if not isinstance(data, dict):
            raise UploadError("COS configuration must be a JSON object.")

    values = {}
    for name in ("bucket", "region", "prefix", "secret_id", "secret_key"):
        value = os.environ.get("COS_" + name.upper(), data.get(name, "releases/" if name == "prefix" else ""))
        if not isinstance(value, str):
            raise UploadError(f"COS configuration field must be text: {name}")
        values[name] = value.strip()
    missing = [name for name in ("bucket", "region", "secret_id", "secret_key") if not values[name]]
    if missing:
        raise UploadError(
            "Missing COS settings: " + ", ".join(missing) + ". Fill " + str(config_path)
            + " or set the corresponding COS_* environment variables."
        )
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*-[0-9]+", values["bucket"]):
        raise UploadError("COS bucket must include its APPID suffix, e.g. name-1250000000.")
    if not re.fullmatch(r"[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*", values["region"]):
        raise UploadError("Invalid COS region; use a region such as ap-guangzhou.")
    prefix = values["prefix"].strip("/")
    if ("\\" in prefix or any(ord(c) < 32 for c in prefix)
            or (prefix and any(p in (".", "..", "") for p in prefix.split("/")))):
        raise UploadError("COS prefix must be a relative object path, e.g. releases/.")
    values["prefix"] = prefix + "/" if prefix else ""
    return UploadSettings(**values)


def create_client(settings: UploadSettings):
    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError as exc:
        raise UploadError(
            "COS SDK is missing. Install scripts/requirements-release.txt with this Python interpreter."
        ) from exc
    sdk_logger = logging.getLogger("qcloud_cos")
    sdk_logger.addHandler(logging.NullHandler())
    sdk_logger.propagate = False
    sdk_logger.setLevel(logging.CRITICAL + 1)
    return CosS3Client(CosConfig(
        Region=settings.region, SecretId=settings.secret_id, SecretKey=settings.secret_key,
        Scheme="https", Timeout=60, VerifySSL=True,
    ), retry=0)


def upload_archive(archive: Path, settings: UploadSettings, client=None) -> dict:
    if not archive.is_file() or not zipfile.is_zipfile(archive):
        raise UploadError("Upload input must be an existing ZIP archive.")
    if archive.stat().st_size > 5 * 1024 ** 3:
        raise UploadError("This uploader uses PUT Object; ZIP files above 5 GB require multipart upload.")
    key = settings.prefix + archive.name
    return _upload_object(settings, key, lambda: archive.open("rb"), "application/zip", client=client)


def _upload_object(settings, key, open_body, content_type, client=None, **headers):
    client = client or create_client(settings)
    print(f"Uploading to COS: {settings.bucket}/{key}", flush=True)
    for attempt in range(3):
        try:
            # Reopen on every attempt so a retry always starts at byte zero.
            with open_body() as body:
                response = client.put_object(
                    Bucket=settings.bucket, Key=key, Body=body,
                    ContentType=content_type, **headers,
                )
            etag = next((v for k, v in response.items() if k.lower() == "etag"), "")
            if not etag:
                raise UploadError("COS response did not confirm object creation (missing ETag). Check the bucket region.")
            url = f"https://{settings.bucket}.cos.{settings.region}.myqcloud.com/{quote(key, safe='/')}"
            return {"bucket": settings.bucket, "key": key, "url": url, "etag": etag}
        except UploadError:
            raise
        except Exception as exc:
            # SDK exceptions can contain signed URLs. Report only bounded service identifiers.
            from qcloud_cos.cos_exception import CosClientError, CosServiceError
            if isinstance(exc, CosServiceError):
                status = exc.get_status_code()
                retry = status == 429 or status >= 500
                code = re.sub(r"[^A-Za-z0-9_.-]", "", str(exc.get_error_code()))[:80]
                detail = f"HTTP {status}, {code}"
            elif isinstance(exc, CosClientError):
                retry, detail = True, "network/client error"
            else:
                raise UploadError("COS upload failed (" + type(exc).__name__ + ").") from None
            if not retry or attempt == 2:
                raise UploadError("COS upload failed: " + detail + ".") from None
            print(f"Upload interrupted ({detail}); retry {attempt + 1}/2.", flush=True)
            time.sleep(attempt + 1)
    raise UploadError("COS upload did not complete.")


def upload_release(archive: Path, settings: UploadSettings) -> dict:
    try:
        version = archive_version(archive)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
        raise UploadError("Cannot publish version: " + str(exc)) from None
    client = create_client(settings)
    manifest_key = settings.prefix + "version.json"
    # A retry uses the ZIP's own version, never the possibly changed working version.
    from qcloud_cos.cos_exception import CosServiceError, CosClientError
    try:
        response = client.get_object(Bucket=settings.bucket, Key=manifest_key)
        stream = response["Body"].get_raw_stream()
        try:
            payload = stream.read(65537)
        finally:
            stream.close()
        if len(payload) > 65536:
            raise UploadError("Existing remote version manifest is too large.")
        remote = json.loads(payload.decode("utf-8-sig"))
        if not isinstance(remote, dict):
            raise ValueError("Invalid remote manifest.")
        if parse_version(remote["version"]) > parse_version(version):
            raise UploadError("Refusing to replace a newer remote version with " + version + ".")
    except CosServiceError as exc:
        if exc.get_status_code() != 404:
            raise UploadError("Cannot read remote version: HTTP " + str(exc.get_status_code()) + ".") from None
    except CosClientError:
        raise UploadError("Cannot read remote version: network/client error.") from None
    except (ValueError, KeyError, UnicodeError):
        raise UploadError("Existing remote version manifest is invalid.") from None
    result = upload_archive(archive, settings, client=client)
    manifest = {
        "version": version,
        "packageKey": result["key"],
        "publishedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    payload = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    published = _upload_object(settings, manifest_key, lambda: io.BytesIO(payload),
                               "application/json; charset=utf-8", client=client,
                               CacheControl="no-store, max-age=0")
    return dict(result, version=version, manifest_url=published["url"])
