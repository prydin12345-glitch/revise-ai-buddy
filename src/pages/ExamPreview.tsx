import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MathRenderer } from "@/components/MathRenderer";
import { BoxPlotChart, isBoxPlotQuestion } from "@/components/graph/BoxPlotChart";
import { HistogramChart, isHistogramQuestion } from "@/components/graph/HistogramChart";
import { DataTableChart, isDataTableQuestion } from "@/components/graph/DataTableChart";
import {
  BarChart, isBarChartQuestion,
  PieChart, isPieChartQuestion,
  CumulativeFrequencyChart, isCumulativeFrequencyQuestion,
  FrequencyPolygonChart, isFrequencyPolygonQuestion,
  ClimateChart, isClimateChartQuestion,
} from "@/components/graph";
import { getChartData } from "@/utils/chartData";
import { MechanicsFigurePanel, detectDiagramConfig } from "@/components/mechanics";
import { CircuitFigurePanel } from "@/components/circuit";
import { getCircuitConfig } from "@/components/circuit/getCircuitConfig";
import { BiologyFigurePanel, detectBiologyDiagram } from "@/components/biology";
import { EconomicsFigurePanel } from "@/components/economics/EconomicsFigurePanel";

interface Question {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: Array<{ text: string; key: string }>;
  figure_urls?: string[];
  has_math?: boolean;
  question_latex?: string;
}

const ExamPreview = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [beginDialogOpen, setBeginDialogOpen] = useState(false);

  useEffect(() => {
    loadExamPreview();
  }, [examId]);

  const loadExamPreview = async () => {
    try {
      // Fetch exam metadata
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examError) throw examError;
      setExam(examData);

      // Fetch questions via edge function
      const { data, error } = await supabase.functions.invoke('get-exam-questions', {
        body: { examId, isPreview: true }
      });

      if (error) throw error;
      setQuestions(data.questions || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBeginExam = () => {
    setBeginDialogOpen(true);
  };

  const handleConfirmBeginExam = () => {
    setBeginDialogOpen(false);
    navigate(`/exam/${examId}/live`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-muted-foreground">Exam not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-gray-100 dark:bg-gray-700">
              <Eye className="w-3 h-3 mr-1" />
              Preview Mode
            </Badge>
            <h1 className="text-xl font-bold">{exam.title}</h1>
          </div>
          <Button onClick={handleBeginExam} size="lg" className="bg-blue-600 hover:bg-blue-700">
            Begin Exam
          </Button>
        </div>
      </header>

      {/* Exam Metadata */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Exam Board</p>
              <p className="text-lg font-semibold">{exam.exam_board || 'N/A'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Qualification</p>
              <p className="text-lg font-semibold">{exam.qualification_level || 'N/A'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Questions</p>
              <p className="text-lg font-semibold">{questions.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Questions (Read-only) */}
        <div className="space-y-8">
          {questions.map((q, qIdx) => {
            const subPartMatch = q.question_number.match(/^(\d+)([a-z].*)?$/i);
            const parentNum = subPartMatch?.[1] || q.question_number;
            const subPart = subPartMatch?.[2] || '';
            const isSubPart = !!subPart;
            const prevQ = qIdx > 0 ? questions[qIdx - 1] : null;
            const prevParent = prevQ?.question_number.match(/^(\d+)/)?.[1];
            const showParentHeader = isSubPart && parentNum !== prevParent;

            return (
              <div key={q.id} className={isSubPart ? 'ml-2' : ''}>
                {showParentHeader && (
                  <h2 className="text-xl font-bold mb-4 mt-2">Question {parentNum}</h2>
                )}
                <Card className={`opacity-75 ${isSubPart ? 'border-l-4 border-l-muted' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      {isSubPart ? (
                        <h3 className="text-lg font-semibold">({subPart})</h3>
                      ) : (
                        <h3 className="text-lg font-bold">Question {q.question_number}</h3>
                      )}
                      <span className="text-sm font-medium text-muted-foreground">
                        ({q.marks} {q.marks === 1 ? 'mark' : 'marks'})
                      </span>
                    </div>

                    <MathRenderer 
                      content={q.question_text}
                      latex={q.question_latex}
                      hasMath={q.has_math}
                      className="mb-4"
                    />

                    {(() => {
                      const chartData = getChartData(q);
                      if (!chartData) return null;
                      return (
                        <>
                          {isBoxPlotQuestion(chartData) && (
                            <BoxPlotChart chartData={chartData as any} className="mb-4" />
                          )}
                          {isHistogramQuestion(chartData) && (
                            <HistogramChart chartData={chartData as any} className="mb-4" />
                          )}
                          {isDataTableQuestion(chartData) && (
                            <DataTableChart chartData={chartData as any} className="mb-4" />
                          )}
                          {isBarChartQuestion(chartData) && (
                            <BarChart chartData={chartData as any} className="mb-4" />
                          )}
                          {isPieChartQuestion(chartData) && (
                            <PieChart chartData={chartData as any} className="mb-4" />
                          )}
                          {isCumulativeFrequencyQuestion(chartData) && (
                            <CumulativeFrequencyChart chartData={chartData as any} className="mb-4" />
                          )}
                          {isFrequencyPolygonQuestion(chartData) && (
                            <FrequencyPolygonChart chartData={chartData as any} className="mb-4" />
                          )}
                          {isClimateChartQuestion(chartData) && (
                            <ClimateChart chartData={chartData as any} className="mb-4" />
                          )}
                        </>
                      );
                    })()}


                    {/* Mechanics diagram panel */}
                    {(() => {
                      const diagConfig = detectDiagramConfig(q.question_text);
                      if (!diagConfig) return null;
                      return <MechanicsFigurePanel config={diagConfig} />;
                    })()}

                    {/* Circuit diagram panel */}
                    {(() => {
                      const circuitConfig = getCircuitConfig(q);
                      if (!circuitConfig) return null;
                      return <CircuitFigurePanel config={circuitConfig} />;
                    })()}

                    {/* Biology diagram panel */}
                    {(() => {
                      const bioConfig = detectBiologyDiagram(q.question_text, (q as any).subject);
                      if (!bioConfig) return null;
                      return <BiologyFigurePanel config={bioConfig} />;
                    })()}

                    <EconomicsFigurePanel
                      questionText={q.question_text ?? ''}
                      subject={(q as any).subject ?? ''}
                      diagramConfig={null}
                      isSubmitted={true}
                      isReview={true}
                    />

                    {q.figure_urls && q.figure_urls.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {q.figure_urls.map((url, idx) => (
                          <img 
                            key={idx} 
                            src={url} 
                            alt={`Figure ${idx + 1}`} 
                            className="rounded-lg border max-h-64 object-contain"
                          />
                        ))}
                      </div>
                    )}

                    {q.question_type === 'mcq' && q.options && Array.isArray(q.options) ? (
                      <RadioGroup disabled className="space-y-2">
                        {q.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <RadioGroupItem value={i.toString()} disabled />
                            <Label className="cursor-not-allowed opacity-60">
                              {typeof opt === 'object' ? `${opt.key}) ${opt.text}` : String(opt)}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <Textarea 
                        disabled 
                        placeholder="Answer input (disabled in preview)" 
                        className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed min-h-[120px]"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Begin Exam Confirmation Dialog */}
      <AlertDialog open={beginDialogOpen} onOpenChange={setBeginDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Begin Live Exam</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to start the live exam. Timer will begin and answers will be saved automatically. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBeginExam} className="bg-blue-600 hover:bg-blue-700">
              Start Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamPreview;
