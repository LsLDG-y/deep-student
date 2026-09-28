import {cleanup,renderHook} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {useNavigationShortcuts} from '@/hooks/useNavigationShortcuts';
afterEach(cleanup);
function mount(){const back=vi.fn(),forward=vi.fn();renderHook(()=>useNavigationShortcuts({onBack:back,onForward:forward,canGoBack:true,canGoForward:true}));return {back,forward};}
const key=(extra:any={})=>new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true,cancelable:true,...extra});
describe('navigation input ownership',()=>{
 it('F2P nested editable descendants retain navigation input',()=>{
  const {back}=mount();const editor=document.createElement('div');editor.setAttribute('contenteditable','true');const child=document.createElement('span');editor.append(child);document.body.append(editor);child.dispatchEvent(key());expect(back).not.toHaveBeenCalled();editor.remove();
 });
 it('F2P composition, handled events and key repeats do not trigger navigation',()=>{
  const {back}=mount();for(const extra of [{isComposing:true},{keyCode:229},{repeat:true}])window.dispatchEvent(key(extra));const handled=key();handled.preventDefault();window.dispatchEvent(handled);expect(back).not.toHaveBeenCalled();
 });
 it('F2P multiple mounted hosts consume one physical event once',()=>{const a=mount(),b=mount();window.dispatchEvent(key());expect(a.back.mock.calls.length+b.back.mock.calls.length).toBe(1);window.dispatchEvent(new MouseEvent('mousedown',{button:4,cancelable:true}));expect(a.forward.mock.calls.length+b.forward.mock.calls.length).toBe(1);});
 it('P2P ordinary global back and forward remain available',()=>{const {back,forward}=mount();window.dispatchEvent(key());window.dispatchEvent(key({key:'ArrowRight'}));expect(back).toHaveBeenCalledOnce();expect(forward).toHaveBeenCalledOnce();});
});
