import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface TutorLayoutProps {
  children: React.ReactNode;
}

export const TutorLayout = ({ children }: TutorLayoutProps) => {
  const { primaryRole, loading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && primaryRole !== "tutor") {
      console.log("TutorLayout: User is not a tutor, redirecting to dashboard");
      navigate("/dashboard");
    }
  }, [loading, primaryRole, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (primaryRole !== "tutor") {
    return null;
  }

  return <>{children}</>;
};
