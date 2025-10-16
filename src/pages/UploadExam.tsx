import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";

const subjects = [
  { id: "mathematics", name: "Mathematics" },
  { id: "english", name: "English" },
  { id: "science", name: "Science" },
  { id: "history", name: "History" },
  { id: "other", name: "Other" },
];

export default function UploadExam() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({ subject: "", file: "", fileName: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    // Validate fields
    const newErrors = { subject: "", file: "", fileName: "" };
    
    if (!subjectId) newErrors.subject = "Please select a subject";
    if (!file) newErrors.file = "Please choose a file";
    if (!fileName.trim()) newErrors.fileName = "Please name this exam";
    
    setErrors(newErrors);
    
    if (newErrors.subject || newErrors.file || newErrors.fileName) {
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subjectId', subjectId);
      formData.append('fileName', fileName);

      const { data, error } = await supabase.functions.invoke('upload-exam', {
        body: formData,
      });

      if (error) throw error;

      // Trigger analysis in background (topics extraction)
      supabase.functions.invoke('analyze-exam', {
        body: { draftId: data.draftId }
      }).then(() => {
        console.log('Topics extracted in background');
      }).catch((err) => {
        console.error('Background analysis error:', err);
      });

      toast({
        title: "Upload Successful",
        description: "Setting up your exam...",
      });

      // Skip analysis screen, go directly to settings (merged format + timer)
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

            <div className="space-y-2">
              <Label htmlFor="file" className="text-base font-medium">Exam Document</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => {
                    handleFileChange(e);
                    setErrors({ ...errors, file: "" });
                  }}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                {file && (
                  <div className="mt-4 flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                )}
              </div>
              {errors.file && <p className="text-destructive text-sm mt-1">{errors.file}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileName" className="text-base font-medium">Name this exam</Label>
              <Input
                id="fileName"
                type="text"
                placeholder="e.g. Calculus Final 2024"
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setErrors({ ...errors, fileName: "" });
                }}
                className="h-11"
              />
              {errors.fileName && <p className="text-destructive text-sm mt-1">{errors.fileName}</p>}
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading}
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
