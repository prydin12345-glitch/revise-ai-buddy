import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Loader2, TrendingUp, TrendingDown, BookOpen, AlertTriangle } from "lucide-react";
import { useUnifiedTopicPerformance } from "@/hooks/useUnifiedTopicPerformance";

interface StudentProfileData {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  student_code: string | null;
  avgScore?: number;
  totalExams?: number;
  recentTrend?: "up" | "down" | "stable";
}

interface StudentProfileTooltipProps {
  studentId: string;
  children: React.ReactNode;
}

export const StudentProfileTooltip = ({ studentId, children }: StudentProfileTooltipProps) => {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Only activate the unified hook when hovered to avoid unnecessary queries
  const { weakTopics } = useUnifiedTopicPerformance(hovered ? studentId : null);

  const fetchStudentProfile = async () => {
    if (profile) return;
    setHovered(true);
    
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("display_name, first_name, last_name, student_code")
        .eq("id", studentId)
        .single();

      const { data: submissions } = await supabase
        .from("exam_submissions")
        .select("total_score, total_marks, submitted_at")
        .eq("student_id", studentId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(10);

      let avgScore = 0;
      let recentTrend: "up" | "down" | "stable" = "stable";
      
      if (submissions && submissions.length > 0) {
        const scores = submissions
          .filter(s => s.total_score !== null && s.total_marks !== null && s.total_marks > 0)
          .map(s => (s.total_score! / s.total_marks!) * 100);
        
        if (scores.length > 0) {
          avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          
          if (scores.length >= 3) {
            const recent = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
            const older = scores.slice(3).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 3);
            if (recent > older + 5) recentTrend = "up";
            else if (recent < older - 5) recentTrend = "down";
          }
        }
      }

      setProfile({
        ...profileData,
        avgScore: Math.round(avgScore),
        totalExams: submissions?.length || 0,
        recentTrend,
      });
    } catch (error) {
      console.error("Error fetching student profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild onMouseEnter={fetchStudentProfile}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-3" side="top" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="space-y-2">
            <div>
              <h4 className="font-medium text-sm">
                {profile.first_name} {profile.last_name}
              </h4>
              {profile.student_code && (
                <p className="text-xs text-muted-foreground font-mono">{profile.student_code}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  {profile.avgScore}%
                  {profile.recentTrend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                  {profile.recentTrend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Exams Taken</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {profile.totalExams}
                </p>
              </div>
            </div>

            {/* Real weak topics from unified hook */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3" />
                Weak Topics
              </p>
              {weakTopics.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">None identified yet</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {weakTopics.slice(0, 3).map((topic) => (
                    <span key={topic.topic} className="text-xs px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">
                      {topic.topic} ({topic.unifiedScore}%)
                    </span>
                  ))}
                  {weakTopics.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{weakTopics.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Unable to load profile</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};
