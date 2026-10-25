import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Clock3 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadError } from "@/components/shared/ListFeedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsPageHeading, StatsError } from "@/components/stats/StatsPageStates";
import { StatsFirstResult } from "@/components/stats/StatsFirstResult";
import { ScopedWeakTopics, type StatsTopicFilter } from "@/components/stats/ScopedWeakTopics";
import { ProfileTrendChart, TopicBreakdownChart, ProfileTopicRadar, ProfileStudyChart, TopicScoreDistribution } from "@/components/stats/SubjectStatsCharts";
import { GradeGoalCard } from "@/components/stats/GradeGoalCard";
import { QuestionsToRevisit } from "@/components/stats/QuestionsToRevisit";
import { useSubjectProfileStats } from "@/hooks/useSubjectProfileStats";
import { useRetainedState, useWorkspaceSession } from "@/hooks/use-workspace-session";
import { ALL_STATS_PROFILES, selectSubjectProfileStats, type StatsTimeRange } from "@/lib/subject-profile-stats";
import { LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { resolveScaleId } from "@/lib/grade-scales";
import "@/styles/subject-stats.css";

export default function Stats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { ownerId, store } = useWorkspaceSession();
  const [tab, setTab] = useRetainedState("stats:tab:v3", () => searchParams.get("tab") === "weak-topics" ? "weak-topics" : "overview");
  const [subjectId, setSubjectId] = useRetainedState("stats:subject:v3", "");
  const [profilesBySubject, setProfilesBySubject] = useRetainedState<Record<string, string>>("stats:profiles:v3", {});
  const [timeRange, setTimeRange] = useRetainedState<StatsTimeRange>("stats:range:v3", "monthly");
  const [weakFilter, setWeakFilter] = useRetainedState<StatsTopicFilter>("stats:weak-filter:v3", "weak");
  const { data, loading, refreshing, error, refetch } = useSubjectProfileStats();
  const activeSubjectId = data.subjects.some(subject => subject.id === subjectId) ? subjectId : data.subjects[0]?.id || "";
  const subjectScope = useMemo(() => selectSubjectProfileStats(data, { subjectId: activeSubjectId, timeRange }), [data, activeSubjectId, timeRange]);
  const savedProfile = profilesBySubject[activeSubjectId] || ALL_STATS_PROFILES;
  const profileId = savedProfile === ALL_STATS_PROFILES || subjectScope.profiles.some(profile => profile.id === savedProfile) ? savedProfile : ALL_STATS_PROFILES;
  const scoped = useMemo(() => selectSubjectProfileStats(data, { subjectId: activeSubjectId, profileId, timeRange }), [data, activeSubjectId, profileId, timeRange]);
  const selectedProfile = scoped.profiles.find(profile => profile.id === profileId);
  const profileLabel = selectedProfile?.name || "All profiles";
  const subject = scoped.subject;
  const hasMarkedWork = scoped.attempts.length > 0 || scoped.topics.length > 0;
  const weakCount = scoped.topicUnavailableCount ? 0 : scoped.topics.filter(topic => topic.mastery === "weak").length;
  const scopeKey = `${ownerId || "anonymous"}:${store.generation}:${activeSubjectId}:${profileId}`;
  const savedLevel = selectedProfile?.educationLevel || subject?.educationLevel;
  const defaultScaleId = savedLevel ? resolveScaleId(savedLevel) : undefined;
  const defaultTierId = selectedProfile?.assessmentTier === "foundation" || selectedProfile?.assessmentTier === "higher" ? selectedProfile.assessmentTier : undefined;

  function changeTab(value: string) {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    if (value === "weak-topics") next.set("tab", value); else next.delete("tab");
    setSearchParams(next, { replace: true });
  }
  const tabs = <TabsList className="subject-stats-tabs" aria-label="Progress views"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="weak-topics">Weak Topics{weakCount > 0 && <span className="subject-stats-count">{weakCount}</span>}</TabsTrigger></TabsList>;
  const goal = subject && <GradeGoalCard key={`${ownerId}:${subject.id}`} ownerId={ownerId} subjectId={subject.id} subject={subject.name} averageScore={scoped.averageExamScore} defaultScaleId={defaultScaleId} defaultTierId={defaultTierId} profileLabel={profileLabel} targetPercentage={scoped.targetPercentage} />;

  return <DashboardLayout><div className="subject-stats" aria-busy={refreshing || undefined}>
    {loading && !data.subjects.length ? <><StatsPageHeading actions={<Skeleton className="h-11 w-56 max-w-full"/>}/><div role="status" aria-label="Loading your statistics" aria-busy="true"><span className="sr-only">Loading your statistics…</span><div className="subject-stats-loading" aria-hidden="true"><Skeleton className="h-24 w-full"/><div className="subject-stats-grid"><Skeleton className="subject-stats-trend h-80"/><Skeleton className="subject-stats-breakdown h-80"/>{[1,2,3].map(n=><Skeleton key={n} className="subject-stats-radar h-72"/>)}</div></div></div></> : error && !data.subjects.length ? <><StatsPageHeading/><StatsError onRetry={()=>void refetch()}/></> : <Tabs value={tab} onValueChange={changeTab}>
      <StatsPageHeading actions={tabs}/>
      {!!data.unavailableExamCount && <LoadError message="Some exam history couldn’t be grouped by subject. Your available results are still shown." onRetry={()=>void refetch()}/>}
      {error && <LoadError message="Couldn’t update your statistics. Your last loaded results are still shown." onRetry={()=>void refetch()}/>}
      {data.subjects.length > 0 && <><div className="subject-stats-scope" aria-label="Statistics selection">
        <div className="subject-stats-subject-control"><span className="subject-stats-control-label" id="stats-subject-label">Subject</span><div className="subject-stats-subject-switch" role="group" aria-labelledby="stats-subject-label">{data.subjects.map(item=><button type="button" key={item.id} aria-pressed={activeSubjectId===item.id} onClick={()=>setSubjectId(item.id)}><BookOpen aria-hidden="true"/>{item.name}</button>)}</div></div>
        <div className="subject-stats-profile-control"><label htmlFor="stats-profile-select">Exam profile</label><select id="stats-profile-select" value={profileId} onChange={e=>setProfilesBySubject(previous=>({...previous,[activeSubjectId]:e.target.value}))}><option value={ALL_STATS_PROFILES}>All profiles</option>{scoped.profiles.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      </div><div className="subject-stats-scope-note"><span>{subject?.name}{selectedProfile?.examBoard ? ` · ${getBoardDisplayName(selectedProfile.examBoard)}` : ""}{selectedProfile?.educationLevel ? ` · ${LEVEL_DISPLAY_NAMES[selectedProfile.educationLevel] || selectedProfile.educationLevel}` : ""}</span><span>{profileId===ALL_STATS_PROFILES?"Comparing profiles":profileLabel} · All cards follow this selection</span></div></>}
      <TabsContent value="overview" className="m-0" aria-label="Overview">
        {!hasMarkedWork ? data.unavailableExamCount ? <StatsError onRetry={()=>void refetch()}/> : <><StatsFirstResult noSubjects={!subject} pending={scoped.pending.length>0} subject={subject?.name} profileId={profileId}/>{scoped.unassignedStudyHours > 0 && <p className="subject-stats-pending">{Math.round(scoped.unassignedStudyHours * 10) / 10}h of subject revision recorded this week. It isn’t linked to an exam profile.</p>}{subject && <div className="subject-stats-first-goal">{goal}</div>}</> : <>
          {scoped.pending.length>0 && <p className="subject-stats-pending"><Clock3 aria-hidden="true"/>{scoped.pending.length} {scoped.pending.length===1?"attempt is":"attempts are"} awaiting marking or release. They aren’t counted as zero.</p>}
          <div className="subject-stats-grid">
            <ProfileTrendChart rows={scoped.trend} profiles={scoped.profiles} timeRange={timeRange} onTimeRangeChange={setTimeRange}/>
            {scoped.topicUnavailableCount > 0 ? <section className="subject-stats-panel subject-stats-topic-unavailable" role="alert"><h2>Some topic results couldn’t load</h2><p>Your exam scores and released question reviews remain available. We won’t show missing topic evidence as zero or as mastered work.</p><button type="button" className="subject-stats-text-button" onClick={()=>void refetch()}>Retry topic results</button></section> : <><TopicBreakdownChart topics={scoped.topics} onStatusSelect={status=>{setWeakFilter(status);changeTab("weak-topics");}}/>
            <ProfileTopicRadar profiles={scoped.profiles} topicsByProfile={scoped.topicsByProfile}/></>}
            <ProfileStudyChart days={scoped.studyDays} profiles={scoped.profiles} totalHours={scoped.studyHours} unassignedHours={scoped.unassignedStudyHours}/>
            {!scoped.topicUnavailableCount && <TopicScoreDistribution topics={scoped.topics}/>}
            {goal}
            <QuestionsToRevisit questions={scoped.wrongQuestions} scopeKey={scopeKey}/>
          </div>
        </>}
      </TabsContent>
      <TabsContent value="weak-topics" className="m-0" aria-label="Weak Topics">{scoped.topicUnavailableCount > 0 || (!!data.unavailableExamCount && !hasMarkedWork) ? <LoadError message="Some topic evidence isn’t available. Your exam scores and released question reviews remain available." onRetry={()=>void refetch()}/> : <ScopedWeakTopics key={scopeKey} topics={scoped.topics} subject={subject?.name || ""} profileId={profileId} initialFilter={weakFilter} onFilterChange={setWeakFilter} pendingCount={scoped.pending.length}/> }</TabsContent>
    </Tabs>}
  </div></DashboardLayout>;
}
