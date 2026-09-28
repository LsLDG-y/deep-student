#!/usr/bin/env python3
"""Prepare pinned dependencies on the host, then build an offline evaluator image.

The image contains toolchains and third-party dependencies only: no project
source, reference solution, candidate, hidden test, or grading result is copied.
"""
from __future__ import annotations
import argparse, concurrent.futures, gzip, json, os, shutil, subprocess, sys, tarfile, tempfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SUITE = json.loads((HERE / 'suite.json').read_text())
ANCHOR = SUITE['source_commit']
NODE = '22.22.0'
BASE = 'rust:1.94-bookworm'

def run(args, cwd=None, **kwargs):
    print('+', ' '.join(str(a) for a in args), flush=True)
    return subprocess.run([str(a) for a in args], cwd=cwd, check=True, **kwargs)

def download(url, path, headers=None):
    if path.is_file() and path.stat().st_size:
        return
    print('Downloading', url.split('?')[0], flush=True)
    temporary = path.with_name(path.name + '.part')
    args=['curl','--fail','--location','--silent','--show-error','--retry','2','--retry-all-errors','--connect-timeout','20','--max-time','3600','--continue-at','-']
    for key,value in (headers or {}).items():args.extend(['--header',key+': '+value])
    args.extend(['--output',str(temporary),url])
    subprocess.run(args,check=True)
    temporary.replace(path)

def fetch_json(url, headers=None):
    args=['curl','--fail','--location','--silent','--show-error','--retry','2','--retry-all-errors','--connect-timeout','20','--max-time','120']
    for key,value in (headers or {}).items():args.extend(['--header',key+': '+value])
    return json.loads(subprocess.check_output([*args,url]))

def restore_base_from_host(context, architecture):
    """Recover a missing/incomplete official base via host networking.

    This is used only when docker run proves the local image cannot start.
    It avoids relying on Docker daemon DNS and never deletes existing images.
    """
    cache=context/'base-cache';cache.mkdir(exist_ok=True)
    repo='library/rust'
    token=fetch_json('https://auth.docker.io/token?service=registry.docker.io&scope=repository:'+repo+':pull')['token']
    headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json'}
    def get_manifest(tag):
        url='https://registry-1.docker.io/v2/'+repo+'/manifests/'+tag
        return fetch_json(url,headers)
    index=get_manifest('1.94-bookworm')
    chosen=next(m for m in index['manifests'] if m.get('platform',{}).get('os')=='linux' and m.get('platform',{}).get('architecture')==architecture)
    manifest=get_manifest(chosen['digest'])
    cfg=manifest['config']['digest'].split(':')[1]+'.json'
    download('https://registry-1.docker.io/v2/'+repo+'/blobs/'+manifest['config']['digest'],cache/cfg,headers)
    def layer(layer):
        digest=layer['digest'];stem=digest.split(':')[1];compressed=cache/(stem+'.tar.gz');raw=cache/(stem+'.tar')
        download('https://registry-1.docker.io/v2/'+repo+'/blobs/'+digest,compressed,headers)
        if not raw.exists():
            with gzip.open(compressed,'rb') as src,raw.open('wb') as dst:shutil.copyfileobj(src,dst)
        return raw.name
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(manifest['layers'])) as pool:
        layers=list(pool.map(layer,manifest['layers']))
    docker_manifest=[{'Config':cfg,'RepoTags':[BASE],'Layers':layers}]
    (cache/'manifest.json').write_text(json.dumps(docker_manifest))
    archive=cache/'base-image.tar'
    with tarfile.open(archive,'w') as tar:
        for name in [cfg,'manifest.json',*layers]:tar.add(cache/name,arcname=name)
    run(['docker','load','-i',archive])

def prepare(context, architecture, install_node_deps=True):
    context.mkdir(parents=True,exist_ok=True)
    deps=context/'deps';deps.mkdir(exist_ok=True)
    for rel in ['package.json','package-lock.json','.npmrc']:
        (deps/rel).write_bytes(subprocess.check_output(['git','show',ANCHOR+':'+rel],cwd=ROOT))
    for rel in subprocess.check_output(['git','ls-tree','-r','--name-only',ANCHOR,'patches'],cwd=ROOT,text=True).splitlines():
        path=deps/rel;path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(subprocess.check_output(['git','show',ANCHOR+':'+rel],cwd=ROOT))
    cpu={'arm64':'arm64','amd64':'x64'}[architecture]
    if install_node_deps:
        # npm 11 --prefix can misread this legacy-peer lock. Run in the fixture cwd.
        # Repeated runs preserve existing trees before npm ci replaces its target.
        modules=deps/'node_modules'
        if modules.exists():
            previous=Path(tempfile.mkdtemp(prefix='deep-student-old-node-modules-'))/'node_modules'
            modules.rename(previous)
            print('Preserved previous dependencies at',previous,flush=True)
        run(['npm','ci','--ignore-scripts','--os=linux','--cpu='+cpu,'--no-audit','--no-fund'],cwd=deps)
    run(['node',deps/'node_modules/patch-package/index.js'],cwd=deps)
    node_dir='node-v'+NODE+'-linux-'+cpu
    archive=context/(node_dir+'.tar.xz')
    download('https://nodejs.org/dist/v'+NODE+'/'+archive.name,archive)
    if not (context/node_dir/'bin/node').is_file():
        with tarfile.open(archive,'r:xz') as tar:tar.extractall(context,filter='data')
    harness=HERE/'private/backend/harness';vendor=context/'cargo-vendor'
    if not vendor.is_dir():
        run(['cargo','vendor','--locked','--manifest-path',harness/'Cargo.toml',vendor],cwd=ROOT)
    warmup=context/'cargo-warmup';(warmup/'src').mkdir(parents=True,exist_ok=True)
    shutil.copy2(harness/'Cargo.toml',warmup/'Cargo.toml');shutil.copy2(harness/'Cargo.lock',warmup/'Cargo.lock')
    (warmup/'src/lib.rs').write_text('pub fn third_party_dependency_warmup() {}\n')
    (context/'cargo-config.toml').write_text('[source.crates-io]\nreplace-with = "vendored-sources"\n[source.vendored-sources]\ndirectory = "/opt/cargo-vendor"\n')
    shutil.copy2(HERE/'Dockerfile',context/'Dockerfile')
    (context/'.dockerignore').write_text('*\n!Dockerfile\n!deps\n!deps/node_modules\n!deps/node_modules/**\n!'+node_dir+'\n!'+node_dir+'/**\n!cargo-vendor\n!cargo-vendor/**\n!cargo-warmup\n!cargo-warmup/**\n!cargo-config.toml\n')
    return node_dir

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image',default=SUITE['image'])
    parser.add_argument('--architecture',choices=['arm64','amd64'],default='arm64')
    parser.add_argument('--context',type=Path,default=None)
    parser.add_argument('--reuse-node-deps',action='store_true',help='Reuse dependencies already installed by this script in the selected context')
    parser.add_argument('--prepare-only',action='store_true')
    args=parser.parse_args()
    context=(args.context or Path(tempfile.mkdtemp(prefix='deep-student-bench-image-'))).resolve()
    print('Build context:',context,flush=True)
    node_dir=prepare(context,args.architecture,not args.reuse_node_deps)
    if args.prepare_only:return
    probe=subprocess.run(['docker','run','--rm','--network','none',BASE,'python3','--version'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    inspected=subprocess.run(['docker','image','inspect',BASE,'--format','{{.Architecture}}'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if probe.returncode or inspected.stdout.strip()!=args.architecture:
        print('Official local base cannot start; restoring its layers through host networking.',flush=True)
        restore_base_from_host(context,args.architecture)
        run(['docker','run','--rm','--network','none',BASE,'python3','--version'])
    run(['docker','build','--network=none','--platform=linux/'+args.architecture,'--build-arg','BASE_IMAGE='+BASE,'--build-arg','NODE_DIRECTORY='+node_dir,'-t',args.image,context])
    run(['docker','run','--rm','--network','none',args.image,'sh','-c','python3 --version && node --version && cargo --version && node /opt/deps/node_modules/vitest/vitest.mjs --version'])
    print('Ready:',args.image,flush=True)
if __name__=='__main__':main()
