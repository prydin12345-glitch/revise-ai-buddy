import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageSkeleton } from "@/components/PageSkeleton";

const BYPASS_PATHS = ["/onboarding", "/auth", "/"];

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      // Skip check on bypass paths
      if (BYPASS_PATHS.some((p) => location.pathname.startsWith(p) && p !== "/" || location.pathname === p)) {
        setChecking(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setChecking(false);
        return;
      }

      const { data } = await supabase
        .from("user_onboarding_status")
        .select("subjects_completed, goals_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      // If no onboarding record or subjects not completed, redirect
      if (!data || !data.subjects_completed) {
        setNeedsOnboarding(true);
      }

      setChecking(false);
    };

    check();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (checking) return <PageSkeleton />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};
