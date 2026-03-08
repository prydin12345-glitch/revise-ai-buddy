import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StudentDashboardContent } from "@/components/dashboard/StudentDashboardContent";
import { TeacherDashboardContent } from "@/components/dashboard/TeacherDashboardContent";
import { TutorDashboardContent } from "@/components/dashboard/TutorDashboardContent";
import { Session } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { GraduationCap, BookOpen, Users, CheckCircle2 } from "lucide-react";

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { primaryRole, loading: roleLoading } = useUserRole();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth?mode=login");
        }
      }
    );

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
      case "teacher": return BookOpen;
      case "tutor": return Users;
      default: return GraduationCap;
    }
  };

  const getRoleLabel = () => {
    switch (primaryRole) {
      case "teacher": return "Teacher";
      case "tutor": return "Tutor";
      case "admin": return "Admin";
      default: return "Student";
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

  const userName = session.user.user_metadata?.full_name 
    || session.user.email?.split('@')[0] 
    || 'User';

  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto px-0 sm:px-0" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Welcome Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
              borderRadius: 10,
              borderLeft: '4px solid #3b82f6',
              padding: '20px 24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle decorative glow */}
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 120, height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: 'rgba(59,130,246,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <RoleIcon style={{ width: 24, height: 24, color: '#3b82f6' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 600, color: '#f1f5f9', margin: 0, lineHeight: 1.3 }}>
                  Welcome back, {userName}
                </h1>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Let's make today count — pick up where you left off.
                </p>
                <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 style={{ width: 13, height: 13, color: '#3b82f6' }} />
                  Logged in as {getRoleLabel()}
                </p>
              </div>
            </div>
          </div>

          {renderDashboardContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;