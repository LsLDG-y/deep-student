"""Real Git and filesystem regressions for submission patch boundaries."""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

MODULE = Path(__file__).resolve().parents[1] / 'bench.py'
spec = importlib.util.spec_from_file_location('deep_student_patch_boundaries', MODULE)
bench = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(bench)


class PatchBoundaries(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='ds-patch-regression-', dir='/tmp'))

    def repository(self, name):
        root = self.root / name
        (root / 'src').mkdir(parents=True)
        (root / 'package.json').write_text('{"name":"protected","type":"module"}\n')
        (root / 'src/live.ts').write_text('export const value = 1;\n')
        bench.init_public_git(root)
        return root

    def patch_file(self, name, contents):
        patch = self.root / name
        patch.write_text(contents)
        return patch

    def test_real_rename_cannot_remove_a_protected_source_path(self):
        root = self.repository('rename')
        bench.run(['git', 'mv', 'package.json', 'src/copied.ts'], cwd=root)
        text = bench.run(['git', 'diff', '--cached', '--find-renames'], cwd=root).stdout.decode()
        self.assertIn('rename from package.json', text)
        patch = self.patch_file('rename.patch', text)
        # Git really applies this as a move, although --numstat lists only the destination.
        target = self.repository('rename-target')
        bench.apply_patch(target, patch)
        self.assertFalse((target / 'package.json').exists())
        self.assertTrue((target / 'src/copied.ts').is_file())
        with self.assertRaises(bench.BenchError):
            bench.validate_patch(patch)

    def test_real_copy_metadata_is_rejected(self):
        root = self.repository('copy')
        (root / 'src/copied.ts').write_bytes((root / 'package.json').read_bytes())
        bench.run(['git', 'add', 'src/copied.ts'], cwd=root)
        text = bench.run(['git', 'diff', '--cached', '--find-copies', '--find-copies-harder'], cwd=root).stdout.decode()
        self.assertIn('copy from package.json', text)
        patch = self.patch_file('copy.patch', text)
        target = self.repository('copy-target')
        bench.apply_patch(target, patch)
        self.assertTrue((target / 'package.json').is_file())
        self.assertEqual((target / 'src/copied.ts').read_bytes(), (target / 'package.json').read_bytes())
        with self.assertRaises(bench.BenchError):
            bench.validate_patch(patch)

    def test_implicit_git_moves_validate_the_original_path_too(self):
        headers = [
            'diff --git a/package.json b/src/target.ts\n',
            'diff --git a/src/target.ts b/src/target.ts\n',
            'diff --git "a/src/target.ts" "b/src/target.ts"\n',
        ]
        for index, header in enumerate(headers):
            with self.subTest(header=header):
                target = self.root / f'implicit-{index}'
                (target / 'src').mkdir(parents=True)
                (target / 'package.json').write_text('old\n')
                (target / 'src/target.ts').write_text('old\n')
                patch = self.patch_file(f'implicit-{index}.patch', header +
                    '--- a/package.json\n+++ b/src/target.ts\n'
                    '@@ -1 +1 @@\n-old\n+new\n')
                bench.apply_patch(target, patch)
                self.assertFalse((target / 'package.json').exists())
                self.assertEqual((target / 'src/target.ts').read_text(), 'new\n')
                with self.assertRaises(bench.BenchError):
                    bench.validate_patch(patch)

    def test_plain_unified_diff_only_validates_its_actual_destination(self):
        target = self.root / 'plain'
        (target / 'src').mkdir(parents=True)
        (target / 'package.json').write_text('old\n')
        (target / 'src/target.ts').write_text('old\n')
        patch = self.patch_file('plain.patch',
            '--- a/package.json\n+++ b/src/target.ts\n'
            '@@ -1 +1 @@\n-old\n+new\n')
        self.assertEqual(bench.validate_patch(patch), ['src/target.ts'])
        bench.apply_patch(target, patch)
        self.assertEqual((target / 'package.json').read_text(), 'old\n')
        self.assertEqual((target / 'src/target.ts').read_text(), 'new\n')

    def test_noncanonical_symlink_permissions_cannot_bypass_file_type_check(self):
        for mode in ['120000', '120755', '120777']:
            with self.subTest(mode=mode):
                patch = self.patch_file(f'link-{mode}.patch',
                    f'diff --git a/src/link b/src/link\nnew file mode {mode}\n'
                    '--- /dev/null\n+++ b/src/link\n@@ -0,0 +1 @@\n+../../outside\n')
                target = self.root / mode
                (target / 'src').mkdir(parents=True)
                bench.apply_patch(target, patch)
                self.assertTrue((target / 'src/link').is_symlink())
                with self.assertRaises(bench.BenchError):
                    bench.validate_patch(patch)

    def test_all_mode_metadata_positions_require_regular_file_type(self):
        headers = [
            'new file mode 160755',
            'old mode 120755\nnew mode 100644',
            'old mode 100644\nnew mode 120777',
            'deleted file mode 120755',
            'index 1111111..2222222 120755',
        ]
        for index, header in enumerate(headers):
            with self.subTest(header=header):
                patch = self.patch_file(f'mode-{index}.patch',
                    'diff --git a/src/link b/src/link\n' + header + '\n'
                    '--- a/src/link\n+++ b/src/link\n@@ -1 +1 @@\n-old\n+new\n')
                with self.assertRaises(bench.BenchError):
                    bench.validate_patch(patch)

    def test_non_utf8_patch_is_a_controlled_validation_failure(self):
        patch = self.root / 'invalid-encoding.patch'
        patch.write_bytes(b'not UTF-8: \xff\xfe\x80')
        with self.assertRaises(bench.BenchError):
            bench.validate_patch(patch)
        self.assertEqual(patch.read_bytes(), b'not UTF-8: \xff\xfe\x80')

    def test_git_quoted_non_utf8_path_is_a_controlled_validation_failure(self):
        patch = self.patch_file('invalid-path-encoding.patch',
            'diff --git "a/src/\\377.ts" "b/src/\\377.ts"\nnew file mode 100644\n'
            '--- /dev/null\n+++ "b/src/\\377.ts"\n@@ -0,0 +1 @@\n+content\n')
        with self.assertRaises(bench.BenchError):
            bench.validate_patch(patch)

    def prepare(self, _case, root, **_kwargs):
        (root / 'src').mkdir(parents=True)
        (root / 'src/live.ts').write_text('export const value = 1;\n')
        (root / 'src/live.ts').chmod(0o644)
        (root / 'src/empty.ts').touch()
        (root / 'src/empty.ts').chmod(0o644)

    def collect_and_apply(self, workspace):
        patch = self.root / 'collected.patch'
        with mock.patch.object(bench, 'prepare_source', self.prepare):
            result = bench.collect({'id': 'fixture'}, workspace, patch)
        target = self.root / 'target'
        self.prepare({}, target)
        bench.apply_patch(target, patch)
        self.assertEqual((target / 'src/live.ts').read_text(), 'export const value = 1;\n')
        return result, target

    def test_collect_preserves_new_empty_file(self):
        workspace = self.root / 'candidate'
        self.prepare({}, workspace)
        (workspace / 'src/new-empty.ts').touch()
        result, target = self.collect_and_apply(workspace)
        self.assertEqual(result['changed_files'], ['src/new-empty.ts'])
        self.assertTrue((target / 'src/new-empty.ts').is_file())
        self.assertEqual((target / 'src/new-empty.ts').read_bytes(), b'')

    def test_collect_preserves_deletion_of_empty_file(self):
        workspace = self.root / 'candidate'
        self.prepare({}, workspace)
        (workspace / 'src/empty.ts').rename(self.root / 'held-empty.ts')
        result, target = self.collect_and_apply(workspace)
        self.assertEqual(result['changed_files'], ['src/empty.ts'])
        self.assertFalse((target / 'src/empty.ts').exists())

    def test_collect_preserves_executable_mode_only_change(self):
        workspace = self.root / 'candidate'
        self.prepare({}, workspace)
        (workspace / 'src/live.ts').chmod(0o755)
        result, target = self.collect_and_apply(workspace)
        self.assertEqual(result['changed_files'], ['src/live.ts'])
        self.assertTrue((target / 'src/live.ts').stat().st_mode & stat.S_IXUSR)

    def fifo_rejection(self, replacing):
        workspace = self.root / 'candidate'
        self.prepare({}, workspace)
        if replacing:
            (workspace / 'src/live.ts').rename(self.root / 'held-live.ts')
            fifo = workspace / 'src/live.ts'
        else:
            fifo = workspace / 'src/new-pipe.ts'
        os.mkfifo(fifo)
        # Run in a bounded child so a future regression blocks neither the
        # test coordinator nor the maintainer's CLI indefinitely.
        script = '''import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('bench', sys.argv[1])
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)
def prepare(case, root, **kwargs):
    (root / 'src').mkdir(parents=True)
    (root / 'src/live.ts').write_text('export const value = 1;\\n')
bench.prepare_source = prepare
try:
    bench.collect({'id':'fifo'}, pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
except bench.BenchError:
    raise SystemExit(0)
raise SystemExit('special file was not rejected')
'''
        result = subprocess.run([sys.executable, '-c', script, str(MODULE), str(workspace), str(self.root / 'fifo.patch')],
                                capture_output=True, text=True, timeout=3)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_collect_rejects_new_fifo_instead_of_ignoring_it(self):
        self.fifo_rejection(False)

    def test_collect_rejects_fifo_replacement_without_blocking(self):
        self.fifo_rejection(True)


if __name__ == '__main__':
    unittest.main()
