import { beforeEach,describe,it,expect,vi } from 'vitest';
const m=vi.hoisted(()=>({adapterGet:vi.fn(),save:vi.fn(async()=>undefined),destroy:vi.fn(async()=>undefined)}));
vi.mock('@/features/chat/core/store/createChatStore',()=>({createChatStore:(id:string)=>{const s={sessionId:id,sessionStatus:'idle',pendingBlockingInteraction:null,activeBlockIds:new Set(),blocks:new Map(),attachments:[],abortStream:vi.fn(),saveSession:vi.fn(),loadSession:vi.fn()};return {getState:()=>s,subscribe:()=>()=>{}};}}));
vi.mock('@/features/chat/core/middleware/autoSave',()=>({autoSave:{forceImmediateSave:m.save,cleanup:vi.fn()}}));
vi.mock('@/features/chat/core/middleware/chunkBuffer',()=>({chunkBuffer:{flushAndCleanupSession:vi.fn(),flushSession:vi.fn()}}));
vi.mock('@/features/chat/core/middleware/eventBridge',()=>({clearProcessedEventIds:vi.fn(),clearBridgeState:vi.fn(),clearEventContext:vi.fn()}));
vi.mock('@/features/chat/core/store/variantActions',()=>({clearVariantDebounceTimersForSession:vi.fn()}));
vi.mock('@/features/chat/adapters/AdapterManager',()=>({adapterManager:{get:m.adapterGet,destroy:m.destroy}}));
vi.mock('@/features/chat/skills/progressiveDisclosure',()=>({clearSessionSkills:vi.fn()}));
import { SessionManagerImpl } from '@/features/chat/core/session/sessionManager';
beforeEach(()=>{vi.clearAllMocks();m.adapterGet.mockReturnValue({refCount:1,generation:1});});
describe('cache capacity after temporary leases',()=>{
 it('F2P reclaims all newly eligible excess on the next creation',async()=>{const manager=new SessionManagerImpl();manager.setMaxSessions(2);for(const id of ['one','two','three','four'])manager.getOrCreate(id);expect(manager.getAllSessionIds()).toHaveLength(4);m.adapterGet.mockReturnValue({refCount:0,generation:1});manager.getOrCreate('five');await vi.waitFor(()=>expect(manager.getAllSessionIds()).toHaveLength(2));expect(manager.has('five')).toBe(true);expect(m.save).toHaveBeenCalledTimes(3);});
 it('P2P leaves active leases and the current session alive',async()=>{const manager=new SessionManagerImpl();manager.setMaxSessions(1);manager.getOrCreate('current');manager.setCurrentSessionId('current');manager.getOrCreate('leased');await Promise.resolve();expect(manager.has('current')).toBe(true);expect(manager.has('leased')).toBe(true);expect(m.save).not.toHaveBeenCalled();});
});
