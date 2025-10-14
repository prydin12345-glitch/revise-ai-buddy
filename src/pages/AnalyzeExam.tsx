import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function AnalyzeExam() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;

    const analyzeExam = async () => {
      try {
        setAnalyzing(true);
        setError(null);

        const { data, error } = await supabase.functions.invoke('analyze-exam', {
          body: { draftId },
        });

        if (error) throw error;

        toast({
          title: "Analysis Complete",
          description: `Extracted ${data.topics.length} topics`,
        });

        // Wait a moment to show success
        setTimeout(() => {
          navigate(`/upload/${draftId}/format`);
        }, 1000);
      } catch (error: any) {
        console.error('Analysis error:', error);
        setError(error.message || "Failed to analyze exam");
        toast({
          title: "Analysis Failed",
          description: error.message || "Failed to analyze exam",
          variant: "destructive",
        });
      } finally {
        setAnalyzing(false);
      }
    };

    analyzeExam();
  }, [draftId, navigate]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoBack = () => {
    navigate('/upload');
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0f1727] p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white/5 rounded-lg p-8 border border-white/10 text-center">
            {analyzing ? (
              <>
                <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-[#1e40af]" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  Analyzing Document...
                </h2>
                <p className="text-muted-foreground">
                  Using AI to extract topics and structure
                </p>
                <div className="mt-6">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1e40af] animate-pulse w-3/4" />
                  </div>
                </div>
              </>
            ) : error ? (
              <>
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  Analysis Failed
                </h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleRetry}
                    className="flex-1 bg-[#1e40af] hover:bg-[#1e40af]/90"
                  >
                    Retry
                  </Button>
                  <Button
                    onClick={handleGoBack}
                    variant="outline"
                    className="flex-1"
                  >
                    Go Back
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <div className="h-8 w-8 rounded-full bg-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Analysis Complete!
                </h2>
                <p className="text-muted-foreground">
                  Redirecting to format selection...
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
