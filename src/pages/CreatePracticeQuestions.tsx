import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Upload, Info, Settings2, ChevronDown, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { SubtopicSelector, detectBoardFingerprint, type BoardDetectionResult } from "@/components/practice/SubtopicSelector";
import { DifficultySettings } from "@/components/practice/DifficultySettings";
import { ResourceModeSelector, type ResourceMode } from "@/components/practice/ResourceModeSelector";
import { ResourcePackUploader, type ResourcePack } from "@/components/practice/ResourcePackUploader";
import { ResourcePackPreview } from "@/components/practice/ResourcePackPreview";
import { AIResourceGenerator } from "@/components/practice/AIResourceGenerator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PracticeSetCompleteModal } from "@/components/practice/PracticeSetCompleteModal";
import { GenerationLoadingScreen } from "@/components/exam/GenerationLoadingScreen";
import { NotesInput } from "@/components/ui/notes-input";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeNotes, type NotesSanitizationResult } from "@/lib/notes-sanitizer";
import { CurriculumPromptModal, TopicLimitWarning } from "@/components/exam/CurriculumPromptModal";
import { CurriculumTopicBadge } from "@/components/exam/CurriculumTopicBadge";
import { useExamNameValidator } from "@/hooks/useExamNameValidator";

const CreatePracticeQuestions = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getSubjectColor } = useUserSubjects();
  const { getProfilesForSubject, getTopicsForSubject } = useSubjectProfiles();
  
  // Smart profile prompt
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileMaxQuestions, setProfileMaxQuestions] = useState<number | null>(null);
  const [profileTopics, setProfileTopics] = useState<string[]>([]);

  const pollIntervalRef = useRef<number | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const generatingRef = useRef(false);

  // Form state
  const [setName, setSetName] = useState("");
  const nameValidator = useExamNameValidator('practice_question_sets');
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [difficultyMode, setDifficultyMode] = useState<"fixed" | "increasing" | "mixed">("increasing");
  const [difficultyLevel, setDifficultyLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [exampleFile, setExampleFile] = useState<File | null>(null);
  const [educationalTier, setEducationalTier] = useState("");
  const [examBoard, setExamBoard] = useState("");
  const [useAIInterpretation, setUseAIInterpretation] = useState(true);
  const [customEducationalTier, setCustomEducationalTier] = useState("");
  const [customExamBoard, setCustomExamBoard] = useState("");
  const [notesValidation, setNotesValidation] = useState<NotesSanitizationResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Board detection + deep topic scan state
  const [detectedBoard, setDetectedBoard] = useState<BoardDetectionResult | null>(null);
  const [autoExtractedTopics, setAutoExtractedTopics] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Resource pack state
  const [resourceMode, setResourceMode] = useState<ResourceMode>('none');
  const [resourcePack, setResourcePack] = useState<ResourcePack | null>(null);

  // Generation states
  const [generating, setGenerating] = useState(false);
  const [showGenerationComplete, setShowGenerationComplete] = useState(false);
  const [generatedSetId, setGeneratedSetId] = useState("");
  const [totalQuestionsGenerated, setTotalQuestionsGenerated] = useState(0);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollInFlightRef.current = false;
  };

  const stopGenerating = () => {
    clearPolling();
    generatingRef.current = false;
    setGenerating(false);
  };

  useEffect(() => {
    return () => {
      clearPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill from weak topics navigation
  const prefillSubtopic = searchParams.get("subtopic");
  const prefillSource = searchParams.get("source");

  useEffect(() => {
    if (prefillSubtopic && prefillSource === "weak_topics") {
      setSelectedSubtopics((prev) =>
        prev.includes(prefillSubtopic) ? prev : [...prev, prefillSubtopic]
      );
    }
  }, [prefillSubtopic, prefillSource]);

  const handleSubjectChange = (value: string) => {
    setSubjectId(value);
    setSubjectColor(getSubjectColor(value));
    setSelectedProfileId(null);
    setProfileMaxQuestions(null);
    setProfileTopics([]);
    
    // Check if user has topics for smart prompt
    const topics = getTopicsForSubject(value);
    if (topics.length > 1) {
      setShowProfilePrompt(true);
    }
  };

  const handleSelectProfile = (profileId: string) => {
    const profile = getProfilesForSubject(subjectId).find(p => p.id === profileId);
    if (profile) {
      setSelectedProfileId(profileId);
      setSelectedSubtopics(profile.topics);
      setProfileTopics(profile.topics);
      setProfileMaxQuestions(profile.question_count);
      setQuestionCount(Math.min(questionCount, profile.question_count));
    }
    setShowProfilePrompt(false);
  };

  // Deep Topic Scan: reads text from uploaded PDF and detects board + topics
  const handleExampleFileChange = async (file: File | null) => {
    setExampleFile(file);
    if (!file) {
      setDetectedBoard(null);
      setAutoExtractedTopics([]);
      return;
    }

    setIsScanning(true);
    setDetectedBoard(null);
    setAutoExtractedTopics([]);

    try {
      // Read file as text (best-effort — PDFs may be partially readable)
      const text = await file.text().catch(() => '');
      const scannedText = text.length > 50 ? text : '';

      // Board fingerprint detection (client-side, instant)
      const boardResult = detectBoardFingerprint(scannedText);
      setDetectedBoard(boardResult);

      // If board detected and no examBoard selected yet, set it silently (not aqa default)
      if (boardResult.board && !examBoard) {
        setExamBoard(boardResult.board);
      }

      // Simple keyword topic extraction from text (fallback without server call)
      if (scannedText.length > 100) {
        const topicKeywords = [
          'algebra', 'calculus', 'trigonometry', 'statistics', 'probability',
          'mechanics', 'kinematics', 'forces', 'energy', 'waves', 'optics',
          'electricity', 'magnetism', 'thermodynamics', 'genetics', 'evolution',
          'ecology', 'cell biology', 'organic chemistry', 'inorganic chemistry',
          'economics', 'microeconomics', 'macroeconomics', 'history', 'geography',
          'differentiation', 'integration', 'sequences', 'series', 'matrices',
          'vectors', 'complex numbers', 'logarithms', 'exponentials',
          'quadratics', 'polynomials', 'inequalities', 'coordinate geometry',
        ];
        const found = topicKeywords.filter(kw =>
          scannedText.toLowerCase().includes(kw)
        );
        if (found.length > 0) {
          // Capitalise and limit to 12 topics
          const formatted = found.slice(0, 12).map(t =>
            t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          );
          setAutoExtractedTopics(formatted);
        }
      }
    } catch (err) {
      console.error('Deep scan error:', err);
    } finally {
      setIsScanning(false);
    }
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

    if (educationalTier === "other" && !customEducationalTier.trim()) {
      toast.error("Please enter a custom educational level");
      return;
    }

    if (examBoard === "other" && !customExamBoard.trim()) {
      toast.error("Please enter a custom exam board");
      return;
    }

    // Check for duplicate name (real-time already shows warning, but double-check)
    if (nameValidator.isDuplicate) {
      toast.error("Name already exists. Please choose a different name.");
      return;
    }

    // Validate notes before generation
    if (notes.trim()) {
      const result = sanitizeNotes(notes);
      if (!result.isValid) {
        toast.error(result.blockedReasons[0] || "Please revise your notes");
        return;
      }
    }

    await proceedWithGeneration();
  };

  const proceedWithGeneration = async () => {
    clearPolling();
    generatingRef.current = true;
    setGenerating(true);
    try {
      // Check session first (faster, from cache)
      let { data: { session } } = await supabase.auth.getSession();
      
      // If no session or expired, try to refresh
      if (!session) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          toast.error("Your session has expired. Please refresh and try again.", {
            action: {
              label: "Refresh",
              onClick: () => window.location.reload(),
            },
            duration: 10000,
          });
          stopGenerating();
          return;
        }
        session = refreshData.session;
      }
      
      const user = session.user;
      if (!user) {
        toast.error("Please log in to generate practice questions.", {
          action: {
            label: "Log In",
            onClick: () => window.location.href = "/auth",
          },
          duration: 10000,
        });
        stopGenerating();
        return;
      }

      // Upload files if provided
      let exampleFileUrl = null;

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
          specification_file_url: null,
          example_questions_file_url: exampleFileUrl,
          educational_tier: educationalTier === "other" ? customEducationalTier : educationalTier,
          exam_board: examBoard === "other" ? customExamBoard : (examBoard || null),
          status: "draft",
          extraction_status: "pending",
          // Graphs and tables are now auto-detected by AI based on context
          include_graphs: true,
          include_tables: true,
          // Resource pack linking
          resource_pack_id: resourcePack?.id || null,
          resource_mode: resourceMode,
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

      if (genError) {
        // Handle auth errors specifically
        if (genError.message?.includes("JWT") || genError.message?.includes("auth") || genError.message?.includes("401")) {
          toast.error("Your session has expired. Please refresh and try again.", {
            action: {
              label: "Refresh",
              onClick: () => window.location.reload(),
            },
            duration: 10000,
          });
          stopGenerating();
          return;
        }
        throw genError;
      }

      // Poll for completion
      pollIntervalRef.current = window.setInterval(async () => {
        if (!generatingRef.current) return;
        if (pollInFlightRef.current) return;
        pollInFlightRef.current = true;

        try {
          const { data: checkData, error: checkError } = await supabase
            .from("practice_question_sets")
            .select("extraction_status, total_questions_generated, extraction_error")
            .eq("id", setData.id)
            .single();

          if (checkError) throw checkError;
          if (!checkData) return;

          if (checkData.extraction_status === "completed") {
            clearPolling();
            generatingRef.current = false;
            setTotalQuestionsGenerated(checkData.total_questions_generated || 0);
            setGenerating(false);
            setShowGenerationComplete(true);
          } else if (checkData.extraction_status === "failed") {
            clearPolling();
            generatingRef.current = false;
            setGenerating(false);
            toast.error(checkData.extraction_error || "Failed to generate questions. Please try again.");
          }
        } catch (e: any) {
          console.error("Polling error:", e);
          stopGenerating();
          toast.error(
            e?.message ||
              "Lost connection while checking generation status. Please refresh and try again."
          );
        } finally {
          pollInFlightRef.current = false;
        }
      }, 2000);

      // Timeout after 5 minutes
      pollTimeoutRef.current = window.setTimeout(() => {
        if (!generatingRef.current) return;
        clearPolling();
        generatingRef.current = false;
        setGenerating(false);
        toast.error("Generation timed out. Please try again.");
      }, 300000);
    } catch (error: any) {
      console.error("Error generating practice set:", error);
      
      // Better error messaging for common issues
      const errorMessage = error.message?.toLowerCase() || "";
      if (errorMessage.includes("auth") || errorMessage.includes("session") || errorMessage.includes("jwt")) {
        toast.error("Your session has expired. Please refresh and try again.", {
          action: {
            label: "Refresh",
            onClick: () => window.location.reload(),
          },
          duration: 10000,
        });
      } else {
        toast.error(error.message || "Failed to generate practice set");
      }
      stopGenerating();
    }
  };

  const handlePreview = () => {
    setShowGenerationComplete(false);
    navigate(`/practice-questions/${generatedSetId}/preview`);
  };

  const handleSaveToPracticeSets = async () => {
    try {
      if (!generatedSetId) return;

      await supabase
        .from('practice_question_sets')
        .update({ status: 'published' })
        .eq('id', generatedSetId);

      toast.success("Practice set saved successfully!");
      setShowGenerationComplete(false);
      navigate('/quizzes');
    } catch (error: any) {
      console.error("Error saving practice set:", error);
      toast.error(error.message || "Failed to save practice set");
    }
  };

  return (
    <DashboardLayout>
      <div className="container max-w-6xl mx-auto p-6 space-y-8">
        {/* Weak topics prefill banner */}
        {prefillSource === "weak_topics" && prefillSubtopic && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <Target className="inline h-4 w-4 mr-1.5 text-primary" />
              Creating targeted practice for weak topic:{" "}
              <strong className="text-foreground">{prefillSubtopic}</strong>
            </span>
            <button
              onClick={() => {
                setSearchParams({});
                setSelectedSubtopics((prev) => prev.filter((s) => s !== prefillSubtopic));
              }}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Clear ×
            </button>
          </div>
        )}
        {/* Sticky Header */}
        <div className="flex items-center justify-between sticky top-0 z-20 bg-background py-4 border-b -mx-6 px-6 -mt-6 mb-4">
          <div>
            <h1 className="text-3xl font-bold">Create Practice Questions</h1>
            <p className="text-muted-foreground mt-1">
              Generate targeted practice questions for specific subtopics
            </p>
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={generating || nameValidator.isDuplicate} 
            size="lg"
            style={{ backgroundColor: subjectColor }}
            className="hover:opacity-90"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Generate
          </Button>
        </div>

        {/* Main Form */}
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4 lg:gap-6">
          {/* Left Column - Form Fields */}
          <div className="space-y-4">
            {/* Set Name & Subject */}
            <Card className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="set-name">Set Name</Label>
                <Input
                  id="set-name"
                  placeholder="e.g. Sequences Drill Set"
                  value={setName}
                  onChange={(e) => {
                    setSetName(e.target.value);
                    nameValidator.checkName(e.target.value);
                  }}
                  className={nameValidator.isDuplicate ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {nameValidator.isDuplicate && (
                  <div className="space-y-1.5">
                    <p className="text-sm text-destructive">A practice set with this name already exists. Please choose a unique name.</p>
                    <div className="flex flex-wrap gap-2">
                      {nameValidator.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSetName(s);
                            nameValidator.checkName(s);
                          }}
                          className="text-xs px-2.5 py-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

              {/* Selected Profile / Curriculum Badge */}
              {selectedProfileId && profileTopics.length > 0 && (() => {
                const profile = selectedProfileId === 'all_topics'
                  ? null
                  : getProfilesForSubject(subjectId).find(p => p.id === selectedProfileId);
                return (
                  <CurriculumTopicBadge
                    profileName={profile?.profile_name || 'All Saved Topics'}
                    topics={profileTopics}
                    questionCount={questionCount}
                    questionLimit={profileMaxQuestions}
                    subjectColor={subjectColor}
                    onRemoveProfile={() => {
                      setSelectedProfileId(null);
                      setProfileMaxQuestions(null);
                      setProfileTopics([]);
                      setSelectedSubtopics([]);
                    }}
                    onActiveTopicsChange={(activeTopics) => {
                      setSelectedSubtopics(activeTopics);
                    }}
                  />
                );
              })()}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <NotesInput
                  value={notes}
                  onChange={setNotes}
                  onValidationChange={setNotesValidation}
                  placeholder="Add custom instructions e.g. 'Make it extra hard' or 'Focus on word problems'..."
                />
              </div>
            </Card>

            {/* Subtopic Selector */}
            {subjectId && (
              <Card className="p-4">
                <SubtopicSelector
                  subject={subjectId}
                  selectedSubtopics={selectedSubtopics}
                  onSubtopicsChange={setSelectedSubtopics}
                  educationalTier={educationalTier}
                  examBoard={examBoard}
                  useAIInterpretation={useAIInterpretation}
                  onAIInterpretationChange={setUseAIInterpretation}
                  autoExtractedTopics={autoExtractedTopics.length > 0 ? autoExtractedTopics : undefined}
                  detectedBoard={detectedBoard}
                  isScanning={isScanning}
                />
              </Card>
            )}

            {/* Difficulty Settings */}
            <DifficultySettings
              mode={difficultyMode}
              level={difficultyLevel}
              onModeChange={setDifficultyMode}
              onLevelChange={setDifficultyLevel}
            />

            {/* Visual Question Types - Auto-detected */}
            {/* Removed manual toggles - AI automatically includes graphs/tables when relevant to the subject/subtopics */}

            {/* Resource Mode Selection */}
            <ResourceModeSelector
              value={resourceMode}
              onChange={(mode) => {
                setResourceMode(mode);
                if (mode === 'none') {
                  setResourcePack(null);
                }
              }}
              subjectColor={subjectColor}
              disabled={generating}
            />

            {/* Resource Pack Upload (when mode is 'uploaded') */}
            {resourceMode === 'uploaded' && (
              <ResourcePackUploader
                subjectId={subjectId}
                educationalTier={educationalTier}
                examBoard={examBoard}
                onPackReady={setResourcePack}
                onPackCleared={() => setResourcePack(null)}
                currentPack={resourcePack}
                subjectColor={subjectColor}
              />
            )}

            {/* AI Resource Generation (when mode is 'ai_generated') */}
            {resourceMode === 'ai_generated' && !resourcePack && (
              <AIResourceGenerator
                subjectId={subjectId}
                educationalTier={educationalTier}
                examBoard={examBoard}
                subtopics={selectedSubtopics}
                onPackReady={setResourcePack}
                subjectColor={subjectColor}
              />
            )}

            {/* Resource Pack Preview (when pack is ready) */}
            {resourcePack && resourcePack.items.length > 0 && (
              <Card className="p-4">
                <ResourcePackPreview
                  pack={resourcePack}
                  subjectColor={subjectColor}
                  maxHeight="300px"
                />
              </Card>
            )}

            {/* File Uploads — Example Questions only */}
            <Card className="p-4">
              <Label className="text-sm font-medium mb-3 block">Example Questions (Optional)</Label>
              <div className="space-y-2">
                <input
                  type="file"
                  id="example-file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => handleExampleFileChange(e.target.files?.[0] || null)}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-16 flex-col gap-2"
                        onClick={() => document.getElementById("example-file")?.click()}
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-xs text-center">
                          {exampleFile ? exampleFile.name.slice(0, 20) + "..." : "📎 Upload Example Questions PDF"}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Upload example questions — AI will scan for topics and board style automatically</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Card>

            {/* Educational Level & Exam Board - Mobile */}
            <Card className="p-4 lg:hidden">
              <div className="space-y-4">
                {/* Educational Level */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="educational-tier-mobile">Educational Level</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Select level or enter custom</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={educationalTier} onValueChange={setEducationalTier}>
                    <SelectTrigger id="educational-tier-mobile">
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secondary_14_16">Level 1 — High School / Secondary (Ages 14–16)</SelectItem>
                      <SelectItem value="college_16_18">Level 2 — College / Sixth Form (Ages 16–18)</SelectItem>
                      <SelectItem value="university_18plus">Level 3 — University / Undergraduate (Ages 18+)</SelectItem>
                      <SelectItem value="other">Other (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  {educationalTier === "other" && (
                    <Input
                      placeholder="Enter custom educational level..."
                      value={customEducationalTier}
                      onChange={(e) => setCustomEducationalTier(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Board style is auto-detected from your uploaded document.
                </p>
              </div>
            </Card>
          </div>

          {/* Right Column - Summary (Desktop only uses sticky) */}
          <div className="hidden lg:block space-y-6">
            <Card className="p-6 sticky top-24 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: subjectColor }}>
                  Configuration Summary
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Selected Subject</p>
                    <p className="font-medium">{subjectId || "Not selected"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Selected Subtopics</p>
                    <p className="font-medium text-sm">
                      {selectedSubtopics.length > 0
                        ? selectedSubtopics.join(", ")
                        : "None"}
                    </p>
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
                    <p className="text-sm text-muted-foreground">Example Questions</p>
                    <p className="font-medium">{exampleFile ? exampleFile.name.slice(0, 20) + "…" : "None"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Educational Level</p>
                    <p className="font-medium text-sm">
                      {educationalTier === "other" ? customEducationalTier : educationalTier || "Not selected"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Number of Questions Slider */}
              <div className="border-t pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Questions</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{profileMaxQuestions ? `Limited to ${profileMaxQuestions} by profile` : 'Up to 30 questions recommended'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-2xl font-bold" style={{ color: subjectColor }}>
                      {questionCount}
                    </span>
                  </div>
                  
                  <Slider
                    min={1}
                    max={profileMaxQuestions || 30}
                    step={1}
                    value={[questionCount]}
                    onValueChange={(values) => setQuestionCount(values[0])}
                    className="w-full"
                    style={{
                      '--slider-track': 'hsl(var(--muted))',
                      '--slider-range': subjectColor,
                    } as React.CSSProperties}
                  />
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span>{profileMaxQuestions || 30}</span>
                  </div>

                  {selectedProfileId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      The AI will randomly select questions from your {selectedSubtopics.length} chosen topics to fit your question limit.
                    </p>
                  )}

                  <TopicLimitWarning
                    topicCount={selectedSubtopics.length}
                    questionCount={questionCount}
                    subjectColor={subjectColor}
                  />
                </div>
              </div>

              {/* Educational Level - Desktop */}
              <div className="border-t pt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="educational-tier">Educational Level</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Select level or enter custom</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={educationalTier} onValueChange={setEducationalTier}>
                    <SelectTrigger id="educational-tier">
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secondary_14_16">Level 1 — High School / Secondary (Ages 14–16)</SelectItem>
                      <SelectItem value="college_16_18">Level 2 — College / Sixth Form (Ages 16–18)</SelectItem>
                      <SelectItem value="university_18plus">Level 3 — University / Undergraduate (Ages 18+)</SelectItem>
                      <SelectItem value="other">Other (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  {educationalTier === "other" && (
                    <Input
                      placeholder="Enter custom educational level..."
                      value={customEducationalTier}
                      onChange={(e) => setCustomEducationalTier(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  Board style is auto-detected from your uploaded document.
                </p>
              </div>
            </Card>
          </div>

          {/* Mobile Configuration Summary - Not sticky, appears at bottom */}
          <div className="lg:hidden">
            <Card className="p-4 space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: subjectColor }}>
                Configuration Summary
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Subject</p>
                  <p className="font-medium">{subjectId || "Not selected"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Questions</p>
                  <p className="font-medium">{questionCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Difficulty</p>
                  <p className="font-medium capitalize">
                    {difficultyMode === "increasing"
                      ? "Increasing"
                      : difficultyMode === "mixed"
                      ? "Mixed"
                      : difficultyLevel}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Level</p>
                  <p className="font-medium">
                    {educationalTier === "other" ? customEducationalTier : educationalTier || "Not set"}
                  </p>
                </div>
              </div>
              
              {/* Mobile Questions Slider */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Questions</Label>
                  <span className="text-xl font-bold" style={{ color: subjectColor }}>
                    {questionCount}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={30}
                  step={1}
                  value={[questionCount]}
                  onValueChange={(values) => setQuestionCount(values[0])}
                  className="w-full"
                  style={{
                    '--slider-track': '#D3D3D3',
                    '--slider-range': subjectColor,
                  } as React.CSSProperties}
                />
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom spacing for mobile */}
        <div className="h-8 lg:hidden" />
      </div>

      {/* Modals */}
      {generating && (
        <GenerationLoadingScreen
          message="Creating your practice questions..."
          subjectColor={subjectColor}
          estimatedTime={30}
        />
      )}


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
      />

      {/* Smart Profile Prompt Modal */}
      <CurriculumPromptModal
        open={showProfilePrompt}
        onOpenChange={setShowProfilePrompt}
        subjectName={subjectId}
        subjectColor={subjectColor}
        masterTopics={getTopicsForSubject(subjectId)}
        profiles={getProfilesForSubject(subjectId)}
        onPracticeAll={(topics) => {
          setSelectedProfileId('all_topics');
          setProfileTopics(topics);
          setSelectedSubtopics(topics);
          setShowProfilePrompt(false);
        }}
        onSelectProfile={(profile) => {
          handleSelectProfile(profile.id);
        }}
        onStandardMode={() => {
          setShowProfilePrompt(false);
        }}
      />
    </DashboardLayout>
  );
};

export default CreatePracticeQuestions;
