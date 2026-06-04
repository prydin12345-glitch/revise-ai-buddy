import { Clock } from 'lucide-react';

export interface ExamPickerItem {
  id: string;
  examId: string;
  title: string;
  subject: string;
  score: number;
  totalMarks: number;
  pct: number;
  submittedAt: string;
}

interface ExamPickerCardProps {
  items: ExamPickerItem[];
  onSelect: (item: ExamPickerItem) => void;
}

export const ExamPickerCard = ({ items, onSelect }: ExamPickerCardProps) => {
  const scoreColor = (pct: number) =>
    pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (pct: number) =>
    pct >= 70 ? 'bg-emerald-500/10' : pct >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10';

  return (
    <div className="flex flex-col gap-2 w-full">
      {items.slice(0, 6).map((item, i) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="w-full text-left px-3.5 py-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 group"
          style={{ animation: `aiSuggestionFade 0.25s ease ${i * 0.06}s both` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {item.title}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {item.subject && (
                  <span className="text-[11px] text-muted-foreground truncate">{item.subject}</span>
                )}
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(item.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
            <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-bold ${scoreBg(item.pct)} ${scoreColor(item.pct)}`}>
              {item.pct}%
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
