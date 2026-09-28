import { describe,it,expect } from 'vitest';
import { findActiveArtifactSkill,validateIntentAgainstSkeleton } from '@/features/chat/skills/artifactSkeleton';
const artifact={intentSkeleton:{blocks:[{type:'markdown'}]},layoutLock:true};const skills:any={active:{id:'active',artifact},dormant:{id:'dormant',artifact}};
describe('artifact template activation scope',()=>{
 it('F2P ignores a referenced template absent from this session activation',()=>{expect(findActiveArtifactSkill(['active'],id=>skills[id],'dormant')).toBeNull();expect(findActiveArtifactSkill([],id=>skills[id],'dormant')).toBeNull();});
 it('P2P resolves active explicit and unique templates and still validates their layout',()=>{const active=findActiveArtifactSkill(['active'],id=>skills[id],'active');expect(active?.skillId).toBe('active');expect(findActiveArtifactSkill(['active'],id=>skills[id])?.skillId).toBe('active');expect(validateIntentAgainstSkeleton({blocks:[{type:'markdown',props:{content:'ok'}}]} as any,artifact).valid).toBe(true);expect(validateIntentAgainstSkeleton({blocks:[]} as any,artifact).valid).toBe(false);});
});
