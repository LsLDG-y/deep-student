"""Trust-boundary regressions for the maintainer CLI (stdlib only).

Run: python3 -m unittest discover -s benchmarks/deep-student/tests -v
These tests use temporary trees and real Git patch parsing. They never mutate
production code or call the expensive native benchmark adapters.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

MODULE = Path(__file__).resolve().parents[1] / 'bench.py'
spec = importlib.util.spec_from_file_location('deep_student_bench_review', MODULE)
bench = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(bench)


class TempTree(unittest.TestCase):
    def setUp(self):
        # Keep audit artifacts under /tmp; project instructions prohibit deleting
        # user data. No cleanup is registered for these independent fixtures.
        self.root = Path(tempfile.mkdtemp(prefix='ds-bench-harness-test-', dir='/tmp'))

    def write(self, name, data):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data)
        return target

    def json(self, name, data):
        return self.write(name, json.dumps(data))


class GradingInventoryTests(TempTree):
    def calibration(self):
        return {'valid': True, 'FAIL_TO_PASS': ['repair target'], 'PASS_TO_PASS': ['preserve ordinary behavior']}

    def result(self, states, *, valid=True, exit_code=0):
        return {'valid': valid, 'tests': states, 'exit_code': exit_code}

    def test_no_tests_cannot_resolve(self):
        self.assertEqual(bench.score_tests(self.calibration(), self.result({}))['score'], 0)

    def test_skipped_todo_pending_and_missing_tests_cannot_resolve(self):
        for state in ['skipped', 'pending', 'todo', 'disabled', 'failed']:
            with self.subTest(state=state):
                result = self.result({'repair target': state, 'preserve ordinary behavior': 'passed'})
                self.assertEqual(bench.score_tests(self.calibration(), result)['score'], 0)
        self.assertEqual(bench.score_tests(self.calibration(), self.result({'repair target': 'passed'}))['score'], 0)

    def test_extra_test_inventory_cannot_hide_deleted_target(self):
        states = {'repair target': 'passed', 'preserve ordinary behavior': 'passed', 'replacement': 'passed'}
        self.assertEqual(bench.score_tests(self.calibration(), self.result(states))['score'], 0)

    def test_nonzero_exit_and_runtime_failure_cannot_resolve(self):
        states = {'repair target': 'passed', 'preserve ordinary behavior': 'passed'}
        for result in [self.result(states, valid=False), self.result(states, exit_code=1), self.result(states, exit_code=137)]:
            self.assertEqual(bench.score_tests(self.calibration(), result)['score'], 0)

    def test_exact_complete_success_resolves(self):
        states = {'repair target': 'passed', 'preserve ordinary behavior': 'passed'}
        self.assertEqual(bench.score_tests(self.calibration(), self.result(states))['score'], 100)

    def test_zero_test_report_is_invalid_even_on_zero_exit(self):
        report = self.json('zero.json', {'testResults': [], 'numRuntimeErrorTestSuites': 0})
        self.assertFalse(bench.parse_vitest(report, 0)['valid'])

    def test_duplicate_report_test_names_are_rejected(self):
        one = {'fullName': 'same target', 'status': 'passed'}
        report = self.json('duplicate.json', {'testResults': [{'assertionResults': [one, one]}]})
        with self.assertRaises(bench.BenchError):
            bench.parse_vitest(report, 0)

    def test_runtime_error_report_is_invalid(self):
        report = self.json('runtime.json', {'numRuntimeErrorTestSuites': 1,
            'testResults': [{'assertionResults': [{'fullName': 'one', 'status': 'passed'}]}]})
        self.assertFalse(bench.parse_vitest(report, 0)['valid'])


class SummaryTests(TempTree):
    def available(self):
        return {'a': {'id': 'a', 'category': 'state', 'difficulty': 2},
                'b': {'id': 'b', 'category': 'io', 'difficulty': 3}}

    def row(self, task='a', **overrides):
        return {'task_id': task, 'score': 100, 'resolved': True, 'status': 'resolved', **overrides}

    def summarize(self):
        with mock.patch.object(bench, 'cases', self.available):
            return bench.summary(self.root / 'input', self.root / 'summary.json')

    def test_missing_tasks_remain_in_denominator(self):
        self.json('input/a/result.json', self.row())
        result = self.summarize()
        self.assertEqual(result['score'], 50)
        self.assertEqual(result['missing'], ['b'])

    def test_unknown_task_results_are_rejected(self):
        self.json('input/unknown/result.json', self.row('unknown'))
        with self.assertRaises(bench.BenchError):
            self.summarize()

    def test_duplicate_task_results_are_rejected(self):
        self.json('input/a/result.json', self.row())
        self.json('input/a-again/result.json', self.row())
        with self.assertRaises(bench.BenchError):
            self.summarize()

    def test_invalid_result_cannot_claim_success(self):
        self.json('input/a/result.json', self.row(status='invalid'))
        try:
            result = self.summarize()
        except bench.BenchError:
            return
        self.assertEqual(result['score'], 0)

    def test_non_boolean_resolved_cannot_claim_success(self):
        self.json('input/a/result.json', self.row(resolved='false'))
        try:
            result = self.summarize()
        except bench.BenchError:
            return
        self.assertEqual(result['score'], 0)

    def test_duplicate_selectors_are_rejected(self):
        with mock.patch.object(bench, 'cases', self.available):
            with self.assertRaises(bench.BenchError):
                bench.choose('a,a')


class PatchTrustTests(TempTree):
    def addition(self, path, *, mode='100644', text='safe value'):
        return f'diff --git a/{path} b/{path}\nnew file mode {mode}\n--- /dev/null\n+++ b/{path}\n@@ -0,0 +1 @@\n+{text}\n'

    def test_production_source_patch_is_accepted(self):
        patch = self.write('valid.patch', self.addition('src/components/new.ts'))
        self.assertEqual(bench.validate_patch(patch), ['src/components/new.ts'])

    def test_top_level_dependencies_and_test_configuration_are_rejected(self):
        for path in ['package.json', 'package-lock.json', 'vitest.config.ts', 'vitest.setup.ts', '.benchmark-tests/hidden.test.ts', 'benchmarks/deep-student/bench.py', 'src/__tests__/fake.test.ts']:
            with self.subTest(path=path):
                patch = self.write('protected.patch', self.addition(path))
                with self.assertRaises(bench.BenchError):
                    bench.validate_patch(patch)

    def test_path_traversal_and_absolute_paths_are_rejected(self):
        for path in ['/tmp/outside.ts', '../outside.ts', 'src/../../outside.ts', 'src/dir\\outside.ts']:
            with self.subTest(path=path):
                patch = self.write('unsafe.patch', self.addition(path))
                with self.assertRaises(bench.BenchError):
                    bench.validate_patch(patch)

    def test_symlink_and_submodule_git_modes_are_rejected(self):
        for mode in ['120000', '160000']:
            with self.subTest(mode=mode):
                patch = self.write('mode.patch', self.addition('src/escape', mode=mode, text='/tmp/outside'))
                with self.assertRaises(bench.BenchError):
                    bench.validate_patch(patch)

    def fake_prepare(self, _case, dest, **_kwargs):
        (dest / 'src').mkdir(parents=True)
        (dest / 'src/main.ts').write_text('export const value = 1;\n')

    def collect(self, workspace, name='result.patch'):
        with mock.patch.object(bench, 'prepare_source', self.fake_prepare):
            return bench.collect({'id': 'synthetic-boundary'}, workspace, self.root / name)

    def test_collect_rejects_source_root_directory_symlink(self):
        workspace = self.root / 'candidate'; workspace.mkdir()
        outside = self.root / 'evaluator-private'; outside.mkdir()
        (outside / 'secret.ts').write_text('PRIVATE_SENTINEL_DO_NOT_EXPORT\n')
        (workspace / 'src').symlink_to(outside, target_is_directory=True)
        with self.assertRaises(bench.BenchError):
            self.collect(workspace)

    def test_collect_rejects_individual_file_symlink(self):
        workspace = self.root / 'candidate'; (workspace / 'src').mkdir(parents=True)
        secret = self.write('private.txt', 'PRIVATE_SENTINEL\n')
        (workspace / 'src/main.ts').symlink_to(secret)
        with self.assertRaises(bench.BenchError):
            self.collect(workspace)

    def test_collect_keeps_changes_after_agent_git_commit(self):
        workspace = self.root / 'candidate'; self.fake_prepare({}, workspace)
        bench.init_public_git(workspace)
        (workspace / 'src/main.ts').write_text('export const value = 2;\n')
        bench.run(['git', 'add', 'src/main.ts'], cwd=workspace)
        bench.run(['git', 'commit', '-qm', 'Candidate commit'], cwd=workspace)
        result = self.collect(workspace)
        self.assertEqual(result['changed_files'], ['src/main.ts'])
        destination = self.root / 'fresh'; self.fake_prepare({}, destination)
        bench.apply_patch(destination, self.root / 'result.patch')
        self.assertEqual((destination / 'src/main.ts').read_text(), 'export const value = 2;\n')

    def test_collect_preserves_no_final_newline_in_source_edits(self):
        workspace = self.root / 'candidate'; self.fake_prepare({}, workspace)
        (workspace / 'src/main.ts').write_text('export const value = 2;')
        result = self.collect(workspace)
        destination = self.root / 'fresh'; self.fake_prepare({}, destination)
        bench.apply_patch(destination, Path(result['patch']))
        self.assertEqual((destination / 'src/main.ts').read_text(), 'export const value = 2;')


class SnapshotRedactionTests(unittest.TestCase):
    def test_existing_tests_docs_history_and_benchmark_are_not_exported(self):
        for name in ['tests/vitest/a.test.ts', 'src/components/__tests__/a.ts', 'src/utils/a.spec.ts',
                     'decisions/solution.md', 'AGENTS.md', 'benchmarks/deep-student/private/a.json', '.git/config',
                     'src-tauri/src/chat_v2/pipeline_tests.rs', 'src-tauri/src/crypto/tests.rs']:
            with self.subTest(name=name):
                self.assertFalse(bench.included(name))

    def test_cfg_test_items_are_removed_but_production_literals_are_preserved(self):
        source = 'const KEEP: &str = r#"#[cfg(test)] { literal }"#;\n/* nested /* #[test] */ comment */\n#[cfg(test)]\nmod tests { #[test] fn hidden() { let _ = "}"; } }\nfn production() {}\n'
        clean = bench.strip_rust_tests(source)
        self.assertIn('const KEEP: &str = r#"#[cfg(test)] { literal }"#;', clean)
        self.assertIn('fn production()', clean)
        self.assertNotIn('fn hidden()', clean)

    def test_whitespace_cfg_test_items_are_removed(self):
        source = '#[cfg ( test )]\nmod private_tests { fn hidden_answer() {} }\nfn production() {}'
        clean = bench.strip_rust_tests(source)
        self.assertNotIn('hidden_answer', clean)
        self.assertIn('production', clean)

    def test_sanitize_covers_exported_rust_files_outside_the_native_crate(self):
        root = Path(tempfile.mkdtemp(prefix='ds-bench-sanitize-test-', dir='/tmp'))
        script = root / 'scripts' / 'fixture-harness.rs'
        script.parent.mkdir(parents=True)
        script.write_text('#[test]\nfn leaked_fixture_answer() {}\nfn main() {}\n')
        bench.sanitize(root, {})
        self.assertNotIn('leaked_fixture_answer', script.read_text())
        self.assertIn('fn main()', script.read_text())

    def test_non_test_production_branch_is_not_deleted(self):
        source = '#[cfg(not(test))]\nfn production_only() { important(); }\n'
        self.assertEqual(bench.strip_rust_tests(source), source)

    def test_mixed_cfg_does_not_delete_normal_feature_behavior(self):
        source = '#[cfg(any(test, feature = "production-feature"))]\nfn shared_runtime_helper() {}\n'
        clean = bench.strip_rust_tests(source)
        self.assertIn('shared_runtime_helper', clean)

    def test_direct_test_attributes_are_removed(self):
        source = '#[tokio::test(flavor = "multi_thread")]\nasync fn leaked_async_answer() {}\n#[test]\nfn leaked_sync_answer() {}\nfn production() {}'
        clean = bench.strip_rust_tests(source)
        self.assertNotIn('leaked_async_answer', clean)
        self.assertNotIn('leaked_sync_answer', clean)
        self.assertIn('production', clean)


if __name__ == '__main__':
    unittest.main()
