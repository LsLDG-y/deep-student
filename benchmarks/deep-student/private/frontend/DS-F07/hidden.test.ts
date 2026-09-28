import { beforeEach,describe,it,expect,vi } from 'vitest';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
vi.mock('@tauri-apps/api/event',()=>({listen:vi.fn(async()=>()=>{})}));
import { invoke } from '@tauri-apps/api/core';
import { ChatV2TauriAdapter } from '@/features/chat/adapters/TauriAdapter';
function adapter(){return new ChatV2TauriAdapter('model_session',{sessionId:'model_session',chatParams:{},getOrderedMessages:()=>[],messageMap:new Map(),blocks:new Map()} as any) as any;}
beforeEach(()=>{vi.mocked(invoke).mockImplementation(async(cmd)=>cmd==='get_api_configurations'?[{id:'old'},{id:'new'},{id:'override'}]:cmd==='get_model_assignments'?{model2_config_id:'new'}:[]);});
describe('effective chat model configuration',()=>{
 it('F2P follows the current default when historical model state was not pinned',async()=>{const a=adapter();expect((await a.normalizeChatModelSelection('old',undefined,false)).effectiveModelId).toBe('new');expect((await a.normalizeChatModelSelection('old',undefined,undefined)).effectiveModelId).toBe('new');});
 it('P2P preserves explicit user choices and valid runtime overrides',async()=>{const a=adapter();expect((await a.normalizeChatModelSelection('old',undefined,true)).effectiveModelId).toBe('old');expect((await a.normalizeChatModelSelection('old','override',false)).effectiveModelId).toBe('override');});
});
