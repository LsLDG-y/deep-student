import { beforeEach,describe,expect,it,vi } from 'vitest';
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke}));
vi.mock('@/utils/shared',()=>({isTauriRuntime:true}));
import {saveSettings,getSetting} from '@/utils/settingsApi';
beforeEach(()=>{invoke.mockReset();localStorage.clear();});
describe('authoritative settings transaction',()=>{
 it('F2P an unreadable native baseline aborts before the first write',async()=>{
  localStorage.setItem('provider','stale cache');
  invoke.mockImplementation(async(cmd:string)=>{if(cmd==='get_setting')throw Error('native database unavailable');});
  await expect(saveSettings({provider:'new',model:'new'})).rejects.toThrow();
  expect(invoke.mock.calls.filter(([cmd])=>cmd==='save_setting'||cmd==='delete_setting')).toEqual([]);
 });
 it('F2P failed compensation must not abandon remaining compensation or replace the original error',async()=>{
  const data=new Map([['a','old-a'],['b','old-b']]);
  invoke.mockImplementation(async(cmd:string,args:any)=>{
   if(cmd==='get_setting')return data.get(args.key)??null;
   if(cmd==='save_setting') {if(args.key==='c')throw Error('original write failed');if(args.key==='b'&&args.value==='old-b')throw Error('compensation failed');data.set(args.key,args.value);}
  });
  await expect(saveSettings({a:'new-a',b:'new-b',c:'new-c'})).rejects.toThrow('original write failed');
  expect(data.get('a')).toBe('old-a');
 });
 it('P2P successful native batch writes persist all settings',async()=>{
  const data=new Map<string,string>();invoke.mockImplementation(async(cmd:string,args:any)=>{if(cmd==='get_setting')return data.get(args.key)??null;if(cmd==='save_setting')data.set(args.key,args.value);});
  await saveSettings({a:'new-a',b:'new-b'});expect([...data]).toEqual([['a','new-a'],['b','new-b']]);
 });
 it('P2P display-only reads retain cache fallback',async()=>{localStorage.setItem('a','cached');invoke.mockRejectedValue(Error('offline'));await expect(getSetting('a')).resolves.toBe('cached');});
});
