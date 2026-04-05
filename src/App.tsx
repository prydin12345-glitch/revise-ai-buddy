import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { OnboardingGuard } from "@/components/OnboardingGuard";

// Only eagerly load the landing page + auth (first paint)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Everything else is lazy loaded
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const MyExams = lazy(() => import("./pages/MyExams"));
const CreateExam = lazy(() => import("./pages/CreateExam"));
const AnalyzeExam = lazy(() => import("./pages/AnalyzeExam"));
const ExamSettings = lazy(() => import("./pages/ExamSettings"));
const FormatExam = lazy(() => import("./pages/FormatExam"));
const TimerSetup = lazy(() => import("./pages/TimerSetup"));
const ReviewQuestions = lazy(() => import("./pages/ReviewQuestions"));
const RedirectToReview = lazy(() => import("./pages/RedirectToReview"));
const ExamInProgress = lazy(() => import("./pages/ExamInProgress"));
const ExamPreview = lazy(() => import("./pages/ExamPreview"));
const ExamReview = lazy(() => import("./pages/ExamReview"));
const Stats = lazy(() => import("./pages/Stats"));
const MySubjects = lazy(() => import("./pages/MySubjects"));
const CreatePracticeQuestions = lazy(() => import("./pages/CreatePracticeQuestions"));
const MyQuizzes = lazy(() => import("./pages/MyQuizzes"));
const PracticeSetPreview = lazy(() => import("./pages/PracticeSetPreview"));
const TakePracticeQuiz = lazy(() => import("./pages/TakePracticeQuiz"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminVerifications = lazy(() => import("./pages/AdminVerifications"));
const MyClasses = lazy(() => import("./pages/MyClasses"));
const UploadExam = lazy(() => import("./pages/UploadExam"));
const PreviewExam = lazy(() => import("./pages/PreviewExam"));

// Tutor pages
const ManageExams = lazy(() => import("./pages/tutor/ManageExams"));
const ManagePracticeSets = lazy(() => import("./pages/tutor/ManagePracticeSets"));
const StudentProgress = lazy(() => import("./pages/tutor/StudentProgress"));
const CreateTutorExam = lazy(() => import("./pages/tutor/CreateTutorExam"));
const EditExam = lazy(() => import("./pages/tutor/EditExam"));
const ManageStudents = lazy(() => import("./pages/tutor/ManageStudents"));
const ManageFeedback = lazy(() => import("./pages/tutor/ManageFeedback"));
const ExamHub = lazy(() => import("./pages/tutor/ExamHub"));
const StudentExamReview = lazy(() => import("./pages/tutor/StudentExamReview"));
const ManualExamCreator = lazy(() => import("./pages/tutor/ManualExamCreator"));
const ExamDashboard = lazy(() => import("./pages/tutor/ExamDashboard"));

// Demo/dev pages — never in main bundle
const GraphTest = lazy(() => import("./pages/GraphTest"));
const MechanicsDemo = lazy(() => import("./pages/MechanicsDemo"));
const CircuitDemo = lazy(() => import("./pages/CircuitDemo"));
const ScienceDiagramDemo = lazy(() => import("./pages/ScienceDiagramDemo"));

// TutorLayout is small, load eagerly for smooth sidebar
import { TutorLayout } from "./components/tutor/TutorLayout";

const queryClient = new QueryClient();

const PageLoader = () => <PageSkeleton />;

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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes — no guard */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Dev/demo pages — no guard */}
              <Route path="/graph-test" element={<GraphTest />} />
              <Route path="/mechanics-demo" element={<MechanicsDemo />} />
              <Route path="/circuit-demo" element={<CircuitDemo />} />
              <Route path="/science-diagrams" element={<ScienceDiagramDemo />} />

              {/* Protected routes — onboarding guard */}
              <Route path="/dashboard" element={<OnboardingGuard><Dashboard /></OnboardingGuard>} />
              <Route path="/stats" element={<OnboardingGuard><Stats /></OnboardingGuard>} />
              <Route path="/my-subjects" element={<OnboardingGuard><MySubjects /></OnboardingGuard>} />
              <Route path="/settings" element={<OnboardingGuard><Settings /></OnboardingGuard>} />
              <Route path="/admin/verifications" element={<OnboardingGuard><AdminVerifications /></OnboardingGuard>} />
              <Route path="/my-exams" element={<OnboardingGuard><MyExams /></OnboardingGuard>} />
              <Route path="/my-classes" element={<OnboardingGuard><MyClasses /></OnboardingGuard>} />
              <Route path="/create-practice-questions" element={<OnboardingGuard><CreatePracticeQuestions /></OnboardingGuard>} />
              <Route path="/quizzes" element={<OnboardingGuard><MyQuizzes /></OnboardingGuard>} />
              <Route path="/practice-questions/:setId/preview" element={<OnboardingGuard><PracticeSetPreview /></OnboardingGuard>} />
              <Route path="/practice-questions/:setId/take" element={<OnboardingGuard><TakePracticeQuiz /></OnboardingGuard>} />
              <Route path="/upload" element={<OnboardingGuard><CreateExam /></OnboardingGuard>} />
              
              <Route path="/upload/:draftId/analyze" element={<OnboardingGuard><AnalyzeExam /></OnboardingGuard>} />
              <Route path="/upload/:draftId/review-questions" element={<OnboardingGuard><ReviewQuestions /></OnboardingGuard>} />
              <Route path="/upload/:draftId/settings" element={<OnboardingGuard><ExamSettings /></OnboardingGuard>} />
              <Route path="/upload/:draftId/format" element={<OnboardingGuard><FormatExam /></OnboardingGuard>} />
              <Route path="/upload/:draftId/timer" element={<OnboardingGuard><TimerSetup /></OnboardingGuard>} />
              <Route path="/upload/:draftId/preview" element={<OnboardingGuard><RedirectToReview /></OnboardingGuard>} />
              <Route path="/exam/:examId/preview" element={<OnboardingGuard><ExamPreview /></OnboardingGuard>} />
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
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
