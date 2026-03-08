import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Eagerly loaded (small/critical pages)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Lazy loaded (large pages - only loaded when navigated to)
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
const CreatePracticeQuestions = lazy(() => import("./pages/CreatePracticeQuestions"));
const MyQuizzes = lazy(() => import("./pages/MyQuizzes"));
const PracticeSetPreview = lazy(() => import("./pages/PracticeSetPreview"));
const TakePracticeQuiz = lazy(() => import("./pages/TakePracticeQuiz"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminVerifications = lazy(() => import("./pages/AdminVerifications"));
const ManageExams = lazy(() => import("./pages/tutor/ManageExams"));
const ManagePracticeSets = lazy(() => import("./pages/tutor/ManagePracticeSets"));
const GraphTest = lazy(() => import("./pages/GraphTest"));
const StudentProgress = lazy(() => import("./pages/tutor/StudentProgress"));
const CreateTutorExam = lazy(() => import("./pages/tutor/CreateTutorExam"));
const EditExam = lazy(() => import("./pages/tutor/EditExam"));
const ManageStudents = lazy(() => import("./pages/tutor/ManageStudents"));
const ManageFeedback = lazy(() => import("./pages/tutor/ManageFeedback"));
const ExamHub = lazy(() => import("./pages/tutor/ExamHub"));
const StudentExamReview = lazy(() => import("./pages/tutor/StudentExamReview"));
const ManualExamCreator = lazy(() => import("./pages/tutor/ManualExamCreator"));
const MechanicsDemo = lazy(() => import("./pages/MechanicsDemo"));
const CircuitDemo = lazy(() => import("./pages/CircuitDemo"));
const MyClasses = lazy(() => import("./pages/MyClasses"));

// TutorLayout is relatively small, load eagerly for smooth sidebar
import { TutorLayout } from "./components/tutor/TutorLayout";

const queryClient = new QueryClient();

/** Full-page loading spinner for lazy-loaded routes */
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-10 w-10 animate-spin text-primary" />
  </div>
);

const App = () => {
  // Enable dark mode by default
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/graph-test" element={<GraphTest />} />
              <Route path="/mechanics-demo" element={<MechanicsDemo />} />
              <Route path="/circuit-demo" element={<CircuitDemo />} />
              <Route path="/my-exams" element={<MyExams />} />
              <Route path="/my-classes" element={<MyClasses />} />
              <Route path="/create-practice-questions" element={<CreatePracticeQuestions />} />
              <Route path="/quizzes" element={<MyQuizzes />} />
              <Route path="/practice-questions/:setId/preview" element={<PracticeSetPreview />} />
              <Route path="/practice-questions/:setId/take" element={<TakePracticeQuiz />} />
              <Route path="/upload" element={<CreateExam />} />
              
              <Route path="/upload/:draftId/analyze" element={<AnalyzeExam />} />
              <Route path="/upload/:draftId/review-questions" element={<ReviewQuestions />} />
              <Route path="/upload/:draftId/settings" element={<ExamSettings />} />
              <Route path="/upload/:draftId/format" element={<FormatExam />} />
              <Route path="/upload/:draftId/timer" element={<TimerSetup />} />
              <Route path="/upload/:draftId/preview" element={<RedirectToReview />} />
              <Route path="/exam/:examId/preview" element={<ExamPreview />} />
              <Route path="/exam/:examId/live" element={<ExamInProgress />} />
              <Route path="/exam/:examId/in-progress" element={<ExamInProgress />} />
              <Route path="/exam/:examId/review" element={<ExamReview />} />
              
              {/* Tutor Routes */}
              <Route path="/tutor/exams" element={<TutorLayout><ManageExams /></TutorLayout>} />
              <Route path="/tutor/exams/create" element={<TutorLayout><CreateTutorExam /></TutorLayout>} />
              <Route path="/tutor/exams/create-manual" element={<TutorLayout><ManualExamCreator /></TutorLayout>} />
              <Route path="/tutor/exams/:examId" element={<TutorLayout><ExamHub /></TutorLayout>} />
              <Route path="/tutor/exams/:examId/edit" element={<TutorLayout><EditExam /></TutorLayout>} />
              <Route path="/tutor/exams/:examId/student/:studentId" element={<TutorLayout><StudentExamReview /></TutorLayout>} />
              <Route path="/tutor/practice" element={<TutorLayout><ManagePracticeSets /></TutorLayout>} />
              <Route path="/tutor/students" element={<TutorLayout><ManageStudents /></TutorLayout>} />
              <Route path="/tutor/progress" element={<TutorLayout><StudentProgress /></TutorLayout>} />
              <Route path="/tutor/feedback" element={<TutorLayout><ManageFeedback /></TutorLayout>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
