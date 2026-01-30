import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
 * Splits on double newlines for paragraph breaks, adds line numbers at key intervals.
 */
const formatTextWithLineNumbers = (text: string): { lineNumber: number; content: string }[] => {
  if (!text) return [];
  
  // Split into paragraphs by double newlines or single newlines with more than 80 chars
  const rawParagraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  const formattedParagraphs: { lineNumber: number; content: string }[] = [];
  let lineCounter = 1;
  
  rawParagraphs.forEach((para) => {
    // Count approximate lines in this paragraph (assuming ~80 chars per line)
    const estimatedLines = Math.max(1, Math.ceil(para.length / 80));
    
    formattedParagraphs.push({
      lineNumber: lineCounter,
      content: para.trim()
    });
    
    // Increment line counter based on paragraph length
    // Use increments of ~5 lines for readability (like real exam papers)
    lineCounter += Math.max(1, Math.floor(estimatedLines / 2) * 5) || 5;
  });
  
  return formattedParagraphs;
};

export const ResourceViewerModal = ({ open, onClose, item, subjectColor = "#3B82F6" }: ResourceViewerModalProps) => {
  if (!item) return null;

  const formattedParagraphs = formatTextWithLineNumbers(item.content_text || "");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
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
        
        {/* Scrollable Content Area */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-100px)]">
          <div className="p-6">
            {/* Attribution/Context Box */}
            {item.attribution && (
              <div className="mb-6 p-4 bg-muted/50 border rounded-lg">
                <p className="text-sm leading-relaxed">{item.attribution}</p>
              </div>
            )}
            
            {/* Main Content with Line Numbers */}
            {formattedParagraphs.length > 0 && (
              <div className="space-y-6">
                {formattedParagraphs.map((para, index) => (
                  <div key={index} className="flex gap-6">
                    {/* Line Number Column */}
                    <div className="w-8 flex-shrink-0 text-right">
                      <span className="text-sm text-muted-foreground font-medium">
                        {para.lineNumber}
                      </span>
                    </div>
                    {/* Paragraph Content */}
                    <div className="flex-1">
                      <p className="text-base leading-relaxed text-foreground">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
