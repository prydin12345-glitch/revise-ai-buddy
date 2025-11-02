import { CheckCircle, Edit2, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface GenerationCompleteModalProps {
  draftId: string;
  totalQuestions: number;
  subjectColor: string;
  examName: string;
  onReview: () => void;
  onBeginExam: () => void;
  onSaveAndPublish: () => void;
}

export function GenerationCompleteModal({
  totalQuestions,
  subjectColor,
  onReview,
  onBeginExam,
  onSaveAndPublish,
}: GenerationCompleteModalProps) {
  const timestamp = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <Card className="max-w-2xl w-full mx-4 p-8 shadow-2xl border-primary/20 animate-scale-in">
        {/* Success Icon & Message */}
        <div className="text-center mb-6">
          <CheckCircle 
            className="h-16 w-16 mx-auto mb-4 animate-scale-in"
            style={{ color: subjectColor }}
          />
          <h2 
            className="text-3xl font-bold mb-2"
            style={{ color: subjectColor }}
          >
            Your exam has been generated successfully!
          </h2>
          <p className="text-muted-foreground">
            {totalQuestions} questions created • Generated on {timestamp}
          </p>
        </div>

        <Separator className="my-6" />

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={onReview} 
            size="lg" 
            variant="outline" 
            className="w-full h-14 text-lg hover:bg-accent transition-all hover-scale"
          >
            <Edit2 className="h-5 w-5 mr-2" />
            Review Questions
          </Button>
          
          <Button 
            onClick={onBeginExam} 
            size="lg" 
            className="w-full h-14 text-lg button-glow"
            style={{ backgroundColor: subjectColor }}
          >
            <Play className="h-5 w-5 mr-2" />
            Begin Exam
          </Button>
          
          <Button 
            onClick={onSaveAndPublish} 
            size="lg" 
            variant="secondary" 
            className="w-full h-14 text-lg hover:bg-secondary/80 transition-all hover-scale"
          >
            <Save className="h-5 w-5 mr-2" />
            Save and Publish
          </Button>
        </div>
      </Card>
    </div>
  );
}
