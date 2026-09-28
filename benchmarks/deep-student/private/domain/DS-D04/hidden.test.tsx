import {describe,it,expect} from 'vitest';
import {Schema} from '@milkdown/prose/model';
import {EditorState} from '@milkdown/prose/state';
import {collectSearchMatches,replaceAllSearchMatches} from '@/components/crepe/plugins/searchHighlight';
const schema=new Schema({nodes:{doc:{content:'block+'},paragraph:{content:'inline*',group:'block'},text:{group:'inline'},hard_break:{inline:true,group:'inline'}},marks:{strong:{},em:{}}});
const doc=(children:any[])=>schema.node('doc',null,[schema.node('paragraph',null,children)]);
describe('visible text search',()=>{
 it('F2P finds a phrase split across formatting and replaces the real document range',()=>{
  const state=EditorState.create({schema,doc:doc([schema.text('re'),schema.text('fact',[schema.marks.strong.create()]),schema.text('or',[schema.marks.em.create()])])});
  const ranges=collectSearchMatches(state.doc,'refactor');expect(ranges).toEqual([{from:1,to:9}]);
  expect(state.apply(replaceAllSearchMatches(state.tr,ranges,'change')).doc.textContent).toBe('change');
 });
 it('F2P case folding maps expanding Unicode characters back to document positions',()=>{
  const state=EditorState.create({schema,doc:doc([schema.text('İİ')])});
  const ranges=collectSearchMatches(state.doc,'i');expect(ranges).toEqual([{from:1,to:2},{from:2,to:3}]);
  expect(state.apply(replaceAllSearchMatches(state.tr,ranges,'x')).doc.textContent).toBe('xx');
 });
 it('F2P repetitive text produces disjoint replacement ranges',()=>{
  expect(collectSearchMatches(doc([schema.text('aaaaaa')]),'aa')).toEqual([{from:1,to:3},{from:3,to:5},{from:5,to:7}]);
 });
 it('P2P hard breaks remain barriers while plain search options work',()=>{
  expect(collectSearchMatches(doc([schema.text('hello'),schema.node('hard_break'),schema.text('world')]),'helloworld')).toEqual([]);
  expect(collectSearchMatches(doc([schema.text('Cat cat catalog')]),'cat',{wholeWord:true})).toHaveLength(2);
  expect(collectSearchMatches(doc([schema.text('Cat cat')]),'cat',{caseSensitive:true})).toHaveLength(1);
 });
});
