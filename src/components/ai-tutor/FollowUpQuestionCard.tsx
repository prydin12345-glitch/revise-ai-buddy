import { useState } from 'react';
import { CheckCircle2, XCircle, Send } from 'lucide-react';

export interface FollowUpQuestion {
  question: string;
  type: 'short_answer' | 'mcq';
  options: string[];
  correctAnswer: string;
  explanation: string;
  marks: number;
}

interface FollowUpQuestionCardProps {
  question: FollowUpQuestion;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  answered?: {
    studentAnswer: string;
    isCorrect: boolean;
    explanation: string;
  };
}

export const FollowUpQuestionCard = ({
  question,
  onAnswer,
  answered,
}: FollowUpQuestionCardProps) => {
  const [selected, setSelected] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const answer = question.type === 'mcq' ? selected : textAnswer.trim();
    if (!answer) return;
    const isCorrect = question.type === 'mcq'
      ? answer.charAt(0).toUpperCase() === (question.correctAnswer ?? '').charAt(0).toUpperCase()
      : answer.toLowerCase().trim() === (question.correctAnswer ?? '').toLowerCase().trim();
    setSubmitted(true);
    onAnswer(answer, isCorrect);
  };

  if (answered) {
    return (
      <div className={`rounded-2xl border p-4 w-full ${
        answered.isCorrect
          ? 'bg-emerald-500/5 border-emerald-500/25'
          : 'bg-red-500/5 border-red-500/25'
      }`}>
        <div className="flex items-center gap-2 mb-2.5">
          {answered.isCorrect
            ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
            : <XCircle size={15} className="text-red-500 flex-shrink-0" />}
          <span className={`text-[12.5px] font-semibold ${
            answered.isCorrect ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {answered.isCorrect ? 'Correct!' : 'Not quite'}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {question.marks} mark{question.marks !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-[12.5px] text-foreground mb-1.5 leading-snug">
          {question.question}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          <span className="font-medium">Your answer:</span> {answered.studentAnswer}
        </p>
        {!answered.isCorrect && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium">Correct answer:</span> {question.correctAnswer}
            </p>
            {answered.explanation && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {answered.explanation}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
            Quick check
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {question.marks} mark{question.marks !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-[13px] text-foreground font-medium leading-snug mb-3">
        {question.question}
      </p>

      {question.type === 'mcq' && !submitted && (
        <div className="flex flex-col gap-2 mb-3">
          {question.options.map((opt, i) => {
            const letter = opt.charAt(0);
            const isSelected = selected === letter;
            return (
              <button
                key={i}
                onClick={() => setSelected(letter)}
                className={`text-left px-3.5 py-2.5 rounded-xl border text-[12.5px] transition-all duration-150 ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'short_answer' && !submitted && (
        <div className="mb-3">
          <textarea
            value={textAnswer}
            onChange={e => setTextAnswer(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type your answer..."
            rows={2}
            className="w-full resize-none bg-background border border-border rounded-xl px-3.5 py-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors leading-relaxed"
          />
        </div>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={question.type === 'mcq' ? !selected : !textAnswer.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
        >
          <Send size={13} />
          Submit answer
        </button>
      )}
    </div>
  );
};
