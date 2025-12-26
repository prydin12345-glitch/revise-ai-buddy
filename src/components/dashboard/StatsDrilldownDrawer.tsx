import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Calendar, Clock, Flame, Trophy, FileText, TrendingUp } from "lucide-react";
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
  // Exams data
  completedExams?: ExamItem[];
  // Scores data
  averageScore?: number;
  scoreBreakdown?: ExamItem[];
  excludedCount?: number;
  // Study hours data
  totalHours?: number;
  studySessions?: StudySession[];
  weeklyBreakdown?: { day: string; hours: number }[];
  // Streak data
  streakData?: StreakData;
}

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

  const getTitle = () => {
    switch (type) {
      case 'exams': return 'Completed Exams';
      case 'scores': return 'Score Breakdown';
      case 'study-hours': return 'Study Hours';
      case 'streak': return 'Day Streak';
      default: return '';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'exams': return `${completedExams.length} exams completed`;
      case 'scores': return `Average: ${averageScore}%`;
      case 'study-hours': return `${totalHours.toFixed(1)} hours this week`;
      case 'streak': return `${streakData?.currentStreak || 0} day streak`;
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
            <Skeleton key={i} className="h-20 w-full" />
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
    if (completedExams.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No completed exams yet</p>
          <Button className="mt-4" onClick={() => navigate('/upload')}>
            Take a Practice Exam
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {completedExams.map((exam) => (
          <Card key={exam.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{exam.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{exam.subject}</Badge>
                    <span className="text-xs text-muted-foreground">{exam.dateTaken}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {exam.isReleased ? (
                    <Badge variant="default" className="text-sm">
                      {Math.round(exam.score)}%
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Awaiting Release
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/exam/${exam.id}/review`)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderScoresContent = () => {
    return (
      <div className="space-y-6">
        {/* Average Score Highlight */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-2 text-primary" />
            <p className="text-4xl font-bold text-primary">{averageScore}%</p>
            <p className="text-sm text-muted-foreground">Average Score</p>
          </CardContent>
        </Card>

        {excludedCount > 0 && (
          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Calendar className="w-4 h-4 inline-block mr-2" />
            {excludedCount} exam{excludedCount > 1 ? 's' : ''} awaiting mark release
          </p>
        )}

        {/* Score Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Score Breakdown</h4>
          {scoreBreakdown.map((exam) => (
            <div key={exam.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{exam.title}</p>
                <p className="text-xs text-muted-foreground">{exam.dateTaken}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{Math.round(exam.score)}%</p>
                <p className="text-xs text-muted-foreground">{exam.earnedMarks}/{exam.totalMarks}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStudyHoursContent = () => {
    return (
      <div className="space-y-6">
        {/* Total Hours */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <Clock className="w-10 h-10 mx-auto mb-2 text-primary" />
            <p className="text-4xl font-bold text-primary">{totalHours.toFixed(1)}h</p>
            <p className="text-sm text-muted-foreground">This Week</p>
          </CardContent>
        </Card>

        {/* Weekly Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Daily Breakdown</h4>
          <div className="grid grid-cols-7 gap-1">
            {weeklyBreakdown.map((day) => (
              <div key={day.day} className="text-center">
                <div 
                  className="h-16 rounded-lg flex items-end justify-center transition-colors"
                  style={{ 
                    background: day.hours > 0 
                      ? `linear-gradient(to top, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.3) 100%)` 
                      : 'hsl(var(--muted))' 
                  }}
                >
                  <div 
                    className="w-full bg-primary rounded-lg transition-all"
                    style={{ height: `${Math.min(100, (day.hours / 4) * 100)}%` }}
                  />
                </div>
                <p className="text-xs mt-1 text-muted-foreground">{day.day.slice(0, 2)}</p>
                {day.hours > 0 && (
                  <p className="text-xs font-medium">{day.hours.toFixed(1)}h</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        {studySessions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Recent Sessions</h4>
            {studySessions.slice(0, 5).map((session, i) => (
              <div key={session.id || i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium text-sm capitalize">{session.source}</p>
                  {session.subject && (
                    <Badge variant="outline" className="text-xs mt-1">{session.subject}</Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">{(session.duration / 60).toFixed(1)}h</p>
                  <p className="text-xs text-muted-foreground">{session.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
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
        hasActivity: activity?.hasActivity || false,
        isToday: i === 13,
      };
    });

    return (
      <div className="space-y-6">
        {/* Streak Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-orange-500/10 border-orange-500/20">
            <CardContent className="p-6 text-center">
              <Flame className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <p className="text-3xl font-bold text-orange-500">{streak.currentStreak}</p>
              <p className="text-sm text-muted-foreground">Current Streak</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-3xl font-bold text-primary">{streak.longestStreak}</p>
              <p className="text-sm text-muted-foreground">Longest Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Calendar */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Last 14 Days</h4>
          <div className="grid grid-cols-7 gap-2">
            {last14Days.map((day, i) => (
              <div key={i} className="text-center">
                <div 
                  className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    day.hasActivity 
                      ? 'bg-orange-500 text-white' 
                      : day.isToday 
                        ? 'bg-primary/20 text-primary ring-2 ring-primary' 
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day.date}
                </div>
                <p className="text-[10px] mt-1 text-muted-foreground">{day.dayName}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Activity */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">
            {streak.todayActivity.length > 0 ? "Today's Activity" : "No activity today"}
          </h4>
          {streak.todayActivity.length > 0 ? (
            <div className="space-y-2">
              {streak.todayActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-sm">{activity}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete a practice question or exam to keep your streak going!
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            {getTitle()}
          </SheetTitle>
          <SheetDescription>{getDescription()}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {renderContent()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
