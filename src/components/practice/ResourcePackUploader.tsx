import { useState } from "react";
import { Upload, FileText, X, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  status: 'pending' | 'processing' | 'ready' | 'failed';
  source_file_url?: string;
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
      // Just upload and store - extraction happens at generation time
      await handleUpload(selectedFile);
    }
  };

  const handleUpload = async (selectedFile: File) => {
    setUploading(true);

    const maxRetries = 3;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      attempt++;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          toast.error("Please log in to upload resources");
          setFile(null);
          setUploading(false);
          return;
        }

        // Upload file to storage with retry
        const filePath = `${session.user.id}/resources/${crypto.randomUUID()}-${selectedFile.name}`;
        console.log(`Upload attempt ${attempt}/${maxRetries} for: ${filePath}`);
        
        const { error: uploadError } = await supabase.storage
          .from("exam-files")
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error(`Storage upload error (attempt ${attempt}):`, uploadError);
          lastError = new Error(uploadError.message || "Failed to upload file");
          
          // If it's a network error, retry
          if (uploadError.message?.toLowerCase().includes("load failed") || 
              uploadError.message?.toLowerCase().includes("network") ||
              uploadError.message?.toLowerCase().includes("fetch")) {
            if (attempt < maxRetries) {
              console.log(`Retrying upload in ${attempt * 1000}ms...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
              continue;
            }
          }
          throw lastError;
        }

        // Create a pending resource pack record - extraction will happen at generation time
        const { data: packData, error: packError } = await supabase
          .from('resource_packs')
          .insert({
            user_id: session.user.id,
            title: selectedFile.name.replace('.pdf', ''),
            subject_id: subjectId,
            educational_tier: educationalTier,
            exam_board: examBoard,
            pack_type: 'uploaded',
            source_file_url: filePath,
            status: 'pending', // Will be processed during generation
          })
          .select()
          .single();

        if (packError) {
          console.error("Failed to create resource pack record:", packError);
          throw new Error("Failed to save resource pack");
        }

        // Return pack with pending status - extraction happens at generation time
        const pack: ResourcePack = {
          id: packData.id,
          title: packData.title,
          subject_id: subjectId,
          pack_type: 'uploaded',
          status: 'pending',
          source_file_url: filePath,
          items: [], // Will be populated during generation
        };

        onPackReady(pack);
        toast.success("Insert uploaded - will be processed during generation");
        setUploading(false);
        return; // Success - exit the function
        
      } catch (error: any) {
        console.error(`Error uploading resource pack (attempt ${attempt}):`, error);
        lastError = error;
        
        // Check if we should retry
        const isNetworkError = error.message?.toLowerCase().includes("load failed") || 
                              error.message?.toLowerCase().includes("network") ||
                              error.message?.toLowerCase().includes("fetch");
        
        if (isNetworkError && attempt < maxRetries) {
          console.log(`Retrying upload in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
        
        // Final failure
        break;
      }
    }
    
    // All retries exhausted
    const message = lastError?.message?.toLowerCase().includes("load failed") 
      ? "Network error after multiple attempts. Please check your internet connection and try again."
      : lastError?.message || "Failed to upload resource pack";
    toast.error(message);
    setFile(null);
    setUploading(false);
  };

  const handleClear = () => {
    setFile(null);
    onPackCleared();
  };

  if (currentPack) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Resource Pack (Insert)</Label>
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
              {currentPack.status === 'pending' 
                ? "Ready - will be extracted during generation"
                : `${currentPack.items.length} resources extracted`}
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
                {uploading ? "Uploading..." : (file.size / 1024 / 1024).toFixed(2) + " MB"}
              </p>
            </div>
            {!uploading && (
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
