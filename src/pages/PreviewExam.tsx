import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { FileText, Clock, Layout, Tag, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

interface ExamSummary {
  exam: any;
  topics: any[];
  format: any;
  timer: any;
}

export default function PreviewExam() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [examSummary, setExamSummary] = useState<ExamSummary | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!draftId) return;

    const loadExamSummary = async () => {
      try {
        const { data: exam, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', draftId)
          .single();

        if (examError) throw examError;

        const { data: topics } = await supabase
          .from('exam_topics')
          .select('*')
          .eq('exam_id', draftId);

        const { data: format } = await supabase
          .from('exam_format')
          .select('*')
          .eq('exam_id', draftId)
          .single();

        const { data: timer } = await supabase
          .from('exam_timer')
          .select('*')
          .eq('exam_id', draftId)
          .single();

        setExamSummary({ exam, topics: topics || [], format, timer });
      } catch (error: any) {
        console.error('Load summary error:', error);
        toast({
          title: "Load Failed",
          description: error.message || "Failed to load exam summary",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadExamSummary();
  }, [draftId]);

  const handlePublish = async () => {
    setPublishing(true);

    try {
      const { data, error } = await supabase.functions.invoke('publish-exam', {
        body: { draftId },
      });

      if (error) throw error;

      toast({
        title: "Exam Published",
        description: "Your exam is ready!",
      });

      navigate(`/exam/${data.examId}/in-progress`);
    } catch (error: any) {
      console.error('Publish error:', error);
      toast({
        title: "Publish Failed",
        description: error.message || "Failed to publish exam",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#0f1727] p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!examSummary) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#0f1727] p-6">
          <p className="text-white text-center">Exam not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const { exam, topics, format, timer } = examSummary;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0f1727] p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Review & Publish</h1>
            <p className="text-muted-foreground">
              Review your exam before publishing
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5 text-[#1e40af]" />
                <h3 className="text-lg font-semibold text-white">Exam Details</h3>
              </div>
              <div className="space-y-2">
                <p className="text-white"><span className="text-muted-foreground">Title:</span> {exam.title}</p>
                <p className="text-white"><span className="text-muted-foreground">Subject:</span> {exam.subject_id}</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Tag className="h-5 w-5 text-[#1e40af]" />
                <h3 className="text-lg font-semibold text-white">Topics</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <span
                    key={topic.id}
                    className="px-3 py-1 bg-[#1e40af]/20 text-[#1e40af] rounded-full text-sm"
                  >
                    {topic.topic_name}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Layout className="h-5 w-5 text-[#1e40af]" />
                <h3 className="text-lg font-semibold text-white">Format</h3>
              </div>
              {format?.use_original_structure ? (
                <p className="text-white">Original exam structure</p>
              ) : (
                <div className="space-y-2 text-white">
                  <p>MCQ: {format?.mcq_count} × {format?.mcq_marks_each} marks</p>
                  <p>Short Answer: {format?.short_answer_count} × {format?.short_answer_marks_each} marks</p>
                  <p>Long Form: {format?.long_form_count} × {format?.long_form_marks_each} marks</p>
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-[#1e40af]" />
                <h3 className="text-lg font-semibold text-white">Timer</h3>
              </div>
              <p className="text-white">
                {timer?.enabled
                  ? `${timer.duration_minutes} minutes`
                  : "No time limit"}
              </p>
            </div>

            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full bg-[#1e40af] hover:bg-[#1e40af]/90 text-white py-6 text-lg"
            >
              {publishing ? "Publishing..." : "Begin Exam Now"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
