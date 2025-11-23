import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StudentDashboardContent } from "@/components/dashboard/StudentDashboardContent";
import { TeacherDashboardContent } from "@/components/dashboard/TeacherDashboardContent";
import { TutorDashboardContent } from "@/components/dashboard/TutorDashboardContent";
import { Session } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Users, CheckCircle2 } from "lucide-react";

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth?mode=login");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth?mode=login");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getRoleIcon = () => {
    switch (primaryRole) {
      case "teacher":
        return BookOpen;
      case "tutor":
        return Users;
      default:
        return GraduationCap;
    }
  };

  const getRoleLabel = () => {
    switch (primaryRole) {
      case "teacher":
        return "Teacher";
      case "tutor":
        return "Tutor";
      case "admin":
        return "Admin";
      default:
        return "Student";
    }
  };

  const RoleIcon = getRoleIcon();

  const renderDashboardContent = () => {
    switch (primaryRole) {
      case "teacher":
        return <TeacherDashboardContent />;
      case "tutor":
        return <TutorDashboardContent />;
      default:
        return <StudentDashboardContent userEmail={session.user.email || "User"} />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card className="border-2 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <RoleIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl">Welcome back!</div>
                <div className="text-sm text-muted-foreground font-normal flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Logged in as {getRoleLabel()}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {renderDashboardContent()}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
