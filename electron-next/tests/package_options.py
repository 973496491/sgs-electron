"""Verify upload choices and output-folder handling without publishing or opening UI."""
from contextlib import redirect_stdout, redirect_stderr
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import package_release as release
from cos_upload import UploadError
from release_version import read_update_notes, read_version


class Console(io.StringIO):
    def isatty(self):
        return True


class PackageOptionsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='xc-package-options-')
        self.addCleanup(self.temp.cleanup)
        self.archive = Path(self.temp.name) / '中文 空格 [测试],& package.zip'
        self.archive.write_bytes(b'fixture')
        self.project = Path(self.temp.name) / 'project'
        self.script = self.project / 'resources/daxiaochao.user.js'
        self.script.parent.mkdir(parents=True)
        self.script.write_bytes(('// @version      1.0.3\r\n'
                                'const XIAOCHAO_VERSION = "1.0.3";\r\n'
                                'const _0x378fb5 =\r\n  "旧说明"\r\n'
                                '  [decode(555)](/；/g, decode(526))[decode(555)](/;/g, decode(526));\r\n').encode('utf-8'))
        (self.project / 'version.json').write_bytes(b'{"version":"1.0.3","keep":true}\r\n')
        self.original_script = self.script.read_bytes()
        self.original_record = (self.project / 'version.json').read_bytes()

    def run_main(self, answer, flags=(), upload_error=None, metadata_answer='\n\n'):
        capture, events = io.StringIO(), []

        def upload(*_):
            events.append('upload')
            if upload_error:
                raise upload_error
            return {'url': 'fixture', 'manifest_url': 'fixture-version'}

        with patch.object(sys, 'stdin', Console(metadata_answer + answer)), redirect_stdout(capture), redirect_stderr(capture), \
                patch.object(release, 'PROJECT_ROOT', self.project), \
                patch.object(release, 'build_release', return_value=self.archive) as build, \
                patch.object(release, 'load_settings') as settings, \
                patch.object(release, 'upload_release', side_effect=upload) as publish, \
                patch.object(release, 'show_archive', side_effect=lambda _: events.append('reveal')) as reveal:
            status = release.main(list(flags))
        return status, capture.getvalue(), build, settings, publish, reveal, events

    def test_enter_defaults_to_local_without_reading_credentials(self):
        status, output, build, settings, upload, reveal, events = self.run_main('\n')
        self.assertEqual(status, 0)
        self.assertIn('是否上传到云端', output)
        self.assertIn('本地打包完成，未上传云端', output)
        build.assert_called_once()
        settings.assert_not_called()
        upload.assert_not_called()
        reveal.assert_called_once_with(self.archive)
        self.assertEqual(events, ['reveal'])
        self.assertEqual(self.script.read_bytes(), self.original_script)
        self.assertEqual((self.project / 'version.json').read_bytes(), self.original_record)
        self.assertLess(output.index('本次打包版本'), output.index('本次更新文案'))
        self.assertLess(output.index('本次更新文案'), output.index('是否上传到云端'))

    def test_version_is_saved_before_notes_are_requested_and_pack_uses_it(self):
        notes = '修复 "引号"；路径 C:\\测试 & | % !;新增功能'

        def answer(prompt):
            if '本次打包版本' in prompt:
                return '1.0.4'
            self.assertEqual(read_version(self.project / 'version.json'), '1.0.4')
            self.assertIn('XIAOCHAO_VERSION = "1.0.4"', self.script.read_text(encoding='utf-8'))
            return notes

        with patch('builtins.input', side_effect=answer):
            status, _, build, _, _, _, _ = self.run_main('', ['--no-upload'])
        self.assertEqual(status, 0)
        self.assertEqual(build.call_args.args[-1], '1.0.4')
        self.assertEqual(read_update_notes(self.script.read_text(encoding='utf-8')), notes)
        self.assertTrue(json.loads((self.project / 'version.json').read_text())['keep'])

    def test_bad_version_reprompts_and_blank_notes_keep_original(self):
        status, output, build, _, _, _, _ = self.run_main('1\n', metadata_answer='1.2\n01.2.3\n2.3.4\n\n')
        self.assertEqual(status, 0)
        self.assertEqual(output.count('版本格式应为三段数字'), 2)
        self.assertEqual(build.call_args.args[-1], '2.3.4')
        self.assertEqual(self.script.read_bytes(), self.original_script.replace(b'1.0.3', b'2.3.4'))

    def test_notes_can_change_while_enter_keeps_version(self):
        status, _, _, _, _, _, _ = self.run_main('1\n', metadata_answer='\n新的更新文案\n')
        self.assertEqual(status, 0)
        self.assertEqual((self.project / 'version.json').read_bytes(), self.original_record)
        self.assertEqual(read_update_notes(self.script.read_text(encoding='utf-8')), '新的更新文案')

    def test_explicit_metadata_is_saved_and_skips_its_prompts(self):
        status, output, build, _, _, _, _ = self.run_main('',
            ['--version', '2.0.0', '--notes', '命令行更新；第二项', '--no-upload'], metadata_answer='')
        self.assertEqual(status, 0)
        self.assertNotIn('本次打包版本', output)
        self.assertNotIn('本次更新文案', output)
        self.assertEqual(read_version(self.project / 'version.json'), '2.0.0')
        self.assertEqual(read_update_notes(self.script.read_text(encoding='utf-8')), '命令行更新；第二项')
        self.assertEqual(build.call_args.args[-1], '2.0.0')

    def test_noninteractive_metadata_keeps_working_files_and_does_not_consume_stdin(self):
        stream = io.StringIO('9.8.7\n不应读取\n')
        with patch.object(sys, 'stdin', stream), patch.object(release, 'PROJECT_ROOT', self.project), \
                redirect_stdout(io.StringIO()):
            self.assertEqual(release.prepare_project_release(), '1.0.3')
        self.assertEqual(stream.tell(), 0)
        self.assertEqual(self.script.read_bytes(), self.original_script)
        self.assertEqual((self.project / 'version.json').read_bytes(), self.original_record)

    def test_eof_cancels_before_build_and_keeps_completed_version_step(self):
        for answer, version in [('', '1.0.3'), ('1.0.4\n', '1.0.4')]:
            with self.subTest(answer=answer):
                status, _, build, settings, upload, reveal, _ = self.run_main('', metadata_answer=answer)
                self.assertEqual(status, 1)
                self.assertEqual(read_version(self.project / 'version.json'), version)
                build.assert_not_called()
                settings.assert_not_called()
                upload.assert_not_called()
                reveal.assert_not_called()

    def test_upload_only_never_reads_or_edits_project_metadata(self):
        with patch.object(release, 'prepare_project_release', side_effect=AssertionError('must not edit project')):
            status, _, build, _, upload, _, _ = self.run_main('', ['--upload-only', str(self.archive)])
        self.assertEqual(status, 0)
        build.assert_not_called()
        upload.assert_called_once()
        self.assertEqual(self.script.read_bytes(), self.original_script)

    def test_upload_choice_reveals_local_zip_before_publishing(self):
        status, output, _, settings, upload, _, events = self.run_main('2\n')
        self.assertEqual(status, 0)
        settings.assert_called_once()
        upload.assert_called_once()
        self.assertEqual(events, ['reveal', 'upload'])
        self.assertIn('COS release and version manifest uploaded', output)

    def test_invalid_choice_is_retried_before_any_upload(self):
        status, output, _, _, upload, _, _ = self.run_main('bad\n1\n')
        self.assertEqual(status, 0)
        self.assertIn('请输入 1', output)
        upload.assert_not_called()

    def test_explicit_flags_skip_question(self):
        for flag, should_upload in [('--no-upload', False), ('--upload', True)]:
            with self.subTest(flag=flag):
                status, output, _, _, upload, _, _ = self.run_main('', [flag])
                self.assertEqual(status, 0)
                self.assertNotIn('是否上传到云端', output)
                self.assertEqual(upload.call_count, int(should_upload))

    def test_noninteractive_default_and_eof_do_not_upload(self):
        for stdin in (io.StringIO('2\n'), Console(''), None):
            with self.subTest(stdin=stdin), patch.object(sys, 'stdin', stdin), redirect_stdout(io.StringIO()):
                self.assertFalse(release.choose_upload(None))

    def test_cancel_at_question_does_not_start_build(self):
        with patch('builtins.input', side_effect=KeyboardInterrupt):
            status, _, build, settings, upload, reveal, _ = self.run_main('')
        self.assertEqual(status, 130)
        build.assert_not_called()
        settings.assert_not_called()
        upload.assert_not_called()
        reveal.assert_not_called()

    def test_upload_failure_preserves_and_reveals_zip_once(self):
        status, output, _, _, _, reveal, events = self.run_main('2\n', upload_error=UploadError('fixture failure'))
        self.assertEqual(status, 2)
        self.assertIn('--upload-only', output)
        self.assertTrue(self.archive.is_file())
        reveal.assert_called_once_with(self.archive)
        self.assertEqual(events, ['reveal', 'upload'])

    def test_no_open_suppresses_folder_opening(self):
        status, _, _, _, _, reveal, _ = self.run_main('1\n', ['--no-open'])
        self.assertEqual(status, 0)
        reveal.assert_not_called()

    def test_conflicting_upload_flags_are_rejected(self):
        for flags in (['--upload', '--no-upload'], ['--upload-only', str(self.archive), '--no-upload'],
                      ['--upload-only', str(self.archive), '--version', '2.0.0'],
                      ['--upload-only', str(self.archive), '--notes', '文案']):
            with self.subTest(flags=flags), redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                release.parse_args(flags)
            self.assertEqual(error.exception.code, 2)

    def test_reveal_passes_literal_unicode_path_without_command_line_quotes(self):
        with patch.object(release, 'select_archive_in_explorer') as select, \
                patch.object(release.os, 'startfile') as fallback, redirect_stdout(io.StringIO()):
            release.show_archive(self.archive)
        select.assert_called_once_with(self.archive.absolute())
        fallback.assert_not_called()

    def test_reveal_failure_opens_actual_parent_and_reports_missing_selection(self):
        capture = io.StringIO()
        with patch.object(release, 'select_archive_in_explorer', side_effect=OSError('fixture')), \
                patch.object(release.os, 'startfile') as fallback, redirect_stdout(capture):
            release.show_archive(self.archive)
        fallback.assert_called_once_with(str(self.archive.parent))
        self.assertIn('未能选中 ZIP', capture.getvalue())

    def test_folder_failure_does_not_turn_successful_pack_into_failure(self):
        capture = io.StringIO()
        with patch.object(release, 'select_archive_in_explorer', side_effect=OSError('fixture')), \
                patch.object(release.os, 'startfile', side_effect=OSError('fixture')), redirect_stderr(capture):
            release.show_archive(self.archive)
        self.assertIn(str(self.archive.parent), capture.getvalue())
        self.assertIn('请手动打开', capture.getvalue())


if __name__ == '__main__':
    unittest.main(verbosity=2)
