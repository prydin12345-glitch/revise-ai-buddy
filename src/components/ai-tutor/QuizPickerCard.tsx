import { BookOpen, Clock } from 'lucide-react';

export interface QuizPickerItem {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
  createdAt: string;
}

interface QuizPickerCardProps {
  items: QuizPickerItem[];
  onSelect: (item: QuizPickerItem) => void;
}

export const QuizPickerCard = ({ items, onSelect }: QuizPickerCardProps) => {
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
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {item.subject && (
                  <span className="text-[11px] text-muted-foreground truncate">{item.subject}</span>
                )}
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <BookOpen size={9} />
                  {item.questionCount} questions
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
              <BookOpen size={11} className="text-primary group-hover:text-primary-foreground transition-colors" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
