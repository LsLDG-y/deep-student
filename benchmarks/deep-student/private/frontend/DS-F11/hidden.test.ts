import { beforeEach,describe,it,expect,vi } from 'vitest';
import { renderHook,waitFor } from '@testing-library/react';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
vi.mock('@/features/chat/core/session/sessionManager',()=>({sessionManager:{subscribe:vi.fn(()=>()=>{}),getCurrentSessionId:vi.fn()}}));
vi.mock('@/features/chat/core/session/createSessionWithDefaults',()=>({createSessionWithDefaults:vi.fn()}));
import { invoke } from '@tauri-apps/api/core';
import { useSidebarSessionData } from '@/features/chat/hooks/useSessionManagement';
const row=(id:string,t:string,groupId?:string)=>({id,title:id,updatedAt:t,groupId,createdAt:t,persistStatus:'active',mode:'chat'});
function mock(grouped:any[],plain:any[]){vi.mocked(invoke).mockImplementation(async(cmd,args:any)=>cmd==='chat_v2_list_groups'?[]:args?.groupId==='*'?grouped:plain);}
beforeEach(()=>vi.clearAllMocks());
describe('sidebar merged session identity',()=>{
 it('F2P gives one row to a session present in both response windows',async()=>{mock([row('duplicate','2026-08-01','group'),row('old','2026-07-01','group')],[row('duplicate','2026-08-02')]);const {result}=renderHook(()=>useSidebarSessionData());await waitFor(()=>expect(result.current.isLoaded).toBe(true));expect(result.current.sessions.map(s=>s.id)).toEqual(['duplicate','old']);expect(result.current.sessions[0].updatedAt).toBe('2026-08-02');});
 it('P2P preserves unique grouped and ungrouped rows in recency order',async()=>{mock([row('group','2026-08-01','g')],[row('plain','2026-08-03')]);const {result}=renderHook(()=>useSidebarSessionData());await waitFor(()=>expect(result.current.isLoaded).toBe(true));expect(result.current.sessions.map(s=>s.id)).toEqual(['plain','group']);});
});
