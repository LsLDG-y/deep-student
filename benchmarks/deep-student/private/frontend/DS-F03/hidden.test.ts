import { afterEach,describe,it,expect,vi } from 'vitest';
import { createBlockInternal } from '@/features/chat/core/store/createChatStore';
afterEach(()=>vi.restoreAllMocks());
function harness(){let state:any={blocks:new Map([['earlier',{id:'earlier',messageId:'m',type:'thinking',status:'success',startedAt:100}],['answer',{id:'answer',messageId:'m',type:'content',status:'running',startedAt:300}]]),messageMap:new Map([['m',{id:'m',role:'assistant',blockIds:['earlier','answer'],timestamp:100}]]),activeBlockIds:new Set(),sessionStatus:'streaming',currentStreamingMessageId:'m'};return {state:()=>state,set:(p:any)=>{state={...state,...(typeof p==='function'?p(state):p)};}};}
describe('stream chronological insertion',()=>{
 it('F2P inserts a delayed tool between earlier reasoning and answer',()=>{const h=harness();vi.spyOn(Date,'now').mockReturnValue(200);createBlockInternal('m','mcp_tool','late',h.set as any,h.state as any);expect(h.state().messageMap.get('m').blockIds).toEqual(['earlier','late','answer']);expect(h.state().blocks.get('late').type).toBe('mcp_tool');});
 it('P2P appends ordinary events and keeps equal timestamp order stable',()=>{const h=harness();vi.spyOn(Date,'now').mockReturnValue(300);createBlockInternal('m','content','same',h.set as any,h.state as any);expect(h.state().messageMap.get('m').blockIds).toEqual(['earlier','answer','same']);});
});
