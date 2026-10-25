import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

/** Original deterministic illustration; no results are implied by the artwork. */
function FirstResultIllustration() {
  return <svg className="subject-stats-first-art" viewBox="0 0 230 220" fill="none" aria-hidden="true">
    <circle cx="114" cy="107" r="90" fill="hsl(var(--primary) / .07)" />
    <rect x="51" y="45" width="117" height="143" rx="11" fill="hsl(var(--card))" stroke="hsl(var(--border))" transform="rotate(-7 110 115)" />
    <rect x="65" y="33" width="115" height="146" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
    <rect x="87" y="23" width="70" height="21" rx="7" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
    {[70,104,138].map(y=><circle key={y} cx="88" cy={y} r="7" fill="hsl(var(--primary) / .08)" />)}
    <path d="m85 70 2 2 4-5" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    <path d="M106 68h48M106 75h30M106 102h48M106 109h24M106 136h37M106 143h24" stroke="hsl(var(--border))" strokeWidth="1.5" />
    <circle cx="174" cy="163" r="23" fill="hsl(var(--success) / .1)" stroke="hsl(var(--success))" />
    <path d="m164 163 7 7 13-15" stroke="hsl(var(--success))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m42 68 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" stroke="hsl(var(--primary) / .5)" strokeWidth="1.5" />
  </svg>;
}

export function StatsFirstResult({ noSubjects=false, pending=false, subject, profileId }: { noSubjects?:boolean; pending?:boolean; subject?:string; profileId?:string }) {
  const navigate=useNavigate();
  const destination=(path:string)=>{const p=new URLSearchParams();if(subject)p.set("subject",subject);if(profileId&&profileId!=="all"&&profileId!=="unprofiled")p.set("profileId",profileId);navigate(`${path}${p.size?`?${p}`:""}`);};
  return <section className="subject-stats-panel subject-stats-first" aria-labelledby="first-result-title">
    <div>
      <p className="subject-stats-eyebrow"><span />{pending?"Your work is saved":"A fresh starting point"}</p>
      <h2 id="first-result-title">{noSubjects?"Your progress starts here.":pending?"Your first results are on their way.":"Your first result starts here."}</h2>
      <p className="subject-stats-first-copy">{noSubjects?"Add a subject, then complete an exam or practice quiz. We’ll turn your marked work into a clear picture of your progress.":pending?"Once your answers are marked and released, you’ll see your subject results and topics to focus on. There’s no score to show yet.":"Complete an exam or practice quiz. Once it’s marked, you’ll see what’s going well and where a little more practice could help."}</p>
      <div className="subject-stats-first-actions">{noSubjects?<Button onClick={()=>navigate("/my-subjects")}>Add a subject</Button>:pending?<Button onClick={()=>navigate("/my-exams")}>Open Practice Library</Button>:<><Button onClick={()=>destination("/create-practice-questions")}>Create a quiz</Button><Button variant="outline" onClick={()=>destination("/upload")}>Create an exam</Button></>}</div>
    </div>
    <FirstResultIllustration />
  </section>;
}
