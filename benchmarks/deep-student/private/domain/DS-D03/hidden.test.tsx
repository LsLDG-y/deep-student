import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke}));
vi.mock('@/components/UnifiedNotification',()=>({showGlobalNotification:vi.fn()}));
vi.mock('@/debug-panel/plugins/CrepeImageUploadDebugPlugin',()=>({emitImageUploadDebug:vi.fn()}));
import {createImageUploader,createImageBlockConfig} from '@/components/crepe/features/imageUpload';
beforeEach(()=>{invoke.mockReset();(window as any).__TAURI_INTERNALS__={};});
afterEach(()=>{delete (window as any).__TAURI_INTERNALS__;});
describe('persistent note images',()=>{
 it('F2P upload and later rendering share portable asset references',async()=>{
  invoke.mockResolvedValueOnce({absolute_path:String.raw`C:\notes_assets\_global\n\图.png`,relative_path:String.raw`notes_assets\_global\n\图.png`});
  const value=await createImageUploader('n')(new File(['png'],'图.png',{type:'image/png'}));
  expect(value).toBe('notes_assets/_global/n/图.png');
  invoke.mockResolvedValueOnce('data:image/png;base64,aW1hZ2U=');
  const resolved=await createImageBlockConfig('n').proxyDomURL?.(String.raw`notes_assets\_global\n\图.png`);
  expect(resolved).toBe('data:image/png;base64,aW1hZ2U=');
  expect(invoke).toHaveBeenLastCalledWith('get_image_as_base64',{relativePath:'notes_assets/_global/n/图.png'});
 });
 it('P2P URLs and already portable paths retain their normal behavior',async()=>{
  const config=createImageBlockConfig('n');
  expect(await config.proxyDomURL?.('https://example.com/image.png')).toBe('https://example.com/image.png');
  invoke.mockResolvedValue('data:image/png;base64,ok');
  expect(await config.proxyDomURL?.('notes_assets/n/image.png')).toBe('data:image/png;base64,ok');
 });
});
