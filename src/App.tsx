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
import UploadExam from "./pages/UploadExam";
import AnalyzeExam from "./pages/AnalyzeExam";
import FormatExam from "./pages/FormatExam";
import TimerSetup from "./pages/TimerSetup";
import PreviewExam from "./pages/PreviewExam";
import ReviewQuestions from "./pages/ReviewQuestions";
import ExamInProgress from "./pages/ExamInProgress";
import NotFound from "./pages/NotFound";

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
            <Route path="/my-exams" element={<MyExams />} />
            <Route path="/upload" element={<UploadExam />} />
            
            {/* Exam Upload Flow (Oct 2024):
                1. /upload → Upload PDF (upload-exam edge function)
                2. Background: analyze-exam extracts topics
                3. /upload/:id/format → Set exam format
                4. /upload/:id/timer → Configure timer
                5. /upload/:id/preview → Preview & extract questions
                6. /upload/:id/review-questions → Edit extracted questions
                7. Publish exam → /exam/:id/in-progress
            */}
            <Route path="/upload/:draftId/analyze" element={<AnalyzeExam />} />
            <Route path="/upload/:draftId/review-questions" element={<ReviewQuestions />} />
            <Route path="/upload/:draftId/format" element={<FormatExam />} />
            <Route path="/upload/:draftId/timer" element={<TimerSetup />} />
            <Route path="/upload/:draftId/preview" element={<PreviewExam />} />
            <Route path="/exam/:examId/in-progress" element={<ExamInProgress />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
