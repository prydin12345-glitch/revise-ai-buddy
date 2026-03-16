import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLevelsForBoard } from "@/lib/board-level-mapping";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Clock, SlidersHorizontal, Info, Sparkles, AlertTriangle, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { GenerationLoadingScreen } from "@/components/exam/GenerationLoadingScreen";
import { TutorExamCompleteModal } from "@/components/tutor/TutorExamCompleteModal";
import { ExamGenerationFailedModal } from "@/components/tutor/ExamGenerationFailedModal";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResourceModeSelector, type ResourceMode } from "@/components/practice/ResourceModeSelector";
import { ResourcePackUploader, type ResourcePack } from "@/components/practice/ResourcePackUploader";
import { ResourcePackPreview } from "@/components/practice/ResourcePackPreview";
import { AIResourceGenerator } from "@/components/practice/AIResourceGenerator";
import { CurriculumPromptModal } from "@/components/exam/CurriculumPromptModal";

// Legacy arrays removed - exam board is now auto-detected

// Dynamic levels from board-level mapping

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#14B8A6", "#FF7F6A",
  "#F59E0B", "#EC4899", "#EF4444", "#6366F1", "#06B6D4",
];

const getRandomColor = () => {
  return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
};

export default function CreateTutorExam() {
  const navigate = useNavigate();
  const { getSubjectColor, saveOrUpdateSubject, getSubjectExamBoard } = useUserSubjects();
  const { getProfilesForSubject, getTopicsForSubject } = useSubjectProfiles();
  const { preferences } = useUserPreferences();
  
  // Smart profile prompt state
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [profileMaxQuestions, setProfileMaxQuestions] = useState<number | null>(null);
  
  // Basic info
  const [examName, setExamName] = useState("");
  const [examNameError, setExamNameError] = useState(false);
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  const [examBoard] = useState("");
  const [qualificationLevel] = useState("");
  
  // File uploads
  const [file, setFile] = useState<File | null>(null);
  const [specFile, setSpecFile] = useState<File | null>(null);
  
  // Resource Pack state
  const [resourceMode, setResourceMode] = useState<ResourceMode>('none');
  const [resourcePack, setResourcePack] = useState<ResourcePack | null>(null);
  
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
  const [showGenerationFailed, setShowGenerationFailed] = useState(false);
  const [extractionError, setExtractionError] = useState("");
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
    setSelectedProfile(null);
    setProfileMaxQuestions(null);
    
    // Get existing color or assign random
    const existingColor = getSubjectColor(newSubject);
    if (existingColor === '#3B82F6') {
      const randomColor = getRandomColor();
      setSubjectColor(randomColor);
    } else {
      setSubjectColor(existingColor);
    }

    // Smart prompt: check if user has topics/profiles for this subject
    const topics = getTopicsForSubject(newSubject);
    if (topics.length > 1) {
      setShowProfilePrompt(true);
    }
  };

  const handleSelectProfile = (profileId: string) => {
    const profile = getProfilesForSubject(subjectId).find(p => p.id === profileId);
    if (profile) {
      setSelectedProfile(profileId);
      setProfileMaxQuestions(profile.question_count);
      setTotalQuestions(Math.min(totalQuestions, profile.question_count));
      setNotes(prev => {
        const profileNote = `[Exam Profile: ${profile.profile_name}] Topics: ${profile.topics.join(', ')}`;
        return prev ? `${prev}\n${profileNote}` : profileNote;
      });
    }
    setShowProfilePrompt(false);
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

    // Save subject color to database for consistency (non-blocking)
    if (subjectId && subjectColor) {
      try {
        await saveOrUpdateSubject(subjectId, subjectColor);
      } catch (prefError) {
        console.warn('Subject preference save failed, continuing with generation:', prefError);
        // Don't block generation - this is non-critical
      }
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subjectId', subjectId);
      formData.append('fileName', examName);
      if (examBoard) formData.append('examBoard', examBoard);
      if (qualificationLevel) formData.append('qualificationLevel', qualificationLevel);
      if (notes) formData.append('notes', notes);
      if (resourcePack) formData.append('resourcePackId', resourcePack.id);

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
          setExtractionError(exam.extraction_error || 'Extraction failed - please try again');
          setGeneratedDraftId(draftId);
          setShowGenerationFailed(true);
          return true;
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

  const handleSaveAsDraft = async () => {
    setShowGenerationComplete(false);
    setShowGenerationFailed(false);
    toast({
      title: "Exam Saved",
      description: "Your exam has been saved as a draft.",
    });
    navigate('/tutor/exams');
  };

  const handleRetryGeneration = () => {
    setShowGenerationFailed(false);
    setExtractionError("");
    handleGenerate();
  };

  const handleUploadDifferent = () => {
    setShowGenerationFailed(false);
    setExtractionError("");
    setFile(null);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 -mx-6 -mt-6 px-6 py-6 bg-background sticky top-0 z-10 border-b border-border">
            <h1 className="text-3xl font-bold">Create Exam</h1>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/tutor/exams/create-manual")}
                className="gap-2"
              >
                <FileText className="h-5 w-5" />
                Build Manually
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !file || !subjectId || !educationalTier}
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

            {/* Resource Pack Section */}
            <Card className="p-6 bg-card/50 border-border">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Resource Pack / Insert</h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-popover border-border">
                      <p className="font-medium mb-2">📚 Resource Pack System</p>
                      <ul className="text-xs space-y-1.5 list-disc list-inside">
                        <li><strong>Standalone:</strong> Traditional exam without shared resources</li>
                        <li><strong>Upload Insert:</strong> Upload an exam insert PDF (e.g., AQA English Insert) to link questions to shared sources</li>
                        <li><strong>AI Generated:</strong> Let AI create realistic case studies, data tables, or text extracts</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <ResourceModeSelector
                value={resourceMode}
                onChange={setResourceMode}
                subjectColor={subjectColor}
                disabled={generating}
              />

              {resourceMode === 'uploaded' && (
                <div className="mt-4">
                  <ResourcePackUploader
                    subjectId={subjectId}
                    educationalTier={educationalTier === 'other' ? customTier : educationalTier}
                    examBoard={examBoard}
                    onPackReady={setResourcePack}
                    onPackCleared={() => setResourcePack(null)}
                    currentPack={resourcePack}
                    subjectColor={subjectColor}
                  />
                </div>
              )}

              {resourceMode === 'ai_generated' && !resourcePack && (
                <div className="mt-4">
                  <AIResourceGenerator
                    subjectId={subjectId}
                    educationalTier={educationalTier === 'other' ? customTier : educationalTier}
                    examBoard={examBoard}
                    subtopics={[]}
                    onPackReady={setResourcePack}
                    subjectColor={subjectColor}
                  />
                </div>
              )}

              {resourcePack && resourceMode !== 'none' && (
                <div className="mt-4">
                  <ResourcePackPreview
                    pack={resourcePack}
                    subjectColor={subjectColor}
                    maxHeight="300px"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResourcePack(null)}
                    className="mt-3"
                  >
                    Clear Resource Pack
                  </Button>
                </div>
              )}
            </Card>

            {/* Row 3: File Upload */}
            <div className="grid lg:grid-cols-2 gap-4">
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
            </div>

            {/* Format & Educational Tier Settings */}
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
                  <SelectContent className="bg-popover border-border">
                    {EDUCATIONAL_TIERS.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        {tier.name}
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
                  <h2 className="text-lg font-semibold">Timer Setup</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border">
                    <div className="flex-1">
                      <Label className="text-base font-medium">Enable Timer</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add a time limit to the exam
                      </p>
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
                        min="1"
                        placeholder="e.g., 60"
                        className={`h-11 bg-background ${durationError ? 'border-destructive' : 'border-border'}`}
                      />
                      {durationError && (
                        <p className="text-sm text-destructive mt-1">Please enter a valid duration</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Loading Screen */}
        {generating && (
          <GenerationLoadingScreen message={currentMessage} />
        )}

        {/* Generation Complete Modal */}
        {showGenerationComplete && (
          <TutorExamCompleteModal
            draftId={generatedDraftId}
            totalQuestions={totalQuestionsGenerated}
            subjectColor={subjectColor}
            examName={examName}
            onReview={handleReviewQuestions}
            onSaveAsDraft={handleSaveAsDraft}
          />
        )}

        {/* Generation Failed Modal */}
        {showGenerationFailed && (
          <ExamGenerationFailedModal
            errorMessage={extractionError}
            onRetry={handleRetryGeneration}
            onSaveAsDraft={handleSaveAsDraft}
            onUploadDifferent={handleUploadDifferent}
          />
        )}

        {/* Subject Mismatch Warning Dialog */}
        {showMismatchWarning && subjectMismatchData && (
          <Dialog open={showMismatchWarning} onOpenChange={setShowMismatchWarning}>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <DialogTitle>Subject Mismatch Detected</DialogTitle>
                </div>
                <DialogDescription>
                  The AI detected a possible mismatch between the selected subject and the exam content.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="p-3 bg-accent/50 rounded-lg">
                  <p className="text-sm font-medium">You selected:</p>
                  <p className="text-base">{subjectMismatchData.userSelected}</p>
                </div>
                <div className="p-3 bg-accent/50 rounded-lg">
                  <p className="text-sm font-medium">AI detected:</p>
                  <p className="text-base">{subjectMismatchData.detected}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confidence: {Math.round(subjectMismatchData.confidence * 100)}%
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowMismatchWarning(false);
                  setShowGenerationComplete(true);
                }}>
                  Continue Anyway
                </Button>
                <Button onClick={() => {
                  setShowMismatchWarning(false);
                  navigate('/tutor/exams');
                }}>
                  Cancel & Go Back
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Smart Profile Prompt Modal */}
        <CurriculumPromptModal
          open={showProfilePrompt}
          onOpenChange={setShowProfilePrompt}
          subjectName={subjectId}
          subjectColor={subjectColor}
          masterTopics={getTopicsForSubject(subjectId)}
          profiles={getProfilesForSubject(subjectId)}
          onPracticeAll={(topics) => {
            setNotes(prev => {
              const topicNote = `[All Saved Topics] Topics: ${topics.join(', ')}`;
              return prev ? `${prev}\n${topicNote}` : topicNote;
            });
            setShowProfilePrompt(false);
          }}
          onSelectProfile={(profile) => {
            handleSelectProfile(profile.id);
          }}
          onStandardMode={() => {
            setShowProfilePrompt(false);
          }}
        />
      </div>
    </div>
  );
}
