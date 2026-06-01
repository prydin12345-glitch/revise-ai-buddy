// Routing wrapper around MobileTabBar — derives active tab from current
// path and navigates on tap. Only used by students; tutors keep the
// existing MobileNavFAB drawer.
import { useLocation, useNavigate } from "react-router-dom";
import MobileTabBar, { type TabKey } from "./MobileTabBar";

const ROUTE_FOR_TAB: Record<TabKey, string> = {
  home: "/dashboard",
  exams: "/my-exams",
  quizzes: "/quizzes",
  classes: "/my-classes",
  profile: "/settings",
};

function activeTabFor(pathname: string): TabKey {
  if (pathname.startsWith("/my-exams") || pathname.startsWith("/exam")) return "exams";
  if (pathname.startsWith("/quizzes") || pathname.startsWith("/practice")) return "quizzes";
  if (pathname.startsWith("/my-classes")) return "classes";
  if (pathname.startsWith("/settings")) return "profile";
  return "home";
}

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <MobileTabBar
      active={activeTabFor(pathname)}
      onNavigate={(k) => navigate(ROUTE_FOR_TAB[k])}
    />
  );
}
