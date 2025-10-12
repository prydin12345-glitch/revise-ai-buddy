import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Brain, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const availableSubjects = [
    "Mathematics",
    "English",
    "Science",
    "History",
    "Geography",
    "Computer Science",
    "Physics",
    "Chemistry",
    "Biology",
  ];

  const availableGoals = [
    "Improve exam grades",
    "Build confidence",
    "Learn exam techniques",
    "Reduce stress",
    "Track my progress",
  ];

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const toggleGoal = (goal: string) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleComplete = () => {
    if (subjects.length === 0) {
      toast({
        title: "Please select subjects",
        description: "Choose at least one subject to continue",
        variant: "destructive",
      });
      return;
    }
    
    if (goals.length === 0) {
      toast({
        title: "Please select goals",
        description: "Choose at least one goal to continue",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Welcome aboard!",
      description: "Your account is all set up. Let's start revising!",
    });

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Brain className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Let's Get You Started</h1>
          <p className="text-muted-foreground">
            Tell us about yourself so we can personalize your experience
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            <div
              className={`h-2 w-24 rounded-full ${
                step >= 1 ? "bg-primary" : "bg-muted"
              }`}
            />
            <div
              className={`h-2 w-24 rounded-full ${
                step >= 2 ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>Subjects</span>
            <span>Goals</span>
          </div>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>
              {step === 1 ? "Select Your Subjects" : "What Are Your Goals?"}
            </CardTitle>
            <CardDescription>
              {step === 1
                ? "Choose the subjects you want to revise"
                : "Tell us what you want to achieve"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableSubjects.map((subject) => (
                  <div key={subject} className="flex items-center space-x-2">
                    <Checkbox
                      id={subject}
                      checked={subjects.includes(subject)}
                      onCheckedChange={() => toggleSubject(subject)}
                    />
                    <Label
                      htmlFor={subject}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {subject}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {availableGoals.map((goal) => (
                  <div key={goal} className="flex items-center space-x-2">
                    <Checkbox
                      id={goal}
                      checked={goals.includes(goal)}
                      onCheckedChange={() => toggleGoal(goal)}
                    />
                    <Label
                      htmlFor={goal}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {goal}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {step === 2 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Back
                </Button>
              )}
              <Button
                onClick={() => (step === 1 ? setStep(2) : handleComplete())}
                className="flex-1"
                disabled={step === 1 ? subjects.length === 0 : goals.length === 0}
              >
                {step === 1 ? "Continue" : "Complete Setup"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
