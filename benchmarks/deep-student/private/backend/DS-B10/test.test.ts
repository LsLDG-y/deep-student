import {afterEach,expect,it,vi} from 'vitest';
import { applyActionGuards } from '@/features/generative-ui/actions';
import { GenerativeActionTimeoutError } from '@/features/generative-ui/handlers/actionTimeout';
import { GenerativeActionRateLimitError } from '@/features/generative-ui/handlers/actionRateLimit';
import type { GenerativeActionDefinition } from '@/features/generative-ui/types';
afterEach(()=>vi.useRealTimers());
const definition=(handler:GenerativeActionDefinition['handler'])=>({id:'inspect',label:'Inspect',riskLevel:'low',handler} as GenerativeActionDefinition);
it('regression: a timed-out operation can be retried after cooldown',async()=>{
 vi.useFakeTimers();let calls=0;
 const guarded=applyActionGuards(definition(()=>{calls++;return new Promise(()=>{});}),{timeoutMs:25,cooldownMs:10});
 for(let n=1;n<=3;n++){
  const result=guarded.handler({});const check=expect(result).rejects.toBeInstanceOf(GenerativeActionTimeoutError);
  await vi.advanceTimersByTimeAsync(40);await check;expect(calls).toBe(n);
 }
});
it('pass-to-pass: cooldown and successful handlers retain their behavior',async()=>{
 vi.useFakeTimers();let calls=0;
 const guarded=applyActionGuards(definition(async()=>++calls),{timeoutMs:100,cooldownMs:50});
 await expect(guarded.handler({})).resolves.toBe(1);
 await expect(guarded.handler({})).rejects.toBeInstanceOf(GenerativeActionRateLimitError);
 await vi.advanceTimersByTimeAsync(60);await expect(guarded.handler({})).resolves.toBe(2);
});
it('pass-to-pass: late rejection remains handled and a new action works',async()=>{
 vi.useFakeTimers();let late!:(e:Error)=>void;
 const guarded=applyActionGuards(definition(()=>new Promise((_,reject)=>{late=reject;})),{timeoutMs:20,cooldownMs:5});
 const result=guarded.handler({});const check=expect(result).rejects.toBeInstanceOf(GenerativeActionTimeoutError);
 await vi.advanceTimersByTimeAsync(25);await check;
 late(new Error('late'));await vi.advanceTimersByTimeAsync(1);
 const normal=applyActionGuards(definition(async()=> 'ok'),{timeoutMs:20,cooldownMs:5});
 await expect(normal.handler({})).resolves.toBe('ok');
});
