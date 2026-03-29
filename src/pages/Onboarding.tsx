import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubjects, UserSubject } from "@/hooks/useSubjects";
import { supabase } from "@/integrations/supabase/client";
import SubjectsSelection from "@/components/onboarding/SubjectsSelection";
import GoalsForm from "@/components/onboarding/GoalsForm";
import TutorOnboarding from "@/components/onboarding/TutorOnboarding";
import ProfileSetupStep from "@/components/onboarding/ProfileSetupStep";

type StudentStep = "subjects" | "profile" | "goals";

const STUDENT_STEPS: StudentStep[] = ["subjects", "profile", "goals"];
const STEP_LABELS = ["Subjects", "Profile", "Goals"];

const StepProgress = ({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
}: {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onStepClick?: (step: number) => void;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 8 }}>
    {stepLabels.map((label, i) => {
      const stepNum = i + 1;
      const isComplete = stepNum < currentStep;
      const isActive = stepNum === currentStep;
      const isPending = stepNum > currentStep;

      return (
        <div key={label} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <motion.div
              onClick={isComplete && onStepClick ? () => onStepClick(stepNum) : undefined}
              animate={{
                background: isComplete ? "#22c55e" : isActive ? "#3b82f6" : "#1e293b",
                borderColor: isComplete ? "#22c55e" : isActive ? "#3b82f6" : "#334155",
              }}
              transition={{ duration: 0.3 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: isPending ? "#475569" : "white",
                cursor: isComplete ? "pointer" : "default",
              }}
            >
              {isComplete ? <Check size={14} strokeWidth={2.5} /> : stepNum}
            </motion.div>
            <span
              style={{
                fontSize: 11,
                color: isActive ? "#f1f5f9" : "#475569",
                fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </div>

          {i < totalSteps - 1 && (
            <motion.div
              animate={{ background: isComplete ? "#22c55e" : "#334155" }}
              transition={{ duration: 0.4 }}
              style={{ height: 2, width: 60, marginBottom: 22, borderRadius: 1 }}
            />
          )}
        </div>
      );
    })}
  </div>
);

const Onboarding = () => {
  const [step, setStep] = useState<StudentStep | "tutor" | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<UserSubject[]>([]);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const { subjects, saveUserSubjects } = useSubjects();

  // Saved step data for back navigation
  const [step2Data, setStep2Data] = useState<any>(null);
  const [step3Data, setStep3Data] = useState<any>(null);

  useEffect(() => {
    const checkAlreadyCompleted = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_onboarding_status")
        .select("subjects_completed, goals_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.subjects_completed && data?.goals_completed) {
        setAlreadyCompleted(true);
        navigate("/dashboard", { replace: true });
      }
    };
    checkAlreadyCompleted();
  }, [navigate]);

  useEffect(() => {
    const checkAuth = async () => {
      if (!roleLoading && !alreadyCompleted) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          toast({
            title: "Authentication required",
            description: "Please sign in to continue",
            variant: "destructive",
          });
          navigate("/auth");
          return;
        }

        if (step === null) {
          if (primaryRole === "tutor") {
            setStep("tutor");
          } else {
            setStep("subjects");
          }
        }
      }
    };

    checkAuth();
  }, [primaryRole, roleLoading, step, navigate, toast, alreadyCompleted]);

  const handleSubjectsComplete = async (selected: UserSubject[]) => {
    if (!selected || selected.length === 0) {
      toast({ title: "Error", description: "Please select at least one subject", variant: "destructive" });
      return;
    }

    const validSubjects = selected.map((s) => ({
      ...s,
      subject_name: s.subject_name || s.custom_name || "Unknown",
      subject_color: s.subject_color || "#3B82F6",
      is_custom: Boolean(s.is_custom),
    }));

    setSelectedSubjects(validSubjects);
    const success = await saveUserSubjects(validSubjects);
    if (!success) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_onboarding_status").upsert(
        {
          user_id: user.id,
          role: primaryRole || "student",
          subjects_completed: true,
          last_step: "subjects",
        },
        { onConflict: "user_id,role" }
      );
    }

    setStep("profile");
  };

  const handleProfileComplete = (data?: any) => {
    if (data) setStep2Data(data);
    setStep("goals");
  };

  const handleBack = () => {
    if (step === "goals") {
      setStep("profile");
    } else if (step === "profile") {
      setStep("subjects");
    }
  };

  const handleStepClick = (stepNum: number) => {
    const targetStep = STUDENT_STEPS[stepNum - 1];
    if (targetStep) setStep(targetStep);
  };

  const handleGoalsComplete = async (goals: any[]) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!goals || goals.length === 0) throw new Error("No goals to save");

      const validGoals = goals.filter((g) => g.subject && g.subject.trim() !== "");
      if (validGoals.length === 0) throw new Error("All goals must have a subject");

      const { error: goalsError } = await supabase.from("revision_goals").insert(
        validGoals.map((g) => ({
          ...g,
          user_id: user.id,
          target_metric: g.target_metric || {},
        }))
      );

      if (goalsError) {
        console.error("Error inserting goals:", goalsError);
        throw goalsError;
      }

      const autoScheduleGoals = goals.filter((g) => g.auto_schedule);
      for (const goal of autoScheduleGoals) {
        const { data: insertedGoal } = await supabase
          .from("revision_goals")
          .select("id")
          .eq("user_id", user.id)
          .eq("subject", goal.subject)
          .eq("goal_type", goal.goal_type)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (insertedGoal) {
          await supabase.functions.invoke("auto-schedule-goal", {
            body: { goal_id: insertedGoal.id },
          });
        }
      }

      await supabase.from("user_onboarding_status").upsert(
        {
          user_id: user.id,
          role: primaryRole || "student",
          subjects_completed: true,
          goals_completed: true,
          completed_at: new Date().toISOString(),
          last_step: "goals",
        },
        { onConflict: "user_id,role" }
      );

      toast({
        title: "Welcome aboard!",
        description: "Your account is all set up. Let's start revising!",
      });

      navigate("/dashboard");
    } catch (error) {
      console.error("Error completing goals:", error);
      toast({
        title: "Error",
        description: "Failed to save your goals. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTutorComplete = () => {
    navigate("/dashboard");
  };

  if (roleLoading || step === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#475569", fontSize: 14 }}>Loading your profile...</div>
      </div>
    );
  }

  // Tutor step tracking
  const [tutorStep, setTutorStep] = useState(1);
  const TUTOR_STEPS = ["Subjects", "Profile", "Classes", "About"];

  const isTutor = primaryRole === "tutor";
  const currentStepIndex = isTutor ? tutorStep - 1 : STUDENT_STEPS.indexOf(step as StudentStep);

  const handleTutorStepClick = (stepNum: number) => {
    if (stepNum < tutorStep) setTutorStep(stepNum);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background blobs */}
      <div
        style={{
          position: "fixed",
          top: "-10%",
          left: "-5%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-10%",
          right: "-5%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Logo */}
      <div
        style={{
          position: "fixed",
          top: 24,
          left: 32,
          fontSize: 20,
          fontWeight: 800,
          color: "#f1f5f9",
          zIndex: 10,
        }}
      >
        Exam<span style={{ color: "#3b82f6" }}>ly</span>
      </div>

      {/* Step progress */}
      {isTutor ? (
        <StepProgress
          currentStep={tutorStep}
          totalSteps={4}
          stepLabels={TUTOR_STEPS}
          onStepClick={handleTutorStepClick}
        />
      ) : (
        <StepProgress
          currentStep={currentStepIndex + 1}
          totalSteps={3}
          stepLabels={STEP_LABELS}
          onStepClick={handleStepClick}
        />
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          style={{
            width: "100%",
            maxWidth: 580,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 16,
            padding: "36px 32px",
            marginTop: 24,
          }}
        >
          {step === "subjects" && <SubjectsSelection subjects={subjects} onComplete={handleSubjectsComplete} />}
          {step === "profile" && (
            <ProfileSetupStep
              initialValues={step2Data}
              onComplete={handleProfileComplete}
              onBack={handleBack}
            />
          )}
          {step === "goals" && (
            <GoalsForm
              subjects={selectedSubjects}
              onComplete={handleGoalsComplete}
              onBack={handleBack}
              initialValues={step3Data}
            />
          )}
          {step === "tutor" && (
            <TutorOnboarding
              subjects={subjects}
              onComplete={handleTutorComplete}
              currentStep={tutorStep}
              onStepChange={setTutorStep}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
