import { describe,it,expect } from 'vitest';
import { extractAnkiUpdateArgs,computeAnkiFieldDiffs } from '@/features/chat/components/input-bar/AnkiCardUpdateDiff';
const args={cardId:'card_42',patch:{front:'new',tags:['retained','added']}};
describe('card approval protocol identity',()=>{
 it('F2P exposes the same field diff for supported MCP names',()=>{for(const name of ['mcp_chatanki_update_library_card','mcp.tools.chatanki_update_library_card']){const parsed=extractAnkiUpdateArgs(name,args);expect(parsed).not.toBeNull();expect(computeAnkiFieldDiffs({front:'old',tags:['retained']},parsed!.patch)).toEqual([{field:'front',before:'old',after:'new'},{field:'tags',before:'retained',after:'retained, added'}]);}});
 it('P2P keeps builtin approvals and ignores unrelated or incomplete payloads',()=>{expect(extractAnkiUpdateArgs('builtin-chatanki_update_library_card',args)).toEqual(args);expect(extractAnkiUpdateArgs('builtin-chatanki_get_library_card',args)).toBeNull();expect(extractAnkiUpdateArgs('builtin-chatanki_update_library_card',{patch:{}})).toBeNull();});
});
