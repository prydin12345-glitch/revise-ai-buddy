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

const Onboarding = () => {
  const [step, setStep] = useState<"subjects" | "goals" | "tutor">("subjects");
  const [selectedSubjects, setSelectedSubjects] = useState<UserSubject[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const { subjects, saveUserSubjects } = useSubjects();

  useEffect(() => {
    // If tutor role, skip to tutor onboarding
    if (!roleLoading && primaryRole === "tutor") {
      setStep("tutor");
    }
  }, [primaryRole, roleLoading]);

  const handleSubjectsComplete = async (selected: UserSubject[]) => {
    setSelectedSubjects(selected);
    
    // Save subjects to database
    const success = await saveUserSubjects(selected);
    if (!success) return;

    // Update onboarding status
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("user_onboarding_status")
        .upsert({
          user_id: user.id,
          role: primaryRole || "student",
          subjects_completed: true,
          last_step: "subjects"
        }, {
          onConflict: "user_id,role"
        });
    }

    setStep("goals");
  };

  const handleGoalsComplete = async (goals: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert goals
      const { error: goalsError } = await supabase
        .from("revision_goals")
        .insert(goals.map(g => ({
          ...g,
          user_id: user.id,
          target_metric: g.target_metric || {}
        })));

      if (goalsError) throw goalsError;

      // Auto-schedule tasks if requested
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

      // Update onboarding status
      await supabase
        .from("user_onboarding_status")
        .upsert({
          user_id: user.id,
          role: primaryRole || "student",
          subjects_completed: true,
          goals_completed: true,
          completed_at: new Date().toISOString(),
          last_step: "goals"
        }, {
          onConflict: "user_id,role"
        });

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

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const isTutor = primaryRole === "tutor";
  const showProgressBar = !isTutor;

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
              <div
                className={`h-2 w-24 rounded-full ${
                  step === "subjects" || step === "goals" ? "bg-primary" : "bg-muted"
                }`}
              />
              <div
                className={`h-2 w-24 rounded-full ${
                  step === "goals" ? "bg-primary" : "bg-muted"
                }`}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>Subjects</span>
              <span>Goals</span>
            </div>
          </div>
        )}

        <Card className="border-2">
          <CardHeader>
            <CardTitle>
              {step === "subjects" && "Select Your Subjects"}
              {step === "goals" && "Set Your Goals"}
              {step === "tutor" && "Tutor Profile"}
            </CardTitle>
            <CardDescription>
              {step === "subjects" && "Choose the subjects you want to study"}
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
