"""Controller fault regressions without invoking a model or Docker daemon."""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location('opencode_controller_faults', HERE / 'run_opencode.py')
controller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controller)


class FakeProcess:
    pid = 999999

    def __init__(self, code=0, timeout=False):
        self.returncode = None
        self.code = code
        self.timeout = timeout

    def wait(self, timeout):
        if self.timeout:
            self.timeout = False
            self.code = -15
            raise subprocess.TimeoutExpired('fixture-client', timeout)
        self.returncode = self.code
        return self.code

    def poll(self):
        return self.returncode


class ControllerFaults(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='ds-controller-fault-', dir='/tmp'))
        self.auth = {'type': 'api', 'key': 'DUMMY_FAULT_TEST_CREDENTIAL'}
        self.metrics = {'sessions': [{'id': 'fixture-session', 'tokens_input': 17}]}

    def docker(self, command, **kwargs):
        output = b'false\n' if command[1] == 'inspect' else b'fixture-container\n'
        return subprocess.CompletedProcess(command, 0, output, b'')

    def candidate(self, process=None, docker=None, setup=None, kill=None):
        process = process or FakeProcess()

        def launch(command, **kwargs):
            kwargs['stdout'].write(b'{"type":"text","sessionID":"fixture-session"}\n')
            return process

        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch.object(controller.subprocess, 'Popen', side_effect=launch))
            stack.enter_context(mock.patch.object(controller.subprocess, 'run', side_effect=docker or self.docker))
            killer = stack.enter_context(mock.patch.object(controller.os, 'killpg', side_effect=kill))
            metrics = stack.enter_context(mock.patch.object(controller, 'session_metrics', return_value=self.metrics))
            if setup is not None:
                stack.enter_context(mock.patch.object(controller, 'isolated_controller', side_effect=setup))
            record = controller.candidate(Path('/not-executed'), 'fixture', 'fixture-container',
                                          self.root / 'attempt', self.auth, 'unused', 1, 'fixture prompt')
        return record, killer, metrics

    def assert_auth_cleared(self, record):
        path = Path(record['controller']) / 'data/opencode/auth.json'
        self.assertEqual(path.read_text(), '{}\n')
        self.assertTrue(record['credential_cleared'])

    def test_setup_failure_after_auth_write_still_stops_and_clears(self):
        calls = []

        def setup(*args, root, **kwargs):
            path = root / 'data/opencode/auth.json'
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps(self.auth))
            raise OSError('fixture setup failure after credential creation')

        def docker(command, **kwargs):
            calls.append(command[1])
            return self.docker(command, **kwargs)

        record, _, _ = self.candidate(setup=setup, docker=docker)
        self.assertEqual(record['status'], 'controller_error')
        self.assertEqual(calls, ['stop', 'inspect'])
        self.assertTrue(record['container_stopped'])
        self.assert_auth_cleared(record)
        self.assertEqual(json.loads((self.root / 'attempt/attempt.json').read_text())['status'], 'controller_error')

    def test_stop_timeout_does_not_skip_client_or_auth_cleanup(self):
        order = []

        def docker(command, **kwargs):
            order.append(command[1])
            if command[1] == 'stop':
                raise subprocess.TimeoutExpired(command, 30)
            return subprocess.CompletedProcess(command, 0, b'true\n', b'')

        record, killer, _ = self.candidate(FakeProcess(timeout=True), docker=docker,
                                            kill=lambda *args: order.append('kill'))
        self.assertEqual(record['status'], 'budget_exhausted')
        self.assertTrue(record['client_stopped'])
        self.assertFalse(record['container_stopped'])
        self.assertEqual(order, ['kill', 'stop', 'inspect'])
        self.assertEqual(killer.call_count, 1)
        self.assertEqual(killer.call_args.args[1], controller.signal.SIGKILL)
        self.assert_auth_cleared(record)
        self.assertEqual({x['phase'] for x in record['infrastructure_errors']}, {'container_stop', 'container_inspect'})

    def test_stop_exit_zero_is_not_enough_without_inspect_confirmation(self):
        def docker(command, **kwargs):
            if command[1] == 'inspect':
                return subprocess.CompletedProcess(command, 1, b'', b'fixture daemon unavailable')
            return self.docker(command, **kwargs)

        record, _, _ = self.candidate(docker=docker)
        self.assertFalse(record['container_stopped'])
        self.assert_auth_cleared(record)

    def test_client_disappearing_during_cleanup_is_tolerated(self):
        record, _, _ = self.candidate(kill=ProcessLookupError('fixture already exited'))
        self.assertTrue(record['client_stopped'])
        self.assertTrue(record['container_stopped'])
        self.assert_auth_cleared(record)

    def test_client_cleanup_error_still_stops_container_and_clears_auth(self):
        record, _, _ = self.candidate(kill=PermissionError('fixture kill error'))
        self.assertTrue(record['container_stopped'])
        self.assert_auth_cleared(record)
        self.assertIn('client_cleanup', [x['phase'] for x in record['infrastructure_errors']])

    def test_actual_session_metrics_are_recorded_without_usage_events(self):
        record, _, metrics = self.candidate()
        self.assertEqual(record['usage_events'], [])
        self.assertEqual(record['metrics'], self.metrics)
        metrics.assert_called_once_with(Path(record['controller']), ['fixture-session'])

    def test_nonzero_client_exit_is_an_explicit_infrastructure_error(self):
        record, _, _ = self.candidate(FakeProcess(code=1))
        self.assertEqual(record['status'], 'client_error')
        self.assertEqual(record['infrastructure_errors'][0]['phase'], 'client')

    def test_run_case_does_not_collect_from_unconfirmed_container(self):
        args = types.SimpleNamespace(output=self.root, opencode=Path('/not-executed'), minutes=1)
        attempt = {'status': 'finished', 'container_stopped': False, 'infrastructure_errors': []}
        with mock.patch.object(controller.bench, 'sandbox', return_value={'container': 'fixture'}), \
                mock.patch.object(controller, 'candidate', return_value=attempt), \
                mock.patch.object(controller.bench, 'collect') as collect:
            result = controller.run_case({'id': 'a'}, args, self.auth, 'unused')
        collect.assert_not_called()
        self.assertEqual(result['collection_status'], 'not_collected')
        self.assertEqual(result['infrastructure_errors'][0]['phase'], 'collection')

    def test_unexpected_candidate_failure_still_attempts_container_stop(self):
        args = types.SimpleNamespace(output=self.root, opencode=Path('/not-executed'), minutes=1)
        with mock.patch.object(controller.bench, 'sandbox', return_value={'container': 'fixture'}), \
                mock.patch.object(controller, 'candidate', side_effect=OSError('fixture unexpected error')), \
                mock.patch.object(controller, 'stop_container', return_value=(False, [])) as stop, \
                mock.patch.object(controller.bench, 'collect') as collect:
            result = controller.run_case({'id': 'a'}, args, self.auth, 'unused')
        stop.assert_called_once_with('fixture')
        collect.assert_not_called()
        self.assertEqual(result['status'], 'controller_error')

    def test_collection_failure_does_not_qualify_partial_patch(self):
        args = types.SimpleNamespace(output=self.root, opencode=Path('/not-executed'), minutes=1)
        attempt = {'status': 'finished', 'container_stopped': True, 'infrastructure_errors': []}

        def collect(case, workspace, patch):
            patch.parent.mkdir(parents=True)
            patch.write_text('partial patch')
            raise ValueError('fixture collection validation failed')

        with mock.patch.object(controller.bench, 'sandbox', return_value={'container': 'fixture'}), \
                mock.patch.object(controller, 'candidate', return_value=attempt), \
                mock.patch.object(controller.bench, 'collect', side_effect=collect):
            result = controller.run_case({'id': 'a'}, args, self.auth, 'unused')
        self.assertTrue((self.root / 'submissions/a.patch').exists())
        self.assertEqual(result['collection_status'], 'failed')
        self.assertEqual(result['infrastructure_errors'][0]['phase'], 'collection')

    def test_main_records_client_failure_and_grades_after_single_task_exception(self):
        cases = [{'id': task, 'category': 'fixture', 'difficulty': 1} for task in ['a', 'b']]
        auth = self.root / 'auth.json'
        auth.write_text(json.dumps({'opencode-go': self.auth}))
        output = self.root / 'run'

        def run_case(case, args, *unused):
            patch = args.output / 'submissions' / (case['id'] + '.patch')
            patch.parent.mkdir(parents=True, exist_ok=True)
            patch.write_text('')
            failed = case['id'] == 'a'
            return {'status': 'client_error' if failed else 'finished', 'collection_status': 'collected',
                    'infrastructure_errors': [{'phase': 'client', 'error': 'fixture exit 1'}] if failed else []}

        def grade(case, patch, folder, *unused):
            if case['id'] == 'a':
                raise RuntimeError('fixture grading failure')
            row = {'schema_version': 1, 'suite_version': controller.bench.SUITE['version'],
                   'source_commit': controller.bench.ANCHOR, 'task_id': case['id'], 'engine': 'docker',
                   'image_id': 'sha256:fixture', 'status': 'resolved', 'resolved': True, 'score': 100}
            controller.bench.dump(folder / 'result.json', row)
            return row

        argv = ['run_opencode.py', '--opencode', sys.executable, '--auth-file', str(auth), '--output', str(output)]
        with mock.patch.object(sys, 'argv', argv), \
                mock.patch.object(controller.subprocess, 'check_output', side_effect=['unix://fixture', '2.0.16']), \
                mock.patch.object(controller.bench, 'choose', return_value=cases), \
                mock.patch.object(controller.bench, 'cases', return_value={c['id']: c for c in cases}), \
                mock.patch.object(controller, 'run_case', side_effect=run_case), \
                mock.patch.object(controller.bench, 'grade', side_effect=grade), \
                contextlib.redirect_stdout(io.StringIO()):
            controller.main()
        run = json.loads((output / 'run.json').read_text())
        self.assertEqual(run['score'], 50)
        self.assertEqual(run['attempt_status_counts'], {'client_error': 1, 'finished': 1})
        self.assertEqual(run['grade_status_counts'], {'execution_error': 1, 'resolved': 1})
        self.assertEqual({e['phase'] for e in run['infrastructure_failures']}, {'client', 'grading'})
        self.assertEqual(run['status'], 'completed_with_infrastructure_errors')

    def test_nonfinite_budget_is_rejected_before_external_calls(self):
        for value in ['nan', 'inf']:
            argv = ['run_opencode.py', '--opencode', sys.executable, '--output', str(self.root / value), '--minutes', value]
            with self.subTest(value=value), mock.patch.object(sys, 'argv', argv), \
                    mock.patch.object(controller.subprocess, 'check_output') as external, \
                    contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as raised:
                controller.main()
            self.assertEqual(raised.exception.code, 2)
            external.assert_not_called()


if __name__ == '__main__':
    unittest.main()
