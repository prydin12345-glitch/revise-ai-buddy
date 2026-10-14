import { useState, useMemo, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Eye, 
  Calendar, 
  Clock, 
  Flame, 
  Trophy, 
  FileText, 
  TrendingUp, 
  Search, 
  ArrowUpDown,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  TrendingDown,
  Minus,
  Timer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, startOfMonth, subMonths, isValid, parseISO } from "date-fns";
import { useIsMobile } from '@/hooks/use-mobile';
import { useStatsSwipe } from '@/hooks/useStatsSwipe';
import { StreakPanel } from './stats/StreakPanel';
import { StudyHoursPanel } from './stats/StudyHoursPanel';
import { STATS_SECTIONS, type DrilldownType, type StatsSection, type ExamItem, type StudySession, type StreakData, type StudyPeriod } from '@/lib/dashboard-stats';
import '@/styles/dashboard-stats.css';

export type { DrilldownType } from '@/lib/dashboard-stats';

interface StatsDrilldownDrawerProps {
  type: DrilldownType;
  onClose: () => void;
  onNavigate: (section: StatsSection) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  completedExams?: ExamItem[];
  scoreBreakdown?: ExamItem[];
  excludedCount?: number;
  studySessions?: StudySession[];
  streakData?: StreakData;
  studyPeriod: StudyPeriod;
  onStudyPeriodChange: (period: StudyPeriod) => void;
  streakMonth: string;
  onStreakMonthChange: (month: string) => void;
}

type ExamSortOption = 'recent' | 'oldest' | 'highest' | 'lowest' | 'subject';
type ExamFilterOption = 'all' | 'completed' | 'in-progress' | 'awaiting' | 'practice';
type TimeRangeOption = 'week' | 'month' | '3months' | 'all';

const SORT_OPTIONS: { value: ExamSortOption; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest Score' },
  { value: 'lowest', label: 'Lowest Score' },
  { value: 'subject', label: 'Subject (A–Z)' },
];

const FILTER_OPTIONS: { value: ExamFilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'awaiting', label: 'Awaiting Release' },
];

const TIME_RANGE_OPTIONS: { value: TimeRangeOption; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: 'all', label: 'All Time' },
];

// Subtle divider component
const SubtleDivider = () => (
  <div className="h-px bg-border/10 my-4" />
);

export const StatsDrilldownDrawer = ({
  type,
  onClose,
  onNavigate,
  loading = false,
  error,
  onRetry,
  completedExams = [],
  scoreBreakdown = [],
  excludedCount = 0,
  studySessions = [],
  streakData,
  studyPeriod,
  onStudyPeriodChange,
  streakMonth,
  onStreakMonthChange,
}: StatsDrilldownDrawerProps) => {
  const navigate = useNavigate();
  const isOpen = type !== null;
  const isMobile = useIsMobile();
  const swipe = useStatsSwipe(type, onNavigate, isMobile);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionIndex = type ? STATS_SECTIONS.indexOf(type) : 0;
  const sectionLabels = ['Exams Taken', 'Score Breakdown', 'Study Hours', 'Day Streak'];
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [type]);

  // Exams drawer state
  const [examSearch, setExamSearch] = useState('');
  const [examSort, setExamSort] = useState<ExamSortOption>('recent');
  const [examFilter, setExamFilter] = useState<ExamFilterOption>('all');
  
  // Scores drawer state
  const [scoreTimeRange, setScoreTimeRange] = useState<TimeRangeOption>('all');
  const [scoreSubjectFilter, setScoreSubjectFilter] = useState<string>('all');

  // Get unique subjects from exams
  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(completedExams.map(e => e.subject));
    return Array.from(subjects).sort();
  }, [completedExams]);

  // Filtered and sorted exams
  const filteredExams = useMemo(() => {
    let exams = [...completedExams];
    
    // Apply search
    if (examSearch.trim()) {
      const search = examSearch.toLowerCase();
      exams = exams.filter(e => 
        e.title.toLowerCase().includes(search) ||
        e.subject.toLowerCase().includes(search) ||
        e.dateTaken.toLowerCase().includes(search)
      );
    }
    
    // Apply filter
    if (examFilter !== 'all') {
      exams = exams.filter(e => {
        switch (examFilter) {
          case 'completed': return e.isReleased;
          case 'awaiting': return !e.isReleased;
          case 'in-progress': return e.status === 'in_progress';
          default: return true;
        }
      });
    }
    
    // Apply sort
    exams.sort((a, b) => {
      switch (examSort) {
        case 'recent': return new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime();
        case 'oldest': return new Date(a.dateTaken).getTime() - new Date(b.dateTaken).getTime();
        case 'highest': return b.score - a.score;
        case 'lowest': return a.score - b.score;
        case 'subject': return a.subject.localeCompare(b.subject);
        default: return 0;
      }
    });
    
    return exams;
  }, [completedExams, examSearch, examFilter, examSort]);

  // Filtered scores by time range and subject
  const filteredScores = useMemo(() => {
    let scores = [...scoreBreakdown];
    
    if (scoreSubjectFilter !== 'all') {
      scores = scores.filter(s => s.subject === scoreSubjectFilter);
    }
    
    if (scoreTimeRange !== 'all') {
      const now = new Date();
      const start = scoreTimeRange === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) : scoreTimeRange === 'month' ? startOfMonth(now) : startOfMonth(subMonths(now, 2));
      scores = scores.filter(score => { const date = parseISO(score.dateTaken); return isValid(date) && date >= start && date <= now; });
    }
    return scores;
  }, [scoreBreakdown, scoreSubjectFilter, scoreTimeRange]);

  // Calculate trend indicator
  const scoreTrend = useMemo(() => {
    if (filteredScores.length < 3) return null;
    const recent = filteredScores.slice(0, 3);
    const avgRecent = recent.reduce((sum, e) => sum + e.score, 0) / recent.length;
    const older = filteredScores.slice(3, 6);
    if (older.length === 0) return null;
    const avgOlder = older.reduce((sum, e) => sum + e.score, 0) / older.length;
    
    const diff = avgRecent - avgOlder;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }, [filteredScores]);

  // Calculate filtered average
  const filteredAverage = useMemo(() => {
    if (filteredScores.length === 0) return 0;
    return Math.round(filteredScores.reduce((sum, e) => sum + e.score, 0) / filteredScores.length);
  }, [filteredScores]);

  const getTitle = () => {
    switch (type) {
      case 'exams': return 'Exams Taken';
      case 'scores': return 'Score Breakdown';
      case 'study-hours': return 'Study Hours';
      case 'streak': return 'Day Streak';
      default: return '';
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case 'exams': return `${completedExams.length} exams in total`;
      case 'scores': return `Based on ${scoreBreakdown.length} released exams`;
      case 'study-hours': return 'Track your study activity';
      case 'streak': return 'Keep your momentum going';
      default: return '';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'exams': return FileText;
      case 'scores': return TrendingUp;
      case 'study-hours': return Clock;
      case 'streak': return Flame;
      default: return FileText;
    }
  };

  const Icon = getIcon();

  const renderContent = () => {
    if (error) return <div role="alert" className="rounded-2xl border border-border bg-panel p-5"><p className="text-sm">{error}</p>{onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}><RotateCcw className="mr-2 h-4 w-4" />Try again</Button>}</div>;
    if (loading && (type === 'exams' || type === 'scores')) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full bg-muted/30" />
          ))}
        </div>
      );
    }

    switch (type) {
      case 'exams':
        return renderExamsContent();
      case 'scores':
        return renderScoresContent();
      case 'study-hours':
        return <StudyHoursPanel sessions={studySessions} period={studyPeriod} onChange={onStudyPeriodChange} loading={loading} />;
      case 'streak':
        return <StreakPanel data={streakData} month={streakMonth} onMonthChange={onStreakMonthChange} loading={loading} />;
      default:
        return null;
    }
  };

  const renderExamsContent = () => {
    return (
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search exams..."
              value={examSearch}
              onChange={(e) => setExamSearch(e.target.value)}
              className="pl-9 bg-muted/20 border-border/20 focus:border-primary/50"
            />
          </div>
          <Select value={examSort} onValueChange={(v) => setExamSort(v as ExamSortOption)}>
            <SelectTrigger className="w-[140px] bg-muted/20 border-border/20">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border-border/20">
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={examFilter === opt.value ? "default" : "outline"}
              className={`h-7 text-xs px-3 ${
                examFilter === opt.value 
                  ? '' 
                  : 'bg-muted/20 border-border/20 hover:bg-muted/40'
              }`}
              onClick={() => setExamFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <SubtleDivider />

        {/* Exam List */}
        {filteredExams.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {examSearch ? 'No exams match your search' : 'No exams yet'}
            </p>
            {!examSearch && (
              <Button className="mt-4" onClick={() => navigate('/upload')}>
                Take a Practice Exam
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExams.map((exam) => (
              <div 
                key={exam.id} 
                className="group p-3 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors border border-border/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{exam.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] h-5 bg-muted/30 border-border/20">
                        {exam.subject}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{isValid(parseISO(exam.dateTaken)) ? format(parseISO(exam.dateTaken), 'd MMM yyyy') : '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.isReleased ? (
                      <Badge 
                        variant="default" 
                        className={`text-xs ${
                          exam.score >= 70 ? 'bg-success/10 text-success border-success/30' :
                          exam.score >= 50 ? 'bg-warning/10 text-warning border-warning/30' :
                          'bg-danger/10 text-danger border-danger/30'
                        }`}
                      >
                        {Math.round(exam.score)}%
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-muted/50">
                        {exam.status === 'marking_failed' ? 'Marking incomplete' : 'Awaiting marks'}
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100"
                      aria-label={`Review ${exam.title}`}
                      onClick={() => navigate(`/exam/${exam.id}/review`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderScoresContent = () => {
    return (
      <div className="space-y-4">
        {/* Time Range + Subject Filter */}
        <div className="flex gap-2">
          <Select value={scoreTimeRange} onValueChange={(v) => setScoreTimeRange(v as TimeRangeOption)}>
            <SelectTrigger className="flex-1 bg-muted/20 border-border/20">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border-border/20">
              {TIME_RANGE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scoreSubjectFilter} onValueChange={setScoreSubjectFilter}>
            <SelectTrigger className="flex-1 bg-muted/20 border-border/20">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border/20">
              <SelectItem value="all">All Subjects</SelectItem>
              {uniqueSubjects.map(subj => (
                <SelectItem key={subj} value={subj}>{subj}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Average Score Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">{filteredScores.length ? `${filteredAverage}%` : '—'}</p>
                  <p className="text-xs text-muted-foreground">Average Score</p>
                </div>
              </div>
              {scoreTrend && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  scoreTrend === 'improving' ? 'bg-success/10 text-success' :
                  scoreTrend === 'declining' ? 'bg-danger/10 text-danger' :
                  'bg-muted/30 text-muted-foreground'
                }`}>
                  {scoreTrend === 'improving' && <TrendingUp className="w-3 h-3" />}
                  {scoreTrend === 'declining' && <TrendingDown className="w-3 h-3" />}
                  {scoreTrend === 'stable' && <Minus className="w-3 h-3" />}
                  <span className="capitalize">{scoreTrend}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {excludedCount > 0 && (
          <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg flex items-center gap-2">
            <Timer className="w-3.5 h-3.5" />
            {excludedCount} exam{excludedCount > 1 ? 's' : ''} awaiting mark release
          </p>
        )}

        <SubtleDivider />

        {/* Score Breakdown */}
        <div className="space-y-2">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Score Breakdown</h4>
          {filteredScores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No scores to display</p>
          ) : (
            filteredScores.map((exam) => (
              <div 
                key={exam.id} 
                className="group flex items-center justify-between p-3 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors border border-border/10"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{exam.title}</p>
                  <p className="text-[10px] text-muted-foreground">{isValid(parseISO(exam.dateTaken)) ? format(parseISO(exam.dateTaken), 'd MMM yyyy') : '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${
                      exam.score >= 70 ? 'text-success' :
                      exam.score >= 50 ? 'text-warning' :
                      'text-danger'
                    }`}>{Math.round(exam.score)}%</p>
                    <p className="text-[10px] text-muted-foreground">{exam.earnedMarks}/{exam.totalMarks}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100"
                    aria-label={`Review ${exam.title}`}
                    onClick={() => navigate(`/exam/${exam.id}/review`)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden border-l-border bg-background p-0 sm:max-w-xl motion-reduce:animate-none" {...swipe}>
        <SheetHeader className="shrink-0 px-5 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] text-left sm:px-7">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground"><span>Your progress</span><span aria-hidden="true">·</span><span>{sectionIndex + 1} of 4</span></div>
          <SheetTitle className="flex items-center gap-2.5 pr-8 text-xl tracking-tight">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            {getTitle()}
          </SheetTitle>
          <SheetDescription className="pt-1 text-xs text-muted-foreground">{getSubtitle()}</SheetDescription>
        </SheetHeader>
        <nav className="mx-5 mb-4 flex shrink-0 items-center gap-1 rounded-2xl bg-muted/60 p-1 sm:mx-7" aria-label="Stats sections">
          {STATS_SECTIONS.map((section, index) => <button type="button" key={section} aria-label={sectionLabels[index]} aria-current={type === section ? 'page' : undefined} onClick={() => onNavigate(section)} className={`min-h-10 flex-1 rounded-xl px-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${type === section ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{['Exams', 'Scores', 'Hours', 'Streak'][index]}</button>)}
        </nav>
        <div className="flex shrink-0 items-center justify-between border-y border-border/70 px-5 py-1 sm:px-7">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`Previous section${sectionIndex > 0 ? `: ${sectionLabels[sectionIndex - 1]}` : ''}`} disabled={sectionIndex === 0} onClick={() => onNavigate(STATS_SECTIONS[sectionIndex - 1])}><ChevronLeft className="h-4 w-4" /></Button>
          <p className="text-[10px] text-muted-foreground">{isMobile ? 'Swipe left for previous · right for next' : 'Explore your study progress'}</p>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`Next section${sectionIndex < 3 ? `: ${sectionLabels[sectionIndex + 1]}` : ''}`} disabled={sectionIndex === 3} onClick={() => onNavigate(STATS_SECTIONS[sectionIndex + 1])}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <p className="sr-only" role="status">{type ? `${getTitle()}, section ${sectionIndex + 1} of 4` : ''}</p>
        <div ref={scrollRef} className="stats-detail-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-7" style={{ touchAction: 'pan-y pinch-zoom' }} aria-label={`${getTitle()} details`}>
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
