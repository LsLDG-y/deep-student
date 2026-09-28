"""Protocol and fixed-container boundary tests; real Docker smoke is documented separately."""
from __future__ import annotations

import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock


MODULE = Path(__file__).resolve().parents[1] / 'opencode_mcp.py'
spec = importlib.util.spec_from_file_location('deep_student_opencode_mcp', MODULE)
mcp = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mcp)


class McpBridgeTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='ds-mcp-tests-', dir='/tmp'))
        self.container_id = 'a' * 64
        self.shell = mcp.ContainerShell(self.container_id, 'DS-TOY', '1.0.1', self.root)

    def protocol(self, messages, shell=None):
        output, diagnostics = io.StringIO(), io.StringIO()
        data = '\n'.join(item if isinstance(item, str) else json.dumps(item) for item in messages) + '\n'
        mcp.serve(shell or self.shell, io.StringIO(data), output, diagnostics)
        return [json.loads(line) for line in output.getvalue().splitlines()], diagnostics.getvalue()

    def initialize(self):
        return {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26'}}

    def test_handshake_lists_exactly_one_tool_and_notifications_are_silent(self):
        responses, diagnostics = self.protocol([
            self.initialize(), {'jsonrpc': '2.0', 'method': 'notifications/initialized'},
            {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'},
        ])
        self.assertEqual([r['id'] for r in responses], [1, 2])
        self.assertEqual(responses[0]['result']['protocolVersion'], '2025-03-26')
        self.assertEqual([t['name'] for t in responses[1]['result']['tools']], ['shell'])
        self.assertEqual(diagnostics, '')

    def test_protocol_errors_are_json_and_session_recovers(self):
        responses, diagnostics = self.protocol([
            '{broken', [], {'jsonrpc': '2.0', 'id': 0, 'method': 'tools/list'}, self.initialize(),
            {'jsonrpc': '2.0', 'id': 3, 'method': 'unknown'},
            {'jsonrpc': '2.0', 'id': 4, 'method': 'tools/call', 'params': {'name': 'shell', 'arguments': {'command': 'pwd', 'container': 'another'}}},
            {'jsonrpc': '2.0', 'id': 5, 'method': 'ping'},
        ])
        self.assertEqual([r.get('error', {}).get('code') for r in responses], [-32700, -32600, -32602, None, -32601, -32602, None])
        self.assertEqual(responses[-1]['result'], {})
        self.assertEqual(diagnostics, '')

    def test_model_cannot_change_docker_options_or_timeout_boundary(self):
        for args in ({}, {'command': 7}, {'command': 'x', 'timeout_seconds': True},
                     {'command': 'x', 'timeout_seconds': 0}, {'command': 'x', 'timeout_seconds': 601},
                     {'command': 'x', 'timeout_seconds': 1.5}, {'command': 'x', 'host_path': '/tmp'},
                     {'command': 'x', 'description': []}, {'command': 'a\x00b'}):
            with self.subTest(args=args), self.assertRaises(mcp.InvalidParams):
                mcp.validate_arguments(args)
        self.assertEqual(mcp.validate_arguments({'command': 'pwd'})['timeout_seconds'], 120)
        self.assertEqual(mcp.validate_arguments({'command': 'pwd', 'timeout_seconds': 600})['timeout_seconds'], 600)

    def test_command_is_one_argv_element_inside_gnu_timeout_and_full_logs_survive(self):
        command = "printf '%s\\n' 'a; $(touch /host-sentinel)'"

        def run(argv, **kwargs):
            self.assertEqual(argv, ['docker', 'exec', '--workdir', '/workspace', self.container_id,
                '/usr/bin/timeout', '--signal=KILL', '120s', '/bin/sh', '-lc', command])
            self.assertNotIn('shell', kwargs)
            self.assertNotIn('timeout', kwargs)
            kwargs['stdout'].write(b'A' * 40 + b'END')
            kwargs['stderr'].write(b'warning\n')
            return subprocess.CompletedProcess(argv, 0)

        with mock.patch.object(mcp.subprocess, 'run', side_effect=run), mock.patch.object(mcp, 'MAX_OUTPUT_BYTES', 16):
            result = self.shell.call({'command': command})
        detail = json.loads(result['content'][0]['text'])
        self.assertFalse(result['isError'])
        self.assertIn('OUTPUT TRUNCATED', detail['stdout'])
        self.assertTrue(detail['stdout'].endswith('END'))
        self.assertEqual(Path(detail['stdout_log']).read_bytes(), b'A' * 40 + b'END')
        self.assertEqual(Path(detail['stderr_log']).read_bytes(), b'warning\n')
        self.assertEqual(json.loads((Path(detail['stdout_log']).parent / 'request.json').read_text())['command'], command)

    def test_execution_failure_is_a_tool_error_with_protocol_preserved(self):
        with mock.patch.object(mcp.subprocess, 'run', side_effect=FileNotFoundError('missing Docker')):
            result = self.shell.call({'command': 'pwd'})
        detail = json.loads(result['content'][0]['text'])
        self.assertTrue(result['isError'])
        self.assertIsNone(detail['exit_code'])
        self.assertIn('missing Docker', detail['infrastructure_error'])

    def test_controller_fixed_docker_path_is_used_for_execution(self):
        self.shell.docker = '/controller/docker'
        with mock.patch.object(mcp.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as run:
            self.shell.call({'command': 'pwd'})
        self.assertEqual(run.call_args.args[0][0], '/controller/docker')

    def inspect_result(self, labels=None):
        return [{'Id': self.container_id, 'Config': {'Labels': labels or {'ds.bench.task': 'DS-TOY', 'ds.bench.suite': '1.0.1'}},
                 'State': {'Running': True}, 'HostConfig': {'NetworkMode': 'none'}}]

    def verify(self, info, toy=False):
        with mock.patch.object(mcp.subprocess, 'run', side_effect=[
            subprocess.CompletedProcess([], 0, stdout=json.dumps(info).encode()),
            subprocess.CompletedProcess([], 0, stdout=b'timeout (GNU coreutils) 9.1\n'),
        ]) as run:
            result = mcp.inspect_container('named-container', 'DS-TOY', '1.0.1', toy)
        self.assertEqual(run.call_args_list[1].args[0][2], self.container_id)
        return result

    def test_verified_name_is_pinned_to_container_id(self):
        self.assertEqual(self.verify(self.inspect_result()), self.container_id)

    def test_toy_flag_never_bypasses_real_identity(self):
        toy = {'ds.bench.task': 'DS-TOY', 'ds.bench.suite': '1.0.1', 'ds.bench.toy': 'true'}
        self.assertEqual(self.verify(self.inspect_result(toy), toy=True), self.container_id)
        for labels, flag in ((toy, False), ({k: v for k, v in toy.items() if k != 'ds.bench.toy'}, True),
                             ({**toy, 'ds.bench.task': 'DS-OTHER'}, True), ({**toy, 'ds.bench.suite': 'old'}, True)):
            with self.subTest(labels=labels, toy=flag), self.assertRaises(mcp.BridgeError):
                self.verify(self.inspect_result(labels), toy=flag)

    def test_online_or_stopped_container_is_rejected(self):
        for field, value in (('NetworkMode', 'bridge'), ('Running', False)):
            info = self.inspect_result()
            info[0]['HostConfig' if field == 'NetworkMode' else 'State'][field] = value
            with self.subTest(field=field), self.assertRaises(mcp.BridgeError):
                self.verify(info)


if __name__ == '__main__':
    unittest.main()
