import { getWorkCopyrightStatus } from '@/data/publicDomainWorks';
import { detectLiteraryText } from '@/utils/literaryTextRules';

interface CopyrightNoticeProps {
  subjectName: string;
  topics: string[];
}

export const CopyrightNotice = ({ subjectName, topics }: CopyrightNoticeProps) => {
  const detectedText = detectLiteraryText(subjectName, topics);
  if (!detectedText || detectedText === 'unknown_literary_work') return null;

  const { status } = getWorkCopyrightStatus(detectedText);
  if (status !== 'copyrighted') return null;

  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950/60 px-3.5 py-2.5 mt-2 text-[12px] leading-relaxed text-emerald-300">
      📚 <strong>Note on {detectedText}:</strong> This work is under copyright.
      Questions about themes, characters, and analysis are generated freely.
      Any text passages included will be kept to short educational excerpts
      (max 300 words) in line with fair dealing for educational use.
    </div>
  );
};

export const LiteraryDisclaimer = () => (
  <p className="text-[11px] text-muted-foreground text-center leading-relaxed max-w-[700px] mx-auto py-2">
    Literary passages from public domain works are sourced from clean,
    unmodified texts equivalent to Project Gutenberg editions.
    Excerpts from copyrighted works are used solely for educational
    criticism and analysis under UK Fair Dealing provisions
    (CDPA 1988, s.32) and US Fair Use doctrine.
    All questions are AI-generated original content.
    Examly is not affiliated with any publisher or rights holder.
  </p>
);
