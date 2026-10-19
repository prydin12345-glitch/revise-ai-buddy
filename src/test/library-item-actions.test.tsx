import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { WorkspaceContext, WorkspaceStore } from '@/hooks/use-workspace-session';
import { useLibraryItemActions } from '@/hooks/use-library-item-actions';
import { LibraryDeleteDialog } from '@/components/shared/LibraryDeleteDialog';
import { LIBRARY_REVISION, refreshLibraryItemCaches, sumLibraryMarks } from '@/lib/library-item-cache';
import { loadLibraryQuestionMetadata } from '@/lib/library-question-metadata';

const fake = vi.hoisted(() => ({ owner: 'alice', writes: [] as Array<{ table: string; action: string; filters: Record<string, unknown>; payload?: unknown }>, fail: false, noRow: false, release: null as null | (() => void), delay: false, metadata: [] as Array<{id:string;exam_id?:string;set_id?:string;marks:number|null}>, selections: [] as string[], offsets: [] as number[], repeatPage: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({data:{user:{id:fake.owner}},error:null}) },
  from: (table: string) => {
    const call = {table,action:'read',filters:{} as Record<string,unknown>,payload:undefined as unknown};let start=0,end=499;
    const chain = {delete(){call.action='delete';return chain;},update(payload:unknown){call.action='update';call.payload=payload;return chain;},eq(key:string,value:unknown){call.filters[key]=value;return chain;},in(key:string,value:unknown){call.filters[key]=value;return chain;},select(fields:string){fake.selections.push(fields);return chain;},order(){return chain;},range(from:number,to:number){start=from;end=to;fake.offsets.push(from);return chain;},single(){return chain;},then(resolve:(value:unknown)=>void,reject:(error:unknown)=>void){
      const execute=()=>{
        if(call.action==='read'){const rows=fake.metadata.filter(row=>!Object.entries(call.filters).some(([key,ids])=>Array.isArray(ids)&&!ids.includes((row as unknown as Record<string,unknown>)[key])));return {data:fake.repeatPage?rows.slice(0,500):rows.slice(start,end+1),error:null};}
        fake.writes.push(call);return fake.fail?{data:null,error:{message:'Permission denied'}}:{data:fake.noRow?null:{id:call.filters.id},error:null};
      };
      return (fake.delay?new Promise(r=>{fake.release=()=>r(execute());}):Promise.resolve(execute())).then(resolve,reject);
    }};return chain;
  },
} }));
vi.mock('@/hooks/use-toast', () => ({toast:vi.fn()}));

let store: WorkspaceStore, client: QueryClient;
const item={id:'paper',title:'Cell biology',status:'published',user_id:'alice'};
function Wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={client}><WorkspaceContext.Provider value={{ownerId:store.ownerId,ready:true,store}}>{children}</WorkspaceContext.Provider></QueryClientProvider>;}
beforeEach(()=>{store=new WorkspaceStore('alice');client=new QueryClient({defaultOptions:{queries:{retry:false}}});fake.owner='alice';fake.writes=[];fake.fail=false;fake.noRow=false;fake.delay=false;fake.release=null;fake.metadata=[];fake.selections=[];fake.offsets=[];fake.repeatPage=false;});
afterEach(()=>{cleanup();client.clear();});

describe('confirmed owner-scoped library actions',()=>{
  it.each(['exam','quiz'] as const)('does not delete %s until confirmed and locks repeated confirmation',async kind=>{
    store.set(kind==='exam'?'exams:exams':'quizzes:practiceSets',[item,{...item,id:'keep'}],[]);
    const {result}=renderHook(()=>useLibraryItemActions(kind),{wrapper:Wrapper});
    act(()=>result.current.requestDelete(item));expect(fake.writes).toEqual([]);
    act(()=>result.current.closeDelete());expect(fake.writes).toEqual([]);
    fake.delay=true;act(()=>result.current.requestDelete(item));
    let finished:Promise<boolean>;act(()=>{finished=result.current.confirmDelete();});await waitFor(()=>expect(fake.release).not.toBeNull());
    await act(async()=>{await result.current.confirmDelete();});expect(result.current.pending.has(item.id)).toBe(true);
    await act(async()=>{fake.release!();await finished!;});
    expect(fake.writes).toHaveLength(1);expect(fake.writes[0]).toMatchObject({table:kind==='exam'?'exams':'practice_question_sets',action:'delete',filters:{id:'paper',user_id:'alice'}});
    expect(store.get<Array<{id:string}>>(kind==='exam'?'exams:exams':'quizzes:practiceSets',[]).map(row=>row.id)).toEqual(['keep']);expect(result.current.deleteItem).toBeNull();
  });
  it.each(['exam','quiz'] as const)('retains %s on failure, keeps its dialog open and allows retry',async kind=>{
    const key=kind==='exam'?'exams:exams':'quizzes:practiceSets';store.set(key,[item],[]);fake.fail=true;
    const {result}=renderHook(()=>useLibraryItemActions(kind),{wrapper:Wrapper});act(()=>result.current.requestDelete(item));
    await act(async()=>{await result.current.confirmDelete();});expect(store.get(key,[])).toEqual([item]);expect(result.current.deleteError).toBe('Permission denied');expect(result.current.deleteItem?.id).toBe('paper');expect(store.get(LIBRARY_REVISION,0)).toBe(0);
    fake.fail=false;await act(async()=>{await result.current.confirmDelete();});expect(store.get(key,[])).toEqual([]);
  });
  it('does not claim success when RLS returns no owned row',async()=>{
    fake.noRow=true;const {result}=renderHook(()=>useLibraryItemActions('exam'),{wrapper:Wrapper});act(()=>result.current.requestDelete(item));await act(async()=>{await result.current.confirmDelete();});expect(result.current.deleteError).toMatch(/not changed/);expect(store.get(LIBRARY_REVISION,0)).toBe(0);
  });
  it.each(['exam','quiz'] as const)('archives and restores %s through its existing status field',async kind=>{
    const key=kind==='exam'?'exams:exams':'quizzes:practiceSets';store.set(key,[item],[]);const {result}=renderHook(()=>useLibraryItemActions(kind),{wrapper:Wrapper});
    await act(async()=>{await result.current.archive(item);});expect(fake.writes[0]).toMatchObject({action:'update',payload:{status:'archived'},filters:{user_id:'alice'}});expect(store.get(key,[])).toEqual([{...item,status:'archived'}]);
    await act(async()=>{await result.current.archive({...item,status:'archived'});});expect(fake.writes[1].payload).toEqual({status:'published'});
  });
  it('rejects foreign/ambiguous ownership before writing',async()=>{
    const {result}=renderHook(()=>useLibraryItemActions('exam'),{wrapper:Wrapper});await act(async()=>{await result.current.archive({...item,user_id:'bob'});});fake.owner='bob';await act(async()=>{await result.current.archive(item);});expect(fake.writes).toEqual([]);
  });
  it.each(['exam','quiz'] as const)('cannot turn an unfinished %s into a published item through archive/restore',async kind=>{
    const {result}=renderHook(()=>useLibraryItemActions(kind),{wrapper:Wrapper});
    for(const status of ['draft','analyzing','ready'])await act(async()=>{await result.current.archive({...item,status});});
    expect(fake.writes).toEqual([]);
  });
  it('cannot place an old account’s late mutation in the next account’s cache or dialog',async()=>{
    fake.delay=true;const {result,rerender}=renderHook(()=>useLibraryItemActions('exam'),{wrapper:Wrapper});act(()=>result.current.requestDelete(item));let finished:Promise<boolean>;act(()=>{finished=result.current.confirmDelete();});await waitFor(()=>expect(fake.release).not.toBeNull());
    store=new WorkspaceStore('bob');fake.owner='bob';store.set('exams:exams',[{...item,user_id:'bob'}],[]);rerender();await act(async()=>{fake.release!();await finished!;});expect(store.get('exams:exams',[])).toHaveLength(1);expect(result.current.deleteItem).toBeNull();expect(store.get(LIBRARY_REVISION,0)).toBe(0);
  });
  it('removes retained list/progress/favourite copies and Home snapshots without clearing filters or another owner’s cache',async()=>{
    store.set('exams:exams',[item],[]);store.set('tutor-exams:exams',[item],[]);store.set('exams:favouriteExamIds',['paper'],[]);store.set('exams:examProgress',new Map([['paper',{}]]),new Map());store.set('exams:searchQuery','biology','');
    client.setQueryData(['student-dashboard','alice'],{allExams:[item]});client.setQueryData(['student-dashboard','bob'],{allExams:[item]});
    await refreshLibraryItemCaches(store,client,'exam','paper');expect(store.get('exams:exams',[])).toEqual([]);expect(store.get('tutor-exams:exams',[])).toEqual([]);expect(store.get('exams:favouriteExamIds',[])).toEqual([]);expect(store.get('exams:examProgress',new Map()).size).toBe(0);expect(store.get('exams:searchQuery','')).toBe('biology');expect(client.getQueryData(['student-dashboard','alice'])).toBeUndefined();expect(client.getQueryData(['student-dashboard','bob'])).toBeDefined();
  });
  it('cancels an old Home read so its late result cannot restore a deleted item',async()=>{
    let complete!: (value:unknown)=>void;
    const read=client.fetchQuery({queryKey:['student-dashboard','alice'],queryFn:()=>new Promise(resolve=>{complete=resolve;})}).catch(()=>undefined);
    await refreshLibraryItemCaches(store,client,'exam','paper');complete({allExams:[item]});await read;
    expect(client.getQueryData(['student-dashboard','alice'])).toBeUndefined();
  });
  it('clears quiz copies without touching exam data or another library’s filters',async()=>{
    store.set('exams:exams',[item],[]);store.set('quizzes:practiceSets',[item],[]);store.set('quizzes:favourites',new Set(['paper']),new Set());store.set('quizzes:progressMap',{paper:{questions_attempted:2}},{});store.set('quizzes:totalMarks',{paper:70},{});store.set('quizzes:searchQuery','genetics','');
    await refreshLibraryItemCaches(store,client,'quiz','paper');
    expect(store.get('exams:exams',[])).toEqual([item]);expect(store.get('quizzes:practiceSets',[])).toEqual([]);expect(store.get('quizzes:favourites',new Set()).size).toBe(0);expect(store.get('quizzes:progressMap',{})).toEqual({});expect(store.get('quizzes:totalMarks',{})).toEqual({});expect(store.get('quizzes:searchQuery','')).toBe('genetics');
  });
  it('keeps confirmation visible while deleting or retrying; cancellation performs no mutation',()=>{
    const cancel=vi.fn(),confirm=vi.fn();const view=render(<LibraryDeleteDialog title="Biology" pending={false} error={null} onCancel={cancel} onConfirm={confirm}/>);fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(cancel).toHaveBeenCalled();expect(confirm).not.toHaveBeenCalled();
    view.rerender(<LibraryDeleteDialog title="Biology" pending error={null} onCancel={cancel} onConfirm={confirm}/>);expect(screen.getByRole('button',{name:'Deleting…'})).toBeDisabled();expect(screen.getByRole('button',{name:'Cancel'})).toBeDisabled();
    view.rerender(<LibraryDeleteDialog title="Biology" pending={false} error="Try again" onCancel={cancel} onConfirm={confirm}/>);expect(screen.getByRole('alert')).toHaveTextContent('Try again');fireEvent.click(screen.getByRole('button',{name:'Try deleting again'}));expect(confirm).toHaveBeenCalledOnce();
  });
});

describe('saved mark metadata',()=>{
  it('sums saved marks and treats absent, incomplete or invalid data as unknown',()=>{expect(sumLibraryMarks([{marks:2},{marks:4}])).toBe(6);for(const rows of [[],[{marks:null}],[{marks:NaN}],[{marks:-1}],[{marks:0}]])expect(sumLibraryMarks(rows)).toBeNull();});
  it.each(['exam','quiz'] as const)('pages %s mark metadata past the default row cap without selecting private answers',async kind=>{
    fake.metadata=Array.from({length:1001},(_,i)=>({id:String(i),...(kind==='exam'?{exam_id:'paper'}:{set_id:'paper'}),marks:2}));const rows=await loadLibraryQuestionMetadata(kind,['paper']);expect(rows).toHaveLength(1001);expect(sumLibraryMarks(rows)).toBe(2002);expect(fake.offsets).toEqual([0,500,1000]);expect(fake.selections.every(fields=>fields===`id, ${kind==='exam'?'exam_id':'set_id'}, marks`)).toBe(true);
  });
  it('rejects repeated pages instead of inflating marks or looping forever',async()=>{fake.metadata=Array.from({length:500},(_,i)=>({id:String(i),exam_id:'paper',marks:2}));fake.repeatPage=true;await expect(loadLibraryQuestionMetadata('exam',['paper'])).rejects.toThrow(/repeated/);});
});
