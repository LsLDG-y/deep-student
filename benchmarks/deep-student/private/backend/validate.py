"""Author-side triad replay. This is private evaluator tooling, never in candidate bundles."""
import json,os,subprocess,time,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];BASE=Path(__file__).resolve().parent
ANCHOR='d6534ff2715e59c4c2c3e6c7bec5f6554576ce68'
OUT=Path('/tmp/deep-student-backend-validation');OUT.mkdir(parents=True,exist_ok=True)
SOURCES=['src-tauri/src/mcp/client.rs','src-tauri/src/mcp/protocol_version.rs','src-tauri/src/mastery/bias.rs','src-tauri/src/utils/sse_buffer.rs','src-tauri/src/llm_manager/utf8_stream.rs','src-tauri/src/data_governance/sync/classification.rs','src-tauri/src/data_governance/sync/field_merge.rs','src-tauri/src/data_governance/sync/asset_filenames.rs','src-tauri/migrations/mistakes/V20260824__normalize_anki_card_optional_json.sql']
results=[]
for i in ([int(value) for value in sys.argv[1:]] or [1,2,3,4,5,6,7,8,9]):
 name=f'DS-B{i:02}';case=BASE/name;workspace=OUT/name;workspace.mkdir(parents=True,exist_ok=True)
 for rel in SOURCES:
  path=workspace/rel;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(subprocess.check_output(['git','show',f'{ANCHOR}:{rel}'],cwd=ROOT))
 cmd=['python3',str(case/'test.py')] if i==6 else ['cargo','test','--release','--locked','--manifest-path',str(BASE/'harness/Cargo.toml'),'--test',f'b{i:02}']
 env={**os.environ,'DS_SOURCE_ROOT':str(workspace)}
 record={'id':name,'environment':'macOS arm64; cargo 1.98.1; production modules from fixed anchor','runs':[]}
 for state in ['baseline','bug','reference']:
  if state=='bug':subprocess.run(['git','apply',str(case/'bug.patch')],cwd=workspace,check=True)
  if state=='reference':subprocess.run(['git','apply','-R',str(case/'bug.patch')],cwd=workspace,check=True)
  start=time.monotonic()
  try:
   p=subprocess.run(cmd,cwd=ROOT,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
   log=p.stdout;rc=p.returncode
  except subprocess.TimeoutExpired as ex:
   log=(ex.stdout or b'').decode() if isinstance(ex.stdout,bytes) else ex.stdout or '';log+='\nAUTHOR VALIDATION TIMEOUT\n';rc=124
  (case/f'verification-{state}.log').write_text(log)
  record['runs'].append({'state':state,'returncode':rc,'elapsed_seconds':round(time.monotonic()-start,3)})
  print(name,state,rc,round(time.monotonic()-start,3),flush=True)
 record['triad_passed']=[r['returncode']==0 for r in record['runs']]==[True,False,True]
 record['bug_failure_is_behavioral']=('FAILED' in (case/'verification-bug.log').read_text() and 'could not compile' not in (case/'verification-bug.log').read_text()) or i==6
 (case/'verification.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');results.append(record)
(BASE/'verification-summary.json').write_text(json.dumps([json.loads(p.read_text()) for p in sorted(BASE.glob('DS-B*/verification.json'))],ensure_ascii=False,indent=2)+'\n')
