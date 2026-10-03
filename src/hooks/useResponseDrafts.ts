import { useEffect, useReducer, useRef } from 'react';
import { createResponseDraftSession } from '@/lib/response-draft-client';
import type { ResponseDraftSession } from '@/lib/response-draft-session';
import type { ResponseEnvelope } from '@/lib/response-contract';
import type { ResponseQuestionView } from '@/lib/response-view';

/** One session per stable question, shared by all four inputs on both screens. */
export function useResponseDrafts(source:'exam'|'practice',parentId:string|undefined) {
  const sessions=useRef(new Map<string,ResponseDraftSession>());
  const errors=useRef(new Map<string,string>());
  const owner=useRef<string|null>(null);
  const cacheKeys=useRef(new WeakMap<ResponseDraftSession,string>());
  const mounted=useRef(true);
  const [,render]=useReducer(n=>n+1,0);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  const notify=()=>{if(mounted.current)render();};
  const cacheKey=(id:string)=>`response:v1:${source}:${parentId}:user:${owner.current}:${id}`;
  const remember=(id:string,session:ResponseDraftSession)=>{
    const key=cacheKeys.current.get(session);if(!key)return;
    try {
      if(session.status==='saved')sessionStorage.removeItem(key);
      else if(session.response)sessionStorage.setItem(key,JSON.stringify(session.recovery()));
    }catch{/* network status remains visible if browser storage is unavailable */}
  };
  const make=(id:string)=>{
    let session:ResponseDraftSession;
    session=createResponseDraftSession({source,parentId:parentId!,questionId:id},()=>{remember(id,session);notify();},owner.current??undefined);
    cacheKeys.current.set(session,cacheKey(id));
    return session;
  };
  const flush=async(id:string)=>{
    const session=sessions.current.get(id);if(!session)return;
    try {await session.flush();errors.current.delete(id);}
    catch(error){errors.current.set(id,(error as Error).message);throw error;}
    finally{remember(id,session);notify();}
  };
  return {
    initialise(questions:ResponseQuestionView[],userId:string,editable=true) {
      sessions.current.clear();errors.current.clear();owner.current=userId;
      for(const question of questions) {
        if(!question.response_definition)continue;
        // Read recovery before initialise acknowledges the server snapshot.
        let local:string|null=null;try{local=sessionStorage.getItem(cacheKey(question.id));}catch{/* optional */}
        const session=make(question.id);
        session.initialise({definition:question.response_definition,response:question.response_snapshot?.response??null,revision:question.response_snapshot?.revision??0});
        sessions.current.set(question.id,session);
        if(editable && !question.response_result && local) {
          try{session.restoreRecovery(JSON.parse(local));}catch{errors.current.set(question.id,'The local recovery copy could not be read. The saved answer is shown.');}
        }
      }
      notify();
    },
    get(id:string){return sessions.current.get(id);},
    error(id:string){return errors.current.get(id);},
    update(id:string,response:ResponseEnvelope) {
      const session=sessions.current.get(id);if(!session)throw new Error('The response is still loading.');
      session.update(response);errors.current.delete(id);
      // The queue coalesces typing while a request is in flight.
      void flush(id).catch(()=>{});
    },
    flush,
    async flushAll(){await Promise.all([...sessions.current.keys()].map(flush));},
    async useSaved(id:string) {
      // Explicit user choice: retain the local copy until loading succeeds.
      const next=make(id);const local=sessions.current.get(id)?.recovery();
      try{await next.load();sessions.current.set(id,next);errors.current.delete(id);notify();}
      catch(error){if(local)try{sessionStorage.setItem(cacheKey(id),JSON.stringify(local));}catch{}throw error;}
    },
  };
}
