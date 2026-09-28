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

describe('save operation ownership',()=>{
 it.each(['resolve','reject'] as const)('F2P obsolete save %s cannot mutate a later load of the same ID',async outcome=>{
  await store.getState().loadMindMap('same');store.setState({isDirty:true,_documentVersion:1});
  const result=deferred<any>();vi.mocked(api.updateMindMap).mockReturnValueOnce(result.promise);const pending=store.getState().save();
  await store.getState().loadMindMap('same');store.setState({isDirty:true,isSaving:true,_documentVersion:1});const current=store.getState().metadata;
  if(outcome==='resolve')result.resolve({...metadata('same'),title:'obsolete save'});else result.reject(Error('MINDMAP_UPDATE_CONFLICT'));
  await pending;expect(store.getState().isDirty).toBe(true);expect(store.getState().isSaving).toBe(true);expect(store.getState().metadata).toBe(current);expect(store.getState().lastSavedAt).toBeNull();expect(api.getMindMap).toHaveBeenCalledTimes(2);
 });
 it('P2P a current save still commits clean state and metadata',async()=>{
  await store.getState().loadMindMap('current');store.setState({isDirty:true,_documentVersion:1});vi.mocked(api.updateMindMap).mockResolvedValue({...metadata('current'),title:'saved'});await expect(store.getState().save()).resolves.toBe(true);expect(store.getState().isDirty).toBe(false);expect(store.getState().metadata?.title).toBe('saved');
 });
});
