"""Use the real COS SDK against loopback HTTP; no cloud account or credentials required."""

from contextlib import redirect_stdout, redirect_stderr
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.parse import unquote
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import cos_upload
import package_release
from release_version import archive_version
from qcloud_cos import CosConfig, CosS3Client


class CosHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_PUT(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        self.server.requests.append((self.path, dict(self.headers), body))
        status = self.server.statuses.pop(0) if self.server.statuses else 200
        self.send_response(status)
        if status == 200:
            self.server.objects[unquote(self.path)] = body
            self.send_header("ETag", '"fixture-etag"')
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif status == 302:
            self.send_header("Location", "http://127.0.0.1:1/must-not-follow")
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            code = "AccessDenied" if status == 403 else "InternalError"
            content = f"<Error><Code>{code}</Code><Message>secret-must-not-appear</Message><RequestId>fixture</RequestId></Error>".encode()
            self.send_header("Content-Type", "application/xml")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

    def do_GET(self):
        self.server.get_requests.append(self.path)
        data = self.server.objects.get(unquote(self.path))
        status = self.server.get_status or (200 if data is not None else 404)
        if status != 200:
            data = b'<Error><Code>NoSuchKey</Code><Message>fixture</Message><RequestId>fixture</RequestId></Error>'
        self.send_response(status)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Content-Type', 'application/json' if status == 200 else 'application/xml')
        self.end_headers()
        self.wfile.write(data)


class ReleaseUploadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="xc-upload-tests-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / "小抄 测试.zip"
        with zipfile.ZipFile(self.archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
            bundle.writestr("发布/files/三国杀打小抄.js", '// @version      1.0.0\nconst _0x43f342 = "1.0.0";\nconst _0x38a6c4 = "1.0.0";\n' + "// test payload\n" * 500)
            bundle.writestr("发布/files/version.json", '{"version":"1.0.0"}')
        self.settings = cos_upload.UploadSettings("fixture-1250000000", "ap-guangzhou", "releases/中文/",
                                                  "fixture-id", "fixture-secret")
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), CosHandler)
        self.server.statuses, self.server.requests = [], []
        self.server.objects, self.server.get_requests, self.server.get_status = {}, [], None
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        config = CosConfig(SecretId=self.settings.secret_id, SecretKey=self.settings.secret_key,
                           Region=self.settings.region,
                           Domain=f"127.0.0.1:{self.server.server_port}", Scheme="http", Timeout=3,
                           Proxies={"http": "", "https": ""})
        self.client = CosS3Client(config, retry=0)
        self.factory = patch.object(cos_upload, "create_client", return_value=self.client)
        self.factory.start()
        self.addCleanup(self.factory.stop)
        self.env = patch.dict(os.environ, {k: v for k, v in os.environ.items() if not k.startswith("COS_")}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def upload(self):
        with redirect_stdout(io.StringIO()):
            return cos_upload.upload_archive(self.archive, self.settings)

    def test_real_sdk_uploads_identical_bytes_with_signature_and_encoded_key(self):
        result = self.upload()
        request_path, headers, body = self.server.requests[0]
        self.assertEqual(body, self.archive.read_bytes())
        self.assertEqual(unquote(request_path), "/" + self.settings.prefix + self.archive.name)
        self.assertEqual(headers["Content-Type"], "application/zip")
        lowered = {k.lower(): v for k, v in headers.items()}
        self.assertIn("q-signature=", lowered["authorization"])
        self.assertNotIn("x-cos-security-token", lowered)
        self.assertEqual(result["etag"], '"fixture-etag"')
        self.assertTrue(result["url"].startswith("https://fixture-1250000000.cos.ap-guangzhou.myqcloud.com/"))

    def test_retry_reopens_the_complete_zip(self):
        self.server.statuses = [503, 200]
        with patch.object(cos_upload.time, "sleep"):
            self.upload()
        self.assertEqual(len(self.server.requests), 2)
        self.assertTrue(all(body == self.archive.read_bytes() for _, _, body in self.server.requests))

    def test_permission_failure_does_not_retry_or_expose_response_secrets(self):
        self.server.statuses = [403]
        with self.assertRaises(cos_upload.UploadError) as error:
            self.upload()
        self.assertIn("403", str(error.exception))
        self.assertNotIn("secret-must-not-appear", str(error.exception))
        self.assertEqual(len(self.server.requests), 1)

    def test_retry_budget_stops_and_keeps_original_zip(self):
        self.server.statuses = [503, 503, 503]
        before = self.archive.read_bytes()
        with patch.object(cos_upload.time, "sleep"), self.assertRaises(cos_upload.UploadError):
            self.upload()
        self.assertEqual(len(self.server.requests), 3)
        self.assertEqual(self.archive.read_bytes(), before)

    def test_redirect_is_not_reported_as_upload_success(self):
        self.server.statuses = [302]
        with self.assertRaisesRegex(cos_upload.UploadError, "missing ETag"):
            self.upload()
        self.assertEqual(len(self.server.requests), 1)

    def test_settings_and_environment_override_without_secret_repr(self):
        config = self.root / "cos.json"
        config.write_text(json.dumps({"bucket": "fixture-1250000000", "region": "ap-guangzhou",
                                     "secret_id": "file-id", "secret_key": "file-secret"}), encoding="utf-8")
        with patch.dict(os.environ, {"COS_SECRET_ID": "env-id", "COS_SECRET_KEY": "env-secret"}):
            settings = cos_upload.load_settings(config)
        self.assertEqual(settings.secret_id, "env-id")
        self.assertEqual(settings.prefix, "releases/")
        self.assertNotIn("env-secret", repr(settings))
        self.assertNotIn("env-id", repr(settings))

    def test_missing_configuration_reports_fields_without_network(self):
        with self.assertRaisesRegex(cos_upload.UploadError, "Missing COS settings"):
            cos_upload.load_settings(self.root / "missing.json")
        self.assertEqual(self.server.requests, [])

    def test_explicit_upload_packs_then_reports_upload_failure_and_keeps_zip(self):
        output = self.root / "package"
        capture = io.StringIO()
        with redirect_stdout(capture), redirect_stderr(capture):
            code = package_release.main(["--output-directory", str(output), "--compression-tool", "python",
                                         "--cos-config", str(self.root / "missing.json"), "--no-open", "--upload"])
        self.assertEqual(code, 2)
        self.assertTrue(zipfile.is_zipfile(str(output) + ".zip"))
        self.assertIn("--upload-only", capture.getvalue())
        with zipfile.ZipFile(str(output) + ".zip") as bundle:
            mapping = json.loads((package_release.PROJECT_ROOT / 'release-files.json').read_text(encoding='utf-8'))
            self.assertEqual(len(bundle.namelist()), len(mapping['files']) + len(mapping['packageFiles']) + 1)
            self.assertFalse(any("cos-upload" in name or ".venv" in name for name in bundle.namelist()))
        self.assertEqual(self.server.requests, [])

    def test_upload_only_does_not_rebuild_archive(self):
        original = self.archive.read_bytes()
        with patch.object(package_release, "load_settings", return_value=self.settings), \
                patch.object(package_release, "build_release", side_effect=AssertionError("must not rebuild")), \
                redirect_stdout(io.StringIO()):
            self.assertEqual(package_release.main(["--upload-only", str(self.archive), "--no-open"]), 0)
        self.assertEqual(self.archive.read_bytes(), original)
        self.assertEqual(len(self.server.requests), 2)
        manifest = json.loads(self.server.requests[-1][2])
        self.assertEqual(manifest['version'], '1.0.0')
        self.assertEqual(manifest['packageKey'], self.settings.prefix + self.archive.name)

    def test_publish_uploads_zip_before_uncached_version_manifest(self):
        with redirect_stdout(io.StringIO()):
            result = cos_upload.upload_release(self.archive, self.settings)
        self.assertEqual(len(self.server.requests), 2)
        self.assertEqual(self.server.requests[0][2], self.archive.read_bytes())
        path, headers, body = self.server.requests[1]
        self.assertTrue(unquote(path).endswith('/version.json'))
        self.assertEqual(headers['Cache-Control'], 'no-store, max-age=0')
        self.assertEqual(json.loads(body)['version'], '1.0.0')
        self.assertEqual(result['version'], '1.0.0')

    def test_archive_failure_does_not_publish_version(self):
        self.server.statuses = [403]
        with redirect_stdout(io.StringIO()), self.assertRaises(cos_upload.UploadError):
            cos_upload.upload_release(self.archive, self.settings)
        self.assertEqual(len(self.server.requests), 1)
        self.assertNotIn('/' + self.settings.prefix + 'version.json', self.server.objects)

    def test_manifest_failure_retains_zip_and_can_be_retried(self):
        self.server.statuses = [200, 403]
        with redirect_stdout(io.StringIO()), self.assertRaises(cos_upload.UploadError):
            cos_upload.upload_release(self.archive, self.settings)
        self.assertTrue(self.archive.exists())
        self.assertNotIn('/' + self.settings.prefix + 'version.json', self.server.objects)
        with redirect_stdout(io.StringIO()):
            result = cos_upload.upload_release(self.archive, self.settings)
        self.assertEqual(result['version'], '1.0.0')

    def test_old_retry_cannot_replace_newer_remote_version(self):
        self.server.objects['/' + self.settings.prefix + 'version.json'] = b'{"version":"2.0.0"}'
        with self.assertRaisesRegex(cos_upload.UploadError, 'newer remote version'):
            cos_upload.upload_release(self.archive, self.settings)
        self.assertEqual(self.server.requests, [])

    def test_forbidden_version_read_prevents_publication(self):
        self.server.get_status = 403
        with self.assertRaisesRegex(cos_upload.UploadError, 'HTTP 403'):
            cos_upload.upload_release(self.archive, self.settings)
        self.assertEqual(self.server.requests, [])

    def test_invalid_remote_manifest_is_not_overwritten(self):
        for content in (b'{bad', b'[]', b'{"version":"bad"}'):
            self.server.objects['/' + self.settings.prefix + 'version.json'] = content
            with self.assertRaisesRegex(cos_upload.UploadError, 'manifest is invalid'):
                cos_upload.upload_release(self.archive, self.settings)
            self.assertEqual(self.server.requests, [])

    def test_staged_version_override_does_not_change_working_script_or_record(self):
        script = package_release.PROJECT_ROOT / 'resources/daxiaochao.user.js'
        record = package_release.PROJECT_ROOT / 'version.json'
        before = (script.read_bytes(), record.read_bytes())
        with redirect_stdout(io.StringIO()):
            archive = package_release.build_release(self.root / 'versioned', self.root / 'roaming', 'python', '9.8.7')
        self.assertEqual(archive_version(archive), '9.8.7')
        self.assertEqual((script.read_bytes(), record.read_bytes()), before)

    def test_mapped_path_traversal_is_rejected(self):
        for relative in ("../secret.txt", "a/../../secret.txt", "C:\\secret.txt", "a/file:stream", "a/./b", "a\nfile"):
            with self.subTest(relative=relative), self.assertRaises(ValueError):
                package_release.release_path(self.root, relative)


if __name__ == "__main__":
    unittest.main(verbosity=2)
