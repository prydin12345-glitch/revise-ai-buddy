import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface PracticeSetCompleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  totalQuestions: number;
  subtopics: string[];
  difficulty: string;
  subjectColor: string;
  onPreview: () => void;
  onSaveToPracticeSets: () => void;
  onAddToRevisionPlan: () => void;
}

export function PracticeSetCompleteModal({
  open,
  onOpenChange,
  totalQuestions,
  subtopics,
  difficulty,
  subjectColor,
  onPreview,
  onSaveToPracticeSets,
  onAddToRevisionPlan,
}: PracticeSetCompleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <DialogTitle>Your practice set is ready!</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Practice question set generation complete
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Questions Generated</span>
              <span className="font-semibold">{totalQuestions}</span>
            </div>
            
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Topics</span>
              <div className="flex flex-wrap gap-2">
                {subtopics.map((subtopic) => (
                  <Badge
                    key={subtopic}
                    variant="secondary"
                    style={{ backgroundColor: `${subjectColor}20`, color: subjectColor }}
                  >
                    {subtopic}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Difficulty</span>
              <span className="font-semibold capitalize">{difficulty}</span>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <Button onClick={onPreview} className="w-full" variant="default">
              Preview Questions
            </Button>
            <Button onClick={onSaveToPracticeSets} className="w-full" variant="outline">
              Save to Practice Sets
            </Button>
            <Button onClick={onAddToRevisionPlan} className="w-full" variant="outline">
              Add to Revision Plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
