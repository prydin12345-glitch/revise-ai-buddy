import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import type { ResourceItem } from "@/components/practice/ResourcePackUploader";

interface ResourceViewerModalProps {
  open: boolean;
  onClose: () => void;
  item: ResourceItem | null;
  subjectColor?: string;
}

/**
 * Formats raw text into numbered paragraphs for exam-style display.
 * Splits on sentence boundaries to create proper paragraph chunks of ~3-5 sentences.
 * Line numbers increment by 5 to mimic real exam papers.
 */
const formatTextWithLineNumbers = (text: string): { lineNumber: number; content: string }[] => {
  if (!text) return [];
  
  // Clean up the text - normalize whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  // Split into sentences (handle common sentence endings)
  const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  
  if (sentences.length === 0) return [];
  
  const formattedParagraphs: { lineNumber: number; content: string }[] = [];
  let lineCounter = 1;
  
  // Group sentences into paragraphs of 3-4 sentences each
  const SENTENCES_PER_PARAGRAPH = 3;
  
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    const paragraphSentences = sentences.slice(i, i + SENTENCES_PER_PARAGRAPH);
    const paragraphText = paragraphSentences.join(' ');
    
    formattedParagraphs.push({
      lineNumber: lineCounter,
      content: paragraphText.trim()
    });
    
    // Increment line counter by 5 for exam-style numbering
    lineCounter += 5;
  }
  
  return formattedParagraphs;
};

export const ResourceViewerModal = ({ open, onClose, item, subjectColor = "#3B82F6" }: ResourceViewerModalProps) => {
  if (!item) return null;

  const formattedParagraphs = formatTextWithLineNumbers(item.content_text || "");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Minimal Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5" style={{ color: subjectColor }} />
            <DialogTitle className="text-lg font-bold">{item.source_label}</DialogTitle>
            <Badge variant="outline" className="capitalize text-xs">
              {item.resource_type.replace('_', ' ')}
            </Badge>
          </div>
        </DialogHeader>
        
        {/* Scrollable Content Area - using native overflow */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-6">
            {/* Attribution/Context Box */}
            {item.attribution && (
              <div className="mb-6 p-4 bg-muted/50 border rounded-lg">
                <p className="text-sm leading-relaxed">{item.attribution}</p>
              </div>
            )}
            
            {/* Main Content with Line Numbers */}
            {formattedParagraphs.length > 0 && (
              <div className="space-y-4">
                {formattedParagraphs.map((para, index) => (
                  <div key={index} className="flex gap-4">
                    {/* Line Number Column */}
                    <div className="w-8 flex-shrink-0 text-right pt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">
                        {para.lineNumber}
                      </span>
                    </div>
                    {/* Paragraph Content */}
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed text-foreground">
                        {para.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Image Content */}
            {item.content_url && (
              <div className="mt-6">
                <img 
                  src={item.content_url} 
                  alt={item.source_label}
                  className="max-w-full h-auto rounded-lg border"
                />
              </div>
            )}
            
            {/* Word Count Footer */}
            {item.word_count && (
              <div className="mt-8 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Word count: {item.word_count}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
