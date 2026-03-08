import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trophy, Users, ChevronRight, BarChart3, Clock, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useExamStats } from "@/hooks/useExamStats";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { AnnouncementsFeed } from "./AnnouncementsFeed";
import { StatsDrilldownDrawer, DrilldownType } from "./StatsDrilldownDrawer";
import { ExamRowItem, ExamWithSubmission } from "./ExamRowItem";
import { AllExamsModal } from "./AllExamsModal";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardContentProps {
  userEmail: string;
}

const STAT_ACCENTS = [
  { color: '#3b82f6', icon: FileText, bg: 'rgba(59,130,246,0.10)' },
  { color: '#22c55e', icon: BarChart3, bg: 'rgba(34,197,94,0.10)' },
  { color: '#f97316', icon: Clock, bg: 'rgba(249,115,22,0.10)' },
  { color: '#f43f5e', icon: Flame, bg: 'rgba(244,63,94,0.10)' },
];

export const StudentDashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const { studyActivityData } = useExamStats();
  const drilldown = useStatsDrilldown();
  const { getSubjectColor } = useUserSubjects();
  
  const [exams, setExams] = useState<ExamWithSubmission[]>([]);
  const [allExams, setAllExams] = useState<ExamWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showAllExamsModal, setShowAllExamsModal] = useState(false);

  const totalStudyHours = useMemo(() => {
    return studyActivityData.reduce((total, day) => {
      const dayTotal = Object.entries(day)
        .filter(([key]) => key !== 'day')
        .reduce((sum, [_, hours]) => sum + (hours as number), 0);
      return total + dayTotal;
    }, 0);
  }, [studyActivityData]);

  const completedExamsCount = useMemo(() => {
    return allExams.filter(e => 
      e.submission?.status === 'graded' || 
      e.submission?.status === 'submitted' || 
      e.submission?.status === 'completed'
    ).length;
  }, [allExams]);

  const averageScore = useMemo(() => {
    const gradedExams = allExams.filter(e => e.submission?.status === 'graded' && e.submission.total_marks > 0);
    if (gradedExams.length === 0) return null;
    const total = gradedExams.reduce((acc, e) => {
      const score = (e.submission!.total_score / e.submission!.total_marks) * 100;
      return acc + score;
    }, 0);
    return Math.round(total / gradedExams.length);
  }, [allExams]);

  const stats = [
    { label: "EXAMS TAKEN", value: completedExamsCount.toString(), drilldown: 'exams' as DrilldownType },
    { label: "AVERAGE SCORE", value: averageScore !== null ? `${averageScore}%` : "-", drilldown: 'scores' as DrilldownType },
    { label: "STUDY HOURS", value: studyActivityData.length === 0 ? "..." : (totalStudyHours > 0 ? `${totalStudyHours.toFixed(1)}h` : "0h"), drilldown: 'study-hours' as DrilldownType },
    { label: "DAY STREAK", value: loading ? "..." : currentStreak.toString(), drilldown: 'streak' as DrilldownType },
  ];

  useEffect(() => {
    loadStudentData();
  }, []);

  const loadStudentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_streak, last_exam_submitted_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (streakData?.last_exam_submitted_at) {
        const hoursSince = (Date.now() - new Date(streakData.last_exam_submitted_at).getTime()) / (1000 * 60 * 60);
        setCurrentStreak(hoursSince <= 48 ? streakData.current_streak : 0);
      }

      const { data: ownExams } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: assignments } = await supabase
        .from("exam_assignments")
        .select(`exam_id, deadline, exams (*)`)
        .eq("assignment_type", "all_students")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const assignedExams = assignments?.map(a => ({
        ...(a.exams as any),
        assigned_by: "teacher",
        deadline: a.deadline
      })) || [];

      const examsData = [...(ownExams || []), ...assignedExams];

      const examsWithSubmissions = await Promise.all(
        (examsData || []).map(async (exam) => {
          const { data: submission } = await supabase
            .from("exam_submissions")
            .select("id, total_score, total_marks, status, last_accessed_at")
            .eq("exam_id", exam.id)
            .eq("student_id", user.id)
            .maybeSingle();
          return {
            ...exam,
            submission: submission ? {
              ...submission,
              status: submission.status as 'in_progress' | 'submitted' | 'graded' | 'completed'
            } : undefined,
          };
        })
      );

      const sortedExams = examsWithSubmissions
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAllExams(sortedExams);
      setExams(sortedExams.slice(0, 3));
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="flex-1 h-[52px]" style={{ borderRadius: 10 }} />
          <Skeleton className="flex-1 h-[52px]" style={{ borderRadius: 10 }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" style={{ borderRadius: 10 }} />
          ))}
        </div>
        <Skeleton className="h-60" style={{ borderRadius: 10 }} />
      </div>
    );
  }

  const quickActionCards = [
    { icon: Trophy, title: 'My Progress', subtitle: 'View your performance', path: '/stats', iconBg: '#22c55e' },
    { icon: FileText, title: 'Practice Quizzes', subtitle: 'Test your knowledge', path: '/quizzes', iconBg: '#3b82f6' },
    { icon: Users, title: 'My Classes', subtitle: 'Join tutor groups', path: '/my-classes', iconBg: '#8b5cf6' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate("/upload")}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 10,
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <Upload style={{ width: 18, height: 18 }} />
          Create Mock Exam
        </button>
        <button
          onClick={() => navigate("/create-practice-questions")}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 10,
            background: 'transparent',
            color: '#3b82f6',
            border: '2px solid #3b82f6',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <FileText style={{ width: 18, height: 18 }} />
          Create Practice Questions
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const accent = STAT_ACCENTS[index];
          const Icon = accent.icon;
          return (
            <div
              key={index}
              role="button"
              tabIndex={0}
              aria-label={`View ${stat.label} details`}
              onClick={() => drilldown.openDrawer(stat.drilldown)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drilldown.openDrawer(stat.drilldown); } }}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderLeft: `4px solid ${accent.color}`,
                borderRadius: 10,
                padding: 20,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent.color; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.borderLeftColor = accent.color; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.08em', margin: '0 0 8px 0', fontWeight: 500 }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: 28, fontWeight: 600, color: '#f1f5f9', margin: 0, lineHeight: 1 }}>
                    {stat.value}
                  </p>
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: accent.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0.8,
                }}>
                  <Icon style={{ width: 18, height: 18, color: accent.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.path}
              role="button"
              tabIndex={0}
              onClick={() => navigate(card.path)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(card.path); } }}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '20px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#475569'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `${card.iconBg}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon style={{ width: 20, height: 20, color: card.iconBg }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{card.title}</p>
                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>{card.subtitle}</p>
              </div>
              <ChevronRight style={{ width: 16, height: 16, color: '#475569', flexShrink: 0 }} />
            </div>
          );
        })}
      </div>

      {/* Announcements Feed */}
      <AnnouncementsFeed />

      {/* Recent Exams */}
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Recent Exams</h2>
          {allExams.length > 0 && (
            <button
              onClick={() => setShowAllExamsModal(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
            >
              View All
              <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
        <div style={{ padding: '12px 16px' }}>
          {exams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <FileText style={{ width: 48, height: 48, margin: '0 auto 16px', color: '#334155' }} />
              <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 4px 0' }}>No exams yet</p>
              <p style={{ color: '#475569', fontSize: 12, margin: '0 0 16px 0' }}>Create one or start a practice set to get started.</p>
              <Button onClick={() => navigate("/upload")}>
                Create Your First Exam
              </Button>
            </div>
          ) : (
            <div>
              {exams.map((exam, idx) => (
                <div key={exam.id}>
                  <ExamRowItem 
                    exam={exam}
                    subjectColor={getSubjectColor(exam.subject_id)}
                  />
                  {idx < exams.length - 1 && (
                    <div style={{ height: 1, background: '#334155', margin: '0 4px' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Exams Modal */}
      <AllExamsModal
        open={showAllExamsModal}
        onOpenChange={setShowAllExamsModal}
        exams={allExams}
        loading={false}
        getSubjectColor={getSubjectColor}
      />

      {/* Stats Drilldown Drawer */}
      <StatsDrilldownDrawer
        type={drilldown.activeDrawer}
        onClose={drilldown.closeDrawer}
        loading={drilldown.loading}
        completedExams={drilldown.completedExams}
        averageScore={drilldown.averageScore}
        scoreBreakdown={drilldown.scoreBreakdown}
        excludedCount={drilldown.excludedCount}
        totalHours={drilldown.totalHours}
        studySessions={drilldown.studySessions}
        weeklyBreakdown={drilldown.weeklyBreakdown}
        streakData={drilldown.streakData}
        studyTimeRange={drilldown.studyTimeRange}
        onStudyTimeRangeChange={drilldown.handleStudyTimeRangeChange}
      />
    </div>
  );
};