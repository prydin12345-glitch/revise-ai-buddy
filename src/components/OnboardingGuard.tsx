import { useState, useEffect, Fragment } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageSkeleton } from "@/components/PageSkeleton";
import { getSafeRedirectPath } from '@/lib/safe-redirect';
import { LoadError } from '@/components/shared/ListFeedback';
import { useWorkspaceSession } from '@/hooks/use-workspace-session';

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
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const location = useLocation();
  const { ownerId, ready } = useWorkspaceSession();

  useEffect(() => {
    if (!ready) return;
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
        if (cancelled) return;
        setSignedOut(true);
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

      const { data, error: statusError } = await supabase
        .from("user_onboarding_status")
        .select("subjects_completed, goals_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (statusError) throw statusError;

      const requiresOnboarding = !data || !data.subjects_completed;

      // Store in cache
      onboardingStatusCache = {
        userId: user.id,
        needsOnboarding: requiresOnboarding,
        checkedAt: now,
      };

      setNeedsOnboarding(requiresOnboarding);

      setChecking(false);
    };

    setError(false);
    setSignedOut(false);
    void check().catch(() => { if (!cancelled) { setError(true); setChecking(false); } });
    return () => { cancelled = true; };
  }, [location.pathname, retry, ownerId, ready]);

  const next = getSafeRedirectPath(location.pathname + location.search + location.hash, '/dashboard');
  if (checking) return <PageSkeleton />;
  if (error) return <div className="p-6 max-w-xl mx-auto"><LoadError message="Couldn’t check your account. Retry when your connection is available." onRetry={() => { setChecking(true); setRetry(value => value + 1); }} /></div>;
  if (signedOut) return <Navigate to={`/auth?mode=login&next=${encodeURIComponent(next)}`} replace />;
  if (needsOnboarding) return <Navigate to={`/onboarding?next=${encodeURIComponent(next)}`} replace />;
  return <Fragment key={ownerId ?? 'anonymous'}>{children}</Fragment>;
};
