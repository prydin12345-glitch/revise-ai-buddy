import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Clock3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

const labels={weak:"Needs attention",developing:"Developing",strong:"Strong",all:"All topics"};
type Filter=keyof typeof labels;
const attempts=(t:UnifiedTopicScore)=>t.examQuestionCount+t.practiceQuestionCount;
const pct=(v:number)=>`${Math.round(v)}%`;
export function ScopedWeakTopics({topics,subject,profileId,initialFilter="weak",onFilterChange,pendingCount=0}:{topics:UnifiedTopicScore[];subject:string;profileId:string;initialFilter?:Filter;onFilterChange?:(filter:Filter)=>void;pendingCount?:number}) {
  const navigate=useNavigate();
  const [filter,setFilter]=useState<Filter>(initialFilter),[search,setSearch]=useState(""),[detail,setDetail]=useState<UnifiedTopicScore|null>(null);
  const marked=useMemo(()=>topics.filter(t=>attempts(t)>0&&(t.examScore!==null||t.practiceScore!==null)),[topics]);
  const counts={weak:marked.filter(t=>t.mastery==="weak").length,developing:marked.filter(t=>t.mastery==="developing").length,strong:marked.filter(t=>t.mastery==="strong").length,all:marked.length};
  const visible=marked.filter(t=>(filter==="all"||t.mastery===filter)&&t.topic.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a,b)=>a.unifiedScore-b.unifiedScore||a.topic.localeCompare(b.topic));
  function practice(topic:string){const p=new URLSearchParams({subject,subtopic:topic,source:"weak_topics"});if(profileId!=="all"&&profileId!=="unprofiled")p.set("profileId",profileId);navigate(`/create-practice-questions?${p}`);}
  function selectFilter(next:Filter){setFilter(next);onFilterChange?.(next);}
  if(marked.length===0)return <section className="subject-stats-panel subject-stats-topics-empty"><div className="subject-stats-empty-divider"><span/>{pendingCount?<Clock3 aria-hidden="true"/>:<BookOpen aria-hidden="true"/>}<span/></div><h2>{pendingCount?"Waiting for marked answers":"We need some marked answers first"}</h2><p>{pendingCount?"Your latest work is awaiting marking or release. It won’t be counted as a low score.":"Complete an exam or practice quiz to discover which topics could use another look."}</p><Button onClick={()=>practice("")}>Create a quiz</Button></section>;
  return <div className="subject-stats-weak-layout">
    <section className="subject-stats-panel subject-stats-topic-panel" aria-labelledby="weak-list-title">
      <div className="subject-stats-weak-heading"><div><p className="subject-stats-eyebrow">Your next revision session</p><h2 id="weak-list-title">A clearer place to focus</h2><p>Marked work from the selected subject and exam profile.</p></div><span>{marked.length} marked topics</span></div>
      <div className="subject-stats-search"><Search aria-hidden="true"/><Input type="search" aria-label="Search topics" placeholder="Search topics" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="subject-stats-topic-filters" role="group" aria-label="Topic status">{(Object.keys(labels) as Filter[]).map(f=><button key={f} type="button" aria-pressed={filter===f} data-status={f} onClick={()=>selectFilter(f)}>{labels[f]}<span>{counts[f]}</span></button>)}</div>
      <div className="subject-stats-topic-columns" aria-hidden="true"><span>Topic</span><span>Score</span><span>Marked evidence</span><span/></div>
      <div className="subject-stats-topic-rows">{visible.map(t=><article className="subject-stats-topic-row" key={t.topic} data-status={t.mastery}>
        <div className="subject-stats-topic-name"><span><BookOpen aria-hidden="true"/></span><div><h3>{t.topic}</h3><p>{subject}<small>{labels[t.mastery as Exclude<Filter,"all">]||"Marked topic"}</small></p></div></div>
        <div className="subject-stats-topic-score"><strong>{pct(t.unifiedScore)}</strong><div aria-hidden="true"><span style={{width:`${t.unifiedScore}%`}}/></div></div>
        <div className="subject-stats-topic-evidence"><strong>{attempts(t)} marked questions</strong><span>{t.lastAttempted?`Last attempted ${new Date(t.lastAttempted).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}`:"No attempt date available"}</span></div>
        <div className="subject-stats-topic-actions"><Button variant="secondary" onClick={()=>practice(t.topic)} aria-label={`Practise ${t.topic}`}>Practise</Button><Button variant="ghost" onClick={()=>setDetail(t)} aria-label={`Details for ${t.topic}`}>Details</Button></div>
      </article>)}</div>
      {!visible.length&&<div className="subject-stats-filter-empty">{!counts.weak&&filter==="weak"&&!search?<><CheckCircle2 aria-hidden="true"/><h3>No topics need attention right now</h3><p>That applies to your marked topics. You can still revisit developing and strong topics.</p><Button variant="outline" onClick={()=>selectFilter("all")}>Explore marked topics</Button></>:<><Search aria-hidden="true"/><h3>No matching topics</h3><p>Try another status or search.</p><Button variant="outline" onClick={()=>{setSearch("");selectFilter("all");}}>Clear filters</Button></>}</div>}
      <p className="subject-stats-caption">{visible.length} {visible.length===1?"topic":"topics"} shown · Scores reflect marked work, not your whole syllabus.</p>
    </section>
    <aside className="subject-stats-panel subject-stats-topic-guidance"><BookOpen aria-hidden="true"/><p className="subject-stats-eyebrow">Small steps count</p><h2>Focus on one topic at a time</h2><p>Start with a topic that needs attention, review its marked evidence and practise again when you’re ready.</p><hr/><h3>Look at the evidence</h3><p>A score from a few questions is a starting point. Open Details to see exam and practice results separately.</p><details><summary>What do these scores mean?</summary><p>Topic scores combine available marked exam and practice answers using Examly’s existing weighting. Unmarked answers stay separate. A topic score isn’t an exam grade or complete syllabus coverage.</p></details></aside>
    <Dialog open={!!detail} onOpenChange={open=>!open&&setDetail(null)}><DialogContent className="subject-stats-topic-dialog subject-stats-expanded"><DialogHeader><DialogTitle>{detail?.topic}</DialogTitle><DialogDescription>{subject} · Evidence from your marked answers</DialogDescription></DialogHeader>{detail&&<><div className="subject-stats-topic-detail-result" data-status={detail.mastery}><strong>{pct(detail.unifiedScore)}</strong><span>{labels[detail.mastery as Exclude<Filter,"all">]}</span><small>{attempts(detail)} marked questions</small></div><div className="subject-stats-evidence-split">{([["Exam",detail.examScore,detail.examQuestionCount],["Practice",detail.practiceScore,detail.practiceQuestionCount]] as const).map(([label,score,count])=><section key={label}><div><h3>{label}</h3><strong>{score===null?"Not attempted":pct(score)}</strong></div><p>{count} marked questions</p></section>)}</div>{detail.practicedSinceLastExam&&<p className="subject-stats-practised-note"><CheckCircle2 aria-hidden="true"/>Practised since your last exam</p>}<p className="subject-stats-caption">Expected answers are available only through a released exam review.</p><Button onClick={()=>practice(detail.topic)}>Practise this topic</Button></>}</DialogContent></Dialog>
  </div>;
}
export type {Filter as StatsTopicFilter};
