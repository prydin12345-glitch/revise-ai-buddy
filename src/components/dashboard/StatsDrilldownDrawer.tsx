import { useState, useMemo, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  MessageSquare,
  Layers,
  Info,
  TrendingDown,
  Minus,
  CheckCircle2,
  Timer,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";

export type DrilldownType = 'exams' | 'scores' | 'study-hours' | 'streak' | null;

interface ExamItem {
  id: string;
  title: string;
  subject: string;
  dateTaken: string;
  score: number;
  totalMarks: number;
  earnedMarks: number;
  isReleased: boolean;
  status?: string;
}

interface StudySession {
  id: string;
  date: string;
  duration: number;
  source: string;
  subject?: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
  recentActivity: { date: string; hasActivity: boolean }[];
  todayActivity: string[];
}

interface StatsDrilldownDrawerProps {
  type: DrilldownType;
  onClose: () => void;
  loading?: boolean;
  completedExams?: ExamItem[];
  averageScore?: number;
  scoreBreakdown?: ExamItem[];
  excludedCount?: number;
  totalHours?: number;
  studySessions?: StudySession[];
  weeklyBreakdown?: { day: string; hours: number }[];
  streakData?: StreakData;
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
  loading = false,
  completedExams = [],
  averageScore = 0,
  scoreBreakdown = [],
  excludedCount = 0,
  totalHours = 0,
  studySessions = [],
  weeklyBreakdown = [],
  streakData,
}: StatsDrilldownDrawerProps) => {
  const navigate = useNavigate();
  const isOpen = type !== null;

  // Exams drawer state
  const [examSearch, setExamSearch] = useState('');
  const [examSort, setExamSort] = useState<ExamSortOption>('recent');
  const [examFilter, setExamFilter] = useState<ExamFilterOption>('all');
  
  // Scores drawer state
  const [scoreTimeRange, setScoreTimeRange] = useState<TimeRangeOption>('all');
  const [scoreSubjectFilter, setScoreSubjectFilter] = useState<string>('all');
  
  // Study hours drawer state
  const [studyTimeRange, setStudyTimeRange] = useState<TimeRangeOption>('week');

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
    
    // TODO: Filter by time range when date parsing is reliable
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
    if (loading) {
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
        return renderStudyHoursContent();
      case 'streak':
        return renderStreakContent();
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
                      <span className="text-[10px] text-muted-foreground">{exam.dateTaken}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.isReleased ? (
                      <Badge 
                        variant="default" 
                        className={`text-xs ${
                          exam.score >= 70 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          exam.score >= 50 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                          'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}
                      >
                        {Math.round(exam.score)}%
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-muted/50">
                        Awaiting
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100"
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
                  <p className="text-3xl font-bold text-primary">{filteredAverage}%</p>
                  <p className="text-xs text-muted-foreground">Average Score</p>
                </div>
              </div>
              {scoreTrend && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  scoreTrend === 'improving' ? 'bg-green-500/10 text-green-400' :
                  scoreTrend === 'declining' ? 'bg-red-500/10 text-red-400' :
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
                  <p className="text-[10px] text-muted-foreground">{exam.dateTaken}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${
                      exam.score >= 70 ? 'text-green-400' :
                      exam.score >= 50 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>{Math.round(exam.score)}%</p>
                    <p className="text-[10px] text-muted-foreground">{exam.earnedMarks}/{exam.totalMarks}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100"
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

  const renderStudyHoursContent = () => {
    // Category breakdown (even if 0)
    const categories = [
      { icon: FileText, label: 'Exams', hours: studySessions.filter(s => s.source === 'exam').reduce((sum, s) => sum + s.duration, 0) / 60 },
      { icon: Zap, label: 'Practice Questions', hours: studySessions.filter(s => s.source === 'practice').reduce((sum, s) => sum + s.duration, 0) / 60 },
      { icon: MessageSquare, label: 'Reviewing Feedback', hours: studySessions.filter(s => s.source === 'feedback').reduce((sum, s) => sum + s.duration, 0) / 60 },
      { icon: Layers, label: 'Revision Tasks', hours: studySessions.filter(s => s.source === 'revision').reduce((sum, s) => sum + s.duration, 0) / 60 },
    ];

    return (
      <div className="space-y-4">
        {/* Time Range Selector */}
        <Select value={studyTimeRange} onValueChange={(v) => setStudyTimeRange(v as TimeRangeOption)}>
          <SelectTrigger className="w-full bg-muted/20 border-border/20">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border-border/20">
            {TIME_RANGE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Total Hours Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{totalHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">
                  {studyTimeRange === 'week' ? 'This Week' : 
                   studyTimeRange === 'month' ? 'This Month' :
                   studyTimeRange === '3months' ? 'Last 3 Months' : 'All Time'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <SubtleDivider />

        {/* Category Breakdown */}
        <div className="space-y-2">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">By Category</h4>
          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat.label} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/10 border border-border/10">
                <div className="flex items-center gap-2.5">
                  <cat.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{cat.label}</span>
                </div>
                <span className={`text-sm font-medium ${cat.hours > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {cat.hours > 0 ? `${cat.hours.toFixed(1)}h` : '0h 0m'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <SubtleDivider />

        {/* Daily Breakdown - Mini Bar Chart */}
        <div className="space-y-2">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Daily Breakdown</h4>
          <div className="flex gap-1 items-end h-24">
            {weeklyBreakdown.map((day) => {
              const maxHours = Math.max(...weeklyBreakdown.map(d => d.hours), 1);
              const heightPercent = Math.max(8, (day.hours / maxHours) * 100);
              
              return (
                <TooltipProvider key={day.day}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className={`w-full rounded-t transition-all ${
                            day.hours > 0 ? 'bg-primary' : 'bg-muted/30'
                          }`}
                          style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                        />
                        <span className="text-[10px] text-muted-foreground">{day.day.slice(0, 2)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-background border-border/20">
                      <p>{day.day}: {day.hours > 0 ? `${day.hours.toFixed(1)}h` : '0m'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {/* Start Study Session Button (Coming Soon) */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                className="w-full mt-4" 
                variant="outline" 
                disabled
              >
                <Timer className="w-4 h-4 mr-2" />
                Start Study Session
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-background border-border/20">
              <p>Coming soon</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  const renderStreakContent = () => {
    const streak = streakData || { currentStreak: 0, longestStreak: 0, recentActivity: [], todayActivity: [] };
    
    // Generate last 14 days
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const activity = streak.recentActivity?.find(a => a.date === dateStr);
      return {
        date: format(date, 'd'),
        dayName: format(date, 'EEE'),
        fullDate: format(date, 'MMM d'),
        hasActivity: activity?.hasActivity || false,
        isToday: i === 13,
      };
    });

    // Calculate next milestone
    const currentStreakVal = streak.currentStreak;
    const milestones = [7, 14, 30, 60, 100];
    const nextMilestone = milestones.find(m => m > currentStreakVal);

    return (
      <div className="space-y-4">
        {/* Streak Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-orange-500/10 border-orange-500/20">
            <CardContent className="p-4 text-center">
              <Flame className="w-7 h-7 mx-auto mb-1.5 text-orange-500" />
              <p className="text-2xl font-bold text-orange-500">{streak.currentStreak}</p>
              <p className="text-[10px] text-muted-foreground">Current Streak</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Trophy className="w-7 h-7 mx-auto mb-1.5 text-primary" />
              <p className="text-2xl font-bold text-primary">{streak.longestStreak}</p>
              <p className="text-[10px] text-muted-foreground">Longest Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Streak Rules Info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/10 border border-border/10">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Complete a practice question, submit an exam, or reply to feedback to maintain your streak.
          </p>
        </div>

        <SubtleDivider />

        {/* Activity Calendar with Legend */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Last 14 Days</h4>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>Active</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-primary/20 ring-1 ring-primary" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-muted/30" />
                <span>Inactive</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {last14Days.map((day, i) => (
              <TooltipProvider key={i}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center">
                      <div 
                        className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          day.hasActivity 
                            ? 'bg-orange-500 text-white' 
                            : day.isToday 
                              ? 'bg-primary/20 text-primary ring-2 ring-primary' 
                              : 'bg-muted/20 text-muted-foreground'
                        }`}
                      >
                        {day.date}
                      </div>
                      <p className="text-[9px] mt-1 text-muted-foreground">{day.dayName}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-background border-border/20">
                    <p>{day.fullDate}: {day.hasActivity ? 'Active' : 'No activity'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        <SubtleDivider />

        {/* History Section */}
        <div className="space-y-2">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">History</h4>
          <div className="space-y-1.5">
            {streak.lastActiveDate && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/10 border border-border/10">
                <span className="text-sm text-muted-foreground">Last activity</span>
                <span className="text-sm font-medium">
                  {format(new Date(streak.lastActiveDate), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            {nextMilestone && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/10 border border-border/10">
                <span className="text-sm text-muted-foreground">Next milestone</span>
                <span className="text-sm font-medium">{nextMilestone} days</span>
              </div>
            )}
          </div>
        </div>

        <SubtleDivider />

        {/* Today's Activity */}
        <div className="space-y-2">
          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
            Today's Activity
          </h4>
          {streak.todayActivity.length > 0 ? (
            <div className="space-y-1.5">
              {streak.todayActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <p className="text-sm">{activity}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/10 border border-border/10">
              <p className="text-sm text-muted-foreground">
                No activity today. Complete a practice question or exam to keep your streak going!
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md border-l-border/10 bg-background/95 backdrop-blur-sm">
        <SheetHeader className="pb-4 space-y-1">
          <SheetTitle className="flex items-center gap-2.5 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            {getTitle()}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{getSubtitle()}</p>
        </SheetHeader>
        <SubtleDivider />
        <ScrollArea className="h-[calc(100vh-140px)] pr-4">
          {renderContent()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
