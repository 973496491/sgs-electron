"""Unified/legacy version stamping and archive consistency; temporary files only."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import release_version
from release_version import archive_version, stamp_script, read_update_notes, save_project_metadata, stamp_update_notes

UNIFIED = '// @version      0.0.9\n(function () {\n  const XIAOCHAO_VERSION = "0.0.9";\n  use(XIAOCHAO_VERSION);\n})();\n'
LEGACY = '// @version      0.0.9\nconst _0x43f342 = "0.0.9";\nconst _0x38a6c4 = "0.0.9";\n'
NOTES = '  const _0x378fb5 =\n      "旧说明"\n        [decode(555)](/；/g, decode(526))[decode(555)](/;/g, decode(526));\n'


class VersionTests(unittest.TestCase):
    def test_notes_escape_js_literals_and_preserve_surrounding_code_and_newlines(self):
        notes = '修复 "引号"；路径 C:\\游戏;下一行\n\u2028\u2029 & | % !'
        for newline in ('\n', '\r\n'):
            source = (UNIFIED + NOTES).replace('\n', newline)
            result = stamp_update_notes(source, notes)
            self.assertEqual(read_update_notes(result), notes)
            self.assertEqual(stamp_update_notes(result, '旧说明'), source)
            self.assertNotIn('\u2028', result)
            self.assertNotIn('\u2029', result)

    def test_project_validation_failure_does_not_write_either_file(self):
        with tempfile.TemporaryDirectory(prefix='xc-project-metadata-') as directory:
            project = Path(directory)
            script = project / 'resources/daxiaochao.user.js'
            script.parent.mkdir()
            record = project / 'version.json'
            for source, version, notes in [(UNIFIED, 'bad', None), (UNIFIED, '2.0.0', 'new'),
                                           (UNIFIED + NOTES * 2, '2.0.0', 'new')]:
                script.write_bytes(source.encode('utf-8'))
                record.write_bytes(b'{"version":"0.0.9"}')
                with self.assertRaises(ValueError):
                    save_project_metadata(project, version=version, notes=notes)
                self.assertEqual(script.read_bytes(), source.encode('utf-8'))
                self.assertEqual(record.read_bytes(), b'{"version":"0.0.9"}')

    def test_record_write_failure_restores_script_and_cleans_temporary_files(self):
        with tempfile.TemporaryDirectory(prefix='xc-project-metadata-') as directory:
            project = Path(directory)
            script = project / 'resources/daxiaochao.user.js'
            script.parent.mkdir()
            script.write_bytes(UNIFIED.encode('utf-8'))
            record = project / 'version.json'
            record.write_bytes(b'{"version":"0.0.9"}')
            replace = release_version.os.replace

            def fail_record(source, destination):
                if destination == record:
                    raise OSError('fixture write failure')
                replace(source, destination)

            with patch.object(release_version.os, 'replace', side_effect=fail_record), self.assertRaises(OSError):
                save_project_metadata(project, version='2.0.0')
            self.assertEqual(script.read_bytes(), UNIFIED.encode('utf-8'))
            self.assertEqual(record.read_bytes(), b'{"version":"0.0.9"}')
            self.assertEqual(list(project.rglob('*.tmp')), [])

    def test_unified_stamp_changes_only_metadata_and_constant(self):
        for newline in ("\n", "\r\n"):
            source = UNIFIED.replace("\n", newline)
            result = stamp_script(source, "2.3.4")
            self.assertEqual(result, source.replace("0.0.9", "2.3.4"))
            self.assertEqual(stamp_script(result, "2.3.4"), result)

    def test_legacy_packages_remain_supported(self):
        self.assertEqual(stamp_script(LEGACY, "2.3.4"), LEGACY.replace("0.0.9", "2.3.4"))

    def test_missing_duplicate_and_mixed_markers_fail(self):
        for source in (
            UNIFIED.replace("// @version      0.0.9\n", ""),
            UNIFIED + "// @version 0.0.9\n",
            UNIFIED.replace('  const XIAOCHAO_VERSION = "0.0.9";\n', ""),
            UNIFIED + 'const XIAOCHAO_VERSION = "0.0.9";\n',
            UNIFIED + 'const _0x43f342 = "0.0.9";\n',
            LEGACY.replace('const _0x38a6c4 = "0.0.9";\n', ""),
        ):
            with self.subTest(source=source), self.assertRaises(ValueError):
                stamp_script(source, "2.3.4")

    def test_archive_verifies_unified_and_legacy_versions(self):
        with tempfile.TemporaryDirectory(prefix="xc-version-archive-") as directory:
            for index, source in enumerate((UNIFIED, LEGACY)):
                archive = Path(directory) / f"{index}.zip"
                with zipfile.ZipFile(archive, "w") as bundle:
                    bundle.writestr("release/files/version.json", json.dumps({"version": "2.3.4"}))
                    bundle.writestr("release/files/三国杀打小抄.js", stamp_script(source, "2.3.4"))
                self.assertEqual(archive_version(archive), "2.3.4")

    def test_archive_rejects_constant_drift_even_when_metadata_matches_record(self):
        with tempfile.TemporaryDirectory(prefix="xc-version-archive-") as directory:
            archive = Path(directory) / "drift.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("release/files/version.json", '{"version":"0.0.9"}')
                bundle.writestr("release/files/三国杀打小抄.js",
                                UNIFIED.replace('XIAOCHAO_VERSION = "0.0.9"', 'XIAOCHAO_VERSION = "9.8.7"'))
            with self.assertRaisesRegex(ValueError, "do not match"):
                archive_version(archive)


if __name__ == "__main__":
    unittest.main(verbosity=2)
