import React from 'react';
import {render} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {AnkiTemplateCardFace} from '@/components/anki/AnkiTemplateCardFace';
const card:any={id:'card',front:'',back:'',text:'',tags:[],images:[],extra_fields:{}};
const template:any={id:'tpl',name:'Template',description:'',version:'1',preview_front:'',preview_back:'',note_type:'Cloze',fields:['Text'],generation_prompt:'',front_template:'<div>{{Text}}</div>',back_template:'<div>{{Text}}</div>',css_style:'.card {color: red}',field_extraction_rules:{},created_at:'',updated_at:'',is_active:true,is_built_in:false};
const frameDoc=(container:HTMLElement)=>new DOMParser().parseFromString(container.querySelector('iframe')?.getAttribute('srcdoc')??'','text/html');

describe('imported cloze fallback',()=>{
 it('F2P absent templates still hide only the imported card ordinal on the front',()=>{
  const c={...card,text:'{{c1::Alpha}} and {{c2::Beta::hint}}',extra_fields:{AnkiCardOrd:'1'}};const view=render(<AnkiTemplateCardFace card={c} side="front"/>);let doc=frameDoc(view.container);expect(view.container.querySelector('iframe')).not.toBeNull();expect(doc.body.textContent).toContain('Alpha');expect(doc.body.textContent).not.toContain('Beta');expect(doc.body.textContent).toContain('hint');view.rerender(<AnkiTemplateCardFace card={c} side="back"/>);expect(frameDoc(view.container).body.textContent).toContain('Beta');
 });
 it('P2P ordinary missing-template cards retain controlled plain front and back',()=>{const c={...card,front:'Question',back:'Answer'};const view=render(<AnkiTemplateCardFace card={c} side="front"/>);expect(view.getByText('Question')).toBeInTheDocument();expect(view.container.querySelector('iframe')).toBeNull();view.rerender(<AnkiTemplateCardFace card={c} side="back"/>);expect(view.getByText('Answer')).toBeInTheDocument();});
 it('P2P available cloze templates continue to conceal answers',()=>{const t={...template,front_template:'{{cloze:Text}}'};const view=render(<AnkiTemplateCardFace card={{...card,extra_fields:{Text:'{{c1::secret}}'}}} template={t} side="front"/>);expect(frameDoc(view.container).body.textContent).not.toContain('secret');});
});
