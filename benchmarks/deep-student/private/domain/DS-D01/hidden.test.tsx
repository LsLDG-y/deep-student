import { describe,it,expect } from 'vitest';
import { composeWindowedSave,expandMarkdownWindow } from '@/features/notes/markdownWindow';
describe('window preservation',()=>{
 it('F2P loading and saving retain blank lines at window boundaries',()=>{
  for(const text of ['alpha\n\nbeta','alpha\n\n\nbeta','first\r\n\r\nlast','first\n\n']) {
   const lines=text.split('\n'); const head=lines.slice(0,2).join('\n');
   expect(composeWindowedSave(head,text,2,true)).toBe(text);
   expect(expandMarkdownWindow(text,head,2,100).loadedMarkdown).toBe(text);
  }
 });
 it('F2P editing a loaded prefix does not eat the separator before the unloaded tail',()=>{
  expect(composeWindowedSave('edited\n','first\n\nlast',2,true)).toBe('edited\n\nlast');
 });
 it('P2P ordinary windows and fully loaded saves keep their existing semantics',()=>{
  expect(composeWindowedSave('edited','first\nlast',1,true)).toBe('edited\nlast');
  expect(composeWindowedSave('edited','first\nlast',2,false)).toBe('edited');
  expect(expandMarkdownWindow('a\nb','a',1,1).loadedMarkdown).toBe('a\nb');
 });
});
