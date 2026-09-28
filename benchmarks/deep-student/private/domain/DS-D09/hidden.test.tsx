import React from 'react';
import {render} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {AnkiTemplateCardFace} from '@/components/anki/AnkiTemplateCardFace';
const card:any={id:'card',front:'',back:'',text:'',tags:[],images:[],extra_fields:{}};
const template:any={id:'tpl',name:'Template',description:'',version:'1',preview_front:'',preview_back:'',note_type:'Cloze',fields:['Text'],generation_prompt:'',front_template:'<div>{{Text}}</div>',back_template:'<div>{{Text}}</div>',css_style:'.card {color: red}',field_extraction_rules:{},created_at:'',updated_at:'',is_active:true,is_built_in:false};
const frameDoc=(container:HTMLElement)=>new DOMParser().parseFromString(container.querySelector('iframe')?.getAttribute('srcdoc')??'','text/html');

describe('template math rendering',()=>{
 it('F2P math text renders inside the actual isolated card preview',()=>{
  const view=render(<AnkiTemplateCardFace card={{...card,extra_fields:{Text:'Energy \\(E=mc^2\\)'}}} template={template} side="front"/>);
  const doc=frameDoc(view.container);expect(doc.querySelector('math')).not.toBeNull();expect(doc.querySelector('msup')).not.toBeNull();expect(doc.body.classList.contains('card')).toBe(true);
 });
 it('P2P code examples, attributes, plain content and HTML sanitization retain behavior',()=>{
  const t={...template,front_template:'<div title="\\(literal\\)">{{Text}}</div><code>\\(raw\\)</code>'};
  const view=render(<AnkiTemplateCardFace card={{...card,extra_fields:{Text:'plain <img src="bad" onerror="alert(1)">'}}} template={t} side="front"/>);const doc=frameDoc(view.container);expect(doc.querySelector('code')?.textContent).toBe('\\(raw\\)');expect(doc.querySelector('div[title]')?.getAttribute('title')).toBe('\\(literal\\)');expect(doc.querySelector('img')?.hasAttribute('onerror')).toBe(false);expect(doc.body.textContent).toContain('plain');
 });
});
