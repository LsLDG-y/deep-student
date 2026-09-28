"""Score provenance and report failures; real Python runners use /tmp fixtures."""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


MODULE = Path(__file__).resolve().parents[1] / 'bench.py'
spec = importlib.util.spec_from_file_location('deep_student_score_boundaries', MODULE)
bench = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(bench)

F2P = 'behavior_tests.Probe.test_a_f2p'
P2P = 'behavior_tests.Probe.test_b_p2p'
PASSING_TESTS = '''import unittest
class Probe(unittest.TestCase):
    def test_a_f2p(self): self.assertTrue(True)
    def test_b_p2p(self): self.assertTrue(True)
'''
MODE_TESTS = '''import os, unittest
from pathlib import Path
class Probe(unittest.TestCase):
    def test_a_f2p(self):
        self.assertEqual(Path(os.environ['DS_SOURCE_ROOT'], 'mode').read_text(), 'reference')
    def test_b_p2p(self):
        self.assertEqual(2 + 2, 4)
'''


class Fixtures(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='ds-score-boundary-', dir='/tmp'))

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value)
        return path

    def case(self, task='a', source=PASSING_TESTS):
        path = self.write(f'cases/{task}/test.py', source)
        return {'id': task, '_dir': path.parent, 'runner': 'python', 'category': 'fixture',
                'difficulty': 1, 'family': 'fixture', 'timeout_seconds': 10}

    def prepare(self, case, destination, buggy=True):
        destination.mkdir(parents=True)
        (destination / 'mode').write_text('buggy' if buggy else 'reference')

    def calibration(self, case):
        value = {'task_id': case['id'], 'engine': 'local', 'valid': True,
                 'suite_version': bench.SUITE['version'], 'source_commit': bench.ANCHOR,
                 'FAIL_TO_PASS': [F2P], 'PASS_TO_PASS': [P2P]}
        bench.calibration_path(case, 'local').write_text(json.dumps(value))


class SummaryIdentityTests(Fixtures):
    def row(self, task='a', **changes):
        return {'schema_version': 1, 'suite_version': bench.SUITE['version'],
                'source_commit': bench.ANCHOR, 'task_id': task, 'engine': 'docker',
                'image_id': 'sha256:fixture-a', 'status': 'resolved', 'resolved': True,
                'score': 100, **changes}

    def summarize(self, rows):
        for row in rows:
            self.write(f'input/{row["task_id"]}/result.json', json.dumps(row))
        available = {task: {'id': task, 'category': 'fixture', 'difficulty': 1} for task in ['a', 'b']}
        with mock.patch.object(bench, 'cases', return_value=available):
            return bench.summary(self.root / 'input', self.root / 'summary.json')

    def test_matching_identity_is_recorded_in_summary(self):
        result = self.summarize([self.row(), self.row('b')])
        self.assertEqual(result['score'], 100)
        self.assertEqual(result['source_commit'], bench.ANCHOR)
        self.assertEqual(result['image_id'], 'sha256:fixture-a')
        self.assertEqual(result['engines'], ['docker'])

    def test_missing_or_mismatched_identity_is_rejected(self):
        for changes in [{'schema_version': None}, {'schema_version': True},
                        {'suite_version': None}, {'suite_version': 'different'},
                        {'source_commit': None}, {'source_commit': 'different'}, {'engine': None}]:
            with self.subTest(changes=changes), self.assertRaises(bench.BenchError):
                self.summarize([self.row(**changes)])

    def test_local_and_docker_results_cannot_mix(self):
        with self.assertRaises(bench.BenchError):
            self.summarize([self.row(), self.row('b', engine='local', image_id=None)])

    def test_docker_images_cannot_mix(self):
        with self.assertRaises(bench.BenchError):
            self.summarize([self.row(), self.row('b', image_id='sha256:fixture-b')])

    def test_malformed_types_raise_report_error_not_python_type_error(self):
        for changes in [{'status': []}, {'engine': []}, {'image_id': []},
                        {'resolved': 'true'}, {'score': True}, {'score': 100.0}]:
            with self.subTest(changes=changes), self.assertRaises(bench.BenchError):
                self.summarize([self.row(**changes)])

    def test_failure_before_image_inspection_stays_in_denominator(self):
        for status in ['invalid', 'execution_error']:
            with self.subTest(status=status):
                result = self.summarize([self.row(), self.row('b', status=status, resolved=False,
                                                            score=0, image_id=None)])
                self.assertEqual(result['attempted'], 2)
                self.assertEqual(result['score'], 50)
                self.assertEqual(result['missing'], [])

    def test_completed_docker_result_requires_image(self):
        with self.assertRaises(bench.BenchError):
            self.summarize([self.row(image_id=None)])


class ExecutionCompletenessTests(Fixtures):
    def vitest_report(self, total=2):
        return {'numTotalTests': total, 'numPassedTests': 2, 'numFailedTests': 0,
                'numPendingTests': 0, 'numTodoTests': 0, 'success': True,
                'testResults': [{'status': 'passed', 'assertionResults': [
                    {'fullName': 'repair', 'status': 'passed'},
                    {'fullName': 'preserve', 'status': 'passed'}]}]}

    def test_vitest_declared_but_unreported_tests_are_invalid(self):
        report = self.write('vitest.json', json.dumps(self.vitest_report(total=3)))
        result = bench.parse_vitest(report, 0)
        self.assertFalse(result['valid'])
        self.assertFalse(result['complete_test_inventory'])

    def test_complete_vitest_report_remains_valid(self):
        report = self.write('vitest.json', json.dumps(self.vitest_report()))
        self.assertTrue(bench.parse_vitest(report, 0)['valid'])

    def test_python_reference_nonzero_exit_invalidates_calibration(self):
        source = 'import atexit, os\natexit.register(lambda: os._exit(7))\n' + MODE_TESTS
        case = self.case(source=source)
        with mock.patch.object(bench, 'prepare_source', self.prepare):
            result = bench.calibrate([case], self.root / 'calibration', 'local', 'unused')
        row = result['tasks'][0]
        self.assertEqual(row['reference']['exit_code'], 7)
        self.assertEqual(set(row['reference']['tests'].values()), {'passed'})
        self.assertFalse(row['valid'])

    def test_python_stopped_suite_cannot_shrink_calibrated_inventory(self):
        source = MODE_TESTS + '''        self._outcome.result.stop()
    def test_c_never_executed(self):
        self.fail('must be included in the expected inventory')
'''
        case = self.case(source=source)
        with mock.patch.object(bench, 'prepare_source', self.prepare):
            result = bench.calibrate([case], self.root / 'calibration', 'local', 'unused')
        row = result['tasks'][0]
        self.assertEqual(len(row['reference']['expected_tests']), 3)
        self.assertEqual(row['reference']['tests_run'], 2)
        self.assertFalse(row['reference']['complete_test_inventory'])
        self.assertFalse(row['valid'])

    def test_native_malformed_reports_return_invalid_execution(self):
        for index, payload in enumerate(['{"truncated"', '[]', '{"valid": true, "tests": []}',
                                         '{"valid": "yes", "tests": {}}']):
            with self.subTest(payload=payload):
                source = ('import atexit, sys\nfrom pathlib import Path\n'
                          f'atexit.register(lambda: Path(sys.argv[2]).write_text({payload!r}))\n' + PASSING_TESTS)
                case = self.case(task=f'malformed-{index}', source=source)
                path = self.root / f'source-{index}'
                self.prepare(case, path)
                result = bench.evaluate_source(case, path, self.root / f'output-{index}', 'local', 'unused')
                self.assertFalse(result['valid'])
                self.assertIn('invalid test report', result['error'])

    def test_grade_set_continues_after_invalid_native_report(self):
        corrupt = ('import atexit, sys\nfrom pathlib import Path\n'
                   'atexit.register(lambda: Path(sys.argv[2]).write_text(\'{"truncated"\'))\n')
        available = {}
        for task, source in [('a', PASSING_TESTS), ('b', corrupt + PASSING_TESTS), ('c', PASSING_TESTS)]:
            case = self.case(task, source)
            available[task] = case
            self.calibration(case)
            self.write(f'patches/{task}.patch', '')
        argv = ['bench.py', 'grade-set', '--patch-dir', str(self.root / 'patches'),
                '--output', str(self.root / 'batch'), '--engine', 'local']
        with mock.patch.object(bench, 'cases', return_value=available), \
                mock.patch.object(bench, 'prepare_source', self.prepare), \
                mock.patch.object(sys, 'argv', argv), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(bench.main(), 0)
        rows = [json.loads((self.root / 'batch' / task / 'result.json').read_text()) for task in available]
        self.assertEqual([row['status'] for row in rows], ['resolved', 'execution_error', 'resolved'])
        self.assertTrue(all(row['suite_version'] == bench.SUITE['version'] for row in rows))
        result = json.loads((self.root / 'batch/summary.json').read_text())
        self.assertEqual(result['attempted'], 3)
        self.assertEqual(result['resolved'], 2)
        self.assertEqual(result['score'], 66.67)


if __name__ == '__main__':
    unittest.main()
