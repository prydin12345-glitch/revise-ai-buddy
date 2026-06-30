import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, useEffect } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { DelayedFallback } from "@/components/DelayedFallback";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { CookieConsent } from "@/components/CookieConsent";
import { PreferencesApplier } from "@/components/PreferencesApplier";
import { lazyWithReload } from "@/lib/lazy-with-reload";

// Only eagerly load the landing page + auth (first paint)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Everything else is lazy loaded (with stale-chunk auto-recovery)
const Auth = lazyWithReload(() => import("./pages/Auth"));
const ResetPassword = lazyWithReload(() => import("./pages/ResetPassword"));
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Onboarding = lazyWithReload(() => import("./pages/Onboarding"));
const MyExams = lazyWithReload(() => import("./pages/MyExams"));
const CreateExam = lazyWithReload(() => import("./pages/CreateExam"));
const AnalyzeExam = lazyWithReload(() => import("./pages/AnalyzeExam"));
const ExamSettings = lazyWithReload(() => import("./pages/ExamSettings"));
const FormatExam = lazyWithReload(() => import("./pages/FormatExam"));
const TimerSetup = lazyWithReload(() => import("./pages/TimerSetup"));
const ReviewQuestions = lazyWithReload(() => import("./pages/ReviewQuestions"));
const RedirectToReview = lazyWithReload(() => import("./pages/RedirectToReview"));
const ExamInProgress = lazyWithReload(() => import("./pages/ExamInProgress"));
const ExamPreview = lazyWithReload(() => import("./pages/ExamPreview"));
const ExamCover = lazyWithReload(() => import("./pages/ExamCover"));
const ExamReview = lazyWithReload(() => import("./pages/ExamReview"));
const Stats = lazyWithReload(() => import("./pages/Stats"));
const MySubjects = lazyWithReload(() => import("./pages/MySubjects"));
const SubjectDetail = lazyWithReload(() => import("./pages/SubjectDetail"));
const CreatePracticeQuestions = lazyWithReload(() => import("./pages/CreatePracticeQuestions"));
const MyQuizzes = lazyWithReload(() => import("./pages/MyQuizzes"));
const PracticeSetPreview = lazyWithReload(() => import("./pages/PracticeSetPreview"));
const TakePracticeQuiz = lazyWithReload(() => import("./pages/TakePracticeQuiz"));
const QuizCover = lazyWithReload(() => import("./pages/QuizCover"));
const Settings = lazyWithReload(() => import("./pages/Settings"));
const AdminVerifications = lazyWithReload(() => import("./pages/AdminVerifications"));
const MyClasses = lazyWithReload(() => import("./pages/MyClasses"));
const UploadExam = lazyWithReload(() => import("./pages/UploadExam"));
const PreviewExam = lazyWithReload(() => import("./pages/PreviewExam"));
const Pricing = lazyWithReload(() => import("./pages/Pricing"));
const Privacy = lazyWithReload(() => import("./pages/Privacy"));
const Terms = lazyWithReload(() => import("./pages/Terms"));

// Tutor pages
const ManageExams = lazyWithReload(() => import("./pages/tutor/ManageExams"));
const ManagePracticeSets = lazyWithReload(() => import("./pages/tutor/ManagePracticeSets"));
const StudentProgress = lazyWithReload(() => import("./pages/tutor/StudentProgress"));
const CreateTutorExam = lazyWithReload(() => import("./pages/tutor/CreateTutorExam"));
const EditExam = lazyWithReload(() => import("./pages/tutor/EditExam"));
const ManageStudents = lazyWithReload(() => import("./pages/tutor/ManageStudents"));
const ManageFeedback = lazyWithReload(() => import("./pages/tutor/ManageFeedback"));
const ExamHub = lazyWithReload(() => import("./pages/tutor/ExamHub"));
const StudentExamReview = lazyWithReload(() => import("./pages/tutor/StudentExamReview"));
const ManualExamCreator = lazyWithReload(() => import("./pages/tutor/ManualExamCreator"));
const ExamDashboard = lazyWithReload(() => import("./pages/tutor/ExamDashboard"));

// TutorLayout is small, load eagerly for smooth sidebar
import { TutorLayout } from "./components/tutor/TutorLayout";

const queryClient = new QueryClient();

const PageLoader = () => <DelayedFallback />;

const App = () => {
  // Restore theme preference on initial load (before React hydrates)
  useEffect(() => {
    const stored = localStorage.getItem('examly-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <PreferencesApplier />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes — no guard */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Protected routes — onboarding guard */}
              <Route path="/dashboard" element={<OnboardingGuard><Dashboard /></OnboardingGuard>} />
              <Route path="/stats" element={<OnboardingGuard><Stats /></OnboardingGuard>} />
              <Route path="/my-subjects" element={<OnboardingGuard><MySubjects /></OnboardingGuard>} />
              <Route path="/my-subjects/:subjectName" element={<OnboardingGuard><SubjectDetail /></OnboardingGuard>} />
              <Route path="/settings" element={<OnboardingGuard><Settings /></OnboardingGuard>} />
              <Route path="/admin/verifications" element={<OnboardingGuard><AdminVerifications /></OnboardingGuard>} />
              <Route path="/my-exams" element={<OnboardingGuard><MyExams /></OnboardingGuard>} />
              <Route path="/my-classes" element={<OnboardingGuard><MyClasses /></OnboardingGuard>} />
              <Route path="/create-practice-questions" element={<OnboardingGuard><CreatePracticeQuestions /></OnboardingGuard>} />
              <Route path="/quizzes" element={<OnboardingGuard><MyQuizzes /></OnboardingGuard>} />
              <Route path="/practice-questions/:setId/preview" element={<OnboardingGuard><PracticeSetPreview /></OnboardingGuard>} />
              <Route path="/practice-questions/:setId/take" element={<OnboardingGuard><TakePracticeQuiz /></OnboardingGuard>} />
              <Route path="/quizzes/:setId/cover" element={<OnboardingGuard><QuizCover /></OnboardingGuard>} />
              <Route path="/upload" element={<OnboardingGuard><CreateExam /></OnboardingGuard>} />
              
              <Route path="/upload/:draftId/analyze" element={<OnboardingGuard><AnalyzeExam /></OnboardingGuard>} />
              <Route path="/upload/:draftId/review-questions" element={<OnboardingGuard><ReviewQuestions /></OnboardingGuard>} />
              <Route path="/upload/:draftId/settings" element={<OnboardingGuard><ExamSettings /></OnboardingGuard>} />
              <Route path="/upload/:draftId/format" element={<OnboardingGuard><FormatExam /></OnboardingGuard>} />
              <Route path="/upload/:draftId/timer" element={<OnboardingGuard><TimerSetup /></OnboardingGuard>} />
              <Route path="/upload/:draftId/preview" element={<OnboardingGuard><RedirectToReview /></OnboardingGuard>} />
              <Route path="/exam/:examId/preview" element={<OnboardingGuard><ExamPreview /></OnboardingGuard>} />
              <Route path="/exam/:examId/cover" element={<OnboardingGuard><ExamCover /></OnboardingGuard>} />
              <Route path="/exam/:examId/live" element={<OnboardingGuard><ExamInProgress /></OnboardingGuard>} />
              <Route path="/exam/:examId/in-progress" element={<OnboardingGuard><ExamInProgress /></OnboardingGuard>} />
              <Route path="/exam/:examId/review" element={<OnboardingGuard><ExamReview /></OnboardingGuard>} />
              
              {/* Tutor Routes */}
              <Route path="/tutor/exams" element={<OnboardingGuard><TutorLayout><ManageExams /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/exams/create" element={<OnboardingGuard><TutorLayout><CreateTutorExam /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/exams/create-manual" element={<OnboardingGuard><TutorLayout><ManualExamCreator /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/exams/:examId" element={<OnboardingGuard><TutorLayout><ExamHub /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/exams/:examId/edit" element={<OnboardingGuard><TutorLayout><EditExam /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/exams/:examId/student/:studentId" element={<OnboardingGuard><TutorLayout><StudentExamReview /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/practice" element={<OnboardingGuard><TutorLayout><ManagePracticeSets /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/students" element={<OnboardingGuard><TutorLayout><ManageStudents /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/progress" element={<OnboardingGuard><TutorLayout><StudentProgress /></TutorLayout></OnboardingGuard>} />
              <Route path="/tutor/feedback" element={<OnboardingGuard><TutorLayout><ManageFeedback /></TutorLayout></OnboardingGuard>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
