import { useState } from "react";
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
import { Upload, FileText, Clock, SlidersHorizontal, Info } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const subjects = [
  { id: "mathematics", name: "Mathematics" },
  { id: "physics", name: "Physics" },
  { id: "chemistry", name: "Chemistry" },
  { id: "biology", name: "Biology" },
  { id: "english", name: "English" },
  { id: "history", name: "History" },
  { id: "geography", name: "Geography" },
  { id: "other", name: "Other" },
];

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

const difficultyLevels = [
  { id: "exam_board_standard", name: "Exam Board Standard", desc: "Adjusts complexity and depth of questions" },
  { id: "stretch_challenge", name: "Stretch & Challenge", desc: "+15% harder" },
  { id: "simplified_practice", name: "Simplified Practice", desc: "-15% easier" },
];

export default function CreateExam() {
  const navigate = useNavigate();
  
  // Basic info
  const [examName, setExamName] = useState("");
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examBoard, setExamBoard] = useState("");
  const [qualificationLevel, setQualificationLevel] = useState("");
  
  // File uploads
  const [file, setFile] = useState<File | null>(null);
  const [specFile, setSpecFile] = useState<File | null>(null);
  
  // Format settings
  const [useOriginal, setUseOriginal] = useState(true);
  const [difficulty, setDifficulty] = useState("exam_board_standard");
  
  // Timer settings
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [duration, setDuration] = useState(60);
  
  const [uploading, setUploading] = useState(false);

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

  const handleContinue = async () => {
    // Validation
    if (!examName.trim()) {
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

    if (timerEnabled && duration <= 0) {
      toast({
        title: "Invalid Duration",
        description: "Please enter a positive duration",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload exam with all settings
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subjectId', subjectId);
      formData.append('fileName', examName);
      formData.append('examBoard', examBoard);
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
        difficulty,
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

      toast({
        title: "Upload Successful",
        description: "Processing your exam...",
      });

      // Navigate to preview
      navigate(`/upload/${draftId}/preview`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload exam",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Create Mock Exam</h1>
            <Button
              onClick={handleContinue}
              disabled={uploading}
              size="lg"
              className="px-8 button-glow"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-6">
            {/* Left Column - Main Form */}
            <div className="space-y-6">
              {/* Exam Name & Notes */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    placeholder="Enter exam name.."
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    className="h-12 text-base bg-card border-border"
                  />
                </div>
                <div>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger className="h-12 bg-card border-border">
                      <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea
                placeholder="Notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[120px] bg-card border-border resize-none"
              />

              {/* File Uploads & Exam Board */}
              <div className="grid sm:grid-cols-3 gap-4">
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
                    {file ? file.name.substring(0, 20) + '...' : '+ Upload Exam Document'}
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
                    {specFile ? specFile.name.substring(0, 20) + '...' : '+ Exam Specification'}
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

              {/* Format Selection */}
              <Card className="p-6 bg-card/50 border-border">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Format Selection</h2>
                </div>

                <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1">
                      <Label className="text-base font-medium">Use Original Structure</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI generates new questions matching the original format
                      </p>
                    </div>
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
                  <Switch
                    checked={useOriginal}
                    onCheckedChange={setUseOriginal}
                  />
                </div>
              </Card>

              {/* Difficulty Level */}
              <Card className="p-6 bg-card/50 border-border">
                <div className="flex items-center gap-2 mb-4">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Difficulty Level</h2>
                </div>

                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="h-12 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {difficultyLevels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        <div>
                          <div className="font-medium">{level.name}</div>
                          <div className="text-xs text-muted-foreground">{level.desc}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>

              {/* Timer Setup */}
              <Card className="p-6 bg-card/50 border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Timer Set up</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div>
                        <Label className="text-base font-medium">Enable Timer</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add a Time Limit to the exam
                        </p>
                      </div>
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
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                        min="1"
                        placeholder="Enter duration in minutes"
                        className="h-11 bg-background"
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column - Configuration Summary */}
            <div>
              <Card className="p-6 bg-card/50 border-border sticky top-6">
                <h3 className="text-lg font-semibold mb-6">Configuration Summary</h3>
                
                <div className="space-y-4">
                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-1">Name and Subject</p>
                    <p className="font-medium">
                      {examName || 'Math Test 1'} {subjectId && <span className="text-primary">{subjects.find(s => s.id === subjectId)?.name}</span>}
                    </p>
                  </div>

                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-1">Uploaded Exam</p>
                    <p className="font-medium text-muted-foreground">
                      {file ? file.name : '[AUTO ENTER PDF OR FILE NAME HERE]'}
                    </p>
                  </div>

                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-1">Total Marks</p>
                    <p className="font-medium">As Per original</p>
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
    </DashboardLayout>
  );
}