import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GoalFormData {
  goal_type: string;
  custom_goal_text?: string;
  target_metric: {
    score?: number;
    count?: number;
    unit?: string;
  };
  deadline?: string;
  effort_estimate?: number;
  auto_schedule: boolean;
  subject: string;
  subject_color: string;
}

interface GoalsFormProps {
  subjects: Array<{ subject_name?: string; custom_name?: string; subject_color: string }>;
  onComplete: (goals: GoalFormData[]) => void;
}

const GOAL_TYPES = [
  { value: "improve_grade", label: "Improve Exam Grade", metric: "score" },
  { value: "build_confidence", label: "Build Confidence", metric: "count" },
  { value: "exam_techniques", label: "Learn Exam Techniques", metric: "count" },
  { value: "reduce_stress", label: "Reduce Stress", metric: "count" },
  { value: "track_progress", label: "Track My Progress", metric: "count" },
  { value: "custom", label: "Custom Goal", metric: "custom" }
];

const GoalsForm = ({ subjects, onComplete }: GoalsFormProps) => {
  // Handle empty subjects array
  const defaultSubject = subjects.length > 0 
    ? (subjects[0]?.subject_name || subjects[0]?.custom_name || "")
    : "";
  const defaultColor = subjects.length > 0 
    ? (subjects[0]?.subject_color || "#3b82f6")
    : "#3b82f6";

  const [goals, setGoals] = useState<GoalFormData[]>([{
    goal_type: "improve_grade",
    target_metric: { score: 80, unit: "%" },
    deadline: "",
    effort_estimate: 5,
    auto_schedule: false,
    subject: defaultSubject,
    subject_color: defaultColor
  }]);

  const updateGoal = (index: number, updates: Partial<GoalFormData>) => {
    const newGoals = [...goals];
    newGoals[index] = { ...newGoals[index], ...updates };
    setGoals(newGoals);
  };

  const addGoal = () => {
    const defaultSubject = subjects.length > 0 
      ? (subjects[0]?.subject_name || subjects[0]?.custom_name || "")
      : "";
    const defaultColor = subjects.length > 0 
      ? (subjects[0]?.subject_color || "#3b82f6")
      : "#3b82f6";

    setGoals([...goals, {
      goal_type: "improve_grade",
      target_metric: { score: 80, unit: "%" },
      deadline: "",
      effort_estimate: 5,
      auto_schedule: false,
      subject: defaultSubject,
      subject_color: defaultColor
    }]);
  };

  return (
    <div className="space-y-6">
      {subjects.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          No subjects selected. Please go back and select your subjects first.
        </div>
      ) : (
        <>
      {goals.map((goal, index) => (
        <div key={index} className="space-y-4 p-4 border rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Subject</Label>
              <Select
                value={goal.subject}
                onValueChange={(value) => {
                  const subject = subjects.find(s => 
                    (s.subject_name || s.custom_name) === value
                  );
                  updateGoal(index, { 
                    subject: value,
                    subject_color: subject?.subject_color || "#3b82f6"
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s, idx) => (
                    <SelectItem key={idx} value={s.subject_name || s.custom_name || ""}>
                      {s.subject_name || s.custom_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Goal Type</Label>
              <Select
                value={goal.goal_type}
                onValueChange={(value) => updateGoal(index, { goal_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {goal.goal_type === "custom" && (
            <div>
              <Label>Describe Your Goal</Label>
              <Textarea
                value={goal.custom_goal_text || ""}
                onChange={(e) => updateGoal(index, { custom_goal_text: e.target.value })}
                placeholder="What do you want to achieve?"
              />
            </div>
          )}

          {goal.goal_type === "improve_grade" && (
            <div>
              <Label>Target Score (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={goal.target_metric.score || 80}
                onChange={(e) => updateGoal(index, {
                  target_metric: { ...goal.target_metric, score: parseInt(e.target.value), unit: "%" }
                })}
              />
            </div>
          )}

          {goal.goal_type !== "custom" && goal.goal_type !== "improve_grade" && (
            <div>
              <Label>Number of Sessions</Label>
              <Input
                type="number"
                min="1"
                value={goal.target_metric.count || 10}
                onChange={(e) => updateGoal(index, {
                  target_metric: { ...goal.target_metric, count: parseInt(e.target.value), unit: "sessions" }
                })}
              />
            </div>
          )}

          <div>
            <Label>Deadline</Label>
            <Input
              type="date"
              value={goal.deadline || ""}
              onChange={(e) => updateGoal(index, { deadline: e.target.value })}
            />
          </div>

          <div>
            <Label>Effort (hours per week): {goal.effort_estimate}</Label>
            <Slider
              value={[goal.effort_estimate || 5]}
              onValueChange={([value]) => updateGoal(index, { effort_estimate: value })}
              min={1}
              max={20}
              step={1}
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label htmlFor={`auto-schedule-${index}`}>Auto-schedule revision tasks</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Automatically create revision tasks based on spaced repetition principles</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id={`auto-schedule-${index}`}
              checked={goal.auto_schedule}
              onCheckedChange={(checked) => updateGoal(index, { auto_schedule: checked })}
            />
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" onClick={addGoal} className="flex-1">
          Add Another Goal
        </Button>
        <Button 
          onClick={() => {
            // Validate goals before submitting
            const validGoals = goals.filter(g => 
              g.subject && g.subject.trim() !== ""
            );
            if (validGoals.length === 0) return;
            onComplete(validGoals);
          }} 
          className="flex-1"
          disabled={goals.every(g => !g.subject || g.subject.trim() === "")}
        >
          Complete Setup
        </Button>
      </div>
        </>
      )}
    </div>
  );
};

export default GoalsForm;
