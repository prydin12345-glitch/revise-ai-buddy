import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Clock, SlidersHorizontal, Info, Sparkles, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { GenerationLoadingScreen } from "@/components/exam/GenerationLoadingScreen";
import { GenerationCompleteModal } from "@/components/exam/GenerationCompleteModal";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";


const examBoards = [
  { id: "aqa", name: "AQA" },
  { id: "edexcel", name: "Edexcel" },
  { id: "ocr", name: "OCR" },
  { id: "cie", name: "Cambridge International (CIE)" },
  { id: "ib", name: "International Baccalaureate (IB)" },
  { id: "wjec", name: "WJEC" },
  { id: "other", name: "Other" }
];

const qualificationLevels = [
  { id: "gcse", name: "GCSE" },
  { id: "igcse", name: "IGCSE" },
  { id: "a_level", name: "A-Level" },
  { id: "as_level", name: "AS Level" },
  { id: "ib_hl", name: "IB Higher Level" },
  { id: "ib_sl", name: "IB Standard Level" },
  { id: "other", name: "Other" }
];

const educationalTiers = [
  { 
    id: "gcse_igcse", 
    name: "GCSE / IGCSE", 
    desc: "UK Year 10–11, international equivalents"
  },
  { 
    id: "a_level", 
    name: "A-Level / AS-Level", 
    desc: "UK Year 12–13, Cambridge, Edexcel, OCR"
  },
  { 
    id: "o_level", 
    name: "O-Level", 
    desc: "Used in Singapore, Pakistan, etc."
  },
  { 
    id: "college_sixth_form", 
    name: "College / Sixth Form", 
    desc: "Pre-university, non-A-level systems"
  },
  { 
    id: "ib_diploma", 
    name: "IB Diploma", 
    desc: "International Baccalaureate"
  },
  { 
    id: "university_undergraduate", 
    name: "University / Undergraduate", 
    desc: "First-year modules, degree-level"
  },
  { 
    id: "postgraduate_masters", 
    name: "Postgraduate / Masters", 
    desc: "Advanced academic level"
  },
  { 
    id: "vocational_technical", 
    name: "Vocational / Technical", 
    desc: "BTEC, NVQ, apprenticeships"
  },
  { 
    id: "other", 
    name: "Other", 
    desc: "Custom input field for your level"
  }
];

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#14B8A6", "#FF7F6A",
  "#F59E0B", "#EC4899", "#EF4444", "#6366F1", "#06B6D4",
];

const getRandomColor = () => {
  return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
};

export default function CreateExam() {
  const navigate = useNavigate();
  const { getSubjectColor, saveOrUpdateSubject } = useUserSubjects();
  
  // Basic info
  const [examName, setExamName] = useState("");
  const [examNameError, setExamNameError] = useState(false);
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  const [examBoard, setExamBoard] = useState("");
  const [customExamBoard, setCustomExamBoard] = useState("");
  const [qualificationLevel, setQualificationLevel] = useState("");
  
  // File uploads
  const [file, setFile] = useState<File | null>(null);
  const [specFile, setSpecFile] = useState<File | null>(null);
  
  // Format settings
  const [useOriginal, setUseOriginal] = useState(true);
  const [educationalTier, setEducationalTier] = useState("");
  const [customTier, setCustomTier] = useState("");
  
  // Custom exam structure
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [oneMarkCount, setOneMarkCount] = useState(5);
  const [twoMarkCount, setTwoMarkCount] = useState(5);
  const [fourMarkCount, setFourMarkCount] = useState(5);
  const [extendedCount, setExtendedCount] = useState(5);
  const [topicWeighting, setTopicWeighting] = useState("");
  const [includeDiagrams, setIncludeDiagrams] = useState(true);
  const [includeMCQ, setIncludeMCQ] = useState(false);
  const [includeGraphs, setIncludeGraphs] = useState(true);
  
  // Timer settings
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(60);
  const [durationError, setDurationError] = useState(false);
  
  // Generation states
  const [generating, setGenerating] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [showGenerationComplete, setShowGenerationComplete] = useState(false);
  const [generatedDraftId, setGeneratedDraftId] = useState("");
  const [totalQuestionsGenerated, setTotalQuestionsGenerated] = useState(0);
  const [duration, setDuration] = useState(60);
  
  // Subject mismatch detection state
  const [subjectMismatchData, setSubjectMismatchData] = useState<{
    detected: string;
    confidence: number;
    reasoning: string;
    userSelected: string;
  } | null>(null);
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  
  const [uploading, setUploading] = useState(false);

  const loadingMessages = [
    "Analyzing your exam document...",
    "Generating fresh questions using AI...",
    "Handling diagrams and formatting...",
    "Matching your specification requirements...",
    "This may take a moment — hang tight!",
    "Almost there... preparing your exam!"
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSpecFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSpecFile(e.target.files[0]);
    }
  };

  // Load saved subject color when subject changes
  useEffect(() => {
    if (subjectId) {
      const savedColor = getSubjectColor(subjectId);
      if (savedColor !== '#3B82F6') {
        setSubjectColor(savedColor);
      }
    }
  }, [subjectId, getSubjectColor]);

  // Handle subject selection with random color assignment
  const handleSubjectChange = (newSubject: string) => {
    setSubjectId(newSubject);
    
    // Get existing color or assign random
    const existingColor = getSubjectColor(newSubject);
    if (existingColor === '#3B82F6') {
      // Subject doesn't exist yet, assign random color
      const randomColor = getRandomColor();
      setSubjectColor(randomColor);
    } else {
      // Use existing color
      setSubjectColor(existingColor);
    }
  };

  const handleGenerate = async () => {
    // Validation
    if (!examName.trim()) {
      setExamNameError(true);
      toast({
        title: "Exam Name Required",
        description: "Please enter a name for your exam",
        variant: "destructive",
      });
      return;
    }
    
    if (!subjectId) {
      toast({
        title: "Subject Required",
        description: "Please select a subject",
        variant: "destructive",
      });
      return;
    }
    
    if (!examBoard) {
      toast({
        title: "Exam Board Required",
        description: "Please select an exam board",
        variant: "destructive",
      });
      return;
    }
    
    if (!file) {
      toast({
        title: "Exam Document Required",
        description: "Please upload an exam document",
        variant: "destructive",
      });
      return;
    }

    if (!educationalTier) {
      toast({
        title: "Educational Level Required",
        description: "Please select an educational level",
        variant: "destructive",
      });
      return;
    }

    if (educationalTier === 'other' && !customTier.trim()) {
      toast({
        title: "Custom Level Required",
        description: "Please specify your educational level",
        variant: "destructive",
      });
      return;
    }

    if (timerEnabled && (!duration || duration <= 0)) {
      setDurationError(true);
      toast({
        title: "Invalid Duration",
        description: "Please enter a positive duration",
        variant: "destructive",
      });
      return;
    }

    // Save subject color to database for consistency
    if (subjectId && subjectColor) {
      await saveOrUpdateSubject(subjectId, subjectColor);
    }

    setGenerating(true);
    setCurrentMessage(loadingMessages[0]);

    // Rotate messages every 4 seconds
    let messageInterval: number | undefined;
    let pollInterval: number | undefined;

    messageInterval = window.setInterval(() => {
      setCurrentMessage(prev => {
        const currentIndex = loadingMessages.indexOf(prev);
        return loadingMessages[(currentIndex + 1) % loadingMessages.length];
      });
    }, 4000);

    try {
      // Upload exam with all settings
      const finalExamBoard = examBoard === 'other' ? customExamBoard : examBoard;
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subjectId', subjectId);
      formData.append('fileName', examName);
      formData.append('examBoard', finalExamBoard);
      if (qualificationLevel) formData.append('qualificationLevel', qualificationLevel);
      if (specFile) formData.append('specFile', specFile);
      if (notes) formData.append('notes', notes);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-exam', {
        body: formData,
      });

      if (uploadError) throw uploadError;

      const draftId = uploadData.draftId;

      // Save format
      const format = {
        useOriginal,
        educationalTier: educationalTier === 'other' ? customTier : educationalTier,
        ...((!useOriginal) && {
          totalQuestions,
          oneMarkCount,
          twoMarkCount,
          fourMarkCount,
          extendedCount,
          topicWeighting,
          includeDiagrams,
          includeMCQ,
          includeGraphs,
        }),
      };

      const { error: formatError } = await supabase.functions.invoke('save-exam-format', {
        body: { draftId, format },
      });

      if (formatError) throw formatError;

      // Save timer
      const { error: timerError } = await supabase.functions.invoke('save-exam-timer', {
        body: { draftId, enabled: timerEnabled, duration },
      });

      if (timerError) throw timerError;

      // Start extraction (returns immediately)
      const { error: extractError } = await supabase.functions.invoke(
        'extract-exam-questions',
        { body: { draftId } }
      );

      if (extractError) throw extractError;

      // Poll for completion
      const pollForCompletion = async () => {
        const { data: exam } = await supabase
          .from('exams')
          .select('extraction_status, total_questions_extracted, extraction_error, subject_mismatch, detected_subject, subject_confidence')
          .eq('id', draftId)
          .single();

        if (!exam) return false;

        if (exam.extraction_status === 'completed') {
          if (messageInterval) clearInterval(messageInterval);
          if (pollInterval) clearInterval(pollInterval);

          // Check for subject mismatch
          if (exam.subject_mismatch) {
            setSubjectMismatchData({
              detected: exam.detected_subject,
              confidence: exam.subject_confidence,
              reasoning: 'Subject mismatch detected',
              userSelected: subjectId
            });
            setGeneratedDraftId(draftId);
            setTotalQuestionsGenerated(exam.total_questions_extracted || 0);
            setShowMismatchWarning(true);
            setGenerating(false);
            return true;
          }

          // Show completion modal
          setGeneratedDraftId(draftId);
          setTotalQuestionsGenerated(exam.total_questions_extracted || 0);
          setShowGenerationComplete(true);
          setGenerating(false);
          return true;
        } else if (exam.extraction_status === 'failed') {
          if (messageInterval) clearInterval(messageInterval);
          if (pollInterval) clearInterval(pollInterval);
          setGenerating(false);
          throw new Error(exam.extraction_error || 'Extraction failed');
        }
        return false;
      };

      // Poll every 2 seconds
      pollInterval = window.setInterval(async () => {
        const completed = await pollForCompletion();
        if (completed && pollInterval) clearInterval(pollInterval);
      }, 2000);

      // Initial check
      await pollForCompletion();
    } catch (error: any) {
      console.error('Generation error:', error);
      if (messageInterval) clearInterval(messageInterval);
      if (pollInterval) clearInterval(pollInterval);
      setGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Something went wrong — please check your file and try again.",
        variant: "destructive",
      });
    }
  };

  const handleReviewQuestions = () => {
    setShowGenerationComplete(false);
    navigate(`/upload/${generatedDraftId}/review-questions`);
  };

  const handleBeginExam = async () => {
    setShowGenerationComplete(false);
    await publishExamAndNavigate(generatedDraftId, 'begin');
  };

  const handleSaveAndPublish = async () => {
    setShowGenerationComplete(false);
    await publishExamAndNavigate(generatedDraftId, 'save');
  };

  const publishExamAndNavigate = async (draftId: string, action: 'begin' | 'save') => {
    try {
      const { data, error } = await supabase.functions.invoke('publish-exam', {
        body: { draftId }
      });

      if (error) throw error;

      toast({
        title: "Exam Published",
        description: "Your exam is ready!",
      });

      if (action === 'save') {
        toast({
          title: "Exam Saved",
          description: "Your exam has been saved to My Exams",
        });
        navigate('/my-exams');
      } else if (action === 'begin') {
        navigate(`/exam/${data.examId}/live?mode=student`);
      }
    } catch (error: any) {
      toast({
        title: "Publish Failed",
        description: error.message || "Failed to publish exam",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 -mx-6 -mt-6 px-6 py-6 bg-background sticky top-0 z-10 border-b border-border">
            <h1 className="text-3xl font-bold">Create Mock Exam</h1>
            <Button
              onClick={handleGenerate}
              disabled={generating || !file || !subjectId || !examBoard || !educationalTier}
              size="lg"
              className="px-8 button-glow"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>

          <div className="space-y-6">
            {/* Row 1: Exam Name & Subject */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Input
                  placeholder="Enter exam name..."
                  value={examName}
                  onChange={(e) => {
                    setExamName(e.target.value);
                    if (e.target.value.trim()) {
                      setExamNameError(false);
                    }
                  }}
                  className={`h-12 text-base bg-card ${examNameError ? 'border-destructive focus-visible:ring-destructive' : 'border-border'}`}
                />
                {examNameError && (
                  <p className="text-sm text-destructive mt-1">Exam name is required</p>
                )}
              </div>
              <SubjectSelector
                value={subjectId}
                color={subjectColor}
                onValueChange={handleSubjectChange}
                onColorChange={setSubjectColor}
                showLabel={false}
              />
            </div>

            {/* Row 2: Notes (Full Width) */}
            <Textarea
              placeholder="Notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px] bg-card border-border resize-none"
            />

            {/* Row 3: File Uploads & Exam Board */}
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="relative">
                <input
                  id="exam-file"
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 justify-start bg-card border-border hover:bg-accent"
                  onClick={() => document.getElementById('exam-file')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {file ? file.name.substring(0, 18) + '...' : 'Upload Exam Document'}
                </Button>
              </div>

              <div className="relative">
                <input
                  id="spec-file"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleSpecFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 justify-start bg-card border-border hover:bg-accent"
                  onClick={() => document.getElementById('spec-file')?.click()}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {specFile ? specFile.name.substring(0, 18) + '...' : 'Exam Specification'}
                </Button>
              </div>

              <Select value={examBoard} onValueChange={setExamBoard}>
                <SelectTrigger className="h-12 bg-card border-border">
                  <SelectValue placeholder="Exam Board" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {examBoards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Custom Exam Board Input (if "Other" selected) */}
            {examBoard === 'other' && (
              <Input
                placeholder="Enter custom exam board..."
                value={customExamBoard}
                onChange={(e) => setCustomExamBoard(e.target.value)}
                className="h-12 bg-card border-border"
              />
            )}

            {/* Row 5: Combined Settings Container & Configuration Summary */}
            <div className="grid lg:grid-cols-[1fr_380px] gap-6">
              {/* Left: Format, Difficulty, Timer */}
              <Card className="p-6 bg-card/50 border-border">
                {/* Format Selection */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Format Selection</h2>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border">
                    <div className="flex-1">
                      <Label className="text-base font-medium">Use Original Structure</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground">
                          AI generates new questions matching the original format
                        </p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button">
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm bg-popover border-border">
                              <p className="font-medium mb-2">✨ Full AI Generation Mode</p>
                              <ul className="text-xs space-y-1.5 list-disc list-inside">
                                <li><strong>Preserves:</strong> Question count, types, marks, topic flow</li>
                                <li><strong>Regenerates:</strong> ALL question text with different wording</li>
                                <li><strong>Changes:</strong> Examples, numerical values, scenarios</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <Switch
                      checked={useOriginal}
                      onCheckedChange={setUseOriginal}
                    />
                  </div>
                  
                  {/* Custom Exam Structure Panel */}
                  {!useOriginal && (
                    <div className="mt-4 p-5 bg-background rounded-lg border border-border space-y-5">
                      <div className="flex items-center gap-2 mb-2">
                        <SlidersHorizontal className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Custom Exam Structure</h3>
                      </div>
                      
                      {/* Total Questions */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Total Number of Questions</Label>
                        <Input
                          type="number"
                          value={totalQuestions}
                          onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 0)}
                          min="1"
                          className="h-10 bg-card"
                        />
                      </div>

                      {/* Question Distribution */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium block">Question Distribution</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">1-Mark Questions</Label>
                            <Input
                              type="number"
                              value={oneMarkCount}
                              onChange={(e) => setOneMarkCount(parseInt(e.target.value) || 0)}
                              min="0"
                              className="h-9 bg-card text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">2-Mark Questions</Label>
                            <Input
                              type="number"
                              value={twoMarkCount}
                              onChange={(e) => setTwoMarkCount(parseInt(e.target.value) || 0)}
                              min="0"
                              className="h-9 bg-card text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">4-Mark Questions</Label>
                            <Input
                              type="number"
                              value={fourMarkCount}
                              onChange={(e) => setFourMarkCount(parseInt(e.target.value) || 0)}
                              min="0"
                              className="h-9 bg-card text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Extended (6-10 marks)</Label>
                            <Input
                              type="number"
                              value={extendedCount}
                              onChange={(e) => setExtendedCount(parseInt(e.target.value) || 0)}
                              min="0"
                              className="h-9 bg-card text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Topic Weighting */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Topic Weighting (Optional)</Label>
                        <Textarea
                          placeholder="e.g., Mechanics 40%, Electricity 30%, Waves 30%"
                          value={topicWeighting}
                          onChange={(e) => setTopicWeighting(e.target.value)}
                          className="min-h-[70px] bg-card border-border resize-none text-sm"
                        />
                      </div>

                      {/* Question Features */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium block">Question Features</Label>
                        
                        <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                          <Label className="text-sm cursor-pointer">Include Diagrams or Data Tables</Label>
                          <Switch
                            checked={includeDiagrams}
                            onCheckedChange={setIncludeDiagrams}
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                          <Label className="text-sm cursor-pointer">Include Multiple-Choice Section</Label>
                          <Switch
                            checked={includeMCQ}
                            onCheckedChange={setIncludeMCQ}
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                          <Label className="text-sm cursor-pointer">Include Graph-Based Questions</Label>
                          <Switch
                            checked={includeGraphs}
                            onCheckedChange={setIncludeGraphs}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Educational Level */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <SlidersHorizontal className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Educational Level</h2>
                  </div>
                  <Select value={educationalTier} onValueChange={setEducationalTier}>
                    <SelectTrigger className="h-12 bg-background border-border">
                      <SelectValue placeholder="Select educational level..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border max-h-[400px]">
                      {educationalTiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id} className="py-3">
                          <div>
                            <div className="font-medium">{tier.name}</div>
                            <div className="text-xs text-muted-foreground">{tier.desc}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {educationalTier === 'other' && (
                    <div className="mt-3">
                      <Input
                        placeholder='e.g., "German Abitur", "CBSE India", "SAT Prep"'
                        value={customTier}
                        onChange={(e) => setCustomTier(e.target.value)}
                        className="h-11 bg-background border-border"
                      />
                    </div>
                  )}
                </div>

                {/* Timer Setup */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Timer Set up</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border">
                      <div className="flex-1">
                        <Label className="text-base font-medium">Enable Timer</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-muted-foreground">
                            Add a Time Limit to the exam
                          </p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button">
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-popover border-border">
                                <p className="max-w-xs">Students will see a countdown timer and must submit before time runs out.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <Switch
                        checked={timerEnabled}
                        onCheckedChange={setTimerEnabled}
                      />
                    </div>

                    {timerEnabled && (
                      <div className="pt-2">
                        <Label className="text-sm font-medium mb-2 block">Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={duration || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              setDuration(0);
                            } else {
                              setDuration(parseInt(value) || 0);
                            }
                            if (parseInt(value) > 0) {
                              setDurationError(false);
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value) {
                              // Strip leading zeros and update
                              const parsed = parseInt(value);
                              if (!isNaN(parsed)) {
                                setDuration(parsed);
                              }
                            }
                          }}
                          min="1"
                          placeholder="Enter duration in minutes"
                          className={`h-11 bg-background ${durationError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        {durationError && (
                          <p className="text-sm text-destructive mt-1">Please enter a valid duration</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Right: Configuration Summary */}
              <Card className="p-6 bg-card/50 border-border h-fit">
                <h3 className="text-lg font-semibold mb-6">Configuration Summary</h3>
                
                <div className="space-y-4">
                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-1">Name and Subject</p>
                    <p className="font-medium">
                      {examName || 'Math Test 1'} {subjectId && <span style={{ color: subjectColor }}>{subjectId}</span>}
                    </p>
                  </div>

                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-1">Uploaded Exam</p>
                    <p className="font-medium text-muted-foreground">
                      {file ? file.name : 'No file uploaded'}
                    </p>
                  </div>

                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-1">Exam Structure</p>
                    <p className="font-medium">
                      {useOriginal ? (
                        "As per original"
                      ) : (
                        <span className="text-sm">
                          Custom: {totalQuestions} questions<br/>
                          {oneMarkCount > 0 && `${oneMarkCount} × 1-mark, `}
                          {twoMarkCount > 0 && `${twoMarkCount} × 2-mark, `}
                          {fourMarkCount > 0 && `${fourMarkCount} × 4-mark, `}
                          {extendedCount > 0 && `${extendedCount} × extended`}
                          {topicWeighting && <><br/>Topics: {topicWeighting}</>}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-1">Educational Level</p>
                    <p className="font-medium">
                      {educationalTier 
                        ? (educationalTier === 'other' 
                            ? (customTier || 'Not specified') 
                            : educationalTiers.find(t => t.id === educationalTier)?.name)
                        : 'Not selected'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Time limit</p>
                    <p className="font-medium">
                      {timerEnabled ? `${duration} minutes` : 'No time limit'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Screen */}
      {generating && (
        <GenerationLoadingScreen
          message={currentMessage}
          subjectColor={subjectColor}
          estimatedTime={300}
        />
      )}

      {showGenerationComplete && (
        <GenerationCompleteModal
          draftId={generatedDraftId}
          totalQuestions={totalQuestionsGenerated}
          subjectColor={subjectColor}
          examName={examName}
          onReview={handleReviewQuestions}
          onBeginExam={handleBeginExam}
          onSaveAndPublish={handleSaveAndPublish}
        />
      )}

      {/* Subject Mismatch Warning Modal */}
      {showMismatchWarning && subjectMismatchData && (
        <Dialog open={showMismatchWarning} onOpenChange={setShowMismatchWarning}>
          <DialogContent className="sm:max-w-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-2 border-amber-400">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Subject Mismatch Detected
              </DialogTitle>
              <DialogDescription className="text-amber-800 dark:text-amber-200 space-y-3 pt-2">
                <p className="font-medium">
                  ⚠️ Heads up! This file looks more like{" "}
                  <span className="font-bold text-amber-900 dark:text-amber-100">
                    {subjectMismatchData.detected}
                  </span>{" "}
                  than{" "}
                  <span className="font-bold text-amber-900 dark:text-amber-100">
                    {subjectMismatchData.userSelected}
                  </span>.
                </p>
                
                <p className="text-sm">
                  Are you sure{" "}
                  <span className="font-bold text-amber-900 dark:text-amber-100 underline">
                    {file?.name}
                  </span>{" "}
                  is the right upload?
                </p>
                
                <div className="bg-white/50 dark:bg-black/20 rounded-md p-3 text-xs">
                  <p className="font-semibold mb-1">AI Analysis:</p>
                  <p>{subjectMismatchData.reasoning}</p>
                  <p className="mt-2 text-amber-700 dark:text-amber-300">
                    Confidence: {(subjectMismatchData.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMismatchWarning(false);
                  setSubjectMismatchData(null);
                  setFile(null);
                  toast({
                    title: "Upload Cancelled",
                    description: "Please upload the correct file"
                  });
                }}
                className="w-full sm:w-auto border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                Replace File
              </Button>
              
              <Button
                onClick={() => {
                  setShowMismatchWarning(false);
                  setShowGenerationComplete(true);
                  toast({
                    title: "Proceeding with Warning",
                    description: `Generated exam appears to be ${subjectMismatchData.detected}-based`
                  });
                }}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
              >
                Continue Anyway →
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}