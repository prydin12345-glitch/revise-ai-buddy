import {ocrUnifiedPaperLabel,edexcelBiologyBPaperLabel} from '@/lib/biology-paper-display';
export function OcrUnifiedPaperLabel({context}:{context:unknown}) {
  const label=edexcelBiologyBPaperLabel(context)??ocrUnifiedPaperLabel(context);
  return label?<p className="text-xs text-muted-foreground">{label}</p>:null;
}
