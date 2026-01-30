import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, BookOpen } from "lucide-react";
import type { ResourceItem } from "@/components/practice/ResourcePackUploader";

interface ResourceViewerModalProps {
  open: boolean;
  onClose: () => void;
  item: ResourceItem | null;
  subjectColor?: string;
}

export const ResourceViewerModal = ({ open, onClose, item, subjectColor = "#3B82F6" }: ResourceViewerModalProps) => {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5" style={{ color: subjectColor }} />
              <DialogTitle className="text-lg font-semibold">{item.source_label}</DialogTitle>
              <Badge variant="outline" className="capitalize">
                {item.resource_type.replace('_', ' ')}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Questions
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {item.attribution && (
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-muted-foreground italic">{item.attribution}</p>
              </div>
            )}
            
            {item.content_text && (
              <div className="whitespace-pre-wrap text-base leading-relaxed">
                {item.content_text}
              </div>
            )}
            
            {item.content_url && (
              <div className="mt-4">
                <img 
                  src={item.content_url} 
                  alt={item.source_label}
                  className="max-w-full h-auto rounded-lg border"
                />
              </div>
            )}
            
            {item.word_count && (
              <div className="mt-6 pt-4 border-t">
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
