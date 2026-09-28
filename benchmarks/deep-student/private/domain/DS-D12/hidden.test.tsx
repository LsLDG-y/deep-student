import {beforeEach,describe,expect,it,vi} from 'vitest';
const {get,getContent,update,search,backlinks}=vi.hoisted(()=>({get:vi.fn(),getContent:vi.fn(),update:vi.fn(),search:vi.fn(),backlinks:vi.fn()}));
vi.mock('@/dstu',()=>({dstu:{get,getContent,update,search}}));
vi.mock('@/features/workbench/apps/notes/backlinksBackend',()=>({fetchBacklinksFromBackend:backlinks}));
vi.mock('@/features/workbench/apps/content/contentDirtyRegistry',()=>({isContentDirty:()=>false}));
import {syncWikiLinksAfterNoteRename,RENAME_SYNC_SOURCE_LIMIT as LIMIT} from '@/features/workbench/apps/notes/wikilinkRenameSync';
const req={noteId:'target',oldTitle:'Before',newTitle:'After',knownNotes:[{id:'target',title:'Before'}]};
beforeEach(()=>{vi.clearAllMocks();search.mockResolvedValue({ok:true,value:[]});get.mockImplementation(async(path:string)=>({ok:true,value:{id:path.slice(1),path,type:'note',updatedAt:42}}));getContent.mockResolvedValue({ok:true,value:'see [[Before#section|alias]]'});update.mockResolvedValue({ok:true});});
describe('bounded rename completion',()=>{
 it('F2P sources beyond the scan budget are reported as unprocessed rather than full success',async()=>{backlinks.mockResolvedValue(Array.from({length:LIMIT+3},(_,i)=>({sourceId:'source-'+i})));const result=await syncWikiLinksAfterNoteRename(req);expect(result.truncated).toBe(true);expect(result.updatedSources).toBe(LIMIT);expect(update).toHaveBeenCalledTimes(LIMIT);});
 it('P2P a complete small scan rewrites links with fresh concurrency baselines',async()=>{backlinks.mockResolvedValue([{sourceId:'source'}]);const result=await syncWikiLinksAfterNoteRename(req);expect(result).toMatchObject({truncated:false,updatedSources:1,rewrittenLinks:1,scanFailed:false});expect(update).toHaveBeenCalledWith('/source','see [[After#section|alias]]','note',{expectedUpdatedAtMs:42});});
 it('P2P total discovery failure is still visible and performs no writes',async()=>{backlinks.mockRejectedValue(Error('offline'));search.mockResolvedValue({ok:false,error:Error('offline')});expect(await syncWikiLinksAfterNoteRename(req)).toMatchObject({scanFailed:true,updatedSources:0});expect(update).not.toHaveBeenCalled();});
});
