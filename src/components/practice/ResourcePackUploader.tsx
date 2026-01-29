import { useState } from "react";
import { Upload, FileText, Loader2, X, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface ResourceItem {
  id: string;
  source_label: string;
  resource_type: string;
  content_text?: string;
  content_url?: string;
  content_json?: any;
  word_count?: number;
  attribution?: string;
  difficulty_contribution?: string;
  display_order: number;
}

export interface ResourcePack {
  id: string;
  title: string;
  subject_id: string;
  pack_type: 'uploaded' | 'ai_generated' | 'extracted';
  status: 'draft' | 'processing' | 'ready' | 'failed';
  items: ResourceItem[];
}

interface ResourcePackUploaderProps {
  subjectId: string;
  educationalTier?: string;
  examBoard?: string;
  onPackReady: (pack: ResourcePack) => void;
  onPackCleared: () => void;
  currentPack?: ResourcePack | null;
  subjectColor?: string;
}

export const ResourcePackUploader = ({
  subjectId,
  educationalTier,
  examBoard,
  onPackReady,
  onPackCleared,
  currentPack,
  subjectColor = "#3b82f6",
}: ResourcePackUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error("Please upload a PDF file");
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error("File size must be less than 20MB");
        return;
      }
      setFile(selectedFile);
      // Auto-extract immediately after file selection
      await handleUploadAndExtract(selectedFile);
    }
  };

  const handleUploadAndExtract = async (selectedFile: File) => {
    setUploading(true);
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Please log in to upload resources");
        setFile(null);
        return;
      }

      // Upload file to storage
      const filePath = `${session.user.id}/resources/${crypto.randomUUID()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("exam-files")
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(uploadError.message || "Failed to upload file. Please check your connection and try again.");
      }
      setProgress(30);

      // Call extract-resource-pack edge function
      setUploading(false);
      setExtracting(true);
      setProgress(40);

      const { data, error } = await supabase.functions.invoke('extract-resource-pack', {
        body: {
          fileUrl: filePath,
          subjectId,
          educationalTier,
          examBoard,
          title: selectedFile.name.replace('.pdf', ''),
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Failed to extract resources");
      }
      
      setProgress(100);

      // Transform response into ResourcePack format
      const pack: ResourcePack = {
        id: data.packId,
        title: data.title || selectedFile.name.replace('.pdf', ''),
        subject_id: subjectId,
        pack_type: 'uploaded',
        status: 'ready',
        items: data.items || [],
      };

      onPackReady(pack);
      toast.success(`Extracted ${pack.items.length} resources from insert`);
    } catch (error: any) {
      console.error("Error processing resource pack:", error);
      const message = error.message?.includes("Load failed") 
        ? "Network error. Please check your connection and try again."
        : error.message || "Failed to process resource pack";
      toast.error(message);
      setFile(null);
    } finally {
      setUploading(false);
      setExtracting(false);
      setProgress(0);
    }
  };

  const handleClear = () => {
    setFile(null);
    onPackCleared();
  };

  if (currentPack) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Resource Pack</Label>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border"
          style={{ borderColor: `${subjectColor}40`, backgroundColor: `${subjectColor}10` }}
        >
          <Check className="h-5 w-5" style={{ color: subjectColor }} />
          <div className="flex-1">
            <p className="font-medium text-sm">{currentPack.title}</p>
            <p className="text-xs text-muted-foreground">
              {currentPack.items.length} resources extracted
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <Label className="text-sm font-medium mb-3 block">Upload Insert/Resource PDF</Label>
      
      {!file ? (
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="resource-file-input"
          />
          <label
            htmlFor="resource-file-input"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              Click to upload Insert PDF
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              e.g., AQA English Insert, Geography Resource Booklet
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {!(uploading || extracting) && (
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                {uploading ? "Uploading..." : "Extracting resources..."}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      )}
    </Card>
  );
};
