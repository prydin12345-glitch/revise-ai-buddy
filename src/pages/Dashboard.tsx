import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StudentDashboardContent } from "@/components/dashboard/StudentDashboardContent";
import { TeacherDashboardContent } from "@/components/dashboard/TeacherDashboardContent";
import { TutorDashboardContent } from "@/components/dashboard/TutorDashboardContent";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-client";
import { workspaceUserQuery } from "@/lib/workspace-query-client";
import { PageSkeleton } from "@/components/PageSkeleton";
import { LoadError } from "@/components/shared/ListFeedback";

const Dashboard = () => {
  const navigate = useNavigate();
  const { store, client } = useWorkspaceQueryScope();
  const user = useQuery(workspaceUserQuery(store), client);
  const { primaryRole, loading: roleLoading, error: roleError, retry: retryRole } = useUserRole();
  useEffect(() => { if (!user.isPending && !user.data && !user.error) navigate("/auth?mode=login"); }, [user.isPending, user.data, user.error, navigate]);
  if (user.isPending || roleLoading) return <PageSkeleton />;
  if (user.error || roleError) return <div className="mx-auto max-w-xl p-6"><LoadError message="Couldn’t load your account. Please retry." onRetry={() => { void user.refetch(); void retryRole(); }} /></div>;
  if (!user.data) return null;
  const content = primaryRole === "teacher" ? <TeacherDashboardContent userEmail={user.data.email || "User"} /> : primaryRole === "tutor" ? <TutorDashboardContent /> : <StudentDashboardContent userEmail={user.data.email || "User"} />;
  return <DashboardLayout>{content}</DashboardLayout>;
};
export default Dashboard;
