import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { SubtopicSelector } from "@/components/practice/SubtopicSelector";
import { DifficultySettings } from "@/components/practice/DifficultySettings";
import { QuestionCountSlider } from "@/components/practice/QuestionCountSlider";
import { SpecUploadAdvisory } from "@/components/practice/SpecUploadAdvisory";
import { PracticeSetCompleteModal } from "@/components/practice/PracticeSetCompleteModal";
import { GenerationLoadingScreen } from "@/components/exam/GenerationLoadingScreen";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { supabase } from "@/integrations/supabase/client";

const CreatePracticeQuestions = () => {
  const navigate = useNavigate();
  const { getSubjectColor } = useUserSubjects();

  // Form state
  const [setName, setSetName] = useState("");
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [difficultyMode, setDifficultyMode] = useState<"fixed" | "increasing" | "mixed">("increasing");
  const [difficultyLevel, setDifficultyLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [exampleFile, setExampleFile] = useState<File | null>(null);
  const [educationalTier, setEducationalTier] = useState("");
  const [examBoard, setExamBoard] = useState("");
  const [useAIInterpretation, setUseAIInterpretation] = useState(true);

  // Generation states
  const [generating, setGenerating] = useState(false);
  const [showSpecAdvisory, setShowSpecAdvisory] = useState(false);
  const [showGenerationComplete, setShowGenerationComplete] = useState(false);
  const [generatedSetId, setGeneratedSetId] = useState("");
  const [totalQuestionsGenerated, setTotalQuestionsGenerated] = useState(0);

  const handleSubjectChange = (value: string) => {
    setSubjectId(value);
    setSubjectColor(getSubjectColor(value));
  };

  const handleGenerate = async () => {
    // Validation
    if (!setName.trim()) {
      toast.error("Please enter a set name");
      return;
    }

    if (!subjectId) {
      toast.error("Please select a subject");
      return;
    }

    if (selectedSubtopics.length === 0) {
      toast.error("Please select at least one subtopic");
      return;
    }

    if (!educationalTier) {
      toast.error("Please select an educational level");
      return;
    }

    // Show advisory if no spec uploaded
    if (!specFile) {
      setShowSpecAdvisory(true);
      return;
    }

    await proceedWithGeneration();
  };

  const proceedWithGeneration = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload files if provided
      let specFileUrl = null;
      let exampleFileUrl = null;

      if (specFile) {
        const specPath = `${user.id}/specs/${crypto.randomUUID()}-${specFile.name}`;
        const { error: specUploadError } = await supabase.storage
          .from("exam-files")
          .upload(specPath, specFile);
        if (specUploadError) throw specUploadError;
        specFileUrl = specPath;
      }

      if (exampleFile) {
        const examplePath = `${user.id}/examples/${crypto.randomUUID()}-${exampleFile.name}`;
        const { error: exampleUploadError } = await supabase.storage
          .from("exam-files")
          .upload(examplePath, exampleFile);
        if (exampleUploadError) throw exampleUploadError;
        exampleFileUrl = examplePath;
      }

      // Create practice set record
      const { data: setData, error: setError } = await supabase
        .from("practice_question_sets")
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          set_name: setName,
          notes: notes || null,
          subtopics: selectedSubtopics,
          question_count: questionCount,
          difficulty_mode: difficultyMode,
          difficulty_level: difficultyLevel,
          specification_file_url: specFileUrl,
          example_questions_file_url: exampleFileUrl,
          educational_tier: educationalTier,
          exam_board: examBoard || null,
          status: "draft",
          extraction_status: "pending",
        })
        .select()
        .single();

      if (setError) throw setError;

      setGeneratedSetId(setData.id);

      // Trigger generation
      const { error: genError } = await supabase.functions.invoke(
        "generate-practice-questions",
        {
          body: { setId: setData.id },
        }
      );

      if (genError) throw genError;

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data: checkData } = await supabase
          .from("practice_question_sets")
          .select("extraction_status, total_questions_generated")
          .eq("id", setData.id)
          .single();

        if (checkData?.extraction_status === "completed") {
          clearInterval(pollInterval);
          setTotalQuestionsGenerated(checkData.total_questions_generated || 0);
          setGenerating(false);
          setShowGenerationComplete(true);
        } else if (checkData?.extraction_status === "failed") {
          clearInterval(pollInterval);
          setGenerating(false);
          toast.error("Failed to generate questions. Please try again.");
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (generating) {
          setGenerating(false);
          toast.error("Generation timed out. Please try again.");
        }
      }, 300000);
    } catch (error: any) {
      console.error("Error generating practice set:", error);
      toast.error(error.message || "Failed to generate practice set");
      setGenerating(false);
    }
  };

  const handlePreview = () => {
    navigate(`/practice-questions/${generatedSetId}/preview`);
  };

  const handleSaveToPracticeSets = async () => {
    try {
      await supabase
        .from("practice_question_sets")
        .update({ status: "published" })
        .eq("id", generatedSetId);

      toast.success("Practice set saved successfully!");
      navigate("/practice-questions");
    } catch (error) {
      console.error("Error saving practice set:", error);
      toast.error("Failed to save practice set");
    }
  };

  const handleAddToRevisionPlan = () => {
    navigate(`/revision-plan?addPracticeSet=${generatedSetId}`);
  };

  return (
    <DashboardLayout>
      <div className="container max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create Practice Questions</h1>
            <p className="text-muted-foreground mt-1">
              Generate targeted practice questions for specific subtopics
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="lg">
            <Sparkles className="h-5 w-5 mr-2" />
            Generate
          </Button>
        </div>

        {/* Main Form */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Set Name & Subject */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="set-name">Set Name</Label>
                <Input
                  id="set-name"
                  placeholder="e.g. Sequences Drill Set"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <SubjectSelector 
                  value={subjectId} 
                  color={subjectColor}
                  onValueChange={handleSubjectChange}
                  onColorChange={setSubjectColor}
                  showLabel={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes or instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </Card>

            {/* Subtopic Selector */}
            {subjectId && (
              <Card className="p-6">
                <SubtopicSelector
                  subject={subjectId}
                  selectedSubtopics={selectedSubtopics}
                  onSubtopicsChange={setSelectedSubtopics}
                  educationalTier={educationalTier}
                  examBoard={examBoard}
                  useAIInterpretation={useAIInterpretation}
                  onAIInterpretationChange={setUseAIInterpretation}
                />
              </Card>
            )}

            {/* Question Count */}
            <Card className="p-6">
              <QuestionCountSlider value={questionCount} onChange={setQuestionCount} />
            </Card>

            {/* Difficulty Settings */}
            <DifficultySettings
              mode={difficultyMode}
              level={difficultyLevel}
              onModeChange={setDifficultyMode}
              onLevelChange={setDifficultyLevel}
            />

            {/* File Uploads */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Specification (Optional but Advised)</Label>
                <input
                  type="file"
                  id="spec-file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setSpecFile(e.target.files?.[0] || null)}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("spec-file")?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {specFile ? specFile.name : "Upload Specification"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Example Questions (Optional)</Label>
                <input
                  type="file"
                  id="example-file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setExampleFile(e.target.files?.[0] || null)}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("example-file")?.click()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {exampleFile ? exampleFile.name : "Upload Example Questions"}
                </Button>
              </div>
            </Card>

            {/* Educational Level & Exam Board */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="educational-tier">Educational Level</Label>
                <Select value={educationalTier} onValueChange={setEducationalTier}>
                  <SelectTrigger id="educational-tier">
                    <SelectValue placeholder="Select level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcse">GCSE</SelectItem>
                    <SelectItem value="a_level">A-Level</SelectItem>
                    <SelectItem value="ib">IB</SelectItem>
                    <SelectItem value="undergraduate">Undergraduate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-board">Exam Board (Optional)</Label>
                <Select value={examBoard} onValueChange={setExamBoard}>
                  <SelectTrigger id="exam-board">
                    <SelectValue placeholder="Select board..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aqa">AQA</SelectItem>
                    <SelectItem value="edexcel">Edexcel</SelectItem>
                    <SelectItem value="ocr">OCR</SelectItem>
                    <SelectItem value="wjec">WJEC</SelectItem>
                    <SelectItem value="cie">CIE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </div>

          {/* Configuration Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="text-lg font-semibold mb-4">Configuration Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Selected Subject</p>
                  <p className="font-medium">{subjectId || "Not selected"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Selected Subtopics</p>
                  <p className="font-medium">
                    {selectedSubtopics.length > 0
                      ? selectedSubtopics.join(", ")
                      : "None"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Question Count</p>
                  <p className="font-medium">{questionCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Difficulty</p>
                  <p className="font-medium capitalize">
                    {difficultyMode === "increasing"
                      ? "Increasing"
                      : difficultyMode === "mixed"
                      ? "Mixed"
                      : difficultyLevel}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Specification Uploaded</p>
                  <p className="font-medium">{specFile ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Educational Level</p>
                  <p className="font-medium">{educationalTier || "Not selected"}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {generating && (
        <GenerationLoadingScreen
          message="Creating your practice questions..."
          subjectColor={subjectColor}
          estimatedTime={30}
        />
      )}

      <SpecUploadAdvisory
        open={showSpecAdvisory}
        onClose={() => setShowSpecAdvisory(false)}
        onContinueAnyway={proceedWithGeneration}
        onUploadSpec={() => {
          setShowSpecAdvisory(false);
          document.getElementById("spec-file")?.click();
        }}
      />

      <PracticeSetCompleteModal
        open={showGenerationComplete}
        onOpenChange={setShowGenerationComplete}
        setId={generatedSetId}
        totalQuestions={totalQuestionsGenerated}
        subtopics={selectedSubtopics}
        difficulty={difficultyMode}
        subjectColor={subjectColor}
        onPreview={handlePreview}
        onSaveToPracticeSets={handleSaveToPracticeSets}
        onAddToRevisionPlan={handleAddToRevisionPlan}
      />
    </DashboardLayout>
  );
};

export default CreatePracticeQuestions;
