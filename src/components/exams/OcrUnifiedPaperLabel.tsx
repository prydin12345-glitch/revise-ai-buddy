import {ocrUnifiedPaperLabel} from '@/lib/biology-paper-display';
export function OcrUnifiedPaperLabel({context}:{context:unknown}) {
  const label=ocrUnifiedPaperLabel(context);
  return label?<p className="text-xs text-muted-foreground">{label}</p>:null;
}
