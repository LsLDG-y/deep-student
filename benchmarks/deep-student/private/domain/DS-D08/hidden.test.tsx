import {describe,expect,it} from 'vitest';
import {computeProposedContent,MAX_AI_EDIT_PROJECTED_OUTPUT_BYTES as LIMIT} from '@/features/notes/hooks/useAIEditState';
const replace=(text:string,search:string,value:string,isRegex=true)=>computeProposedContent({operation:'replace',search,replace:value,isRegex} as any,text);
describe('AI edit output budget',()=>{
 it('F2P regex amplification is rejected without returning an oversized candidate',()=>{
  const original='a '.repeat(20);const result=replace(original,'a','学'.repeat(Math.ceil(LIMIT/50)));
  expect(result.error).toBeTruthy();expect(result.content).toBe(original);
 });
 it('F2P untouched suffix and multibyte replacement count toward one output budget',()=>{
  const original='a'+'x'.repeat(LIMIT-2);const result=replace(original,'^a','汉字');expect(result.error).toBeTruthy();expect(result.content).toBe(original);
 });
 it('P2P valid regex, zero-width and literal substitutions retain semantics',()=>{
  expect(replace('a1 a2','a[0-9]','$1')).toMatchObject({content:'$1 $1',replaceCount:2});
  expect(replace('ab','(?=b)','!')).toMatchObject({content:'a!b',replaceCount:1});
  expect(replace('a.a','.', '-',false)).toMatchObject({content:'a-a',replaceCount:1});
  expect(replace('abc','([','x').error).toBeTruthy();
 });
});
