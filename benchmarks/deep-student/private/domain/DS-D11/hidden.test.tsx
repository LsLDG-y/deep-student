import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));vi.mock('@tauri-apps/api/core',()=>({invoke}));vi.mock('@/features/flashcards/events',()=>({requestFlashcardsDueRefresh:vi.fn()}));
import {useFsrsReviewStore,MAX_ANSWER_DURATION_MS} from '@/features/flashcards/store/fsrsReviewStore';
const now=1800000000000;
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(now);invoke.mockReset();invoke.mockImplementation(async(cmd:string)=>{if(cmd==='fsrs_preview_intervals')return {};if(cmd==='fsrs_rate')return {logId:'log',dueMs:now+259200000,scheduledDays:3,cardState:{state:2,lastReviewMs:now}};if(cmd==='fsrs_get_stats')return {due:0};return null;});useFsrsReviewStore.setState({screen:'session',sessionMode:'due',queue:[{id:'s',ankiCardId:'a',front:'Q',back:'A'}],queueIndex:0,flipped:true,flippedAtMs:now-2000,ratingBusy:false,pendingRateOp:null,error:null,reviewHistory:[],sessionRatedCount:0,sessionAgainCount:0,sessionRatingCounts:{1:0,2:0,3:0,4:0},sessionStreak:0,sessionBestStreak:0,recentLocalLogIds:[],pendingExternalRateIds:[]} as any);});
afterEach(()=>vi.restoreAllMocks());
const sent=()=>invoke.mock.calls.find(([cmd])=>cmd==='fsrs_rate')?.[1];
describe('review duration contract',()=>{
 it('F2P a valid presentation measurement includes thinking before answer reveal',async()=>{await useFsrsReviewStore.getState().rate(3,42000);expect(sent()).toMatchObject({cardStateId:'s',durationMs:42000});});
 it('F2P absent or nonfinite measurements must not invent an answer duration',async()=>{await useFsrsReviewStore.getState().rate(3,Number.NaN);expect(sent()).toMatchObject({durationMs:null});});
 it('F2P supplied measured time is capped and rounded at persistence',async()=>{await useFsrsReviewStore.getState().rate(3,MAX_ANSWER_DURATION_MS+100);expect(sent()).toMatchObject({durationMs:MAX_ANSWER_DURATION_MS});});
 it('P2P a valid rating still advances the queue and clears the flip state',async()=>{await useFsrsReviewStore.getState().rate(3,2000);expect(sent()).toMatchObject({durationMs:2000});expect(useFsrsReviewStore.getState().queueIndex).toBe(1);expect(useFsrsReviewStore.getState().flippedAtMs).toBeNull();});
});
