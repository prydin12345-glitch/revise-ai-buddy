import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StudentDashboardContent } from "@/components/dashboard/StudentDashboardContent";
import { TeacherDashboardContent } from "@/components/dashboard/TeacherDashboardContent";
import { TutorDashboardContent } from "@/components/dashboard/TutorDashboardContent";
import { Session } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { GraduationCap, BookOpen, Users } from "lucide-react";

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();

  useEffect(() => {
    // Listen for explicit sign-out only. Supabase fires many events
    // (INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED) and treating any
    // falsy session as a logout can bounce the user back to /auth during
    // a momentary refresh race right after login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (event === "SIGNED_OUT") {
          navigate("/auth?mode=login");
        }
      }
    );

    // Initial session check — only redirect if truly no session.
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
        return <TeacherDashboardContent userEmail={session.user.email || "User"} />;
      case "tutor":
        return <TutorDashboardContent />;
      default:
        return <StudentDashboardContent userEmail={session.user.email || "User"} />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboardContent()}
    </DashboardLayout>
  );
};

export default Dashboard;
