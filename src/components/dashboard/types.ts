// src/components/dashboard/types.ts
import type { LucideIcon } from "lucide-react";

/** A subject with its USER-ASSIGNED colour (raw hex — this is content, not a theme token). */
export interface Subject {
  key: string;
  name: string;
  color: string; // user-picked hex, used only in the chart + legend
  pct: number;   // share of study time, 0–100 (should sum to ~100)
}

export interface ProfileStat {
  key: string;
  icon: LucideIcon;
  value: string;
  /** Shown on hover (e.g. "Exams Completed"). */
  label: string;
  /** Tailwind text-colour class for the icon, e.g. "text-primary". */
  iconClass: string;
}

export interface ClassItem {
  id: string;
  title: string;
  teacher: string;
  students: number;
  progress: number; // 0–100
  next: string;     // short "next up" line
  subjectTag: string;
  /** Subject colour (content hex) — tints the tag, glyph, progress bar. */
  accentColor: string;
  motif: "grid" | "dots" | "wave";
  glyph: LucideIcon;
}

export interface MockExam {
  id: string;
  title: string;
  subject: string;
  color: string; // subject colour (content hex) for the left bar
  score: number; // 0–100
  status: "done" | "in-progress" | "not-started";
  when: string;
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  color: string;       // subject colour (content hex)
  questions: number;
  best: number | null; // null = never attempted
  when: string;
}

export interface Announcement {
  id: string;
  title: string;
  from: string;
  when: string;
}

export interface StudentProfile {
  name: string;
  initials: string;
  program: string;
}

/** Everything DashboardShell needs. */
export interface DashboardData {
  profile: StudentProfile;
  profileStats: ProfileStat[];
  subjects: Subject[];
  averageScore: string; // donut centre default, e.g. "73%"
  classes: ClassItem[];
  mockExams: MockExam[];
  quizzes: Quiz[];
  announcements: Announcement[];
  // handlers (all optional)
  onCreateExam?: () => void;
  onCreateQuiz?: () => void;
  onCreateClass?: () => void;
  onJoinClass?: () => void;
  onContinue?: (classId: string) => void;
  onOpenExam?: (id: string) => void;
  onStartQuiz?: (id: string) => void;
  onOpenAnnouncement?: (id: string) => void;
}
