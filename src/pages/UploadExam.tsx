import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, ChevronDown, Settings2, X, Lock, Unlock } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { UPLOAD_DECLARATION, checkTitleForBoardReferences } from "@/lib/board-scrubber";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { getLevelsForBoard } from "@/lib/board-level-mapping";
import { ConfigSummary } from "@/components/exam/ConfigSummary";

const subjects = [
  { id: "mathematics", name: "Mathematics" },
  { id: "english", name: "English" },
  { id: "science", name: "Science" },
  { id: "history", name: "History" },
  { id: "other", name: "Other" },
];

export default function UploadExam() {
  const navigate = useNavigate();
  const { preferences } = useUserPreferences();
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [educationalTier, setEducationalTier] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [titleWarning, setTitleWarning] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [errors, setErrors] = useState({ subject: "", fileName: "" });
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [followReference, setFollowReference] = useState(false);

  const { examProfiles, getProfilesForSubject } = useSubjectProfiles();

  // Auto-populate from preferences
  const examBoard = preferences?.preferred_exam_board || null;
  const dynamicLevels = getLevelsForBoard(examBoard);

  // Pre-fill educational tier from preferences
  useEffect(() => {
    if (preferences?.preferred_educational_level && !educationalTier) {
      setEducationalTier(preferences.preferred_educational_level);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences]);

  const subjectProfiles = useMemo(
    () => (subjectId ? getProfilesForSubject(subjectId) : []),
    [subjectId, getProfilesForSubject]
  );

  const selectedProfile = useMemo(
    () => subjectProfiles.find(p => p.id === selectedProfileId) || null,
    [subjectProfiles, selectedProfileId]
  );

  const isLockedByProfile = !!selectedProfile && !followReference;
  const showReferenceToggle = !!selectedProfile && !!file;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    const newErrors = { subject: "", fileName: "" };
    
    if (!subjectId) newErrors.subject = "Please select a subject";
    if (!fileName.trim()) newErrors.fileName = "Please name this exam";
    
    setErrors(newErrors);
    
    if (newErrors.subject || newErrors.fileName) {
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('subjectId', subjectId);
      formData.append('fileName', fileName);
      const tier = selectedProfile?.educational_tier || educationalTier;
      if (tier) formData.append('educationalTier', tier);
      if (selectedProfile) {
        formData.append('structureMode', followReference ? 'reference' : 'profile');
        formData.append('profileQuestionCount', String(selectedProfile.question_count));
        if (selectedProfile.topics.length > 0) {
          formData.append('curriculumTopics', JSON.stringify(selectedProfile.topics));
        }
      }

      const { data, error } = await supabase.functions.invoke('upload-exam', {
        body: formData,
      });

      if (error) throw error;

      toast({
        title: "Upload Successful",
        description: "Setting up your exam...",
      });

      // Navigate to settings page (topics will be extracted with questions later)
      navigate(`/upload/${data.draftId}/settings`);
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
      <PageContainer maxWidth="sm">
        <PageHeader
          title="Upload Exam"
          subtitle="Upload your exam document to get started"
          step="Step 1 of 4"
          showBack={false}
        />

        <Card className="p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-base font-medium">Subject</Label>
              <Select value={subjectId} onValueChange={(value) => {
                setSubjectId(value);
                setErrors({ ...errors, subject: "" });
                setSelectedProfileId(null);
                setFollowReference(false);
              }}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.subject && <p className="text-destructive text-sm mt-1">{errors.subject}</p>}
            </div>

            {/* Exam Profile Selector */}
            {subjectId && subjectProfiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-medium">Exam Profile</Label>
                <Select value={selectedProfileId || ''} onValueChange={(value) => {
                  setSelectedProfileId(value || null);
                  setFollowReference(false);
                }}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a profile (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.profile_name} — {profile.question_count}Q
                        {profile.time_limit_minutes ? `, ${profile.time_limit_minutes}min` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfile && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                      <Lock className="h-3 w-3" />
                      {selectedProfile.question_count} Questions
                    </Badge>
                    {selectedProfile.educational_tier && (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                        {selectedProfile.educational_tier}
                      </Badge>
                    )}
                    {selectedProfile.time_limit_minutes && (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                        {selectedProfile.time_limit_minutes} min
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="file" className="text-base font-medium">Import Reference Assessment</Label>
              <p className="text-xs text-muted-foreground">Optional — upload a past paper or reference document to guide AI generation</p>
              <div className="border-2 border-dashed border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                {!file ? (
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Follow Reference Structure Toggle */}
            {showReferenceToggle && (
              <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  {followReference ? (
                    <Unlock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Lock className="h-4 w-4 text-primary" />
                  )}
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">Follow Reference Structure</Label>
                    <p className="text-xs text-muted-foreground">
                      {followReference
                        ? 'Question count follows the uploaded PDF'
                        : `Question count locked to profile (${selectedProfile.question_count}Q)`}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={followReference}
                  onCheckedChange={setFollowReference}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fileName" className="text-base font-medium">Name this exam *</Label>
              <Input
                id="fileName"
                type="text"
                placeholder="e.g. Calculus Final 2024"
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setErrors({ ...errors, fileName: "" });
                  setTitleWarning(checkTitleForBoardReferences(e.target.value));
                }}
                className="h-11"
              />
              {errors.fileName && <p className="text-destructive text-sm mt-1">{errors.fileName}</p>}
              {titleWarning && <p className="text-amber-600 text-xs mt-1">{titleWarning}</p>}
            </div>

            {/* Advanced Options */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center justify-between h-10 px-3 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Advanced Options
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="educational-tier" className="text-base font-medium">Educational Level (Optional)</Label>
                  <Select value={educationalTier} onValueChange={setEducationalTier}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dynamicLevels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {level.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {preferences?.preferred_educational_level
                      ? "Pre-filled from your profile · Change in Settings"
                      : "Optional — helps calibrate question difficulty"}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Declaration Checkbox */}
            <div className="flex items-start space-x-3 p-4 border border-border rounded-lg bg-muted/30">
              <Checkbox
                id="declaration"
                checked={declarationChecked}
                onCheckedChange={(checked) => setDeclarationChecked(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="declaration" className="text-sm leading-relaxed cursor-pointer">
                {UPLOAD_DECLARATION}
              </Label>
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading || !declarationChecked}
            className="w-full h-12 text-base font-medium button-glow mt-8"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Upload and Continue
              </>
            )}
          </Button>
        </Card>
      </PageContainer>
    </DashboardLayout>
  );
}
