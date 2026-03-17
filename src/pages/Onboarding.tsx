import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
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

const Onboarding = () => {
  const [step, setStep] = useState<StudentStep | "tutor" | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<UserSubject[]>([]);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const { subjects, saveUserSubjects } = useSubjects();

  // Check if already fully onboarded → redirect
  useEffect(() => {
    const checkAlreadyCompleted = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
        const { data: { user } } = await supabase.auth.getUser();
        
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

    const validSubjects = selected.map(s => ({
      ...s,
      subject_name: s.subject_name || s.custom_name || "Unknown",
      subject_color: s.subject_color || "#3B82F6",
      is_custom: Boolean(s.is_custom)
    }));

    setSelectedSubjects(validSubjects);
    const success = await saveUserSubjects(validSubjects);
    if (!success) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("user_onboarding_status")
        .upsert({
          user_id: user.id,
          role: primaryRole || "student",
          subjects_completed: true,
          last_step: "subjects"
        }, { onConflict: "user_id,role" });
    }

    setStep("profile");
  };

  const handleProfileComplete = () => {
    setStep("goals");
  };

  const handleGoalsComplete = async (goals: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!goals || goals.length === 0) throw new Error("No goals to save");

      const validGoals = goals.filter(g => g.subject && g.subject.trim() !== "");
      if (validGoals.length === 0) throw new Error("All goals must have a subject");

      const { error: goalsError } = await supabase
        .from("revision_goals")
        .insert(validGoals.map(g => ({
          ...g,
          user_id: user.id,
          target_metric: g.target_metric || {}
        })));

      if (goalsError) {
        console.error("Error inserting goals:", goalsError);
        throw goalsError;
      }

      const autoScheduleGoals = goals.filter(g => g.auto_schedule);
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
            body: { goal_id: insertedGoal.id }
          });
        }
      }

      await supabase
        .from("user_onboarding_status")
        .upsert({
          user_id: user.id,
          role: primaryRole || "student",
          subjects_completed: true,
          goals_completed: true,
          completed_at: new Date().toISOString(),
          last_step: "goals"
        }, { onConflict: "user_id,role" });

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
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading your profile...</div>
      </div>
    );
  }

  const isTutor = primaryRole === "tutor";
  const showProgressBar = !isTutor;
  const currentStepIndex = isTutor ? 0 : STUDENT_STEPS.indexOf(step as StudentStep);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Brain className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isTutor ? "Welcome, Tutor!" : "Let's Get You Started"}
          </h1>
          <p className="text-muted-foreground">
            {isTutor
              ? "Set up your tutor profile to start managing your students"
              : "Tell us about yourself so we can personalize your experience"}
          </p>
        </div>

        {showProgressBar && (
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {STUDENT_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-20 rounded-full transition-colors ${
                    i <= currentStepIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm text-muted-foreground px-2">
              <span>Subjects</span>
              <span>Profile</span>
              <span>Goals</span>
            </div>
          </div>
        )}

        <Card className="border-2">
          <CardHeader>
            <CardTitle>
              {step === "subjects" && "Select Your Subjects"}
              {step === "profile" && "Study Profile"}
              {step === "goals" && "Set Your Goals"}
              {step === "tutor" && "Tutor Profile"}
            </CardTitle>
            <CardDescription>
              {step === "subjects" && "Choose the subjects you want to study"}
              {step === "profile" && "Tell us about your exam board and level"}
              {step === "goals" && "Define what you want to achieve"}
              {step === "tutor" && "Tell us about your teaching"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "subjects" && (
              <SubjectsSelection
                subjects={subjects}
                onComplete={handleSubjectsComplete}
              />
            )}
            {step === "profile" && (
              <ProfileSetupStep onComplete={handleProfileComplete} />
            )}
            {step === "goals" && (
              <GoalsForm
                subjects={selectedSubjects}
                onComplete={handleGoalsComplete}
              />
            )}
            {step === "tutor" && (
              <TutorOnboarding
                subjects={subjects}
                onComplete={handleTutorComplete}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
