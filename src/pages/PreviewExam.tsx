import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { FileText, Clock, Layout, Tag, Loader2, CheckCircle, AlertCircle, Edit2, Sparkles, Award, BookOpen } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { Badge } from "@/components/ui/badge";

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
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draftCount, setDraftCount] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState<string>('pending');
  const [aiGenerationInProgress, setAiGenerationInProgress] = useState(false);

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
        setExtractionStatus(exam.extraction_status || 'pending');

        // Check if questions have been extracted
        const { count } = await supabase
          .from('exam_question_drafts')
          .select('id', { count: 'exact', head: true })
          .eq('exam_id', draftId);

        setDraftCount(count || 0);
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

  const handleExtractQuestions = async () => {
    setExtracting(true);
    setExtractionStatus('extracting');
    setAiGenerationInProgress(true);
    
    try {
      // Start extraction (returns immediately)
      const { error } = await supabase.functions.invoke('extract-exam-questions', {
        body: { draftId }
      });

      if (error) throw error;

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data: exam } = await supabase
          .from('exams')
          .select('extraction_status, total_questions_extracted, extraction_error')
          .eq('id', draftId)
          .single();

        if (!exam) return;

        setExtractionStatus(exam.extraction_status);

        if (exam.extraction_status === 'completed') {
          clearInterval(pollInterval);
          setExtracting(false);
          setAiGenerationInProgress(false);
          setDraftCount(exam.total_questions_extracted || 0);

          // Load topics
          const { data: topicsResult } = await supabase
            .from('exam_topics')
            .select('*')
            .eq('exam_id', draftId);

          if (topicsResult) {
            setExamSummary(prev => prev ? { ...prev, topics: topicsResult } : prev);
          }

          toast({
            title: "Generation Complete",
            description: `Successfully generated ${exam.total_questions_extracted} questions`,
          });
        } else if (exam.extraction_status === 'failed') {
          clearInterval(pollInterval);
          setExtracting(false);
          setAiGenerationInProgress(false);
          toast({
            title: "Generation Failed",
            description: exam.extraction_error || "Failed to generate questions",
            variant: "destructive",
          });
        }
      }, 2000); // Poll every 2 seconds

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (extracting) {
          setExtracting(false);
          setAiGenerationInProgress(false);
          toast({
            title: "Generation Timeout",
            description: "Processing is taking longer than expected. Please refresh the page to check status.",
            variant: "destructive",
          });
        }
      }, 600000);

    } catch (error: any) {
      console.error('Generation error:', error);
      setExtracting(false);
      setAiGenerationInProgress(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start generation",
        variant: "destructive",
      });
    }
  };

  const handlePublish = async () => {
    if (draftCount === 0) {
      toast({
        title: "Cannot Publish",
        description: "Please generate and review questions before publishing",
        variant: "destructive",
      });
      return;
    }

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
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContainer>
      </DashboardLayout>
    );
  }

  if (!examSummary) {
    return (
      <DashboardLayout>
        <PageContainer>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Not Found</AlertTitle>
            <AlertDescription>Exam not found</AlertDescription>
          </Alert>
        </PageContainer>
      </DashboardLayout>
    );
  }

  const { exam, topics, format, timer } = examSummary;

  return (
    <DashboardLayout>
      <PageContainer maxWidth="lg">
        <PageHeader
          title="Review & Publish"
          subtitle="Review your exam configuration and generate questions"
          step="Step 3 of 4"
        />

        <div className="space-y-6">
          {/* Exam Configuration Summary */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Exam Details</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/upload/${draftId}/format`)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Title</p>
                  <p className="font-medium">{exam.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subject</p>
                  <p className="font-medium capitalize">{exam.subject_id}</p>
                </div>
                {exam.specification_file_url && (
                  <Badge variant="outline" className="flex items-center gap-2 w-fit">
                    <CheckCircle className="h-4 w-4" />
                    Spec-aligned questions
                  </Badge>
                )}
              </div>
            </Card>

            <Card className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3 mb-4">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Exam Board</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Board</p>
                  <p className="font-medium uppercase">{exam.exam_board || 'Not specified'}</p>
                </div>
                {exam.qualification_level && (
                  <div>
                    <p className="text-sm text-muted-foreground">Qualification</p>
                    <p className="font-medium uppercase">{exam.qualification_level}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Tag className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Key Topics Identified</h3>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {extractionStatus === 'completed' && topics.length > 0 ? (
                  topics.map((topic, index) => (
                    <Badge 
                      key={topic.id} 
                      variant="secondary" 
                      className="text-sm animate-fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {topic.topic_name}
                    </Badge>
                  ))
                ) : extractionStatus === 'pending' ? (
                  <p className="text-sm text-muted-foreground">
                    Topics will be identified when you generate questions
                  </p>
                ) : extractionStatus === 'extracting' ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing topics...
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No topics identified — they'll be generated with questions
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Layout className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Format</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/upload/${draftId}/format`)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
              {format?.use_original_structure ? (
                <p className="text-sm">Original exam structure</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MCQ</span>
                    <span>{format?.mcq_count} × {format?.mcq_marks_each}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Short Answer</span>
                    <span>{format?.short_answer_count} × {format?.short_answer_marks_each}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Long Form</span>
                    <span>{format?.long_form_count} × {format?.long_form_marks_each}m</span>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Timer</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/upload/${draftId}/timer`)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm">
                {timer?.enabled && timer?.duration_minutes
                  ? `${timer.duration_minutes} minutes`
                  : "No time limit"}
              </p>
            </Card>
          </div>

          {/* AI Generation Verification Card */}
          {extractionStatus === 'completed' && draftCount > 0 && (
            <Alert className="border-blue-500/50 bg-blue-500/5">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <AlertTitle>✨ AI-Enhanced Exam Generation</AlertTitle>
              <AlertDescription>
                <div className="space-y-2 mt-2">
                  <p>All {draftCount} questions have been generated with AI assistance:</p>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>Original structure preserved (question count & marks)</li>
                    <li>Fresh content generated (copyright-safe)</li>
                    <li>Image-based questions automatically handled</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Question Generation Section */}
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">AI Question Generation</h3>
            </div>
            
            {extractionStatus === 'pending' && (
              <div className="space-y-4">
                <p className="text-muted-foreground">Generate AI-powered questions from your PDF to continue</p>
                <Button 
                  onClick={handleExtractQuestions}
                  disabled={extracting}
                  className="w-full button-glow h-12"
                  size="lg"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate Questions with AI
                    </>
                  )}
                </Button>
              </div>
            )}

            {extractionStatus === 'extracting' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-primary">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <div>
                    <p className="font-medium">Analyzing PDF with AI...</p>
                    <p className="text-sm text-muted-foreground">
                      Generating new questions, handling images, and ensuring copyright compliance (30-90 seconds)
                    </p>
                  </div>
                </div>
                <Progress value={33} className="w-full" />
              </div>
            )}

            {extractionStatus === 'completed' && (
              <div className="space-y-4">
                <Alert className="border-success/50 bg-success/5">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>
                    {draftCount} questions generated successfully with AI
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => navigate(`/upload/${draftId}/review-questions`)}
                  variant="outline"
                  className="w-full h-11"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Review & Edit Questions
                </Button>
              </div>
            )}

            {extractionStatus === 'failed' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle>Generation Failed</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{exam.extraction_error || "An error occurred while generating questions"}</p>
                    {exam.extraction_error?.includes('scanned') && (
                      <p className="text-sm mt-2">
                        💡 Tip: Make sure your PDF is text-based (not a scanned image). You can test this by trying to select text in the PDF.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={handleExtractQuestions}
                  disabled={extracting}
                  variant="outline"
                  className="w-full h-11"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    'Retry Generation'
                  )}
                </Button>
              </div>
            )}
          </Card>

          {/* Publish Button */}
          <Button
            onClick={handlePublish}
            disabled={publishing || draftCount === 0}
            size="lg"
            className="w-full h-14 text-lg font-medium button-glow"
          >
            {publishing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Publishing Exam...
              </>
            ) : draftCount === 0 ? (
              "Generate Questions to Continue"
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Publish Exam
              </>
            )}
          </Button>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
