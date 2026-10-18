// src/components/dashboard/SubjectDonut.tsx
// Three-level drill-down: Subjects → Exam Profiles → Topics.
// State-driven, framer-motion transitions, dark-mode safe via semantic tokens.
import { useId, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, Filter } from "lucide-react";
import { useRetainedState, useWorkspaceSession } from "@/hooks/use-workspace-session";
import { profileTopicRows } from "@/lib/subject-profile-topics";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/shared/ListFeedback";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import {
  useUnifiedTopicPerformance,
  type UnifiedTopicScore,
} from "@/hooks/useUnifiedTopicPerformance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Subject } from "./types";

interface SubjectDonutProps {
  subjects: Subject[];
  centerValue?: string;
  centerLabel?: string;
  shareBasis?: "study_time" | "exam_count";
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

type View = "subjects" | "profiles" | "topics";
type SortKey = "weakest" | "recent" | "priority";

const activeShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      cornerRadius={6}
      fill={fill}
      stroke="none"
    />
  );
};

const masteryMeta: Record<
  UnifiedTopicScore["mastery"],
  { label: string; bar: string; text: string; bg: string }
> = {
  weak: {
    label: "Needs Work",
    bar: "bg-[hsl(0_84%_55%)]",
    text: "text-[hsl(0_84%_60%)]",
    bg: "bg-[hsl(0_84%_55%/0.12)]",
  },
  developing: {
    label: "Developing",
    bar: "bg-[hsl(38_92%_50%)]",
    text: "text-[hsl(38_92%_55%)]",
    bg: "bg-[hsl(38_92%_50%/0.12)]",
  },
  strong: {
    label: "Mastered",
    bar: "bg-[hsl(142_70%_45%)]",
    text: "text-[hsl(142_70%_50%)]",
    bg: "bg-[hsl(142_70%_45%/0.12)]",
  },
  untested: {
    label: "Untested",
    bar: "bg-muted",
    text: "text-muted-foreground",
    bg: "bg-muted",
  },
};

const timeAgoShort = (iso: string | null): string => {
  if (!iso) return "—";
  if (!Number.isFinite(Date.parse(iso))) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const m = Math.floor(d / 30);
  return `${m}mo ago`;
};

export default function SubjectDonut(props: SubjectDonutProps) {
  const { ownerId } = useWorkspaceSession();
  return <SubjectStatistics key={ownerId || "signed-out"} {...props} />;
}

function SubjectStatistics({
  subjects,
  centerValue = "—",
  centerLabel = "Average score",
  shareBasis = "study_time",
  loading = false,
  error = null,
  onRetry,
}: SubjectDonutProps) {
  const { ownerId } = useWorkspaceSession();
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useRetainedState<View>("home-statistics:view", "subjects");
  const [selectedSubjectKey, setSelectedSubjectKey] = useRetainedState<string | null>("home-statistics:subject", null);
  const [selectedProfileId, setSelectedProfileId] = useRetainedState<string | null>("home-statistics:profile", null);
  const [search, setSearch] = useRetainedState("home-statistics:search", "");
  const [sort, setSort] = useRetainedState<SortKey>("home-statistics:sort", "weakest");
  const selectedSubject = subjects.find(subject => subject.key === selectedSubjectKey) || null;

  const { getProfilesForSubject, loading: profilesLoading, error: profilesError, retry: retryProfiles } = useSubjectProfiles();
  const { topics: allTopics, loading: topicsLoading, error: topicsError, refetch: retryTopics } = useUnifiedTopicPerformance(
    selectedSubject ? ownerId : null,
    selectedSubject ? [selectedSubject.key, selectedSubject.name, ...(selectedSubject.identifiers || [])] : [],
  );

  const current = active != null ? subjects[active] : null;

  const profilesForSubject = useMemo(
    () => (selectedSubject ? getProfilesForSubject(selectedSubject.name) : []),
    [selectedSubject, getProfilesForSubject]
  );

  const selectedProfile = useMemo(
    () => profilesForSubject.find((p) => p.id === selectedProfileId) || null,
    [profilesForSubject, selectedProfileId]
  );

  const profileTopicScores = useMemo(() => selectedProfile ? profileTopicRows(selectedProfile.topics, allTopics) : [], [selectedProfile, allTopics]);

  const visibleTopics = useMemo(() => {
    let list = profileTopicScores;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => t.topic.toLowerCase().includes(q));
    const order: Record<UnifiedTopicScore["mastery"], number> = {
      weak: 0,
      developing: 1,
      strong: 2,
      untested: 3,
    };
    const sorted = [...list];
    if (sort === "weakest") {
      sorted.sort((a, b) => order[a.mastery] - order[b.mastery] || a.unifiedScore - b.unifiedScore);
    } else if (sort === "recent") {
      sorted.sort(
        (a, b) =>
          new Date(b.lastAttempted ?? 0).getTime() - new Date(a.lastAttempted ?? 0).getTime()
      );
    } else {
      // High priority = weak + recently attempted
      sorted.sort((a, b) => {
        const aP = (a.mastery === "weak" ? 0 : a.mastery === "developing" ? 1 : 2) * 1e13;
        const bP = (b.mastery === "weak" ? 0 : b.mastery === "developing" ? 1 : 2) * 1e13;
        return (
          aP - bP -
          (new Date(a.lastAttempted ?? 0).getTime() - new Date(b.lastAttempted ?? 0).getTime())
        );
      });
    }
    return sorted;
  }, [profileTopicScores, search, sort]);

  const enterSubject = (subject: Subject) => {
    setActive(null);
    setSelectedSubjectKey(subject.key);
    setSelectedProfileId(null);
    setView("profiles");
  };
  const enterProfile = (id: string) => {
    setSelectedProfileId(id);
    setSearch("");
    setSort("weakest");
    setView("topics");
  };
  const goBack = () => {
    if (view === "topics") {
      setSelectedProfileId(null);
      setView("profiles");
    } else if (view === "profiles") {
      setSelectedSubjectKey(null);
      setActive(null);
      setView("subjects");
    }
  };

  // Header title
  const title =
    view === "subjects"
      ? "Statistics"
      : view === "profiles"
      ? `${selectedSubject?.name ?? ""} Statistics`
      : selectedProfile?.profile_name || "Exam profile unavailable";

  const subtitle =
    view === "subjects"
      ? `${shareBasis === "study_time" ? "Share of your study time" : "Share of your papers"} · select a subject to explore`
      : view === "profiles"
      ? "Pick an exam profile to see topic-level performance"
      : `${selectedSubject?.name ?? ""} · ${profileTopicScores.length} topic${
          profileTopicScores.length === 1 ? "" : "s"
        } · subject-wide performance`;

  const sectionVariants = {
    initial: (dir: number) => ({ x: dir * 24, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 24, opacity: 0 }),
  };
  const direction = view === "subjects" ? -1 : 1;
  const detailLoading = loading || (view !== "subjects" && (profilesLoading || topicsLoading));
  const detailError = error || (view !== "subjects" && (profilesError || topicsError));
  const detailReady = !detailLoading && !detailError;

  return (
    <section className="subject-statistics rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby={titleId}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {view !== "subjects" && (
            <button
              onClick={goBack}
              className="subject-statistics-back -ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={view === "topics" ? "Back to exam profiles" : "Back to subjects"}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h2 id={titleId} className="break-words text-base font-bold">{title}</h2>
        </div>
      </div>
      <p className="mb-3.5 text-[12.5px] font-semibold text-muted-foreground">{subtitle}</p>

      {detailLoading && <div role="status" aria-label="Loading subject statistics" className="space-y-3 py-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
      {!detailLoading && detailError && <LoadError message={detailError} onRetry={() => { if (error) onRetry?.(); if (profilesError) void retryProfiles(); if (topicsError) void retryTopics(); }} />}
      {view !== "subjects" && detailReady && !selectedSubject && <p className="py-6 text-sm text-muted-foreground">This subject is no longer in your breakdown. Go back to choose another subject.</p>}
      {view === "topics" && detailReady && selectedSubject && !selectedProfile && <p className="py-6 text-sm text-muted-foreground">This exam profile is no longer available. Go back to choose another profile.</p>}

      <AnimatePresence mode="wait" custom={direction}>
        {/* ───────── Level 1: Subjects ───────── */}
        {view === "subjects" && detailReady && (
          <motion.div
            key="subjects"
            custom={direction}
            variants={sectionVariants}
            initial={reduceMotion ? false : "initial"}
            animate="animate"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="subject-statistics-overview flex flex-col items-center"
          >
            <div className="subject-statistics-chart relative h-[196px] w-[196px]" role="img" aria-label={subjects.length ? `Subject breakdown: ${subjects.map(subject => `${subject.name} ${subject.pct}%`).join(", ")}` : "No subject data yet"}>
              {subjects.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjects}
                      dataKey="pct"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={92}
                      paddingAngle={3}
                      cornerRadius={6}
                      stroke="none"
                      rootTabIndex={-1}
                      isAnimationActive={!reduceMotion}
                      activeIndex={active ?? undefined}
                      activeShape={activeShape}
                      onMouseEnter={(_, i) => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onClick={(_, i) => subjects[i] && enterSubject(subjects[i])}
                    >
                      {subjects.map((s, i) => (
                        <Cell
                          key={s.key}
                          fill={s.color}
                          stroke="none"
                          opacity={active == null || active === i ? 1 : 0.3}
                          className="cursor-pointer"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                  No data yet
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-[32px] font-extrabold leading-none tracking-tight"
                  style={current ? { color: current.color } : undefined}
                >
                  {current ? `${current.pct}%` : centerValue}
                </span>
                <span className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  {current ? current.name : centerLabel}
                </span>
              </div>
            </div>

            <div className="subject-statistics-legend mt-5 w-full space-y-1">
              {subjects.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => enterSubject(s)}
                  className="group w-full rounded-[10px] px-1.5 py-2 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-semibold">
                      <span
                        className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]"
                        style={{ background: s.color }}
                      />
                      <span className="break-words">{s.name}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className="text-[13px] font-extrabold tabular-nums text-muted-foreground"
                        style={active === i ? { color: s.color } : undefined}
                      >
                        {s.pct}%
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </div>
                  <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.pct}%`,
                        background: s.color,
                        opacity: active == null || active === i ? 1 : 0.4,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ───────── Level 2: Exam Profiles ───────── */}
        {view === "profiles" && selectedSubject && detailReady && (
          <motion.div
            key="profiles"
            custom={direction}
            variants={sectionVariants}
            initial={reduceMotion ? false : "initial"}
            animate="animate"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="space-y-2"
          >
            {profilesForSubject.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No exam profiles yet for {selectedSubject.name}.
                <br />
                Create one from My Subjects to unlock topic-level analytics.
              </div>
            ) : (
              profilesForSubject.map((p) => {
                const matched = profileTopicRows(p.topics, allTopics).filter(row => row.mastery !== "untested");
                const avg =
                  matched.length > 0
                    ? Math.round(
                        matched.reduce((a, b) => a + b.unifiedScore, 0) / matched.length
                      )
                    : null;
                const weak = matched.filter((t) => t.mastery === "weak").length;
                return (
                  <button
                    key={p.id}
                    onClick={() => enterProfile(p.id)}
                    className="group w-full rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-primary/50 hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ background: selectedSubject.color }}
                          />
                          <p className="truncate text-[13px] font-bold">{p.profile_name}</p>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {p.topics.length} topic{p.topics.length === 1 ? "" : "s"}
                          {p.exam_board ? ` · ${p.exam_board}` : ""}
                          {p.educational_tier ? ` · ${p.educational_tier}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-[14px] font-extrabold tabular-nums">
                            {avg !== null ? `${avg}%` : "—"}
                          </p>
                          {weak > 0 && (
                            <p className="text-[10px] font-semibold text-[hsl(0_84%_60%)]">
                              {weak} weak
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </motion.div>
        )}

        {/* ───────── Level 3: Topics ───────── */}
        {view === "topics" && selectedProfile && detailReady && (
          <motion.div
            key="topics"
            custom={direction}
            variants={sectionVariants}
            initial={reduceMotion ? false : "initial"}
            animate="animate"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="space-y-3"
          >
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search topics…"
                  aria-label="Search topics"
                  className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-8 w-full text-[12.5px]" aria-label="Sort topics">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weakest">Weakest topics first</SelectItem>
                  <SelectItem value="recent">Recent activity</SelectItem>
                  <SelectItem value="priority">High priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              {visibleTopics.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                  No topics match your search.
                </div>
              ) : (
                visibleTopics.map((t) => {
                  const m = masteryMeta[t.mastery];
                  const pct = t.mastery === "untested" ? 0 : t.unifiedScore;
                  const attempts = t.examQuestionCount + t.practiceQuestionCount;
                  return (
                    <div
                      key={t.topic}
                      className="rounded-[10px] border border-border bg-background p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12.5px] font-semibold capitalize">
                          {t.topic}
                        </p>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${m.bg} ${m.text}`}
                        >
                          {t.mastery === "untested" ? "—" : `${pct}%`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${m.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
                        <span className={`font-semibold ${m.text}`}>{m.label}</span>
                        <span className="tabular-nums">
                          {attempts > 0 ? `${attempts} attempt${attempts === 1 ? "" : "s"}` : "Not attempted"}
                          {t.lastAttempted ? ` · ${timeAgoShort(t.lastAttempted)}` : ""}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
