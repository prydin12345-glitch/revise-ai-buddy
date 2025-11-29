import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import MyExams from "./pages/MyExams";
import CreateExam from "./pages/CreateExam";
import AnalyzeExam from "./pages/AnalyzeExam";
import ExamSettings from "./pages/ExamSettings";
import FormatExam from "./pages/FormatExam";
import TimerSetup from "./pages/TimerSetup";
import ReviewQuestions from "./pages/ReviewQuestions";
import RedirectToReview from "./pages/RedirectToReview";
import ExamInProgress from "./pages/ExamInProgress";
import ExamPreview from "./pages/ExamPreview";
import ExamReview from "./pages/ExamReview";
import Stats from "./pages/Stats";
import RevisionPlan from "./pages/RevisionPlan";
import CreatePracticeQuestions from "./pages/CreatePracticeQuestions";
import MyQuizzes from "./pages/MyQuizzes";
import PracticeSetPreview from "./pages/PracticeSetPreview";
import TakePracticeQuiz from "./pages/TakePracticeQuiz";
import Settings from "./pages/Settings";
import AdminVerifications from "./pages/AdminVerifications";
import NotFound from "./pages/NotFound";
import ManageExams from "./pages/tutor/ManageExams";
import ManagePracticeSets from "./pages/tutor/ManagePracticeSets";
import StudentPlanner from "./pages/tutor/StudentPlanner";
import StudentProgress from "./pages/tutor/StudentProgress";
import CreateTutorExam from "./pages/tutor/CreateTutorExam";
import { TutorLayout } from "./components/tutor/TutorLayout";

const queryClient = new QueryClient();

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
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/revision-plan" element={<RevisionPlan />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin/verifications" element={<AdminVerifications />} />
            <Route path="/my-exams" element={<MyExams />} />
            <Route path="/create-practice-questions" element={<CreatePracticeQuestions />} />
            <Route path="/quizzes" element={<MyQuizzes />} />
            <Route path="/practice-questions/:setId/preview" element={<PracticeSetPreview />} />
            <Route path="/practice-questions/:setId/take" element={<TakePracticeQuiz />} />
            <Route path="/upload" element={<CreateExam />} />
            
            {/* Exam Upload Flow (Updated):
                1. /upload → Create & Generate Mock Exam (uploads + triggers AI generation)
                2. /upload/:id/review-questions → Edit generated questions  
                3. Publish exam → /exam/:id/in-progress
                
                Deprecated routes kept for backward compatibility:
                - /upload/:id/preview → Redirects to review-questions
            */}
            <Route path="/upload/:draftId/analyze" element={<AnalyzeExam />} />
            <Route path="/upload/:draftId/review-questions" element={<ReviewQuestions />} />
            <Route path="/upload/:draftId/settings" element={<ExamSettings />} />
            <Route path="/upload/:draftId/format" element={<FormatExam />} />
            <Route path="/upload/:draftId/timer" element={<TimerSetup />} />
            {/* Deprecated: Step 3 removed, redirect to review-questions */}
            <Route path="/upload/:draftId/preview" element={<RedirectToReview />} />
            <Route path="/exam/:examId/preview" element={<ExamPreview />} />
            <Route path="/exam/:examId/live" element={<ExamInProgress />} />
            <Route path="/exam/:examId/in-progress" element={<ExamInProgress />} />
            <Route path="/exam/:examId/review" element={<ExamReview />} />
            
            {/* Tutor Routes - Wrapped in TutorLayout for persistent sidebar */}
            <Route path="/tutor/exams" element={<TutorLayout><ManageExams /></TutorLayout>} />
            <Route path="/tutor/exams/create" element={<TutorLayout><CreateTutorExam /></TutorLayout>} />
            <Route path="/tutor/practice" element={<TutorLayout><ManagePracticeSets /></TutorLayout>} />
            <Route path="/tutor/planner" element={<TutorLayout><StudentPlanner /></TutorLayout>} />
            <Route path="/tutor/progress" element={<TutorLayout><StudentProgress /></TutorLayout>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
