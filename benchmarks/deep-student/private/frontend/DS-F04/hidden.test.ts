import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { eventRegistry } from '@/features/chat/registry/eventRegistry';
import { handleBackendEventWithSequence,resetBridgeState,clearBridgeState,clearEventContext,clearProcessedEventIds,flushPendingBackendEvents } from '@/features/chat/core/middleware/eventBridge';
const seen:string[]=[];const active='bench_new';
function store(){return {sessionId:active,currentStreamingMessageId:'m',skillStateJson:'{"version":3}',messageMap:new Map(),blocks:new Map(),activeBlockIds:new Set(),streamingVariantIds:new Set(),createBlockWithId:vi.fn(),updateBlock:vi.fn(),setBlockError:vi.fn(),saveSession:vi.fn(async()=>{})} as any;}
function event(sessionId:string|undefined,id:string,seq=0){return {sequenceId:seq,sessionId,type:'tool_call',phase:'start',messageId:'m',blockId:id,skillStateVersion:3,payload:{toolName:'search'}} as any;}
beforeEach(()=>{seen.length=0;eventRegistry.clear();eventRegistry.register('tool_call',{onStart:(_s:any,_m:any,_p:any,id:string)=>{seen.push(id);return id;},onEnd:vi.fn(),onError:vi.fn()});resetBridgeState(active);});
afterEach(()=>{clearProcessedEventIds(active);clearEventContext(active);clearBridgeState(active);eventRegistry.clear();});
describe('session event ownership',()=>{
 it('F2P rejects a late event explicitly owned by the previous session',()=>{const s=store();handleBackendEventWithSequence(s,event('bench_old','old'));expect(seen).toEqual([]);});
 it('P2P accepts own events and legacy untagged events',()=>{const s=store();handleBackendEventWithSequence(s,event(active,'own'));handleBackendEventWithSequence(s,event(undefined,'legacy',1));expect(seen).toEqual(['own','legacy']);});
});
