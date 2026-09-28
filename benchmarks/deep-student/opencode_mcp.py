#!/usr/bin/env python3
"""Minimal stdio MCP bridge to one controller-created benchmark container.

The controller supplies every host-side option. The only model-visible tool is
shell(command, timeout_seconds=120, description?). The controller must stop its
container when the overall task budget expires, including if this bridge exits.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
from typing import TextIO
import uuid


MAX_OUTPUT_BYTES = 24 * 1024  # Per stream; full bytes remain in controller logs.
PROTOCOL_VERSIONS = ('2024-11-05', '2025-03-26')
TOOL = {
    'name': 'shell',
    'description': (
        'Run a shell command in the fixed, offline benchmark task container, '
        'with /workspace as the working directory. Each call uses a fresh shell. '
        'Use this tool to inspect, edit, and test project files. '
        'Output may be truncated; full stdout/stderr are retained by the evaluator. '
        'Long-lived background services must stay within the task budget.'
    ),
    'inputSchema': {
        'type': 'object',
        'properties': {
            'command': {'type': 'string', 'description': 'Command to run with /bin/sh -lc.'},
            'timeout_seconds': {'type': 'integer', 'minimum': 1, 'maximum': 600, 'default': 120},
            'description': {'type': 'string', 'description': 'Optional short description of the command.'},
        },
        'required': ['command'],
        'additionalProperties': False,
    },
}


class BridgeError(Exception):
    """An infrastructure failure, never a successful command result."""


class InvalidParams(Exception):
    pass


def validate_arguments(arguments: object) -> dict:
    if not isinstance(arguments, dict):
        raise InvalidParams('arguments must be an object')
    if set(arguments) - {'command', 'timeout_seconds', 'description'}:
        raise InvalidParams('only command, timeout_seconds, and description are accepted')
    if not isinstance(arguments.get('command'), str):
        raise InvalidParams('command must be a string')
    if '\x00' in arguments['command']:
        raise InvalidParams('command cannot contain a NUL byte')
    timeout = arguments.get('timeout_seconds', 120)
    if isinstance(timeout, bool) or not isinstance(timeout, int) or not 1 <= timeout <= 600:
        raise InvalidParams('timeout_seconds must be an integer between 1 and 600')
    if 'description' in arguments and not isinstance(arguments['description'], str):
        raise InvalidParams('description must be a string')
    return {**arguments, 'timeout_seconds': timeout}


def inspect_container(container: str, task: str, suite: str, toy: bool, docker: str = 'docker') -> str:
    """Resolve the name once and pin the verified immutable Docker ID."""
    try:
        inspected = subprocess.run(
            [docker, 'inspect', '--type', 'container', '--', container],
            capture_output=True, timeout=20, check=True,
        )
        records = json.loads(inspected.stdout)
        if not isinstance(records, list) or len(records) != 1:
            raise BridgeError('expected exactly one container')
        info = records[0]
        labels = info.get('Config', {}).get('Labels') or {}
        if labels.get('ds.bench.suite') != suite or labels.get('ds.bench.task') != task:
            raise BridgeError('container suite/task labels do not match the requested task')
        if labels.get('ds.bench.toy') != ('true' if toy else None):
            raise BridgeError('toy containers require --toy and ds.bench.toy=true; production tasks forbid that label')
        if not info.get('State', {}).get('Running'):
            raise BridgeError('container is not running')
        if info.get('HostConfig', {}).get('NetworkMode') != 'none':
            raise BridgeError('container must have --network none')
        container_id = info.get('Id')
        if not isinstance(container_id, str) or len(container_id) != 64 or any(c not in '0123456789abcdef' for c in container_id):
            raise BridgeError('Docker did not return a valid immutable container ID')
        timeout_check = subprocess.run(
            [docker, 'exec', container_id, '/usr/bin/timeout', '--version'],
            capture_output=True, timeout=20, check=True,
        )
        if not timeout_check.stdout.startswith(b'timeout (GNU coreutils)'):
            raise BridgeError('the task image must provide GNU /usr/bin/timeout')
        return container_id
    except (OSError, subprocess.SubprocessError, ValueError, AttributeError, TypeError) as exc:
        raise BridgeError(f'cannot verify benchmark container: {exc}') from exc


def preview(path: Path) -> tuple[str, bool]:
    size = path.stat().st_size
    with path.open('rb') as stream:
        if size <= MAX_OUTPUT_BYTES:
            return stream.read().decode('utf-8', errors='replace'), False
        first_size = MAX_OUTPUT_BYTES // 2
        last_size = MAX_OUTPUT_BYTES - first_size
        first = stream.read(first_size).decode('utf-8', errors='replace')
        stream.seek(-last_size, 2)
        last = stream.read(last_size).decode('utf-8', errors='replace')
    note = (f'\n[OUTPUT TRUNCATED: showing the first {first_size} and last {last_size} '
            f'of {size} bytes; full output: {path}]\n')
    return first + note + last, True


class ContainerShell:
    def __init__(self, container_id: str, task: str, suite: str, log_dir: Path, docker: str = 'docker'):
        self.container_id = container_id
        self.task = task
        self.suite = suite
        self.docker = docker
        self.log_dir = log_dir.resolve()
        self.log_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

    def call(self, arguments: object) -> dict:
        args = validate_arguments(arguments)
        call_dir = self.log_dir / uuid.uuid4().hex
        call_dir.mkdir(mode=0o700)
        stdout_path, stderr_path = call_dir / 'stdout.log', call_dir / 'stderr.log'
        request = {'task': self.task, 'suite': self.suite, 'container_id': self.container_id, **args}
        (call_dir / 'request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n')
        # No host shell and no model-selected Docker options. GNU timeout creates
        # and kills the command's process group inside the container. TERM with
        # kill-after can leave a TERM-ignoring child when the main shell exits
        # before the grace period ends, so the deadline sends KILL immediately.
        # Do not use a host subprocess timeout (which would only kill docker).
        command = [
            self.docker, 'exec', '--workdir', '/workspace', self.container_id,
            '/usr/bin/timeout', '--signal=KILL',
            f'{args["timeout_seconds"]}s', '/bin/sh', '-lc', args['command'],
        ]
        infrastructure_error = None
        with stdout_path.open('xb') as stdout, stderr_path.open('xb') as stderr:
            try:
                completed = subprocess.run(command, stdout=stdout, stderr=stderr, check=False)
                exit_code = completed.returncode
            except OSError as exc:
                infrastructure_error = f'cannot execute Docker: {exc}'
                stderr.write(infrastructure_error.encode('utf-8', errors='replace'))
                exit_code = None
        stdout_text, stdout_truncated = preview(stdout_path)
        stderr_text, stderr_truncated = preview(stderr_path)
        result = {
            'exit_code': exit_code,
            'timeout_or_killed': exit_code in (124, 137),
            'stdout': stdout_text, 'stderr': stderr_text,
            'stdout_truncated': stdout_truncated, 'stderr_truncated': stderr_truncated,
            'stdout_log': str(stdout_path), 'stderr_log': str(stderr_path),
        }
        if infrastructure_error:
            result['infrastructure_error'] = infrastructure_error
        (call_dir / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        return {
            'content': [{'type': 'text', 'text': json.dumps(result, ensure_ascii=False)}],
            'isError': exit_code != 0,
        }


def respond(output: TextIO, request_id: object, *, result: object = None, error: dict | None = None):
    response = {'jsonrpc': '2.0', 'id': request_id}
    response['error' if error is not None else 'result'] = error if error is not None else result
    output.write(json.dumps(response, ensure_ascii=False) + '\n')
    output.flush()


def serve(shell: ContainerShell, input_stream: TextIO, output: TextIO, diagnostics: TextIO):
    initialized = False
    for line in input_stream:
        try:
            message = json.loads(line)
        except (ValueError, UnicodeError):
            respond(output, None, error={'code': -32700, 'message': 'Parse error'})
            continue
        if (not isinstance(message, dict) or message.get('jsonrpc') != '2.0'
                or not isinstance(message.get('method'), str)
                or ('id' in message and (isinstance(message['id'], bool)
                    or not isinstance(message['id'], (str, int, type(None)))))):
            respond(output, None, error={'code': -32600, 'message': 'Invalid Request'})
            continue
        # JSON-RPC notifications never receive a response. The task controller
        # owns cancellation and the overall budget; every call also has timeout.
        if 'id' not in message:
            continue
        request_id, method = message['id'], message['method']
        params = message.get('params', {})
        try:
            if not isinstance(params, dict):
                raise InvalidParams('params must be an object')
            if method == 'initialize':
                version = params.get('protocolVersion')
                if not isinstance(version, str):
                    raise InvalidParams('protocolVersion must be a string')
                result = {
                    'protocolVersion': version if version in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[-1],
                    'capabilities': {'tools': {'listChanged': False}},
                    'serverInfo': {'name': 'deep-student-container-shell', 'version': '1.0.0'},
                }
                initialized = True
            elif method == 'ping':
                result = {}
            elif method not in ('tools/list', 'tools/call'):
                respond(output, request_id, error={'code': -32601, 'message': 'Method not found'})
                continue
            elif not initialized:
                raise InvalidParams('initialize the MCP session before using tools')
            elif method == 'tools/list':
                result = {'tools': [TOOL]}
            else:
                if params.get('name') != 'shell':
                    raise InvalidParams('the only available tool is shell')
                result = shell.call(params.get('arguments', {}))
            respond(output, request_id, result=result)
        except InvalidParams as exc:
            respond(output, request_id, error={'code': -32602, 'message': str(exc)})
        except Exception as exc:
            print(f'MCP infrastructure error: {type(exc).__name__}: {exc}', file=diagnostics, flush=True)
            respond(output, request_id, error={'code': -32603, 'message': 'MCP infrastructure failure; see controller logs'})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--container', required=True)
    parser.add_argument('--task', required=True)
    parser.add_argument('--suite', required=True)
    parser.add_argument('--log-dir', type=Path, required=True)
    parser.add_argument('--toy', action='store_true', help='Require the explicit ds.bench.toy=true test-container label.')
    args = parser.parse_args()
    try:
        executable = shutil.which('docker')
        if not executable:
            raise BridgeError('Docker CLI is not on the controller-provided PATH')
        docker = str(Path(executable).resolve())
        container_id = inspect_container(args.container, args.task, args.suite, args.toy, docker)
        shell = ContainerShell(container_id, args.task, args.suite, args.log_dir, docker)
    except (BridgeError, OSError) as exc:
        print(f'MCP startup failed: {exc}', file=sys.stderr, flush=True)
        return 2
    serve(shell, sys.stdin, sys.stdout, sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
