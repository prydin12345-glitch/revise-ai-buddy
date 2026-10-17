import { useEffect, useState } from "react";

export type StudyPeriod = "morning" | "afternoon" | "evening";

/** Match the existing greeting boundaries in the student's device-local time. */
export function getStudyPeriod(now = new Date()): StudyPeriod {
  const hour = now.getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

export function useStudyPeriod(): StudyPeriod {
  const [period, setPeriod] = useState(getStudyPeriod);

  useEffect(() => {
    let timer: number;
    const refresh = () => {
      const now = new Date();
      setPeriod(getStudyPeriod(now));
      const next = new Date(now);
      next.setHours(now.getHours() < 12 ? 12 : now.getHours() < 18 ? 18 : 24, 0, 0, 0);
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, next.getTime() - now.getTime() + 50);
    };

    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return period;
}
