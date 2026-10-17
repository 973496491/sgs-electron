"""Unified/legacy version stamping and archive consistency; temporary files only."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from release_version import archive_version, stamp_script

UNIFIED = '// @version      0.0.9\n(function () {\n  const XIAOCHAO_VERSION = "0.0.9";\n  use(XIAOCHAO_VERSION);\n})();\n'
LEGACY = '// @version      0.0.9\nconst _0x43f342 = "0.0.9";\nconst _0x38a6c4 = "0.0.9";\n'


class VersionTests(unittest.TestCase):
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
