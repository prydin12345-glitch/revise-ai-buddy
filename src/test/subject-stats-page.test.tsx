import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import Stats from "@/pages/Stats";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";
import { EMPTY_SUBJECT_PROFILE_STATS, type SubjectProfileStatsData } from "@/lib/subject-profile-stats";
import { StatsFirstResult } from "@/components/stats/StatsFirstResult";
import { SubjectSelector } from "@/components/stats/SubjectSelector";
import { ScopedWeakTopics } from "@/components/stats/ScopedWeakTopics";
import { saveSubjectGradeGoal } from "@/lib/subject-grade-goals";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

const state = vi.hoisted(() => ({ data: null as unknown, loading:false, error:null as Error|null, refetch:vi.fn() }));
vi.mock("@/components/dashboard/DashboardLayout",()=>({DashboardLayout:({children}:{children:React.ReactNode})=><main>{children}</main>}));
vi.mock("@/hooks/useSubjectProfileStats",()=>({useSubjectProfileStats:()=>({...state,refreshing:false})}));
vi.mock("recharts",async original=>({...await original<typeof import("recharts")>(),ResponsiveContainer:({children}:{children:ReactElement})=>cloneElement(children,{width:400,height:220})}));
const date=new Date().toISOString();
function fixture():SubjectProfileStatsData{return {...EMPTY_SUBJECT_PROFILE_STATS,subjects:[{id:"bio",name:"Biology",color:"#2877b8",educationLevel:"alevel"},{id:"chem",name:"Chemistry",color:"#227d73",educationLevel:"alevel"}],profiles:[{id:"full",name:"Full mock",subject:"Biology",educationLevel:"alevel"},{id:"short",name:"Short paper",subject:"Biology",educationLevel:"alevel"},{id:"chem1",name:"Chemistry profile",subject:"Chemistry",educationLevel:"alevel"}],attempts:[{id:"e1",source:"exam",subject:"Biology",profileId:"full",profileName:"Full mock",title:"Paper1",date,score:0,earnedMarks:0,totalMarks:4},{id:"e2",source:"exam",subject:"Biology",profileId:"short",profileName:"Short paper",title:"Paper2",date,score:100,earnedMarks:4,totalMarks:4},{id:"e3",source:"exam",subject:"Chemistry",profileId:"chem1",profileName:"Chemistry profile",title:"Chemistry",date,score:80,earnedMarks:8,totalMarks:10}],topicAnswers:[{source:"exam",subject:"Biology",profileId:"full",topic:"Cells",questionId:"q1",parentId:"e1",date,score:0,marks:4},{source:"exam",subject:"Biology",profileId:"short",topic:"Enzymes",questionId:"q2",parentId:"e2",date,score:4,marks:4},{source:"exam",subject:"Chemistry",profileId:"chem1",topic:"Bonding",questionId:"q3",parentId:"e3",date,score:8,marks:10}],wrongQuestions:[{examId:"e1",questionId:"q1",profileId:"full",subject:"Biology",topic:"Cells",questionNumber:"1(a)",score:0,marks:4,date,examTitle:"Paper1",profileName:"Full mock"}],study:[{source:"exam",subject:"Biology",profileId:"full",date,hours:.5},{source:"quiz",subject:"Biology",profileId:"short",date,hours:1},{source:"exam",subject:"Chemistry",profileId:"chem1",date,hours:2}]};}
function wrapper(children:React.ReactNode,store=new WorkspaceStore("owner-a"),path="/stats"){return <WorkspaceContext.Provider value={{ownerId:store.ownerId,ready:true,store}}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></WorkspaceContext.Provider>;}
beforeEach(()=>{state.data=fixture();state.loading=false;state.error=null;localStorage.clear();state.refetch.mockReset();});afterEach(cleanup);
it("applies the shared subject/profile selection to estimate, questions and topics, retaining real zeros",()=>{render(wrapper(<Stats/>));const goal=screen.getByRole("region",{name:"Biology grade goal"});expect(goal).toHaveTextContent("50%");fireEvent.change(screen.getByRole("combobox",{name:"Exam profile"}),{target:{value:"full"}});expect(goal).toHaveTextContent("0%");expect(screen.getByRole("button",{name:/Review question 1\(a\): Cells/})).toBeVisible();fireEvent.change(screen.getByRole("combobox",{name:"Exam profile"}),{target:{value:"short"}});expect(goal).toHaveTextContent("100%");expect(screen.queryByRole("button",{name:/Review question 1/})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Chemistry"}));expect(screen.getByRole("region",{name:"Chemistry grade goal"})).toHaveTextContent("80%");expect(screen.queryByRole("option",{name:"Short paper"})).toBeNull();});
it("retains the selected subject, profile and trend range across page remounts in the same workspace",()=>{const store=new WorkspaceStore("owner-a");const first=render(wrapper(<Stats/>,store));fireEvent.change(screen.getByRole("combobox",{name:"Exam profile"}),{target:{value:"short"}});fireEvent.change(screen.getByRole("combobox",{name:"Exam trend date range"}),{target:{value:"yearly"}});first.unmount();render(wrapper(<Stats/>,store));expect(screen.getByRole("combobox",{name:"Exam profile"})).toHaveValue("short");expect(screen.getByRole("combobox",{name:"Exam trend date range"})).toHaveValue("yearly");});
it("does not reuse another account’s retained subject/profile or tab",()=>{const a=render(wrapper(<Stats/>));fireEvent.click(screen.getByRole("button",{name:"Chemistry"}));a.unmount();render(wrapper(<Stats/>,new WorkspaceStore("owner-b")));expect(screen.getByRole("button",{name:"Biology"})).toHaveAttribute("aria-pressed","true");expect(screen.getByRole("combobox",{name:"Exam profile"})).toHaveValue("all");});
it("honors the existing weak-topics deep link and keeps the new list subject-scoped",()=>{render(wrapper(<Stats/>,new WorkspaceStore("owner-a"),"/stats?tab=weak-topics"));expect(screen.getByRole("tab",{name:/Weak Topics/})).toHaveAttribute("data-state","active");expect(screen.getByRole("heading",{name:"Cells"})).toBeVisible();expect(screen.queryByRole("heading",{name:"Bonding"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Chemistry"}));expect(screen.getByText("No topics need attention right now")).toBeVisible();});
it("shows the approved first-result state without fake score charts, and pending work remains separate",()=>{state.data={...fixture(),attempts:[],topicAnswers:[],wrongQuestions:[],study:[]};const view=render(wrapper(<Stats/>));expect(screen.getByRole("heading",{name:"Your first result starts here."})).toBeVisible();expect(screen.queryByRole("heading",{name:"Exam score trends"})).toBeNull();expect(screen.getByRole("img",{name:"No marked exam estimate yet"})).toBeVisible();view.unmount();state.data={...(state.data as SubjectProfileStatsData),pending:[{id:"pending",source:"exam",subject:"Biology",profileId:"full",date}]};render(wrapper(<Stats/>));expect(screen.getByRole("heading",{name:"Your first results are on their way."})).toBeVisible();});
it("renders actionable load/error states instead of fabricated empty statistics",()=>{state.data=EMPTY_SUBJECT_PROFILE_STATS;state.loading=true;const view=render(wrapper(<Stats/>));expect(screen.getByRole("status",{name:"Loading your statistics"})).toHaveAttribute("aria-busy","true");view.unmount();state.loading=false;state.error=new Error("fixture error");render(wrapper(<Stats/>));fireEvent.click(screen.getByRole("button",{name:"Retry"}));expect(state.refetch).toHaveBeenCalledOnce();expect(screen.queryByText("Your first result starts here.")).toBeNull();});
it("first-result actions keep the selected subject and saved profile on the existing creation routes",()=>{function Location(){const l=useLocation();return <output aria-label="Destination">{l.pathname+l.search}</output>;}render(wrapper(<><StatsFirstResult subject="Biology" profileId="full"/><Location/></>));fireEvent.click(screen.getByRole("button",{name:"Create an exam"}));expect(screen.getByLabelText("Destination")).toHaveTextContent("/upload?subject=Biology&profileId=full");fireEvent.click(screen.getByRole("button",{name:"Create a quiz"}));expect(screen.getByLabelText("Destination")).toHaveTextContent("/create-practice-questions?subject=Biology&profileId=full");});
it("topic details distinguish missing practice from a true zero and keep targeted practice scoped",()=>{const topic:UnifiedTopicScore={topic:"Cells",subjectId:"Biology",unifiedScore:0,examScore:0,practiceScore:null,examQuestionCount:2,practiceQuestionCount:0,mastery:"weak",lastAttempted:date,practicedSinceLastExam:false};function Location(){return <output aria-label="Destination">{useLocation().search}</output>;}render(wrapper(<><ScopedWeakTopics topics={[topic]} subject="Biology" profileId="full"/><Location/></>));fireEvent.click(screen.getByRole("button",{name:"Details for Cells"}));const dialog=screen.getByRole("dialog");expect(within(dialog).getByText("Not attempted")).toBeVisible();expect(within(dialog).getAllByText("0%").length).toBeGreaterThan(0);fireEvent.click(within(dialog).getByRole("button",{name:"Practise this topic"}));expect(screen.getByLabelText("Destination")).toHaveTextContent("profileId=full");});

it("keeps released scores and question review visible when topic metadata is unavailable",()=>{const data=fixture();data.topicUnavailableExams=[{examId:"e1",subject:"Biology",profileId:"full"}];state.data=data;render(wrapper(<Stats/>));expect(screen.getByRole("heading",{name:"Some topic results couldn’t load"})).toBeVisible();expect(screen.queryByRole("heading",{name:"Topic breakdown"})).toBeNull();expect(screen.getByRole("button",{name:/Review question 1/})).toBeVisible();fireEvent.change(screen.getByRole("combobox",{name:"Exam profile"}),{target:{value:"short"}});expect(screen.queryByRole("heading",{name:"Some topic results couldn’t load"})).toBeNull();expect(screen.getByRole("heading",{name:"Topic breakdown"})).toBeVisible();});

it("keeps a new subject’s saved starting grade and target before an exam profile exists",()=>{state.data={...EMPTY_SUBJECT_PROFILE_STATS,subjects:[{id:"new-subject",name:"Biology",color:"#2877b8"}]};saveSubjectGradeGoal("owner-a","new-subject",{scaleId:"alevel_a_e",startingGrade:"D",targetGrade:"A"});render(wrapper(<Stats/>));const card=screen.getByRole("region",{name:"Biology grade goal"});expect(card).toHaveTextContent("Starting grade");expect(card).toHaveTextContent("D");expect(card).toHaveTextContent("Your target");expect(card).toHaveTextContent("A");expect(card).not.toHaveTextContent("This course uses Percentage");});

it("uses saved subject colours for icon-free controls and retains accessible selection",()=>{
  const select=vi.fn();
  render(<SubjectSelector subjects={[{id:"dark",name:"Biology",color:"#123"},{id:"bright",name:"Chemistry",color:"#ffff00"},{id:"invalid",name:"History",color:"invalid"}]} selectedId="dark" onSelect={select}/>);
  const group=screen.getByRole("group",{name:"Subject"});
  expect(group.style.getPropertyValue("--active-subject-colour")).toBe("#112233");
  expect(group.querySelector("svg")).toBeNull();
  const dark=within(group).getByRole("button",{name:"Biology"});
  expect(dark).toHaveAttribute("aria-pressed","true");
  expect(dark.style.getPropertyValue("--subject-tab-foreground")).toBe("#ffffff");
  const bright=within(group).getByRole("button",{name:"Chemistry"});
  expect(bright.style.getPropertyValue("--subject-tab-foreground")).toBe("#000000");
  expect(within(group).getByRole("button",{name:"History"}).style.getPropertyValue("--subject-tab-colour")).toBe("#4263eb");
  fireEvent.click(bright);expect(select).toHaveBeenCalledWith("bright");
});

it("keeps topic-category drilldown inside Overview and resets it when the subject changes",()=>{
  render(wrapper(<Stats/>));
  fireEvent.click(screen.getByRole("button",{name:"Needs attention: 1 topics"}));
  expect(screen.getByRole("region",{name:"Needs attention topics"})).toHaveTextContent("Cells");
  expect(screen.getByRole("tab",{name:"Overview"})).toHaveAttribute("data-state","active");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Chemistry"}));
  expect(screen.queryByRole("region",{name:"Needs attention topics"})).toBeNull();
  expect(screen.getByRole("heading",{name:"Topic breakdown"})).toBeVisible();
});

it("keeps the main view free of the removed explanatory copy",()=>{
  render(wrapper(<Stats/>));
  expect(screen.queryByText(/See what’s improving|Each line follows|Curves join recorded|Axes = marked|Each topic is counted once/)).toBeNull();
  expect(screen.queryByText(/Open a question to see|Estimates use selected marked|Goals are saved on this browser/)).toBeNull();
});
