import { describe,it,expect } from 'vitest';
import { getEffectiveReadyModes,getMissingInjectModesForAttachment } from '@/features/chat/components/input-bar/injectModeUtils';
const image=(status:string, readyModes:string[]=[])=>({id:'photo',name:'scan.png',mimeType:'image/png',type:'image',size:40,status,injectModes:{image:['image']},processingStatus:{status:'processing',readyModes}} as any);
describe('image readiness contract',()=>{
 it('F2P accepts uploaded pixels while optional analysis is pending',()=>{
  for(const status of ['processing','ready']) { const a=image(status); expect(getEffectiveReadyModes(a,'image')).toEqual(expect.arrayContaining(['image'])); expect(getMissingInjectModesForAttachment(a)).toEqual([]); }
 });
 it('P2P retains reported OCR and does not invent PDF pixels',()=>{
  expect(getEffectiveReadyModes(image('processing',['ocr']),'image')).toContain('ocr');
  expect(getEffectiveReadyModes({...image('ready'),name:'paper.pdf',mimeType:'application/pdf'} as any,'pdf')).toBeUndefined();
 });
});
