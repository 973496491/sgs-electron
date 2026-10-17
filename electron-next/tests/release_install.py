"""Exercise the real Windows installer only in isolated temporary directories."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import uuid
import zipfile

PROJECT = Path(__file__).resolve().parent.parent
POWERSHELL = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='xc-install-tests-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target = self.root / '安装 [目录]' / 'SGSOL'
        self.target.mkdir(parents=True)
        self.old = {'三国杀打小抄.js': b'// @version 0.0.9\n// old script',
                    'modules/a.js': b'old a', 'modules/b.js': b'old b', 'version.json': b'{"version":"0.0.9"}',
                    'config.json': b'{"keep":true}', 'cos-update.local.json': b'{"keep":"private fixture"}'}
        for name, content in self.old.items():
            path = self.target / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        self.mapping = {'installProtocol': 1, 'files': [
            {'sourceRoot': 'repo', 'source': name, 'target': name}
            for name in ('三国杀打小抄.js', 'modules/a.js', 'modules/b.js', 'version.json')],
            'packageFiles': [], 'remove': []}
        self.files = {'三国杀打小抄.js': b'// @version 1.0.0\n// new script',
                      'modules/a.js': b'new a', 'modules/b.js': b'new b', 'version.json': b'{"version":"1.0.0"}'}

    def archive(self, extra=None):
        archive = self.root / ('release-' + uuid.uuid4().hex + '.zip')
        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
            bundle.writestr('发布 包/release-files.json', json.dumps(self.mapping))
            for name, content in self.files.items():
                bundle.writestr('发布 包/files/' + name, content)
            if extra:
                for name, content in extra.items():
                    bundle.writestr(name, content)
        return archive

    def run_installer(self, archive=None, expected='1.0.0', script=None, recovery=False, show_progress=False):
        args = [str(POWERSHELL), '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                '-File', str(script or PROJECT / 'scripts/install.ps1'), '-TargetDirectory', str(self.target)]
        if recovery:
            args += ['-RecoverOnly']
        else:
            args += ['-ArchivePath', str(archive or self.archive()), '-ExpectedVersion', expected]
        if show_progress:
            args += ['-ShowProgress']
        result = subprocess.run(args, capture_output=True, encoding='utf-8', errors='replace',
                                creationflags=subprocess.CREATE_NO_WINDOW)
        if show_progress:
            return result.returncode, result.stdout + result.stderr
        line = next((line for line in result.stdout.splitlines() if line.startswith('XC_INSTALL_RESULT:')), None)
        self.assertIsNotNone(line, result.stdout + result.stderr)
        return result.returncode, json.loads(line[len('XC_INSTALL_RESULT:'):])

    def assert_old(self):
        for name, content in self.old.items():
            self.assertEqual((self.target / name).read_bytes(), content, name)

    def instrumented(self, body):
        folder = self.root / 'installer'
        folder.mkdir()
        source = (PROJECT / 'scripts/install.ps1').read_text(encoding='utf-8-sig')
        marker = 'function Copy-Atomic([string]$Source, [string]$Target) {'
        source = source.replace(marker, marker + '\n' + body, 1)
        script = folder / 'install.ps1'
        # Keep param() at the beginning of the real script.
        script.write_text(source.replace("$ErrorActionPreference = 'Stop'", "$script:testWrites = 0\n$ErrorActionPreference = 'Stop'", 1), encoding='utf-8-sig')
        shutil.copyfile(PROJECT / 'scripts/release-common.ps1', folder / 'release-common.ps1')
        return script

    def test_valid_zip_installs_and_preserves_user_configuration(self):
        archive = self.archive()
        status, result = self.run_installer(archive)
        self.assertEqual(status, 0, result)
        for name, content in self.files.items():
            self.assertEqual((self.target / name).read_bytes(), content)
        for name in ('config.json', 'cos-update.local.json'):
            self.assertEqual((self.target / name).read_bytes(), self.old[name])
        self.assertTrue(archive.exists())
        self.assertFalse((self.target / '.xiaochao-install-state.json').exists())
        self.assertEqual(result['version'], '1.0.0')

    def test_version_record_is_the_final_write(self):
        log = self.root / 'writes.txt'
        script = self.instrumented("    [IO.File]::AppendAllText('" + str(log).replace("'", "''") + "', [IO.Path]::GetFileName($Target) + [Environment]::NewLine)")
        status, result = self.run_installer(script=script)
        self.assertEqual(status, 0, result)
        writes = log.read_text(encoding='utf-8').splitlines()
        self.assertEqual(writes[-2:], ['三国杀打小抄.js', 'version.json'])

    def test_visible_progress_reports_all_steps_verified_success_and_log(self):
        status, output = self.run_installer(show_progress=True)
        self.assertEqual(status, 0, output)
        positions = [output.index(f'[{i}/7]') for i in range(1, 8)]
        self.assertEqual(positions, sorted(positions))
        self.assertIn('[4/4] 已写入：version.json', output)
        self.assertIn('安装成功', output)
        self.assertIn('已安装版本：1.0.0', output)
        self.assertIn(str(self.target), output)
        self.assertIn('4 个文件全部写入并校验通过', output)
        self.assertIn('完全退出并重新打开客户端', output)
        self.assertNotIn('XC_INSTALL_RESULT:', output)
        logs = list((self.target / '.xiaochao-install-logs').glob('*.log'))
        self.assertEqual(len(logs), 1)
        text = logs[0].read_text(encoding='utf-8-sig')
        self.assertIn('安装成功', text)
        self.assertIn('校验通过：modules/a.js', text)

    def test_visible_failure_reports_step_and_rollback_without_success(self):
        script = self.instrumented("    $script:testWrites++\n    if ($script:testWrites -eq 2) { throw 'simulated-write-failure' }")
        status, output = self.run_installer(script=script, show_progress=True)
        self.assertEqual(status, 1, output)
        self.assertIn('失败步骤：安装文件并清理废弃文件', output)
        self.assertIn('simulated-write-failure', output)
        self.assertIn('已恢复原文件，本次更新未安装', output)
        self.assertNotIn('安装成功', output)
        self.assert_old()

    def test_content_verification_detects_a_silent_failed_copy_and_restores(self):
        script = self.instrumented("    $script:testWrites++\n    if ($script:testWrites -eq 1) { return }")
        status, result = self.run_installer(script=script)
        self.assertEqual(status, 1, result)
        self.assertEqual(result['code'], 'installed-file-mismatch')
        self.assertTrue(result['restored'])
        self.assert_old()

    def test_failure_after_first_replacement_restores_all_originals(self):
        script = self.instrumented("    $script:testWrites++\n    if ($script:testWrites -eq 2) { throw 'simulated-write-failure' }")
        status, result = self.run_installer(script=script)
        self.assertEqual(status, 1, result)
        self.assertTrue(result['restored'])
        self.assert_old()
        self.assertFalse((self.target / '.xiaochao-install-state.json').exists())

    def test_archive_traversal_is_rejected_before_business_changes(self):
        status, result = self.run_installer(self.archive({'发布 包/../../outside.txt': 'bad'}))
        self.assertNotEqual(status, 0)
        self.assert_old()
        self.assertFalse((self.root / 'outside.txt').exists())

    def test_old_package_without_install_protocol_is_rejected(self):
        self.mapping.pop('installProtocol')
        status, result = self.run_installer()
        self.assertEqual(status, 1)
        self.assertEqual(result['code'], 'unsupported-install-protocol')
        self.assert_old()

    def test_duplicate_windows_paths_are_rejected(self):
        status, result = self.run_installer(self.archive({'发布 包/files/MODULES/A.js': 'duplicate'}))
        self.assertEqual(status, 1, result)
        self.assertEqual(result['code'], 'duplicate-archive-path')
        self.assert_old()

    def test_zip_symbolic_links_are_rejected(self):
        archive = self.archive()
        info = zipfile.ZipInfo('发布 包/files/link')
        info.create_system = 3
        info.external_attr = (0o120777 << 16)
        with zipfile.ZipFile(archive, 'a') as bundle:
            bundle.writestr(info, '../../outside')
        status, result = self.run_installer(archive)
        self.assertEqual(status, 1, result)
        self.assertEqual(result['code'], 'linked-archive-entry')
        self.assert_old()

    def test_missing_file_and_version_mismatch_do_not_modify_business_files(self):
        for missing in (True, False):
            saved = self.files.copy()
            if missing:
                del self.files['modules/b.js']
            else:
                self.files['version.json'] = b'{"version":"1.1.0"}'
            status, result = self.run_installer()
            self.assertEqual(status, 1, result)
            self.assert_old()
            self.files = saved

    def test_expected_version_and_downgrade_are_enforced(self):
        status, result = self.run_installer(expected='2.0.0')
        self.assertEqual(result['code'], 'unexpected-package-version')
        self.assert_old()
        (self.target / '三国杀打小抄.js').write_text('// @version 2.0.0\n')
        status, result = self.run_installer()
        self.assertEqual(result['code'], 'refuse-downgrade')
        self.assertEqual((self.target / '三国杀打小抄.js').read_text(), '// @version 2.0.0\n')

    def test_credentials_and_install_journal_cannot_be_package_targets(self):
        for name in ('cos-update.local.json', 'config.json', '.xiaochao-install-state.json'):
            self.mapping['files'].append({'sourceRoot': 'repo', 'source': name, 'target': name})
            self.files[name] = b'bad'
            status, result = self.run_installer()
            self.assertEqual(result['code'], 'reserved-user-file')
            self.assert_old()
            self.mapping['files'].pop()
            del self.files[name]

    def test_pending_interrupted_install_is_restored_before_loading(self):
        work_id = uuid.uuid4().hex
        work = self.target / '.xiaochao-install-work' / work_id
        (work / 'backup').mkdir(parents=True)
        records = []
        for i, (name, content) in enumerate(self.old.items()):
            if name not in self.files:
                continue
            (work / 'backup' / str(i)).write_bytes(content)
            records.append({'target': name, 'existed': True, 'backup': 'backup/' + str(i)})
            (self.target / name).write_bytes(self.files[name])
        journal = self.target / '.xiaochao-install-state.json'
        journal.write_text(json.dumps({'protocol': 1, 'workId': work_id, 'records': records}), encoding='utf-8')
        status, result = self.run_installer(recovery=True)
        self.assertEqual(status, 0, result)
        self.assert_old()
        self.assertFalse(journal.exists())

    def test_missing_recovery_backup_is_preserved_as_an_error(self):
        journal = self.target / '.xiaochao-install-state.json'
        journal.write_text(json.dumps({'protocol': 1, 'workId': uuid.uuid4().hex,
                                      'records': [{'target': 'modules/a.js', 'existed': True, 'backup': 'backup/0'}]}))
        status, result = self.run_installer(recovery=True)
        self.assertEqual(status, 3)
        self.assertFalse(result['restored'])
        self.assertTrue(journal.exists())

    def test_another_installer_lock_prevents_concurrent_writes(self):
        lock = self.target / '.xiaochao-install.lock'
        command = "$f=[IO.File]::Open('" + str(lock).replace("'", "''") + "','OpenOrCreate','ReadWrite','None');[Console]::Out.WriteLine('READY');Start-Sleep -Seconds 20"
        holder = subprocess.Popen([str(POWERSHELL), '-NoProfile', '-Command', command], stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            self.assertEqual(holder.stdout.readline().strip(), 'READY')
            status, result = self.run_installer()
            self.assertEqual(status, 2, result)
            self.assert_old()
        finally:
            holder.terminate()
            holder.communicate(timeout=10)


if __name__ == '__main__':
    unittest.main(verbosity=2)
