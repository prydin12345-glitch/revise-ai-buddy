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
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !subjectId) {
      toast({
        title: "Missing Information",
        description: "Please select a file and subject",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subjectId', subjectId);

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
      <div className="min-h-screen bg-[#0f1727] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Upload Exam</h1>
            <p className="text-muted-foreground">
              Upload your exam document to get started
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-8 border border-white/10">
            <div className="space-y-6">
              <div>
                <Label htmlFor="subject" className="text-white">Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger className="mt-2 bg-[#1a2332] border-white/10 text-white">
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
              </div>

              <div>
                <Label htmlFor="file" className="text-white">Exam Document</Label>
                <div className="mt-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChange}
                    className="bg-[#1a2332] border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#1e40af] file:text-white hover:file:bg-[#1e40af]/90"
                  />
                  {file && (
                    <div className="mt-4 flex items-center gap-2 text-white">
                      <FileText className="h-5 w-5" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading || !file || !subjectId}
                className="w-full bg-[#1e40af] hover:bg-[#1e40af]/90 text-white"
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
      </div>
    </DashboardLayout>
  );
}
