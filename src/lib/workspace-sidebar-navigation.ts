import { BarChart3, BookOpen, LayoutDashboard, LibraryBig, MessageCircle, TrendingUp, User, Users } from "lucide-react";

/** Keep the desktop sidebar and legacy navigation drawer on the same destinations. */
export function workspaceSidebarItems(tutor = false) {
  return tutor ? [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", section: "main" },
    { icon: LibraryBig, label: "Practice Library", path: "/tutor/exams", section: "main" },
    { icon: User, label: "Students", path: "/tutor/students", section: "main" },
    { icon: MessageCircle, label: "Feedback", path: "/tutor/feedback", section: "learning" },
    { icon: BarChart3, label: "Student Progress", path: "/tutor/progress", section: "learning" },
  ] : [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", section: "main" },
    { icon: LibraryBig, label: "Practice Library", path: "/my-exams", section: "main" },
    { icon: Users, label: "My Classes", path: "/my-classes", section: "main" },
    { icon: BookOpen, label: "My Subjects", path: "/my-subjects", section: "learning" },
    { icon: TrendingUp, label: "My Progress", path: "/stats", section: "learning" },
  ];
}

export function isSidebarDestinationActive(pathname: string, destination: string) {
  if (destination === "/my-exams") return pathname === "/my-exams" || pathname === "/quizzes";
  if (destination === "/tutor/exams") return pathname === "/tutor/exams" || pathname === "/tutor/practice";
  return pathname === destination;
}

/** Restore only a library destination belonging to this sidebar's role. */
export function sidebarDestinationPath(destination: string, rememberedLibrary?: string) {
  if (destination !== "/my-exams" && destination !== "/tutor/exams") return destination;
  const rememberedPath = rememberedLibrary?.split(/[?#]/, 1)[0];
  return rememberedPath && isSidebarDestinationActive(rememberedPath, destination) ? rememberedLibrary! : destination;
}
