// src/components/dashboard/sampleData.ts
// Placeholder data so you can render the dashboard immediately.
// Replace with your real Supabase hook data (same shapes as types.ts),
// then delete this file.
import {
  FileText, Trophy, Clock, Flame, TrendingUp, ListChecks, Target,
} from "lucide-react";
import type { DashboardData } from "./types";

export const sampleDashboard: DashboardData = {
  profile: { name: "Prydin Asewando", initials: "PA", program: "IB · Year 13" },

  profileStats: [
    { key: "exams",  icon: FileText, value: "8",   label: "Exams Completed",   iconClass: "text-primary" },
    { key: "avg",    icon: Trophy,   value: "73%", label: "Average Score",     iconClass: "text-warning" },
    { key: "hours",  icon: Clock,    value: "24h", label: "Total Study Hours", iconClass: "text-[#a78bfa]" },
    { key: "streak", icon: Flame,    value: "5",   label: "Day Streak",        iconClass: "text-danger" },
  ],

  // User-assigned subject colours
  subjects: [
    { key: "math", name: "Mathematics", color: "#fb7185", pct: 32 },
    { key: "chem", name: "Chemistry",   color: "#34d399", pct: 27 },
    { key: "phys", name: "Physics",     color: "#a78bfa", pct: 23 },
    { key: "eng",  name: "English",     color: "#fbbf24", pct: 18 },
  ],
  averageScore: "73%",

  classes: [
    { id: "c1", title: "Class 1",       teacher: "Tutor",     students: 12, progress: 64, next: "Mock paper due Fri",  subjectTag: "Mathematics", accentColor: "#fb7185", motif: "grid", glyph: TrendingUp },
    { id: "c2", title: "Maths x1",      teacher: "Tutor",     students: 8,  progress: 41, next: "Calculus set · 6 left", subjectTag: "Chemistry",   accentColor: "#34d399", motif: "dots", glyph: ListChecks },
    { id: "c3", title: "IB Physics HL", teacher: "Dr. Vance", students: 21, progress: 78, next: "Mechanics review",    subjectTag: "Physics",     accentColor: "#a78bfa", motif: "wave", glyph: Target },
  ],

  mockExams: [
    { id: "m1", title: "Economics Diagram Test", subject: "Mathematics", color: "#fb7185", score: 33,  status: "in-progress", when: "3 weeks ago" },
    { id: "m2", title: "Economics graphs",       subject: "English",     color: "#fbbf24", score: 0,   status: "not-started",  when: "3 weeks ago" },
    { id: "m3", title: "Mechanics paper 2",      subject: "Physics",     color: "#a78bfa", score: 0,   status: "not-started",  when: "3 weeks ago" },
    { id: "m4", title: "Calculus 2",             subject: "Mathematics", color: "#fb7185", score: 100, status: "done",         when: "1 month ago" },
    { id: "m5", title: "Statistics 12",          subject: "Mathematics", color: "#fb7185", score: 96,  status: "done",         when: "1 month ago" },
  ],

  quizzes: [
    { id: "q1", title: "Algebra Drill",     subject: "Mathematics", color: "#fb7185", questions: 12, best: 88,   when: "2 days ago" },
    { id: "q2", title: "Hard physics test", subject: "Physics",     color: "#a78bfa", questions: 8,  best: 71,   when: "5 days ago" },
    { id: "q3", title: "Titration quiz",    subject: "Chemistry",   color: "#34d399", questions: 10, best: null, when: "new" },
    { id: "q4", title: "Vocabulary set",    subject: "English",     color: "#fbbf24", questions: 15, best: 94,   when: "1 week ago" },
  ],

  announcements: [
    { id: "a1", title: "Christmas test",                       from: "Class 1",  when: "2 days ago" },
    { id: "a2", title: "Mock paper deadline moved to Friday",  from: "Maths x1", when: "5 days ago" },
  ],
};
