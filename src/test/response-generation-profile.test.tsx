import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext,toStoredGenerationContext} from '@/lib/profile-context';
import {resolveProfileContext as serverResolve,toStoredGenerationContext as serverSnapshot,establishGenerationContext} from '../../supabase/functions/_shared/profile-context';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level2'}})}));
vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const blueprint={courseSelection:{courseId:'aqa_gcse_biology',paperId:'paper_1'},paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1',mode:'short_practice',contractVersion:1}};
const profile:any={id:'profile',user_id:'owner',subject_name:'Biology',profile_name:'Paper 1',topics:['Cell biology','Organisation','Infection and response','Bioenergetics'],question_count:8,educational_tier:'level2',assessment_tier:'higher',exam_board:'AQA',paper_blueprint:blueprint};
function editor(initial:any=profile){const save=vi.fn();render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology" subjectColor="#3388cc" examBoard="AQA" availableTopics={[]} initialData={initial} onSave={save}/>);return save;}
it('is off on existing profiles, saves explicit opt-in and reloads without changing the plan',()=>{
 const save=editor();const toggle=screen.getByRole('checkbox',{name:/Interactive answer formats/});expect(toggle).not.toBeChecked();fireEvent.click(toggle);fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
 const next=save.mock.calls[0][5].paperBlueprint;expect(next.paperContract).toEqual(blueprint.paperContract);expect(next.responseFormats).toBe('interactive_v1');
 cleanup();editor({...profile,paper_blueprint:next});expect(screen.getByRole('checkbox',{name:/Interactive answer formats/})).toBeChecked();
});
it('drops the opt-in in Custom mode instead of enabling an unsupported pipeline',()=>{
 const save=editor({...profile,paper_blueprint:{...blueprint,responseFormats:'interactive_v1'}});fireEvent.click(screen.getByRole('button',{name:/^Custom/}));expect(screen.queryByRole('checkbox',{name:/Interactive answer formats/})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(save.mock.calls[0][5].paperBlueprint).not.toHaveProperty('responseFormats');
});
it('server re-reads the owned profile; snapshots freeze the policy across profile edits',async()=>{
 const enabled={...profile,paper_blueprint:{...blueprint,responseFormats:'interactive_v1'}};let reads=0;const client={from(){reads++;const q:any={};for(const name of ['select','eq','maybeSingle'])q[name]=()=>q;q.then=(resolve:any)=>Promise.resolve({data:enabled,error:null}).then(resolve);return q;}};
 const resolved=await serverResolve(client,{userId:'owner',subjectName:'Biology',profileId:'profile'}),saved=serverSnapshot(resolved);expect(saved.response_formats).toBe('interactive_v1');
 const row={profile_id:'profile',generation_context:saved};enabled.paper_blueprint.responseFormats=undefined as any;expect(await establishGenerationContext(client,'set','owner',row)).toEqual(saved);expect(reads).toBe(1);
 const browser=toStoredGenerationContext(resolveProfileContext({subjectName:'Biology',profile:{...profile,paper_blueprint:{...blueprint,responseFormats:'interactive_v1'}}}));expect(browser.response_formats).toBe('interactive_v1');expect(browser.resolved_by).not.toBe('server');
});
