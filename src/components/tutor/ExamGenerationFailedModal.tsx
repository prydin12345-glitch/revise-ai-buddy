import { AlertTriangle, RefreshCw, Save, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ExamGenerationFailedModalProps {
  errorMessage: string;
  onRetry: () => void;
  onSaveAsDraft: () => void;
  onUploadDifferent: () => void;
}

export function ExamGenerationFailedModal({
  errorMessage,
  onRetry,
  onSaveAsDraft,
  onUploadDifferent,
}: ExamGenerationFailedModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <Card className="max-w-2xl w-full mx-4 p-8 shadow-2xl border-destructive/20 animate-scale-in">
        <div className="text-center mb-6">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive animate-scale-in" />
          <h2 className="text-3xl font-bold mb-2 text-destructive">
            Generation Failed
          </h2>
          <p className="text-muted-foreground">
            We couldn't generate questions from your document.
          </p>
        </div>

        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-foreground">
            <strong>Error:</strong> {errorMessage || "Unknown error occurred"}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-2 font-medium">
            Common causes:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Document is too large or complex</li>
            <li>PDF is scanned or image-based (not text-searchable)</li>
            <li>Document format is corrupted</li>
            <li>Subject or topic is not recognized</li>
          </ul>
        </div>

        <Separator className="my-6" />

        <div className="space-y-3">
          <Button
            onClick={onRetry}
            size="lg"
            className="w-full h-14 text-lg"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Retry Generation
          </Button>

          <Button
            onClick={onUploadDifferent}
            size="lg"
            variant="outline"
            className="w-full h-14 text-lg"
          >
            <FileUp className="h-5 w-5 mr-2" />
            Upload Different File
          </Button>

          <Button
            onClick={onSaveAsDraft}
            size="lg"
            variant="secondary"
            className="w-full h-14 text-lg"
          >
            <Save className="h-5 w-5 mr-2" />
            Save as Draft & Exit
          </Button>
        </div>
      </Card>
    </div>
  );
}
