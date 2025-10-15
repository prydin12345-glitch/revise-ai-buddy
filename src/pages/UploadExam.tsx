import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

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

      toast({
        title: "Upload Successful",
        description: "Analyzing your exam...",
      });

      navigate(`/upload/${data.draftId}/analyze`);
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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Upload Exam</h1>
            <p className="text-muted-foreground">
              Upload your exam document to get started
            </p>
          </div>

          <div className="bg-card rounded-xl p-8 border border-border shadow-lg space-y-6">
            <div>
              <Label htmlFor="subject" className="text-foreground">Subject</Label>
              <Select value={subjectId} onValueChange={(value) => {
                setSubjectId(value);
                setErrors({ ...errors, subject: "" });
              }}>
                <SelectTrigger className="mt-2 bg-background border-border text-foreground">
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

            <div>
              <Label htmlFor="file" className="text-foreground">Exam Document</Label>
              <div className="mt-2">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => {
                    handleFileChange(e);
                    setErrors({ ...errors, file: "" });
                  }}
                  className="bg-background border-border text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {file && (
                  <div className="mt-4 flex items-center gap-2 text-foreground bg-muted p-3 rounded-md">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                )}
              </div>
              {errors.file && <p className="text-destructive text-sm mt-1">{errors.file}</p>}
            </div>

            <div>
              <Label htmlFor="fileName" className="text-foreground">Name this exam</Label>
              <Input
                id="fileName"
                type="text"
                placeholder="e.g. Calculus Final 2024"
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setErrors({ ...errors, fileName: "" });
                }}
                className="mt-2 bg-background border-border text-foreground"
              />
              {errors.fileName && <p className="text-destructive text-sm mt-1">{errors.fileName}</p>}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload and Continue
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
