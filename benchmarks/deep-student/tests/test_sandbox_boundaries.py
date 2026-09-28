"""Public sandbox startup and host/container identity regressions (stdlib only)."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

MODULE = Path(__file__).resolve().parents[1] / 'bench.py'
spec = importlib.util.spec_from_file_location('deep_student_bench_sandbox_review', MODULE)
bench = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(bench)


class ContainerIdentityTests(unittest.TestCase):
    def test_nonroot_host_preserves_user_and_group(self):
        with mock.patch.object(bench.os, 'getuid', return_value=501), mock.patch.object(bench.os, 'getgid', return_value=20):
            self.assertEqual(bench.container_user(), '501:20')

    def test_root_host_uses_unprivileged_user_and_group(self):
        with mock.patch.object(bench.os, 'getuid', return_value=0), mock.patch.object(bench.os, 'getgid', return_value=0):
            self.assertEqual(bench.container_user(), '65534:65534')


class PublicSandboxTests(unittest.TestCase):
    def setUp(self):
        temp = bench.REPO / 'tmp'
        temp.mkdir(exist_ok=True)
        # Retain independent audit fixtures; never remove workspace contents.
        self.root = Path(tempfile.mkdtemp(prefix='ds-sandbox-boundary-', dir=temp))
        self.case = {'id': 'DS-AUDIT'}

    def fake_prepare(self, case, output):
        output.mkdir()
        (output / 'TASK.md').write_text('Public audit task\n')
        return {'task_id': case['id'], 'workspace': str(output), 'prompt': str(output / 'TASK.md')}

    def test_sandbox_returns_only_after_initialization_completes(self):
        output = self.root / 'workspace'
        events = []

        def fake_run(command, **kwargs):
            events.append(command)
            if command[:2] == ['docker', 'exec']:
                self.assertFalse((self.root / 'workspace.sandbox.json').exists())
                (output / 'initialization-complete').write_text('ready')
            return subprocess.CompletedProcess(command, 0, stdout=b'', stderr=b'')

        with mock.patch.object(bench, 'prepare', side_effect=self.fake_prepare), mock.patch.object(bench, 'check_docker_mount'), mock.patch.object(bench, 'run', side_effect=fake_run):
            result = bench.sandbox(self.case, output, 'audit-image')
        self.assertEqual([event[1] for event in events], ['run', 'exec'])
        self.assertEqual(events[0][-2:], ['sleep', 'infinity'])
        self.assertEqual(events[1][2], result['container'])
        self.assertEqual((output / 'initialization-complete').read_text(), 'ready')
        self.assertEqual(json.loads((self.root / 'workspace.sandbox.json').read_text())['container'], result['container'])

    def test_initialization_failure_stops_container_and_publishes_no_result(self):
        for index, failure in enumerate((bench.BenchError('injected initialization failure'), subprocess.TimeoutExpired(['docker', 'exec'], 120))):
            with self.subTest(failure=type(failure).__name__):
                output = self.root / f'workspace-{index}'
                events = []

                def fake_run(command, **kwargs):
                    events.append(command)
                    if command[:2] == ['docker', 'exec']:
                        raise failure
                    return subprocess.CompletedProcess(command, 0, stdout=b'', stderr=b'')

                with mock.patch.object(bench, 'prepare', side_effect=self.fake_prepare), mock.patch.object(bench, 'check_docker_mount'), mock.patch.object(bench, 'run', side_effect=fake_run):
                    with self.assertRaises(type(failure)) as raised:
                        bench.sandbox(self.case, output, 'audit-image')
                self.assertIs(raised.exception, failure)
                self.assertEqual([event[1] for event in events], ['run', 'exec', 'stop'])
                self.assertEqual(events[1][2], events[2][-1])
                self.assertFalse((self.root / f'workspace-{index}.sandbox.json').exists())

    def test_mount_probe_uses_the_same_nonroot_identity_on_root_hosts(self):
        folder = self.root / 'mount'
        folder.mkdir()
        commands = []

        def fake_run(command, **kwargs):
            commands.append(command)
            (folder / '.mount-write').write_text('ok')
            return subprocess.CompletedProcess(command, 0, stdout=b'', stderr=b'')

        with mock.patch.object(bench.os, 'getuid', return_value=0), mock.patch.object(bench.os, 'getgid', return_value=0), mock.patch.object(bench, 'run', side_effect=fake_run):
            bench.check_docker_mount(folder, 'audit-image')
        self.assertEqual(commands[0][commands[0].index('--user') + 1], '65534:65534')

    def test_fresh_public_git_ignores_dependency_symlink_and_mount_probes(self):
        folder = self.root / 'git-workspace'
        folder.mkdir()
        source = folder / 'source.rs'
        source.write_text('fn main() {}\n')
        bench.init_public_git(folder)
        (folder / 'node_modules').symlink_to('/opt/deps/node_modules', target_is_directory=True)
        (folder / '.mount-read').write_text('read probe')
        (folder / '.mount-write').write_text('write probe')
        self.assertEqual(bench.run(['git', 'status', '--porcelain'], cwd=folder).stdout, b'')
        source.write_text('fn main() { println!("changed"); }\n')
        self.assertIn(b'source.rs', bench.run(['git', 'status', '--porcelain'], cwd=folder).stdout)


if __name__ == '__main__':
    unittest.main()
