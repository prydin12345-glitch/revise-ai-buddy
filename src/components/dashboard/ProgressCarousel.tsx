import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";
import { AlertTriangle, CheckCircle2, TrendingUp, Activity, ChevronLeft, ChevronRight } from "lucide-react";

interface ScoreHistoryItem {
  month: string;
  avgScore: number;
  color: string;
}

interface ProgressCarouselProps {
  weakTopics: UnifiedTopicScore[];
  subjects: { subject_name: string; subject_color: string }[];
  getSubjectColor: (name: string) => string;
  studyActivityData: any[];
  scoreHistory?: ScoreHistoryItem[];
}

const SLIDE_DURATION = 12000;

const SLIDES = ['score_trends', 'weak_topics', 'subject_breakdown', 'recent_activity'] as const;

const SLIDE_LABELS: Record<typeof SLIDES[number], string> = {
  score_trends: 'Score trends · Last 7 months',
  weak_topics: 'Weak topics · Needs attention',
  subject_breakdown: 'Subject breakdown · All subjects',
  recent_activity: 'Recent activity · Last 30 days',
};

const SLIDE_DESTINATIONS: Record<typeof SLIDES[number], string> = {
  score_trends: '/stats?tab=stats',
  weak_topics: '/stats?tab=weak-topics',
  subject_breakdown: '/stats?tab=stats',
  recent_activity: '/stats?tab=stats',
};

export const ProgressCarousel = ({ weakTopics, subjects, getSubjectColor, studyActivityData, scoreHistory = [] }: ProgressCarouselProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const navigate = useNavigate();
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SLIDES.length);
      setAnimKey(k => k + 1);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [isPaused]);

  // Filter subjects to only those with real study data
  const subjectStats = useMemo(() => {
    return subjects.map(s => {
      const totalHours = studyActivityData.reduce((sum, day) => {
        return sum + (Number(day[s.subject_name]) || 0);
      }, 0);
      return { name: s.subject_name, color: s.subject_color, hours: Math.round(totalHours * 10) / 10 };
    }).filter(s => s.hours > 0);
  }, [subjects, studyActivityData]);

  // Only show subjects with real data in score trends
  const subjectsWithData = useMemo(() => {
    return subjects.filter(s => {
      const hasStudyData = studyActivityData.some(day => (Number(day[s.subject_name]) || 0) > 0);
      return hasStudyData;
    });
  }, [subjects, studyActivityData]);

  const maxHours = Math.max(...subjectStats.map(s => s.hours), 1);

  const goToPrev = () => {
    setCurrentSlide(prev => prev === 0 ? SLIDES.length - 1 : prev - 1);
    setIsPaused(true);
    setAnimKey(k => k + 1);
  };

  const goToNext = () => {
    setCurrentSlide(prev => (prev + 1) % SLIDES.length);
    setIsPaused(true);
    setAnimKey(k => k + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      if (delta > 0) goToNext();
      else goToPrev();
      setTimeout(() => setIsPaused(false), 3000);
    }
  };

  return (
    <Card
      className="rounded-2xl border-border/50 overflow-hidden group relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { setIsPaused(false); setAnimKey(k => k + 1); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Arrow navigation — visible on hover */}
      <button
        onClick={goToPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/80 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/80 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">My Progress</h3>
            <p className="text-xs text-muted-foreground">{SLIDE_LABELS[SLIDES[currentSlide]]}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {subjects.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.subject_color }} />
                <span className="text-xs text-muted-foreground hidden sm:inline">{s.subject_name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 mb-4">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentSlide(i); setIsPaused(true); setAnimKey(k => k + 1); }}
              title={`View ${SLIDES[i].replace('_', ' ')} in detail`}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === currentSlide ? 20 : 6,
                height: 6,
                backgroundColor: i === currentSlide ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              }}
            />
          ))}
        </div>

        {/* Slide content — clickable to navigate to stats */}
        <div
          className="min-h-[220px] animate-fade-in cursor-pointer"
          key={`slide-${currentSlide}-${animKey}`}
          onClick={() => navigate(SLIDE_DESTINATIONS[SLIDES[currentSlide]])}
        >
          {currentSlide === 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Score Trends</span>
              </div>
              {subjectsWithData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Add subjects and complete exams to see score trends</p>
              ) : (
                <div className="space-y-3">
                  {subjectsWithData.slice(0, 5).map((s, i) => {
                    // Use actual study hours as a proxy score indicator (no random values)
                    const totalHours = studyActivityData.reduce((sum, day) => sum + (Number(day[s.subject_name]) || 0), 0);
                    const normalised = Math.min(Math.round(totalHours * 20), 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 truncate">{s.subject_name}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${normalised}%`, backgroundColor: s.subject_color }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{normalised}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentSlide === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium">Weak Topics</span>
              </div>
              {weakTopics.length === 0 ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="text-sm text-muted-foreground">No weak topics — great work!</span>
                </div>
              ) : (
                weakTopics.slice(0, 4).map((topic, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex-1 truncate">{topic.topic}</span>
                    <Progress value={topic.unifiedScore} className="w-24 h-2" />
                    <span className="text-xs font-medium w-8 text-right" style={{ 
                      color: topic.unifiedScore < 40 ? 'hsl(var(--destructive))' : 'hsl(var(--warning))'
                    }}>
                      {topic.unifiedScore}%
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {currentSlide === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Study Time by Subject</span>
              </div>
              {subjectStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No study data yet</p>
              ) : (
                subjectStats.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 truncate">{s.name}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(s.hours / maxHours) * 100}%`, backgroundColor: s.color }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">{s.hours}h</span>
                  </div>
                ))
              )}
            </div>
          )}

          {currentSlide === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">This Week's Activity</span>
              </div>
              {studyActivityData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No activity this week</p>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {studyActivityData.map((day, i) => {
                    const dayTotal = Object.entries(day)
                      .filter(([key]) => key !== 'day')
                      .reduce((sum, [_, val]) => sum + (Number(val) || 0), 0);
                    const intensity = Math.min(dayTotal / 3, 1);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full aspect-square rounded-md transition-colors"
                          style={{
                            backgroundColor: intensity > 0 
                              ? `hsl(var(--primary) / ${0.2 + intensity * 0.6})` 
                              : 'hsl(var(--muted))',
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {(day.day as string).slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Click hint */}
        <p className="text-[10px] text-muted-foreground/50 text-right mt-2 italic">
          Click to view full stats →
        </p>

        {/* Progress bar at bottom */}
        <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden">
          <div
            key={`progress-${currentSlide}-${animKey}`}
            className="h-full bg-primary rounded-full"
            style={{
              animation: isPaused ? 'none' : `slideProgress ${SLIDE_DURATION}ms linear forwards`,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
