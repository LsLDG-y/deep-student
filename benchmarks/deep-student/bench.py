#!/usr/bin/env python3
"""Maintainer-side benchmark CLI. Never give this directory to the tested agent."""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SUITE = json.loads((HERE / 'suite.json').read_text())
ANCHOR = SUITE['source_commit']
RUST_RAW_STRING = re.compile(r'(?:br|r)(#*)"')
RUST_CHAR = re.compile(r"'(?:\\(?:u\{[0-9a-fA-F_]+\}|x[0-9a-fA-F]{2}|.)|[^'\\\n])'")


class BenchError(Exception):
    pass


def run(args, *, cwd=None, timeout=120, check=True, env=None):
    p = subprocess.run([str(x) for x in args], cwd=cwd, env=env,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if check and p.returncode:
        raise BenchError(f"command failed ({p.returncode}): {args[0]}\n{p.stderr.decode(errors='replace')[-6000:]}")
    return p


def run_evaluation(command, source, out, timeout, env, container=None):
    """Keep untrusted output out of host RAM, and stop a timed-out container."""
    with (out / 'stdout.txt').open('wb') as stdout, (out / 'stderr.txt').open('wb') as stderr:
        try:
            return subprocess.run([str(x) for x in command], cwd=source, env=env,
                                  stdout=stdout, stderr=stderr, timeout=timeout).returncode
        except subprocess.TimeoutExpired:
            if container:
                run(['docker', 'stop', '--time', '1', container], check=False, timeout=15)
            raise


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def cases():
    found = {}
    for p in sorted((HERE / 'private').glob('*/*/case.json')):
        c = json.loads(p.read_text())
        if c['id'] in found:
            raise BenchError(f"duplicate case id: {c['id']}")
        c['_dir'] = p.parent
        found[c['id']] = c
    return found


def choose(selector):
    available = cases()
    ids = list(available) if selector == 'all' else selector.split(',')
    if len(ids) != len(set(ids)):
        raise BenchError('duplicate task ids are not allowed')
    missing = set(ids) - available.keys()
    if missing:
        raise BenchError(f'unknown task: {sorted(missing)}')
    return [available[x] for x in ids]


def lexical_mask(text):
    """Mask Rust strings/comments, retaining character offsets for balanced items."""
    out = list(text)
    i, n = 0, len(text)
    while i < n:
        end = None
        if text.startswith('//', i):
            end = text.find('\n', i)
            if end < 0:
                end = n
        elif text.startswith('/*', i):
            j, depth = i + 2, 1
            while j < n and depth:
                if text.startswith('/*', j):
                    depth += 1
                    j += 2
                elif text.startswith('*/', j):
                    depth -= 1
                    j += 2
                else:
                    j += 1
            end = j
        else:
            raw = RUST_RAW_STRING.match(text, i) if text[i] in 'br' else None
            if raw:
                close = '"' + raw[1]
                pos = text.find(close, i + len(raw[0]))
                end = n if pos < 0 else pos + len(close)
            elif text[i] == '"':
                j = i + 1
                while j < n:
                    if text[j] == '\\':
                        j += 2
                    elif text[j] == '"':
                        j += 1
                        break
                    else:
                        j += 1
                end = j
            elif text[i] == "'":
                char = RUST_CHAR.match(text, i)
                if char:
                    end = i + len(char[0])
        if end is not None:
            for j in range(i, min(end, n)):
                if out[j] != '\n':
                    out[j] = ' '
            i = end
        else:
            i += 1
    return ''.join(out)


def strip_rust_tests(text):
    """Remove syntactic #[cfg(test)] items, not arbitrary keyword-bearing code."""
    if not re.search(r'#\[\s*(?:cfg\b|(?:tokio::)?test\b)', text):
        return text
    mask = lexical_mask(text)
    spans = []
    attrs = r'(?m)^[ \t]*#\[\s*(?:cfg\s*\([^\]\n]*\btest\b[^\]\n]*\)|(?:tokio::)?test(?:\([^\]\n]*\))?)\s*\][ \t]*'
    for m in re.finditer(attrs, mask):
        if spans and m.start() < spans[-1][1]:
            continue
        original_attr = text[m.start():m.end()]
        cfg = re.search(r'cfg\s*\((.*)\)\s*\]', original_attr)
        if cfg and cfg_without_test(cfg[1]) is not False:
            continue
        i, depth = m.end(), 0
        # Additional attributes can contain braces, so skip them as complete brackets.
        while i < len(mask):
            if mask[i].isspace():
                i += 1
            elif mask.startswith('#[', i):
                j, brackets = i + 2, 1
                while j < len(mask) and brackets:
                    brackets += (mask[j] == '[') - (mask[j] == ']')
                    j += 1
                i = j
            else:
                break
        j = i
        while j < len(mask):
            if mask[j] == '{':
                depth += 1
            elif mask[j] == '}':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            elif mask[j] == ';' and depth == 0:
                j += 1
                break
            j += 1
        if j >= len(mask) and depth:
            raise BenchError('unbalanced Rust cfg(test) item')
        spans.append((m.start(), j))
    for a, b in reversed(spans):
        text = text[:a] + text[b:]
    return text


def cfg_without_test(expression):
    """Three-valued cfg evaluation: remove only items impossible outside tests."""
    tokens = re.findall(r'[A-Za-z_][A-Za-z_0-9]*|"(?:\\.|[^"\\])*"|[(),=]', expression)
    pos = 0

    def parse():
        nonlocal pos
        if pos >= len(tokens):
            raise ValueError('missing cfg operand')
        atom = tokens[pos]
        pos += 1
        if pos < len(tokens) and tokens[pos] == '(':
            pos += 1
            operands = []
            while pos < len(tokens) and tokens[pos] != ')':
                operands.append(parse())
                if pos < len(tokens) and tokens[pos] == ',':
                    pos += 1
                elif pos < len(tokens) and tokens[pos] != ')':
                    raise ValueError('invalid cfg separator')
            if pos == len(tokens):
                raise ValueError('unclosed cfg')
            pos += 1
            if atom == 'not' and len(operands) == 1:
                return None if operands[0] is None else not operands[0]
            if atom == 'all':
                return False if False in operands else (None if None in operands else True)
            if atom == 'any':
                return True if True in operands else (None if None in operands else False)
            return None
        if pos < len(tokens) and tokens[pos] == '=':
            pos += 2
            return None
        return False if atom == 'test' else None

    try:
        value = parse()
        return value if pos == len(tokens) else None
    except (ValueError, IndexError):
        return None


def included(name):
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts:
        return False
    if any(part in {'__tests__', 'tests', 'benches', 'target', '.git', 'node_modules'} for part in p.parts):
        return False
    if re.search(r'\.(test|spec)\.[^.]+$', name) or p.suffix == '.md':
        return False
    if p.suffix == '.rs' and (p.stem == 'tests' or p.stem.endswith(('_tests', '_test')) or p.stem.startswith(('test_', 'tests_'))):
        return False
    if name.startswith('src/demo/'):
        return False
    if name.startswith(('src/', 'src-tauri/', 'public/', 'patches/', 'scripts/')):
        return True
    return name in {'package.json', 'package-lock.json', '.npmrc', 'index.html', 'LICENSE'} or (
        p.parent == PurePosixPath('.') and name.startswith(('tsconfig', 'vite.config', 'tailwind.config', 'postcss.config'))
    )


def snapshot(dest):
    dest.mkdir(parents=True, exist_ok=False)
    archive = run(['git', 'archive', ANCHOR], cwd=REPO).stdout
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:') as tf:
        for member in tf:
            if not member.isfile() or not included(member.name):
                continue
            target = dest / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(tf.extractfile(member).read())
            target.chmod(member.mode & 0o777)


def patch_environment(source):
    # Exported snapshots may live below another repository (e.g. <repo>/tmp).
    # Git otherwise discovers that parent and silently skips unrelated paths.
    inherited_context = {'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_PREFIX'}
    env = {key: value for key, value in os.environ.items() if key not in inherited_context}
    env['GIT_CEILING_DIRECTORIES'] = str(source.resolve().parent)
    return env


def apply_patch(source, patch, *, reverse=False):
    cmd = ['git', '-c', 'core.hooksPath=/dev/null', 'apply', '--whitespace=nowarn']
    if reverse:
        cmd.append('--reverse')
    env = patch_environment(source)
    run(cmd + ['--check', str(patch.resolve())], cwd=source, env=env)
    run(cmd + [str(patch.resolve())], cwd=source, env=env)


def sanitize(source, case):
    for p in source.rglob('*.rs'):
        if 'vendor' in p.parts:
            continue
        original = p.read_text()
        cleaned = strip_rust_tests(original)
        if cleaned != original:
            p.write_text(cleaned)
    for redaction in case.get('redactions', []):
        p = source / redaction['path']
        text = p.read_text()
        old = redaction['old']
        if old in text:
            p.write_text(text.replace(old, redaction.get('new', '')))


def prepare_source(case, dest, *, buggy=True):
    snapshot(dest)
    if buggy:
        apply_patch(dest, case['_dir'] / 'bug.patch')
    sanitize(dest, case)


def task_text(case):
    return f'''# {case['id']}: {case['title']}

{case['problem_zh']}

## 交付

请在这个项目里定位根因并完成修复。保留相关正常行为，不以重写模块回避缺陷。
你可以阅读整个源码、编写自己的复现和回归测试。请在 `DIAGNOSIS.md` 中说明：
观察到的问题、因果链与影响范围、修改理由、实际执行的验证和未验证边界。
`DIAGNOSIS.md` 交给二轮复核，不用关键词给你的解释打分。

提交工作区即可，评测器会提取生产代码差异，在新的环境中执行隐藏行为测试。
可提交的生产代码范围：src/、src-tauri/src/、src-tauri/migrations/。
依赖、测试配置、评测器不是本题修复对象；可以自建本地测试，但它们不替代隐藏判分。
建议时间预算：{SUITE['agent_budget_minutes']} 分钟。时间与 token 消耗由外部 Agent 驱动器记录。
前端可自建 tests/*.test.ts(x) 后运行 `npm test -- --configLoader runner`。
Rust 的公开模块编译入口为 `.benchmark-support/rust/Cargo.toml`，没有隐藏测试；
可在该目录 tests/ 下添加自己的用例，再运行
`DS_SOURCE_ROOT=$PWD cargo test --release --offline --manifest-path .benchmark-support/rust/Cargo.toml`。
本镜像未预置完整原生桌面的图形/编译栈；本轮没有视觉验收题。
若另行进行界面验证，按项目要求使用 `npm run tauri dev`，不要使用 demo 页面。
本套机器判分覆盖生产模块与协议行为，不声称验证了完整桌面 UI 或真实云服务。
'''


def init_public_git(source):
    run(['git', 'init', '-q'], cwd=source)
    run(['git', 'config', 'user.name', 'Benchmark'], cwd=source)
    run(['git', 'config', 'user.email', 'benchmark@invalid'], cwd=source)
    run(['git', 'config', 'core.hooksPath', '/dev/null'], cwd=source)
    (source / '.gitignore').write_text('node_modules/\ntarget/\n/tmp/\n.benchmark-tests/\n.benchmark-runner/\n')
    run(['git', 'add', '.'], cwd=source)
    env = {**os.environ, 'GIT_AUTHOR_DATE': '2026-01-01T00:00:00Z', 'GIT_COMMITTER_DATE': '2026-01-01T00:00:00Z'}
    run(['git', 'commit', '-qm', 'Task starting state'], cwd=source, env=env)
    run(['git', 'tag', 'task-start'], cwd=source)


def prepare(case, output):
    prepare_source(case, output)
    install_support(output)
    support = output / '.benchmark-support' / 'rust'
    for name in ['Cargo.toml', 'Cargo.lock', 'build.rs', 'src/lib.rs']:
        target = support / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(HERE / 'private/backend/harness' / name, target)
    public_config = (HERE / 'runtime/vitest.config.mts').read_text().replace(
        "['.benchmark-tests/**/*.{test,spec}.{ts,tsx}']",
        "['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}']")
    (output / 'vitest.config.ts').write_text(public_config)
    (output / 'TASK.md').write_text(task_text(case))
    init_public_git(output)
    return {'task_id': case['id'], 'workspace': str(output), 'prompt': str(output / 'TASK.md')}


def sandbox(case, output, image):
    result = prepare(case, output)
    # Some VM file shares map host ownership to root. This is an isolated,
    # newly exported task tree, never the original repository.
    for p in [output, *output.rglob('*')]:
        if not p.is_symlink():
            p.chmod(p.stat().st_mode | (0o777 if p.is_dir() else 0o666))
    check_docker_mount(output, image)
    (output / 'node_modules').symlink_to('/opt/deps/node_modules', target_is_directory=True)
    name = 'ds-bench-' + uuid.uuid4().hex[:12]
    command = ['docker', 'run', '-d', '--name', name, '--network', 'none', '--read-only',
               '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '256',
               '--memory', '4g', '--cpus', '2', '--user', f'{os.getuid()}:{os.getgid()}',
               '--tmpfs', '/tmp:rw,exec,nosuid,nodev,size=2g', '-e', 'HOME=/tmp/home',
               '-e', 'CARGO_TARGET_DIR=/tmp/cargo-target', '-e', 'CARGO_HOME=/tmp/cargo-home', '-e', 'DS_SOURCE_ROOT=/workspace',
               '--label', f'ds.bench.suite={SUITE["version"]}', '--label', f'ds.bench.task={case["id"]}',
               '-v', f'{output}:/workspace:rw', '-w', '/workspace', image,
               'sh', '-c', 'mkdir -p /tmp/home /tmp/cargo-home && git config --global --add safe.directory /workspace && cp /usr/local/cargo/config.toml /tmp/cargo-home/config.toml && cp -a /opt/cargo-target /tmp/cargo-target && exec sleep infinity']
    run(command)
    result.update({'container': name, 'network': 'none', 'image': image,
                   'tool_example': f'python3 {HERE / "bench.py"} exec {name} -- sh -lc "cat TASK.md"',
                   'stop_command': f'docker stop {name}', 'isolation_note': 'Agent tools must be limited to this container; do not grant host shell access.'})
    dump(output.parent / f'{output.name}.sandbox.json', result)
    return result


def container_exec(container, command):
    label = run(['docker', 'inspect', '--format', '{{index .Config.Labels "ds.bench.suite"}}', container]).stdout.decode().strip()
    if label != SUITE['version']:
        raise BenchError('container is not a sandbox for this suite version')
    if command and command[0] == '--':
        command = command[1:]
    if not command:
        raise BenchError('provide a command after --')
    # Stream directly; do not hide partial output of an agent's own diagnostics.
    return subprocess.call(['docker', 'exec', container, *command])


def reference_patch(case, output):
    root = Path(tempfile.mkdtemp(prefix='ds-bench-reference-'))
    fixed = root / 'reference'
    prepare_source(case, fixed, buggy=False)
    return collect(case, fixed, output)


def source_paths_ok(paths):
    for name in paths:
        p = PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or '\\' in name:
            raise BenchError(f'unsafe patch path: {name}')
        if not name.startswith(('src/', 'src-tauri/src/', 'src-tauri/migrations/')):
            raise BenchError(f'protected path in submission: {name}')
        if any(part.startswith('.') or part in {'__tests__', 'tests'} for part in p.parts):
            raise BenchError(f'protected path in submission: {name}')
        if re.search(r'\.(test|spec)\.[^.]+$', name):
            raise BenchError(f'test changes must not be in graded patch: {name}')


def validate_patch(patch):
    text = patch.read_text()
    if not text.strip():
        return []
    # Git's parser, rather than diff header string splitting, resolves changed paths.
    p = run(['git', 'apply', '--numstat', '-z', str(patch.resolve())],
            cwd=patch.resolve().parent, env=patch_environment(patch.resolve().parent))
    paths = []
    for record in p.stdout.split(b'\0'):
        if not record:
            continue
        fields = record.decode().split('\t', 2)
        if len(fields) != 3 or fields[0] == '-' or fields[1] == '-':
            raise BenchError('binary and rename patches are not accepted')
        paths.append(fields[2])
    source_paths_ok(paths)
    # Symlinks/submodules permit access outside the source tree. Modes are Git metadata.
    if re.search(r'(?m)^(?:new file mode|old mode|new mode|deleted file mode|index .*\.\..*) (?:120000|160000)\b', text):
        raise BenchError('symlink and submodule changes are not accepted')
    if 'GIT binary patch' in text:
        raise BenchError('binary patches are not accepted')
    return paths


def collect(case, workspace, output):
    """Compare with evaluator-rebuilt source; never trust agent Git refs or commits."""
    if output.exists():
        raise BenchError(f'output already exists: {output}')
    root = Path(tempfile.mkdtemp(prefix='ds-bench-collect-'))
    base = root / 'base'
    prepare_source(case, base)
    chunks = []
    for subtree in ['src', 'src-tauri/src', 'src-tauri/migrations']:
        before, after = base / subtree, workspace / subtree
        for ancestor in [after, *after.parents]:
            if ancestor == workspace:
                break
            if ancestor.is_symlink():
                raise BenchError(f'symlink directory in submission: {ancestor}')
        all_paths = set(p.relative_to(base) for p in before.rglob('*') if p.is_file())
        if after.exists():
            all_paths |= {p.relative_to(workspace) for p in after.rglob('*') if p.is_file() or p.is_symlink()}
        for relative in sorted(all_paths):
            a, b = base / relative, workspace / relative
            parents = [b, *b.parents][:len(relative.parts)]
            if a.is_symlink() or any(p.is_symlink() for p in parents):
                raise BenchError(f'symlink in source submission: {relative}')
            if any(part in {'__tests__', 'tests'} for part in relative.parts) or re.search(r'\.(test|spec)\.[^.]+$', str(relative)):
                continue
            av = a.read_bytes() if a.exists() else b''
            bv = b.read_bytes() if b.exists() else b''
            if av == bv:
                continue
            import difflib
            try:
                lines = difflib.unified_diff(av.decode().splitlines(keepends=True), bv.decode().splitlines(keepends=True),
                    fromfile=f'a/{relative}' if a.exists() else '/dev/null',
                    tofile=f'b/{relative}' if b.exists() else '/dev/null')
                diff = ''.join(line if line.endswith('\n') else line + '\n\\ No newline at end of file\n' for line in lines)
            except UnicodeDecodeError:
                raise BenchError(f'binary source changes unsupported: {relative}')
            chunks.append(f'diff --git a/{relative} b/{relative}\n' + diff)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(''.join(chunks))
    paths = validate_patch(output)
    diagnosis = workspace / 'DIAGNOSIS.md'
    if diagnosis.is_file() and not diagnosis.is_symlink():
        output.with_suffix('.diagnosis.md').write_bytes(diagnosis.read_bytes())
    return {'task_id': case['id'], 'patch': str(output), 'changed_files': paths}


def git_file(path):
    return run(['git', 'show', f'{ANCHOR}:{path}'], cwd=REPO).stdout


def install_support(source):
    files = run(['git', 'ls-tree', '-r', '--name-only', ANCHOR, 'tests/ct/mocks', 'tests/vitest/mocks'], cwd=REPO).stdout.decode().splitlines()
    for name in files + ['vitest.setup.ts']:
        p = source / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(git_file(name))
    config = source / '.benchmark-runner' / 'vitest.config.mts'
    config.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(HERE / 'runtime/vitest.config.mts', config)


def install_test(case, source):
    install_support(source)
    folder = source / '.benchmark-tests'
    folder.mkdir(exist_ok=True)
    test_file = case.get('test_file', 'hidden.test.ts')
    candidate = case['_dir'] / test_file
    if not candidate.is_file():
        candidate = case['_dir'].parent / test_file
    if not candidate.is_file():
        raise BenchError(f'missing test: {candidate}')
    shutil.copyfile(candidate, folder / candidate.name)
    return folder / candidate.name


def parse_vitest(report, exit_code):
    data = json.loads(report.read_text())
    states = {}
    for suite in data.get('testResults', []):
        for test in suite.get('assertionResults', []):
            name = test['fullName']
            if name in states:
                raise BenchError(f'duplicate test name: {name}')
            states[name] = test['status']
    errors = data.get('numRuntimeErrorTestSuites', 0)
    valid = bool(states) and not errors and (exit_code == 0 or any(s == 'failed' for s in states.values()))
    return {'valid': valid, 'tests': states, 'exit_code': exit_code, 'runtime_errors': errors}


def evaluate_source(case, source, out, engine, image):
    out.mkdir(parents=True, exist_ok=False)
    if engine == 'docker':
        out.chmod(0o777)
    runner = case.get('runner', 'vitest')
    if isinstance(runner, dict):
        runner = runner.get('kind', 'vitest')
    if runner != 'vitest':
        return evaluate_native(case, source, out, engine, image)
    install_test(case, source)
    report = out / 'tests.json'
    node = source / 'node_modules'
    container = None
    if engine == 'local':
        node.symlink_to(REPO / 'node_modules', target_is_directory=True)
        cmd = [str(REPO / 'node_modules/.bin/vitest'), 'run', '--config', str(source / '.benchmark-runner/vitest.config.mts'),
               '--configLoader', 'runner', '--reporter=json', f'--outputFile={report}']
        env = {**os.environ, 'BENCH_CACHE': str(out / 'cache')}
    else:
        container = 'ds-eval-' + uuid.uuid4().hex[:12]
        node.symlink_to('/opt/deps/node_modules', target_is_directory=True)
        cmd = ['docker', 'run', '--rm', '--name', container, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
               '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '4g', '--cpus', '2',
               '--user', f'{os.getuid()}:{os.getgid()}', '--tmpfs', '/tmp:rw,nosuid,nodev,size=1g',
               '-v', f'{source}:/workspace:ro', '-v', f'{out}:/results:rw', '-w', '/workspace',
               image, '/opt/deps/node_modules/.bin/vitest', 'run', '--config', '.benchmark-runner/vitest.config.mts',
               '--configLoader', 'runner', '--reporter=json', '--outputFile=/results/tests.json']
        env = None
    started = time.monotonic()
    try:
        code = run_evaluation(cmd, source, out, case.get('timeout_seconds', SUITE['test_timeout_seconds']), env, container)
        if report.is_file():
            try:
                result = parse_vitest(report, code)
            except (ValueError, KeyError, TypeError, BenchError) as exc:
                result = {'valid': False, 'tests': {}, 'exit_code': code, 'error': f'invalid test report: {exc}'}
        else:
            result = {'valid': False, 'tests': {}, 'exit_code': code, 'error': 'test report missing'}
    except subprocess.TimeoutExpired:
        result = {'valid': False, 'tests': {}, 'error': 'test timeout'}
    result.update({'seconds': round(time.monotonic() - started, 3), 'engine': engine})
    dump(out / 'result.json', result)
    return result


def evaluate_native(case, source, out, engine, image):
    runner = case['runner']
    folder = source / '.benchmark-native'
    folder.mkdir()
    if runner == 'cargo':
        harness = case['_dir'].parent / 'harness'
        for name in ['Cargo.toml', 'Cargo.lock', 'build.rs', 'src/lib.rs', f'tests/{case["id"].lower().replace("ds-", "")}.rs']:
            target = folder / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(harness / name, target)
        test = case['id'].lower().replace('ds-', '')
        command = ['cargo', 'test', '--release', '--locked', '--offline', '--manifest-path', '.benchmark-native/Cargo.toml',
                   '--test', test, '--', '--test-threads=1', '--format=pretty']
    elif runner == 'python':
        shutil.copyfile(case['_dir'] / 'test.py', folder / 'test.py')
        shutil.copyfile(HERE / 'runtime/python_runner.py', folder / 'python_runner.py')
        command = ['python3', '.benchmark-native/python_runner.py', '.benchmark-native/test.py',
                   str(out / 'tests.json') if engine == 'local' else '/results/tests.json']
    else:
        raise BenchError(f'unknown native runner: {runner}')
    container = None
    if engine == 'local':
        env = {**os.environ, 'DS_SOURCE_ROOT': str(source), 'CARGO_TARGET_DIR': '/tmp/deep-student-bench-cargo-target'}
        cmd = command
    else:
        env = None
        container = 'ds-eval-' + uuid.uuid4().hex[:12]
        cmd = ['docker', 'run', '--rm', '--name', container, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
               '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '4g', '--cpus', '2',
               '--user', f'{os.getuid()}:{os.getgid()}', '--tmpfs', '/tmp:rw,exec,nosuid,nodev,size=2g',
               '-e', 'DS_SOURCE_ROOT=/workspace', '-e', 'CARGO_TARGET_DIR=/tmp/cargo-target', '-e', 'CARGO_HOME=/tmp/cargo-home',
               '-v', f'{source}:/workspace:ro', '-v', f'{out}:/results:rw', '-w', '/workspace', image]
        if runner == 'cargo':
            cmd += ['bash', '-c', 'mkdir -p /tmp/cargo-home && cp /usr/local/cargo/config.toml /tmp/cargo-home/config.toml && cp -a /opt/cargo-target /tmp/cargo-target && exec "$@"', 'bench']
        cmd += command
    started = time.monotonic()
    try:
        code = run_evaluation(cmd, source, out, case.get('timeout_seconds', 240), env, container)
        if runner == 'cargo':
            states = {}
            for name, state in re.findall(r'^test (.+?) \.\.\. (ok|FAILED|ignored)\s*$', (out / 'stdout.txt').read_text(errors='replace'), re.M):
                if name in states:
                    raise BenchError('duplicate native test name')
                states[name] = {'ok': 'passed', 'FAILED': 'failed', 'ignored': 'skipped'}[state]
            result = {'valid': bool(states) and (code == 0 or 'failed' in states.values()),
                      'tests': states, 'exit_code': code}
        elif (out / 'tests.json').exists():
            result = json.loads((out / 'tests.json').read_text())
            result['exit_code'] = code
        else:
            result = {'valid': False, 'tests': {}, 'exit_code': code, 'error': 'test report missing'}
    except subprocess.TimeoutExpired:
        result = {'valid': False, 'tests': {}, 'error': 'test timeout'}
    result.update({'seconds': round(time.monotonic() - started, 3), 'engine': engine})
    dump(out / 'result.json', result)
    return result


def calibration_path(case, engine):
    return case['_dir'] / f'calibration.{engine}.json'


def image_identity(image):
    return run(['docker', 'image', 'inspect', '--format', '{{.Id}}', image]).stdout.decode().strip()


def check_docker_mount(folder, image):
    """Verify the actual daemon sees this path before grading any submission."""
    folder.chmod(0o777)
    (folder / '.mount-read').write_text('DeepStudent benchmark mount probe\n')
    command = ['docker', 'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
               '--user', f'{os.getuid()}:{os.getgid()}', '--mount', f'type=bind,source={folder},target=/probe',
               image, 'python3', '-c',
               "from pathlib import Path; assert Path('/probe/.mount-read').read_text() == 'DeepStudent benchmark mount probe\\n'; Path('/probe/.mount-write').write_text('ok')"]
    p = run(command, check=False)
    if p.returncode or not (folder / '.mount-write').is_file():
        raise BenchError('Docker cannot read/write this host path. Use a Docker-shared path (on Colima, use <repo>/tmp rather than macOS /private/tmp). Details: ' + p.stderr.decode(errors='replace')[-2000:])


def calibrate(selected, output, engine, image):
    output.mkdir(parents=True, exist_ok=False)
    results = []
    image_id = image_identity(image) if engine == 'docker' else None
    if engine == 'docker':
        check_docker_mount(output, image)
    for case in selected:
        task = output / case['id']
        task.mkdir()
        print(f"calibrate {case['id']}", file=sys.stderr, flush=True)
        row = {'task_id': case['id'], 'suite_version': SUITE['version'], 'source_commit': ANCHOR,
               'engine': engine, 'image_id': image_id}
        try:
            bad, good = task / 'buggy', task / 'reference'
            prepare_source(case, bad)
            prepare_source(case, good, buggy=False)
            b = evaluate_source(case, bad, task / 'buggy-results', engine, image)
            g = evaluate_source(case, good, task / 'reference-results', engine, image)
            same = set(b['tests']) == set(g['tests'])
            f2p = sorted(n for n, status in b['tests'].items() if status == 'failed' and g['tests'].get(n) == 'passed')
            p2p = sorted(n for n, status in b['tests'].items() if status == 'passed' and g['tests'].get(n) == 'passed')
            valid = b['valid'] and g['valid'] and same and bool(f2p) and bool(p2p) and all(s == 'passed' for s in g['tests'].values())
            valid = valid and set(f2p + p2p) == set(b['tests'])
            row.update({'valid': valid, 'FAIL_TO_PASS': f2p, 'PASS_TO_PASS': p2p,
                        'buggy': b, 'reference': g, 'artifact_dir': str(task)})
        except (BenchError, OSError, subprocess.TimeoutExpired) as e:
            row.update({'valid': False, 'error': str(e)})
        dump(calibration_path(case, engine), row)
        results.append(row)
        print(f"  {case['id']}: {'VALID' if row['valid'] else 'INVALID'}", file=sys.stderr, flush=True)
    summary = {'total': len(results), 'valid': sum(r['valid'] for r in results), 'tasks': results}
    dump(output / 'calibration.json', summary)
    return summary


def score_tests(calibration, result):
    f2p, p2p = calibration['FAIL_TO_PASS'], calibration['PASS_TO_PASS']
    expected = set(f2p + p2p)
    states = result['tests']
    complete = bool(expected) and set(states) == expected
    repaired = [x for x in f2p if states.get(x) == 'passed']
    preserved = [x for x in p2p if states.get(x) == 'passed']
    resolved = result['valid'] and complete and len(repaired) == len(f2p) and len(preserved) == len(p2p) and result['exit_code'] == 0
    return {'resolved': resolved, 'score': 100 if resolved else 0,
            'FAIL_TO_PASS': {'passed': repaired, 'failed': [x for x in f2p if x not in repaired]},
            'PASS_TO_PASS': {'passed': preserved, 'failed': [x for x in p2p if x not in preserved]},
            'complete_test_inventory': complete}


def grade(case, patch, output, engine, image):
    output.mkdir(parents=True, exist_ok=False)
    result = {'schema_version': 1, 'task_id': case['id'], 'source_commit': ANCHOR,
              'category': case['category'], 'difficulty': case['difficulty'],
              'family': case.get('family', case['category']), 'engine': engine,
              'protocol': 'isolated_grading_only' if engine == 'docker' else 'development_not_isolated',
              'status': 'invalid', 'resolved': False, 'score': 0}
    try:
        submission = output / 'submission.patch'
        shutil.copyfile(patch, submission)
        if engine == 'docker':
            check_docker_mount(output, image)
        cal_path = calibration_path(case, engine)
        if not cal_path.is_file():
            raise BenchError(f'run calibration for {case["id"]} on {engine} first')
        cal = json.loads(cal_path.read_text())
        if not cal['valid'] or cal['source_commit'] != ANCHOR or cal.get('suite_version') != SUITE['version']:
            raise BenchError('task is not calibrated for this suite version and pinned anchor')
        if engine == 'docker':
            result['image_id'] = image_identity(image)
            if result['image_id'] != cal.get('image_id'):
                raise BenchError('container image changed since calibration; calibrate this image first')
        result['changed_files'] = validate_patch(submission)
        source = output / 'source'
        prepare_source(case, source)
        if submission.read_text().strip():
            apply_patch(source, submission)
        measured = evaluate_source(case, source, output / 'evaluation', engine, image)
        result.update(score_tests(cal, measured))
        result['status'] = 'resolved' if result['resolved'] else ('unresolved' if measured['valid'] else 'execution_error')
        result['execution'] = measured
    except (BenchError, OSError, subprocess.TimeoutExpired) as e:
        result['error'] = str(e)
    dump(output / 'result.json', result)
    diagnosis = patch.with_suffix('.diagnosis.md')
    if diagnosis.is_file():
        shutil.copyfile(diagnosis, output / 'DIAGNOSIS.md')
    dump(output / 'review-request.json', {
        'schema_version': 1, 'task_id': case['id'], 'machine_result': 'result.json',
        'submission_patch': 'submission.patch' if (output / 'submission.patch').is_file() else None,
        'diagnosis': 'DIAGNOSIS.md' if diagnosis.is_file() else None,
        'maintainer_case': str(case['_dir'] / 'case.json'),
        'reference_calibration': str(calibration_path(case, engine)),
        'review_status': 'pending', 'review_response_schema': str(HERE / 'review-response.schema.json'),
        'questions': ['根因解释是否与实际改动一致？', '是否存在硬编码、测试感知或其他绕过？', '修复是否覆盖了未测边界并控制了副作用？'],
    })
    return result


def summary(input_dir, output):
    rows = []
    # Candidate source and raw evaluation output live below task directories too.
    # Only the organizer's direct per-task result is authoritative.
    for p in input_dir.glob('*/result.json'):
        row = json.loads(p.read_text())
        if 'task_id' in row and 'score' in row:
            if p.parent.name != row['task_id']:
                raise BenchError('result directory does not match task id')
            rows.append(row)
    by_id = collections.defaultdict(list)
    for row in rows:
        if type(row.get('resolved')) is not bool or row.get('status') not in {'resolved', 'unresolved', 'invalid', 'execution_error'}:
            raise BenchError('malformed result: resolved must be boolean and status must be known')
        if row['resolved'] != (row['status'] == 'resolved') or row.get('score') != (100 if row['resolved'] else 0):
            raise BenchError('inconsistent result status/score')
        by_id[row['task_id']].append(row)
    duplicates = [k for k, v in by_id.items() if len(v) > 1]
    if duplicates:
        raise BenchError(f'duplicate task attempts; use one sealed run per report: {duplicates}')
    all_cases = cases()
    unknown = set(by_id) - all_cases.keys()
    if unknown:
        raise BenchError(f'unknown result ids: {sorted(unknown)}')
    solved = sum(bool(r['resolved']) for r in rows)
    groups = {}
    for field in ['difficulty', 'category', 'family']:
        grouped = collections.defaultdict(list)
        for c in all_cases.values():
            key = str(c.get(field, c['category']))
            grouped[key].append(c['id'])
        groups[field] = {k: {'total': len(ids), 'resolved': sum(bool(by_id[x][0]['resolved']) for x in ids if x in by_id),
                               'missing': sum(x not in by_id for x in ids)} for k, ids in grouped.items()}
    result = {'schema_version': 1, 'suite_version': SUITE['version'], 'total': len(all_cases), 'attempted': len(rows),
              'resolved': solved, 'score': round(100 * solved / len(all_cases), 2) if all_cases else 0,
              'missing': sorted(set(all_cases) - by_id.keys()), 'breakdown': groups,
              'interpretation': 'Full-suite strict resolution rate; missing/invalid tasks score zero. Difficulty is provisional.'}
    result['engines'] = sorted(set(r.get('engine', 'unknown') for r in rows))
    result['agent_isolation_verified'] = False
    result['agent_isolation_note'] = 'Grading isolation is automatic. Agent-side tool restrictions and prior task exposure must be attested by the external controller/reviewer.'
    dump(output, result)
    return result


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    sub.add_parser('list')
    sub.add_parser('doctor')
    prep = sub.add_parser('prepare')
    prep.add_argument('task')
    prep.add_argument('--output', type=Path, required=True)
    box = sub.add_parser('sandbox')
    box.add_argument('task')
    box.add_argument('--output', type=Path, required=True)
    box.add_argument('--image', default=SUITE['image'])
    execute = sub.add_parser('exec')
    execute.add_argument('container')
    execute.add_argument('args', nargs=argparse.REMAINDER)
    ref = sub.add_parser('reference-patch')
    ref.add_argument('task')
    ref.add_argument('--output', type=Path, required=True)
    col = sub.add_parser('collect')
    col.add_argument('task')
    col.add_argument('--workspace', type=Path, required=True)
    col.add_argument('--output', type=Path, required=True)
    cal = sub.add_parser('calibrate')
    cal.add_argument('task', nargs='?', default='all')
    g = sub.add_parser('grade')
    g.add_argument('task')
    g.add_argument('--patch', type=Path, required=True)
    batch = sub.add_parser('grade-set')
    batch.add_argument('--patch-dir', type=Path, required=True)
    for s in [cal, g, batch]:
        s.add_argument('--output', type=Path, required=True)
        s.add_argument('--engine', choices=['docker', 'local'], default='docker')
        s.add_argument('--image', default=SUITE['image'])
    agg = sub.add_parser('summarize')
    agg.add_argument('--input', type=Path, required=True)
    agg.add_argument('--output', type=Path, required=True)
    return p


def main():
    args = parser().parse_args()
    if args.command in {'prepare', 'sandbox', 'reference-patch', 'collect', 'grade'} and len(choose(args.task)) != 1:
        raise BenchError('this command accepts exactly one task id')
    if args.command == 'list':
        result = [{k: c.get(k) for k in ['id', 'title', 'category', 'difficulty', 'estimated_minutes']} for c in cases().values()]
    elif args.command == 'doctor':
        anchor = run(['git', 'cat-file', '-t', ANCHOR], cwd=REPO).stdout.decode().strip()
        docker = run(['docker', 'info', '--format', '{{.ServerVersion}}'], check=False)
        result = {'source_commit': ANCHOR, 'source_exists': anchor == 'commit', 'cases': len(cases()),
                  'docker_ready': docker.returncode == 0, 'local_node_modules': (REPO / 'node_modules').is_dir()}
    elif args.command == 'prepare':
        result = prepare(choose(args.task)[0], args.output.resolve())
    elif args.command == 'sandbox':
        result = sandbox(choose(args.task)[0], args.output.resolve(), args.image)
    elif args.command == 'exec':
        return container_exec(args.container, args.args)
    elif args.command == 'reference-patch':
        result = reference_patch(choose(args.task)[0], args.output.resolve())
    elif args.command == 'collect':
        result = collect(choose(args.task)[0], args.workspace.resolve(), args.output.resolve())
    elif args.command == 'calibrate':
        result = calibrate(choose(args.task), args.output.resolve(), args.engine, args.image)
        result = {k: result[k] for k in ['total', 'valid']}
    elif args.command == 'grade':
        result = grade(choose(args.task)[0], args.patch.resolve(), args.output.resolve(), args.engine, args.image)
    elif args.command == 'grade-set':
        args.output.mkdir(parents=True, exist_ok=False)
        for case in cases().values():
            patch = args.patch_dir.resolve() / f'{case["id"]}.patch'
            if patch.is_file():
                row = grade(case, patch, args.output.resolve() / case['id'], args.engine, args.image)
                print(f'{case["id"]}: {row["status"]}', file=sys.stderr, flush=True)
        result = summary(args.output.resolve(), args.output.resolve() / 'summary.json')
    else:
        result = summary(args.input.resolve(), args.output.resolve())
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.command == 'calibrate' and result['valid'] != result['total']:
        return 1
    if args.command == 'grade' and result['status'] in ['invalid', 'execution_error']:
        return 2
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (BenchError, OSError, subprocess.TimeoutExpired) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        sys.exit(2)
