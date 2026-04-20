import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageSkeleton } from "@/components/PageSkeleton";

const BYPASS_PATHS = ["/onboarding", "/auth", "/"];

// Module-level cache — persists across navigations within the session.
// Avoids re-running 2 Supabase queries on every single route change.
let onboardingStatusCache: {
  userId: string;
  needsOnboarding: boolean;
  checkedAt: number;
} | null = null;

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Subscribe once to clear cache on sign-out
let authListenerInitialized = false;
const initAuthListener = () => {
  if (authListenerInitialized) return;
  authListenerInitialized = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      onboardingStatusCache = null;
    }
  });
};

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    initAuthListener();
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

      // Cache hit — skip the Supabase query entirely
      const now = Date.now();
      if (
        onboardingStatusCache &&
        onboardingStatusCache.userId === user.id &&
        now - onboardingStatusCache.checkedAt < CACHE_DURATION_MS
      ) {
        if (cancelled) return;
        setNeedsOnboarding(onboardingStatusCache.needsOnboarding);
        setChecking(false);
        return;
      }

      const { data } = await supabase
        .from("user_onboarding_status")
        .select("subjects_completed, goals_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const requiresOnboarding = !data || !data.subjects_completed;

      // Store in cache
      onboardingStatusCache = {
        userId: user.id,
        needsOnboarding: requiresOnboarding,
        checkedAt: now,
      };

      if (requiresOnboarding) {
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
