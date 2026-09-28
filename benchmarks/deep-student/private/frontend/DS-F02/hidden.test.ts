import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { createChatStore } from '@/features/chat/core/store/createChatStore';
import { cancelPdfProcessing } from '@/api/vfsPdfProcessingApi';
vi.mock('@/api/vfsPdfProcessingApi',async original=>({...await original<any>(),cancelPdfProcessing:vi.fn(async()=>undefined)}));
const revoke=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('URL',class extends URL{static revokeObjectURL=revoke;});});
afterEach(()=>vi.unstubAllGlobals());
function attachment(id:string){return {id,name:'shared.pdf',type:'document',mimeType:'application/pdf',size:1,status:'processing',sourceId:'file_shared',resourceId:'res_shared',previewUrl:'blob:shared'} as any;}
describe('last owner releases attachment resources',()=>{
 it('F2P keeps another attachment and a foreign session processing owner usable',()=>{
  const store=createChatStore('same');const removeContextRef=vi.fn();store.setState({attachments:[attachment('a'),attachment('b')],removeContextRef});
  store.getState().removeAttachment('a');expect(store.getState().attachments.map(a=>a.id)).toEqual(['b']);expect(cancelPdfProcessing).not.toHaveBeenCalled();expect(removeContextRef).not.toHaveBeenCalled();expect(revoke).not.toHaveBeenCalled();
  const foreign=createChatStore('foreign',()=>true);foreign.setState({attachments:[attachment('c')]});foreign.getState().removeAttachment('c');expect(cancelPdfProcessing).not.toHaveBeenCalled();
 });
 it('P2P releases the last unshared owner',()=>{
  const store=createChatStore('single');const removeContextRef=vi.fn();store.setState({attachments:[attachment('only')],removeContextRef});store.getState().removeAttachment('only');expect(cancelPdfProcessing).toHaveBeenCalledWith('file_shared');expect(removeContextRef).toHaveBeenCalledWith('res_shared');expect(revoke).toHaveBeenCalledWith('blob:shared');
 });
});
