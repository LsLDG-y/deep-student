#!/usr/bin/env python3
"""Organizer-only OpenCode controller; the candidate gets one container tool."""
from __future__ import annotations

import argparse
import concurrent.futures
import collections
import datetime as dt
import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

import bench
from opencode_metrics import session_metrics

MODEL = 'opencode-go/deepseek-v4.1-flash'
HERE = Path(__file__).resolve().parent


def timestamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def isolated_controller(parent, task_id, container, auth, docker_host, *, toy=False, root=None):
    # Neither the original project nor the user's HOME is an ancestor.
    root = Path(root) if root is not None else Path(tempfile.mkdtemp(prefix=f'ds-opencode-{task_id}-'))
    root.chmod(0o700)
    for name in ['home', 'config/opencode', 'data/opencode', 'cache', 'state', 'controller']:
        (root / name).mkdir(parents=True, exist_ok=True)
    credential = root / 'data/opencode/auth.json'
    credential.write_text(json.dumps({'opencode-go': auth}))
    credential.chmod(0o600)
    command = [sys.executable, str(HERE / 'opencode_mcp.py'), '--container', container,
               '--task', task_id, '--suite', bench.SUITE['version'],
               '--log-dir', str(parent / 'tools')]
    if toy:
        command.append('--toy')
    config = {
        'model': MODEL,
        'enabled_providers': ['opencode-go'],
        'permission': {'*': 'deny', 'bench_*': 'allow'},
        'plugins': [str(HERE / 'opencode-plugin')],
        'mcp': {'servers': {'bench': {
            'type': 'local', 'command': command, 'codemode': False,
        }}},
    }
    (root / 'config/opencode/opencode.json').write_text(json.dumps(config, indent=2))
    # Do not inherit provider keys, user configuration, or arbitrary instructions.
    keep = ['PATH', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy',
            'all_proxy', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'LANG', 'LC_ALL', 'TMPDIR']
    env = {k: os.environ[k] for k in keep if k in os.environ}
    no_proxy = ','.join(filter(None, [os.environ.get('NO_PROXY'), '127.0.0.1,localhost,::1']))
    env.update(HOME=str(root / 'home'), XDG_CONFIG_HOME=str(root / 'config'),
               XDG_DATA_HOME=str(root / 'data'), XDG_CACHE_HOME=str(root / 'cache'),
               XDG_STATE_HOME=str(root / 'state'), OPENCODE_CONFIG_PROJECT_DISABLE='1',
               OPENCODE_CONFIG_DIR=str(root / 'config/opencode'),
               OPENCODE_API_KEY=auth['key'], DOCKER_HOST=docker_host,
               DS_BENCH_TOOL_AUDIT=str(parent / 'tools-sent.jsonl'),
               NO_PROXY=no_proxy, no_proxy=no_proxy)
    return root, credential, env


def read_events(path):
    events, invalid_lines = [], 0
    for line in path.read_text(errors='replace').splitlines():
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                events.append(value)
            else:
                invalid_lines += 1
        except ValueError:
            invalid_lines += 1
    return events, invalid_lines


def stop_container(container):
    errors = []
    try:
        stopped = subprocess.run(['docker', 'stop', '--timeout', '1', container],
                                 capture_output=True, timeout=30)
        if stopped.returncode:
            errors.append({'phase': 'container_stop', 'error': stopped.stderr.decode(errors='replace')[-2000:]})
    except Exception as exc:
        errors.append({'phase': 'container_stop', 'error': f'{type(exc).__name__}: {exc}'})
    # A successful stop command alone is not evidence that writes are revoked.
    try:
        state = subprocess.run(['docker', 'inspect', '--format', '{{.State.Running}}', container],
                               capture_output=True, timeout=15)
        confirmed = state.returncode == 0 and state.stdout.strip() == b'false'
        if not confirmed:
            errors.append({'phase': 'container_inspect', 'error': 'Container stop was not independently confirmed'})
    except Exception as exc:
        confirmed = False
        errors.append({'phase': 'container_inspect', 'error': f'{type(exc).__name__}: {exc}'})
    return confirmed, errors


def candidate(cli, task_id, container, out, auth, docker_host, minutes, prompt, *, toy=False):
    record = {'task_id': task_id, 'model': MODEL, 'started_at': timestamp(),
              'budget_seconds': minutes * 60, 'container': container, 'attempt': 1,
              'status': 'starting', 'infrastructure_errors': [], 'client_stopped': True}
    start = time.monotonic()
    process = root = credential = None
    output_ready = False
    try:
        out.mkdir(parents=True, exist_ok=False)
        output_ready = True
        root = Path(tempfile.mkdtemp(prefix=f'ds-opencode-{task_id}-', dir='/tmp'))
        credential = root / 'data/opencode/auth.json'
        record['controller'] = str(root)
        root, credential, env = isolated_controller(out, task_id, container, auth, docker_host,
                                                   toy=toy, root=root)
        bench.dump(out / 'attempt.json', record)
        (out / 'prompt.txt').write_text(prompt)
        remaining = minutes * 60 - (time.monotonic() - start)
        if not math.isfinite(remaining) or remaining <= 0:
            record['status'] = 'budget_exhausted'
        else:
            with (out / 'events.jsonl').open('wb') as stdout, (out / 'stderr.txt').open('wb') as stderr:
                process = subprocess.Popen(
                    [str(cli), 'run', '--standalone', '--auto', '--format', 'json',
                     '--model', MODEL, prompt], cwd=root / 'controller', env=env,
                    stdout=stdout, stderr=stderr, start_new_session=True)
                record.update(pid=process.pid, status='running', client_stopped=False)
                bench.dump(out / 'attempt.json', record)
                try:
                    record['exit_code'] = process.wait(timeout=max(0, minutes * 60 - (time.monotonic() - start)))
                    record['status'] = 'finished' if process.returncode == 0 else 'client_error'
                    if process.returncode:
                        record['infrastructure_errors'].append({'phase': 'client', 'error': f'OpenCode exited with code {process.returncode}'})
                except subprocess.TimeoutExpired:
                    record['status'] = 'budget_exhausted'
    except Exception as exc:
        record['status'] = 'controller_error'
        record['error'] = f'{type(exc).__name__}: {exc}'
        record['infrastructure_errors'].append({'phase': 'controller', 'error': record['error']})
    finally:
        # Client termination must not wait for, or depend on, Docker cleanup.
        if process is not None:
            try:
                try:
                    # The budget has no extra client grace period for more edits.
                    first_signal = signal.SIGKILL if record['status'] == 'budget_exhausted' else signal.SIGTERM
                    os.killpg(process.pid, first_signal)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=10)
                record['exit_code'] = process.returncode
                record['client_stopped'] = process.poll() is not None
            except Exception as exc:
                record['infrastructure_errors'].append({'phase': 'client_cleanup', 'error': f'{type(exc).__name__}: {exc}'})
        record['container_stopped'], errors = stop_container(container)
        record['infrastructure_errors'].extend(errors)
        try:
            if credential is not None and credential.exists():
                credential.write_text('{}\n')
            record['credential_cleared'] = True
        except Exception as exc:
            record['credential_cleared'] = False
            record['infrastructure_errors'].append({'phase': 'credential_cleanup', 'error': f'{type(exc).__name__}: {exc}'})
        record['elapsed_seconds'] = round(time.monotonic() - start, 3)
        record['ended_at'] = timestamp()
    events, invalid_lines = [], 0
    try:
        if output_ready and (out / 'events.jsonl').is_file():
            events, invalid_lines = read_events(out / 'events.jsonl')
    except Exception as exc:
        record['infrastructure_errors'].append({'phase': 'events', 'error': f'{type(exc).__name__}: {exc}'})
    record['invalid_event_lines'] = invalid_lines
    record['session_ids'] = sorted({e['sessionID'] for e in events if isinstance(e.get('sessionID'), str) and e['sessionID']})
    record['errors'] = [e.get('error') for e in events if e.get('type') == 'error']
    if record['errors']:
        record['infrastructure_errors'].append({'phase': 'client_events', 'error': record['errors']})
    record['usage_events'] = [e for e in events if e.get('type') in ('step_finish', 'usage')]
    try:
        record['metrics'] = session_metrics(root, record['session_ids']) if root is not None else {'error': 'Controller setup did not create a session directory'}
    except Exception as exc:
        record['metrics'] = {'error': f'{type(exc).__name__}: {exc}'}
    if output_ready:
        bench.dump(out / 'attempt.json', record)
    return record


PROMPT = """请完成容器 /workspace/TASK.md 中的工程修复任务。
你的全部文件、搜索、编辑和命令操作都必须使用 bench_shell 工具；它在独立、无网络的 Linux 容器中执行，默认工作目录为 /workspace。宿主路径不是任务工作区。
先读取 TASK.md，再按题面定位、修改生产源码并自行验证。可创建临时测试；以 TASK.md 的交付范围为准。不要等待维护者反馈或请求额外输入。
最后把根因、修改、实际验证命令和未验证边界写入 /workspace/DIAGNOSIS.md，再给出简短最终说明。没有隐藏评分反馈；请在本次独立会话内完成。
本题总墙钟预算为 {minutes} 分钟。不能访问原始 Git 历史、其他题或参考答案。
"""


def run_case(case, args, auth, docker_host):
    task_id = case['id']
    workspace = args.output / 'workspaces' / task_id
    out = args.output / 'attempts' / task_id
    print(f'{timestamp()} {task_id} preparing', flush=True)
    box = None
    try:
        box = bench.sandbox(case, workspace, bench.SUITE['image'])
        attempt = candidate(args.opencode, task_id, box['container'], out, auth, docker_host,
                            args.minutes, PROMPT.format(minutes=args.minutes))
    except Exception as exc:
        error = f'{type(exc).__name__}: {exc}'
        attempt = {'task_id': task_id, 'status': 'controller_error', 'error': error,
                   'infrastructure_errors': [{'phase': 'prepare_or_controller', 'error': error}],
                   'container_stopped': False, 'client_stopped': box is None}
        if box is not None:
            attempt['container_stopped'], errors = stop_container(box['container'])
            attempt['infrastructure_errors'].extend(errors)
    attempt['collection_status'] = 'not_collected'
    if not attempt.get('container_stopped'):
        attempt['collection_error'] = 'Container stop was not independently confirmed; refusing to collect'
        attempt['infrastructure_errors'].append({'phase': 'collection', 'error': attempt['collection_error']})
    else:
        try:
            bench.collect(case, workspace, args.output / 'submissions' / f'{task_id}.patch')
            attempt['collection_status'] = 'collected'
        except Exception as exc:
            attempt['collection_status'] = 'failed'
            attempt['collection_error'] = f'{type(exc).__name__}: {exc}'
            attempt['infrastructure_errors'].append({'phase': 'collection', 'error': attempt['collection_error']})
    bench.dump(out / 'attempt.json', attempt)
    print(f'{timestamp()} {task_id} {attempt["status"]} {attempt.get("elapsed_seconds", 0)}s', flush=True)
    return attempt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--opencode', type=Path, required=True)
    parser.add_argument('--auth-file', type=Path,
                        default=Path.home() / '.local/share/opencode/auth.json')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--tasks', default='all')
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--minutes', type=float, default=bench.SUITE['agent_budget_minutes'])
    args = parser.parse_args()
    if args.workers < 1 or not math.isfinite(args.minutes) or args.minutes <= 0:
        parser.error('workers and minutes must be finite and positive')
    args.opencode = args.opencode.resolve(strict=True)
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=False)
    auth = json.loads(args.auth_file.read_text())['opencode-go']
    if auth.get('type') != 'api' or not auth.get('key'):
        raise ValueError('Official opencode-go API credential is required')
    docker_host = subprocess.check_output(
        ['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
    version = subprocess.check_output([str(args.opencode), '--version'], text=True).strip()
    selected = bench.choose(args.tasks)
    run = {'schema_version': 1, 'suite_version': bench.SUITE['version'],
           'source_commit': bench.ANCHOR, 'model': MODEL, 'opencode_version': version,
           'started_at': timestamp(), 'tasks': [c['id'] for c in selected],
           'workers': args.workers, 'budget_minutes': args.minutes,
           'protocol': 'fresh-session pass@1; no hidden feedback; fixed container shell only',
           'prior_exposure': 'Organizer has reference answers; candidate receives no organizer history.'}
    bench.dump(args.output / 'run.json', run)
    failures, attempts, grade_states = [], {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(run_case, c, args, auth, docker_host): c['id'] for c in selected}
        for future in concurrent.futures.as_completed(futures):
            task_id = futures[future]
            try:
                attempt = future.result()
                attempts[task_id] = attempt
                failures.extend({'task_id': task_id, **error} for error in attempt.get('infrastructure_errors', []))
            except Exception as exc:
                error = f'{type(exc).__name__}: {exc}'
                failures.append({'task_id': task_id, 'phase': 'worker', 'error': error})
                attempts[task_id] = {'status': 'controller_error', 'collection_status': 'not_collected'}
                print(f'{timestamp()} {task_id} infrastructure error: {exc}', flush=True)
    # Grade only sealed submissions; one grading failure must not drop other tasks.
    for case in selected:
        task_id = case['id']
        patch = args.output / 'submissions' / f'{task_id}.patch'
        grade_dir = args.output / 'grades' / task_id
        result = None
        if attempts[task_id].get('collection_status') == 'collected' and patch.is_file():
            try:
                result = bench.grade(case, patch, grade_dir, 'docker', bench.SUITE['image'])
            except Exception as exc:
                error = f'{type(exc).__name__}: {exc}'
                failures.append({'task_id': task_id, 'phase': 'grading', 'error': error})
        else:
            error = 'No successfully collected submission is available'
            if attempts[task_id].get('collection_status') == 'collected':
                failures.append({'task_id': task_id, 'phase': 'collection', 'error': error})
        if result is None:
            result = {'schema_version': 1, 'suite_version': bench.SUITE['version'],
                      'source_commit': bench.ANCHOR, 'task_id': task_id, 'engine': 'docker',
                      'image_id': None, 'status': 'execution_error', 'resolved': False,
                      'score': 0, 'error': error}
            bench.dump(grade_dir / 'result.json', result)
        grade_states.append(result['status'])
        print(f'{timestamp()} {task_id} grade={result["status"]}', flush=True)
    try:
        result = bench.summary(args.output / 'grades', args.output / 'summary.json')
        run.update(score=result['score'], resolved=result['resolved'], total=result['total'])
    except Exception as exc:
        failures.append({'phase': 'summary', 'error': f'{type(exc).__name__}: {exc}'})
        run.update(score=None, resolved=None, total=len(bench.cases()))
    run.update(ended_at=timestamp(), infrastructure_failures=failures,
               status='completed_with_infrastructure_errors' if failures else 'completed',
               attempt_status_counts=dict(collections.Counter(a['status'] for a in attempts.values())),
               collection_status_counts=dict(collections.Counter(a.get('collection_status', 'not_collected') for a in attempts.values())),
               grade_status_counts=dict(collections.Counter(grade_states)))
    bench.dump(args.output / 'run.json', run)
    print(json.dumps(run, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
