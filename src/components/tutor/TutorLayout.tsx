import { LoadError } from "@/components/shared/ListFeedback";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Loader2 } from "lucide-react";

interface TutorLayoutProps {
  children: React.ReactNode;
}

export const TutorLayout = ({ children }: TutorLayoutProps) => {
  const { primaryRole, loading, error, retry } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !error && primaryRole !== "tutor") {
      console.log("TutorLayout: User is not a tutor, redirecting to dashboard");
      navigate("/dashboard");
    }
  }, [loading, error, primaryRole, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) return <div className="mx-auto max-w-xl p-6"><LoadError message="Couldn’t check your role. Please retry." onRetry={() => void retry()} /></div>;

  if (primaryRole !== "tutor") {
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};
