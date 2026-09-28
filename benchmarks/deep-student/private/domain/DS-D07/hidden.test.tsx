import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import * as api from '@/features/mindmap/api/mindmapApi';
import {createMindMapStore,type MindMapStoreApi} from '@/features/mindmap/store/mindmapStore';
vi.mock('@/features/mindmap/api/mindmapApi',()=>({getMindMap:vi.fn(),getMindMapContent:vi.fn(),createMindMap:vi.fn(),updateMindMap:vi.fn()}));
vi.mock('@/components/UnifiedNotification',()=>({showGlobalNotification:vi.fn()}));
const metadata=(id:string)=>({id,resourceId:'r_'+id,title:id,isFavorite:false,defaultView:'mindmap',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'} as any);
function deferred<T>() {let resolve!:(v:T)=>void, reject!:(e:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject};}
let store:MindMapStoreApi;
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();sessionStorage.clear();store=createMindMapStore();vi.mocked(api.getMindMap).mockImplementation(async id=>metadata(id));vi.mocked(api.getMindMapContent).mockResolvedValue(null);});
afterEach(()=>{store.getState().destroy();vi.useRealTimers();});

describe('load lifecycle ownership',()=>{
 it.each(['reset','destroy'] as const)('F2P %s retires pending loads',async action=>{
  const request=deferred<any>();vi.mocked(api.getMindMap).mockReturnValueOnce(request.promise);const loading=store.getState().loadMindMap('retired');store.getState()[action]();request.resolve(metadata('retired'));await loading;expect(store.getState().mindmapId).toBeNull();
 });
 it('F2P creation retires an older load and cannot publish over a newer load',async()=>{
  const loadingResult=deferred<any>();vi.mocked(api.getMindMap).mockReturnValueOnce(loadingResult.promise);const loading=store.getState().loadMindMap('old');vi.mocked(api.createMindMap).mockResolvedValueOnce(metadata('created'));await store.getState().createNewMindMap('created');loadingResult.resolve(metadata('old'));await loading;expect(store.getState().mindmapId).toBe('created');
  const creationResult=deferred<any>();vi.mocked(api.createMindMap).mockReturnValueOnce(creationResult.promise);const creating=store.getState().createNewMindMap('slow');await store.getState().loadMindMap('latest');creationResult.resolve(metadata('slow'));await expect(creating).resolves.toBe('slow');expect(store.getState().mindmapId).toBe('latest');
 });
 it('P2P ordinary loads and creation publish their documents',async()=>{await store.getState().loadMindMap('normal');expect(store.getState().mindmapId).toBe('normal');vi.mocked(api.createMindMap).mockResolvedValueOnce(metadata('created'));await store.getState().createNewMindMap('created');expect(store.getState().mindmapId).toBe('created');});
});
