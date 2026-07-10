import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Clock, SlidersHorizontal, Info, Sparkles, AlertTriangle, X } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SubtopicSelector } from "@/components/practice/SubtopicSelector";
import { GenerationLoadingScreen } from "@/components/exam/GenerationLoadingScreen";
import { StepWizard, useReviewEdit, type WizardStep } from "@/components/wizard/StepWizard";
import { ExamPaperCover } from "@/components/wizard/ExamPaperCover";
import { GenerationCompleteModal } from "@/components/exam/GenerationCompleteModal";
import { NotesInput } from "@/components/ui/notes-input";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { sanitizeNotes, type NotesSanitizationResult } from "@/lib/notes-sanitizer";
import { ResourceModeSelector, type ResourceMode } from "@/components/practice/ResourceModeSelector";
import { ResourcePackUploader, type ResourcePack } from "@/components/practice/ResourcePackUploader";
import { ResourcePackPreview } from "@/components/practice/ResourcePackPreview";
import { AIResourceGenerator } from "@/components/practice/AIResourceGenerator";
import { CurriculumPromptModal } from "@/components/exam/CurriculumPromptModal";
import { CurriculumTopicBadge } from "@/components/exam/CurriculumTopicBadge";
import { useExamNameValidator } from "@/hooks/useExamNameValidator";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { EXAM_BOARD_OPTIONS, getBoardDisplayName } from "@/lib/board-scrubber";
import { getRegionBoards, getLevelsForBoard, LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";

const EDUCATIONAL_TIERS = [
  { id: "secondary_14_16", name: "Level 1 — High School / Secondary (Ages 14–16)" },
  { id: "college_16_18", name: "Level 2 — College / Sixth Form (Ages 16–18)" },
  { id: "university_18plus", name: "Level 3 — University / Undergraduate (Ages 18+)" },
  { id: "other", name: "Other (Custom)" },
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
  const { getSubjectColor, saveOrUpdateSubject, getSubjectExamBoard } = useUserSubjects();
  const { getProfilesForSubject, getTopicsForSubject } = useSubjectProfiles();
  const { preferences, loading: prefsLoading } = useUserPreferences();
  
  // Smart profile prompt state
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [profileMaxQuestions, setProfileMaxQuestions] = useState<number | null>(null);
  const [profileTopics, setProfileTopics] = useState<string[]>([]);
  const [activeProfileTopics, setActiveProfileTopics] = useState<string[]>([]);
  // Manual subtopic selection for students WITHOUT a saved profile.
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [useAIInterpretation, setUseAIInterpretation] = useState(true);
  const [profileEducationalTier, setProfileEducationalTier] = useState<string | null>(null);
  const [profileTimeLimit, setProfileTimeLimit] = useState<number | null>(null);
  const [sessionTimeLimitOverride, setSessionTimeLimitOverride] = useState<number | null>(null);
  
  // Profile advanced structure state
  const [profileMcqCount, setProfileMcqCount] = useState<number | null>(null);
  const [profileWrittenCount, setProfileWrittenCount] = useState<number | null>(null);
  const [profileQuestionStructure, setProfileQuestionStructure] = useState<string | null>(null);
  const [profileParentQuestionCount, setProfileParentQuestionCount] = useState<number | null>(null);
  const [profileMaxPartsPerQuestion, setProfileMaxPartsPerQuestion] = useState<number | null>(null);
  const [profileDifficultyProgression, setProfileDifficultyProgression] = useState<string | null>(null);
  const [profileCalculatorPolicy, setProfileCalculatorPolicy] = useState<string | null>(null);
  const [profileMarkDistribution, setProfileMarkDistribution] = useState<Record<number, number> | null>(null);
  const [profileIncludeExtended, setProfileIncludeExtended] = useState<boolean | null>(null);
  const [profileExtendedMarks, setProfileExtendedMarks] = useState<number | null>(null);
  const [profileStructurePreset, setProfileStructurePreset] = useState<string | null>(null);
  const [profileMcqPosition, setProfileMcqPosition] = useState<string | null>(null);
  const [profileMcqOptionsCount, setProfileMcqOptionsCount] = useState<number | null>(null);
  const [profileIncludeGraphs, setProfileIncludeGraphs] = useState<boolean | null>(null);
  const [profileIncludeTables, setProfileIncludeTables] = useState<boolean | null>(null);
  
  // Basic info
  const [examName, setExamName] = useState("");
  const [examNameError, setExamNameError] = useState(false);
  const nameValidator = useExamNameValidator('exams');
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  // Legacy fields — now populated from preferences
  const [examBoard, setExamBoard] = useState("");
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
  // Resource insert (figures the questions reference) — offered for subjects
  // whose real papers carry one; defaults on when capable.
  const [includeInsert, setIncludeInsert] = useState(true);
  const [derivedTopicsOpen, setDerivedTopicsOpen] = useState(false);
  const [derivedTopics, setDerivedTopics] = useState<string[]>([]);
  const [derivedTopicInput, setDerivedTopicInput] = useState("");
  const deriveResolveRef = useRef<((topics: string[] | null) => void) | null>(null);
  const subjectSupportsInsert = /geograph|history|environment|earth science|english/i.test(subjectId || "");
  const [includeGraphs, setIncludeGraphs] = useState(true);
  
  // Timer settings
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(60);
  const [durationError, setDurationError] = useState(false);
  
  // Resource pack state
  const [resourceMode, setResourceMode] = useState<ResourceMode>('none');
  const [resourcePack, setResourcePack] = useState<ResourcePack | null>(null);
  
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

  // Auto-populate board & level from user preferences
  useEffect(() => {
    if (!prefsLoading && preferences) {
      if (preferences.preferred_exam_board && !examBoard) {
        setExamBoard(preferences.preferred_exam_board);
      }
      if (preferences.preferred_educational_level && !educationalTier) {
        setEducationalTier(preferences.preferred_educational_level);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoading, preferences]);

  // Turn an educational-tier value into a human label. Known ids use the
  // display map; unknown profile codes like "college_16_18" are humanised
  // (strip a leading qualifier word, turn an age span like 16_18 into
  // "16–18 years", and title-case the rest) so students never see raw codes.
  const formatLevelLabel = (tier: string | null | undefined): string => {
    if (!tier) return "Not set";
    if (LEVEL_DISPLAY_NAMES[tier]) return LEVEL_DISPLAY_NAMES[tier];
    const ageSpan = tier.match(/(\d{1,2})[_-](\d{1,2})/);
    if (ageSpan) return `${ageSpan[1]}\u2013${ageSpan[2]} years`;
    return tier
      .replace(/^(college|school|level\d*)[_-]/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .trim() || tier;
  };

  const effectiveExamBoard = examBoard || preferences?.preferred_exam_board || "";
  const effectiveEducationalTier =
    educationalTier === 'other'
      ? customTier.trim()
      : educationalTier || preferences?.preferred_educational_level || "";

  const hasLockedProfileStructure = !!selectedProfile && selectedProfile !== 'all_topics';
  // Per-exam structure unlock. The saved profile is never modified; this only
  // frees the structure controls for THIS exam after an explicit confirmation.
  const [structureUnlocked, setStructureUnlocked] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  // Re-lock automatically if the user switches profile.
  useEffect(() => { setStructureUnlocked(false); }, [selectedProfile]);
  const structureLocked = hasLockedProfileStructure && !structureUnlocked;
  const resolvedProfileMcqCount = profileMcqCount ?? 0;
  const resolvedProfileWrittenCount = profileWrittenCount ?? 0;
  const resolvedProfileMcqOptionsCount = profileMcqOptionsCount ?? 4;

  // Handle subject selection with random color assignment
  const handleSubjectChange = (newSubject: string) => {
    setSubjectId(newSubject);
    setSelectedProfile(null);
    setProfileMaxQuestions(null);
    setProfileTopics([]);
    setActiveProfileTopics([]);
    
    // Get existing color or assign random
    const existingColor = getSubjectColor(newSubject);
    if (existingColor === '#3B82F6') {
      const randomColor = getRandomColor();
      setSubjectColor(randomColor);
    } else {
      setSubjectColor(existingColor);
    }

    // Pull subject-level exam board if set
    const subjectBoard = getSubjectExamBoard(newSubject);
    if (subjectBoard) {
      setExamBoard(subjectBoard);
    }

    // Smart prompt: check if user has topics/profiles for this subject
    const topics = getTopicsForSubject(newSubject);
    const profiles = getProfilesForSubject(newSubject);
    if (profiles.length > 0 || topics.length > 1) {
      setShowProfilePrompt(true);
    }
  };

  const handleSelectProfile = (profileId: string) => {
    const profile = getProfilesForSubject(subjectId).find(p => p.id === profileId);
    if (profile) {
      setSelectedProfile(profileId);
      setProfileMaxQuestions(profile.question_count);
      setTotalQuestions(profile.question_count);
      setProfileTopics(profile.topics);
      setActiveProfileTopics(profile.topics);
      
      // Apply profile's educational tier and time limit
      if (profile.educational_tier) {
        setEducationalTier(profile.educational_tier);
        setProfileEducationalTier(profile.educational_tier);
      }
      if (profile.time_limit_minutes) {
        setTimerEnabled(true);
        setDuration(profile.time_limit_minutes);
        setProfileTimeLimit(profile.time_limit_minutes);
      }
      
      // Apply ALL advanced structure settings from profile
      setProfileMcqCount(profile.mcq_count ?? null);
      setProfileWrittenCount(profile.written_question_count ?? null);
      setProfileQuestionStructure(profile.question_structure ?? null);
      setProfileParentQuestionCount(profile.parent_question_count ?? null);
      setProfileMaxPartsPerQuestion(profile.max_parts_per_question ?? null);
      setProfileDifficultyProgression(profile.difficulty_progression ?? null);
      setProfileCalculatorPolicy(profile.calculator_policy ?? null);
      setProfileMarkDistribution(profile.mark_distribution ?? null);
      setProfileIncludeExtended(profile.include_extended ?? null);
      setProfileExtendedMarks(profile.extended_marks ?? null);
      setProfileStructurePreset(profile.structure_preset ?? null);
      setProfileMcqPosition(profile.mcq_position ?? null);
      setProfileMcqOptionsCount(profile.mcq_options_count ?? 4);
      setProfileIncludeGraphs(profile.include_graphs ?? false);
      setProfileIncludeTables(profile.include_tables ?? false);

      // Profile always overrides format structure
      setUseOriginal(false);
      setIncludeMCQ((profile.mcq_count ?? 0) > 0);
      setIncludeGraphs(profile.include_graphs ?? true);
      setIncludeDiagrams(profile.include_tables ?? true);
    }
    setShowProfilePrompt(false);
  };

  // Deep-link support from the subject pages:
  // /upload?subject=X&profileId=Y preselects the subject and profile.
  const [deepLinkParams] = useSearchParams();
  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    const urlSubject = deepLinkParams.get("subject");
    const urlProfileId = deepLinkParams.get("profileId");
    if (!urlSubject) { deepLinkAppliedRef.current = true; return; }
    if (!subjectId) { handleSubjectChange(urlSubject); return; }
    if (subjectId !== urlSubject) return;
    if (urlProfileId) {
      const match = getProfilesForSubject(subjectId).find((p) => p.id === urlProfileId);
      if (!match) return; // profiles may still be loading — retry next render
      handleSelectProfile(urlProfileId);
      setShowProfilePrompt(false); // the link already chose; don't prompt
    }
    deepLinkAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkParams, subjectId, getProfilesForSubject]);

  const handlePracticeAll = (topics: string[]) => {
    setSelectedProfile('all_topics');
    setProfileTopics(topics);
    setActiveProfileTopics(topics);
    setShowProfilePrompt(false);
  };

  const clearProfile = () => {
    setSelectedProfile(null);
    setProfileMaxQuestions(null);
    setProfileTopics([]);
    setActiveProfileTopics([]);
    setProfileEducationalTier(null);
    setProfileTimeLimit(null);
    setSessionTimeLimitOverride(null);
    setProfileMcqCount(null);
    setProfileWrittenCount(null);
    setProfileQuestionStructure(null);
    setProfileParentQuestionCount(null);
    setProfileMaxPartsPerQuestion(null);
    setProfileDifficultyProgression(null);
    setProfileCalculatorPolicy(null);
    setProfileMarkDistribution(null);
    setProfileIncludeExtended(null);
    setProfileExtendedMarks(null);
    setProfileStructurePreset(null);
    setProfileMcqPosition(null);
    setProfileMcqOptionsCount(null);
    setProfileIncludeGraphs(null);
    setProfileIncludeTables(null);
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


    if (!effectiveEducationalTier) {
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
      const formData = new FormData();
      const resolvedEducationalTier = effectiveEducationalTier;
      if (file) formData.append('file', file);
      formData.append('subjectId', subjectId);
      formData.append('fileName', examName);
      if (resolvedEducationalTier) formData.append('educationalTier', resolvedEducationalTier);
      if (effectiveExamBoard) formData.append('examBoard', effectiveExamBoard);
      if (qualificationLevel) formData.append('qualificationLevel', qualificationLevel);
      if (notes) formData.append('notes', notes);
      if (activeProfileTopics.length > 0) {
        formData.append('curriculumTopics', JSON.stringify(activeProfileTopics));
      } else if (selectedSubtopics.length > 0) {
        // No profile chosen — use the student's manually selected topics.
        formData.append('curriculumTopics', JSON.stringify(selectedSubtopics));
      }
      if (selectedProfile) {
        const profile = getProfilesForSubject(subjectId).find(p => p.id === selectedProfile);
        formData.append('profileName', profile?.profile_name || 'All Saved Topics');
        // Stamp real profile UUID so exam + questions can be traced back to
        // their originating exam profile. 'all_topics' is a UI sentinel, not
        // a real profile.
        if (selectedProfile !== 'all_topics') {
          formData.append('profileId', selectedProfile);
        }
      }

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-exam', {
        body: formData,
      });

      if (uploadError) throw uploadError;

      const draftId = uploadData.draftId;

      // Scopeless upload: derive topics from the paper, user confirms scope.
      let confirmedTopics: string[] | null = null;
      if (!selectedProfile && selectedSubtopics.length === 0) {
        try {
          const { data: derived } = await supabase.functions.invoke('derive-exam-topics', { body: { draftId } });
          if (derived?.topics?.length) {
            confirmedTopics = await new Promise<string[] | null>((resolve) => {
              deriveResolveRef.current = resolve;
              setDerivedTopics(derived.topics);
              setDerivedTopicsOpen(true);
            });
          } else {
            console.warn('[derive] no topics returned', derived);
          }
        } catch (e) {
          console.warn('Topic derivation failed — generating without scope:', e);
        }
      }

      // Save format — include profile structure if a profile is active AND the
      // user hasn't unlocked the structure for this exam. When unlocked, fall
      // through to the custom branch so their edits actually take effect.
      const hasProfileStructure = selectedProfile && selectedProfile !== 'all_topics' && !structureUnlocked;
      
      
      let format: any;
      if (hasProfileStructure) {
        // Profile defines MCQ/written split — pass structured breakdown
        format = {
          useOriginal: false,
          difficulty: 'profile_locked',
          educationalTier: effectiveEducationalTier,
          mcq: { count: profileMcqCount || 0, marksEach: 1 },
          shortAnswer: { count: profileWrittenCount || 0, marksEach: 3 },
          longForm: { count: 0, marksEach: 0 },
          // Pass advanced profile metadata
          profileMetadata: {
            questionStructure: profileQuestionStructure,
            parentQuestionCount: profileParentQuestionCount,
            maxPartsPerQuestion: profileMaxPartsPerQuestion,
            difficultyProgression: profileDifficultyProgression,
            calculatorPolicy: profileCalculatorPolicy,
            markDistribution: profileMarkDistribution,
            includeExtended: profileIncludeExtended,
            extendedMarks: profileExtendedMarks,
            structurePreset: profileStructurePreset,
            mcqPosition: profileMcqPosition,
            mcqOptionsCount: profileMcqOptionsCount,
            includeGraphs: profileIncludeGraphs,
            includeTables: profileIncludeTables,
          },
        };
      } else {
          format = {
            useOriginal,
            educationalTier: effectiveEducationalTier,
            ...((!useOriginal) && {
              totalQuestions,
              oneMarkCount,
              twoMarkCount,
              fourMarkCount,
              extendedCount,
              topicWeighting,
              includeMCQ,
            }),
          };
      }

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
        { body: { draftId, includeInsert: subjectSupportsInsert && includeInsert, curriculumTopics: confirmedTopics ?? undefined } }
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

          // Auto-publish so the exam is durable even if the user closes the modal
          // without clicking any of the action buttons. The modal becomes pure
          // navigation choices (review / begin / save & go to My Exams).
          try {
            await supabase.functions.invoke('publish-exam', { body: { draftId } });
          } catch (autoPublishErr) {
            console.warn('Auto-publish failed (will rely on modal action):', autoPublishErr);
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
        try {
          const completed = await pollForCompletion();
          if (completed && pollInterval) clearInterval(pollInterval);
        } catch (pollError: any) {
          console.error('Polling error:', pollError);
          if (messageInterval) clearInterval(messageInterval);
          if (pollInterval) clearInterval(pollInterval);
          setGenerating(false);
          toast({
            title: "Generation Failed",
            description: pollError?.message || "Generation stopped unexpectedly. Please try again.",
            variant: "destructive",
          });
        }
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
      // Check if already published (auto-publish runs after extraction)
      const { data: existing } = await supabase
        .from('exams')
        .select('status')
        .eq('id', draftId)
        .single();

      if (!existing || existing.status !== 'published') {
        const { error } = await supabase.functions.invoke('publish-exam', {
          body: { draftId }
        });
        if (error) throw error;
      }

      if (action === 'save') {
        toast({
          title: "Exam Saved",
          description: "Your exam has been saved to My Exams",
        });
        navigate('/my-exams');
      } else if (action === 'begin') {
        navigate(`/exam/${draftId}/live?mode=student`);
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
        <div className="mx-auto p-4 sm:p-6">
          {/* Slim page title — the wizard renders the per-step header below */}
          <div className="max-w-4xl mx-auto mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">Create Mock Exam</h1>
          </div>

          <StepWizard
            maxWidth="max-w-4xl"
            accentColor={subjectColor}
            reviewIndex={3}
            finishDisabled={generating || !subjectId || !educationalTier || nameValidator.isDuplicate}
            finalLabel={generating ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />Generating...</>
            ) : (
              <><Sparkles className="h-5 w-5 mr-2" />Generate exam</>
            )}
            onFinish={handleGenerate}
            steps={[
              {
                id: "basics",
                title: "Basics & source",
                subtitle: "Name your exam, pick a subject, and add any source material.",
                validate: () => {
                  if (!examName.trim()) return "Please enter an exam name.";
                  if (nameValidator.isDuplicate) return "That name is already taken — pick another.";
                  if (!subjectId) return "Please select a subject.";
                  return null;
                },
                content: (
                  <div className="space-y-6">
                    {/* Row 1: Exam Name & Subject — aligned in the same row with matching labels */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div className="flex flex-col">
                        <Label htmlFor="exam-name" className="mb-2 block h-5">Exam name</Label>
                        <Input
                          id="exam-name"
                          placeholder="Enter exam name..."
                          value={examName}
                          onChange={(e) => {
                            setExamName(e.target.value);
                            nameValidator.checkName(e.target.value);
                            if (e.target.value.trim()) setExamNameError(false);
                          }}
                          className={`h-10 text-base bg-card ${examNameError || nameValidator.isDuplicate ? 'border-destructive focus-visible:ring-destructive' : 'border-border'}`}
                        />
                        {examNameError && (
                          <p className="text-sm text-destructive mt-1">Exam name is required</p>
                        )}
                        {nameValidator.isDuplicate && (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-sm text-destructive">An exam with this name already exists. Please choose a unique name.</p>
                            <div className="flex flex-wrap gap-2">
                              {nameValidator.suggestions.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => { setExamName(s); nameValidator.checkName(s); }}
                                  className="text-xs px-2.5 py-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <Label className="mb-2 block h-5">Subject</Label>
                        <SubjectSelector
                          value={subjectId}
                          color={subjectColor}
                          onValueChange={handleSubjectChange}
                          onColorChange={setSubjectColor}
                          showLabel={false}
                        />
                      </div>
                    </div>

                    {/* Selected Profile / Curriculum Badge — full width below the row */}
                    {selectedProfile && profileTopics.length > 0 && (() => {
                      const profile = selectedProfile === 'all_topics'
                        ? null
                        : getProfilesForSubject(subjectId).find(p => p.id === selectedProfile);
                      return (
                        <CurriculumTopicBadge
                          profileName={profile?.profile_name || 'All Saved Topics'}
                          topics={profileTopics}
                          questionCount={totalQuestions}
                          questionLimit={profileMaxQuestions}
                          subjectColor={subjectColor}
                          onRemoveProfile={clearProfile}
                          onActiveTopicsChange={setActiveProfileTopics}
                          profileEducationalTier={profileEducationalTier}
                          profileTimeLimit={profileTimeLimit}
                          onSessionQuestionCountChange={(count) => setTotalQuestions(count)}
                          onSessionTimeLimitChange={(mins) => {
                            setSessionTimeLimitOverride(mins);
                            if (mins != null) { setTimerEnabled(true); setDuration(mins); }
                          }}
                        />
                      );
                    })()}

                    {/* Manual topic selection — for students who haven't made
                        an exam profile yet. Hidden once a profile is active
                        (the badge above handles topics in that case). */}
                    {subjectId && !selectedProfile && (
                      <div className="rounded-lg border border-border bg-card/40 p-4">
                        <SubtopicSelector
                          subject={subjectId}
                          selectedSubtopics={selectedSubtopics}
                          onSubtopicsChange={setSelectedSubtopics}
                          educationalTier={effectiveEducationalTier}
                          examBoard={effectiveExamBoard}
                          useAIInterpretation={useAIInterpretation}
                          onAIInterpretationChange={setUseAIInterpretation}
                        />
                      </div>
                    )}

                    {/* Divider before source-material section */}
                    <div className="pt-2 border-t border-border" />

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label>Notes (Optional)</Label>
                      <NotesInput
                        value={notes}
                        onChange={setNotes}
                        placeholder="Add custom instructions e.g. 'Make it extra hard' or 'Focus on word problems'..."
                      />
                    </div>

                    {/* Resource Mode Selector */}
                    <ResourceModeSelector
                      value={resourceMode}
                      onChange={(mode) => {
                        setResourceMode(mode);
                        if (mode === 'none') setResourcePack(null);
                      }}
                      subjectColor={subjectColor}
                    />

                    {resourceMode === 'uploaded' && (
                      <ResourcePackUploader
                        subjectId={subjectId}
                        subjectColor={subjectColor}
                        currentPack={resourcePack}
                        onPackReady={(pack) => setResourcePack(pack)}
                        onPackCleared={() => setResourcePack(null)}
                      />
                    )}

                    {resourceMode === 'ai_generated' && (
                      <AIResourceGenerator
                        subjectId={subjectId}
                        subjectColor={subjectColor}
                        educationalTier={effectiveEducationalTier}
                        subtopics={[]}
                        onPackReady={(pack) => setResourcePack(pack)}
                      />
                    )}

                    {resourcePack && (
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-sm">Resource Pack Preview</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setResourcePack(null); setResourceMode('none'); }}
                          >
                            Clear
                          </Button>
                        </div>
                        <ResourcePackPreview pack={resourcePack} subjectColor={subjectColor} />
                      </Card>
                    )}

                    {/* Import Reference Assessment */}
                    <div className="relative">
                      <input
                        id="exam-file"
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {!file ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-12 justify-start bg-card border-border hover:bg-accent"
                          onClick={() => document.getElementById('exam-file')?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Import Reference Assessment
                        </Button>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md h-12">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                            onClick={() => setFile(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Optional — upload a past paper to guide AI generation</p>
                    </div>
                  </div>
                ),
              },
              {
                id: "structure",
                title: "Structure",
                subtitle: "Shape the paper: format, question mix and resources.",
                content: (
                  <Card className="p-6 bg-card/50" style={{ borderColor: selectedProfile ? subjectColor + '60' : undefined, borderWidth: selectedProfile ? '2px' : undefined }}>
                    {/* Format Selection */}
                                    <div className={`mb-6 ${structureLocked ? 'opacity-70' : ''}`}>
                                      <div className="flex items-center gap-2 mb-4">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <h2 className="text-lg font-semibold">Format Selection</h2>
                                        {selectedProfile && (
                                          structureLocked ? (
                                            <div className="ml-auto flex items-center gap-2">
                                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: subjectColor, color: subjectColor }}>
                                                Locked by Profile
                                              </Badge>
                                              <button
                                                type="button"
                                                onClick={() => setShowUnlockConfirm(true)}
                                                className="text-[11px] font-medium underline-offset-2 hover:underline"
                                                style={{ color: subjectColor }}
                                              >
                                                Unlock
                                              </button>
                                            </div>
                                          ) : hasLockedProfileStructure ? (
                                            <div className="ml-auto flex items-center gap-2">
                                              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400">
                                                Unlocked for this exam
                                              </Badge>
                                              <button
                                                type="button"
                                                onClick={() => setStructureUnlocked(false)}
                                                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                                              >
                                                Re-lock
                                              </button>
                                            </div>
                                          ) : null
                                        )}
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
                                          disabled={structureLocked}
                                        />
                                      </div>
                  
                                      {/* Custom Exam Structure Panel — only when no profile is active */}
                                      {!useOriginal && !structureLocked && (
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

                                          {/* MCQ toggle — kept since it changes question type structure */}
                                          <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                                            <Label className="text-sm cursor-pointer">Include Multiple-Choice Section</Label>
                                            <Switch
                                              checked={includeMCQ}
                                              onCheckedChange={setIncludeMCQ}
                                            />
                                          </div>

                                          {subjectSupportsInsert && (
                                            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                                              <div>
                                                <Label className="text-sm cursor-pointer">Include resource insert</Label>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                  A figure booklet (e.g. a data map) that some questions will reference — like real {subjectId} papers.
                                                </p>
                                              </div>
                                              <Switch
                                                checked={includeInsert}
                                                onCheckedChange={setIncludeInsert}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Profile Structure Summary — shown when profile is active */}
                                      {hasLockedProfileStructure && selectedProfile && (() => {
                                        const profile = getProfilesForSubject(subjectId).find(p => p.id === selectedProfile);
                                        if (!profile) return null;
                                        const summaryRows = [
                                          {
                                            label: 'Written questions',
                                            value: profile.written_question_count
                                              ? `${profile.written_question_count} questions`
                                              : 'AI decides',
                                          },
                                          {
                                            label: 'MCQ questions',
                                            value: (profile.mcq_count ?? 0) > 0
                                              ? `${profile.mcq_count} questions`
                                              : 'None',
                                          },
                                          {
                                            label: 'Question structure',
                                            value: profile.question_structure === 'sub_questions'
                                              ? 'Sub-parts (1a, 1b, 1c...)'
                                              : profile.question_structure === 'mixed'
                                              ? 'Mixed (some standalone, some sub-parts)'
                                              : 'Standalone (Q1, Q2, Q3...)',
                                          },
                                          {
                                            label: 'Calculator',
                                            value: profile.calculator_policy === 'not_allowed'
                                              ? 'Not permitted'
                                              : profile.calculator_policy === 'mixed'
                                              ? 'Mixed paper'
                                              : 'Permitted',
                                          },
                                          ...(profile.include_extended ? [{
                                            label: 'Extended response',
                                            value: `${profile.extended_marks ?? 0} mark question at end`,
                                          }] : []),
                                          ...(profile.mark_distribution && Object.keys(profile.mark_distribution).length > 0 ? [{
                                            label: 'Mark distribution',
                                            value: Object.entries(profile.mark_distribution)
                                              .filter(([, count]) => (count as number) > 0)
                                              .map(([marks, count]) => `${count}×${marks}mk`)
                                              .join(', ') || 'AI decides',
                                          }] : []),
                                        ];
                                        return (
                                          <div className="mt-4 p-4 bg-background rounded-lg border border-border">
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">
                                              Structure defined by profile
                                            </p>
                                            <div className="flex flex-col gap-2">
                                              {summaryRows.map((row) => (
                                                <div key={row.label} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                                                  <span className="text-muted-foreground">{row.label}</span>
                                                  <span className="text-foreground font-medium">{row.value}</span>
                                                </div>
                                              ))}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => navigate('/my-subjects')}
                                              className="mt-3 text-[11px] text-primary hover:underline bg-transparent border-none cursor-pointer p-0"
                                            >
                                              Edit profile in My Subjects →
                                            </button>
                                          </div>
                                        );
                                      })()}
                                    </div>

                
                  </Card>
                ),
              },
              {
                id: "settings",
                title: "Settings",
                subtitle: "Level and timing.",
                validate: () => {
                  if (!effectiveEducationalTier) return "Please select an educational level.";
                  if (educationalTier === 'other' && !customTier.trim()) return "Please specify your educational level.";
                  if (timerEnabled && (!duration || duration <= 0)) return "Please enter a valid timer duration.";
                  return null;
                },
                content: (
                  <Card className="p-6 bg-card/50" style={{ borderColor: selectedProfile ? subjectColor + '60' : undefined, borderWidth: selectedProfile ? '2px' : undefined }}>
                    {/* Educational Level */}
                                    <div className={`mb-6 ${selectedProfile && profileEducationalTier ? 'opacity-50 pointer-events-none' : ''}`}>
                                      <div className="flex items-center gap-2 mb-4">
                                        <SlidersHorizontal className="h-5 w-5 text-primary" />
                                        <h2 className="text-lg font-semibold">Educational Level</h2>
                                        {selectedProfile && profileEducationalTier && (
                                          <Badge variant="outline" className="text-[10px] ml-auto" style={{ borderColor: subjectColor, color: subjectColor }}>
                                            Set by Profile
                                          </Badge>
                                        )}
                                      </div>
                                      <Select value={educationalTier || preferences?.preferred_educational_level || ""} onValueChange={setEducationalTier}>
                                        <SelectTrigger className="h-12 bg-background border-border">
                                          <SelectValue placeholder="Select educational level..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover border-border">
                                          {getLevelsForBoard(examBoard || preferences?.preferred_exam_board).map((level) => (
                                            <SelectItem key={level.id} value={level.id}>
                                              {level.label}
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="other">Other (Custom)</SelectItem>
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
                ),
              },
              {
                id: "review",
                title: "Review",
                subtitle: "Check the front cover, then generate.",
                content: (
                  <ExamPaperCover
                    examName={examName}
                    subjectId={subjectId}
                    subjectColor={subjectColor}
                    boardLabel={effectiveExamBoard ? getBoardDisplayName(effectiveExamBoard) : "Generic style"}
                    levelLabel={formatLevelLabel(profileEducationalTier || effectiveEducationalTier)}
                    totalQuestions={totalQuestions}
                    timerEnabled={timerEnabled}
                    durationMinutes={duration}
                    topics={
                      selectedProfile && activeProfileTopics.length > 0
                        ? activeProfileTopics
                        : selectedSubtopics
                    }
                    useOriginalStructure={useOriginal}
                    includeMCQ={includeMCQ}
                    notes={notes}
                  />
                ),
              },
            ] as WizardStep[]}
          />
        </div>
      </div>
      {/* Loading Screen */}
      {generating && !derivedTopicsOpen && (
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

      {/* Smart Profile Prompt Modal */}
      {/* Per-exam structure unlock confirmation */}
      <AlertDialog open={showUnlockConfirm} onOpenChange={setShowUnlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit the structure for this exam only?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to change the question structure for this one exam. Your saved exam
              profile won't be touched — these changes apply to this paper only. To change the
              profile itself, head to the Subjects page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Seed the editable fields from the profile so the user starts
                // from its structure, not blank defaults. Then free the controls.
                if (profileMcqCount != null || profileWrittenCount != null) {
                  setIncludeMCQ((profileMcqCount ?? 0) > 0);
                }
                setUseOriginal(false);
                setStructureUnlocked(true);
                setShowUnlockConfirm(false);
              }}
              style={{ backgroundColor: subjectColor }}
            >
              Unlock for this exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CurriculumPromptModal
        open={showProfilePrompt}
        onOpenChange={setShowProfilePrompt}
        subjectName={subjectId}
        subjectColor={subjectColor}
        masterTopics={getTopicsForSubject(subjectId)}
        profiles={getProfilesForSubject(subjectId)}
        onPracticeAll={(topics) => {
          handlePracticeAll(topics);
        }}
        onSelectProfile={(profile) => {
          handleSelectProfile(profile.id);
        }}
        onStandardMode={() => {
          setShowProfilePrompt(false);
        }}
      />
      <AlertDialog open={derivedTopicsOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>We detected these topics from your paper</AlertDialogTitle>
            <AlertDialogDescription>
              Questions will stay within this scope — remove any that don't belong, or add your own.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-wrap gap-1.5 py-1">
            {derivedTopics.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setDerivedTopics(derivedTopics.filter((x) => x !== t))}>×</button>
              </span>
            ))}
            {derivedTopics.length === 0 && (
              <p className="text-xs text-muted-foreground">No topics — generation will be unscoped.</p>
            )}
          </div>
          <Input
            value={derivedTopicInput}
            onChange={(e) => setDerivedTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && derivedTopicInput.trim()) {
                e.preventDefault();
                if (!derivedTopics.includes(derivedTopicInput.trim())) setDerivedTopics([...derivedTopics, derivedTopicInput.trim()]);
                setDerivedTopicInput('');
              }
            }}
            placeholder="Add a topic and press Enter"
            className="h-9 text-sm"
          />
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setDerivedTopicsOpen(false); deriveResolveRef.current?.(null); deriveResolveRef.current = null; }}>Skip</Button>
            <Button onClick={() => { setDerivedTopicsOpen(false); deriveResolveRef.current?.(derivedTopics.length ? derivedTopics : null); deriveResolveRef.current = null; }}>Use these topics</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
