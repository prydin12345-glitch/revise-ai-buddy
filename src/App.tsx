import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { WorkspaceRouteViewport } from "@/components/WorkspaceRouteViewport";
import { WorkspacePageReady } from "@/components/WorkspacePageReady";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { WorkspaceSession } from "@/components/WorkspaceSession";
import { CookieConsent } from "@/components/CookieConsent";
import { PreferencesApplier } from "@/components/PreferencesApplier";
import { lazyWithReload } from "@/lib/lazy-with-reload";

// Only eagerly load the landing page + auth (first paint)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Everything else is lazy loaded (with stale-chunk auto-recovery)
const Auth = lazyWithReload(() => import("./pages/Auth"));
const ResetPassword = lazyWithReload(() => import("./pages/ResetPassword"));
const OAuthConsent = lazyWithReload(() => import("./pages/OAuthConsent"));
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
const ProfileDetail = lazyWithReload(() => import("./pages/ProfileDetail"));
const CreatePracticeQuestions = lazyWithReload(() => import("./pages/CreatePracticeQuestions"));
const MyQuizzes = lazyWithReload(() => import("./pages/MyQuizzes"));
const PracticeSetPreview = lazyWithReload(() => import("./pages/PracticeSetPreview"));
const TakePracticeQuiz = lazyWithReload(() => import("./pages/TakePracticeQuiz"));
const QuizCover = lazyWithReload(() => import("./pages/QuizCover"));
const Settings = lazyWithReload(() => import("./pages/Settings"));
const AdminVerifications = lazyWithReload(() => import("./pages/AdminVerifications"));
const MyClasses = lazyWithReload(() => import("./pages/MyClasses"));
const JoinClassLink = lazyWithReload(() => import("./pages/JoinClassLink"));
const UploadExam = lazyWithReload(() => import("./pages/UploadExam"));
const PreviewExam = lazyWithReload(() => import("./pages/PreviewExam"));
const Pricing = lazyWithReload(() => import("./pages/Pricing"));
const Privacy = lazyWithReload(() => import("./pages/Privacy"));
const ImageCredits = lazyWithReload(() => import("./pages/ImageCredits"));
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
          <WorkspaceSession>
          <PreferencesApplier />
          <WorkspaceRouteViewport>
              {/* Public routes — no guard */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/image-credits" element={<ImageCredits />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* One stable guard across protected pages; ownership changes reset the viewport. */}
              <Route element={<OnboardingGuard><WorkspacePageReady><Outlet /></WorkspacePageReady></OnboardingGuard>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/my-subjects" element={<MySubjects />} />
              <Route path="/my-subjects/:subjectName" element={<SubjectDetail />} />
              <Route path="/my-subjects/:subjectName/:profileId" element={<ProfileDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/my-exams" element={<MyExams />} />
              <Route path="/my-classes" element={<MyClasses />} />
              <Route path="/join/:inviteCode" element={<JoinClassLink />} />
              <Route path="/create-practice-questions" element={<CreatePracticeQuestions />} />
              <Route path="/quizzes" element={<MyQuizzes />} />
              <Route path="/practice-questions/:setId/preview" element={<PracticeSetPreview />} />
              <Route path="/practice-questions/:setId/take" element={<TakePracticeQuiz />} />
              <Route path="/quizzes/:setId/cover" element={<QuizCover />} />
              <Route path="/upload" element={<CreateExam />} />
              
              <Route path="/upload/:draftId/analyze" element={<AnalyzeExam />} />
              <Route path="/upload/:draftId/review-questions" element={<ReviewQuestions />} />
              <Route path="/upload/:draftId/settings" element={<ExamSettings />} />
              <Route path="/upload/:draftId/format" element={<FormatExam />} />
              <Route path="/upload/:draftId/timer" element={<TimerSetup />} />
              <Route path="/upload/:draftId/preview" element={<RedirectToReview />} />
              <Route path="/exam/:examId/preview" element={<ExamPreview />} />
              <Route path="/exam/:examId/cover" element={<ExamCover />} />
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
              
              </Route>
              <Route path="*" element={<NotFound />} />
          </WorkspaceRouteViewport>
          <CookieConsent />
          </WorkspaceSession>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
